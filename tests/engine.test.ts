import test from 'node:test';
import assert from 'node:assert/strict';
import { Rating } from 'ts-fsrs';
import { DAY, MINUTE, type Competency } from '../src/domain/model.js';
import { planDay } from '../src/engine/planner.js';
import { priority, defaultWeights } from '../src/engine/priority.js';
import { availability } from '../src/engine/availability.js';
import { learningState, newMemory, retention, reviewMemory } from '../src/engine/memory.js';
import { fixtures, inputFor, START, evidence } from '../simulation/fixtures.js';

const copy = (): Competency => structuredClone(fixtures()[0]!);
const context = () => ({ now: START, rotations: [], exams: [] });
test('Caso 1: 30 minutos — atividades úteis cabem na janela', () => {
  const plan = planDay(inputFor(fixtures(), 30));
  assert(plan.items.length > 0);
  assert(plan.plannedMinutes <= 30);
  assert(plan.items.every(x => x.end <= START.getTime() + 30 * MINUTE));
});
test('Caso 2: 3 horas — permite conteúdo novo e mantém limite de sessões', () => {
  const plan = planDay(inputFor(fixtures(), 180));
  assert(plan.plannedMinutes > 30 && plan.plannedMinutes <= 180);
  assert(plan.items.length <= 6);
  const fresh = fixtures().filter(c => c.card.reps === 0);
  assert(planDay(inputFor(fresh, 180)).items.some(x => x.method === 'new'));
  assert.equal(planDay(inputFor(fresh, 20)).items.length, 0);
});
test('Caso 3: perdeu três dias — recalcula sem modificar memória nem carregar tarefas', () => {
  const competencies = fixtures();
  const before = structuredClone(competencies);
  for (let d = 0; d < 3; d++) planDay(inputFor(competencies, 30, new Date(START.getTime() + d * DAY)));
  const plan = planDay(inputFor(competencies, 30, new Date(START.getTime() + 3 * DAY)));
  assert.deepEqual(competencies, before);
  assert(plan.items.length <= 3);
  assert.equal(plan.items.length + plan.deferred.length, 150);
});
test('Caso 4: vinte revisões vencidas — prioriza revisão sem exceder capacidade', () => {
  const competencies = Array.from({ length: 20 }, (_, i) => ({ ...copy(), id: `overdue-${i}` }));
  for (const c of competencies) c.card.due = new Date(START.getTime() - 10 * DAY);
  const plan = planDay(inputFor(competencies, 30));
  assert(plan.items.length > 0 && plan.items.length <= 3);
  assert(plan.items.every(x => x.method !== 'new' && x.priority.factors.memory === 1));
  assert(plan.deferred.length >= 17);
});
test('Caso 5: prova em três dias — bônus relacionado; prova passada não pontua', () => {
  const c = copy();
  const plain = priority(c, context());
  const near = priority(c, { ...context(), exams: [{ competencyIds: [c.id], at: new Date(START.getTime() + 3 * DAY) }] });
  assert(Math.abs(near.score - plain.score - 9) < 1e-8);
  assert.equal(priority(c, { ...context(), exams: [{ competencyIds: [c.id], at: new Date(START.getTime() - DAY) }] }).score, plain.score);
});
test('Caso 6: novo rodízio em 14 dias — preparação gradual', () => {
  const c = copy();
  const rotation = { contextId: c.contextIds[0]!, start: new Date(START.getTime() + 14 * DAY), end: new Date(START.getTime() + 60 * DAY) };
  const boosted = priority(c, { ...context(), rotations: [rotation] });
  assert.equal(boosted.factors.context, 0.4);
  assert.equal(boosted.score - priority(c, context()).score, 8);
});
test('Caso 7: muitos erros recentes — fraqueza objetiva pesa mais que feedback', () => {
  const good = copy(); const bad = copy();
  good.evidence = [{ ...evidence(START, 10), reportedDifficulty: 1 }];
  bad.evidence = [{ ...evidence(START, 1), recurringErrors: 5, reportedDifficulty: 0 }];
  assert(priority(bad, context()).score > priority(good, context()).score);
  const result = reviewMemory(bad.card, START, Rating.Easy, bad.evidence[0]!);
  assert.equal(result.log.rating, Rating.Again);
});
test('Caso 8: tema importante com memória boa — importância persiste, sem revisão artificial', () => {
  const c = copy();
  c.card = reviewMemory(c.card, START, Rating.Easy, evidence(START, 10)).card;
  const score = priority(c, context());
  assert.equal(score.retention, 1);
  assert.equal(score.factors.memory, 0);
  assert(score.contributions.importance > 10);
});
test('Caso 9: pouco importante muito atrasado — atraso satura, contexto pode vencer', () => {
  const low = copy(); low.importance = 0.1;
  low.card.due = new Date(START.getTime() - 100 * DAY);
  const before = priority(low, context());
  low.card.due = new Date(START.getTime() - 1000 * DAY);
  assert.equal(priority(low, context()).score, before.score);
  const high = { ...low, importance: 0.95 };
  assert(priority(high, context()).score > before.score);
});
test('Caso 10: demanda semanal maior que oferta — orçamento limita a seleção', () => {
  let remaining = 60;
  let planned = 0;
  for (let d = 0; d < 7; d++) {
    const input = inputFor(fixtures(), 180, new Date(START.getTime() + d * DAY));
    input.weeklyRemainingMinutes = remaining;
    const plan = planDay(input);
    planned += plan.plannedMinutes;
    remaining -= plan.plannedMinutes;
  }
  assert(planned > 0 && planned <= 60);
});
test('Disponibilidade: união, conflitos, cancelamentos, passado e janela mínima', () => {
  const t = START.getTime();
  const windows = [{ start: t - 10 * MINUTE, end: t + 60 * MINUTE }, { start: t + 30 * MINUTE, end: t + 90 * MINUTE }];
  const result = availability(windows, [
    { start: t + 20 * MINUTE, end: t + 40 * MINUTE, status: 'busy' },
    { start: t + 50 * MINUTE, end: t + 60 * MINUTE, status: 'cancelled' },
  ], START, 10);
  assert.deepEqual(result, [{ start: t, end: t + 20 * MINUTE }, { start: t + 40 * MINUTE, end: t + 90 * MINUTE }]);
  assert.deepEqual(availability([], [], START, 10), []);
});
test('Replanejar respeita tempo já gasto e não repete competências concluídas', () => {
  const input = inputFor(fixtures(), 60);
  const first = planDay(input);
  input.completedIds = first.items.map(x => x.competencyId);
  input.spentMinutes = 50;
  const next = planDay(input);
  assert(next.plannedMinutes <= 10);
  assert(next.items.every(x => !input.completedIds.includes(x.competencyId)));
});
test('Determinismo independe da ordem dos candidatos e não muda entradas', () => {
  const input = inputFor(fixtures());
  const original = structuredClone(input);
  const result = planDay(input);
  assert.deepEqual(input, original);
  assert.deepEqual(planDay({ ...input, competencies: [...input.competencies].reverse() }), result);
  assert.deepEqual(planDay(input), result);
});
test('Rejeita dados inválidos, mistura de tenants e pesos inválidos', () => {
  assert.throws(() => planDay({ ...inputFor(fixtures()), dailyMinutes: NaN }));
  assert.throws(() => planDay({ ...inputFor(fixtures()), userId: 'other-user' }));
  const c = copy(); c.evidence = [evidence(START, 11, 10)];
  assert.throws(() => planDay(inputFor([c])));
  assert.throws(() => priority(copy(), context(), { ...defaultWeights, memory: -1 }));
});
test('Baixa energia evita conteúdo novo e tarefas profundas', () => {
  const input = inputFor(fixtures()); input.maxEffort = 'low';
  const result = planDay(input);
  assert(result.items.length > 0);
  assert(result.items.every(x => x.method === 'recall' || input.competencies.find(c => c.id === x.competencyId)?.effort === 'low'));
});
test('FSRS: retenção decai, rating objetivo atualiza, relógio retroativo é rejeitado', () => {
  const c = newMemory(START);
  assert.equal(retention(c, START), null);
  const updated = reviewMemory(c, START, Rating.Good, evidence(START));
  assert(updated.card.due > START);
  assert(retention(updated.card, new Date(START.getTime() + 10 * DAY))! < 1);
  assert.throws(() => reviewMemory(updated.card, new Date(START.getTime() - DAY), Rating.Good, evidence(START)));
});
test('Contribuições explicam o score e pesos são normalizados', () => {
  const c = copy(); const result = priority(c, context());
  assert.equal(result.score, Object.values(result.contributions).reduce((a, b) => a + b, 0));
  const doubled = Object.fromEntries(Object.entries(defaultWeights).map(([k, v]) => [k, v * 2])) as typeof defaultWeights;
  assert.equal(priority(c, context(), doubled).score, result.score);
});
test('Otimização escolhe combinação de maior valor em vez de só ordenar scores', () => {
  const base = copy();
  const candidates = [
    { ...base, id: 'a', importance: 1, reviewMinutes: 30 },
    { ...base, id: 'b', importance: 0.7, reviewMinutes: 20 },
    { ...base, id: 'c', importance: 0.7, reviewMinutes: 20 },
  ];
  const input = inputFor(candidates, 40);
  input.minimumSession = 20;
  input.weights = { memory: 0, weakness: 0, context: 0, importance: 1, events: 0, exposure: 0 };
  assert.deepEqual(planDay(input).items.map(x => x.competencyId).sort(), ['b', 'c']);
});
test('Fracasso objetivo recente retira manutenção; sem evidência não declara domínio', () => {
  const card = { ...copy().card, stability: 50, reps: 10 };
  assert.notEqual(learningState(card, []), 'Manutenção');
  assert.equal(learningState(card, [evidence(START, 10)]), 'Manutenção');
  assert.equal(learningState(card, [evidence(START, 10), evidence(new Date(START.getTime() + DAY), 0)]), 'Aprendendo');
});
