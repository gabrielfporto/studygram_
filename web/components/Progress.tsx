import type { StudyData } from '../lib/data';
import { MistakeNotebook } from './MistakeNotebook';
import { localDay } from '../lib/planning';
import { retention, learningState } from '../../src/engine/memory';
import { useState } from 'react';
import { Diagnosis } from './Diagnosis';
import type { DiagnosticAction } from '../lib/diagnosis';
export function Progress({ data, now, onSaved=async()=>{},onDiagnosticAction=()=>{},diagnosticDisabled=false }: { data: StudyData; now: Date; onSaved?:()=>Promise<void>;onDiagnosticAction?:(action:DiagnosticAction)=>void;diagnosticDisabled?:boolean }) {
  const [section,setSection]=useState<'overview'|'diagnosis'>('overview');
  const active = data.competencies.filter(c => !c.archived);
  const studied = active.filter(c => c.card.reps > 0);
  const mean = studied.length ? studied.reduce((s,c) => s + retention(c.card, now)!,0)/studied.length : null;
  const risk = studied.filter(c => retention(c.card, now)! < 0.9);
  const total = data.questions.reduce((s,q) => s + q.total,0); const correct = data.questions.reduce((s,q) => s + q.correct,0);
  const timezone=data.profile?.timezone??'America/Bahia';
  const today=localDay(now,timezone);
  const weeks=Array.from({length:4},(_,i)=>{const end=today.subtract({days:i*7});const start=end.subtract({days:6});const within=(at:string)=>{const d=localDay(new Date(at),timezone);return d.toString()>=start.toString()&&d.toString()<=end.toString()&&Date.parse(at)<=now.getTime();};const qs=data.questions.filter(q=>within(q.occurred_at));const attempts=qs.reduce((n,q)=>n+q.total,0);const right=qs.reduce((n,q)=>n+q.correct,0);return {start,end,attempts,right,days:new Set(data.sessions.filter(s=>s.actual_minutes>0&&within(s.started_at)).map(s=>localDay(new Date(s.started_at),timezone).toString())).size};});
  return <><header className="page-header"><div><p className="eyebrow">EVIDÊNCIA, NÃO PRESSÃO</p><h1>O que está ficando com você.</h1><p className="muted">Acompanhe o aprendizado, além do tempo de estudo.</p></div></header>
    <nav className="plan-sections" aria-label="Seções de progresso"><button className={section==='overview'?'primary':'secondary'} aria-pressed={section==='overview'} onClick={()=>setSection('overview')}>Visão geral</button><button className={section==='diagnosis'?'primary':'secondary'} aria-pressed={section==='diagnosis'} onClick={()=>setSection('diagnosis')}>Diagnóstico</button></nav>
    {section==='diagnosis'?<Diagnosis data={data} now={now} onAction={onDiagnosticAction} disabled={diagnosticDisabled}/>:<>
    <div className="stats"><div><span>Retenção estimada</span><strong>{mean === null ? '—' : `${Math.round(mean*100)}%`}</strong><p>{studied.length ? `Em ${studied.length} competências com recuperação` : 'Registre uma recuperação para começar'}</p></div><div><span>Acertos em questões</span><strong>{total ? `${Math.round(correct/total*100)}%` : '—'}</strong><p>{total ? `${correct} acertos em ${total} tentativas` : 'Ainda sem evidência objetiva'}</p></div><div><span>Precisam de atenção</span><strong>{risk.length}</strong><p>Abaixo da meta de 90% de retenção estimada</p></div></div>
    <p className="caption">Estimativas do FSRS, não uma garantia de domínio. {active.length-studied.length} competências ainda não têm evidência de recuperação.</p>
    <section className="area-section"><h2>Por área</h2>{[...new Set(active.map(c => c.area))].map(area => { const comps = active.filter(c => c.area === area); const learned = comps.filter(c => c.card.reps>0).length; return <div className="progress-row" key={area}><div><strong>{area}</strong><span className="caption">{learned}/{comps.length} competências praticadas</span></div><progress max={comps.length} value={learned} aria-label={`Cobertura de prática em ${area}`}/></div>; })}</section>
    <section className="area-section"><h2>Competências em atenção</h2>{risk.length ? risk.slice(0,8).map(c => <div className="study-row" key={c.id}><div><strong>{c.topic} · {c.title}</strong><p>{learningState(c.card,c.evidence)}</p></div><span>{Math.round(retention(c.card,now)!*100)}%</span></div>) : <p className="muted">{studied.length ? 'Nenhuma competência avaliada abaixo da meta neste momento.' : 'Os indicadores aparecerão conforme você registrar suas práticas.'}</p>}</section>
    <section className="area-section"><h2>Últimas 4 semanas</h2><p className="caption">Comparação de prática e questões registradas; não é uma medida de evolução da retenção. Amostras diferentes podem mudar a taxa de acerto.</p>{weeks.map(w=><div className="progress-row" key={w.start.toString()}><div><strong>{w.start.toString().slice(5).split('-').reverse().join('/')}–{w.end.toString().slice(5).split('-').reverse().join('/')}</strong><span className="caption">{w.days} dia(s) com estudo · {w.attempts} questões</span></div><span>{w.attempts?`${Math.round(w.right/w.attempts*100)}% de acertos`:'Sem questões'}</span></div>)}</section>
    <MistakeNotebook data={data} onSaved={onSaved}/>
    <section className="area-section"><h2>Histórico recente</h2>{[...data.sessions].sort((a,b)=>b.started_at.localeCompare(a.started_at)).slice(0,20).map(s=><details className="history-row" key={s.id}><summary>{data.competencies.find(c=>c.id===s.competency_id)?.topic??'Conteúdo'} · {s.actual_minutes} min · {new Date(s.started_at).toLocaleDateString('pt-BR',{timeZone:timezone})}</summary><p className="caption">{data.competencies.find(c=>c.id===s.competency_id)?.title} · {{completed:'Concluído',partial:'Parcial',missed:'Não realizado'}[s.status]??s.status}</p><p className="small">{s.notes||'Sem observações.'}</p></details>)}{!data.sessions.length&&<p className="muted">Seus registros aparecerão aqui.</p>}</section>
    <p className="caption">Tempo total registrado: {data.sessions.reduce((s,x)=>s+x.actual_minutes,0)} minutos.</p>
  </>}</>;
}
