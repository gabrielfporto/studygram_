import { supabase } from './client';
import { validateProposal,type AIRequest,type AIProposal } from '../../src/application/ai';
import type { Competency } from '../../src/domain/model';
import { normalize } from '../../src/application/notion-import';
async function invoke(body:AIRequest|{action:'status'}){const {data,error}=await supabase.functions.invoke('study-ai',{body});if(error){let message='Não foi possível consultar a IA. Tente novamente.';if(error.context instanceof Response){const payload=await error.context.json().catch(()=>null);if(payload?.error)message=payload.error;}throw new Error(message);}if(data?.error)throw new Error(data.error);return data;}
export const aiApi={
  status:async()=>await invoke({action:'status'}) as {available:boolean;dailyLimit:number},
  propose:async(request:AIRequest):Promise<{proposal:AIProposal;cached:boolean}>=>{const data=await invoke(request);return {proposal:validateProposal(request,data.proposal),cached:!!data.cached};}
};
export function aiCandidates(text:string,competencies:Competency[],selected:string){
  if(selected)return [selected];
  const terms=normalize(text).split(/[^a-z0-9]+/).filter(t=>t.length>=3);
  return competencies.filter(c=>!c.archived).map(c=>({id:c.id,score:terms.reduce((n,t)=>n+(normalize(`${c.area} ${c.topic} ${c.title}`).includes(t)?1:0),0)})).filter(c=>c.score>0).sort((a,b)=>b.score-a.score||a.id.localeCompare(b.id)).slice(0,12).map(c=>c.id);
}
