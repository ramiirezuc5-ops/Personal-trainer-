import test from 'node:test';
import assert from 'node:assert/strict';
import './setupEnv.js';
const { hasPermission } = await import('../src/config/permissions.js');

test('el entrenador gestiona todos los módulos del negocio', () => {
  for (const p of ['students:manage', 'routines:manage', 'appointments:manage', 'payments:manage', 'stats:read', 'settings:manage']) {
    assert.equal(hasPermission('trainer', p), true, p);
  }
});
test('el alumno no tiene ningún permiso de gestión', () => {
  for (const p of ['students:manage', 'routines:manage', 'exercises:manage', 'payments:manage', 'plans:manage', 'stats:read', 'settings:manage']) {
    assert.equal(hasPermission('student', p), false, p);
  }
});
test('el alumno solo tiene permisos sobre lo propio', () => {
  for (const p of ['self:read', 'routines:read-own', 'workouts:log-own', 'progress:own', 'appointments:own', 'payments:read-own']) {
    assert.equal(hasPermission('student', p), true, p);
  }
});
test('un rol desconocido no tiene permisos', () => {
  assert.equal(hasPermission('hacker', 'students:manage'), false);
});
