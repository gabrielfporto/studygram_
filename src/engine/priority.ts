import { z } from 'zod';
import { clamp, daysBetween, type Competency, type Context } from '../domain/model.js';
import { retention } from './memory.js';

export const ENGINE_VERSION = 'priority-1.0/planner-1.0';
export const weightsSchema = z.object({
  memory: z.number().finite().nonnegative(), weakness: z.number().finite().nonnegative(),
  context: z.number().finite().nonnegative(), importance: z.number().finite().nonnegative(),
  events: z.number().finite().nonnegative(), exposure: z.number().finite().nonnegative(),
}).refine(w => Object.values(w).reduce((a, b) => a + b, 0) > 0, 'Pesos não podem ser todos zero');
export const defaultWeights = { memory: 30, weakness: 20, context: 20, importance: 15, events: 10, exposure: 5 };
export type Weights = z.infer<typeof weightsSchema>;
export interface Priority {
  score: number; retention: number | null; factors: Weights;
  contributions: Weights & { manual: number }; reasons: string[];
}

export function weakness(c: Competency, now: Date): number {
  const events = c.evidence.filter(e => daysBetween(now, e.at) >= 0 && daysBetween(now, e.at) <= 30)
    .sort((a, b) => a.at.getTime() - b.at.getTime());
  const total = events.reduce((s, e) => s + e.total, 0);
  const wrong = events.reduce((s, e) => s + e.total - e.correct, 0);
  const errors = events.reduce((s, e) => s + e.errors, 0);
  const recurring = events.reduce((s, e) => s + e.recurringErrors, 0);
  const reported = events.at(-1)?.reportedDifficulty ?? 0.5;
  const mid = Math.floor(events.length / 2);
  const rate = (items: typeof events) => {
    const n = items.reduce((s, e) => s + e.total, 0);
    return n ? items.reduce((s, e) => s + e.correct, 0) / n : 0.5;
  };
  const worsening = events.length >= 2 ? clamp(rate(events.slice(0, mid)) - rate(events.slice(mid))) : 0;
  const objective = 0.45 * ((wrong + 2) / (total + 4)) + 0.2 * clamp(errors / 10)
    + 0.15 * clamp(recurring / 5) + 0.1 * clamp(c.card.lapses / 5) + 0.1 * worsening;
  // Erros descritos não são convertidos em tentativas ou acertos fictícios.
  const recorded=(c.mistakeHistory??[]).filter(m=>daysBetween(now,m.at)>=0&&daysBetween(now,m.at)<=30);
  const repeated=recorded.length-new Set(recorded.map(m=>m.key)).size;
  return clamp(0.8 * (total ? objective : 0.5) + 0.2 * reported + 0.1*clamp(recorded.length/5) + 0.05*clamp(repeated/3));
}

export function priority(c: Competency, context: Context, custom: Weights = defaultWeights): Priority {
  const weights = weightsSchema.parse(custom);
  const { now } = context;
  const r = retention(c.card, now);
  const overdue = daysBetween(now, c.card.due);
  const memory = r === null ? 0.35 : Math.max(1 - r, overdue >= 0 ? clamp(0.35 + overdue / 7) : 0);
  const relevance = Math.max(0, ...context.rotations.filter(x => c.contextIds.includes(x.contextId)).map(x => {
    if (now >= x.start && now < x.end) return 1;
    const days = daysBetween(x.start, now);
    return days > 0 && days <= 28 ? 0.8 * (1 - days / 28) : 0;
  }));
  const event = Math.max(0, ...context.exams.filter(x => x.competencyIds.includes(c.id)).map(x => {
    const days = daysBetween(x.at, now);
    return days >= 0 ? clamp(1 - days / 30) : 0;
  }));
  const exposureAge = c.lastExposure ? daysBetween(now, c.lastExposure) : Infinity;
  const factors = { memory, weakness: weakness(c, now), context: relevance, importance: c.importance,
    events: event, exposure: exposureAge >= 0 ? clamp(1 - exposureAge / 7) : 0 };
  const sum = Object.values(weights).reduce((a, b) => a + b, 0);
  const contributions = { ...defaultWeights, manual: c.manualPriority * 10 };
  for (const key of Object.keys(weights) as (keyof Weights)[]) contributions[key] = factors[key] * weights[key] / sum * 100;
  const reasons: string[] = [];
  if (r === null) reasons.push(c.notionSource && (c.notionSource.studied || c.notionSource.questions || c.notionSource.retrieval)
    ? 'Estudo informado no Notion · valide com uma recuperação' : 'Memória ainda não avaliada');
  else if (memory >= 0.35) reasons.push(`Revisão necessária · ${Math.round(r * 100)}% de retenção estimada`);
  if (factors.weakness > 0.45) reasons.push('Dificuldade e erros recentes');
  if (relevance === 1) reasons.push('Relevante para o contexto atual');
  else if (relevance > 0) reasons.push('Preparação para o próximo contexto');
  if (event > 0) reasons.push('Prova próxima');
  if (c.importance >= 0.8) reasons.push('Alta importância');
  return { score: Math.min(100, Object.values(contributions).reduce((a, b) => a + b, 0)),
    retention: r, factors, contributions, reasons };
}
