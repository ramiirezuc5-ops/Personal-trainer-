import { z } from 'zod';

export const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Identificador inválido');
export const idParam = z.object({ id: objectId });
export const isoDate = z
  .union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.string().datetime({ offset: true })], { errorMap: () => ({ message: 'Fecha inválida (usá AAAA-MM-DD o formato ISO)' }) })
  .transform((s) => new Date(s))
  .refine((d) => !Number.isNaN(d.getTime()), 'Fecha inválida');
export const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Formato HH:mm');
export const text = (max, min = 0) => z.string().trim().min(min).max(max);
export const currencyCode = z.string().trim().length(3).transform((c) => c.toUpperCase()).refine((c) => /^[A-Z]{3}$/.test(c), 'Moneda inválida');
