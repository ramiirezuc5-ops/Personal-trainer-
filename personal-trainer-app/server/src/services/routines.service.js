import { Exercise } from '../models/Exercise.js';
import { Notification } from '../models/Notification.js';
import { Routine } from '../models/Routine.js';
import { StudentProfile } from '../models/StudentProfile.js';
import { WorkoutLog } from '../models/WorkoutLog.js';
import { badRequest, conflict, notFound } from '../utils/errors.js';
import { pageInfo, pageResult } from '../utils/pagination.js';
import { scopeFor } from '../utils/ownership.js';

const EXERCISE_FIELDS = 'name muscleGroup equipment instructions commonMistakes media';

async function assertExercisesOwned(trainerId, days) {
  const ids = [...new Set(days.flatMap((d) => d.exercises.map((e) => e.exercise)))];
  const found = await Exercise.countDocuments({ _id: { $in: ids }, trainer: trainerId, archived: false });
  if (found !== ids.length) throw badRequest('Alguno de los ejercicios no existe en tu catálogo o está archivado.', 'EXERCISE_NOT_FOUND');
}

async function notifyStudent(profileId, title) {
  const p = await StudentProfile.findById(profileId).select('user');
  if (p) await Notification.create({ user: p.user, type: 'rutina', title, link: '/mi-rutina' });
}

export async function createRoutine(trainerId, input) {
  const student = await StudentProfile.findOne({ _id: input.student, trainer: trainerId }).select('_id');
  if (!student) throw notFound('Alumno no encontrado.', 'STUDENT_NOT_FOUND');
  await assertExercisesOwned(trainerId, input.days);
  const routine = await Routine.create({ ...input, trainer: trainerId });
  if (routine.status === 'activa') await notifyStudent(student._id, `Nueva rutina asignada: ${routine.name}`);
  return routine;
}

export async function updateRoutine(trainerId, id, patch) {
  const routine = await Routine.findOne({ _id: id, trainer: trainerId });
  if (!routine) throw notFound('Rutina no encontrada.');
  if (patch.days) await assertExercisesOwned(trainerId, patch.days);
  const start = patch.startDate ?? routine.startDate;
  const end = patch.endDate === undefined ? routine.endDate : patch.endDate;
  if (end && end < start) throw badRequest('La fecha de fin no puede ser anterior al inicio.', 'INVALID_DATES');
  Object.assign(routine, patch);
  await routine.save();
  return routine;
}

export async function setRoutineStatus(trainerId, id, status) {
  const routine = await Routine.findOne({ _id: id, trainer: trainerId });
  if (!routine) throw notFound('Rutina no encontrada.');
  const wasActive = routine.status === 'activa';
  routine.status = status;
  await routine.save();
  if (status === 'activa' && !wasActive) await notifyStudent(routine.student, `Nueva rutina asignada: ${routine.name}`);
  return routine;
}

export async function listRoutines(trainerId, q) {
  const info = pageInfo(q);
  const filter = { trainer: trainerId };
  if (q.student) filter.student = q.student;
  if (q.status) filter.status = q.status;
  const [rows, total] = await Promise.all([
    Routine.find(filter).sort({ createdAt: -1 }).skip(info.skip).limit(info.limit).select('-days.exercises').lean({ virtuals: false }),
    Routine.countDocuments(filter),
  ]);
  return pageResult(rows.map((r) => ({ ...r, dayCount: r.days.length })), total, info);
}

export async function getRoutine(trainerId, id) {
  const routine = await Routine.findOne({ _id: id, trainer: trainerId }).populate('days.exercises.exercise', EXERCISE_FIELDS);
  if (!routine) throw notFound('Rutina no encontrada.');
  return routine;
}

/* ---------- el propio alumno: solo rutinas activas o finalizadas, nunca borradores ---------- */
const VISIBLE = { $in: ['activa', 'finalizada'] };

export async function listMyRoutines(me) {
  return Routine.find({ ...scopeFor(me), status: VISIBLE }).sort({ status: 1, startDate: -1 }).select('-days.exercises');
}

export async function getMyRoutine(me, id) {
  const routine = await Routine.findOne({ _id: id, ...scopeFor(me), status: VISIBLE }).populate('days.exercises.exercise', EXERCISE_FIELDS);
  if (!routine) throw notFound('Rutina no encontrada.');
  return routine;
}

// Borrado real: solo si la rutina no tiene entrenamientos registrados (se perdería el historial del alumno).
// Si los tiene, se pide archivarla en su lugar; archivada, el alumno deja de verla pero el historial se conserva.
export async function deleteRoutine(trainerId, id) {
  const routine = await Routine.findOne({ _id: id, trainer: trainerId });
  if (!routine) throw notFound('Rutina no encontrada.');
  const hasLogs = await WorkoutLog.exists({ routine: routine._id });
  if (hasLogs) throw conflict('Esta rutina tiene entrenamientos registrados. Archivala en vez de eliminarla para conservar el historial del alumno.', 'ROUTINE_IN_USE');
  await routine.deleteOne();
}

// Copia completa de la rutina (todos los días y ejercicios) como un nuevo borrador, para ajustarla sin tocar la original.
export async function duplicateRoutine(trainerId, id) {
  const routine = await Routine.findOne({ _id: id, trainer: trainerId }).lean();
  if (!routine) throw notFound('Rutina no encontrada.');
  const { _id, createdAt, updatedAt, __v, isDemo, ...rest } = routine;
  const days = rest.days.map(({ _id: dayId, exercises, ...day }) => ({ ...day, exercises: exercises.map(({ _id: exId, ...ex }) => ex) }));
  return Routine.create({ ...rest, days, name: `${rest.name} (copia)`, status: 'borrador' });
}
