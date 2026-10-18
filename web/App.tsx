import { AIWorkspace } from './components/AIWorkspace';
import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './lib/client';
import { loadData, type StudyData } from './lib/data';
import { makePlan } from './lib/planning';
import type { SessionInput } from '../src/application/session';
import { sessionSchema } from '../src/application/session';
import { Auth } from './components/Auth';
import { Today } from './components/Today';
import { Settings } from './components/Settings';
import { Contents } from './components/Contents';
import { Progress } from './components/Progress';
import { SessionForm } from './components/SessionForm';
import { GuidedSession } from './components/GuidedSession';
import { readDraft, storeDraft, type StudyDraft } from './lib/active-study';
import type { StudyMethod } from '../src/engine/study-cycle';
import { clearGoogleSession } from './lib/google-calendar';

const tabs = ['Hoje','Plano','Conteúdos','Progresso'] as const;
type Tab = typeof tabs[number];
export function App() {
  const [session, setSession] = useState<Session|null>(null); const [authReady,setAuthReady] = useState(false);
  const [recovery,setRecovery] = useState(false); const [data,setData] = useState<StudyData|null>(null);
  const [aiOpen,setAiOpen]=useState(false);
  const [planSection,setPlanSection]=useState<'calendar'|'routine'|undefined>(undefined);
  const [tab,setTab] = useState<Tab>('Hoje'); const [error,setError] = useState(''); const [notice,setNotice] = useState('');
  const [now,setNow] = useState(new Date()); const [override,setOverride] = useState<number|null>(null);
  const [refresh,setRefresh] = useState(0); const [loading,setLoading] = useState(false);
  const [active,setActive] = useState<{ id: string; minutes: number; method: SessionInput['method'] }|null>(null);
  const [guided,setGuided]=useState<StudyDraft|null>(null); const [showGuided,setShowGuided]=useState(false);
  useEffect(()=>{setData(null);setAiOpen(false);clearGoogleSession();setGuided(session?.user.id?readDraft(session.user.id):null);setShowGuided(false);},[session?.user.id]);
  function updateGuided(draft:StudyDraft|null) { if(!session)return;storeDraft(session.user.id,draft);setGuided(draft);if(!draft)setShowGuided(false); }
  function startGuided(id:string,minutes:number,method:StudyMethod,small=false) {
    if(!guided) updateGuided({id:crypto.randomUUID(),competencyId:id,minutes,method,small,startedAt:new Date().toISOString(),pausedAt:null,pausedMs:0});
    setShowGuided(true);
  }
  useEffect(() => {
    let alive = true;
    supabase.auth.getSession().then(({ data, error }) => { if (alive) { setSession(data.session); setAuthReady(true); if(error) setError('Falha ao recuperar sua sessão.'); } });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event,next) => {
      setSession(next); setAuthReady(true); if (event === 'PASSWORD_RECOVERY') setRecovery(true);
      if(event === 'SIGNED_OUT') { setData(null); setActive(null);setAiOpen(false); setOverride(null); }
    });
    return () => { alive=false; subscription.unsubscribe(); };
  }, []);
  useEffect(() => { const timer=setInterval(()=>setNow(new Date()),60000); return ()=>clearInterval(timer); },[]);
  useEffect(() => {
    let alive = true;
    if (!session?.user.id) return;
    setLoading(true); setError('');
    loadData(session.user.id).then(value=>{ if(alive) setData(value); }).catch(()=>{ if(alive) setError('Não foi possível carregar seus estudos. Verifique sua conexão e tente novamente.'); }).finally(()=>{ if(alive) setLoading(false); });
    return ()=>{ alive=false; };
  },[session?.user.id,refresh]);
  useEffect(() => { setOverride(null); setActive(null); }, [session?.user.id]);
  const dayKey = now.toLocaleDateString('en-CA', { timeZone: data?.profile?.timezone ?? 'America/Bahia' });
  useEffect(() => { setOverride(null); }, [dayKey]);
  async function reload() { setRefresh(v=>v+1); setNow(new Date()); }
  async function save(input: SessionInput) {
    sessionSchema.parse(input);
    const { data: response, error } = await supabase.functions.invoke('study-session', { body: input });
    if(error) {
      let message='Não foi possível salvar. Tente novamente.';
      if(error.context instanceof Response) { const payload=await error.context.json().catch(()=>null); if(payload?.error) message=payload.error; }
      throw new Error(message);
    }
    if(response?.error) throw new Error(response.error);
    setNotice(response?.nextReview ? `Sessão salva. Próxima revisão: ${new Date(response.nextReview).toLocaleDateString('pt-BR')}.` : 'Sessão salva. Seu plano foi atualizado.');
    await reload();
  }
  if(!authReady) return <main className="loading" role="status">Abrindo seu espaço…</main>;
  if(!session || recovery) return <Auth recovery={recovery} onRecovered={()=>setRecovery(false)}/>;
  const summary = data ? makePlan(data,session.user.id,now,override) : null;
  const guidedCompetency=data?.competencies.find(c=>c.id===guided?.competencyId && !c.archived);
  return <div className="app-shell"><a className="skip-link" href="#main">Ir para o conteúdo</a><aside className="sidebar"><a className="brand" href={import.meta.env.BASE_URL}><span className="brand-mark">s</span>studygram</a><p className="eyebrow nav-label">SEU ESPAÇO</p><nav aria-label="Navegação principal">{tabs.map((t,i)=><button key={t} aria-current={tab===t ? 'page' : undefined} className={tab===t ? 'nav-item active' : 'nav-item'} onClick={()=>{setPlanSection(undefined);setTab(t);setNotice('');}}><span aria-hidden="true">{['◉','▤','▧','↗'][i]}</span>{t}</button>)}</nav><div className="sidebar-footer"><p className="caption">Um passo por vez.</p><p className="user-email">{session.user.email}</p><button className="text-button" onClick={async()=>{const {error}=await supabase.auth.signOut(); if(error)setError('Não foi possível sair. Tente novamente.');}}>Sair da conta</button></div></aside>
    <main id="main" className="main"><div className="topbar"><span className="caption">APRENDIZADO COM INTENÇÃO</span>{data&&<button className="secondary" disabled={!!guided||!!active} onClick={()=>setAiOpen(true)}>Assistente de estudo</button>}{data?.competencies.some(c=>!c.archived) && <button disabled={!!guided} className="secondary" onClick={()=>setActive({id:'',minutes:20,method:'reading'})}>+ Registrar estudo</button>}</div>
      {guided && data && <div className="active-study notice"><div><strong>{guidedCompetency?`Sessão em andamento · ${guidedCompetency.title}`:'O assunto da sessão foi arquivado ou não está disponível.'}</strong><p>Seu próximo passo já está escolhido.</p></div>{guidedCompetency?<button className="primary" onClick={()=>setShowGuided(true)}>Continuar sessão →</button>:<button className="secondary" onClick={()=>updateGuided(null)}>Encerrar sem registrar</button>}</div>}
      {notice && <p role="status" className="notice">{notice}</p>}{error && <div role="alert" className="notice error">{error}<button className="text-button" onClick={()=>void reload()}>Tentar novamente</button></div>}
      {loading && <p className="loading" role="status">Organizando seus estudos…</p>}
      {data && summary && <>{tab==='Hoje' && <Today data={data} plan={summary.plan} spent={summary.spent} now={now} onStart={startGuided} onSettings={()=>{setPlanSection(undefined);setTab('Plano');}} onCalendar={()=>{setPlanSection('calendar');setTab('Plano');}} onContents={()=>setTab('Conteúdos')} override={override} onOverride={setOverride}/>}{tab==='Plano' && <Settings data={data} onSaved={reload} initialSection={planSection}/>}{tab==='Conteúdos' && <Contents data={data} onSaved={reload}/>}{tab==='Progresso' && <Progress data={data} now={now} onSaved={reload} diagnosticDisabled={!!guided||!!active} onDiagnosticAction={action=>{if(guided||active)return;if(action.kind==='routine'){setPlanSection('routine');setTab('Plano');}else if(action.kind==='register'){setActive({id:'',minutes:20,method:'reading'});}else{startGuided(action.competencyId,5,'recall',true);}}}/>}</>}
    </main>{active && data && <SessionForm competencies={data.competencies} initialId={active.id} timezone={data.profile?.timezone??'America/Bahia'} minutes={active.minutes} method={active.method} onSave={save} onClose={()=>setActive(null)}/>}
    {aiOpen&&data&&<AIWorkspace data={data} onSave={save} onSaved={reload} onClose={()=>setAiOpen(false)}/>}
    {guided && guidedCompetency && showGuided && <GuidedSession draft={guided} competency={guidedCompetency} onChange={updateGuided} onHide={()=>setShowGuided(false)} onDiscard={()=>updateGuided(null)} onSave={async input=>{await save(input);updateGuided(null);}}/>}</div>;
}
