import { mkdirSync, writeFileSync } from 'node:fs';
import { simulate } from './simulate.js';
import { MEMORY_VERSION, memoryParameters } from '../src/engine/memory.js';
import { ENGINE_VERSION } from '../src/engine/priority.js';
import { fixtures, inputFor } from './fixtures.js';
import { planDay } from '../src/engine/planner.js';

const reports = [42, 7, 2026].map(simulate);
mkdirSync('simulation/output', { recursive: true });
writeFileSync('simulation/output/trace.json', JSON.stringify({ engine: ENGINE_VERSION, memory: MEMORY_VERSION, memoryParameters, runs: reports }, null, 2));
const first = reports[0]!;
const s = first.summary;
const catalog = fixtures();
const examples = [30, 180].map(minutes => {
  const plan = planDay(inputFor(catalog, minutes));
  return `### Janela de ${minutes} minutos\n\n` +
    `Selecionado: ${plan.plannedMinutes} min em ${plan.items.length} sessões.\n\n` +
    `| Tema / competência | Método | Min | Score | Valor/min | Motivos |\n|---|---|---:|---:|---:|---|\n` +
    plan.items.map(item => {
      const c = catalog.find(x => x.id === item.competencyId)!;
      return `| ${c.topic} / ${c.title} | ${item.method} | ${item.minutes} | ${item.priority.score.toFixed(1)} | ${item.expectedValuePerMinute.toFixed(2)} | ${item.priority.reasons.join('; ')} |`;
    }).join('\n');
}).join('\n\n');
const report = `# Simulação do motor de estudos\n\n` +
  `50 temas · 150 competências · 60 dias por cenário · seeds 42, 7 e 2026. Datas sintéticas a partir de 15/10/2026, fuso America/Bahia.\n\n` +
  `Motor: ${ENGINE_VERSION}. Memória: ${MEMORY_VERSION}. FSRS real; comportamento do aluno fictício. Não é evidência de eficácia educacional.\n\n` +
  `## Resultados\n\n| Seed | Sessões | Min planejados/reais | Competências praticadas | Retenção final estimada | Competências <90% | Invariantes |\n|---|---:|---:|---:|---:|---:|---:|\n` +
  reports.map(r => `| ${r.seed} | ${r.summary.sessions} | ${r.summary.plannedMinutes}/${r.summary.actualMinutes} | ${r.summary.uniquePracticed}/150 | ${(r.summary.finalRetention * 100).toFixed(1)}% | ${r.summary.finalAtRisk} | ${r.summary.invariantChecks} |`).join('\n') +
  `\n\n## O que foi verificado\n\n- Nenhum plano ultrapassou a capacidade diária, as janelas ou o orçamento de 360 minutos por ciclo de sete dias.\n- Sem repetição de competência no mesmo plano; máximo observado: ${s.maxDailySessions} sessões/dia.\n- Os candidatos adiados são recalculados e limitados pelo catálogo (máximo observado ${s.maxUniqueDeferred}); não há cópia de tarefas vencidas.\n- Três faltas consecutivas nos dias 9–11, dias curtos/livres, descanso, compromisso, respostas erradas, sessões parciais e troca de rodízio no dia 31 foram incluídos.\n- Cenário 42: ${s.completed} sessões concluídas, ${s.partial} parciais e ${s.missed} não realizadas.\n- Práticas em importância alta/baixa: ${s.highImportancePractice}/${s.lowImportancePractice}, com 50 competências em cada grupo. Não é comparação controlada: contexto e estado também variam.\n- ${s.upcomingContextPractice} práticas do próximo contexto antes da troca; o teste pareado verifica separadamente o bônus de antecipação.\n\n` +
  `## Limites encontrados\n\n${s.unpracticed} competências não foram praticadas nesta janela. ${s.finalAtRisk} ficaram abaixo da meta de retenção estimada no último dia. O sistema limita carga, mas não elimina demanda nem garante retenção quando falta tempo. A Home futura precisa apresentar risco/cobertura sem transformar isso em dívida de tarefas.\n\n` +
  `A mochila é otimizada por janela; o resultado não é um ótimo global semanal. A métrica de retenção exclui competências nunca estudadas. O aluno sintético usa a retenção FSRS como uma entrada para respostas, portanto não valida a calibração do próprio FSRS. As competências agregadas e os pesos precisam de acompanhamento real.\n\n` +
  `## Trajetória — seed 42\n\n| Dia | Contexto | Capacidade | Planejado | Real | Sessões | Em risco |\n|---|---|---:|---:|---:|---:|---:|\n` +
  first.days.map(d => `| ${d.day}${d.missed ? ' (falta)' : ''} | ${d.context} | ${d.capacity} | ${d.planned} | ${d.actual} | ${d.count} | ${d.atRisk} |`).join('\n') +
  '\n\n## Exemplos explicáveis — mesmo catálogo inicial\n\n' + examples + '\n';
writeFileSync('simulation/output/report.md', report);
console.log(JSON.stringify(reports.map(r => ({ seed: r.seed, ...r.summary })), null, 2));
