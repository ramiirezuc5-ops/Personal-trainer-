import { env } from '../config/env.js';
import { forbidden } from '../utils/errors.js';
import { safeEqual } from '../utils/tokens.js';
import { CSRF_COOKIE } from '../utils/cookies.js';

const SAFE = new Set(['GET', 'HEAD', 'OPTIONS']);

// Defensa en profundidad: (1) Origin debe coincidir con CLIENT_URL cuando el navegador lo envía,
// (2) doble envío de token: cookie legible por JS + cabecera X-CSRF-Token deben coincidir.
export function csrfProtection(req, _res, next) {
  if (SAFE.has(req.method)) return next();

  const origin = req.get('origin');
  if (origin && origin !== env.CLIENT_URL) return next(forbidden('Origen no permitido.', 'CSRF_ORIGIN'));

  const cookie = req.cookies?.[CSRF_COOKIE];
  const header = req.get('x-csrf-token');
  if (!cookie || !header || !safeEqual(cookie, header)) {
    return next(forbidden('Token CSRF ausente o inválido.', 'CSRF_INVALID'));
  }
  return next();
}
