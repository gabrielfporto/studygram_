import type { StudyData } from '../lib/data';
import { retention, learningState } from '../../src/engine/memory';
export function Progress({ data, now }: { data: StudyData; now: Date }) {
  const active = data.competencies.filter(c => !c.archived);
  const studied = active.filter(c => c.card.reps > 0);
  const mean = studied.length ? studied.reduce((s,c) => s + retention(c.card, now)!,0)/studied.length : null;
  const risk = studied.filter(c => retention(c.card, now)! < 0.9);
  const total = data.questions.reduce((s,q) => s + q.total,0); const correct = data.questions.reduce((s,q) => s + q.correct,0);
  return <><header className="page-header"><div><p className="eyebrow">EVIDÊNCIA, NÃO PRESSÃO</p><h1>O que está ficando com você.</h1><p className="muted">Acompanhe o aprendizado, além do tempo de estudo.</p></div></header>
    <div className="stats"><div><span>Retenção estimada</span><strong>{mean === null ? '—' : `${Math.round(mean*100)}%`}</strong><p>{studied.length ? `Em ${studied.length} competências com recuperação` : 'Registre uma recuperação para começar'}</p></div><div><span>Acertos em questões</span><strong>{total ? `${Math.round(correct/total*100)}%` : '—'}</strong><p>{total ? `${correct} acertos em ${total} tentativas` : 'Ainda sem evidência objetiva'}</p></div><div><span>Precisam de atenção</span><strong>{risk.length}</strong><p>Abaixo da meta de 90% de retenção estimada</p></div></div>
    <p className="caption">Estimativas do FSRS, não uma garantia de domínio. {active.length-studied.length} competências ainda não têm evidência de recuperação.</p>
    <section className="area-section"><h2>Por área</h2>{[...new Set(active.map(c => c.area))].map(area => { const comps = active.filter(c => c.area === area); const learned = comps.filter(c => c.card.reps>0).length; return <div className="progress-row" key={area}><div><strong>{area}</strong><span className="caption">{learned}/{comps.length} competências praticadas</span></div><progress max={comps.length} value={learned} aria-label={`Cobertura de prática em ${area}`}/></div>; })}</section>
    <section className="area-section"><h2>Competências em atenção</h2>{risk.length ? risk.slice(0,8).map(c => <div className="study-row" key={c.id}><div><strong>{c.topic} · {c.title}</strong><p>{learningState(c.card,c.evidence)}</p></div><span>{Math.round(retention(c.card,now)!*100)}%</span></div>) : <p className="muted">{studied.length ? 'Nenhuma competência avaliada abaixo da meta neste momento.' : 'Os indicadores aparecerão conforme você registrar suas práticas.'}</p>}</section>
    <p className="caption">Tempo total registrado: {data.sessions.reduce((s,x)=>s+x.actual_minutes,0)} minutos.</p>
  </>;
}
