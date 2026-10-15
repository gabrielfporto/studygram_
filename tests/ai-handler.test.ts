import test,{mock} from 'node:test';
import assert from 'node:assert/strict';
import { handleAI } from '../server/ai-handler.js';
const owner='00000000-0000-4000-8000-000000000001';const cid='10000000-0000-4000-8000-000000001003';
const env={url:'https://test.supabase.co',anonKey:'test-public',serviceKey:'test-server',apiKey:'provider-secret',model:'configured-model'};
const proposal={competencyId:cid,minutes:30,method:'reading' as const,total:null,correct:null,notes:'',dateHint:null,warnings:[]};
function request(body:unknown,token=true){return new Request(env.url,{method:'POST',headers:{...(token?{Authorization:'Bearer user-token'}:{}),'Content-Type':'application/json'},body:JSON.stringify(body)});}
test('Servidor IA: sem autenticação não chama provedor; status não consome geração',async()=>{
  let called=false;const service={propose:async()=>{called=true;return{proposal,inputTokens:1,outputTokens:1};}};
  assert.equal((await handleAI(request({},false),env,service)).status,401);assert(!called);
  const stub=mock.method(globalThis,'fetch',async()=>new Response(JSON.stringify({id:owner}),{headers:{'Content-Type':'application/json'}}));
  try{const res=await handleAI(request({action:'status'}),env,service);assert.equal(res.status,200);assert.equal((await res.json()).available,true);assert(!called);}finally{stub.mock.restore();}
});
test('Servidor IA: valida posse antes de reservar cota e não aceita IDs de outra conta',async()=>{
  let called=false;let reserved=false;
  const stub=mock.method(globalThis,'fetch',async(input:RequestInfo|URL)=>{const url=String(input);if(url.includes('/auth/'))return Response.json({id:owner});if(url.includes('reserve_ai'))reserved=true;if(url.includes('competencies')){assert(url.includes(`user_id=eq.${owner}`));return Response.json([]);}throw Error('Consulta inesperada');});
  try{const res=await handleAI(request({requestId:crypto.randomUUID(),operation:'log',text:'Estudei 30 minutos',candidateIds:[cid]}),env,{propose:async()=>{called=true;return{proposal,inputTokens:1,outputTokens:1};}});assert.equal(res.status,400);assert(!called);assert(!reserved);}finally{stub.mock.restore();}
});
test('Servidor IA: reserva antes do provedor e persiste somente proposta/uso da conta autenticada',async()=>{
  const order:string[]=[];let written:Record<string,unknown>={};
  const stub=mock.method(globalThis,'fetch',async(input:RequestInfo|URL,options?:RequestInit)=>{const url=String(input);if(url.includes('/auth/'))return Response.json({id:owner});if(url.includes('reserve_ai_request')){order.push('reserve');const args=JSON.parse(String(options?.body));assert.equal(args.p_user,owner);assert.match(args.p_hash,/^[a-f0-9]{64}$/);return Response.json({status:'reserved'});}if(url.includes('ai_usage')){order.push('save');assert(url.includes(`user_id=eq.${owner}`));written=JSON.parse(String(options?.body));return new Response(null,{status:204});}throw Error('Consulta inesperada');});
  try{const p={...proposal,competencyId:null};const res=await handleAI(request({requestId:crypto.randomUUID(),operation:'log',text:'Li por 30 minutos',candidateIds:[]}),env,{propose:async()=>{order.push('provider');return{proposal:p,inputTokens:35,outputTokens:20};}});assert.equal(res.status,200);assert.deepEqual(order,['reserve','provider','save']);assert.equal(written.status,'completed');assert.equal(written.input_tokens,35);assert(!JSON.stringify(await res.json()).includes(env.apiKey));}finally{stub.mock.restore();}
});
