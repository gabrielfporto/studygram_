import test,{afterEach} from 'node:test';
import assert from 'node:assert/strict';
import { z } from 'zod';
import { readLocalDraft,draftKey } from '../web/lib/local-draft';
import { captureReference,readReferences,compareReferences } from '../web/lib/plan-reference';
import { fixtures,inputFor,START } from '../simulation/fixtures';
import { planDay } from '../src/engine/planner';
import type { StudyData } from '../web/lib/data';
const store=new Map<string,string>();
Object.defineProperty(globalThis,'localStorage',{value:{getItem:(k:string)=>store.get(k)??null,setItem:(k:string,v:string)=>store.set(k,v),removeItem:(k:string)=>store.delete(k)},configurable:true});
afterEach(()=>store.clear());
const data:StudyData={userId:'one',profile:{goal:'Estudo',timezone:'America/Bahia'},competencies:fixtures(),areas:[],topics:[],sessions:[],questions:[],rules:[],contexts:[],rotations:[]};
test('rascunho: versão, validade, corrupção e isolamento entre contas',()=>{
  const schema=z.object({text:z.string()});const now=Date.now();
  localStorage.setItem(draftKey('one','session'),JSON.stringify({at:now,value:{text:'Meu rascunho'}}));
  assert.deepEqual(readLocalDraft('one','session',schema,now),{text:'Meu rascunho'});
  assert.equal(readLocalDraft('two','session',schema,now),null);
  assert.equal(readLocalDraft('one','routine',schema,now),null);
  assert.equal(readLocalDraft('one','session',schema,now+31*86400000),null);
  assert.equal(readLocalDraft('one','session',schema,now-1),null);
  localStorage.setItem(draftKey('one','session'),'broken');assert.equal(readLocalDraft('one','session',schema,now),null);
});
test('referência: recálculo não reescreve o primeiro plano nem mistura usuários',()=>{
  const plan=planDay(inputFor(data.competencies,60));
  const first=captureReference('one',plan,data,START);
  const second=captureReference('one',{...plan,plannedMinutes:5},data,new Date(START.getTime()+60000));
  assert.deepEqual(second,first);assert.equal(readReferences('one').length,1);assert.equal(readReferences('two').length,0);
  assert.equal(first.plannedMinutes,plan.plannedMinutes);assert.equal('priority' in first.items[0]!,false);
});
test('referência: inclui só estudo do mesmo dia iniciado após a captura, sem repetir sessões já existentes',()=>{
  const at=START.getTime(),plan=planDay(inputFor(data.competencies,60));
  const session=(id:string,started:number,ended:number)=>({id,competency_id:data.competencies[0]!.id,actual_minutes:5,started_at:new Date(started).toISOString(),ended_at:new Date(ended).toISOString(),status:'completed',method:'reading',feedback:null});
  const existing=session('existing',at+60000,at+6*60000);
  captureReference('one',plan,{...data,sessions:[existing]},START);
  const result=compareReferences({...data,sessions:[existing,session('after',at+60000,at+6*60000),session('before',at-60000,at+4*60000),session('future',at+86400000,at+87000000)]},new Date(at+3600000));
  assert.equal(result.length,1);assert.equal(result[0]!.actualMinutes,5);
  assert.equal(compareReferences({...data,userId:'two'},new Date(at+3600000)).length,0);
  assert.equal(compareReferences(data,new Date(at+15*86400000)).length,0);
});
test('referência: plano vazio não cria meta, e indisponibilidade de armazenamento não vira confirmação',()=>{
  const plan=planDay(inputFor(data.competencies,60));
  assert.throws(()=>captureReference('one',{...plan,plannedMinutes:0,items:[]},data,START));
  assert.equal(readReferences('one').length,0);
  const descriptor=Object.getOwnPropertyDescriptor(globalThis,'localStorage')!;
  Object.defineProperty(globalThis,'localStorage',{get(){throw new Error('blocked');},configurable:true});
  try{assert.equal(readReferences('one').length,0);assert.equal(readLocalDraft('one','session',z.object({})),null);assert.throws(()=>captureReference('one',plan,data,START));}finally{Object.defineProperty(globalThis,'localStorage',descriptor);}
});
