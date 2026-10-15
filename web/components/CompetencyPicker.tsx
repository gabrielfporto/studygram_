import { useId, useState } from 'react';
import type { Competency } from '../../src/domain/model';

export const searchText=(value:string)=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR');
export function CompetencyPicker({competencies,value,onChange,disabled=false}:{competencies:Competency[];value:string;onChange:(id:string)=>void;disabled?:boolean}) {
  const [query,setQuery]=useState('');const [choosing,setChoosing]=useState(!value);const id=useId();
  const current=competencies.find(c=>c.id===value);
  const terms=searchText(query).trim().split(/\s+/).filter(Boolean);
  const matches=competencies.filter(c=>!c.archived&&terms.every(t=>searchText(`${c.area} ${c.topic} ${c.title}`).includes(t)));
  return <div className="competency-picker"><p className="field-label">Competência</p>
    {current&&<div className="picked-competency"><div><strong>{current.topic} · {current.title}</strong><p className="caption">{current.area}</p></div>{!disabled&&<button type="button" className="text-button" aria-expanded={choosing} onClick={()=>setChoosing(!choosing)}>Trocar competência</button>}</div>}
    {!disabled&&choosing&&<><label htmlFor={id}>Buscar área, tema ou competência<input id={id} type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Ex.: hanseníase, infectologia…" autoComplete="off"/></label>
      <p className="caption" role="status">{matches.length} resultado(s){matches.length>20?' · refine a busca para encontrar outros':''}</p>
      <div className="competency-results">{matches.slice(0,20).map(c=><button type="button" key={c.id} aria-label={`${c.topic} · ${c.title} ${c.area}`} aria-pressed={value===c.id} onClick={()=>{onChange(c.id);setChoosing(false);setQuery('');}}><strong>{c.topic} · {c.title}</strong><span>{c.area}</span></button>)}{!matches.length&&<p className="muted">Nenhuma competência encontrada. Tente outro termo.</p>}</div></>}
  </div>;
}
