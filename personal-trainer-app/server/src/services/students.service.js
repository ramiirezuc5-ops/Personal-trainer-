import { USER_STATUS, ROLES } from '../config/constants.js';
import { Appointment } from '../models/Appointment.js';
import { AuthToken } from '../models/AuthToken.js';
import { Membership } from '../models/Membership.js';
import { Routine } from '../models/Routine.js';
import { StudentProfile } from '../models/StudentProfile.js';
import { User } from '../models/User.js';
import { WorkoutLog } from '../models/WorkoutLog.js';
import { TOKEN_TYPES } from '../config/constants.js';
import { conflict, forbidden, notFound } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import { isDup, oid } from '../utils/mongo.js';
import { escapeRegex, pageInfo, pageResult } from '../utils/pagination.js';
import { randomToken } from '../utils/tokens.js';
import { createToken, hashPassword, INVITE_TTL_MS } from './auth.service.js';
import { sendInviteEmail } from './email.service.js';

export function serializeStudent(p, u, { forStudent = false } = {}) {
  const base = {
    id: String(p._id), firstName: p.firstName, lastName: p.lastName, email: u.email, status: u.status,
    phone: p.phone, birthDate: p.birthDate, goal: p.goal, experienceLevel: p.experienceLevel, availability: p.availability,
    studentEditableFields: p.studentEditableFields, joinedAt: p.joinedAt, createdAt: p.createdAt,
  };
  return forStudent ? base : { ...base, notes: p.notes }; // las observaciones del entrenador son privadas
}

async function sendInvite(trainerName, user, meta) {
  await AuthToken.deleteMany({ user: user._id, type: TOKEN_TYPES.INVITE, usedAt: null });
  const token = await createToken(user._id, TOKEN_TYPES.INVITE, INVITE_TTL_MS, meta);
  sendInviteEmail(user, trainerName, token).catch((err) => logger.error({ err }, 'Fallo al enviar invitación'));
}

export async function createStudent(trainer, input, meta) {
  if (await User.exists({ email: input.email })) throw conflict('Ya existe un usuario con ese correo.', 'EMAIL_TAKEN');
  let user;
  try {
    user = await User.create({
      name: `${input.firstName} ${input.lastName}`, email: input.email, role: ROLES.STUDENT, status: USER_STATUS.PENDING,
      passwordHash: await hashPassword(randomToken(24)), // contraseña inutilizable hasta que el alumno active su cuenta
    });
  } catch (err) {
    if (isDup(err)) throw conflict('Ya existe un usuario con ese correo.', 'EMAIL_TAKEN');
    throw err;
  }
  const { email, ...fields } = input;
  let profile;
  try {
    profile = await StudentProfile.create({ ...fields, trainer: trainer.id, user: user._id });
  } catch (err) {
    await User.deleteOne({ _id: user._id }); // no dejar usuarios sin ficha
    throw err;
  }
  await sendInvite(trainer.name, user, meta);
  return serializeStudent(profile, user);
}

export async function listStudents(trainerId, q) {
  const info = pageInfo(q);
  const match = { trainer: oid(trainerId) };
  if (q.level) match.experienceLevel = q.level;
  const post = {};
  if (q.status) post['user.status'] = q.status;
  if (q.q) { const rx = new RegExp(escapeRegex(q.q), 'i'); post.$or = [{ firstName: rx }, { lastName: rx }, { 'user.email': rx }]; }
  const sort = q.sort === 'recent' ? { createdAt: -1, _id: -1 } : { lastName: 1, firstName: 1, _id: 1 };
  const [res] = await StudentProfile.aggregate([
    { $match: match },
    { $lookup: { from: 'users', localField: 'user', foreignField: '_id', as: 'user' } },
    { $unwind: '$user' },
    { $project: { 'user.passwordHash': 0, 'user.failedLoginCount': 0, 'user.lockUntil': 0 } },
    { $match: post },
    { $sort: sort },
    { $facet: { items: [{ $skip: info.skip }, { $limit: info.limit }], total: [{ $count: 'n' }] } },
  ]);
  const items = res.items.map(({ user, ...p }) => serializeStudent(p, user));
  return pageResult(items, res.total[0]?.n ?? 0, info);
}

async function loadOwned(trainerId, id) {
  const profile = await StudentProfile.findOne({ _id: id, trainer: trainerId });
  if (!profile) throw notFound('Alumno no encontrado.', 'STUDENT_NOT_FOUND');
  const user = await User.findById(profile.user);
  return { profile, user };
}

export async function getStudent(trainerId, id) {
  const { profile, user } = await loadOwned(trainerId, id);
  const now = new Date();
  const [activeRoutines, lastWorkout, nextAppointment, membership] = await Promise.all([
    Routine.countDocuments({ trainer: trainerId, student: profile._id, status: 'activa' }),
    WorkoutLog.findOne({ student: profile._id }).sort({ performedAt: -1 }).select('performedAt'),
    Appointment.findOne({ trainer: trainerId, student: profile._id, active: true, status: { $in: ['reservado', 'confirmado'] }, start: { $gte: now } }).sort({ start: 1 }).select('start end status'),
    Membership.findOne({ trainer: trainerId, student: profile._id, status: { $in: ['activa', 'pendiente'] } }).sort({ endDate: -1 }).select('status startDate endDate'),
  ]);
  return { ...serializeStudent(profile, user), summary: { activeRoutines, lastWorkoutAt: lastWorkout?.performedAt ?? null, nextAppointment, membership } };
}

export async function updateStudent(trainerId, id, patch) {
  const { profile, user } = await loadOwned(trainerId, id);
  const { email, ...rest } = patch;
  if (email && email !== user.email) {
    if (await User.exists({ email, _id: { $ne: user._id } })) throw conflict('Ya existe un usuario con ese correo.', 'EMAIL_TAKEN');
    user.email = email;
  }
  Object.assign(profile, rest);
  user.name = `${profile.firstName} ${profile.lastName}`;
  try { await profile.save(); await user.save(); } catch (err) { if (isDup(err)) throw conflict('Ya existe un usuario con ese correo.', 'EMAIL_TAKEN'); throw err; }
  return serializeStudent(profile, user);
}

// Desactivar NO borra nada: conserva rutinas, turnos, pagos y mediciones.
export async function deactivateStudent(trainerId, id) {
  const { profile, user } = await loadOwned(trainerId, id);
  user.status = USER_STATUS.INACTIVE;
  await user.save();
  await AuthToken.deleteMany({ user: user._id, type: TOKEN_TYPES.REFRESH });
  return serializeStudent(profile, user);
}

export async function reactivateStudent(trainer, id, meta) {
  const { profile, user } = await loadOwned(trainer.id, id);
  const neverActivated = !user.passwordChangedAt;
  user.status = neverActivated ? USER_STATUS.PENDING : USER_STATUS.ACTIVE;
  await user.save();
  if (neverActivated) await sendInvite(trainer.name, user, meta);
  return serializeStudent(profile, user);
}

export async function resendInvite(trainer, id, meta) {
  const { user } = await loadOwned(trainer.id, id);
  if (user.status !== USER_STATUS.PENDING) throw conflict('La cuenta ya fue activada.', 'ALREADY_ACTIVE');
  await sendInvite(trainer.name, user, meta);
}

/* ---------- el propio alumno ---------- */
export async function getMyProfile(me) {
  const profile = await StudentProfile.findOne({ _id: me.studentId, trainer: me.trainerId });
  if (!profile) throw notFound();
  return serializeStudent(profile, await User.findById(profile.user), { forStudent: true });
}

export async function updateMyProfile(me, patch) {
  const profile = await StudentProfile.findOne({ _id: me.studentId, trainer: me.trainerId });
  if (!profile) throw notFound();
  const blocked = Object.keys(patch).filter((k) => !profile.studentEditableFields.includes(k));
  if (blocked.length) throw forbidden(`Tu entrenador no habilitó la edición de: ${blocked.join(', ')}.`, 'FIELD_NOT_EDITABLE');
  Object.assign(profile, patch);
  await profile.save();
  return serializeStudent(profile, await User.findById(profile.user), { forStudent: true });
}
