import { useState,type FormEvent } from 'react';
import type { Competency } from '../../src/domain/model';
import { supabase } from '../lib/client';

export function CompetencyEditor({competency:c,onSaved}:{competency:Competency;onSaved:()=>Promise<void>}) {
  const [open,setOpen]=useState(false);const [title,setTitle]=useState(c.title);const [importance,setImportance]=useState(c.importance);
  const [effort,setEffort]=useState(c.effort);const [minutes,setMinutes]=useState(c.reviewMinutes);const [busy,setBusy]=useState(false);const [message,setMessage]=useState('');
  async function save(e:FormEvent){e.preventDefault();setBusy(true);setMessage('');try{if(!title.trim())throw new Error('Informe o nome da competência.');const {error}=await supabase.from('competencies').update({title:title.trim(),importance,effort,review_minutes:minutes}).eq('id',c.id);if(error)throw error;await onSaved();setMessage('Competência atualizada. Histórico e memória preservados.');setOpen(false);}catch(e){setMessage(e instanceof Error?e.message:'Não foi possível atualizar.');}finally{setBusy(false);}}
  return <div className="competency-editor"><button type="button" className="text-button" aria-expanded={open} onClick={()=>setOpen(!open)}>Ajustar competência</button>{open&&<form onSubmit={save}>
    <label>Nome da competência<input required maxLength={200} value={title} onChange={e=>setTitle(e.target.value)}/></label>
    <label>Importância<select value={importance} onChange={e=>setImportance(Number(e.target.value))}><option value={c.importance}>Atual ({Math.round(c.importance*100)}%)</option><option value={.25}>Baixa</option><option value={.5}>Média</option><option value={.75}>Alta</option><option value={1}>Essencial</option></select></label>
    <div className="form-grid"><label>Esforço da competência<select value={effort} onChange={e=>setEffort(e.target.value as typeof effort)}><option value="low">Leve</option><option value="medium">Moderado</option><option value="high">Completo</option></select></label><label>Revisão completa (min)<input type="number" required min={10} max={45} value={minutes} onChange={e=>setMinutes(Number(e.target.value))}/></label></div>
    <button className="secondary" disabled={busy}>{busy?'Salvando…':'Salvar ajustes'}</button></form>}{message&&<p className="caption" role="status">{message}</p>}</div>;
}
