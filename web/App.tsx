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

const tabs = ['Hoje','Plano','Conteúdos','Progresso'] as const;
type Tab = typeof tabs[number];
export function App() {
  const [session, setSession] = useState<Session|null>(null); const [authReady,setAuthReady] = useState(false);
  const [recovery,setRecovery] = useState(false); const [data,setData] = useState<StudyData|null>(null);
  const [tab,setTab] = useState<Tab>('Hoje'); const [error,setError] = useState(''); const [notice,setNotice] = useState('');
  const [now,setNow] = useState(new Date()); const [override,setOverride] = useState<number|null>(null);
  const [refresh,setRefresh] = useState(0); const [loading,setLoading] = useState(false);
  const [active,setActive] = useState<{ id: string; minutes: number; method: SessionInput['method'] }|null>(null);
  useEffect(() => {
    let alive = true;
    supabase.auth.getSession().then(({ data, error }) => { if (alive) { setSession(data.session); setAuthReady(true); if(error) setError('Falha ao recuperar sua sessão.'); } });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event,next) => {
      setSession(next); setAuthReady(true); if (event === 'PASSWORD_RECOVERY') setRecovery(true);
      if(event === 'SIGNED_OUT') { setData(null); setActive(null); setOverride(null); }
    });
    return () => { alive=false; subscription.unsubscribe(); };
  }, []);
  useEffect(() => { const timer=setInterval(()=>setNow(new Date()),60000); return ()=>clearInterval(timer); },[]);
  useEffect(() => {
    let alive = true; setData(null);
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
  return <div className="app-shell"><a className="skip-link" href="#main">Ir para o conteúdo</a><aside className="sidebar"><a className="brand" href={import.meta.env.BASE_URL}><span className="brand-mark">s</span>studygram</a><p className="eyebrow nav-label">SEU ESPAÇO</p><nav aria-label="Navegação principal">{tabs.map((t,i)=><button key={t} aria-current={tab===t ? 'page' : undefined} className={tab===t ? 'nav-item active' : 'nav-item'} onClick={()=>{setTab(t);setNotice('');}}><span aria-hidden="true">{['◉','▤','▧','↗'][i]}</span>{t}</button>)}</nav><div className="sidebar-footer"><p className="caption">Um passo por vez.</p><p className="user-email">{session.user.email}</p><button className="text-button" onClick={async()=>{const {error}=await supabase.auth.signOut(); if(error)setError('Não foi possível sair. Tente novamente.');}}>Sair da conta</button></div></aside>
    <main id="main" className="main"><div className="topbar"><span className="caption">APRENDIZADO COM INTENÇÃO</span>{data?.competencies.some(c=>!c.archived) && <button className="secondary" onClick={()=>setActive({id:data.competencies.find(c=>!c.archived)!.id,minutes:20,method:'reading'})}>+ Registrar estudo</button>}</div>
      {notice && <p role="status" className="notice">{notice}</p>}{error && <div role="alert" className="notice error">{error}<button className="text-button" onClick={()=>void reload()}>Tentar novamente</button></div>}
      {loading && <p className="loading" role="status">Organizando seus estudos…</p>}
      {data && summary && <>{tab==='Hoje' && <Today data={data} plan={summary.plan} spent={summary.spent} now={now} onStart={(id,minutes,method)=>setActive({id,minutes,method})} onSettings={()=>setTab('Plano')} onContents={()=>setTab('Conteúdos')} override={override} onOverride={setOverride}/>}{tab==='Plano' && <Settings data={data} onSaved={reload}/>}{tab==='Conteúdos' && <Contents data={data} onSaved={reload}/>}{tab==='Progresso' && <Progress data={data} now={now}/>}</>}
    </main>{active && data && <SessionForm competencies={data.competencies} initialId={active.id} minutes={active.minutes} method={active.method} onSave={save} onClose={()=>setActive(null)}/>}</div>;
}
