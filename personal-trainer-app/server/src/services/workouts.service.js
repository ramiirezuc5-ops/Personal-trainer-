import { Exercise } from '../models/Exercise.js';
import { Routine } from '../models/Routine.js';
import { WorkoutLog } from '../models/WorkoutLog.js';
import { badRequest, notFound } from '../utils/errors.js';
import { isDup } from '../utils/mongo.js';
import { scopeFor } from '../utils/ownership.js';
import { pageInfo, pageResult } from '../utils/pagination.js';

const MAX_BACKDATE_MS = 14 * 86_400_000;

// Idempotente: reenviar el mismo clientRequestId (doble clic, reintento por mala conexión) devuelve el registro existente.
export async function logWorkout(me, input) {
  const routine = await Routine.findOne({ _id: input.routine, ...scopeFor(me), status: 'activa' });
  if (!routine) throw notFound('Rutina no encontrada o no está activa.', 'ROUTINE_NOT_FOUND');
  const day = routine.days.id(input.dayId);
  if (!day) throw badRequest('Ese día no pertenece a la rutina.', 'DAY_NOT_FOUND');

  // Además de los ejercicios planificados para el día, el alumno puede sumar otros de su propio
  // catálogo (los que carga su entrenador). Solo se rechazan ids que no pertenezcan a ninguno de los dos.
  const allowed = new Set(day.exercises.map((e) => String(e.exercise)));
  const extra = input.exercises.filter((e) => !allowed.has(e.exercise));
  if (extra.length) {
    const valid = await Exercise.find({ _id: { $in: extra.map((e) => e.exercise) }, trainer: me.trainerId, archived: false }).select('_id').lean();
    const validIds = new Set(valid.map((v) => String(v._id)));
    if (extra.some((e) => !validIds.has(e.exercise))) throw badRequest('Hay ejercicios que no pertenecen a ese día ni a tu catálogo.', 'EXERCISE_NOT_IN_DAY');
  }

  const performedAt = input.performedAt ?? new Date();
  if (performedAt.getTime() > Date.now() + 5 * 60_000) throw badRequest('La fecha del entrenamiento no puede ser futura.', 'FUTURE_DATE');
  if (performedAt.getTime() < Date.now() - MAX_BACKDATE_MS) throw badRequest('Solo podés registrar entrenamientos de los últimos 14 días.', 'TOO_OLD');

  const exercises = input.exercises.length ? input.exercises : day.exercises.map((e) => ({ exercise: e.exercise, completed: true, sets: [] }));
  try {
    const log = await WorkoutLog.create({
      trainer: me.trainerId, student: me.studentId, routine: routine._id, dayId: day._id, performedAt,
      exercises, durationMinutes: input.durationMinutes, notes: input.notes, clientRequestId: input.clientRequestId,
    });
    return { log, duplicate: false };
  } catch (err) {
    if (!isDup(err)) throw err;
    return { log: await WorkoutLog.findOne({ student: me.studentId, clientRequestId: input.clientRequestId }), duplicate: true };
  }
}

export async function listWorkouts(scope, q) {
  const info = pageInfo(q);
  const filter = { ...scope };
  if (q.from || q.to) filter.performedAt = { ...(q.from && { $gte: q.from }), ...(q.to && { $lte: q.to }) };
  const [items, total] = await Promise.all([
    WorkoutLog.find(filter).sort({ performedAt: -1 }).skip(info.skip).limit(info.limit).populate('routine', 'name').populate('exercises.exercise', 'name'),
    WorkoutLog.countDocuments(filter),
  ]);
  return pageResult(items, total, info);
}

// Cumplimiento = entrenamientos registrados / entrenamientos esperados (días de las rutinas activas × semanas del período).
// Es una aproximación orientativa, no una evaluación profesional.
export async function compliance(scope, from, to) {
  const routines = await Routine.find({ ...scope, status: { $in: ['activa', 'finalizada'] }, startDate: { $lte: to }, $or: [{ endDate: null }, { endDate: { $gte: from } }] }).select('days startDate endDate');
  let expected = 0;
  for (const r of routines) {
    const s = Math.max(r.startDate.getTime(), from.getTime());
    const e = Math.min(r.endDate ? r.endDate.getTime() : to.getTime(), to.getTime());
    if (e > s) expected += r.days.length * ((e - s) / (7 * 86_400_000));
  }
  const completed = await WorkoutLog.countDocuments({ ...scope, performedAt: { $gte: from, $lte: to } });
  expected = Math.round(expected);
  return { expected, completed, percentage: expected > 0 ? Math.min(100, Math.round((completed / expected) * 100)) : null };
}

// "Anterior" por ejercicio: el último registro (completado) en el que el alumno hizo ese ejercicio, con sus series.
// Una consulta por ejercicio (son pocos, los de un día) en vez de revisar todo el historial, para no perder
// el dato si el ejercicio no apareció en los entrenamientos más recientes.
export async function lastPerformance(scope, exerciseIds) {
  const entries = await Promise.all(exerciseIds.map(async (id) => {
    const log = await WorkoutLog.findOne({ ...scope, exercises: { $elemMatch: { exercise: id, completed: true } } })
      .sort({ performedAt: -1 }).select('performedAt exercises').lean();
    if (!log) return [id, null];
    const ex = log.exercises.find((e) => String(e.exercise) === String(id));
    return [id, { performedAt: log.performedAt, sets: ex?.sets ?? [] }];
  }));
  return Object.fromEntries(entries);
}
