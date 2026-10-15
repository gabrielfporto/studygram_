import { useState,type FormEvent } from 'react';
import type { StudyData } from '../lib/data';
import { supabase } from '../lib/client';
import { CompetencyPicker,searchText } from './CompetencyPicker';

export function MistakeNotebook({data,onSaved}:{data:StudyData;onSaved:()=>Promise<void>}) {
  const [selected,setSelected]=useState('');const [description,setDescription]=useState('');const [id,setId]=useState(()=>crypto.randomUUID());
  const [busy,setBusy]=useState(false);const [message,setMessage]=useState('');const [query,setQuery]=useState('');
  const label=(cid:string)=>{const c=data.competencies.find(c=>c.id===cid);return c?`${c.topic} · ${c.title}`:'Competência arquivada';};
  async function save(e:FormEvent){e.preventDefault();setBusy(true);setMessage('');try{
    if(!selected)throw new Error('Escolha a competência relacionada.');if(!description.trim())throw new Error('Descreva o ponto que precisa retomar.');
    const {error}=await supabase.from('mistakes').upsert({id,user_id:data.userId,competency_id:selected,description:description.trim(),classification_key:searchText(description.trim()).replace(/\s+/g,' '),occurred_at:new Date().toISOString(),resolved_at:null},{onConflict:'id'});
    if(error)throw error;await onSaved();setId(crypto.randomUUID());setDescription('');setMessage('Erro registrado. A prioridade já considera este ponto de atenção.');
  }catch(e){setMessage(e instanceof Error?e.message:'Não foi possível salvar o erro.');}finally{setBusy(false);}}
  async function resolve(mid:string,resolved:boolean){setBusy(true);try{const {error}=await supabase.from('mistakes').update({resolved_at:resolved?new Date().toISOString():null}).eq('id',mid);if(error)throw error;await onSaved();setMessage(resolved?'Ponto marcado como revisado. Isso não altera o FSRS.':'Ponto reaberto para retomar.');}catch{setMessage('Não foi possível atualizar este ponto.');}finally{setBusy(false);}}
  const list=(data.mistakes??[]).filter(m=>searchText(`${label(m.competency_id)} ${m.description}`).includes(searchText(query))).sort((a,b)=>b.occurred_at.localeCompare(a.occurred_at));
  return <section className="area-section mistake-notebook"><h2>Erros para retomar</h2><p className="caption">Anote o que confundiu. Erros abertos recentes aumentam a prioridade; marcar como revisado não comprova retenção nem cria acertos.</p>
    <details><summary>Registrar um erro específico</summary><form onSubmit={save}><CompetencyPicker competencies={data.competencies} value={selected} onChange={setSelected}/><label>O que você errou ou confundiu?<textarea required maxLength={4000} value={description} onChange={e=>setDescription(e.target.value)} placeholder="Ex.: confundi os critérios de diagnóstico…"/></label><button className="primary" disabled={busy||!data.userId}>Salvar ponto de atenção</button></form></details>
    {!!data.mistakes?.length&&<label>Buscar nos erros<input type="search" value={query} onChange={e=>setQuery(e.target.value)}/></label>}
    {list.slice(0,30).map(m=><article className="mistake-row" key={m.id}><strong>{label(m.competency_id)}</strong><p>{m.description}</p><p className="caption">{new Date(m.occurred_at).toLocaleDateString('pt-BR',{timeZone:data.profile?.timezone??'America/Bahia'})} · {m.resolved_at?'Revisado':'Pendente'}</p><button className="text-button" disabled={busy} onClick={()=>void resolve(m.id,!m.resolved_at)}>{m.resolved_at?'Reabrir ponto':'Marcar como revisado'}</button></article>)}
    {!list.length&&<p className="muted">{query?'Nenhum erro encontrado.':'Ainda não há erros específicos registrados.'}</p>}{list.length>30&&<p className="caption">Mostrando 30 de {list.length}. Use a busca para encontrar outros pontos.</p>}{message&&<p role="status" className="notice">{message}</p>}
  </section>;
}
