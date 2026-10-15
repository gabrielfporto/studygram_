import { useMemo, useState } from 'react';
import { supabase } from '../lib/client';
import type { StudyData } from '../lib/data';
import { detectColumns, importFields, parseTable, previewImport, type ColumnMap, type ImportField } from '../../src/application/notion-import';

export function NotionImport({ data, onSaved, onClose }: { data: StudyData; onSaved: () => Promise<void>; onClose: () => void }) {
  const [text, setText] = useState(''); const [table, setTable] = useState<ReturnType<typeof parseTable> | null>(null);
  const [mapping, setMapping] = useState<ColumnMap | null>(null); const [preserveDate, setPreserveDate] = useState(false);
  const [excluded, setExcluded] = useState<Set<number>>(new Set()); const [busy, setBusy] = useState(false);
  const [error, setError] = useState(''); const [result, setResult] = useState<{ inserted: number; skipped: number } | null>(null);
  const rows = useMemo(() => table && mapping ? previewImport(table, mapping, preserveDate, data.competencies) : [], [table, mapping, preserveDate, data.competencies]);
  const selected = rows.filter(r => r.content && !r.duplicate && !excluded.has(r.line));
  const missing = mapping && (['area','topic','title'] as const).some(k => !mapping[k]);
  function prepare(value: string) {
    setError(''); setResult(null); setExcluded(new Set());
    try { const parsed = parseTable(value); setTable(parsed); setMapping(detectColumns(parsed.headers)); }
    catch (e) { setTable(null); setMapping(null); setError((e as Error).message); }
  }
  async function file(input: HTMLInputElement) {
    const chosen = input.files?.[0]; if (!chosen) return;
    setError(''); setTable(null); setMapping(null); setResult(null);
    if (chosen.size > 2_000_000) { setError('Use um arquivo de até 2 MB.'); input.value = ''; return; }
    setBusy(true);
    try { const value = await chosen.text(); setText(value); prepare(value); }
    catch { setError('Não foi possível ler o arquivo. Tente exportá-lo novamente.'); }
    finally { setBusy(false); input.value = ''; }
  }
  async function save() {
    if (busy || missing || !selected.length || result) return;
    setBusy(true); setError('');
    try {
      const { data: response, error } = await supabase.rpc('import_schedule', { p_rows: selected.map(r => r.content) });
      if (error) throw error;
      setResult(response); // Repetir a mesma importação também é seguro no banco.
    } catch { setError('Não foi possível confirmar a importação. Confira sua conexão e tente novamente; assuntos já gravados serão ignorados.'); }
    finally { setBusy(false); }
  }
  return <section className="surface import-panel" aria-label="Importar do Notion">
    <div className="dialog-head"><div><p className="eyebrow">SEU CRONOGRAMA, UM NOVO RITMO</p><h2>Importar do Notion</h2></div><button disabled={busy} className="text-button" onClick={() => { void onSaved(); onClose(); }}>Fechar importação</button></div>
    {result ? <div role="status"><h3>{result.inserted} assunto(s) importado(s).</h3><p>{result.skipped} duplicado(s) ignorado(s). Seu conteúdo está pronto para o plano.</p><button className="primary" onClick={async () => { await onSaved(); onClose(); }}>Ver meus conteúdos →</button></div> : <>
      <p className="muted small">No Notion, abra a tabela completa → ••• → Exportar → Markdown e CSV. Extraia o ZIP e escolha o CSV do cronograma. A importação inclui as linhas presentes no arquivo.</p>
      <label>Arquivo CSV do Notion<input type="file" accept=".csv,text/csv,.tsv,text/tab-separated-values" disabled={busy} onChange={e => void file(e.currentTarget)}/></label>
      {!table && <><details><summary>Ou colar uma tabela</summary><label>Tabela com cabeçalho<textarea rows={5} value={text} onChange={e => setText(e.target.value)} placeholder={'Área\tTema\tAssunto\nMFC\tInfectologia\tArboviroses'}/></label><button className="secondary" disabled={busy || !text.trim()} onClick={() => prepare(text)}>Preparar prévia</button></details><p className="caption">Até 1.000 assuntos e 2 MB por importação. Nenhum dado é salvo antes da confirmação.</p></>}
      {table && mapping && <>
        <div className="section-title"><h3>1. Confira as colunas</h3><button disabled={busy} className="text-button" onClick={() => { setTable(null); setMapping(null); setError(''); }}>Trocar arquivo ou texto</button></div>
        <div className="import-mapping">{(Object.entries(importFields) as [ImportField,string][]).map(([key,label]) => <label key={key}>{label}{['area','topic','title'].includes(key) ? ' *' : ''}<select disabled={busy} value={mapping[key]} onChange={e => { setMapping({ ...mapping, [key]: e.target.value }); setExcluded(new Set()); }}><option value="">{['area','topic','title'].includes(key) ? 'Escolha uma coluna' : 'Não importar'}</option>{table.headers.map(h => <option key={h} value={h}>{h}</option>)}</select></label>)}</div>
        {missing && <p className="notice" role="alert">Selecione as colunas de Área, Tema e Assunto para continuar.</p>}
        <h3>2. Como organizar as datas?</h3><label>Organização do cronograma<select disabled={busy} value={preserveDate ? 'preserve' : 'adaptive'} onChange={e => setPreserveDate(e.target.value === 'preserve')}><option value="adaptive">Deixar o Studygram redistribuir</option><option value="preserve">Usar Próximo Estudo como data inicial</option></select></label>
        <p className="caption">{preserveDate ? 'Cada assunto entra no plano a partir da data importada, conforme seu tempo disponível. Datas passadas ficam elegíveis agora. Após uma sessão real, o app passa a programar o acompanhamento.' : 'Os assuntos ficam disponíveis agora; o plano considera sua rotina, importância e rodízio. As datas originais ficam guardadas para consulta.'} Rodízio vincula o assunto a um contexto; o contexto atual continua sendo o que você definiu em Plano.</p>
        <p className="notice">As etapas marcadas orientam o próximo passo do ciclo de estudo. O status fica no histórico. A importação não cria sessões, notas ou estimativas de memória.</p>
        <h3>3. Revise e selecione os assuntos</h3>
        <p className="caption">{selected.length} selecionado(s) · {rows.filter(r => r.duplicate).length} duplicado(s) · {rows.filter(r => r.errors.length).length} linha(s) com erro. Duplicatas são comparadas por Área + Tema + Assunto, inclusive itens arquivados.</p>
        <div className="import-table-wrap"><table className="import-table"><caption className="sr-only">Prévia dos assuntos do Notion</caption><thead><tr><th>Importar</th><th>Área / Tema</th><th>Assunto</th><th>Histórico e datas</th><th>Conferência</th></tr></thead><tbody>{rows.map(r => <tr key={r.line}><td><input type="checkbox" aria-label={`Importar linha ${r.line}`} disabled={busy || !r.content || r.duplicate} checked={!!r.content && !r.duplicate && !excluded.has(r.line)} onChange={e => setExcluded(old => { const next = new Set(old); e.target.checked ? next.delete(r.line) : next.add(r.line); return next; })}/><small>Linha {r.line}</small></td><td>{r.content?.area}<small>{r.content?.topic}</small></td><td>{r.content?.title ?? 'Linha inválida'}</td><td>{r.content?.source.status || 'Sem status'}<small>{r.content?.source.nextStudy ?? 'Sem data'}{r.content?.source.rotation ? ` · ${r.content.source.rotation}` : ''}</small>{r.content && <small>{(['priming','studied','questions','retrieval'] as const).filter(k => r.content!.source[k]).map(k => importFields[k]).join(' · ') || 'Nenhuma etapa marcada'}</small>}</td><td>{r.errors.join(' ')}{r.duplicate ? 'Já existe — será ignorado' : r.content ? `Importância: ${r.content.importance >= .8 ? 'Alta' : r.content.importance < .5 ? 'Baixa' : 'Regular'}` : ''}{r.warnings.map(w => <small key={w}>{w}</small>)}</td></tr>)}</tbody></table></div>
        <div className="import-footer"><p className="caption">Linhas com erro ficam de fora. Corrija-as no CSV e importe depois. Conteúdos existentes e seu histórico são preservados.</p><button className="primary" disabled={busy || !!missing || !selected.length} onClick={() => void save()}>{busy ? 'Importando…' : `Confirmar importação de ${selected.length} assunto(s)`}</button></div>
      </>}
    </>}
    {error && <p role="alert" className="notice error">{error}</p>}
  </section>;
}
