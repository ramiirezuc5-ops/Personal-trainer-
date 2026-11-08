import { Exercise } from '../models/Exercise.js';
import { ProgressMeasurement } from '../models/ProgressMeasurement.js';
import { StudentProfile } from '../models/StudentProfile.js';
import { badRequest, notFound } from '../utils/errors.js';
import { pageInfo, pageResult } from '../utils/pagination.js';

// Cada medición es un registro NUEVO: nunca se edita ni se sobrescribe, así se pueden comparar períodos.
export async function createMeasurement(actor, studentId, input) {
  const isTrainer = actor.role === 'trainer';
  const trainerId = isTrainer ? actor.id : actor.trainerId;
  const targetStudent = isTrainer ? studentId : actor.studentId;
  if (isTrainer && !(await StudentProfile.exists({ _id: targetStudent, trainer: trainerId }))) throw notFound('Alumno no encontrado.', 'STUDENT_NOT_FOUND');

  const measuredAt = input.measuredAt ?? new Date();
  if (measuredAt.getTime() > Date.now() + 5 * 60_000) throw badRequest('La fecha de la medición no puede ser futura.', 'FUTURE_DATE');

  const exIds = [...new Set((input.performance ?? []).map((p) => p.exercise).filter(Boolean))];
  if (exIds.length && (await Exercise.countDocuments({ _id: { $in: exIds }, trainer: trainerId })) !== exIds.length) throw badRequest('Algún ejercicio no existe en el catálogo.', 'EXERCISE_NOT_FOUND');

  return ProgressMeasurement.create({ ...input, measuredAt, trainer: trainerId, student: targetStudent, recordedBy: actor.id, ...(isTrainer ? {} : { trainerNotes: '' }) });
}

export async function listMeasurements(scope, q, { includeNotes }) {
  const info = pageInfo(q);
  const filter = { ...scope };
  if (q.from || q.to) filter.measuredAt = { ...(q.from && { $gte: q.from }), ...(q.to && { $lte: q.to }) };
  const select = includeNotes ? '' : '-trainerNotes';
  const [items, total] = await Promise.all([
    ProgressMeasurement.find(filter).sort({ measuredAt: -1 }).skip(info.skip).limit(info.limit).select(select),
    ProgressMeasurement.countDocuments(filter),
  ]);
  return pageResult(items, total, info);
}

async function summarize(scope, from, to) {
  const rows = await ProgressMeasurement.find({ ...scope, measuredAt: { $gte: from, $lte: to } }).sort({ measuredAt: 1 }).select('-trainerNotes');
  const weights = rows.filter((r) => r.bodyWeight?.value != null);
  const measures = {};
  for (const r of rows) for (const m of r.bodyMeasures) measures[m.name] = { value: m.value, unit: m.unit }; // queda el último del período
  const avg = weights.length ? weights.reduce((s, r) => s + r.bodyWeight.value, 0) / weights.length : null;
  return {
    count: rows.length,
    bodyWeight: weights.length ? { first: weights[0].bodyWeight, last: weights.at(-1).bodyWeight, average: avg == null ? null : Math.round(avg * 100) / 100 } : null,
    measures,
  };
}

const delta = (a, b) => (a && b && a.unit === b.unit ? { value: Math.round((b.value - a.value) * 100) / 100, unit: a.unit } : null);

export async function comparePeriods(scope, q) {
  const [periodA, periodB] = await Promise.all([summarize(scope, q.aFrom, q.aTo), summarize(scope, q.bFrom, q.bTo)]);
  const names = new Set([...Object.keys(periodA.measures), ...Object.keys(periodB.measures)]);
  return {
    periodA, periodB,
    delta: {
      bodyWeight: delta(periodA.bodyWeight?.last, periodB.bodyWeight?.last),
      measures: Object.fromEntries([...names].map((n) => [n, delta(periodA.measures[n], periodB.measures[n])])),
    },
  };
}
