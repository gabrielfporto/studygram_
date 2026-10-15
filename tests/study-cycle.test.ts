import test from 'node:test';
import assert from 'node:assert/strict';
import { fixtures, inputFor, START } from '../simulation/fixtures.js';
import { completedStages, nextStudyStep, stagesFromSessions } from '../src/engine/study-cycle.js';
import { planDay } from '../src/engine/planner.js';
import { newMemory } from '../src/engine/memory.js';
import { prepareReview, sessionSchema } from '../src/application/session.js';
import type { StudyStage } from '../src/domain/model.js';

const c={...fixtures()[0]!,card:newMemory(START),evidence:[],completedStages:[] as StudyStage[],notionSource:null};
test('Ciclo: um assunto começa com preparação e evolui com etapas concluídas',()=>{
  assert.equal(nextStudyStep(c,START).method,'priming');
  const progress=(methods:string[])=>stagesFromSessions(methods.map((method,index)=>({id:String(index),method,status:'completed'})),[]);
  assert.equal(nextStudyStep({...c,completedStages:progress(['priming'])},START).method,'reading');
  assert.equal(nextStudyStep({...c,completedStages:progress(['priming','reading'])},START).method,'recall');
  assert.equal(nextStudyStep({...c,completedStages:progress(['priming','reading','recall'])},START).method,'questions');
  const partial=stagesFromSessions([{id:'p',method:'reading',status:'partial'},{id:'m',method:'questions',status:'missed'}],[]);
  assert.deepEqual(partial,[]);
  assert(!completedStages({...c,card:{...c.card,reps:1}}).has('theory'),'Memória não conclui uma etapa parcial');
});
test('Ciclo: histórico Notion evita repetir teoria e revisão futura aguarda sua data',()=>{
  const imported={...c,notionSource:{priming:true,studied:true,questions:false,retrieval:false,status:'Iniciado',nextStudy:null,originalImportance:'',rotation:'MFC',preserveDate:false}};
  assert.equal(nextStudyStep(imported,START).method,'recall');
  const ready={...c,completedStages:['priming','theory','retrieval','questions'] as StudyStage[],card:{...c.card,reps:1,due:new Date(START.getTime()+86400000)}};
  assert.equal(nextStudyStep(ready,START).ready,false);
  assert.equal(planDay({...inputFor([ready],60),useStudyCycle:true,minimumSession:5}).items.length,0);
  assert.equal(nextStudyStep(ready,new Date(START.getTime()+86400000)).ready,true);
});
test('Ciclo: preparação cabe em 5 min; começo curto da teoria não muda etapas nem memória',()=>{
  const plan=planDay({...inputFor([c],5),minimumSession:5,useStudyCycle:true,maxEffort:'low'});
  assert.equal(plan.items[0]!.method,'priming');assert.equal(plan.plannedMinutes,5);
  const theory={...c,completedStages:['priming'] as StudyStage[]};
  assert.equal(planDay({...inputFor([theory],5),minimumSession:5,useStudyCycle:true}).items.length,0);
  const small=planDay({...inputFor([theory],5),minimumSession:5,useStudyCycle:true,startSmall:true,maxEffort:'low'});
  assert.equal(small.items[0]!.method,'reading');assert.equal(small.plannedMinutes,5);
  const input={competencyId:'00000000-0000-4000-8000-000000000001',idempotencyKey:'00000000-0000-4000-8000-000000000002',actualMinutes:5,plannedMinutes:5,startedAt:'2026-10-15T11:55:00Z',endedAt:START.toISOString(),method:'priming' as const,status:'completed' as const,feedback:3,total:0,correct:0,notes:'Uma pergunta'};
  assert.equal(prepareReview(input,null,[],START),null);
  assert.equal(prepareReview({...input,method:'reading',status:'partial'},null,[],START),null);
  assert.equal(prepareReview({...input,method:'questions',status:'partial'},null,[],START),null);
  assert(!sessionSchema.safeParse({...input,method:'questions'}).success,'Questões concluídas exigem uma tentativa');
  assert.deepEqual(c.completedStages,[]);
});
test('Ciclo: após preparar um assunto, o plano avança à teoria em vez de só preparar outros',()=>{
  const remaining=Array.from({length:6},(_,i)=>({...c,id:`other-${i}`}));
  const started={...c,completedStages:['priming'] as StudyStage[]};
  const plan=planDay({...inputFor([started,...remaining],25),minimumSession:5,useStudyCycle:true});
  assert.equal(plan.items[0]!.competencyId,c.id);assert.equal(plan.items[0]!.method,'reading');
  assert.equal(plan.plannedMinutes,25);
});
