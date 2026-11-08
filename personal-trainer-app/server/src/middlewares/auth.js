import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { ROLES, USER_STATUS } from '../config/constants.js';
import { hasPermission } from '../config/permissions.js';
import { StudentProfile } from '../models/StudentProfile.js';
import { User } from '../models/User.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ACCESS_COOKIE } from '../utils/cookies.js';
import { forbidden, unauthorized } from '../utils/errors.js';

// Verifica el token y consulta al usuario en CADA petición protegida: desactivar una cuenta o cambiar
// la contraseña surte efecto de inmediato. Deja en req.user todo lo necesario para filtrar por propiedad.
export const authenticate = asyncHandler(async (req, _res, next) => {
  const token = req.cookies?.[ACCESS_COOKIE];
  if (!token) throw unauthorized();

  let payload;
  try {
    payload = jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'], issuer: 'personal-trainer-app' });
  } catch {
    throw unauthorized('Tu sesión expiró. Volvé a iniciar sesión.', 'TOKEN_EXPIRED');
  }

  const user = await User.findById(payload.sub).select('name email role status passwordChangedAt');
  if (!user) throw unauthorized();
  if (user.status !== USER_STATUS.ACTIVE) throw forbidden('Tu cuenta no está activa.', 'ACCOUNT_INACTIVE');
  if (user.passwordChangedAt && payload.iat < Math.floor(user.passwordChangedAt.getTime() / 1000)) {
    throw unauthorized('Tu contraseña cambió. Volvé a iniciar sesión.', 'TOKEN_REVOKED');
  }

  req.user = { id: String(user._id), name: user.name, email: user.email, role: user.role };
  if (user.role === ROLES.STUDENT) {
    const profile = await StudentProfile.findOne({ user: user._id }).select('trainer');
    if (!profile) throw forbidden('Tu perfil de alumno no está disponible.', 'NO_STUDENT_PROFILE');
    req.user.studentId = String(profile._id);
    req.user.trainerId = String(profile.trainer);
  }
  return next();
});

export const authorize = (...permissions) => (req, _res, next) => {
  if (!req.user) return next(unauthorized());
  return permissions.every((p) => hasPermission(req.user.role, p)) ? next() : next(forbidden());
};

export const requireRole = (...roles) => (req, _res, next) => {
  if (!req.user) return next(unauthorized());
  return roles.includes(req.user.role) ? next() : next(forbidden());
};
