import { useState } from 'react';
import type { StudyData } from '../lib/data';
import type { Plan } from '../../src/engine/planner';
import { instructions, nextStudyStep, type StudyMethod } from '../../src/engine/study-cycle';
import { StageProgress } from './StageProgress';
import { availabilitySummary } from '../lib/availability-summary';
import { calendarState } from '../lib/calendar-state';
import { PlanReference } from './PlanReference';

export function Today({ data, plan, spent, now, onStart, onSettings, onContents,onCalendar, override, onOverride }: {
  data: StudyData; plan: Plan; spent: number; now: Date; onStart: (id: string, minutes: number, method: StudyMethod, small?:boolean) => void;
  onCalendar?:()=>void; onSettings: () => void; onContents: () => void; override: number | null; onOverride: (value: number | null) => void;
}) {
  const [explain,setExplain]=useState(false); const [minutes,setMinutes]=useState(30);
  const next=plan.items[0]; const c=data.competencies.find(c=>c.id===next?.competencyId);
  const guide=next ? instructions[next.method] : null;
  const last=c ? data.sessions.filter(s=>s.competency_id===c.id && s.status!=='missed').sort((a,b)=>b.started_at.localeCompare(a.started_at))[0] : undefined;
  const active=data.rotations.find(r=>r.start<=now && r.end>now);
  const context=data.contexts.find(c=>c.id===active?.contextId)?.title;
  const small=!!(c && next && next.minutes<nextStudyStep(c,now).minutes);
  const calendar=calendarState(data,now);const calendarImpact=availabilitySummary(data,now);
  return <><header className="page-header"><div><p className="eyebrow">{new Intl.DateTimeFormat('pt-BR',{weekday:'long',day:'numeric',month:'long',timeZone:data.profile?.timezone??'America/Bahia'}).format(now)}</p><h1>Você só precisa do próximo passo.</h1><p className="muted">{context?`${context} · seu contexto atual`:'Escolha feita. Comece pelo que cabe agora.'}</p></div><span className="status-dot">Plano adaptativo</span></header>
    {calendar.connected && <div className="notice calendar-hint"><span>{calendar.stale?'Sua agenda precisa de atualização. O plano usa a última consulta salva.':calendarImpact.overlap?`Na rotina de hoje, ${calendarImpact.overlap} min coincidem com sua agenda. Veja o impacto e as janelas livres.`:'Agenda consultada: nenhum conflito com as janelas restantes da rotina de hoje.'}</span><button className="text-button" onClick={onCalendar??onSettings}>{calendar.stale?'Atualizar agenda':'Ver agendas'}</button></div>}
    <div className="today-grid"><section>
      {next && c && guide ? <article className="focus"><div className="focus-top"><p className="eyebrow">{small?'UM COMEÇO DE 5 MINUTOS':'SEU PRÓXIMO PASSO'}</p><span className="pill">{next.minutes} min</span></div><p className="topic-area">{c.area} · {c.topic}</p><h2>{c.title}</h2><p className="competency-title">{guide.title}</p><p className="muted">{guide.goal}</p><div className="actions"><button className="primary" onClick={()=>onStart(c.id,next.minutes,next.method,small)}>Iniciar sessão <span aria-hidden="true">↗</span></button>{next.minutes>5 && <button className="secondary" onClick={()=>onStart(c.id,5,next.method,true)}>Começar com 5 min</button>}</div><StageProgress competency={c}/>
        {next.start>now.getTime()+60000 && <p className="caption">Encaixe no plano: {new Date(next.start).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit',timeZone:data.profile?.timezone??'America/Bahia'})}. Para procurar um bloco a partir de agora, use o ajuste de tempo ao lado.</p>}
        <div className="first-action"><strong>Primeiro movimento</strong><p>{guide.steps[0]}</p>{small && <p className="caption">São só cinco minutos. Você poderá registrar avanço parcial e continuar depois.</p>}</div>
        {last?.notes && <div className="resume-note"><strong>Você deixou este ponto para retomar:</strong><p>{last.notes}</p></div>}
        <div className="reason">{nextStudyStep(c,now).review?'Hora de acompanhar o que você já estudou.':`Etapa pendente: ${guide.title.toLocaleLowerCase('pt-BR')}.`} {next.priority.reasons[0]??'Escolhido para sua disponibilidade.'}</div>

        <button className="text-button" onClick={()=>setExplain(!explain)} aria-expanded={explain}>Por que agora?</button>
        {explain && <div className="explanation"><p>Prioridade: {next.priority.score.toFixed(1)} / 100</p>{Object.entries(next.priority.contributions).map(([key,value])=><div key={key}><span>{{memory:'Memória',weakness:'Dificuldade',context:'Contexto',importance:'Importância',events:'Provas',exposure:'Exposição recente',manual:'Prioridade manual'}[key]}</span><strong>+{value.toFixed(1)}</strong></div>)}<p className="caption">A escolha considera a etapa pendente, duração, esforço e as demais atividades que cabem hoje.</p></div>}
      </article> : <article className="focus empty"><p className="eyebrow">UM COMEÇO TRANQUILO</p><h2>{!data.profile?'Vamos conhecer sua rotina?':!data.competencies.some(c=>!c.archived)?'O que você quer aprender?':'Seu plano está respeitando seu tempo.'}</h2><p>{!data.profile?'Defina seu contexto e os horários em que deseja estudar.':!data.competencies.some(c=>!c.archived)?'Adicione ou importe os assuntos que você já estuda.':'Pode não haver tempo suficiente agora, ou as datas iniciais e revisões ainda não chegaram. Ajuste o tempo disponível se quiser começar agora.'}</p>{!data.profile?<button className="primary" onClick={onSettings}>Configurar minha rotina →</button>:!data.competencies.some(c=>!c.archived)?<button className="primary" onClick={onContents}>Adicionar primeiro conteúdo →</button>:null}</article>}
      {plan.items.length>1 && <details className="next-list"><summary>Depois, se couber no seu dia · {plan.items.length-1} atividade(s)</summary>{plan.items.slice(1).map(item=>{const comp=data.competencies.find(c=>c.id===item.competencyId)!;return <div className="study-row" key={item.competencyId}><div><strong>{comp.title}</strong><p>{instructions[item.method].title}</p></div><span>{item.minutes} min</span></div>;})}</details>}
    </section><aside className="day-summary"><p className="eyebrow">SEU TEMPO HOJE</p><div className="big-number">{plan.capacityMinutes}<span>min disponíveis</span></div><div className="metric-row"><span>Planejado</span><strong>{plan.plannedMinutes} min</strong></div><div className="metric-row"><span>Já estudado</span><strong>{spent} min</strong></div><hr/><h3>Está difícil começar?</h3><p className="muted small">Reduza o compromisso. Cinco minutos podem ser apenas um primeiro contato.</p><button className="secondary" onClick={()=>onOverride(spent+5)}>Tenho só 5 minutos</button><hr/><h3>O dia mudou?</h3><form onSubmit={e=>{e.preventDefault();onOverride(minutes+spent);}}><label htmlFor="time-now">Minutos disponíveis agora</label><div className="inline"><input id="time-now" type="number" min={0} max={Math.max(0,720-spent)} required value={minutes} onChange={e=>setMinutes(Number(e.target.value))}/><button className="secondary">Recalcular</button></div></form>{override!==null && <button className="text-button" onClick={()=>onOverride(null)}>Usar horários habituais</button>}<p className="caption quiet-note">Uma sessão parcial conta como tempo estudado. Você pode retomar sem acumular tarefas atrasadas.</p></aside></div>
    <PlanReference data={data} plan={plan} now={now}/>
  </>;
}
