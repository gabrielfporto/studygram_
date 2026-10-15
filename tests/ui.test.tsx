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
const { CalendarPanel } = await import('../web/components/CalendarPanel');
const google = await import('../web/lib/google-calendar');
const { calendarState } = await import('../web/lib/calendar-state');
const { supabase } = await import('../web/lib/client');
afterEach(()=>{cleanup();mock.restoreAll();localStorage.clear();google.clearGoogleSession();delete window.google;});
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

test('Plano: barra ajusta o limite, respeita a janela e salva descanso com zero minutos',async()=>{
  let saved:unknown=null;
  mock.method(supabase,'rpc',(_name:string,input:unknown)=>{saved=input;return Promise.resolve({data:null,error:null});});
  render(<Settings data={data} onSaved={async()=>{}}/>);
  fireEvent.change(screen.getByLabelText('Contexto atual'),{target:{value:'MFC'}});
  const slider=screen.getByRole('slider',{name:'Limite Segunda'});
  fireEvent.change(slider,{target:{value:'105'}});assert.equal(slider.getAttribute('aria-valuetext'),'1 h 45 min');
  fireEvent.change(screen.getByLabelText('Fim Segunda'),{target:{value:'19:00'}});assert.equal((slider as HTMLInputElement).value,'60');assert.equal(slider.getAttribute('max'),'60');
  fireEvent.change(slider,{target:{value:'0'}});assert.equal(slider.getAttribute('aria-valuetext'),'Descanso');
  fireEvent.click(screen.getByRole('button',{name:/Salvar rotina/}));await waitFor(()=>assert(saved));
  assert.equal((saved as {p_rules:{weekday:number;minutes:number}[]}).p_rules.find(r=>r.weekday===1)!.minutes,0);
});

test('Calendar: Google token só fica na memória e consulta parcial não grava snapshot',async()=>{
  const calls:{url:string;authorization:string|null}[]=[];let persisted:unknown=null;let googleError=false;
  window.google={accounts:{oauth2:{initTokenClient:config=>({requestAccessToken:()=>{assert.equal(config.scope,google.GOOGLE_SCOPES.join(' '));config.callback({access_token:'only-in-memory',expires_in:3600});}}),hasGrantedAllScopes:()=>true,revoke:(_token,callback)=>callback({successful:true})}}};
  mock.method(globalThis,'fetch',async (url:unknown,init?:RequestInit)=>{calls.push({url:String(url),authorization:new Headers(init?.headers).get('Authorization')});return new Response(JSON.stringify(String(url).includes('calendarList')?{items:[{id:'a',summary:'Agenda',primary:true}]}:{calendars:{a:googleError?{busy:[],errors:[{reason:'internalError'}]}:{busy:[{start:'2026-10-15T12:00:00Z',end:'2026-10-15T13:00:00Z'}]}}}));});
  mock.method(supabase,'rpc',(_name:string,input:unknown)=>{persisted=input;return Promise.resolve({error:null,data:{}});});
  await google.loadGoogleIdentity();await google.authorizeGoogle('a','123-test.apps.googleusercontent.com');assert(google.hasGoogleToken('a'));assert(!google.hasGoogleToken('b'));assert.equal(localStorage.length,0);
  const calendars=await google.listGoogleCalendars('a');await google.syncGoogleCalendar('a',calendars,'America/Bahia',START);
  assert(persisted);assert(!JSON.stringify(persisted).includes('only-in-memory'));assert(calls.every(c=>c.authorization==='Bearer only-in-memory'));
  persisted=null;googleError=true;await assert.rejects(google.syncGoogleCalendar('a',calendars,'America/Bahia',START),/último estado/);assert.equal(persisted,null);
  assert(await google.revokeGoogle('a'));assert(!google.hasGoogleToken('a'));
});

test('Calendar: tela autoriza, permite seleção e só anuncia sincronização após resposta',async()=>{
  let saved=false;const synced:string[][]=[];
  const api={load:async()=>{},authorize:async()=>{},list:async()=>[{id:'primary',summary:'Pessoal',primary:true},{id:'work',summary:'Trabalho'}],cached:()=>[],hasToken:()=>true,revoke:async()=>true,sync:async(_user:string,selected:{id:string}[])=>{synced.push(selected.map(c=>c.id));return{from:'',to:'',calendars:[],busy:[]};}};
  render(<CalendarPanel data={{...data,userId:'a'}} onSaved={async()=>{saved=true;}} clientId="123-test.apps.googleusercontent.com" api={api}/>);
  await waitFor(()=>assert.equal((screen.getByRole('button',{name:'Conectar Google Calendar'}) as HTMLButtonElement).disabled,false));
  fireEvent.click(screen.getByRole('button',{name:'Conectar Google Calendar'}));await waitFor(()=>assert(screen.getByLabelText('Trabalho')));assert.equal(synced.length,0);
  fireEvent.click(screen.getByLabelText('Trabalho'));fireEvent.click(screen.getByRole('button',{name:'Sincronizar agendas selecionadas'}));await waitFor(()=>assert(saved));assert.deepEqual(synced,[['primary','work']]);
  assert(screen.getByText('Agenda atualizada. Seu plano foi recalculado.'));
});

test('Calendar: compromissos bloqueiam rotina e começo de 5 minutos; cache antigo é sinalizado',()=>{
  const c={...data.competencies[0]!,card:newMemory(START),evidence:[],completedStages:[]};
  const imported={...data,competencies:[c],calendar:{connections:[{id:'conn',external_calendar_id:'a',status:'connected' as const,last_synced_at:START.toISOString(),sync_range_start:'2026-10-15T03:00:00Z',sync_range_end:'2026-10-29T03:00:00Z'}],events:[{id:'busy',connection_id:'conn',starts_at:START.toISOString(),ends_at:new Date(START.getTime()+30*60000).toISOString(),status:'busy' as const}]}};
  assert.equal(makePlan(imported,c.userId,START,5).plan.items.length,0);
  const full=makePlan(imported,c.userId,START,60);assert.equal(full.plan.capacityMinutes,30);assert(full.plan.items.every(i=>i.start>=START.getTime()+30*60000));
  assert.equal(calendarState(imported,START).stale,false);assert.equal(calendarState(imported,new Date(START.getTime()+2*3600000)).stale,true);
  assert.equal(makePlan({...imported,calendar:{...imported.calendar,connections:imported.calendar.connections.map(c=>({...c,status:'disconnected' as const}))}},c.userId,START,5).plan.items.length,1);
});

test('Registro: busca sem acentos seleciona a competência certa e preserva o formulário',async()=>{
  let saved='';const wanted=data.competencies.find(c=>c.title==='Trombólise')!;
  render(<SessionForm competencies={data.competencies} initialId="" minutes={20} method="reading" onClose={()=>{}} onSave={async s=>{saved=s.competencyId;}}/>);
  fireEvent.change(screen.getByLabelText('Buscar área, tema ou competência'),{target:{value:'trombolise'}});
  fireEvent.click(screen.getByRole('button',{name:new RegExp(wanted.topic+' · Trombólise')}));
  fireEvent.change(screen.getByLabelText('Tempo real (min)'),{target:{value:'35'}});
  fireEvent.click(screen.getByRole('button',{name:'Salvar e atualizar meu plano'}));
  await waitFor(()=>assert.equal(saved,wanted.id));
});

test('Provas: temas relacionados e data no fuso são gravados pelo RPC atômico',async()=>{
  const {AcademicEvents}=await import('../web/components/AcademicEvents');const calls:unknown[][]=[];
  mock.method(supabase,'rpc',(...args:unknown[])=>{calls.push(args);return Promise.resolve({data:'ok',error:null});});
  render(<AcademicEvents data={{...data,userId:'owner'}} onSaved={async()=>{}}/>);
  fireEvent.change(screen.getByLabelText('Nome da prova'),{target:{value:'Prova de neurologia'}});
  fireEvent.change(screen.getByLabelText('Data da prova'),{target:{value:'2026-11-02'}});
  const topic=data.competencies[0]!;fireEvent.click(screen.getByLabelText(`${topic.area} · ${topic.topic}`));
  fireEvent.click(screen.getByRole('button',{name:'Salvar evento e recalcular'}));
  await waitFor(()=>assert.equal(calls.length,1));const args=calls[0]![1] as {p_start:string;p_competencies:string[]};
  assert.equal(calls[0]![0],'save_academic_event');assert.equal(args.p_start,'2026-11-03T02:59:59.999Z');assert(args.p_competencies.includes(topic.id));
});

test('Erros: falha permite repetir com a mesma chave e não altera acertos',async()=>{
  const {MistakeNotebook}=await import('../web/components/MistakeNotebook');const calls:{id:string;description:string}[]=[];
  mock.method(supabase,'from',()=>({upsert:(payload:{id:string;description:string})=>{calls.push(payload);return Promise.resolve({error:calls.length===1?new Error('Sem rede'):null});}}));
  render(<MistakeNotebook data={{...data,userId:'owner'}} onSaved={async()=>{}}/>);
  fireEvent.click(screen.getByText('Registrar um erro específico'));
  const c=data.competencies[0]!;fireEvent.change(screen.getByLabelText('Buscar área, tema ou competência'),{target:{value:c.title}});
  fireEvent.click(screen.getByRole('button',{name:`${c.topic} · ${c.title} ${c.area}`}));
  fireEvent.change(screen.getByLabelText('O que você errou ou confundiu?'),{target:{value:'Confundi os critérios'}});
  fireEvent.click(screen.getByRole('button',{name:'Salvar ponto de atenção'}));await waitFor(()=>assert(screen.getByText('Sem rede')));
  fireEvent.click(screen.getByRole('button',{name:'Salvar ponto de atenção'}));await waitFor(()=>assert(screen.getByText(/Erro registrado/)));
  assert.equal(calls[0]!.id,calls[1]!.id);assert.equal(data.questions.length,0);
});

test('Plano: navegação de seções mantém os ajustes da rotina e dá acesso direto à agenda',()=>{
  const active={contextId:'ctx',start:new Date('2020-01-01'),end:new Date('2099-01-01')};
  render(<Settings data={{...data,rotations:[active],contexts:[{id:'ctx',title:'MFC'}],rules:[{weekday:1,starts_local:'18:00',ends_local:'20:00',daily_cap_minutes:60,minimum_session_minutes:5,max_effort:'high'}]}} onSaved={async()=>{}}/>);
  assert(screen.getByRole('region',{name:'Disponibilidade dos próximos sete dias'}));
  fireEvent.click(screen.getByRole('button',{name:'Rotina'}));
  fireEvent.change(screen.getByRole('slider',{name:'Limite Segunda'}),{target:{value:'45'}});
  fireEvent.click(screen.getByRole('button',{name:'Agenda Google'}));
  assert(screen.getByRole('region',{name:'Google Calendar'}));
  fireEvent.click(screen.getByRole('button',{name:'Rotina'}));
  assert.equal((screen.getByRole('slider',{name:'Limite Segunda'}) as HTMLInputElement).value,'45');
});

test('Competência: ajuste altera parâmetros sem substituir o estado de memória',async()=>{
  const {CompetencyEditor}=await import('../web/components/CompetencyEditor');let values:Record<string,unknown>={};
  mock.method(supabase,'from',()=>({update:(v:Record<string,unknown>)=>{values=v;return{eq:()=>Promise.resolve({error:null})};}}));
  render(<CompetencyEditor competency={data.competencies[0]!} onSaved={async()=>{}}/>);
  fireEvent.click(screen.getByRole('button',{name:'Ajustar competência'}));
  fireEvent.change(screen.getByLabelText('Importância'),{target:{value:'1'}});fireEvent.click(screen.getByRole('button',{name:'Salvar ajustes'}));
  await waitFor(()=>assert(screen.getByText(/Histórico e memória preservados/)));assert.equal(values.importance,1);assert.equal('card' in values,false);
});

test('IA: geração mostra prévia, preserva campos desconhecidos e exige confirmação para salvar',async()=>{
  const {AIWorkspace}=await import('../web/components/AIWorkspace');let calls=0;let saved=0;
  const c=data.competencies[0]!;const proposal={competencyId:c.id,minutes:30,method:'questions' as const,total:10,correct:null,notes:'Rever critérios',dateHint:null,warnings:[]};
  render(<AIWorkspace data={data} onSave={async()=>{saved++;}} onSaved={async()=>{}} onClose={()=>{}} api={{status:async()=>({available:true,dailyLimit:10}),propose:async()=>{calls++;return{proposal,cached:false};}}}/>);
  await waitFor(()=>assert(screen.getByLabelText('O que você quer organizar?')));
  fireEvent.change(screen.getByLabelText('O que você quer organizar?'),{target:{value:'Fiz 10 questões em 30 minutos'}});
  fireEvent.click(screen.getByRole('button',{name:'Preparar sugestão'}));await waitFor(()=>assert(screen.getByRole('region',{name:'Prévia da sugestão'})));
  assert.equal(calls,1);assert.equal(saved,0);fireEvent.click(screen.getByRole('button',{name:'Revisar registro antes de salvar'}));
  assert.equal((screen.getByLabelText('Acertos') as HTMLInputElement).value,'');
  assert.equal((screen.getByLabelText('Como foi lembrar?') as HTMLSelectElement).value,'0');
  fireEvent.change(screen.getByLabelText('Acertos'),{target:{value:'7'}});fireEvent.change(screen.getByLabelText('Como foi lembrar?'),{target:{value:'3'}});
  fireEvent.click(screen.getByRole('button',{name:'Salvar e atualizar meu plano'}));await waitFor(()=>assert.equal(saved,1));
});

test('IA: recuperação só revela resposta após tentativa e não atualiza memória automaticamente',async()=>{
  const {AIWorkspace}=await import('../web/components/AIWorkspace');let saved=false;
  const quote='O ciclo inclui evaporação, condensação e precipitação, movendo a água entre a superfície e a atmosfera.';
  render(<AIWorkspace data={data} onSave={async()=>{saved=true;}} onSaved={async()=>{}} onClose={()=>{}} api={{status:async()=>({available:true,dailyLimit:10}),propose:async()=>({proposal:{question:'Quais são as etapas?',answer:'Evaporação, condensação e precipitação.',sourceQuote:quote,warnings:[]},cached:false})}}/>);
  await waitFor(()=>assert(screen.getByRole('button',{name:'Recuperação ativa'})));fireEvent.click(screen.getByRole('button',{name:'Recuperação ativa'}));
  fireEvent.change(screen.getByLabelText('Trecho do seu material'),{target:{value:quote}});
  const c=data.competencies[0]!;fireEvent.change(screen.getByLabelText('Buscar área, tema ou competência'),{target:{value:c.title}});fireEvent.click(screen.getByRole('button',{name:`${c.topic} · ${c.title} ${c.area}`}));
  fireEvent.click(screen.getByRole('button',{name:'Preparar sugestão'}));await waitFor(()=>assert(screen.getByText('Quais são as etapas?')));
  assert.equal((screen.getByRole('button',{name:'Comparar com o material'}) as HTMLButtonElement).disabled,true);
  assert.equal(screen.queryByText('Evaporação, condensação e precipitação.'),null);fireEvent.change(screen.getByLabelText('Sua resposta sem consultar'),{target:{value:'Evaporação e condensação'}});
  fireEvent.click(screen.getByRole('button',{name:'Comparar com o material'}));assert(screen.getByText(/Resposta sugerida/));assert.equal(saved,false);
});
