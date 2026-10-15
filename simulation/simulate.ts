import assert from 'node:assert/strict';
import { Rating } from 'ts-fsrs';
import { DAY, MINUTE } from '../src/domain/model.js';
import { planDay } from '../src/engine/planner.js';
import { retention, reviewMemory, learningState } from '../src/engine/memory.js';
import { evidence, fixtures, inputFor, rng, START } from './fixtures.js';

export function simulate(seed = 42) {
  const random = rng(seed + 1);
  const competencies = fixtures(seed);
  const days = [];
  const sessions = [];
  const reviewed = new Set<string>();
  let weeklySpent = 0;
  let invariantChecks = 0;
  for (let day = 0; day < 60; day++) {
    if (day % 7 === 0) weeklySpent = 0;
    const now = new Date(START.getTime() + day * DAY);
    const minutes = [60, 30, 120, 40, 60, 180, 0][day % 7] ?? 0;
    const input = inputFor(competencies, minutes, now);
    input.weeklyRemainingMinutes = Math.max(0, 360 - weeklySpent);
    input.maxEffort = day % 7 === 1 ? 'low' : 'high';
    // Um compromisso reduz a janela, sem transformar outros horários livres em estudo.
    if (minutes >= 120) input.busy = [{ start: now.getTime() + 50 * MINUTE, end: now.getTime() + 65 * MINUTE, status: 'busy' }];
    const plan = planDay(input);
    assert(plan.plannedMinutes <= plan.capacityMinutes);
    assert(plan.items.length <= input.maximumSessions);
    assert(new Set(plan.items.map(x => x.competencyId)).size === plan.items.length);
    assert(plan.deferred.length + plan.items.length <= 150);
    for (const item of plan.items) {
      assert(plan.freeWindows.some(w => item.start >= w.start && item.end <= w.end));
      assert(item.priority.score >= 0 && item.priority.score <= 100);
      invariantChecks += 2;
    }
    invariantChecks += 4;
    const missed = day >= 8 && day <= 10;
    let actual = 0;
    for (const item of plan.items) {
      const c = competencies.find(x => x.id === item.competencyId)!;
      const outcome = missed ? 'missed' : random() < 0.12 ? 'partial' : random() < 0.08 ? 'missed' : 'completed';
      const duration = outcome === 'completed' ? item.minutes : outcome === 'partial' ? Math.floor(item.minutes / 2) : 0;
      actual += duration;
      if (outcome !== 'missed') {
        const at = new Date(item.start + duration * MINUTE);
        const r = retention(c.card, at) ?? 0.45;
        // Modelo de aluno sintético separado da escolha do plano; não valida eficácia clínica.
        const success = Math.max(0.25, Math.min(0.95, r * 0.65 + 0.2));
        const total = outcome === 'partial' ? 3 : 10;
        let correct = 0;
        for (let i = 0; i < total; i++) if (random() < success) correct++;
        const ev = evidence(at, correct, total);
        ev.recurringErrors = c.evidence.at(-1)?.errors ? Math.min(2, ev.errors) : 0;
        ev.reportedDifficulty = 1 - correct / total;
        const update = reviewMemory(c.card, at, Rating.Good, ev);
        c.card = update.card;
        c.evidence.push(ev);
        c.lastExposure = at;
        reviewed.add(c.id);
      }
      sessions.push({ day, competencyId: c.id, topic: c.topic, importance: c.importance,
        context: c.contextIds[0], plannedMinutes: item.minutes, actualMinutes: duration, outcome,
        method: item.method, priority: item.priority, start: new Date(item.start).toISOString() });
    }
    weeklySpent += actual;
    assert(weeklySpent <= 360);
    invariantChecks++;
    const end = new Date(now.getTime() + 12 * 60 * MINUTE);
    const known = competencies.filter(c => c.card.reps > 0);
    const rs = known.map(c => retention(c.card, end)!);
    days.push({ day: day + 1, date: now.toISOString().slice(0, 10), context: day < 30 ? 'MFC' : 'Emergência',
      capacity: plan.capacityMinutes, planned: plan.plannedMinutes, actual, count: plan.items.length,
      deferred: plan.deferred.length, overdue: known.filter(c => c.card.due < end).length,
      atRisk: rs.filter(r => r < 0.9).length, meanRetention: rs.reduce((a, b) => a + b, 0) / rs.length,
      missed, selected: plan.items.map(x => x.competencyId) });
  }
  const completed = sessions.filter(s => s.outcome !== 'missed');
  return { seed, topics: new Set(competencies.map(c => c.topicId)).size, competencies: competencies.length,
    summary: { days: days.length, invariantChecks, capacityMinutes: days.reduce((s, d) => s + d.capacity, 0),
      plannedMinutes: days.reduce((s, d) => s + d.planned, 0), actualMinutes: days.reduce((s, d) => s + d.actual, 0),
      uniquePracticed: reviewed.size, unpracticed: 150 - reviewed.size, sessions: sessions.length,
      completed: sessions.filter(s => s.outcome === 'completed').length, partial: sessions.filter(s => s.outcome === 'partial').length,
      missed: sessions.filter(s => s.outcome === 'missed').length,
      maxDailySessions: Math.max(...days.map(d => d.count)), maxUniqueDeferred: Math.max(...days.map(d => d.deferred)),
      finalRetention: days.at(-1)!.meanRetention, finalAtRisk: days.at(-1)!.atRisk,
      highImportancePractice: completed.filter(s => s.importance >= 0.8).length,
      lowImportancePractice: completed.filter(s => s.importance < 0.5).length,
      upcomingContextPractice: completed.filter(s => s.day >= 2 && s.day < 30 && s.context === 'Emergência').length,
      states: competencies.reduce<Record<string, number>>((acc, c) => { const state = learningState(c.card, c.evidence); acc[state] = (acc[state] ?? 0) + 1; return acc; }, {}) },
    days, sessions };
}
