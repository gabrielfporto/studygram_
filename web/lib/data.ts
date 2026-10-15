import { z } from 'zod';
import { supabase } from './client';
import { newMemory } from '../../src/engine/memory';
import { deserializeCard } from '../../src/application/session';
import { validateCompetency, notionSourceSchema } from '../../src/domain/model';
import { stagesFromSessions } from '../../src/engine/study-cycle';

const named = z.object({ id: z.string(), title: z.string() });
const competency = named.extend({ topic_id: z.string(), importance: z.coerce.number(), manual_priority: z.coerce.number(),
  new_minutes: z.number(), review_minutes: z.number(), effort: z.enum(['low','medium','high']), archived: z.boolean(), notion_source: notionSourceSchema.nullable().optional(), resource_url:z.string().nullable().optional() });
const question = z.object({ competency_id: z.string(), total: z.number(), correct: z.number(), occurred_at: z.string(), session_id:z.string().nullable().optional() });
const session = z.object({ id: z.string(), competency_id: z.string(), actual_minutes: z.number(), started_at: z.string(), ended_at: z.string().nullable(),
  status: z.string(), method: z.string(), feedback: z.number().nullable(), notes:z.string().nullable().optional() });
export const ruleSchema = z.object({ weekday: z.number(), starts_local: z.string(), ends_local: z.string(), daily_cap_minutes: z.number(),
  minimum_session_minutes: z.number(), max_effort: z.enum(['low','medium','high']) });
export type Rule = z.infer<typeof ruleSchema>;
const connection=z.object({id:z.string(),external_calendar_id:z.string(),display_name:z.string().nullable().optional(),status:z.enum(['connected','expired','disconnected']),last_synced_at:z.string().nullable(),sync_range_start:z.string().nullable().optional(),sync_range_end:z.string().nullable().optional()});
const calendarEvent=z.object({id:z.string(),connection_id:z.string(),starts_at:z.string(),ends_at:z.string(),status:z.enum(['busy','free','cancelled'])});
async function rows<T>(table: string, userId: string, schema: z.ZodType<T>,order=['id']): Promise<T[]> {
  const result: T[] = [];
  for (let offset = 0; ; offset += 500) {
    let query=supabase.from(table).select('*').eq('user_id',userId);
    for(const key of order)query=query.order(key);
    const {data,error}=await query.range(offset,offset+499);
    if (error) throw error;
    const page = z.array(schema).parse(data);
    result.push(...page);
    if (page.length < 500) break;
  }
  return result;
}
export async function loadData(userId: string) {
  const [areas, topics, competencies, reviews, questions, sessions, rules, contexts, rotations, links, connections, calendarEvents, mistakes, exams, examLinks] = await Promise.all([
    rows('study_areas', userId, named), rows('topics', userId, named.extend({ area_id: z.string() })), rows('competencies', userId, competency),
    rows('reviews', userId, z.object({ competency_id: z.string(), card: z.record(z.string(), z.unknown()) })),
    rows('question_sessions', userId, question), rows('study_sessions', userId, session), rows('availability_rules', userId, ruleSchema),
    rows('academic_contexts', userId, named), rows('rotations', userId, z.object({ id:z.string(), context_id: z.string(), starts_at: z.string(), ends_at: z.string(), archived:z.boolean() })),
    rows('competency_contexts',userId,z.object({competency_id:z.string(),context_id:z.string()}),['competency_id','context_id']),
    rows('calendar_connections',userId,connection),rows('calendar_events',userId,calendarEvent),
    rows('mistakes',userId,z.object({id:z.string(),competency_id:z.string(),description:z.string(),classification_key:z.string().nullable(),occurred_at:z.string(),resolved_at:z.string().nullable()})),
    rows('exams',userId,z.object({id:z.string(),title:z.string(),occurs_at:z.string(),archived:z.boolean()})),
    rows('exam_competencies',userId,z.object({exam_id:z.string(),competency_id:z.string()}),['exam_id','competency_id']),
  ]);
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
    for (const s of sessions.filter(s => s.competency_id === c.id && s.feedback !== null && s.status !== 'missed' && !['reading','priming'].includes(s.method)
      && (s.method!=='questions'||questions.some(q=>q.session_id===s.id && q.total>0)))) {
      ev.push({ at: new Date(s.ended_at ?? s.started_at), total: 0, correct: 0, errors: 0, recurringErrors: 0, reportedDifficulty: (4 - s.feedback!) / 3 });
    }
    return validateCompetency({ id: c.id, userId, topicId: c.topic_id, area: area?.title ?? 'Área', topic: topic?.title ?? 'Tema', title: c.title,
      contextIds: links.filter(l => l.competency_id === c.id).map(l => l.context_id), importance: c.importance,
      manualPriority: c.manual_priority, newMinutes: c.new_minutes, reviewMinutes: c.review_minutes, effort: c.effort,
      archived: c.archived, notionSource: c.notion_source ?? null, materialUrl:c.resource_url ?? null,
      mistakeHistory:mistakes.filter(m=>m.competency_id===c.id&&!m.resolved_at).map(m=>({at:new Date(m.occurred_at),key:m.classification_key??m.description})),
      completedStages:stagesFromSessions(sessions.filter(s=>s.competency_id===c.id),questions),
      ...(()=>{const exposure=sessions.filter(s=>s.competency_id===c.id&&s.actual_minutes>0&&Date.parse(s.started_at)<=now.getTime()).sort((a,b)=>b.started_at.localeCompare(a.started_at))[0];return exposure?{lastExposure:new Date(exposure.ended_at??exposure.started_at)}:{};})(),
      card: review ? deserializeCard(review.card) : newMemory(now), evidence: ev.sort((a,b)=>a.at.getTime()-b.at.getTime()) });
  });
  return { userId,mistakes,exams:exams.filter(e=>!e.archived).map(e=>({id:e.id,title:e.title,at:new Date(e.occurs_at),competencyIds:examLinks.filter(l=>l.exam_id===e.id).map(l=>l.competency_id)})),calendar:{connections,events:calendarEvents},profile: safeProfile, areas, topics, competencies: models, sessions, questions, rules, contexts,
    rotations: rotations.filter(r=>!r.archived).map(r => ({ id:r.id, contextId: r.context_id, start: new Date(r.starts_at), end: new Date(r.ends_at) })).sort((a,b)=>b.start.getTime()-a.start.getTime()) };
}
type LoadedData=Awaited<ReturnType<typeof loadData>>;
export type StudyData = Omit<LoadedData,'calendar'|'userId'|'mistakes'|'exams'|'rotations'> & {rotations: (LoadedData['rotations'][number] | Omit<LoadedData['rotations'][number],'id'>)[]} & Partial<Pick<LoadedData,'calendar'|'userId'|'mistakes'|'exams'>>;
