import type { MyMembership } from '../types/api';

const DAY = 86_400_000;

/** La membresía a mostrar como "actual": una activa, si no una por comenzar, si no la más reciente. */
export function currentMembership(list: MyMembership[]): MyMembership | null {
  return list.find((m) => m.status === 'activa') ?? list.find((m) => m.status === 'pendiente') ?? list[0] ?? null;
}

/** Membresías con saldo a pagar (las canceladas no cuentan). */
export const pendingMemberships = (list: MyMembership[]) => list.filter((m) => m.status !== 'cancelada' && m.due > 0);

/** Días hasta el vencimiento: positivo = faltan, 0 = vence hoy, negativo = ya venció. */
export function daysUntil(iso: string, now = Date.now()): number {
  return Math.ceil((new Date(iso).getTime() - now) / DAY);
}
