import { z } from 'zod';
import { supabase } from './client';
import { newMemory } from '../../src/engine/memory';
import { deserializeCard } from '../../src/application/session';
import { validateCompetency, notionSourceSchema } from '../../src/domain/model';

const named = z.object({ id: z.string(), title: z.string() });
const competency = named.extend({ topic_id: z.string(), importance: z.coerce.number(), manual_priority: z.coerce.number(),
  new_minutes: z.number(), review_minutes: z.number(), effort: z.enum(['low','medium','high']), archived: z.boolean(), notion_source: notionSourceSchema.nullable().optional() });
const question = z.object({ competency_id: z.string(), total: z.number(), correct: z.number(), occurred_at: z.string() });
const session = z.object({ id: z.string(), competency_id: z.string(), actual_minutes: z.number(), started_at: z.string(), ended_at: z.string().nullable(),
  status: z.string(), method: z.string(), feedback: z.number().nullable() });
export const ruleSchema = z.object({ weekday: z.number(), starts_local: z.string(), ends_local: z.string(), daily_cap_minutes: z.number(),
  minimum_session_minutes: z.number(), max_effort: z.enum(['low','medium','high']) });
export type Rule = z.infer<typeof ruleSchema>;
async function rows<T>(table: string, userId: string, schema: z.ZodType<T>): Promise<T[]> {
  const result: T[] = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await supabase.from(table).select('*').eq('user_id', userId).order('id').range(offset, offset + 499);
    if (error) throw error;
    const page = z.array(schema).parse(data);
    result.push(...page);
    if (page.length < 500) break;
  }
  return result;
}
export async function loadData(userId: string) {
  const [areas, topics, competencies, reviews, questions, sessions, rules, contexts, rotations, links] = await Promise.all([
    rows('study_areas', userId, named), rows('topics', userId, named.extend({ area_id: z.string() })), rows('competencies', userId, competency),
    rows('reviews', userId, z.object({ competency_id: z.string(), card: z.record(z.string(), z.unknown()) })),
    rows('question_sessions', userId, question), rows('study_sessions', userId, session), rows('availability_rules', userId, ruleSchema),
    rows('academic_contexts', userId, named), rows('rotations', userId, z.object({ context_id: z.string(), starts_at: z.string(), ends_at: z.string() })),
    // Tabela de ligação não tem id, por isso consulta própria com chave composta ordenada.
    supabase.from('competency_contexts').select('competency_id,context_id').eq('user_id', userId).order('competency_id').limit(10000),
  ]);
  if (links.error) throw links.error;
  const { data: profile, error } = await supabase.from('profiles').select('goal,timezone').eq('user_id', userId).maybeSingle();
  if (error) throw error;
  const safeProfile = profile ? z.object({ goal: z.string(), timezone: z.string() }).parse(profile) : null;
  const now = new Date();
  const models = competencies.map(c => {
    const topic = topics.find(t => t.id === c.topic_id);
    const area = areas.find(a => a.id === topic?.area_id);
    const review = reviews.find(r => r.competency_id === c.id);
    const ev = questions.filter(q => q.competency_id === c.id).map(q => ({ at: new Date(q.occurred_at), total: q.total, correct: q.correct,
      errors: q.total - q.correct, recurringErrors: 0, reportedDifficulty: 0.5 }));
    // Feedback de recuperação também conta quando não houve questões.
    for (const s of sessions.filter(s => s.competency_id === c.id && s.feedback !== null && s.status !== 'missed' && s.method !== 'reading')) {
      ev.push({ at: new Date(s.ended_at ?? s.started_at), total: 0, correct: 0, errors: 0, recurringErrors: 0, reportedDifficulty: (4 - s.feedback!) / 3 });
    }
    return validateCompetency({ id: c.id, userId, topicId: c.topic_id, area: area?.title ?? 'Área', topic: topic?.title ?? 'Tema', title: c.title,
      contextIds: (links.data ?? []).filter(l => l.competency_id === c.id).map(l => l.context_id), importance: c.importance,
      manualPriority: c.manual_priority, newMinutes: c.new_minutes, reviewMinutes: c.review_minutes, effort: c.effort,
      archived: c.archived, notionSource: c.notion_source ?? null, card: review ? deserializeCard(review.card) : newMemory(now), evidence: ev });
  });
  return { profile: safeProfile, areas, topics, competencies: models, sessions, questions, rules, contexts,
    rotations: rotations.map(r => ({ contextId: r.context_id, start: new Date(r.starts_at), end: new Date(r.ends_at) })) };
}
export type StudyData = Awaited<ReturnType<typeof loadData>>;
