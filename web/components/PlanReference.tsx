import { useEffect,useState } from 'react';
import type { StudyData } from '../lib/data';
import type { Plan } from '../../src/engine/planner';
import { captureReference,readReferences,type PlanReference as Reference } from '../lib/plan-reference';
import { localDay } from '../lib/planning';
export function PlanReference({data,plan,now}:{data:StudyData;plan:Plan;now:Date}) {
  const [reference,setReference]=useState<Reference|null>(null),[failed,setFailed]=useState(false);
  const timezone=data.profile?.timezone??'America/Bahia',day=localDay(now,timezone).toString();
  useEffect(()=>{setReference(null);setFailed(false);if(!data.userId)return;try{const existing=readReferences(data.userId).find(r=>r.day===day&&r.timezone===timezone);if(existing)setReference(existing);else if(plan.items.length)setReference(captureReference(data.userId,plan,data,now));}catch{setFailed(true);}},[data.userId,day,timezone,plan,data,now]);
  return <p className="caption plan-reference" role="status">{failed?'Não foi possível guardar a referência do plano neste navegador.':reference?`Referência de hoje guardada: ${reference.plannedMinutes} min a partir de ${new Date(reference.capturedAt).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit',timeZone:timezone})}. Recalcular não altera essa referência.`:'A primeira versão do plano de hoje com atividades será guardada como referência.'} Só neste navegador; consulte em Progresso → Diagnóstico. Não é uma meta obrigatória.</p>;
}
