import { MINUTE, type Busy, type Window } from '../domain/model.js';

function validate(w: Window): void {
  if (!Number.isFinite(w.start) || !Number.isFinite(w.end) || w.end <= w.start) throw new Error('Janela inválida');
}
export function mergeWindows(windows: Window[]): Window[] {
  windows.forEach(validate);
  const result: Window[] = [];
  for (const window of windows.map(w => ({ ...w })).sort((a, b) => a.start - b.start)) {
    const last = result.at(-1);
    if (last && last.end >= window.start) last.end = Math.max(last.end, window.end);
    else result.push(window);
  }
  return result;
}
export function availability(windows: Window[], busy: Busy[], now: Date, minimum: number): Window[] {
  if (!Number.isFinite(now.getTime()) || !Number.isInteger(minimum) || minimum < 1) throw new Error('Disponibilidade inválida');
  busy.forEach(validate);
  let free = mergeWindows(windows).map(w => ({ start: Math.max(w.start, now.getTime()), end: w.end }))
    .filter(w => w.end > w.start);
  for (const block of mergeWindows(busy.filter(b => b.status === 'busy'))) {
    free = free.flatMap(w => {
      if (block.end <= w.start || block.start >= w.end) return [w];
      const parts: Window[] = [];
      if (block.start > w.start) parts.push({ start: w.start, end: block.start });
      if (block.end < w.end) parts.push({ start: block.end, end: w.end });
      return parts;
    });
  }
  return free.filter(w => Math.floor((w.end - w.start) / MINUTE) >= minimum);
}
