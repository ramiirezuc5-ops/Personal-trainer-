import test from 'node:test';
import assert from 'node:assert/strict';
import './setupEnv.js';
const { scopeFor, pick } = await import('../src/utils/ownership.js');

test('entrenador: el filtro limita al tenant propio', () => {
  assert.deepEqual(scopeFor({ role: 'trainer', id: 'T1' }), { trainer: 'T1' });
});
test('alumno: el filtro limita a su entrenador Y a su propio perfil', () => {
  assert.deepEqual(scopeFor({ role: 'student', id: 'U9', studentId: 'S1', trainerId: 'T1' }), { trainer: 'T1', student: 'S1' });
});
test('alumno consultando su propio perfil usa _id', () => {
  assert.deepEqual(scopeFor({ role: 'student', studentId: 'S1', trainerId: 'T1' }, { studentField: '_id' }), { trainer: 'T1', _id: 'S1' });
});
test('un alumno sin perfil, un rol desconocido o ausencia de usuario son rechazados', () => {
  assert.throws(() => scopeFor({ role: 'student', id: 'U9' }), (e) => e.status === 403);
  assert.throws(() => scopeFor({ role: 'otro' }), (e) => e.status === 403);
  assert.throws(() => scopeFor(undefined), (e) => e.status === 403);
});
test('pick copia solo campos permitidos (anti asignación masiva)', () => {
  const body = { phone: '1', role: 'trainer', trainer: 'X', status: 'active' };
  assert.deepEqual(pick(body, ['phone', 'availability']), { phone: '1' });
});
