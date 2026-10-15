import { useState } from 'react';
import type { Competency } from '../../src/domain/model';
import { safeMaterialUrl } from '../lib/material';
import { supabase } from '../lib/client';
export function MaterialLink({competency,onSaved}:{competency:Competency;onSaved:()=>Promise<void>}) {
  const [edit,setEdit]=useState(false);const [url,setUrl]=useState(competency.materialUrl??'');const [error,setError]=useState('');const [busy,setBusy]=useState(false);
  const link=safeMaterialUrl(competency.materialUrl);
  return <div className="material-link">{link && <a href={link} target="_blank" rel="noopener noreferrer">Abrir material ↗</a>}<button className="text-button" onClick={()=>setEdit(!edit)}>{edit?'Fechar link':link?'Editar material':'Vincular material'}</button>
    {edit && <form onSubmit={async e=>{e.preventDefault();setError('');const safe=safeMaterialUrl(url);if(url.trim()&&!safe){setError('Use um link http ou https válido, sem senha no endereço.');return;}setBusy(true);try{const {error}=await supabase.from('competencies').update({resource_url:safe}).eq('id',competency.id);if(error)throw error;await onSaved();setEdit(false);}catch{setError('Não foi possível salvar o link. Tente novamente.');}finally{setBusy(false);}}}><label>Link do material de {competency.title}<input type="url" maxLength={2048} value={url} onChange={e=>setUrl(e.target.value)} placeholder="https://…"/></label><p className="caption">Pode ser uma página do Notion, aula, PDF ou banco de questões. Deixe vazio para remover o vínculo.</p><button className="secondary" disabled={busy}>{busy?'Salvando…':'Salvar link'}</button>{error && <p role="alert">{error}</p>}</form>}
  </div>;
}
