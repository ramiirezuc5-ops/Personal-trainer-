import rateLimit from 'express-rate-limit';

// Almacenamiento en memoria: válido para una sola instancia. Con varias instancias usar un store compartido (ver docs/deployment.md).
const make = (opts) => rateLimit({
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: (req, res) => res.status(429).json({ error: { code: 'RATE_LIMITED', message: 'Demasiados intentos. Esperá unos minutos e intentá de nuevo.', requestId: req.id } }),
  ...opts,
});

export const globalLimiter = make({ windowMs: 15 * 60_000, limit: 600 });
export const loginLimiter = make({
  windowMs: 15 * 60_000, limit: 10, skipSuccessfulRequests: true,
  keyGenerator: (req) => `${req.ip}|${String(req.body?.email ?? '').toLowerCase()}`,
});
// "Olvidé mi contraseña": por IP + correo (una red compartida, como la de un gimnasio, no bloquea a otros alumnos).
export const forgotLimiter = make({ windowMs: 60 * 60_000, limit: 5, keyGenerator: (req) => `${req.ip}|${String(req.body?.email ?? '').toLowerCase()}` });
// Activación de cuenta / restablecimiento con token de un solo uso: el token ya es secreto, el límite solo frena la fuerza bruta.
export const tokenLimiter = make({ windowMs: 60 * 60_000, limit: 60 });
// Cambio de contraseña: por usuario autenticado.
export const changePasswordLimiter = make({ windowMs: 60 * 60_000, limit: 10, keyGenerator: (req) => `u:${req.user?.id ?? req.ip}` });
