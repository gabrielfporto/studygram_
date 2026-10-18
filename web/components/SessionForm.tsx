import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { Competency } from '../../src/domain/model';
import type { SessionInput } from '../../src/application/session';
import { Temporal } from '@js-temporal/polyfill';
import type { LogProposal } from '../../src/application/ai';
import { CompetencyPicker } from './CompetencyPicker';
import { useLocalDraft,sessionDraftSchema } from '../lib/local-draft';
import { DraftNotice } from './DraftNotice';

export function SessionForm({ competencies, initialId, minutes, method, onSave, onClose, sessionKey, actualMinutes, initialStatus, locked=false, startedAt,prefill,userId,timezone=Intl.DateTimeFormat().resolvedOptions().timeZone }: {
  competencies: Competency[]; initialId: string; minutes: number; method: SessionInput['method'];
  onSave: (input: SessionInput) => Promise<void>; onClose: () => void;
  prefill?:LogProposal; userId?:string|undefined; timezone?:string; sessionKey?:string; actualMinutes?:number; initialStatus?:SessionInput['status']; locked?:boolean; startedAt?:string;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const draft=useLocalDraft(prefill?undefined:userId,locked?`session:${sessionKey}`:'session',sessionDraftSchema,()=>sessionDraftSchema.parse({id:sessionKey??crypto.randomUUID(),selected:initialId,duration:actualMinutes??(prefill?prefill.minutes??0:minutes),studyMethod:prefill?prefill.method??'':method,status:initialStatus??'completed',feedback:locked||prefill?0:3,total:prefill?.total??0,correct:prefill?prefill.correct??-1:0,notes:prefill?.notes??'',endedLocal:Temporal.Now.instant().toZonedDateTimeISO(timezone).toPlainDateTime().toString({smallestUnit:'minute'}),timezone}));
  const {id,selected,duration,studyMethod,status,feedback,total,correct,notes,endedLocal}=draft.value;
  const setSelected=(selected:string)=>draft.update({selected}),setDuration=(duration:number)=>draft.update({duration}),setMethod=(studyMethod:typeof draft.value.studyMethod)=>draft.update({studyMethod}),setStatus=(status:typeof draft.value.status)=>draft.update({status}),setFeedback=(feedback:number)=>draft.update({feedback}),setTotal=(total:number)=>draft.update({total}),setCorrect=(correct:number)=>draft.update({correct}),setNotes=(notes:string)=>draft.update({notes}),setEndedLocal=(endedLocal:string)=>draft.update({endedLocal});
  const [error,setError]=useState(''),[busy,setBusy]=useState(false);
  useEffect(() => { dialog.current?.showModal(); }, []);
  async function submit(e: FormEvent) {
    e.preventDefault(); setBusy(true); setError('');
    const actual = status === 'missed' ? 0 : duration;
    try {
      const endedAt=locked?new Date():new Date(Temporal.PlainDateTime.from(endedLocal).toZonedDateTime(draft.value.timezone).epochMilliseconds);
      if(endedAt.getTime()>Date.now()+60000)throw new Error('O término não pode estar no futuro.');
      if(status!=='missed'&&total>0&&correct<0&&!['reading','priming'].includes(studyMethod))throw new Error('Informe quantas questões acertou.');
      if(!studyMethod)throw new Error('Escolha o método de estudo.');
      if(!selected)throw new Error('Escolha a competência que você estudou.');
      if (status!=='missed' && !['reading','priming'].includes(studyMethod) && (studyMethod!=='questions'||total>0) && !feedback) throw new Error('Informe como foi lembrar antes de salvar.');
      await onSave({ competencyId: selected, idempotencyKey: id, actualMinutes: actual, plannedMinutes: locked?minutes:null,
        startedAt: startedAt ?? new Date(endedAt.getTime() - actual * 60000).toISOString(), endedAt: endedAt.toISOString(),
        method: studyMethod, status, feedback:feedback || 3, total: status === 'missed' || ['reading','priming'].includes(studyMethod) ? 0 : total,
        correct: status === 'missed' || ['reading','priming'].includes(studyMethod) ? 0 : Math.max(0,correct), notes });
      draft.clear();onClose();
    } catch (err) { setError(err instanceof Error ? err.message : 'Não foi possível salvar. Tente novamente.'); }
    finally { setBusy(false); }
  }
  return <dialog ref={dialog} onCancel={e => { if (busy) e.preventDefault(); else onClose(); }} aria-labelledby="session-title">
    <div className="dialog-head"><div><p className="eyebrow">REGISTRAR PRÁTICA</p><h2 id="session-title">Como foi o estudo?</h2></div><button disabled={busy} className="secondary" onClick={onClose}>Fechar</button></div>
    <p className="muted">Estude no seu material e registre o resultado aqui. Não é necessário manter esta janela aberta.</p>
    {userId&&!prefill&&<DraftNotice disabled={busy} saved={draft.saved} failed={draft.failed} onDiscard={()=>{if(draft.clear())onClose();}}/>}
    {!locked&&<p className="caption">Horário do registro: {draft.value.timezone}. Confira a data ao retomar um rascunho.</p>}
    {prefill&&<p className="notice">Sugestão da IA: confira competência, duração, data e acertos. Campos não identificados precisam ser preenchidos.{prefill.dateHint?` Data mencionada: ${prefill.dateHint}. Ajuste o término abaixo.`:''}</p>}
    {locked && <p className="caption">Confira o tempo efetivo. Escolha “Concluí esta etapa” apenas se terminou o objetivo; o timer não conclui a etapa por você.</p>}
    <form onSubmit={submit}><fieldset disabled={busy} className="form-fields"><CompetencyPicker competencies={competencies} value={selected} onChange={setSelected} disabled={locked||busy}/>
      {!locked&&<label>Quando terminou o estudo?<input type="datetime-local" required value={endedLocal} onChange={e=>setEndedLocal(e.target.value)}/></label>}
      <div className="form-grid"><label>Resultado<select value={status} onChange={e => setStatus(e.target.value as typeof status)}><option value="completed">Concluí esta etapa</option><option value="partial">Avancei, vou retomar</option><option value="missed">Não realizado</option></select></label>
      <label>Tempo real (min)<input type="number" min={1} max={720} required disabled={status === 'missed'} value={duration} onChange={e => setDuration(Number(e.target.value))}/></label></div>
      <label>Método<select required disabled={locked || busy} value={studyMethod} onChange={e => setMethod(e.target.value as typeof studyMethod)}>{prefill&&!prefill.method&&<option value="" disabled>Escolha o método</option>}<option value="priming">Preparação / priming</option><option value="new">Conteúdo novo + recuperação</option><option value="reading">Leitura / aula</option><option value="recall">Recuperação ativa</option><option value="questions">Questões</option><option value="case">Caso clínico</option><option value="explanation">Explicação sem consulta</option></select></label>
      {status !== 'missed' && !['reading','priming'].includes(studyMethod) && <><div className="form-grid"><label>Questões / tentativas<input type="number" min={studyMethod==='questions' && status==='completed'?1:0} max={1000} value={total} onChange={e => setTotal(Number(e.target.value))}/></label><label>Acertos<input type="number" required={total>0} min={0} max={total} value={correct<0?'':correct} onChange={e => setCorrect(e.target.value===''?-1:Number(e.target.value))}/></label></div>
        {(studyMethod!=='questions'||total>0) && <label>Como foi lembrar?<select value={feedback} onChange={e => setFeedback(Number(e.target.value))}>{(locked||prefill) && <option value={0} disabled>Escolha como foi</option>}<option value={1}>Não lembrei</option><option value={2}>Lembrei parcialmente</option><option value={3}>Lembrei</option><option value={4}>Foi fácil</option></select></label>}</>}
      {studyMethod==='questions' && total===0 && <p className="caption">Sem tentativas, você pode registrar tempo parcial. A memória não será atualizada.</p>}
      {studyMethod === 'reading' && <p className="caption">Leitura registra tempo; a memória só é atualizada com recuperação ativa.</p>}
      {studyMethod === 'priming' && <p className="caption">Preparação registra o primeiro contato e o tempo. Não altera sua memória estimada.</p>}
      {status==='partial' && <p className="caption">O tempo conta. A etapa continua disponível para retomar.</p>}
      <label>Onde parou ou o que precisa retomar? (opcional)<textarea maxLength={4000} rows={2} placeholder="Ex.: parei na página 12; quero revisar o diagnóstico diferencial." value={notes} onChange={e => setNotes(e.target.value)}/></label>
      {error && <p className="notice error" role="alert">{error}</p>}
      <button disabled={busy} className="primary full">{busy ? 'Salvando…' : 'Salvar e atualizar meu plano'}</button>
    </fieldset></form></dialog>;
}
