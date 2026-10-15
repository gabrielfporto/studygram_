import { Temporal } from '@js-temporal/polyfill';
import { planDay } from '../../src/engine/planner';
import { MINUTE } from '../../src/domain/model';
import type { StudyData } from './data';

export function localDay(date: Date, timezone: string) {
  return Temporal.Instant.from(date.toISOString()).toZonedDateTimeISO(timezone).toPlainDate();
}
export function dayWindow(date: Temporal.PlainDate, time: string, timezone: string): number {
  return date.toZonedDateTime({ timeZone: timezone, plainTime: Temporal.PlainTime.from(time) }).epochMilliseconds;
}
export function makePlan(data: StudyData, userId: string, now: Date, override: number | null) {
  const timezone = data.profile?.timezone ?? 'America/Bahia';
  const date = localDay(now, timezone);
  const todaySessions = data.sessions.filter(s => localDay(new Date(s.started_at), timezone).equals(date));
  const spent = todaySessions.reduce((sum, s) => sum + s.actual_minutes, 0);
  const rules = data.rules.filter(r => r.weekday === date.dayOfWeek % 7);
  const dailyMinutes = override ?? Math.max(0, ...rules.map(r => r.daily_cap_minutes));
  // Ajuste rápido cria uma janela explícita a partir de agora; não interpreta toda folga como estudo.
  const midnight = date.add({ days: 1 }).toZonedDateTime(timezone).epochMilliseconds;
  const windows = override === null ? rules.map(r => ({ start: dayWindow(date, r.starts_local, timezone), end: dayWindow(date, r.ends_local, timezone) }))
    : override > spent ? [{ start: now.getTime(), end: Math.min(midnight, now.getTime() + (override - spent) * MINUTE) }] : [];
  // Etapas concluídas liberam a próxima etapa, inclusive no mesmo dia.
  // Uma ausência deixa espaço para outro assunto hoje.
  const completedIds = todaySessions.filter(s=>s.status==='missed').map(s => s.competency_id);
  // A data do Notion só define a primeira elegibilidade. Depois de uma sessão real,
  // o histórico e o FSRS passam a conduzir a programação.
  const eligible = data.competencies.filter(c => !c.notionSource?.preserveDate || !c.notionSource.nextStudy ||
    data.sessions.some(s => s.competency_id === c.id && s.status !== 'missed') || c.notionSource.nextStudy <= date.toString());
  const connected=new Set(data.calendar?.connections.filter(c=>c.status==='connected').map(c=>c.id));
  const busy=(data.calendar?.events??[]).filter(e=>connected.has(e.connection_id)).map(e=>({start:Date.parse(e.starts_at),end:Date.parse(e.ends_at),status:e.status}));
  return { spent, todaySessions, plan: planDay({ userId, now, competencies: eligible, windows, busy,
    dailyMinutes, spentMinutes: spent, weeklyRemainingMinutes: 7 * 720, minimumSession: 5, maximumSessions: 6,
    useStudyCycle:true, startSmall:override!==null && override-spent<=5,
    maxEffort: rules[0]?.max_effort ?? 'high', completedIds, rotations: data.rotations, exams: data.exams??[] }) };
}
