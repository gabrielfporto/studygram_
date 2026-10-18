import test from 'node:test';
import assert from 'node:assert/strict';
import { diagnose } from '../web/lib/diagnosis';
import type { StudyData } from '../web/lib/data';
import { fixtures } from '../simulation/fixtures';
const now=new Date('2026-10-17T12:00:00Z');
const base:StudyData={profile:{goal:'Estudar',timezone:'America/Bahia'},competencies:fixtures(),areas:[],topics:[],sessions:[],questions:[],rules:[],contexts:[],rotations:[]};
const id=base.competencies[0]!.id;
const session=(i:number,overrides:Partial<StudyData['sessions'][number]>={})=>({id:String(i),competency_id:id,actual_minutes:10,started_at:'2026-10-16T12:00:00Z',ended_at:'2026-10-16T12:10:00Z',status:'completed',method:'recall',feedback:2,...overrides});
test('diagnóstico: ausência e leitura não são dificuldade; futuro e fora da janela são excluídos',()=>{
  const d=diagnose({...base,sessions:[session(1,{method:'reading'}),session(2,{status:'missed',actual_minutes:0}),session(3,{ended_at:'2026-10-18T12:00:00Z'}),session(4,{ended_at:'2026-10-03T12:00:00Z'})]},now);
  assert.equal(d.count,1);assert.equal(d.findings[0]!.id,'evidence');assert.equal(d.plannedCount,0);
  assert.match(d.findings[0]!.evidence,/não comprova domínio/);
  assert.match(diagnose(base,now).findings[0]!.evidence,/não significa que você não estudou/);
});
test('diagnóstico: dificuldade usa as duas práticas mais recentes e exclui competências arquivadas',()=>{
  const sessions=[session(1),session(2)];
  assert.equal(diagnose({...base,sessions},now).findings[0]!.action.kind,'recall');
  assert.equal(diagnose({...base,sessions:[...sessions,session(3,{feedback:4,ended_at:'2026-10-17T11:00:00Z'})]},now).findings[0]!.id,'evidence');
  assert.equal(diagnose({...base,competencies:base.competencies.map(c=>({...c,archived:true})),sessions},now).findings[0]!.id,'evidence');
});
test('diagnóstico: exige amostra mínima para questões e agrupa apenas erros abertos',()=>{
  const q={competency_id:id,total:5,correct:1,occurred_at:'2026-10-16T12:00:00Z'};
  assert.equal(diagnose({...base,questions:[q]},now).findings[0]!.id,'evidence');
  assert.match(diagnose({...base,questions:[q,q]},now).findings[0]!.evidence,/2 acertos em 10/);
  const m={id:'m',competency_id:id,description:'Confusão',classification_key:'conceito',occurred_at:q.occurred_at,resolved_at:null};
  assert.match(diagnose({...base,mistakes:[m,{...m,id:'n'}]},now).findings[0]!.evidence,/2 erros ainda abertos/);
  assert.equal(diagnose({...base,mistakes:[m,{...m,id:'n',resolved_at:q.occurred_at}]},now).findings[0]!.id,'evidence');
});
test('diagnóstico: compara duração prevista e não duração final, sem inventar previsão manual',()=>{
  const sessions=Array.from({length:8},(_,i)=>session(i,{method:'reading',planned_minutes:i<4?10:30,status:i<4?'completed':'partial',actual_minutes:5}));
  const d=diagnose({...base,sessions},now);
  assert.equal(d.findings[0]!.id,'duration');assert.equal(d.plannedMinutes,160);assert.equal(d.actualPlannedMinutes,40);
  assert.equal(diagnose({...base,sessions:sessions.map(s=>({...s,planned_minutes:null}))},now).findings[0]!.id,'evidence');
  assert.equal(diagnose({...base,sessions:sessions.slice(0,6)},now).findings[0]!.id,'evidence');
});
test('diagnóstico: janela usa dias locais e reúne sinais da mesma competência em uma ação',()=>{
  const d=diagnose({...base,sessions:[session(1,{ended_at:'2026-10-04T02:59:00Z'}),session(2,{ended_at:'2026-10-04T03:00:00Z'})]},now);
  assert.equal(d.start,'2026-10-04');assert.equal(d.count,1);
  const qs=Array.from({length:2},()=>({competency_id:id,total:10,correct:2,occurred_at:'2026-10-16T12:00:00Z'}));
  const both=diagnose({...base,sessions:[session(1),session(2)],questions:qs},now);
  assert.equal(both.findings.length,1);assert.match(both.findings[0]!.evidence,/duas últimas/);assert.match(both.findings[0]!.evidence,/4 acertos/);
});
