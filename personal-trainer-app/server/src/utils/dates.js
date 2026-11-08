// Manejo de zonas horarias con Intl (sin dependencias). Todo se guarda en UTC; la zona del entrenador solo se usa para interpretar y mostrar.
const WEEKDAYS = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

export function tzParts(date, timeZone) {
  const f = new Intl.DateTimeFormat('en-US', { timeZone, hourCycle: 'h23', weekday: 'short', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const p = Object.fromEntries(f.formatToParts(date).map((x) => [x.type, x.value]));
  return { year: +p.year, month: +p.month, day: +p.day, hour: +p.hour, minute: +p.minute, second: +p.second, weekday: WEEKDAYS[p.weekday], ymd: `${p.year}-${p.month}-${p.day}` };
}

const offsetMs = (date, tz) => { const p = tzParts(date, tz); return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Math.floor(date.getTime() / 1000) * 1000; };

// Instante UTC correspondiente a una fecha/hora LOCAL de la zona indicada (resuelve cambios de horario).
export function zonedInstant(y, m, d, hh, mm, tz) {
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  let t = guess - offsetMs(new Date(guess), tz);
  t = guess - offsetMs(new Date(t), tz);
  return new Date(t);
}

export const parseYmd = (ymd) => { const [y, m, d] = ymd.split('-').map(Number); return { y, m, d }; };

// [inicio, fin) del día local indicado, expresado en UTC.
export function localDayRange(ymd, tz) {
  const { y, m, d } = parseYmd(ymd);
  const next = new Date(Date.UTC(y, m - 1, d + 1));
  return [zonedInstant(y, m, d, 0, 0, tz), zonedInstant(next.getUTCFullYear(), next.getUTCMonth() + 1, next.getUTCDate(), 0, 0, tz)];
}

export function localMonthStart(date, tz, monthsBack = 0) {
  const p = tzParts(date, tz);
  const d = new Date(Date.UTC(p.year, p.month - 1 - monthsBack, 1));
  return zonedInstant(d.getUTCFullYear(), d.getUTCMonth() + 1, 1, 0, 0, tz);
}

export const BLOCK_MS = 15 * 60_000;
export const isAligned = (date) => date.getTime() % BLOCK_MS === 0;
export function slotBlocks(trainerId, start, end) {
  const out = [];
  for (let t = start.getTime(); t < end.getTime(); t += BLOCK_MS) out.push(`${trainerId}:${t / BLOCK_MS}`);
  return out;
}
