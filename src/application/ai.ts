import { z } from 'zod';

export const aiOperations=['log','contents','error','recall'] as const;
export const aiRequestSchema=z.object({requestId:z.uuid(),operation:z.enum(aiOperations),text:z.string().trim().min(3).max(6000),candidateIds:z.array(z.uuid()).max(12),variant:z.number().int().min(0).max(99).optional()}).strict().superRefine((r,c)=>{
  if(new Set(r.candidateIds).size!==r.candidateIds.length)c.addIssue({code:'custom',message:'Competências duplicadas.'});
  if(r.operation==='recall'&&(r.candidateIds.length!==1||r.text.length<80))c.addIssue({code:'custom',message:'Escolha uma competência e forneça um trecho de pelo menos 80 caracteres.'});
});
export type AIRequest=z.infer<typeof aiRequestSchema>;
const warnings=z.array(z.string().max(240)).max(4);
const optionalId=z.uuid().nullable();const count=z.number().int().min(0).max(1000).nullable();
export const logProposalSchema=z.object({competencyId:optionalId,minutes:z.number().int().min(1).max(720).nullable(),method:z.enum(['reading','recall','questions']).nullable(),total:count,correct:count,notes:z.string().max(2000),dateHint:z.string().max(100).nullable(),warnings}).strict();
export const contentProposalSchema=z.object({area:z.string().trim().min(1).max(200),topic:z.string().trim().min(1).max(200),titles:z.array(z.string().trim().min(1).max(200)).min(1).max(12),warnings}).strict();
export const errorProposalSchema=z.object({competencyId:optionalId,description:z.string().trim().min(1).max(2000),classificationKey:z.string().trim().min(1).max(100),warnings}).strict();
export const recallProposalSchema=z.object({question:z.string().min(1).max(700),answer:z.string().min(1).max(2000),sourceQuote:z.string().min(20).max(1500),warnings}).strict();
export const proposalSchemas={log:logProposalSchema,contents:contentProposalSchema,error:errorProposalSchema,recall:recallProposalSchema};
export type LogProposal=z.infer<typeof logProposalSchema>;
export type AIProposal=z.infer<typeof logProposalSchema>|z.infer<typeof contentProposalSchema>|z.infer<typeof errorProposalSchema>|z.infer<typeof recallProposalSchema>;
export interface AICandidate {id:string;title:string;topic:string;area:string}
export function validateProposal(request:AIRequest,raw:unknown):AIProposal {
  const p=proposalSchemas[request.operation].parse(raw);
  if('competencyId'in p&&p.competencyId&&!request.candidateIds.includes(p.competencyId))throw new Error('A IA sugeriu uma competência fora da seleção.');
  if('correct'in p&&p.correct!==null&&(p.total===null||p.correct>p.total))throw new Error('Acertos incompatíveis com o total. Revise o registro manualmente.');
  if('method'in p&&p.method==='reading'&&((p.total??0)>0||(p.correct??0)>0))throw new Error('A sugestão mistura leitura com questões. Revise manualmente.');
  if('sourceQuote'in p){const normalize=(s:string)=>s.replace(/\s+/g,' ').trim();if(!normalize(request.text).includes(normalize(p.sourceQuote)))throw new Error('A pergunta não trouxe um trecho verificável do seu material.');}
  return p;
}
export function contentProposalRows(p:z.infer<typeof contentProposalSchema>) {
  return [...new Set(p.titles.map(t=>t.trim()).filter(Boolean))].map(title=>({area:p.area,topic:p.topic,title,importance:.5,source:{status:'Sugerido por IA · revisado pelo usuário',nextStudy:null,priming:false,studied:false,questions:false,retrieval:false,rotation:'',originalImportance:'',preserveDate:false}}));
}
