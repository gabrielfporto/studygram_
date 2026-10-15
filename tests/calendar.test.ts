import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeFreeBusy } from '../src/application/calendar.js';
test('Calendar: normaliza fusos, une sobreposições e limita ao intervalo consultado',()=>{
  const snapshot=normalizeFreeBusy({calendars:{a:{busy:[{start:'2026-10-15T08:00:00-03:00',end:'2026-10-15T10:00:00-03:00'},{start:'2026-10-15T09:30:00-03:00',end:'2026-10-15T11:00:00-03:00'}]},b:{busy:[]}}},[{id:'a',summary:'Trabalho',primary:true},{id:'b',summary:'Pessoal'}],'2026-10-15T12:00:00Z','2026-10-16T00:00:00Z');
  assert.deepEqual(snapshot.busy,[{calendarId:'a',start:'2026-10-15T12:00:00.000Z',end:'2026-10-15T14:00:00.000Z'}]);
  assert.equal(snapshot.calendars.length,2);assert(!JSON.stringify(snapshot).includes('access_token'));
});
test('Calendar: uma agenda com erro não vira agenda vazia nem apaga o estado anterior',()=>{
  const from='2026-10-15T00:00:00Z',to='2026-10-16T00:00:00Z',selected=[{id:'a',summary:'Agenda'}];
  assert.throws(()=>normalizeFreeBusy({calendars:{a:{errors:[{reason:'notFound'}],busy:[]}}},selected,from,to),/último estado/);
  assert.throws(()=>normalizeFreeBusy({calendars:{a:{errors:[{reason:'notFound'}]}}},selected,from,to),/último estado/);
  assert.throws(()=>normalizeFreeBusy({calendars:{}},selected,from,to),/último estado/);
  assert.throws(()=>normalizeFreeBusy({calendars:{a:{}}},selected,from,to),/último estado/);
  assert.throws(()=>normalizeFreeBusy({calendars:{a:{busy:[{start:'2026-10-15T12:00:00Z',end:'2026-10-15T11:00:00Z'}]}}},selected,from,to),/inválido/);
  assert.throws(()=>normalizeFreeBusy({calendars:{}},[],from,to));
});
