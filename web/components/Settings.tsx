import { useState, type FormEvent, type CSSProperties } from 'react';
import { supabase } from '../lib/client';
import type { StudyData } from '../lib/data';
import { durationLabel, windowCapacity } from '../lib/duration';
import { CalendarPanel } from './CalendarPanel';
import { WeekOverview } from './WeekOverview';
import { AcademicEvents } from './AcademicEvents';
import { useLocalDraft,routineDraftSchema } from '../lib/local-draft';
import { DraftNotice } from './DraftNotice';

const weekdays = ['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'];
export function Settings({ data, onSaved,initialSection }: { data: StudyData; onSaved: () => Promise<void>;initialSection?:'week'|'routine'|'calendar'|'events'|undefined }) {
  const active = data.rotations.find(r => r.start <= new Date() && r.end > new Date());
  const [view,setView]=useState(initialSection??(data.rules.length&&active?'week':'routine'));
  const draft=useLocalDraft(data.userId,'routine',routineDraftSchema,()=>({goal:data.profile?.goal??'',timezone:data.profile?.timezone??Intl.DateTimeFormat().resolvedOptions().timeZone,context:data.contexts.find(c=>c.id===active?.contextId)?.title??'',rules:weekdays.map((_, weekday) => {
    const r = data.rules.find(r => r.weekday === weekday);
    return { weekday, start: r?.starts_local.slice(0,5) ?? '18:00', end: r?.ends_local.slice(0,5) ?? '20:00', minutes: r?.daily_cap_minutes ?? (weekday === 0 ? 0 : 60), effort: r?.max_effort ?? 'high' };
  })}));
  const {goal,timezone,context,rules}=draft.value;
  const setGoal=(goal:string)=>draft.update({goal}),setTimezone=(timezone:string)=>draft.update({timezone}),setContext=(context:string)=>draft.update({context});
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState('');
  function updateRule(index:number,patch:Partial<typeof rules[number]>) {
    draft.update({rules:rules.map((r,i)=>{if(i!==index)return r;const next={...r,...patch};return {...next,minutes:Math.min(next.minutes,windowCapacity(next.start,next.end))};})});
  }
  async function submit(e: FormEvent) {
    e.preventDefault(); setBusy(true); setMessage('');
    try {
      if (rules.some(r => r.end <= r.start)) throw new Error('O fim de cada janela deve ser posterior ao início.');
      const { error } = await supabase.rpc('configure_study', { p_goal: goal, p_timezone: timezone, p_context: context, p_rules: rules });
      if (error) throw error;
      draft.clear();await onSaved(); setMessage('Rotina salva. Seu plano foi recalculado.');
    } catch (err) { setMessage(err instanceof Error ? err.message : 'Não foi possível salvar a rotina.'); }
    finally { setBusy(false); }
  }
  return <><header className="page-header"><div><p className="eyebrow">UM PLANO QUE RESPEITA VOCÊ</p><h1>Seu ritmo, suas janelas.</h1><p className="muted">Defina os limites. As prioridades ficam por conta do motor.</p></div></header>
    <nav className="plan-sections" aria-label="Seções do plano">{[['week','Semana'],['routine','Rotina'],['calendar','Agenda Google'],['events','Provas e rodízios']].map(([key,label])=><button type="button" key={key} className={view===key?'primary':'secondary'} aria-pressed={view===key} onClick={()=>setView(key as typeof view)}>{label}</button>)}</nav>
    {view==='routine'&&data.userId&&<DraftNotice saved={draft.saved} failed={draft.failed} onDiscard={draft.discard}/>}
    <div hidden={view!=='routine'}><form onSubmit={submit} className="settings-form"><details className="profile-settings" open={!data.profile||!data.profile.goal||!active}><summary>Objetivo, contexto e fuso{context?` · ${context}`:''}</summary><div className="form-grid"><label>Seu objetivo<input required maxLength={1000} placeholder="Ex.: consolidar os conteúdos do internato" value={goal} onChange={e => setGoal(e.target.value)}/></label><label>Contexto atual<input required maxLength={200} list="context-options" placeholder="Ex.: Emergência" value={context} onChange={e => setContext(e.target.value)}/></label><datalist id="context-options">{['MFC','Emergência','Clínica Médica','Pediatria','Cirurgia','Obstetrícia'].map(c => <option key={c}>{c}</option>)}</datalist></div>
      <label>Fuso horário<input required value={timezone} onChange={e => setTimezone(e.target.value)} placeholder="America/Bahia"/></label></details>
      <div className="section-title"><h2>Sua semana</h2><span className="caption">Até {durationLabel(rules.reduce((n,r)=>n+r.minutes,0))} na semana</span></div>
      <p className="muted small">Arraste a barra para escolher o limite de cada dia. No início da barra, o dia fica reservado para descanso.</p>
      <div className="week-cards">{[...rules].sort((a,b)=>(a.weekday||7)-(b.weekday||7)).map(r => <section className={`day-card ${r.minutes===0?'rest-day':''}`} key={r.weekday} aria-label={`Disponibilidade ${weekdays[r.weekday]}`}>
        <div className="day-card-head"><h3>{weekdays[r.weekday]}</h3><output htmlFor={`limit-${r.weekday}`}>{durationLabel(r.minutes)}</output></div>
        <label className="range-label" htmlFor={`limit-${r.weekday}`}>Tempo máximo de estudo<input id={`limit-${r.weekday}`} className="time-range" type="range" min={0} max={windowCapacity(r.start,r.end)} step={5} style={{'--range-progress':`${Math.min(100,r.minutes/Math.max(1,windowCapacity(r.start,r.end))*100)}%`} as CSSProperties} aria-label={`Limite ${weekdays[r.weekday]}`} aria-valuetext={durationLabel(r.minutes)} value={r.minutes} onChange={e=>updateRule(r.weekday,{minutes:Number(e.target.value)})}/></label>
        <div className="range-scale"><span>Descanso</span><span>{durationLabel(windowCapacity(r.start,r.end))}</span></div>
        <div className="day-controls"><label>Das<input type="time" required aria-label={`Início ${weekdays[r.weekday]}`} value={r.start} onChange={e=>updateRule(r.weekday,{start:e.target.value})}/></label>
        <label>Até<input type="time" required aria-label={`Fim ${weekdays[r.weekday]}`} value={r.end} onChange={e=>updateRule(r.weekday,{end:e.target.value})}/></label>
        <label>Esforço<select aria-label={`Esforço ${weekdays[r.weekday]}`} value={r.effort} onChange={e=>updateRule(r.weekday,{effort:e.target.value as typeof r.effort})}><option value="low">Leve</option><option value="medium">Moderado</option><option value="high">Completo</option></select></label></div>
        <p className="caption">{r.minutes===0?'Sem estudo planejado neste dia.':'O app encaixa o estudo dentro desta janela e do limite escolhido.'}</p>
      </section>)}</div>
      <div className="settings-actions"><p className="caption">Seu limite é um teto, não uma obrigação.</p>
      {message && <p role="status" className="notice">{message}</p>}<button className="primary" disabled={busy}>{busy ? 'Salvando…' : 'Salvar rotina e recalcular →'}</button></div>
    </form></div><div hidden={view!=='week'}><WeekOverview data={data}/><button className="text-button" onClick={()=>setView('routine')}>Ajustar minha rotina →</button></div><div hidden={view!=='calendar'}><CalendarPanel data={data} onSaved={onSaved}/></div><div hidden={view!=='events'}><AcademicEvents data={data} onSaved={onSaved}/></div></>;
}
