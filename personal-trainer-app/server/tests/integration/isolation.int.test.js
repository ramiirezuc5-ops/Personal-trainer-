import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { boot, Client, makeExercise, makeStudent, makeTrainer, routineBody, skip } from './helpers.js';

describe('permisos y aislamiento entre usuarios (MongoDB real)', { skip }, () => {
  let ctx; let A; let B; let a1; let a2; let b1; let exA; let routineA2;
  before(async () => {
    ctx = await boot('pt_iso');
    A = await makeTrainer(ctx, 'a@test.com', 'Entrenador A');
    B = await makeTrainer(ctx, 'b@test.com', 'Entrenador B');
    a1 = await makeStudent(ctx, A, { firstName: 'Alba', lastName: 'Uno', email: 'a1@test.com', studentEditableFields: ['phone'] });
    a2 = await makeStudent(ctx, A, { firstName: 'Beto', lastName: 'Dos', email: 'a2@test.com', notes: 'nota privada' });
    b1 = await makeStudent(ctx, B, { firstName: 'Carla', lastName: 'Tres', email: 'b1@test.com' });
    exA = await makeExercise(A, 'Sentadilla');
    routineA2 = (await A.client.post('/routines', routineBody(a2.id, exA))).data._id;
    await A.client.post(`/students/${a2.id}/progress`, { bodyWeight: { value: 80, unit: 'kg' }, trainerNotes: 'solo entrenador' });
    const plan = (await A.client.post('/billing/plans', { name: 'Mensual', price: 1000, durationDays: 30 })).data;
    await A.client.post(`/students/${a2.id}/memberships`, { plan: plan._id });
    await A.client.post(`/students/${a2.id}/payments`, { amount: 1000, method: 'efectivo' });
  });
  after(() => ctx.close());

  test('sin sesión: 401 en cualquier módulo', async () => {
    const anon = new Client(ctx.base);
    for (const p of ['/students', '/exercises', '/routines', '/appointments', '/billing/payments', '/dashboard', '/settings', '/me/profile', '/notifications']) {
      assert.equal((await anon.get(p)).status, 401, p);
    }
  });

  test('un alumno no puede usar ningún endpoint del entrenador (403)', async () => {
    for (const p of ['/students', '/exercises', '/routines', '/appointments', '/billing/payments', '/billing/pending', '/dashboard', '/settings']) {
      assert.equal((await a1.client.get(p)).status, 403, p);
    }
    assert.equal((await a1.client.post('/exercises', { name: 'X', muscleGroup: 'core' })).status, 403);
    assert.equal((await a1.client.post(`/students/${a2.id}/payments`, { amount: 1, method: 'efectivo' })).status, 403);
  });

  test('un entrenador no puede usar los endpoints de alumno (/me)', async () => {
    assert.equal((await A.client.get('/me/profile')).status, 403);
  });

  test('un entrenador solo ve a SUS alumnos; los de otro entrenador devuelven 404', async () => {
    const list = (await A.client.get('/students')).data;
    assert.deepEqual(list.items.map((s) => s.email).sort(), ['a1@test.com', 'a2@test.com']);
    assert.equal((await B.client.get(`/students/${a1.id}`)).status, 404);
    assert.equal((await B.client.patch(`/students/${a1.id}`, { firstName: 'Hack' })).status, 404);
    assert.equal((await B.client.post(`/students/${a1.id}/deactivate`)).status, 404);
    assert.equal((await B.client.get(`/students/${a2.id}/progress`)).status, 404);
    assert.equal((await B.client.get(`/students/${a2.id}/memberships`)).status, 404);
    assert.equal((await B.client.post(`/students/${a2.id}/payments`, { amount: 5, method: 'efectivo' })).status, 404);
  });

  test('un entrenador no accede a rutinas ni ejercicios de otro', async () => {
    assert.equal((await B.client.get(`/routines/${routineA2}`)).status, 404);
    assert.equal((await B.client.patch(`/routines/${routineA2}`, { name: 'Hack' })).status, 404);
    assert.equal((await B.client.get(`/exercises/${exA}`)).status, 404);
    assert.equal((await B.client.get('/routines')).data.total, 0);
    // no puede asignar rutinas a alumnos ajenos ni usar ejercicios ajenos
    assert.equal((await B.client.post('/routines', routineBody(a1.id, exA))).status, 404);
    const exB = await makeExercise(B, 'Plancha', 'core');
    assert.equal((await B.client.post('/routines', routineBody(b1.id, exA))).status, 400);
    assert.equal((await B.client.post('/routines', routineBody(b1.id, exB))).status, 201);
  });

  test('un alumno no puede ver datos de otro alumno (mismo ni distinto entrenador)', async () => {
    assert.equal((await a1.client.get(`/me/routines/${routineA2}`)).status, 404);
    assert.deepEqual((await a1.client.get('/me/routines')).data, []);
    assert.equal((await a1.client.get('/me/progress')).data.total, 0);
    assert.equal((await a1.client.get('/me/billing')).data.payments.length, 0);
    assert.equal((await a1.client.get('/me/workouts')).data.total, 0);
    assert.equal((await b1.client.get(`/me/routines/${routineA2}`)).status, 404);
  });

  test('el alumno ve lo suyo pero nunca las notas privadas del entrenador', async () => {
    const mine = (await a2.client.get('/me/profile')).data;
    assert.equal(mine.email, 'a2@test.com');
    assert.equal(mine.notes, undefined);
    const prog = (await a2.client.get('/me/progress')).data.items;
    assert.equal(prog.length, 1);
    assert.equal(prog[0].trainerNotes, undefined);
    assert.equal((await A.client.get(`/students/${a2.id}/progress`)).data.items[0].trainerNotes, 'solo entrenador');
    assert.equal((await a2.client.get('/me/routines')).data.length, 1);
    assert.equal((await a2.client.get('/me/billing')).data.payments.length, 1);
    assert.equal((await a2.client.get(`/me/routines/${routineA2}`)).status, 200);
  });

  test('asignación masiva: el alumno no puede cambiar rol, entrenador ni campos no habilitados', async () => {
    assert.equal((await a1.client.patch('/me/profile', { role: 'trainer' })).status, 400);
    assert.equal((await a1.client.patch('/me/profile', { trainer: b1.id })).status, 400);
    assert.equal((await a1.client.patch('/me/profile', { notes: 'x' })).status, 400);
    assert.equal((await a1.client.patch('/me/profile', { studentEditableFields: ['goal'] })).status, 400);
    const blocked = await a1.client.patch('/me/profile', { goal: 'otro objetivo' }); // goal no está habilitado para a1
    assert.equal(blocked.status, 403);
    assert.equal(blocked.data.error.code, 'FIELD_NOT_EDITABLE');
    const ok = await a1.client.patch('/me/profile', { phone: '1155550000' });
    assert.equal(ok.status, 200);
    assert.equal(ok.data.phone, '1155550000');
    const prof = await ctx.models.StudentProfile.findById(a1.id);
    assert.equal(String(prof.trainer), String(A.user._id)); // sigue siendo del mismo entrenador
  });

  test('el alumno no puede registrar progreso con notas del entrenador ni a nombre de otro', async () => {
    assert.equal((await a1.client.post('/me/progress', { bodyWeight: { value: 60, unit: 'kg' }, trainerNotes: 'hack' })).status, 400);
    assert.equal((await a1.client.post('/me/progress', { student: a2.id, bodyWeight: { value: 60, unit: 'kg' } })).status, 400);
    assert.equal((await a1.client.post('/me/progress', { bodyWeight: { value: 60, unit: 'kg' } })).status, 201);
    assert.equal((await a2.client.get('/me/progress')).data.total, 1); // el registro de a1 no aparece en a2
  });

  test('identificadores inválidos o inexistentes no filtran información', async () => {
    assert.equal((await A.client.get('/students/no-es-un-id')).status, 400);
    assert.equal((await A.client.get('/students/aaaaaaaaaaaaaaaaaaaaaaaa')).status, 404);
    assert.equal((await A.client.get('/students?status[$ne]=x')).status, 400);
  });
});
