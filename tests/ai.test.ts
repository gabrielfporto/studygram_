import test from 'node:test';
import assert from 'node:assert/strict';
import { aiRequestSchema,validateProposal,contentProposalRows } from '../src/application/ai.js';
import { OpenAIService } from '../server/openai-service.js';
const id='10000000-0000-4000-8000-000000001003';
const input={requestId:'10000000-0000-4000-8000-000000001090',operation:'log' as const,text:'Estudei o tema durante 30 minutos.',candidateIds:[id]};
const proposal={competencyId:id,minutes:30,method:'reading',total:null,correct:null,notes:'',dateHint:null,warnings:[]};
test('IA: valida contratos, rejeita IDs inventados e não transforma ausência de acertos em zero',()=>{
  assert(aiRequestSchema.safeParse(input).success);
  assert(!aiRequestSchema.safeParse({...input,candidateIds:Array(13).fill(id)}).success);
  assert.throws(()=>validateProposal(input,{...proposal,competencyId:'10000000-0000-4000-8000-000000001005'}));
  assert.throws(()=>validateProposal(input,{...proposal,method:'questions',total:10,correct:11}));
  assert.equal((validateProposal(input,proposal) as typeof proposal).correct,null);
  assert.throws(()=>validateProposal({...input,operation:'recall'}, {question:'Q',answer:'A',sourceQuote:'Este trecho não existe no material original.',warnings:[]}));
});
test('IA: importação revisada não cria estudo, memória ou etapa concluída',()=>{
  const rows=contentProposalRows({area:'Área',topic:'Tema',titles:['Critérios','Critérios','Manejo'],warnings:[]});assert.equal(rows.length,2);
  assert(rows.every(r=>!r.source.studied&&!r.source.retrieval&&!r.source.questions&&!r.source.priming));
});
test('OpenAI: contexto mínimo, schema estrito, store false e endpoint fixo',async()=>{
  let payload:Record<string,unknown>={};let url='';
  const transport=(async(u:unknown,options:RequestInit)=>{url=String(u);payload=JSON.parse(String(options.body));return new Response(JSON.stringify({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(proposal)}]}],usage:{input_tokens:50,output_tokens:30}}));}) as typeof fetch;
  const result=await new OpenAIService('test-only-key','configured-model',transport).propose(input,[{id,title:'Competência',topic:'Tema',area:'Área'}]);
  assert.equal(url,'https://api.openai.com/v1/responses');assert.equal(payload.store,false);assert.equal(payload.model,'configured-model');assert.equal(result.inputTokens,50);assert.equal(result.outputTokens,30);
  assert.equal((payload.text as {format:{strict:boolean}}).format.strict,true);assert(!JSON.stringify(payload).includes('test-only-key'));
  assert(!('tools'in payload));assert.equal(payload.max_output_tokens,2400);
});
test('OpenAI: recusa, saída incompleta e falha HTTP nunca viram proposta utilizável',async()=>{
  for(const body of [{status:'incomplete'}, {status:'completed',output:[{type:'message',content:[{type:'refusal'}]}]}]){
    const transport=(async()=>new Response(JSON.stringify(body))) as typeof fetch;
    await assert.rejects(new OpenAIService('key','model',transport).propose(input,[]));
  }
  const transport=(async()=>new Response('{}',{status:429})) as typeof fetch;
  await assert.rejects(new OpenAIService('key','model',transport).propose(input,[]),/cota/);
});
