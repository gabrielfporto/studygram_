import type { Competency, StudyStage, Effort } from '../domain/model.js';

export type StudyMethod = 'priming'|'reading'|'recall'|'questions'|'new';
export const stageLabels: Record<StudyStage,string> = { priming:'Preparação', theory:'Teoria', retrieval:'Recuperação', questions:'Questões' };
export const stageOrder: StudyStage[] = ['priming','theory','retrieval','questions'];
export function completedStages(c: Competency): Set<StudyStage> {
  const stages = new Set(c.completedStages ?? []);
  if (c.notionSource?.priming) stages.add('priming');
  if (c.notionSource?.studied) stages.add('theory');
  if (c.notionSource?.retrieval) stages.add('retrieval');
  if (c.notionSource?.questions) stages.add('questions');
  // Compatibilidade com registros anteriores ao ciclo.
  if (c.completedStages === undefined && c.card.reps > 0) { stages.add('theory'); stages.add('retrieval'); }
  if (c.completedStages === undefined && c.evidence.some(e => e.total > 0)) stages.add('questions');
  if (stages.has('theory') || stages.has('questions') || stages.has('retrieval')) stages.add('priming');
  return stages;
}
export function stagesFromSessions(sessions: { status:string; method:string; id:string }[], questions: { session_id?:string|null|undefined; total:number }[]): StudyStage[] {
  const result = new Set<StudyStage>();
  for (const s of sessions.filter(s => s.status === 'completed')) {
    if (s.method === 'priming') result.add('priming');
    if (s.method === 'reading' || s.method === 'new') result.add('theory');
    if (['recall','new','explanation','case'].includes(s.method)) result.add('retrieval');
    if (s.method === 'questions' && questions.some(q => q.session_id === s.id && q.total > 0)) result.add('questions');
  }
  return [...result];
}
export interface StudyStep { method: StudyMethod; title:string; goal:string; steps:string[]; finish:string; minutes:number; effort:Effort; review:boolean; ready:boolean }
export const instructions: Record<StudyMethod,Omit<StudyStep,'minutes'|'effort'|'review'|'ready'>> = {
  priming: { method:'priming',title:'Prepare o primeiro contato',goal:'Sair com uma pergunta que você quer responder sobre este assunto.',
    steps:['Abra sua aula, resumo ou PDF e localize o assunto.','Olhe os títulos e escreva o que já sabe, sem tentar dominar tudo.','Anote uma pergunta para orientar a leitura.'],finish:'Uma pergunta anotada e o material localizado já encerram esta etapa.' },
  reading: { method:'reading',title:'Avance na teoria',goal:'Estudar um trecho do material e registrar os pontos que precisam de prática.',
    steps:['Abra o material no trecho em que parou.','Leia ou assista um bloco com atenção à pergunta que você quer responder.','Anote até três pontos principais e onde retomar.'],finish:'Marque a etapa como concluída apenas quando terminar a teoria que definiu para este assunto.' },
  recall: { method:'recall',title:'Tente lembrar sem consultar',goal:'Verificar um objetivo delimitado do assunto, conferir a resposta e corrigir uma lacuna.',
    steps:['Escolha uma pergunta ou parte do assunto; não tente cobrir o tema inteiro de uma vez.','Sem consultar, explique a resposta ou resolva um exemplo.','Confira no material, corrija uma lacuna e explique novamente. Se faltar base, continue no material antes de trocar de assunto.'],finish:'Concluir esta prática não comprova domínio do tema. Registre como foi a tentativa; o tempo é uma estimativa ajustável.' },
  questions: { method:'questions',title:'Pratique e confira os erros',goal:'Verificar se você consegue aplicar o assunto e identificar uma dificuldade.',
    steps:['Escolha questões para um objetivo do assunto; quando útil, compare situações parecidas que exigem decisões diferentes.','Responda antes de consultar e confira o gabarito e a justificativa no material.','Explique por que errou e tente aplicar a correção em outro exemplo antes de trocar de assunto.'],finish:'Registre apenas as tentativas realizadas. Se faltar base, retome o material; acertar uma questão não comprova domínio do tema.' },
  new: { method:'new',title:'Estude e tente recuperar',goal:'Conhecer um trecho e verificar o que ficou sem consultar.',
    steps:['Abra seu material e escolha um trecho.','Estude e depois feche o material.','Explique o que lembra e confira as lacunas.'],finish:'Registre como foi lembrar para ajustar o acompanhamento.' },
};
export function nextStudyStep(c: Competency, now: Date): StudyStep {
  const done = completedStages(c);
  let method: StudyMethod; let minutes:number; let effort:Effort; let review=false;
  if (!done.has('priming')) { method='priming'; minutes=5; effort='low'; }
  else if (!done.has('theory')) { method='reading'; minutes=Math.max(25,c.newMinutes-5); effort=c.effort; }
  else if (!done.has('retrieval')) { method='recall'; minutes=Math.max(10,c.reviewMinutes); effort=c.effort; }
  else if (!done.has('questions')) { method='questions'; minutes=c.reviewMinutes; effort=c.effort; }
  else { review=true; method=(c.evidence.at(-1)?.reportedDifficulty??0)>.6 ? 'questions' : 'recall'; minutes=Math.max(10,c.reviewMinutes); effort=c.effort; }
  return { ...instructions[method], minutes, effort, review, ready:!review || !c.card.reps || c.card.due <= now };
}
