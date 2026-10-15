import React from 'react';
import { JSDOM } from 'jsdom';
import test, { after, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { fixtures, inputFor, START } from '../simulation/fixtures';
import { planDay } from '../src/engine/planner';
import { newMemory } from '../src/engine/memory';
import type { StudyData } from '../web/lib/data';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url:'http://localhost:5173/studygram_/' });
Object.assign(globalThis, { window:dom.window, document:dom.window.document, HTMLElement:dom.window.HTMLElement,
  HTMLDialogElement:dom.window.HTMLDialogElement, localStorage:dom.window.localStorage });
Object.defineProperty(globalThis,'navigator',{value:dom.window.navigator,configurable:true});
// Um browser real possui o ciclo de vida da aba; o teste deve liberar timers/canais.
Object.defineProperty(globalThis,'BroadcastChannel',{value:undefined,configurable:true});
dom.window.HTMLDialogElement.prototype.showModal=function(){this.open=true;};
dom.window.HTMLDialogElement.prototype.close=function(){this.open=false;};
const { render, screen, fireEvent, cleanup, waitFor } = await import('@testing-library/react');
const { Today } = await import('../web/components/Today');
const { Settings } = await import('../web/components/Settings');
const { Contents } = await import('../web/components/Contents');
const { NotionImport } = await import('../web/components/NotionImport');
const { makePlan } = await import('../web/lib/planning');
const { Progress } = await import('../web/components/Progress');
const { SessionForm } = await import('../web/components/SessionForm');
const { GuidedSession } = await import('../web/components/GuidedSession');
const { MaterialLink } = await import('../web/components/MaterialLink');
const { readDraft,storeDraft,elapsedSeconds,togglePause } = await import('../web/lib/active-study');
const { supabase } = await import('../web/lib/client');
afterEach(()=>{cleanup();mock.restoreAll();localStorage.clear();});
after(async()=>{await supabase.auth.dispose();dom.window.close();});
const data:StudyData={profile:{goal:'Internato',timezone:'America/Bahia'},competencies:fixtures(),areas:[],topics:[],sessions:[],questions:[],rules:[],contexts:[],rotations:[]};

test('Hoje: iniciar, explicar e recalcular acionam comportamentos reais do componente',()=>{
  let started=''; let override:number|null=null;
  render(<Today data={data} plan={planDay(inputFor(data.competencies,60))} spent={10} now={START} onStart={id=>{started=id;}}
    onSettings={()=>{}} onContents={()=>{}} override={null} onOverride={value=>{override=value;}}/>);
  fireEvent.click(screen.getByRole('button',{name:/Iniciar sessão/})); assert(started);
  fireEvent.click(screen.getByRole('button',{name:'Por que agora?'})); assert(screen.getByText(/Prioridade:/));
  fireEvent.change(screen.getByLabelText('Minutos disponíveis agora'),{target:{value:'20'}});
  fireEvent.click(screen.getByRole('button',{name:'Recalcular'})); assert.equal(override,30);
});
test('Rotina: salva sete regras e não anuncia sucesso antes da resposta',async()=>{
  const calls:unknown[][]=[];
  mock.method(supabase,'rpc',(...args:unknown[])=>{calls.push(args);return Promise.resolve({data:null,error:null});});
  let saved=false;
  render(<Settings data={data} onSaved={async()=>{saved=true;}}/>);
  fireEvent.change(screen.getByLabelText('Contexto atual'),{target:{value:'Emergência'}});
  fireEvent.click(screen.getByRole('button',{name:/Salvar rotina/}));
  await waitFor(()=>assert(saved));
  assert.equal(calls[0]![0],'configure_study');
  assert.equal((calls[0]![1] as {p_rules:unknown[]}).p_rules.length,7);
  assert(screen.getByText('Rotina salva. Seu plano foi recalculado.'));
});
test('Conteúdos: busca, importação revisada e arquivamento preservam ações',async()=>{
  const calls:unknown[][]=[];
  mock.method(supabase,'rpc',(...args:unknown[])=>{calls.push(args);return Promise.resolve({data:'topic',error:null});});
  let archived=''; mock.method(supabase,'from',()=>({update:()=>({eq:(_key:string,id:string)=>{archived=id;return Promise.resolve({error:null});}})}));
  render(<Contents data={data} onSaved={async()=>{}}/>);
  fireEvent.change(screen.getByLabelText('Buscar no seu conteúdo'),{target:{value:'Trombólise'}});
  assert.equal(screen.getAllByRole('button',{name:/Arquivar /}).length,1);
  fireEvent.click(screen.getByRole('button',{name:'Arquivar Trombólise'})); await waitFor(()=>assert(archived));
  fireEvent.click(screen.getByRole('button',{name:'+ Adicionar tema'}));
  fireEvent.change(screen.getByLabelText('Área'),{target:{value:'Clínica'}});
  fireEvent.change(screen.getByLabelText('Tema'),{target:{value:'SCA'}});
  fireEvent.change(screen.getByLabelText('Competências — uma por linha'),{target:{value:'ECG\nDiagnóstico\nECG'}});
  fireEvent.click(screen.getByRole('button',{name:'Confirmar e adicionar'}));
  await waitFor(()=>assert.equal(calls.length,1));
  assert.deepEqual((calls[0]![1] as {p_titles:string[]}).p_titles,['ECG','Diagnóstico']);
});
test('Sessão: falha mantém formulário e a chave de idempotência para tentar novamente',async()=>{
  const ids:string[]=[]; let closed=false;
  render(<SessionForm competencies={data.competencies} initialId={data.competencies[0]!.id} minutes={20} method="recall"
    onClose={()=>{closed=true;}} onSave={async input=>{ids.push(input.idempotencyKey); if(ids.length===1)throw new Error('Sem conexão');}}/>);
  fireEvent.click(screen.getByRole('button',{name:'Salvar e atualizar meu plano'}));
  await waitFor(()=>assert(screen.getByRole('alert'))); assert.equal(closed,false);
  fireEvent.click(screen.getByRole('button',{name:'Salvar e atualizar meu plano'}));
  await waitFor(()=>assert(closed)); assert.equal(ids[0],ids[1]);
});
test('Progresso: ausência de evidência não fabrica taxa de acerto',()=>{
  render(<Progress data={{...data,competencies:[]}} now={START}/>);
  assert(screen.getByText('Ainda sem evidência objetiva'));
  assert(screen.getByText('Registre uma recuperação para começar'));
});

test('Notion: prévia, seleção, falha e retry só gravam os assuntos confirmados',async()=>{
  const calls:unknown[][]=[]; let refreshed=false;
  mock.method(supabase,'rpc',(...args:unknown[])=>{calls.push(args);return Promise.resolve(calls.length===1 ? {data:null,error:{message:'offline'}} : {data:{inserted:1,skipped:0},error:null});});
  render(<NotionImport data={{...data,competencies:[]}} onSaved={async()=>{refreshed=true;}} onClose={()=>{}}/>);
  fireEvent.change(screen.getByLabelText('Tabela com cabeçalho'),{target:{value:'Área,Tema,Assunto,Próximo Estudo,Estudo\nMFC,Inf,Arbo,06/10/2026,Yes\nMFC,Inf,Hans,,No\nMFC,Inf,Arbo,,Yes\nMFC,Inf,Inválido,31/02/2026,Yes'}});
  fireEvent.click(screen.getByRole('button',{name:'Preparar prévia'}));
  assert.equal(calls.length,0);
  assert.equal((screen.getByLabelText('Importar linha 4') as HTMLInputElement).disabled,true);
  assert.equal((screen.getByLabelText('Importar linha 5') as HTMLInputElement).disabled,true);
  fireEvent.click(screen.getByLabelText('Importar linha 3'));
  fireEvent.change(screen.getByLabelText('Organização do cronograma'),{target:{value:'preserve'}});
  fireEvent.click(screen.getByRole('button',{name:'Confirmar importação de 1 assunto(s)'}));
  await waitFor(()=>assert(screen.getByRole('alert')));
  assert.equal(refreshed,false);
  fireEvent.click(screen.getByRole('button',{name:'Confirmar importação de 1 assunto(s)'}));
  await waitFor(()=>assert(screen.getByText('1 assunto(s) importado(s).')));
  assert.equal(calls.length,2);
  const payload=calls[1]![1] as {p_rows:{title:string;source:{preserveDate:boolean}}[]};
  assert.equal(payload.p_rows.length,1); assert.equal(payload.p_rows[0]!.title,'Arbo'); assert.equal(payload.p_rows[0]!.source.preserveDate,true);
  fireEvent.click(screen.getByRole('button',{name:'Ver meus conteúdos →'})); await waitFor(()=>assert(refreshed));
});

test('Notion: data inicial respeita fuso local; sessão real libera o acompanhamento',()=>{
  const c = {...data.competencies[0]!,card:newMemory(START),evidence:[],completedStages:[],notionSource:{status:'Iniciado',nextStudy:'2026-10-16',priming:false,studied:true,questions:false,retrieval:false,rotation:'MFC',originalImportance:'',preserveDate:true}};
  const imported={...data,competencies:[c]};
  const now=new Date('2026-10-16T01:00:00Z'); // ainda 15/10 na Bahia
  assert.equal(makePlan(imported,c.userId,now,60).plan.items.length,0);
  assert.equal(makePlan(imported,c.userId,new Date('2026-10-16T13:00:00Z'),60).plan.items.length,1);
  assert.equal(makePlan({...imported,competencies:[{...c,notionSource:{...c.notionSource,preserveDate:false}}]},c.userId,now,60).plan.items.length,1);
  const sessions=[{id:'s',competency_id:c.id,actual_minutes:10,started_at:'2026-10-14T15:00:00Z',ended_at:'2026-10-14T15:10:00Z',status:'completed',method:'recall',feedback:3}];
  assert.equal(makePlan({...imported,sessions},c.userId,now,60).plan.items.length,1);
});

test('Começo curto: sessão orienta, minimiza e registra parcial com a mesma chave',async()=>{
  const draft={id:'00000000-0000-4000-8000-000000000001',competencyId:data.competencies[0]!.id,minutes:5,method:'reading' as const,small:true,startedAt:new Date(Date.now()-120000).toISOString(),pausedAt:null,pausedMs:0};
  let hidden=false;let paused=false;let saved:Record<string,unknown>|null=null;
  render(<GuidedSession draft={draft} competency={{...data.competencies[0]!,materialUrl:'https://www.notion.so/example'}} onChange={d=>{paused=d.pausedAt!==null;}} onSave={async input=>{saved=input;}} onHide={()=>{hidden=true;}} onDiscard={()=>{}}/>);
  assert(screen.getByText('Avance na teoria'));
  assert.equal(screen.getByRole('link',{name:'Abrir meu material ↗'}).getAttribute('target'),'_blank');
  fireEvent.click(screen.getByRole('button',{name:'Minimizar'}));assert(hidden);
  fireEvent.click(screen.getByRole('button',{name:'Registrar como foi →'}));assert(paused);
  assert.equal((screen.getByLabelText('Resultado') as HTMLSelectElement).value,'partial');
  assert.equal((screen.getByLabelText('Tempo real (min)') as HTMLInputElement).value,'2');
  fireEvent.change(screen.getByLabelText('Onde parou ou o que precisa retomar? (opcional)'),{target:{value:'Retomar na página 12'}});
  fireEvent.click(screen.getByRole('button',{name:'Salvar e atualizar meu plano'}));
  await waitFor(()=>assert(saved));
  assert.equal(saved!['idempotencyKey'],draft.id);assert.equal(saved!['status'],'partial');assert.equal(saved!['method'],'reading');
  assert.equal(saved!['notes'],'Retomar na página 12');
});

test('Sessão guiada exige informar a recuperação; nenhum feedback é escolhido por padrão',async()=>{
  let saves=0;
  render(<SessionForm competencies={data.competencies} initialId={data.competencies[0]!.id} minutes={10} method="recall" locked onSave={async()=>{saves++;}} onClose={()=>{}}/>);
  fireEvent.click(screen.getByRole('button',{name:'Salvar e atualizar meu plano'}));
  await waitFor(()=>assert(screen.getByRole('alert')));assert.equal(saves,0);
  fireEvent.change(screen.getByLabelText('Como foi lembrar?'),{target:{value:'2'}});
  fireEvent.click(screen.getByRole('button',{name:'Salvar e atualizar meu plano'}));await waitFor(()=>assert.equal(saves,1));
});

test('Rascunho de sessão: retoma por usuário e pausa não conta como tempo estudado',()=>{
  const now=Date.now();const draft={id:'00000000-0000-4000-8000-000000000001',competencyId:'c',minutes:5,method:'priming' as const,small:true,startedAt:new Date(now-120000).toISOString(),pausedAt:null,pausedMs:0};
  storeDraft('a',draft);assert.deepEqual(readDraft('a'),draft);assert.equal(readDraft('b'),null);
  const paused=togglePause(draft,now);assert.equal(elapsedSeconds(paused,now+60000),120);
  const resumed=togglePause(paused,now+60000);assert.equal(elapsedSeconds(resumed,now+120000),180);
  storeDraft('a',resumed);assert.equal(readDraft('a')!.id,draft.id);storeDraft('a',null);assert.equal(readDraft('a'),null);
});

test('Material: rejeita protocolo executável e salva link sem mudar o assunto',async()=>{
  const changes:unknown[]=[];
  mock.method(supabase,'from',()=>({update:(payload:unknown)=>{changes.push(payload);return{eq:()=>Promise.resolve({error:null})};}}));
  let saved=false;const c=data.competencies[0]!;
  render(<MaterialLink competency={c} onSaved={async()=>{saved=true;}}/>);
  fireEvent.click(screen.getByRole('button',{name:'Vincular material'}));
  fireEvent.change(screen.getByLabelText(`Link do material de ${c.title}`),{target:{value:'javascript:alert(1)'}});
  fireEvent.click(screen.getByRole('button',{name:'Salvar link'}));await waitFor(()=>assert(screen.getByRole('alert')));assert.equal(changes.length,0);
  fireEvent.change(screen.getByLabelText(`Link do material de ${c.title}`),{target:{value:'https://example.com/aula'}});
  fireEvent.click(screen.getByRole('button',{name:'Salvar link'}));await waitFor(()=>assert(saved));assert.deepEqual(changes,[{resource_url:'https://example.com/aula'}]);
});
