import { useEffect, useRef, useState } from 'react';
import type { Competency } from '../../src/domain/model';
import type { SessionInput } from '../../src/application/session';
import { instructions } from '../../src/engine/study-cycle';
import { elapsedSeconds, togglePause, type StudyDraft } from '../lib/active-study';
import { SessionForm } from './SessionForm';
import { safeMaterialUrl } from '../lib/material';
import { LearningEvidence } from './LearningEvidence';

export function GuidedSession({ draft, competency, onChange, onSave, onHide, onDiscard,userId }: {
  draft:StudyDraft; competency:Competency; onChange:(draft:StudyDraft)=>void;
  onSave:(input:SessionInput)=>Promise<void>; onHide:()=>void; onDiscard:()=>void;userId?:string;
}) {
  const dialog=useRef<HTMLDialogElement>(null); const [now,setNow]=useState(Date.now()); const [record,setRecord]=useState(false);
  const [continueAnyway,setContinueAnyway]=useState(false);
  const [continuing,setContinuing]=useState(false);
  useEffect(()=>{ if(!record) dialog.current?.showModal(); },[record]);
  useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(timer);},[]);
  const elapsed=elapsedSeconds(draft,now); const guide=instructions[draft.method];
  const material=safeMaterialUrl(competency.materialUrl); const remaining=Math.max(0,draft.minutes*60-elapsed);
  if(record) return <SessionForm userId={userId} competencies={[competency]} initialId={competency.id} minutes={draft.minutes} method={draft.method}
    sessionKey={draft.id} startedAt={draft.startedAt} locked actualMinutes={Math.max(1,Math.min(720,Math.round(elapsed/60)))}
    initialStatus="partial" onSave={onSave} onClose={()=>setRecord(false)}/>;
  return <dialog ref={dialog} className="guided-session" onCancel={e=>{e.preventDefault();onHide();}} aria-labelledby="guided-title">
    <div className="dialog-head"><div><p className="eyebrow">{draft.small?'SÓ UM PRIMEIRO PASSO':'UMA COISA POR VEZ'}</p><h2 id="guided-title">{competency.title}</h2></div><button className="text-button" onClick={onHide}>Minimizar</button></div>
    <h3>{guide.title}</h3><p className="muted">{guide.goal}</p>
    {draft.small && <p className="notice">Cinco minutos são uma porta de entrada, não uma promessa de aprender o tema. Delimite uma pergunta; você pode continuar no mesmo assunto.</p>}
    <p className="caption">Objetivo do bloco: escolha uma pergunta, trecho ou decisão que caiba nesta prática. A duração é estimativa; terminar o timer não comprova aprendizagem.</p>
    <label>O que vou conseguir explicar ou aplicar? (opcional)<input maxLength={300} placeholder="Ex.: explicar a sequência do ABCDE e justificar uma decisão." value={draft.objective??''} onChange={e=>onChange({...draft,objective:e.target.value})}/></label>
    <ol className="session-steps">{guide.steps.map((step,index)=><li key={step}><span>{index+1}</span>{step}</li>)}</ol>
    {material?<a className="material-open" href={material} target="_blank" rel="noopener noreferrer">Abrir meu material ↗</a>:<p className="caption">Use seu material habitual. Depois, você pode vincular o link em Conteúdos.</p>}
    <p className="caption">{guide.finish}</p>
    <div className="study-clock"><span className="eyebrow">{draft.pausedAt!==null?'PAUSADO':remaining?'TEMPO RESTANTE':'BLOCO ENCERRADO'}</span><strong aria-label="Tempo restante">{String(Math.floor(remaining/60)).padStart(2,'0')}:{String(remaining%60).padStart(2,'0')}</strong><button className="secondary" onClick={()=>{const time=Date.now();setNow(time);onChange(togglePause(draft,time));}}>{draft.pausedAt!==null?'Retomar':'Pausar'}</button></div>
    {!remaining && <div className="notice"><p>{continuing?'Continue no mesmo assunto, sem pressa para trocar. O tempo efetivo continua sendo contado.':'A estimativa terminou. Confira seu objetivo: se ainda houver lacunas, consulte o material e tente explicar ou aplicar novamente.'}</p><button className="secondary" onClick={()=>{const time=Date.now();setNow(time);if(draft.pausedAt!==null)onChange(togglePause(draft,time));setContinuing(true);}}>Continuar neste assunto</button></div>}
    <button className="primary full" onClick={()=>{const time=Date.now();setNow(time);if(draft.pausedAt===null)onChange(togglePause(draft,time));dialog.current?.close();setRecord(true);}}>Registrar como foi →</button>
    <p className="caption">O timer é um apoio. Nada é marcado como concluído automaticamente. A sessão pode ser retomada neste navegador.</p>
    <LearningEvidence/>
    {continueAnyway?<div className="notice"><p>O tempo deste bloco não será registrado. Seu histórico salvo continua disponível.</p><button className="secondary" onClick={onDiscard}>Encerrar sem registrar</button><button className="text-button" onClick={()=>setContinueAnyway(false)}>Continuar sessão</button></div>:<button className="text-button" onClick={()=>setContinueAnyway(true)}>Quero encerrar sem registrar</button>}
  </dialog>;
}
