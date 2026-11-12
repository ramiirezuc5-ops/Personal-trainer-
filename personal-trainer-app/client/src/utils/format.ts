import type { Difficulty, MembershipStatus, MuscleGroup, PaymentMethod, RoutineStatus } from '../types/api';

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

export const MUSCLE_LABEL: Record<MuscleGroup, string> = {
  pecho: 'Pecho', espalda: 'Espalda', hombros: 'Hombros', biceps: 'Bíceps', triceps: 'Tríceps', piernas: 'Piernas',
  gluteos: 'Glúteos', core: 'Core', cardio: 'Cardio', cuerpo_completo: 'Cuerpo completo', movilidad: 'Movilidad',
};
// 0 = domingo (igual que el servidor). Se muestran de lunes a domingo.
export const DAY_LABEL = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
export const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];
export const ROUTINE_STATUS_LABEL: Record<RoutineStatus, string> = { borrador: 'Borrador', activa: 'Activa', finalizada: 'Finalizada', archivada: 'Archivada' };
export const DIFFICULTY_LABEL: Record<Difficulty, string> = { baja: 'Baja', media: 'Media', alta: 'Alta' };
// Fecha de hoy según la zona horaria del navegador, como AAAA-MM-DD (para inputs de tipo date).
export const todayISO = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);

export const MEMBERSHIP_LABEL: Record<MembershipStatus, string> = { pendiente: 'Por comenzar', activa: 'Activa', vencida: 'Vencida', cancelada: 'Cancelada' };
export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = { efectivo: 'Efectivo', transferencia: 'Transferencia', tarjeta: 'Tarjeta', otro: 'Otro' };

// Las fechas "de calendario" (inicio/fin de rutina, nacimiento) se guardan a medianoche UTC: se muestran en UTC para no correrse un día.
export const formatCalendarDate = (iso: string | null | undefined) => formatDate(iso, 'UTC');
// Mediodía local de una fecha AAAA-MM-DD, en ISO: evita que la fecha se corra de día por la zona horaria.
export const localNoonISO = (date: string) => new Date(`${date}T12:00:00`).toISOString();
