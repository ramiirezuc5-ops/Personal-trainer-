import { ROLES } from './constants.js';

// La autorización por ROL se complementa SIEMPRE con la verificación de PROPIEDAD del recurso
// (ver utils/ownership.js): un permiso no basta para leer datos de otro alumno u otro entrenador.
const matrix = {
  [ROLES.TRAINER]: [
    'students:manage', 'exercises:manage', 'routines:manage', 'progress:manage',
    'appointments:manage', 'plans:manage', 'payments:manage', 'stats:read', 'settings:manage',
  ],
  [ROLES.STUDENT]: [
    'self:read', 'self:update', 'routines:read-own', 'workouts:log-own', 'progress:own',
    'appointments:own', 'payments:read-own',
  ],
};

export const hasPermission = (role, permission) => (matrix[role] ?? []).includes(permission);
export const permissionsOf = (role) => [...(matrix[role] ?? [])];
