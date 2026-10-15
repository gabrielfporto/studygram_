import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareReview, sessionSchema, type SessionInput } from '../src/application/session.js';
const now = new Date('2026-10-15T15:30:00Z');
export const entry: SessionInput = { competencyId: '10000000-0000-4000-8000-000000001003', idempotencyKey:'10000000-0000-4000-8000-000000001090',
  actualMinutes:20,plannedMinutes:20,startedAt:'2026-10-15T15:10:00Z',endedAt:now.toISOString(),method:'recall',status:'completed',feedback:3,total:10,correct:8,notes:'' };
test('Sessão: leitura e ausência não atualizam memória',()=>{
  assert.equal(prepareReview({...entry,method:'reading',total:0,correct:0},null,[],now),null);
  assert.equal(prepareReview({...entry,status:'missed',actualMinutes:0,total:0,correct:0},null,[],now),null);
});
test('Sessão: cálculo FSRS no serviço e rejeição de horário futuro',()=>{
  const result=prepareReview(entry,null,[],now)!;
  assert.equal(result.card.reps,1); assert.equal(result.rating,3);
  assert.throws(()=>prepareReview(entry,null,[],new Date('2026-10-14T10:00:00Z')));
  assert.equal(sessionSchema.safeParse({...entry,correct:11}).success,false);
});
