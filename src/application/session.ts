import { z } from 'zod';
import { type Grade } from 'ts-fsrs';
import { cardSchema, type Evidence } from '../domain/model.js';
import { newMemory, reviewMemory, learningState, memoryParameters, MEMORY_VERSION } from '../engine/memory.js';

export const sessionSchema = z.object({
  competencyId: z.uuid(), idempotencyKey: z.uuid(), actualMinutes: z.number().int().min(0).max(720),
  plannedMinutes: z.number().int().min(1).max(90).nullable(), startedAt: z.iso.datetime(), endedAt: z.iso.datetime(),
  method: z.enum(['new','reading','recall','questions','case','explanation']),
  status: z.enum(['completed','partial','missed']), feedback: z.number().int().min(1).max(4),
  total: z.number().int().min(0).max(1000), correct: z.number().int().min(0).max(1000),
  notes: z.string().max(4000),
}).superRefine((s, ctx) => {
  if (s.correct > s.total) ctx.addIssue({ code: 'custom', message: 'Acertos maiores que o total' });
  if (new Date(s.endedAt) < new Date(s.startedAt)) ctx.addIssue({ code: 'custom', message: 'Horário inválido' });
  if ((s.status === 'missed') !== (s.actualMinutes === 0)) ctx.addIssue({ code: 'custom', message: 'Duração incompatível com status' });
  if (s.status === 'missed' && s.total > 0) ctx.addIssue({ code: 'custom', message: 'Ausência não tem questões' });
  if (s.method === 'reading' && s.total > 0) ctx.addIssue({ code: 'custom', message: 'Use o método questões para registrar acertos' });
});
export type SessionInput = z.infer<typeof sessionSchema>;
export function deserializeCard(raw: Record<string, unknown>) {
  const parsed = cardSchema.parse({ ...raw, due: new Date(String(raw.due)),
    ...(raw.last_review ? { last_review: new Date(String(raw.last_review)) } : {}) });
  const { last_review, ...rest } = parsed;
  return last_review ? { ...rest, last_review } : rest;
}
export function prepareReview(input: SessionInput, rawCard: Record<string, unknown> | null, history: Evidence[], now: Date) {
  const s = sessionSchema.parse(input);
  const at = new Date(s.endedAt);
  if (at.getTime() > now.getTime() + 60_000) throw new Error('Sessão no futuro');
  if (s.status === 'missed' || s.method === 'reading') return null;
  const before = rawCard ? deserializeCard(rawCard) : newMemory(at);
  const ev: Evidence = { at, total: s.total, correct: s.correct, errors: s.total - s.correct, recurringErrors: 0,
    reportedDifficulty: (4 - s.feedback) / 3 };
  const result = reviewMemory(before, at, s.feedback as Grade, ev);
  const labels: Record<string, string> = { 'Não estudado': 'new', 'Aprendendo': 'learning', 'Consolidando': 'consolidating', 'Manutenção': 'maintenance' };
  return { card: result.card, before, rating: result.log.rating, parameters: memoryParameters, version: MEMORY_VERSION,
    state: labels[learningState(result.card, [...history, ev])]! };
}
