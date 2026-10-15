import test from 'node:test';
import assert from 'node:assert/strict';
import { availabilitySummary } from '../web/lib/availability-summary.js';
import { makePlan } from '../web/lib/planning.js';
import { newMemory } from '../src/engine/memory.js';
import { weakness } from '../src/engine/priority.js';
import { fixtures,START } from '../simulation/fixtures.js';
import type { StudyData } from '../web/lib/data.js';

const now=new Date('2026-10-15T19:00:00Z');
const base:StudyData={profile:{goal:'Internato',timezone:'America/Bahia'},competencies:fixtures(),areas:[],topics:[],sessions:[],questions:[],rules:[{weekday:4,starts_local:'18:00',ends_local:'20:00',daily_cap_minutes:120,minimum_session_minutes:5,max_effort:'high'}],contexts:[],rotations:[]};
const connected={id:'cal',external_calendar_id:'google',status:'connected' as const,last_synced_at:now.toISOString(),sync_range_start:'2026-10-15T03:00:00Z',sync_range_end:'2026-10-29T03:00:00Z'};
test('Disponibilidade visível coincide com o motor, une conflitos e ignora agendas desconectadas',()=>{
  const d:StudyData={...base,calendar:{connections:[connected],events:[{id:'1',connection_id:'cal',starts_at:'2026-10-15T21:30:00Z',ends_at:'2026-10-15T22:30:00Z',status:'busy'},{id:'2',connection_id:'cal',starts_at:'2026-10-15T22:00:00Z',ends_at:'2026-10-15T23:00:00Z',status:'busy'},{id:'3',connection_id:'other',starts_at:'2026-10-15T21:00:00Z',ends_at:'2026-10-15T23:00:00Z',status:'busy'}]}};
  const summary=availabilitySummary(d,now);assert.equal(summary.available,30);assert.equal(summary.overlap,90);assert.equal(summary.lost,90);assert.equal(summary.covered,true);
  assert.equal(makePlan(d,d.competencies[0]!.userId,now,null).plan.capacityMinutes,summary.available);
  const capped=availabilitySummary({...d,rules:base.rules.map(r=>({...r,daily_cap_minutes:20}))},now);assert.equal(capped.lost,0);assert.equal(capped.overlap,90);
  assert.equal(availabilitySummary(d,now,20).covered,false);
});
test('Erro específico influencia fraqueza sem inventar questões; erros antigos e futuros são ignorados',()=>{
  const c=fixtures()[0]!;const baseline=weakness({...c,evidence:[]},START);
  assert(weakness({...c,evidence:[],mistakeHistory:[{at:START,key:'critério'}]},START)>baseline);
  assert.equal(weakness({...c,evidence:[],mistakeHistory:[{at:new Date(START.getTime()+86400000),key:'x'},{at:new Date(START.getTime()-31*86400000),key:'x'}]},START),baseline);
});
test('Prova relacionada chega ao planejamento real com aumento do fator de eventos',()=>{
  const candidate={...base.competencies[0]!,card:newMemory(now),completedStages:[],notionSource:null};const user=candidate.userId;const id=candidate.id;
  const plain=makePlan({...base,competencies:[candidate]},user,now,null).plan;
  const exam=makePlan({...base,competencies:[candidate],exams:[{id:'exam',title:'Prova',at:new Date('2026-10-16T23:00:00Z'),competencyIds:[id]}]},user,now,null).plan;
  assert(exam.items.length&&plain.items.length);assert(exam.items[0]!.priority.contributions.events>plain.items[0]!.priority.contributions.events);
});
