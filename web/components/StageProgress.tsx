import type { Competency } from '../../src/domain/model';
import { completedStages, stageLabels, stageOrder } from '../../src/engine/study-cycle';
export function StageProgress({ competency }: {competency:Competency}) {
  const done=completedStages(competency);
  return <ol className="stage-progress" aria-label="Etapas do assunto">{stageOrder.map(stage=><li key={stage} className={done.has(stage)?'done':''}><span aria-hidden="true">{done.has(stage)?'✓':'○'}</span> {stageLabels[stage]}<span className="sr-only">{done.has(stage)?' concluída':' pendente'}</span></li>)}</ol>;
}
