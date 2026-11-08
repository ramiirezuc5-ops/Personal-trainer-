import { Appointment } from '../models/Appointment.js';
import { Notification } from '../models/Notification.js';
import { StudentProfile } from '../models/StudentProfile.js';
import { TrainerProfile } from '../models/TrainerProfile.js';
import { badRequest, conflict, forbidden, notFound } from '../utils/errors.js';
import { BLOCK_MS, isAligned, localDayRange, parseYmd, slotBlocks, tzParts, zonedInstant } from '../utils/dates.js';
import { isDup } from '../utils/mongo.js';
import { scopeFor } from '../utils/ownership.js';
import { pageInfo, pageResult } from '../utils/pagination.js';

const MAX_DURATION_MS = 8 * 3_600_000;
const LIVE = ['reservado', 'confirmado'];
const slotTaken = () => conflict('Ese horario ya está ocupado.', 'SLOT_TAKEN');

function validateRange(start, end) {
  if (end <= start) throw badRequest('La finalización debe ser posterior al inicio.', 'INVALID_RANGE');
  if (!isAligned(start) || !isAligned(end)) throw badRequest('Los horarios deben ser múltiplos de 15 minutos.', 'UNALIGNED_TIME');
  if (end - start > MAX_DURATION_MS) throw badRequest('Un turno no puede durar más de 8 horas.', 'TOO_LONG');
}

// La unicidad de bloques de 15 min en la base impide superposiciones, incluso con reservas simultáneas.
async function insert(trainerId, data) {
  try { return await Appointment.create({ ...data, trainer: trainerId, blocks: slotBlocks(trainerId, data.start, data.end), active: true }); } catch (err) { if (isDup(err)) throw slotTaken(); throw err; }
}

const trainerProfile = async (trainerId) => {
  const p = await TrainerProfile.findOne({ user: trainerId });
  if (!p) throw notFound('Configuración del entrenador no encontrada.');
  return p;
};

async function notify(userId, title, link) { await Notification.create({ user: userId, type: 'turno', title, link }); }

/* ---------- entrenador ---------- */
export async function createByTrainer(trainer, input) {
  if (!(await StudentProfile.exists({ _id: input.student, trainer: trainer.id }))) throw notFound('Alumno no encontrado.', 'STUDENT_NOT_FOUND');
  validateRange(input.start, input.end);
  return insert(trainer.id, { student: input.student, start: input.start, end: input.end, type: input.type, notes: input.notes, status: input.status, createdBy: trainer.id });
}

export async function listAppointments(scope, q) {
  const info = pageInfo(q);
  const filter = { ...scope };
  if (q.status) filter.status = q.status;
  if (q.student) filter.student = q.student;
  if (q.from) filter.end = { $gt: q.from };
  if (q.to) filter.start = { $lt: q.to };
  const [items, total] = await Promise.all([
    Appointment.find(filter).sort({ start: 1 }).skip(info.skip).limit(info.limit).populate('student', 'firstName lastName'),
    Appointment.countDocuments(filter),
  ]);
  return pageResult(items, total, info);
}

export async function reschedule(trainer, id, { start, end }) {
  validateRange(start, end);
  const current = await Appointment.findOne({ _id: id, trainer: trainer.id });
  if (!current) throw notFound('Turno no encontrado.');
  if (!LIVE.includes(current.status)) throw conflict('Solo se pueden reprogramar turnos reservados o confirmados.', 'INVALID_STATE');
  // Actualización atómica en el mismo documento: el índice único no lo confunde con una superposición consigo mismo.
  try {
    const updated = await Appointment.findOneAndUpdate(
      { _id: id, trainer: trainer.id, status: { $in: LIVE } },
      { $set: { start, end, blocks: slotBlocks(trainer.id, start, end) }, $push: { history: { start: current.start, end: current.end, at: new Date(), by: trainer.id } } },
      { new: true },
    );
    if (!updated) throw conflict('El turno cambió de estado.', 'INVALID_STATE');
    return updated;
  } catch (err) { if (isDup(err)) throw slotTaken(); throw err; }
}

export async function setStatus(trainer, id, status) {
  const from = status === 'confirmado' ? ['reservado'] : LIVE;
  const updated = await Appointment.findOneAndUpdate({ _id: id, trainer: trainer.id, status: { $in: from } }, { $set: { status } }, { new: true });
  if (updated) return updated;
  if (!(await Appointment.exists({ _id: id, trainer: trainer.id }))) throw notFound('Turno no encontrado.');
  throw conflict('El turno no puede pasar a ese estado.', 'INVALID_STATE');
}

async function cancelWhere(filter, by, reason) {
  return Appointment.findOneAndUpdate({ ...filter, status: { $in: LIVE } }, { $set: { status: 'cancelado', active: false, cancellation: { at: new Date(), by, reason } } }, { new: true });
}

export async function cancelByTrainer(trainer, id, reason) {
  const updated = await cancelWhere({ _id: id, trainer: trainer.id }, trainer.id, reason);
  if (updated) return updated;
  if (!(await Appointment.exists({ _id: id, trainer: trainer.id }))) throw notFound('Turno no encontrado.');
  throw conflict('Ese turno ya no se puede cancelar.', 'INVALID_STATE');
}

/* ---------- alumno ---------- */
async function slotsForDay(profile, trainerId, ymd) {
  const tz = profile.timezone;
  const { y, m, d } = parseYmd(ymd);
  const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  const stepMs = profile.booking.slotMinutes * 60_000;
  const now = Date.now();
  const minStart = now + profile.booking.minNoticeHours * 3_600_000;
  const maxStart = now + profile.booking.maxAdvanceDays * 86_400_000;
  const [dayStart, dayEnd] = localDayRange(ymd, tz);
  const taken = await Appointment.find({ trainer: trainerId, active: true, start: { $lt: dayEnd }, end: { $gt: dayStart } }).select('start end');
  const slots = [];
  for (const h of profile.workingHours.filter((x) => x.weekday === weekday)) {
    const [sh, sm] = h.start.split(':').map(Number);
    const [eh, em] = h.end.split(':').map(Number);
    const endT = zonedInstant(y, m, d, eh, em, tz).getTime();
    for (let t = zonedInstant(y, m, d, sh, sm, tz).getTime(); t + stepMs <= endT; t += stepMs) {
      if (t < minStart || t > maxStart) continue;
      if (taken.some((a) => a.start.getTime() < t + stepMs && a.end.getTime() > t)) continue;
      slots.push(new Date(t));
    }
  }
  return slots;
}

export async function availability(me, ymd) {
  const profile = await trainerProfile(me.trainerId);
  if (!profile.booking.allowStudentBooking) return { enabled: false, timezone: profile.timezone, slots: [] };
  return { enabled: true, timezone: profile.timezone, slotMinutes: profile.booking.slotMinutes, slots: await slotsForDay(profile, me.trainerId, ymd) };
}

export async function bookAsStudent(me, { start, notes }) {
  const profile = await trainerProfile(me.trainerId);
  if (!profile.booking.allowStudentBooking) throw forbidden('Tu entrenador no habilitó la reserva online.', 'BOOKING_DISABLED');
  const allowed = await slotsForDay(profile, me.trainerId, tzParts(start, profile.timezone).ymd);
  if (!allowed.some((s) => s.getTime() === start.getTime())) throw badRequest('Ese horario no está disponible para reservar.', 'SLOT_NOT_AVAILABLE');
  const end = new Date(start.getTime() + profile.booking.slotMinutes * 60_000);
  const appt = await insert(me.trainerId, { student: me.studentId, start, end, notes, status: 'reservado', createdBy: me.id });
  const s = await StudentProfile.findById(me.studentId).select('firstName lastName');
  await notify(me.trainerId, `${s.firstName} ${s.lastName} reservó un turno`, '/agenda');
  return appt;
}

export async function cancelAsStudent(me, id) {
  const profile = await trainerProfile(me.trainerId);
  const appt = await Appointment.findOne({ _id: id, ...scopeFor(me) });
  if (!appt) throw notFound('Turno no encontrado.');
  if (!LIVE.includes(appt.status)) throw conflict('Ese turno ya no se puede cancelar.', 'INVALID_STATE');
  if (appt.start.getTime() - Date.now() < profile.booking.cancellationHours * 3_600_000) {
    throw forbidden(`Podés cancelar hasta ${profile.booking.cancellationHours} h antes. Comunicate con tu entrenador.`, 'CANCELLATION_WINDOW');
  }
  const updated = await cancelWhere({ _id: id, ...scopeFor(me) }, me.id, 'Cancelado por el alumno');
  if (!updated) throw conflict('Ese turno ya no se puede cancelar.', 'INVALID_STATE');
  const s = await StudentProfile.findById(me.studentId).select('firstName lastName');
  await notify(me.trainerId, `${s.firstName} ${s.lastName} canceló un turno`, '/agenda');
  return updated;
}

export { BLOCK_MS };
