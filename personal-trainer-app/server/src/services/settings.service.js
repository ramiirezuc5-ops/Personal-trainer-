import { TrainerProfile } from '../models/TrainerProfile.js';
import { User } from '../models/User.js';
import { badRequest, notFound } from '../utils/errors.js';

const serialize = (p, u) => ({ ...p.toObject(), name: u.name, email: u.email });

export async function getSettings(trainerId) {
  const [profile, user] = await Promise.all([TrainerProfile.findOne({ user: trainerId }), User.findById(trainerId)]);
  if (!profile || !user) throw notFound('Configuración no encontrada.');
  return serialize(profile, user);
}

export async function updateSettings(trainerId, patch) {
  const [profile, user] = await Promise.all([TrainerProfile.findOne({ user: trainerId }), User.findById(trainerId)]);
  if (!profile || !user) throw notFound('Configuración no encontrada.');
  const { name, notifications, booking, workingHours, ...rest } = patch;
  if (workingHours) {
    const byDay = {};
    for (const h of workingHours) {
      for (const o of byDay[h.weekday] ?? []) if (h.start < o.end && h.end > o.start) throw badRequest('Hay franjas horarias superpuestas en el mismo día.', 'OVERLAPPING_HOURS');
      (byDay[h.weekday] ??= []).push(h);
    }
    profile.workingHours = workingHours;
  }
  Object.assign(profile, rest);
  for (const [k, v] of Object.entries(notifications ?? {})) profile.notifications[k] = v;
  for (const [k, v] of Object.entries(booking ?? {})) profile.booking[k] = v;
  if (name) { user.name = name; await user.save(); }
  await profile.save();
  return serialize(profile, user);
}
