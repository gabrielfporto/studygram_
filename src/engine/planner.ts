import { z } from 'zod';
import { DAY, MINUTE, contextSchema, validateCompetency, type Busy, type Competency, type Context, type Effort, type Window } from '../domain/model.js';
import { availability } from './availability.js';
import { priority, type Priority, type Weights, ENGINE_VERSION } from './priority.js';
import { nextStudyStep, type StudyMethod } from './study-cycle.js';

export interface PlanInput extends Context {
  userId: string; competencies: Competency[]; windows: Window[]; busy: Busy[];
  dailyMinutes: number; spentMinutes: number; weeklyRemainingMinutes: number;
  minimumSession: number; maximumSessions: number; maxEffort: Effort;
  completedIds: string[]; weights?: Weights;
  useStudyCycle?: boolean; startSmall?: boolean;
}
export interface Activity {
  competencyId: string; method: StudyMethod; minutes: number;
  utility: number; expectedValuePerMinute: number; priority: Priority;
}
export interface PlanItem extends Activity { start: number; end: number }
export interface Plan {
  version: string; capacityMinutes: number; plannedMinutes: number; freeWindows: Window[];
  items: PlanItem[]; deferred: { competencyId: string; reason: string }[];
}
const limitsSchema = z.object({
  userId: z.string().min(1), now: z.date(), dailyMinutes: z.number().int().min(0).max(720),
  spentMinutes: z.number().int().nonnegative(), weeklyRemainingMinutes: z.number().int().nonnegative(),
  minimumSession: z.number().int().min(5).max(60), maximumSessions: z.number().int().min(1).max(12),
  maxEffort: z.enum(['low', 'medium', 'high']),
});
const rank = { low: 0, medium: 1, high: 2 };

function alternatives(c: Competency, p: Priority, maxEffort: Effort, minimum: number, input: PlanInput): Activity[] {
  const make = (minutes: number, method: Activity['method'], gain: number): Activity => ({
    competencyId: c.id, method, minutes, priority: p, utility: p.score * gain,
    expectedValuePerMinute: p.score * gain / minutes,
  });
  if (input.useStudyCycle) {
    const step = nextStudyStep(c,input.now);
    if (!step.ready || (!input.startSmall && rank[step.effort] > rank[maxEffort])) return [];
    const minutes = input.startSmall ? 5 : step.minutes;
    // Product scheduling priority, not a measured learning gain per minute.
    return minutes >= minimum ? [make(minutes,step.method,1)] : [];
  }
  const importedStudy = c.notionSource && (c.notionSource.studied || c.notionSource.questions || c.notionSource.retrieval);
  if (!c.card.reps && !importedStudy) return maxEffort === 'high' ? [make(c.newMinutes, 'new', 1.4)].filter(a => a.minutes >= minimum) : [];
  const result: Activity[] = [];
  // Recuperação breve é de baixo esforço; abordagem completa respeita o esforço do conteúdo.
  result.push(make(10, 'recall', 0.65));
  if (rank[c.effort] <= rank[maxEffort]) result.push(make(c.reviewMinutes, 'questions', 1));
  return result.filter(a => a.minutes >= minimum);
}

interface Choice { value: number; items: Activity[] }
// Mochila de múltipla escolha: no máximo uma alternativa por competência.
function choose(groups: Activity[][], capacity: number, maxCount: number): Activity[] {
  let states = new Map<string, Choice>([['0:0', { value: 0, items: [] }]]);
  for (const options of groups) {
    const next = new Map(states);
    for (const [key, previous] of states) {
      const [used = 0, count = 0] = key.split(':').map(Number);
      for (const option of options) {
        const minutes = used + option.minutes;
        if (minutes > capacity || count >= maxCount) continue;
        const target = `${minutes}:${count + 1}`;
        const value = previous.value + option.utility;
        if (value > (next.get(target)?.value ?? -1) + 1e-9) next.set(target, { value, items: [...previous.items, option] });
      }
    }
    states = next;
  }
  return [...states.values()].sort((a, b) => b.value - a.value)[0]?.items ?? [];
}

export function planDay(input: PlanInput): Plan {
  limitsSchema.parse(input);
  contextSchema.parse(input);
  if (input.windows.some(w => w.end > input.now.getTime() + DAY)) throw new Error('Janelas devem pertencer ao dia planejado');
  const competencies = input.competencies.map(validateCompetency);
  if (competencies.some(c => c.userId !== input.userId)) throw new Error('Competência de outro usuário');
  if (new Set(competencies.map(c => c.id)).size !== competencies.length) throw new Error('Competência duplicada');
  const freeWindows = availability(input.windows, input.busy, input.now, input.minimumSession);
  const freeMinutes = freeWindows.reduce((s, w) => s + Math.floor((w.end - w.start) / MINUTE), 0);
  const capacityMinutes = Math.max(0, Math.min(freeMinutes, input.dailyMinutes - input.spentMinutes, input.weeklyRemainingMinutes));
  const done = new Set(input.completedIds);
  const candidates = competencies.filter(c => !c.archived && !done.has(c.id)).sort((a, b) => a.id < b.id ? -1 : 1);
  const groups = new Map(candidates.map(c => [c.id, alternatives(c, priority(c, input, input.weights), input.maxEffort, input.minimumSession,input)]));
  const items: PlanItem[] = [];
  let remaining = capacityMinutes;
  let preparationCount=0;
  for (const window of freeWindows) {
    const windowCapacity=Math.min(remaining, Math.floor((window.end - window.start) / MINUTE));
    let selected:Activity[];
    if(input.useStudyCycle){
      // Avoid maximizing the count of cheap activities. Select by priority with
      // a deliberate product limit on context changes, respecting real windows.
      selected=[];let available=windowCapacity;
      const options=[...groups.values()].flat().sort((a,b)=>Number(a.method==='priming')-Number(b.method==='priming')||b.priority.score-a.priority.score||a.competencyId.localeCompare(b.competencyId));
      for(const option of options){
        if(items.length+selected.length>=Math.min(input.maximumSessions,input.startSmall?1:3))break;
        if(option.minutes>available||(option.method==='priming'&&preparationCount>=1))continue;
        selected.push(option);available-=option.minutes;if(option.method==='priming')preparationCount++;
      }
    }else selected=choose([...groups.values()],windowCapacity,input.maximumSessions-items.length);
    selected=selected
      .sort((a, b) => b.priority.score - a.priority.score || (a.competencyId < b.competencyId ? -1 : 1));
    let cursor = window.start;
    for (const activity of selected) {
      items.push({ ...activity, start: cursor, end: cursor + activity.minutes * MINUTE });
      cursor += activity.minutes * MINUTE;
      remaining -= activity.minutes;
      groups.delete(activity.competencyId);
    }
  }
  return { version: ENGINE_VERSION+(input.useStudyCycle?'/cycle-2':''), capacityMinutes, plannedMinutes: capacityMinutes - remaining, freeWindows, items,
    deferred: [...groups].map(([competencyId, options]) => ({ competencyId,
      reason: options.length ? 'Menor valor dentro da capacidade e dos limites de hoje' : 'Esforço ou duração incompatível com a disponibilidade' })) };
}
