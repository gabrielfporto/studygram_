import { createClient } from '@supabase/supabase-js';
import { aiRequestSchema,validateProposal,type AICandidate } from '../src/application/ai.js';
import { OpenAIService,type AIService } from './openai-service.js';

export interface AIEnv {url:string;anonKey:string;serviceKey:string;apiKey?:string|undefined;model?:string|undefined;provider?:string|undefined}
const origins=['https://gabrielfporto.github.io','http://127.0.0.1:5175','http://localhost:5173'];
export async function handleAI(request:Request,env:AIEnv,service?:AIService):Promise<Response> {
  const origin=request.headers.get('origin')??'';
  const headers={'Content-Type':'application/json','Access-Control-Allow-Origin':origins.includes(origin)?origin:origins[0]!,'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS',Vary:'Origin'};
  const respond=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers});
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
  if(request.method!=='POST')return respond({error:'Método inválido.'},405);
  const bearer=request.headers.get('authorization');if(!bearer?.startsWith('Bearer '))return respond({error:'Entre novamente na sua conta.'},401);
  const auth=createClient(env.url,env.anonKey,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:{user},error:authError}=await auth.auth.getUser(bearer.slice(7));
  if(authError||!user)return respond({error:'Sessão inválida. Entre novamente.'},401);
  const model=env.model||'gpt-5.6-terra';
  let requestId:string|null=null;let reserved=false;
  const admin=createClient(env.url,env.serviceKey,{auth:{persistSession:false,autoRefreshToken:false}});
  try {
    const raw=await request.text();if(raw.length>14000)return respond({error:'Envie um texto menor.'},413);
    const body=JSON.parse(raw);
    if(body?.action==='status')return respond({available:!!env.apiKey&&(!env.provider||env.provider==='openai'),dailyLimit:10});
    if((env.provider&&env.provider!=='openai')||!env.apiKey)return respond({error:'A IA ainda precisa ser configurada no servidor. O registro manual continua disponível.'},503);
    const parsed=aiRequestSchema.safeParse(body);if(!parsed.success)return respond({error:parsed.error.issues[0]?.message??'Entrada inválida.'},400);
    const input=parsed.data;requestId=input.requestId;let candidates:AICandidate[]=[];
    if(input.candidateIds.length){
      const {data:cs,error}=await admin.from('competencies').select('id,title,topic_id').eq('user_id',user.id).eq('archived',false).in('id',input.candidateIds);if(error)throw error;
      if(cs?.length!==input.candidateIds.length)return respond({error:'Uma competência não está disponível nesta conta.'},400);
      const {data:ts,error:te}=await admin.from('topics').select('id,title,area_id').eq('user_id',user.id).in('id',[...new Set(cs.map(c=>c.topic_id))]);if(te)throw te;
      const {data:areas,error:ae}=await admin.from('study_areas').select('id,title').eq('user_id',user.id).in('id',[...new Set((ts??[]).map(t=>t.area_id))]);if(ae)throw ae;
      candidates=cs.map(c=>{const t=ts?.find(t=>t.id===c.topic_id);return{id:c.id,title:c.title,topic:t?.title??'',area:areas?.find(a=>a.id===t?.area_id)?.title??''};}).sort((a,b)=>a.id.localeCompare(b.id));
    }
    const canonical=JSON.stringify({version:'ai-1',operation:input.operation,text:input.text,variant:input.variant??0,candidates,model});
    const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(canonical)))).map(b=>b.toString(16).padStart(2,'0')).join('');
    const {data:reservation,error:quotaError}=await admin.rpc('reserve_ai_request',{p_user:user.id,p_request:input.requestId,p_operation:input.operation,p_model:model,p_hash:hash});
    if(quotaError){if(quotaError.message.includes('AI_LIMIT'))return respond({error:'Limite de IA atingido. Aguarde um minuto ou tente amanhã. O registro manual continua disponível.'},429);throw quotaError;}
    if(reservation?.status==='cached')return respond({proposal:validateProposal(input,reservation.result),cached:true});
    if(reservation?.status!=='reserved')return respond({error:'Uma solicitação igual já está em andamento ou terminou sem resultado. Aguarde e tente novamente.'},409);
    reserved=true;
    const answer=await (service??new OpenAIService(env.apiKey,model)).propose(input,candidates);
    const proposal=validateProposal(input,answer.proposal);
    const {error:saveError}=await admin.from('ai_usage').update({status:'completed',result:proposal,input_tokens:answer.inputTokens,output_tokens:answer.outputTokens}).eq('user_id',user.id).eq('request_id',input.requestId);if(saveError)throw saveError;
    return respond({proposal,cached:false});
  }catch(error){
    if(reserved&&requestId)await admin.from('ai_usage').update({status:'failed',result:null}).eq('user_id',user.id).eq('request_id',requestId);
    if(error instanceof SyntaxError)return respond({error:'Resposta inválida. Revise o texto e tente novamente.'},400);
    const safe=error instanceof Error&&/^(A IA|A pergunta|Acertos incompatíveis|O provedor|Não foi possível consultar)/.test(error.message)?error.message:'Não foi possível preparar a sugestão. Seu texto continua disponível; tente novamente ou use o registro manual.';
    return respond({error:safe},502);
  }
}
