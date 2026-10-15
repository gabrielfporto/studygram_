import { z } from 'zod';
import type { Card } from 'ts-fsrs';

export const unit = z.number().finite().min(0).max(1);
const natural = z.number().int().nonnegative();
export const effortSchema = z.enum(['low', 'medium', 'high']);
export type Effort = z.infer<typeof effortSchema>;
export const cardSchema = z.object({
  due: z.date(), stability: z.number().nonnegative(), difficulty: z.number().min(0).max(10),
  elapsed_days: natural, scheduled_days: natural, learning_steps: natural,
  reps: natural, lapses: natural, state: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]),
  last_review: z.date().optional(),
});
export const evidenceSchema = z.object({
  at: z.date(), total: natural, correct: natural, errors: natural,
  recurringErrors: natural, reportedDifficulty: unit,
}).refine(e => e.correct <= e.total && e.errors <= e.total && e.recurringErrors <= e.errors,
  'Evidência incompatível com o total de tentativas');
export type Evidence = z.infer<typeof evidenceSchema>;
export const competencySchema = z.object({
  id: z.string().min(1), userId: z.string().min(1), topicId: z.string().min(1),
  area: z.string().min(1), topic: z.string().min(1), title: z.string().min(1),
  contextIds: z.array(z.string()), importance: unit, manualPriority: unit.default(0),
  newMinutes: z.number().int().min(25).max(90), reviewMinutes: z.number().int().min(10).max(45),
  effort: effortSchema, card: cardSchema, evidence: z.array(evidenceSchema),
  lastExposure: z.date().optional(), archived: z.boolean().default(false),
});
export type Competency = Omit<z.infer<typeof competencySchema>, 'card'> & { card: Card };
export interface Rotation { contextId: string; start: Date; end: Date }
export interface Exam { competencyIds: string[]; at: Date }
export interface Context { now: Date; rotations: Rotation[]; exams: Exam[] }
export const contextSchema = z.object({
  now: z.date(),
  rotations: z.array(z.object({ contextId: z.string().min(1), start: z.date(), end: z.date() })
    .refine(r => r.end > r.start, 'Rodízio com intervalo inválido')),
  exams: z.array(z.object({ competencyIds: z.array(z.string().min(1)), at: z.date() })),
});
export interface Window { start: number; end: number }
export interface Busy extends Window { status: 'busy' | 'free' | 'cancelled' }
export const DAY = 86_400_000;
export const MINUTE = 60_000;
export const clamp = (value: number) => Math.max(0, Math.min(1, value));
export const daysBetween = (a: Date, b: Date) => (a.getTime() - b.getTime()) / DAY;
export function validateCompetency(value: unknown): Competency {
  const parsed = competencySchema.parse(value);
  const { last_review, ...rest } = parsed.card;
  return { ...parsed, card: last_review ? { ...rest, last_review } : rest };
}
