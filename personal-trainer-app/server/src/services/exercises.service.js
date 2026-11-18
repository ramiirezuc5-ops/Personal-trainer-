import { Exercise } from '../models/Exercise.js';
import { Routine } from '../models/Routine.js';
import { conflict, notFound } from '../utils/errors.js';
import { isDup } from '../utils/mongo.js';
import { escapeRegex, pageInfo, pageResult } from '../utils/pagination.js';

const dupError = () => conflict('Ya existe un ejercicio con ese nombre.', 'DUPLICATE_EXERCISE');

export async function createExercise(trainerId, input) {
  try { return await Exercise.create({ ...input, trainer: trainerId, nameKey: input.name.toLowerCase() }); } catch (err) { if (isDup(err)) throw dupError(); throw err; }
}

export async function listExercises(trainerId, q) {
  const info = pageInfo(q);
  const filter = { trainer: trainerId, archived: q.archived };
  if (q.muscleGroup) filter.muscleGroup = q.muscleGroup;
  if (q.q) filter.name = new RegExp(escapeRegex(q.q), 'i');
  const [items, total] = await Promise.all([Exercise.find(filter).sort({ nameKey: 1 }).skip(info.skip).limit(info.limit), Exercise.countDocuments(filter)]);
  return pageResult(items, total, info);
}

export async function getExercise(trainerId, id) {
  const ex = await Exercise.findOne({ _id: id, trainer: trainerId });
  if (!ex) throw notFound('Ejercicio no encontrado.');
  return ex;
}

export async function updateExercise(trainerId, id, patch) {
  const ex = await getExercise(trainerId, id);
  Object.assign(ex, patch);
  if (patch.name) ex.nameKey = patch.name.toLowerCase();
  try { await ex.save(); } catch (err) { if (isDup(err)) throw dupError(); throw err; }
  return ex;
}

// Archivar en lugar de borrar: las rutinas históricas siguen mostrando el ejercicio.
export async function setArchived(trainerId, id, archived) {
  const ex = await getExercise(trainerId, id);
  ex.archived = archived;
  await ex.save();
  return ex;
}

// Borrado real: solo si ninguna rutina (de cualquier estado, incluidas archivadas) lo usa. Si lo usa, se pide archivar en su lugar.
export async function deleteExercise(trainerId, id) {
  const ex = await getExercise(trainerId, id);
  const inUse = await Routine.exists({ trainer: trainerId, 'days.exercises.exercise': ex._id });
  if (inUse) throw conflict('Este ejercicio está usado en una o más rutinas. Archivalo en vez de eliminarlo, o quitalo primero de esas rutinas.', 'EXERCISE_IN_USE');
  await ex.deleteOne();
}
