import { createEmptyCard, fsrs, generatorParameters, Rating, type Card, type Grade } from 'ts-fsrs';
import { evidenceSchema, type Evidence } from '../domain/model.js';

export const MEMORY_VERSION = 'ts-fsrs@5.4.2/retention-0.9/v1';
export const memoryParameters = generatorParameters({
  request_retention: 0.9, enable_fuzz: false, enable_short_term: false,
});
const scheduler = fsrs(memoryParameters);
export const newMemory = (now: Date): Card => createEmptyCard(now);
export function retention(card: Card, now: Date): number | null {
  if (!card.last_review) return null;
  if (now < card.last_review) throw new Error('Relógio anterior à última revisão');
  return scheduler.get_retrievability(card, now, false);
}
export function objectiveRating(evidence: Evidence, feedback: Grade): Grade {
  evidenceSchema.parse(evidence);
  if (evidence.total === 0) return feedback;
  const rate = evidence.correct / evidence.total;
  return rate < 0.5 ? Rating.Again : rate < 0.75 ? Rating.Hard : rate < 0.95 ? Rating.Good : Rating.Easy;
}
export function reviewMemory(card: Card, at: Date, feedback: Grade, evidence: Evidence) {
  if (!Number.isFinite(at.getTime())) throw new Error('Data de revisão inválida');
  if (![1, 2, 3, 4].includes(feedback)) throw new Error('Rating inválido');
  if (card.last_review && at < card.last_review) throw new Error('Revisão fora de ordem');
  if (evidence.at.getTime() !== at.getTime()) throw new Error('Evidência deve pertencer à revisão');
  return scheduler.next(card, at, objectiveRating(evidence, feedback));
}
export function learningState(card: Card, evidence: Evidence[]): string {
  if (card.reps === 0) return 'Não estudado';
  const ordered = [...evidence].sort((a, b) => a.at.getTime() - b.at.getTime());
  const latest = ordered.at(-1);
  if (latest && latest.total > 0 && latest.correct / latest.total < 0.5) return 'Aprendendo';
  const recent = ordered.slice(-5);
  const total = recent.reduce((s, e) => s + e.total, 0);
  const correct = recent.reduce((s, e) => s + e.correct, 0);
  if (card.stability >= 21 && card.reps >= 4 && total >= 10 && correct / total >= 0.8) return 'Manutenção';
  if (card.stability >= 4 && card.reps >= 2) return 'Consolidando';
  return 'Aprendendo';
}
