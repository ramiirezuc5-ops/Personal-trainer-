const LOCALE = 'es-AR';

export function money(amount: number, currency = 'ARS'): string {
  try { return new Intl.NumberFormat(LOCALE, { style: 'currency', currency, maximumFractionDigits: 2 }).format(amount); } catch { return `${currency} ${amount}`; }
}
export function formatDate(iso: string | null | undefined, timeZone?: string): string {
  if (!iso) return '—';
  return new Intl.DateTimeFormat(LOCALE, { dateStyle: 'medium', timeZone }).format(new Date(iso));
}
export function formatTime(iso: string, timeZone?: string): string {
  return new Intl.DateTimeFormat(LOCALE, { hour: '2-digit', minute: '2-digit', timeZone }).format(new Date(iso));
}
export function formatDateTime(iso: string, timeZone?: string): string {
  return new Intl.DateTimeFormat(LOCALE, { dateStyle: 'medium', timeStyle: 'short', timeZone }).format(new Date(iso));
}
// "2026-03" → "mar 26"
export function monthLabel(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  return new Intl.DateTimeFormat(LOCALE, { month: 'short', year: '2-digit', timeZone: 'UTC' }).format(new Date(Date.UTC(y, m - 1, 1)));
}
export const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('');
export const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

export const STATUS_LABEL = { active: 'Activo', inactive: 'Inactivo', pending: 'Pendiente' } as const;
export const LEVEL_LABEL = { principiante: 'Principiante', intermedio: 'Intermedio', avanzado: 'Avanzado' } as const;
