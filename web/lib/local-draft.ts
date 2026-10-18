import { useState } from 'react';
import { z } from 'zod';
const maxAge=30*86400000;
export function draftKey(userId:string,kind:string){return `studygram:draft:v1:${userId}:${kind}`;}
export function readLocalDraft<T>(userId:string|undefined,kind:string,schema:z.ZodType<T>,now=Date.now()):T|null {
  if(!userId)return null;
  try {const raw=localStorage.getItem(draftKey(userId,kind));if(!raw)return null;const envelope=z.object({at:z.number(),value:schema}).parse(JSON.parse(raw));return envelope.at<=now&&now-envelope.at<=maxAge?envelope.value:null;}catch{return null;}
}
export function useLocalDraft<T extends object>(userId:string|undefined,kind:string,schema:z.ZodType<T>,initial:()=>NoInfer<T>) {
  const [restored]=useState(()=>readLocalDraft(userId,kind,schema));
  const [value,setValue]=useState<T>(()=>restored??initial());
  const [saved,setSaved]=useState(!!restored),[failed,setFailed]=useState(false);
  function update(patch:Partial<T>){const next={...value,...patch};setValue(next);if(!userId)return;try{localStorage.setItem(draftKey(userId,kind),JSON.stringify({at:Date.now(),value:next}));setSaved(true);setFailed(false);}catch{setFailed(true);}}
  function clear(){if(userId)try{localStorage.removeItem(draftKey(userId,kind));}catch{setFailed(true);return false;}setSaved(false);return true;}
  function discard(){if(clear()){setValue(initial());setFailed(false);}}
  return {value,update,clear,discard,saved,failed};
}

export const sessionDraftSchema=z.object({id:z.uuid(),selected:z.string(),duration:z.number().min(0).max(720),studyMethod:z.enum(['','priming','reading','recall','questions','new','case','explanation']),status:z.enum(['completed','partial','missed']),feedback:z.number().int().min(0).max(4),total:z.number().min(0).max(1000),correct:z.number().min(-1).max(1000),notes:z.string().max(4000),endedLocal:z.string().max(40),timezone:z.string().max(100)});
export const routineDraftSchema=z.object({goal:z.string().max(1000),timezone:z.string().max(100),context:z.string().max(200),rules:z.array(z.object({weekday:z.number().int().min(0).max(6),start:z.string().max(8),end:z.string().max(8),minutes:z.number().min(0).max(1440),effort:z.enum(['low','medium','high'])})).length(7)});
