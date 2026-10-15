import { useState,type FormEvent } from 'react';
import { Temporal } from '@js-temporal/polyfill';
import type { StudyData } from '../lib/data';
import { dayWindow } from '../lib/planning';
import { supabase } from '../lib/client';
import { searchText } from './CompetencyPicker';

export function AcademicEvents({data,onSaved}:{data:StudyData;onSaved:()=>Promise<void>}) {
  const [kind,setKind]=useState('exam');const [id,setId]=useState(()=>crypto.randomUUID());const [title,setTitle]=useState('');
  const [start,setStart]=useState('');const [end,setEnd]=useState('');const [topics,setTopics]=useState<string[]>([]);const [query,setQuery]=useState('');
  const [busy,setBusy]=useState(false);const [message,setMessage]=useState('');const [undo,setUndo]=useState<{table:string;id:string}|null>(null);
  const timezone=data.profile?.timezone??'America/Bahia';
  const choices=[...new Map(data.competencies.filter(c=>!c.archived).map(c=>[c.topicId,{id:c.topicId,title:c.topic,area:c.area}])).values()];
  async function save(e:FormEvent) {e.preventDefault();setBusy(true);setMessage('');try{
    const ids=data.competencies.filter(c=>!c.archived&&topics.includes(c.topicId)).map(c=>c.id);if(!ids.length)throw new Error('Selecione ao menos um tema relacionado.');
    if(ids.length>1000)throw new Error('Selecione até 1.000 competências por evento.');
    if(kind==='rotation'&&end<start)throw new Error('O último dia deve ser igual ou posterior ao primeiro.');
    const {error}=await supabase.rpc('save_academic_event',{p_kind:kind,p_id:id,p_title:title,p_start:new Date(kind==='exam'?dayWindow(Temporal.PlainDate.from(start).add({days:1}),'00:00',timezone)-1:dayWindow(Temporal.PlainDate.from(start),'00:00',timezone)).toISOString(),p_end:kind==='rotation'?new Date(dayWindow(Temporal.PlainDate.from(end).add({days:1}),'00:00',timezone)).toISOString():null,p_competencies:ids});
    if(error)throw error;await onSaved();setId(crypto.randomUUID());setTitle('');setStart('');setEnd('');setTopics([]);setMessage('Evento salvo. Os temas relacionados já influenciam a prioridade.');
  }catch(e){setMessage(e instanceof Error?e.message:'Não foi possível salvar o evento. Tente novamente.');}finally{setBusy(false);}}
  async function archive(table:string,eventId:string,archived=true){setBusy(true);setMessage('');try{const {error}=await supabase.from(table).update({archived}).eq('id',eventId);if(error)throw error;await onSaved();setUndo(archived?{table,id:eventId}:null);setMessage(archived?'Evento retirado do plano. O histórico foi preservado.':'Evento restaurado.');}catch{setMessage('Não foi possível atualizar o evento.');}finally{setBusy(false);}}
  return <section className="surface academic-events"><h2>Provas e rodízios</h2><p className="caption">Relacione os temas para antecipar a preparação. Provas ganham peso nos 30 dias anteriores; próximos rodízios, nos 28 dias anteriores.</p>
    <details><summary>Adicionar prova ou rodízio</summary><form onSubmit={save}>
      <label>Tipo de evento<select value={kind} onChange={e=>setKind(e.target.value)}><option value="exam">Prova</option><option value="rotation">Rodízio</option></select></label>
      <label>{kind==='exam'?'Nome da prova':'Contexto do rodízio'}<input required maxLength={200} value={title} onChange={e=>setTitle(e.target.value)} list="academic-contexts"/></label><datalist id="academic-contexts">{data.contexts.map(c=><option key={c.id}>{c.title}</option>)}</datalist>
      <div className="form-grid"><label>{kind==='exam'?'Data da prova':'Primeiro dia'}<input type="date" required value={start} onChange={e=>setStart(e.target.value)}/></label>{kind==='rotation'&&<label>Último dia<input type="date" required min={start} value={end} onChange={e=>setEnd(e.target.value)}/></label>}</div>
      <label>Buscar temas relacionados<input type="search" value={query} onChange={e=>setQuery(e.target.value)}/></label><p className="caption">{topics.length} tema(s) selecionado(s)</p>
      <div className="topic-choices">{choices.filter(c=>searchText(`${c.area} ${c.title}`).includes(searchText(query))).map(c=><label className="calendar-check" key={c.id}><input type="checkbox" checked={topics.includes(c.id)} onChange={e=>setTopics(old=>e.target.checked?[...old,c.id]:old.filter(x=>x!==c.id))}/><span>{c.area} · {c.title}</span></label>)}</div>
      <button className="primary full" disabled={busy||!data.userId}>{busy?'Salvando…':'Salvar evento e recalcular'}</button>
    </form></details>
    {(data.exams??[]).map(e=><div className="event-row" key={e.id}><div><strong>{e.title}</strong><p className="caption">Prova · {e.at.toLocaleDateString('pt-BR',{timeZone:timezone})} · {e.competencyIds.length} competência(s)</p></div><button type="button" className="text-button" disabled={busy} onClick={()=>void archive('exams',e.id)}>Retirar do plano</button></div>)}
    {data.rotations.filter(r=>r.end>new Date()).map((r,i)=><div className="event-row" key={'id' in r?r.id:i}><div><strong>{data.contexts.find(c=>c.id===r.contextId)?.title??'Rodízio'}</strong><p className="caption">{r.start.toLocaleDateString('pt-BR',{timeZone:timezone})}–{new Date(r.end.getTime()-1).toLocaleDateString('pt-BR',{timeZone:timezone})}</p></div>{'id' in r&&<button type="button" className="text-button" disabled={busy} onClick={()=>void archive('rotations',r.id)}>Retirar do plano</button>}</div>)}
    {message&&<p role="status" className="notice">{message}</p>}{undo&&<button className="text-button" disabled={busy} onClick={()=>void archive(undo.table,undo.id,false)}>Desfazer retirada</button>}
  </section>;
}
