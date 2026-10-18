import type { StudyData } from './data';
import { localDay } from './planning';

export type DiagnosticAction = {kind:'recall';competencyId:string}|{kind:'routine'}|{kind:'register'};
export interface Finding {id:string;title:string;evidence:string;suggestion:string;label:string;action:DiagnosticAction}
export function diagnose(data:StudyData,now:Date) {
  const timezone=data.profile?.timezone??'America/Bahia';
  const today=localDay(now,timezone),start=today.subtract({days:13});
  const within=(at:string)=>{const time=Date.parse(at);return Number.isFinite(time)&&time<=now.getTime()&&localDay(new Date(time),timezone).toString()>=start.toString();};
  const sessions=data.sessions.filter(s=>within(s.ended_at??s.started_at));
  const practiced=sessions.filter(s=>s.status!=='missed'&&s.actual_minutes>0);
  const questions=data.questions.filter(q=>within(q.occurred_at)&&q.total>0);
  const findings:Finding[]=[];
  for(const c of data.competencies.filter(c=>!c.archived)) {
    // Apenas recuperações efetivas, nunca feedback de leitura ou ausência.
    const recalls=practiced.filter(s=>s.competency_id===c.id&&['recall','case','explanation','questions'].includes(s.method)&&s.feedback!==null&&
      (s.method!=='questions'||questions.some(q=>q.session_id===s.id))).sort((a,b)=>Date.parse(b.ended_at??b.started_at)-Date.parse(a.ended_at??a.started_at));
    const qs=questions.filter(q=>q.competency_id===c.id),total=qs.reduce((n,q)=>n+q.total,0),correct=qs.reduce((n,q)=>n+q.correct,0);
    const errors=(data.mistakes??[]).filter(m=>m.competency_id===c.id&&!m.resolved_at&&within(m.occurred_at));
    const groups=new Map<string,number>();
    for(const m of errors){const key=(m.classification_key??m.description).trim().toLocaleLowerCase('pt-BR');if(key)groups.set(key,(groups.get(key)??0)+1);}
    const recurring=Math.max(0,...groups.values());
    const evidence:string[]=[];
    if(recalls.length>=2&&recalls.slice(0,2).every(s=>s.feedback!<=2))evidence.push('Nas duas últimas práticas de recuperação registradas, você marcou dificuldade para lembrar.');
    if(qs.length>=2&&total>=10&&correct/total<0.7)evidence.push(`${correct} acertos em ${total} questões (${Math.round(correct/total*100)}%), distribuídas em ${qs.length} registros. A dificuldade das questões pode variar.`);
    if(recurring>=2)evidence.push(`${recurring} erros ainda abertos com a mesma classificação ou descrição.`);
    if(evidence.length)findings.push({id:c.id,title:`Vale revisar: ${c.topic} · ${c.title}`,evidence:evidence.join(' '),suggestion:'Experimente 5 minutos: explique o que lembra, consulte seu material e confira uma dúvida.',label:'Iniciar recuperação de 5 min',action:{kind:'recall',competencyId:c.id}});
  }
  const planned=sessions.filter(s=>s.planned_minutes!=null&&s.planned_minutes>0);
  const short=planned.filter(s=>s.planned_minutes!<=15),long=planned.filter(s=>s.planned_minutes!>15);
  const completed=(ss:typeof sessions)=>ss.filter(s=>s.status==='completed').length;
  if(short.length>=3&&long.length>=3&&planned.length>=8&&completed(short)/short.length-completed(long)/long.length>=0.25) {
    findings.push({id:'duration',title:'Blocos menores podem facilitar o começo',evidence:`Você concluiu ${completed(short)} de ${short.length} sessões planejadas de até 15 minutos e ${completed(long)} de ${long.length} maiores. Isso é uma associação nos registros, não uma explicação da causa.`,suggestion:'Experimente blocos de 10 minutos na próxima semana. Revise a duração em Plano → Rotina antes de salvar.',label:'Revisar minha rotina',action:{kind:'routine'}});
  }
  if(!findings.length)findings.push({id:'evidence',title:practiced.length?'Ainda não há um padrão suficiente para sugerir ajustes':'Vamos começar por um registro',evidence:practiced.length?`${practiced.length} sessão(ões) com estudo nesta janela. Os critérios de dificuldade ou comparação ainda não foram atingidos; isso não comprova domínio.`:'Não há sessões com tempo estudado registradas nesta janela. Isso não significa que você não estudou.',suggestion:'Registre uma prática com duração e resultado. Aos poucos, o diagnóstico terá evidências para apontar ajustes.',label:'Registrar um estudo',action:{kind:'register'}});
  return {start:start.toString(),end:today.toString(),days:new Set(practiced.map(s=>localDay(new Date(s.ended_at??s.started_at),timezone).toString())).size,
    count:practiced.length,minutes:practiced.reduce((n,s)=>n+s.actual_minutes,0),
    plannedMinutes:planned.reduce((n,s)=>n+s.planned_minutes!,0),actualPlannedMinutes:planned.reduce((n,s)=>n+s.actual_minutes,0),plannedCount:planned.length,
    partial:practiced.filter(s=>s.status==='partial').length,findings:findings.slice(0,3),additional:Math.max(0,findings.length-3)};
}
