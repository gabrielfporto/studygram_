import { useState, type FormEvent } from 'react';
import { supabase } from '../lib/client';
import { learningState } from '../../src/engine/memory';
import type { StudyData } from '../lib/data';

export function Contents({ data, onSaved }: { data: StudyData; onSaved: () => Promise<void> }) {
  const [search, setSearch] = useState(''); const [adding, setAdding] = useState(false);
  const [area, setArea] = useState(''); const [topic, setTopic] = useState(''); const [titles, setTitles] = useState('');
  const [importance, setImportance] = useState('0.65'); const [context, setContext] = useState('');
  const [message, setMessage] = useState(''); const [busy, setBusy] = useState(false);
  const list = data.competencies.filter(c => !c.archived && `${c.area} ${c.topic} ${c.title}`.toLocaleLowerCase('pt-BR').includes(search.toLocaleLowerCase('pt-BR')));
  async function add(e: FormEvent) {
    e.preventDefault(); setBusy(true); setMessage('');
    try {
      const { error } = await supabase.rpc('import_topic', { p_area: area, p_topic: topic,
        p_titles: [...new Set(titles.split('\n').map(t => t.trim()).filter(Boolean))], p_importance: Number(importance), p_context: context || null });
      if (error) throw error;
      await onSaved(); setAdding(false); setTopic(''); setTitles(''); setMessage('Conteúdo adicionado ao seu plano.');
    } catch { setMessage('Não foi possível adicionar. Verifique os campos; use até 30 competências por tema.'); }
    finally { setBusy(false); }
  }
  async function archive(id: string) {
    setBusy(true); setMessage('');
    try { const { error } = await supabase.from('competencies').update({ archived: true }).eq('id', id); if (error) throw error; await onSaved(); setMessage('Competência arquivada. O histórico foi preservado.'); }
    catch { setMessage('Não foi possível arquivar a competência.'); } finally { setBusy(false); }
  }
  return <><header className="page-header"><div><p className="eyebrow">SEU MAPA DE APRENDIZAGEM</p><h1>Aprender por partes.</h1><p className="muted">Áreas, temas e competências. Cada parte tem seu próprio ritmo.</p></div><button className="primary" onClick={() => setAdding(!adding)}>{adding ? 'Fechar formulário' : '+ Adicionar tema'}</button></header>
    {adding && <form className="surface content-form" onSubmit={add}><h2>Adicionar tema</h2><div className="form-grid"><label>Área<input required maxLength={200} placeholder="Neurologia" value={area} onChange={e => setArea(e.target.value)}/></label><label>Tema<input required maxLength={200} placeholder="AVC isquêmico" value={topic} onChange={e => setTopic(e.target.value)}/></label></div><label>Competências — uma por linha<textarea required rows={4} placeholder={'Reconhecimento clínico\nDiagnóstico diferencial\nManejo inicial'} value={titles} onChange={e => setTitles(e.target.value)}/></label><div className="form-grid"><label>Importância<select value={importance} onChange={e => setImportance(e.target.value)}><option value="0.95">Alta</option><option value="0.65">Regular</option><option value="0.3">Baixa</option></select></label><label>Contexto relacionado<select value={context} onChange={e => setContext(e.target.value)}><option value="">Sem contexto específico</option>{data.contexts.map(c => <option value={c.id} key={c.id}>{c.title}</option>)}</select></label></div><p className="caption">Revise os nomes antes de salvar. O formulário adicionará exatamente as competências listadas.</p><button className="primary" disabled={busy}>{busy ? 'Salvando…' : 'Confirmar e adicionar'}</button></form>}
    {message && <p role="status" className="notice">{message}</p>}
    <label className="search-label">Buscar no seu conteúdo<input type="search" placeholder="Área, tema ou competência" value={search} onChange={e => setSearch(e.target.value)}/></label>
    {!list.length && <div className="empty"><h2>{search ? 'Nenhum resultado' : 'Seu mapa começa com um tema.'}</h2><p className="muted">{search ? 'Tente outro termo.' : 'Adicione algo que você está estudando. Não é preciso organizar tudo agora.'}</p></div>}
    {[...new Set(list.map(c => c.area))].map(area => <section className="area-section" key={area}><h2>{area}</h2>{[...new Set(list.filter(c => c.area === area).map(c => c.topicId))].map(topicId => <div className="topic-group" key={topicId}><h3>{list.find(c => c.topicId === topicId)!.topic}</h3>{list.filter(c => c.topicId === topicId).map(c => <div className="study-row" key={c.id}><div><strong>{c.title}</strong><p>{learningState(c.card, c.evidence)}</p></div><button className="text-button" disabled={busy} onClick={() => archive(c.id)} aria-label={`Arquivar ${c.title}`}>Arquivar</button></div>)}</div>)}</section>)}
  </>;
}
