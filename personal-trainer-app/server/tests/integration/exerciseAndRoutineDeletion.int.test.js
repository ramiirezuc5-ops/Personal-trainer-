import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { boot, makeExercise, makeStudent, makeTrainer, routineBody, skip } from './helpers.js';

describe('borrado real y duplicación (MongoDB real)', { skip }, () => {
  let ctx; let T; let s1;

  before(async () => {
    ctx = await boot('pt_delete_dup');
    T = await makeTrainer(ctx, 'ent@test.com');
    s1 = await makeStudent(ctx, T, { firstName: 'Ana', lastName: 'Pérez', email: 'ana@test.com' });
  });
  after(() => ctx.close());

  test('un ejercicio usado en una rutina no se puede borrar; archivado sigue bloqueado', async () => {
    const used = await makeExercise(T, 'Sentadilla', 'piernas');
    const r = await T.client.post('/routines', routineBody(s1.id, used));
    assert.equal(r.status, 201);

    const blocked = await T.client.request('DELETE', `/exercises/${used}`);
    assert.equal(blocked.status, 409);
    assert.equal(blocked.data.error.code, 'EXERCISE_IN_USE');

    // Archivarlo no lo libera: la protección mira si lo usa alguna rutina, no si está activo.
    await T.client.post(`/exercises/${used}/archive`);
    const stillBlocked = await T.client.request('DELETE', `/exercises/${used}`);
    assert.equal(stillBlocked.status, 409);
  });

  test('un ejercicio libre se puede borrar de verdad (ya no aparece en el catálogo)', async () => {
    const free = await makeExercise(T, 'Press banca', 'pecho');
    const del = await T.client.request('DELETE', `/exercises/${free}`);
    assert.equal(del.status, 204);
    const list = await T.client.get('/exercises?archived=false&limit=100');
    assert.ok(!list.data.items.some((e) => e._id === free));
  });

  test('un ejercicio de otro entrenador da 404, nunca 409 (no revela si existe)', async () => {
    const T2 = await makeTrainer(ctx, 'otro@test.com', 'Otro Entrenador');
    const theirs = await makeExercise(T2, 'Remo', 'espalda');
    const res = await T.client.request('DELETE', `/exercises/${theirs}`);
    assert.equal(res.status, 404);
  });

  test('duplicar una rutina crea una copia como borrador, sin afectar la original ni sus entrenamientos', async () => {
    const ex = await makeExercise(T, 'Peso muerto', 'espalda');
    const created = await T.client.post('/routines', routineBody(s1.id, ex, { name: 'Full body', status: 'activa' }));
    const routineId = created.data._id;
    const dayId = created.data.days[0]._id;
    const logged = await s1.client.post('/me/workouts', { routine: routineId, dayId, clientRequestId: 'req-dup-0001' });
    assert.equal(logged.status, 201);

    const dup = await T.client.post(`/routines/${routineId}/duplicate`);
    assert.equal(dup.status, 201);
    assert.equal(dup.data.name, 'Full body (copia)');
    assert.equal(dup.data.status, 'borrador');
    assert.notEqual(dup.data._id, routineId);
    assert.equal(dup.data.days[0].exercises[0].exercise, ex); // mismo ejercicio, mismos datos copiados

    // la original sigue activa, visible para el alumno, con su entrenamiento intacto
    const original = await T.client.get(`/routines/${routineId}`);
    assert.equal(original.data.status, 'activa');
    const mine = await s1.client.get(`/me/routines/${routineId}`);
    assert.equal(mine.status, 200);
  });

  test('una rutina con entrenamientos registrados no se puede borrar; sin entrenamientos sí', async () => {
    const ex = await makeExercise(T, 'Dominadas', 'espalda');
    const withLog = await T.client.post('/routines', routineBody(s1.id, ex, { name: 'Con historial', status: 'activa' }));
    await s1.client.post('/me/workouts', { routine: withLog.data._id, dayId: withLog.data.days[0]._id, clientRequestId: 'req-dup-0002' });
    const blocked = await T.client.request('DELETE', `/routines/${withLog.data._id}`);
    assert.equal(blocked.status, 409);
    assert.equal(blocked.data.error.code, 'ROUTINE_IN_USE');

    const empty = await T.client.post('/routines', routineBody(s1.id, ex, { name: 'Sin historial', status: 'borrador' }));
    const ok = await T.client.request('DELETE', `/routines/${empty.data._id}`);
    assert.equal(ok.status, 204);
    assert.equal((await T.client.get(`/routines/${empty.data._id}`)).status, 404);
  });
});
