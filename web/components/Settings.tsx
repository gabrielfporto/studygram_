import { useState, type FormEvent } from 'react';
import { supabase } from '../lib/client';
import type { StudyData } from '../lib/data';

const weekdays = ['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'];
export function Settings({ data, onSaved }: { data: StudyData; onSaved: () => Promise<void> }) {
  const [goal, setGoal] = useState(data.profile?.goal ?? '');
  const [timezone, setTimezone] = useState(data.profile?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone);
  const active = data.rotations.find(r => r.start <= new Date() && r.end > new Date());
  const [context, setContext] = useState(data.contexts.find(c => c.id === active?.contextId)?.title ?? '');
  const [rules, setRules] = useState(weekdays.map((_, weekday) => {
    const r = data.rules.find(r => r.weekday === weekday);
    return { weekday, start: r?.starts_local.slice(0,5) ?? '18:00', end: r?.ends_local.slice(0,5) ?? '20:00', minutes: r?.daily_cap_minutes ?? (weekday === 0 ? 0 : 60), effort: r?.max_effort ?? 'high' };
  }));
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState('');
  async function submit(e: FormEvent) {
    e.preventDefault(); setBusy(true); setMessage('');
    try {
      if (rules.some(r => r.end <= r.start)) throw new Error('O fim de cada janela deve ser posterior ao início.');
      const { error } = await supabase.rpc('configure_study', { p_goal: goal, p_timezone: timezone, p_context: context, p_rules: rules });
      if (error) throw error;
      await onSaved(); setMessage('Rotina salva. Seu plano foi recalculado.');
    } catch (err) { setMessage(err instanceof Error ? err.message : 'Não foi possível salvar a rotina.'); }
    finally { setBusy(false); }
  }
  return <><header className="page-header"><div><p className="eyebrow">UM PLANO QUE RESPEITA VOCÊ</p><h1>Seu ritmo, suas janelas.</h1><p className="muted">Defina os limites. As prioridades ficam por conta do motor.</p></div></header>
    <form onSubmit={submit} className="settings-form"><div className="form-grid"><label>Seu objetivo<input required maxLength={1000} placeholder="Ex.: consolidar os conteúdos do internato" value={goal} onChange={e => setGoal(e.target.value)}/></label><label>Contexto atual<input required maxLength={200} list="context-options" placeholder="Ex.: Emergência" value={context} onChange={e => setContext(e.target.value)}/></label><datalist id="context-options">{['MFC','Emergência','Clínica Médica','Pediatria','Cirurgia','Obstetrícia'].map(c => <option key={c}>{c}</option>)}</datalist></div>
      <label>Fuso horário<input required value={timezone} onChange={e => setTimezone(e.target.value)} placeholder="America/Bahia"/></label>
      <div className="section-title"><h2>Disponibilidade semanal</h2><span className="caption">0 minutos = descanso</span></div>
      <div className="availability-list">{rules.map((r,index) => <div className="availability-row" key={r.weekday}><strong>{weekdays[r.weekday]}</strong>
        <label>Das<input type="time" required aria-label={`Início ${weekdays[r.weekday]}`} value={r.start} onChange={e => setRules(rules.map((x,i) => i===index ? {...x,start:e.target.value} : x))}/></label>
        <label>Até<input type="time" required aria-label={`Fim ${weekdays[r.weekday]}`} value={r.end} onChange={e => setRules(rules.map((x,i) => i===index ? {...x,end:e.target.value} : x))}/></label>
        <label>Limite (min)<input type="number" required min={0} max={720} aria-label={`Limite ${weekdays[r.weekday]}`} value={r.minutes} onChange={e => setRules(rules.map((x,i) => i===index ? {...x,minutes:Number(e.target.value)} : x))}/></label>
        <label>Esforço<select aria-label={`Esforço ${weekdays[r.weekday]}`} value={r.effort} onChange={e => setRules(rules.map((x,i) => i===index ? {...x,effort:e.target.value as typeof r.effort} : x))}><option value="low">Leve</option><option value="medium">Moderado</option><option value="high">Completo</option></select></label></div>)}</div>
      <p className="caption">O limite é um teto, não uma meta obrigatória. Conteúdo novo precisa de uma janela de pelo menos 30 minutos e esforço completo.</p>
      {message && <p role="status" className="notice">{message}</p>}<button className="primary" disabled={busy}>{busy ? 'Salvando…' : 'Salvar rotina e recalcular →'}</button>
    </form></>;
}
