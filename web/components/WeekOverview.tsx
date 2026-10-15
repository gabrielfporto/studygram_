import type { StudyData } from '../lib/data';
import { availabilitySummary } from '../lib/availability-summary';
import { durationLabel } from '../lib/duration';

export function WeekOverview({data,now=new Date()}:{data:StudyData;now?:Date}) {
  const days=Array.from({length:7},(_,i)=>availabilitySummary(data,now,i));
  const time=(n:number)=>new Date(n).toLocaleTimeString('pt-BR',{timeZone:days[0]!.timezone,hour:'2-digit',minute:'2-digit'});
  return <section className="surface week-overview" aria-label="Disponibilidade dos próximos sete dias"><h2>O que cabe nos próximos 7 dias</h2>
    <p className="caption">Capacidade restante conforme a rotina salva, o tempo já estudado e a última consulta da agenda. As atividades são escolhidas novamente a cada dia.</p>
    {days.map((d,i)=><details key={d.date.toString()}><summary><span>{i===0?'Hoje':new Date(d.start).toLocaleDateString('pt-BR',{weekday:'short',day:'2-digit',month:'2-digit',timeZone:d.timezone})}</span><strong>{durationLabel(d.available)}</strong><span className="caption">{d.overlap?`${d.overlap} min de conflito com a rotina`:'Sem conflito com a rotina'}{data.calendar?.connections.some(c=>c.status==='connected')&&!d.covered?' · agenda sem cobertura':''}</span></summary>
      <p className="caption">{d.overlap?`A agenda ocupa ${d.overlap} min das janelas e reduz a capacidade em ${d.lost} min. O teto diário pode absorver parte do conflito.`:'Nenhum horário ocupado coincide com as janelas restantes. Por isso, sincronizar pode não mudar o plano.'}</p>
      <p className="small"><strong>Janelas livres:</strong> {d.free.length?d.free.map(w=>`${time(w.start)}–${time(w.end)}`).join(' · '):'nenhuma janela restante'}</p>
      <p className="small"><strong>Ocupado no Google:</strong> {d.busy.length?d.busy.map(w=>`${time(w.start)}–${time(w.end)}`).join(' · '):'nenhum intervalo retornado nesta consulta'}</p>
    </details>)}
  </section>;
}
