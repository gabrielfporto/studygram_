import { Rating } from 'ts-fsrs';
import { DAY, MINUTE, type Competency, type Evidence } from '../src/domain/model.js';
import { newMemory, reviewMemory } from '../src/engine/memory.js';
import type { PlanInput } from '../src/engine/planner.js';

export const START = new Date('2026-10-15T09:00:00-03:00');
export const USER = 'simulation-user';
export function rng(seed: number): () => number {
  let state = seed >>> 0;
  return () => { state = (1664525 * state + 1013904223) >>> 0; return state / 4294967296; };
}
const areas = [
  ['Neurologia', 'Emergência', ['AVC isquêmico', 'Epilepsia', 'Cefaleia', 'Meningite', 'Delirium']],
  ['Cardiologia', 'Emergência', ['SCA', 'Insuficiência cardíaca', 'Arritmias', 'Síncope', 'Choque']],
  ['Endocrinologia', 'MFC', ['DM2', 'Hipotireoidismo', 'Obesidade', 'Dislipidemia', 'Osteoporose']],
  ['Pneumologia', 'Clínica Médica', ['Pneumonia', 'Asma', 'DPOC', 'TEP', 'Derrame pleural']],
  ['Infectologia', 'Emergência', ['Sepse', 'Dengue', 'Tuberculose', 'HIV', 'Infecção urinária']],
  ['Pediatria', 'Pediatria', ['Bronquiolite', 'Desidratação', 'Puericultura', 'Febre', 'Vacinação']],
  ['Cirurgia', 'Cirurgia', ['Abdome agudo', 'Trauma', 'Hérnias', 'Colecistite', 'Apendicite']],
  ['Obstetrícia', 'Obstetrícia', ['Pré-natal', 'Pré-eclâmpsia', 'Parto', 'Hemorragia', 'Puerpério']],
  ['Nefrologia', 'Clínica Médica', ['Lesão renal aguda', 'DRC', 'Hipercalemia', 'Hiponatremia', 'Litíase']],
  ['Saúde da família', 'MFC', ['HAS', 'Tabagismo', 'Depressão', 'Rastreamento', 'Dor crônica']],
] as const;

export function evidence(at: Date, correct = 8, total = 10): Evidence {
  return { at, correct, total, errors: total - correct, recurringErrors: 0, reportedDifficulty: 0.4 };
}
export function fixtures(seed = 42): Competency[] {
  const random = rng(seed);
  const result: Competency[] = [];
  for (const [area, context, topics] of areas) for (const topic of topics) {
    const topicId = `topic-${Math.floor(result.length / 3)}`;
    for (const title of topic === 'AVC isquêmico' ? ['Reconhecimento clínico', 'Trombólise', 'Prevenção secundária'] : ['Reconhecimento', 'Diagnóstico diferencial', 'Manejo inicial']) {
      const index = result.length;
      const c: Competency = { id: `c-${String(index).padStart(3, '0')}`, userId: USER, topicId,
        area, topic, title, contextIds: [context], importance: index % 3 === 0 ? 0.95 : index % 3 === 1 ? 0.65 : 0.3,
        manualPriority: 0, newMinutes: 30 + (index % 3) * 5, reviewMinutes: 20 + (index % 3) * 5,
        effort: index % 3 === 0 ? 'high' : index % 3 === 1 ? 'medium' : 'low',
        card: newMemory(START), evidence: [], archived: false };
      // 100 competências com histórico; 50 sem estudo. Histórico também usa FSRS real.
      if (index % 3 !== 2) {
        for (const offset of [35, 21, 7]) {
          const at = new Date(START.getTime() - (offset + index % 5) * DAY);
          const ev = evidence(at, Math.floor(5 + random() * 6));
          c.card = reviewMemory(c.card, at, Rating.Good, ev).card;
          c.evidence.push(ev);
        }
      }
      result.push(c);
    }
  }
  return result;
}
export function inputFor(competencies: Competency[], minutes = 60, now = START): PlanInput {
  return { userId: USER, competencies, now, windows: minutes ? [{ start: now.getTime(), end: now.getTime() + minutes * MINUTE }] : [],
    busy: [], dailyMinutes: minutes, spentMinutes: 0, weeklyRemainingMinutes: 600,
    minimumSession: 10, maximumSessions: 6, maxEffort: 'high', completedIds: [],
    rotations: [{ contextId: 'MFC', start: new Date(START.getTime() - DAY), end: new Date(START.getTime() + 30 * DAY) },
      { contextId: 'Emergência', start: new Date(START.getTime() + 30 * DAY), end: new Date(START.getTime() + 90 * DAY) }],
    exams: [{ at: new Date(START.getTime() + 45 * DAY), competencyIds: competencies.filter(c => c.area === 'Neurologia').map(c => c.id) }],
  };
}
