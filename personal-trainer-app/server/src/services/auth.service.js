import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { TOKEN_TYPES, USER_STATUS } from '../config/constants.js';
import { AuthToken } from '../models/AuthToken.js';
import { User } from '../models/User.js';
import { AppError, badRequest, forbidden, unauthorized } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import { hashToken, randomToken } from '../utils/tokens.js';
import { sendPasswordResetEmail } from './email.service.js';

const BCRYPT_COST = 12;
const MAX_FAILED_LOGINS = 5;
const LOCK_MINUTES = 15;
const REUSE_GRACE_MS = 10_000; // tolerancia para pestañas que refrescan casi a la vez
const RESET_TTL_MS = 3_600_000;
export const INVITE_TTL_MS = 7 * 86_400_000;
// Hash falso: iguala los tiempos de respuesta cuando el correo no existe.
const DUMMY_HASH = bcrypt.hashSync('contrasena-falsa-para-igualar-tiempos', BCRYPT_COST);

export const hashPassword = (plain) => bcrypt.hash(plain, BCRYPT_COST);
export const publicUser = (u) => ({ id: String(u._id ?? u.id), name: u.name, email: u.email, role: u.role, status: u.status });

export async function createToken(userId, type, ttlMs, meta) {
  const raw = randomToken(type === TOKEN_TYPES.REFRESH ? 48 : 32);
  await AuthToken.create({ user: userId, type, tokenHash: hashToken(raw), expiresAt: new Date(Date.now() + ttlMs), meta });
  return raw;
}

export async function createSession(user, meta) {
  const accessToken = jwt.sign({ sub: String(user._id), role: user.role }, env.JWT_SECRET, {
    algorithm: 'HS256', expiresIn: `${env.ACCESS_TOKEN_TTL_MIN}m`, issuer: 'personal-trainer-app',
  });
  const refreshToken = await createToken(user._id, TOKEN_TYPES.REFRESH, env.REFRESH_TOKEN_TTL_DAYS * 86_400_000, meta);
  return { accessToken, refreshToken, csrfToken: randomToken(24) };
}

export async function login({ email, password }, meta) {
  const user = await User.findOne({ email }).select('+passwordHash +lockUntil');
  if (!user) {
    await bcrypt.compare(password, DUMMY_HASH);
    throw unauthorized('Correo o contraseña incorrectos.', 'INVALID_CREDENTIALS');
  }
  if (user.lockUntil && user.lockUntil > new Date()) {
    throw new AppError(429, 'ACCOUNT_LOCKED', 'Demasiados intentos fallidos. Probá de nuevo en unos minutos.');
  }
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    const updated = await User.findOneAndUpdate({ _id: user._id }, { $inc: { failedLoginCount: 1 } }, { new: true }).select('+failedLoginCount');
    if (updated.failedLoginCount >= MAX_FAILED_LOGINS) {
      await User.updateOne({ _id: user._id }, { failedLoginCount: 0, lockUntil: new Date(Date.now() + LOCK_MINUTES * 60_000) });
    }
    throw unauthorized('Correo o contraseña incorrectos.', 'INVALID_CREDENTIALS');
  }
  if (user.status === USER_STATUS.PENDING) throw forbidden('Todavía no activaste tu cuenta. Revisá el correo de invitación.', 'ACCOUNT_PENDING');
  if (user.status !== USER_STATUS.ACTIVE) throw forbidden('Tu cuenta está inactiva. Contactá a tu entrenador.', 'ACCOUNT_INACTIVE');

  await User.updateOne({ _id: user._id }, { failedLoginCount: 0, lockUntil: null, lastLoginAt: new Date() });
  return { user: publicUser(user), session: await createSession(user, meta) };
}

// Rotación de refresh tokens con detección de reutilización.
export async function refresh(rawToken, meta) {
  const expired = () => unauthorized('Tu sesión expiró.', 'SESSION_EXPIRED');
  if (!rawToken) throw expired();
  const doc = await AuthToken.findOne({ tokenHash: hashToken(rawToken), type: TOKEN_TYPES.REFRESH });
  if (!doc || doc.expiresAt < new Date()) throw expired();

  const claimed = await AuthToken.findOneAndUpdate({ _id: doc._id, usedAt: null }, { usedAt: new Date() });
  if (!claimed) {
    if (doc.usedAt && Date.now() - doc.usedAt.getTime() > REUSE_GRACE_MS) {
      await AuthToken.deleteMany({ user: doc.user, type: TOKEN_TYPES.REFRESH });
      logger.warn({ userId: String(doc.user) }, 'Reutilización de refresh token: sesiones revocadas');
    }
    throw expired();
  }
  const user = await User.findById(doc.user);
  if (!user || user.status !== USER_STATUS.ACTIVE) throw expired();
  return createSession(user, meta);
}

export async function logout(rawToken) {
  if (rawToken) await AuthToken.deleteOne({ tokenHash: hashToken(rawToken), type: TOKEN_TYPES.REFRESH });
}

export async function forgotPassword(email, meta) {
  const user = await User.findOne({ email });
  if (!user || user.status !== USER_STATUS.ACTIVE) return; // respuesta idéntica en todos los casos
  await AuthToken.deleteMany({ user: user._id, type: TOKEN_TYPES.PASSWORD_RESET, usedAt: null });
  const token = await createToken(user._id, TOKEN_TYPES.PASSWORD_RESET, RESET_TTL_MS, meta);
  sendPasswordResetEmail(user, token).catch((err) => logger.error({ err }, 'Fallo al enviar correo'));
}

// Recuperación de contraseña Y activación de cuentas invitadas (mismo mecanismo, token de distinto tipo).
export async function setPasswordWithToken({ token, password }) {
  const doc = await AuthToken.findOneAndUpdate(
    { tokenHash: hashToken(token), type: { $in: [TOKEN_TYPES.PASSWORD_RESET, TOKEN_TYPES.INVITE] }, usedAt: null, expiresAt: { $gt: new Date() } },
    { usedAt: new Date() },
  );
  if (!doc) throw badRequest('El enlace es inválido o ya venció.', 'TOKEN_INVALID');

  await User.updateOne({ _id: doc.user }, { passwordHash: await hashPassword(password), passwordChangedAt: new Date(), failedLoginCount: 0, lockUntil: null });
  if (doc.type === TOKEN_TYPES.INVITE) await User.updateOne({ _id: doc.user, status: USER_STATUS.PENDING }, { status: USER_STATUS.ACTIVE });
  await AuthToken.deleteMany({ user: doc.user, type: TOKEN_TYPES.REFRESH }); // cierra todas las sesiones abiertas
}

export async function getProfile(userId) {
  const user = await User.findById(userId);
  if (!user) throw unauthorized();
  return publicUser(user);
}

export async function changePassword(userId, { currentPassword, newPassword }, meta) {
  const user = await User.findById(userId).select('+passwordHash');
  if (!user || !(await bcrypt.compare(currentPassword, user.passwordHash))) {
    throw new AppError(400, 'INVALID_CURRENT_PASSWORD', 'La contraseña actual es incorrecta.');
  }
  if (currentPassword === newPassword) throw badRequest('La nueva contraseña debe ser distinta de la actual.', 'SAME_PASSWORD');
  await User.updateOne({ _id: user._id }, { passwordHash: await hashPassword(newPassword), passwordChangedAt: new Date() });
  await AuthToken.deleteMany({ user: user._id, type: TOKEN_TYPES.REFRESH }); // cierra las demás sesiones
  return createSession(user, meta);
}
