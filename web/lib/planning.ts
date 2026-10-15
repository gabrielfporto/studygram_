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
  const completedIds = todaySessions.map(s => s.competency_id); // ausência também libera o dia para outras escolhas
  return { spent, todaySessions, plan: planDay({ userId, now, competencies: data.competencies, windows, busy: [],
    dailyMinutes, spentMinutes: spent, weeklyRemainingMinutes: 7 * 720, minimumSession: 10, maximumSessions: 6,
    maxEffort: rules[0]?.max_effort ?? 'high', completedIds, rotations: data.rotations, exams: [] }) };
}
