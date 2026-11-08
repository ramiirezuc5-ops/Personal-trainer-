import { ROLES } from '../config/constants.js';
import { forbidden } from './errors.js';

// Filtro de propiedad que TODA consulta de negocio debe incluir.
//  - Entrenador: solo documentos de su propio tenant → { trainer: <id> }
//  - Alumno: solo los suyos, dentro de su entrenador → { trainer, student }
// Un recurso ajeno simplemente "no existe" (404), sin revelar que existe.
// Para consultar el propio StudentProfile usar { studentField: '_id' }.
export function scopeFor(user, { studentField = 'student' } = {}) {
  if (user?.role === ROLES.TRAINER) return { trainer: user.id };
  if (user?.role === ROLES.STUDENT && user.studentId && user.trainerId) {
    return { trainer: user.trainerId, [studentField]: user.studentId };
  }
  throw forbidden();
}

// Copia solo los campos permitidos (lista blanca): evita asignación masiva de campos sensibles.
export const pick = (obj, allowed) => Object.fromEntries(allowed.filter((k) => obj && Object.hasOwn(obj, k)).map((k) => [k, obj[k]]));
