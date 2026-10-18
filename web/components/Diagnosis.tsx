import type { StudyData } from '../lib/data';
import { diagnose,type DiagnosticAction } from '../lib/diagnosis';
export function Diagnosis({data,now,onAction,disabled=false}:{data:StudyData;now:Date;onAction:(action:DiagnosticAction)=>void;disabled?:boolean}) {
  const d=diagnose(data,now);
  const date=(s:string)=>s.split('-').reverse().join('/');
  return <section aria-labelledby="diagnosis-title" className="diagnosis"><h2 id="diagnosis-title">Seu diagnóstico de estudo</h2>
    <p className="muted">Um próximo passo pequeno, a partir do que você registrou.</p>
    <p className="caption">Últimos 14 dias: {date(d.start)} a {date(d.end)} · fuso {data.profile?.timezone??'America/Bahia'}.</p>
    <div className="stats"><div><span>Frequência registrada</span><strong>{d.days}/14 dias</strong><p>{d.count} sessão(ões) com estudo · {d.minutes} min</p></div><div><span>Planejado × realizado</span><strong>{d.plannedCount?`${d.actualPlannedMinutes} / ${d.plannedMinutes} min`:'—'}</strong><p>{d.plannedCount?`Realizado / planejado em ${d.plannedCount} sessões com duração prevista registrada.`:'Ainda sem sessões com duração prevista registrada.'}</p></div><div><span>Sessões parciais</span><strong>{d.partial}</strong><p>Parcial não significa interrupção nem fracasso; o tempo estudado conta.</p></div></div>
    <p className="caption">Dias sem registro não significam dias sem estudo. A comparação de duração considera apenas sessões registradas com previsão; não representa todo o cronograma.</p>
    <div className="diagnosis-findings">{d.findings.map((f,i)=><article className="surface diagnostic-card" key={f.id}><p className="eyebrow">PRÓXIMO PASSO {i+1}</p><h3>{f.title}</h3><p>{f.evidence}</p><p><strong>Experimento:</strong> {f.suggestion}</p><button className="secondary" disabled={disabled} onClick={()=>onAction(f.action)}>{f.label}</button></article>)}</div>
    {d.additional>0&&<p className="caption">Há outros sinais nos registros. Mostramos até três ações por vez para manter o foco; a ordem dos conteúdos segue seu cadastro.</p>}
    {disabled&&<p role="status" className="notice">Conclua ou encerre a sessão em andamento antes de iniciar outra ação.</p>}
    <details className="diagnosis-method"><summary>Como este diagnóstico é feito?</summary><p className="small">Regras locais sobre os últimos 14 dias, sem enviar dados à IA. Sinais por competência: dificuldade nas duas últimas recuperações; menos de 70% de acertos em pelo menos 10 questões e dois registros; ou dois erros abertos com a mesma classificação/descrição. A comparação entre blocos exige ao menos oito sessões com previsão, três em cada grupo e diferença de conclusão de pelo menos 25 pontos percentuais. Esses critérios indicam oportunidades de prática, não um diagnóstico clínico nem uma medida definitiva de domínio. Nenhuma alteração acontece automaticamente.</p></details>
  </section>;
}
