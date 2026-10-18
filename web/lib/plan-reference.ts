import { z } from 'zod';
import type { StudyData } from './data';
import type { Plan } from '../../src/engine/planner';
import { localDay } from './planning';
const referenceSchema=z.object({day:z.iso.date(),timezone:z.string(),capturedAt:z.iso.datetime(),plannedMinutes:z.number().int().nonnegative(),items:z.array(z.object({competencyId:z.string(),minutes:z.number().int().positive(),method:z.string()})).max(12),existingSessionIds:z.array(z.string()),version:z.string()});
export type PlanReference=z.infer<typeof referenceSchema>;
const key=(userId:string)=>`studygram:plan-references:v1:${userId}`;
export function readReferences(userId:string|undefined):PlanReference[]{
  if(!userId)return [];try{const raw=localStorage.getItem(key(userId));return raw?z.array(referenceSchema).max(90).parse(JSON.parse(raw)):[];}catch{return [];}
}
// First non-empty plan shown in Hoje; recalculation never rewrites the baseline.
export function captureReference(userId:string,plan:Plan,data:StudyData,now:Date):PlanReference {
  const timezone=data.profile?.timezone??'America/Bahia',day=localDay(now,timezone).toString();
  const references=readReferences(userId),existing=references.find(r=>r.day===day&&r.timezone===timezone);
  if(existing)return existing;
  if(plan.plannedMinutes<=0)throw new Error('O plano ainda não tem atividades para guardar.');
  const reference=referenceSchema.parse({day,timezone,capturedAt:now.toISOString(),plannedMinutes:plan.plannedMinutes,items:plan.items.map(i=>({competencyId:i.competencyId,minutes:i.minutes,method:i.method})),existingSessionIds:data.sessions.map(s=>s.id),version:plan.version});
  localStorage.setItem(key(userId),JSON.stringify([...references,reference].sort((a,b)=>b.capturedAt.localeCompare(a.capturedAt)).slice(0,90)));
  return reference;
}
export function compareReferences(data:StudyData,now:Date){
  const timezone=data.profile?.timezone??'America/Bahia',today=localDay(now,timezone),start=today.subtract({days:13}).toString();
  return readReferences(data.userId).filter(r=>r.timezone===timezone&&r.day>=start&&r.day<=today.toString()&&Date.parse(r.capturedAt)<=now.getTime()).map(r=>{
    const sessions=data.sessions.filter(s=>!r.existingSessionIds.includes(s.id)&&s.status!=='missed'&&Date.parse(s.started_at)>=Date.parse(r.capturedAt)&&Date.parse(s.ended_at??s.started_at)<=now.getTime()&&localDay(new Date(s.started_at),timezone).toString()===r.day);
    return {...r,actualMinutes:sessions.reduce((n,s)=>n+s.actual_minutes,0)};
  });
}
