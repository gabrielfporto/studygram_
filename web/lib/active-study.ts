import { z } from 'zod';
const draftSchema=z.object({ id:z.uuid(), competencyId:z.string().min(1), method:z.enum(['priming','reading','recall','questions','new']),
  minutes:z.number().int().min(1).max(90), small:z.boolean(), startedAt:z.iso.datetime(), pausedAt:z.number().nullable(), pausedMs:z.number().nonnegative(),objective:z.string().max(300).optional() });
export type StudyDraft=z.infer<typeof draftSchema>;
const key=(userId:string)=>`studygram:active-study:${userId}`;
export function readDraft(userId:string):StudyDraft|null {
  try { const raw=localStorage.getItem(key(userId)); return raw?draftSchema.parse(JSON.parse(raw)):null; } catch { return null; }
}
export function storeDraft(userId:string,draft:StudyDraft|null) {
  try { if(draft) localStorage.setItem(key(userId),JSON.stringify(draft)); else localStorage.removeItem(key(userId)); } catch { /* A sessão continua na aba se o armazenamento não estiver disponível. */ }
}
export function elapsedSeconds(draft:StudyDraft,now:number):number {
  return Math.max(0,Math.floor(((draft.pausedAt??now)-Date.parse(draft.startedAt)-draft.pausedMs)/1000));
}
export function togglePause(draft:StudyDraft,now:number):StudyDraft {
  return draft.pausedAt===null ? {...draft,pausedAt:now} : {...draft,pausedAt:null,pausedMs:draft.pausedMs+Math.max(0,now-draft.pausedAt)};
}
