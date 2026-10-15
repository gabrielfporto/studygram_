import type { Competency } from '../../src/domain/model';
export function SourceHistory({ source }: { source: Competency['notionSource'] }) {
  if (!source) return null;
  const stages = [[source.priming,'Priming'],[source.studied,'Estudo'],[source.questions,'Questões'],[source.retrieval,'Retrieval']].filter(([done]) => done).map(([,title]) => title);
  return <details className="source-history"><summary>Histórico importado do Notion</summary><p>Status: {source.status || 'Não informado'} · Etapas: {stages.join(', ') || 'Nenhuma marcada'}<br/>
    Próximo Estudo original: {source.nextStudy ? source.nextStudy.split('-').reverse().join('/') : 'Sem data'} · {source.preserveDate ? 'Data inicial respeitada até a primeira sessão' : 'Redistribuição adaptativa'}<br/>
    Rodízio: {source.rotation || 'Não informado'} · Importância original: {source.originalImportance || 'Não informada'}</p></details>;
}
