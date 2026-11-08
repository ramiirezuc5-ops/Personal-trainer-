import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { boot, Client, makeStudent, makeTrainer, PASS, skip } from './helpers.js';

describe('autenticación (MongoDB real)', { skip }, () => {
  let ctx; let trainer;
  before(async () => { ctx = await boot('pt_auth'); trainer = await makeTrainer(ctx, 'ent@test.com'); });
  after(() => ctx.close());

  test('login correcto entrega cookies httpOnly y /me responde', async () => {
    const c = new Client(ctx.base);
    const r = await c.login('ent@test.com');
    assert.equal(r.status, 200);
    assert.equal(r.data.user.role, 'trainer');
    assert.equal(r.data.user.passwordHash, undefined);
    assert.ok(c.cookies.pt_at && c.cookies.pt_rt);
    assert.equal((await c.get('/auth/me')).data.user.email, 'ent@test.com');
  });

  test('credenciales inválidas: mismo mensaje exista o no el correo', async () => {
    const c = new Client(ctx.base);
    const a = await c.login('ent@test.com', 'incorrecta123');
    const b = await c.login('noexiste@test.com', 'incorrecta123');
    assert.equal(a.status, 401); assert.equal(b.status, 401);
    assert.equal(a.data.error.message, b.data.error.message);
  });

  test('bloqueo temporal tras 5 intentos fallidos (incluso con la clave correcta)', async () => {
    await ctx.models.User.create({ name: 'Bloq', email: 'bloq@test.com', role: 'trainer', status: 'active', passwordHash: 'x' });
    const { hashPassword } = await import('../../src/services/auth.service.js');
    await ctx.models.User.updateOne({ email: 'bloq@test.com' }, { passwordHash: await hashPassword(PASS) });
    const c = new Client(ctx.base);
    for (let i = 0; i < 5; i += 1) assert.equal((await c.login('bloq@test.com', 'mala123456')).status, 401);
    const locked = await c.login('bloq@test.com', PASS);
    assert.equal(locked.status, 429);
    assert.equal(locked.data.error.code, 'ACCOUNT_LOCKED');
  });

  test('refresh rota el token; reutilizar uno viejo revoca todas las sesiones', async () => {
    const c = new Client(ctx.base);
    await c.login('ent@test.com');
    const oldRt = c.cookies.pt_rt;
    assert.equal((await c.post('/auth/refresh')).status, 200);
    assert.notEqual(c.cookies.pt_rt, oldRt);
    // simulamos que el token viejo fue usado hace más de la tolerancia
    await ctx.models.AuthToken.updateMany({ usedAt: { $ne: null }, type: 'refresh' }, { usedAt: new Date(Date.now() - 60_000) });
    const attacker = new Client(ctx.base);
    attacker.cookies = { ...c.cookies, pt_rt: oldRt };
    assert.equal((await attacker.post('/auth/refresh')).status, 401);
    assert.equal((await c.post('/auth/refresh')).status, 401); // la sesión legítima también quedó revocada
  });

  test('logout cierra la sesión', async () => {
    const c = new Client(ctx.base);
    await c.login('ent@test.com');
    assert.equal((await c.post('/auth/logout')).status, 204);
    assert.equal((await c.post('/auth/refresh')).status, 401);
    assert.equal((await c.get('/auth/me')).status, 401);
  });

  test('un alumno invitado no puede ingresar hasta activar su cuenta', async () => {
    const { outbox } = await import('../../src/services/email.service.js');
    const created = await trainer.client.post('/students', { firstName: 'Ana', lastName: 'Pend', email: 'ana@test.com' });
    assert.equal(created.status, 201);
    assert.equal(created.data.status, 'pending');
    const c = new Client(ctx.base);
    const early = await c.login('ana@test.com', 'cualquiera12345');
    assert.equal(early.status, 401); // la contraseña real aún no existe
    const token = /token=([^&\s]+)/.exec(outbox.filter((m) => m.to === 'ana@test.com').at(-1).text)[1];
    assert.equal((await c.post('/auth/reset-password', { token, password: PASS })).status, 200);
    assert.equal((await c.login('ana@test.com')).status, 200);
    assert.equal((await new Client(ctx.base).post('/auth/reset-password', { token, password: PASS })).status, 400); // el enlace es de un solo uso
  });

  test('desactivar un alumno bloquea de inmediato su sesión y conserva su historial', async () => {
    const s = await makeStudent(ctx, trainer, { firstName: 'Luis', lastName: 'Baja', email: 'luis@test.com' });
    assert.equal((await s.client.get('/me/profile')).status, 200);
    assert.equal((await trainer.client.post(`/students/${s.id}/deactivate`)).data.status, 'inactive');
    assert.equal((await s.client.get('/me/profile')).status, 403);
    assert.equal((await new Client(ctx.base).login('luis@test.com')).status, 403);
    assert.equal(await ctx.models.StudentProfile.countDocuments({ _id: s.id }), 1); // no se borró nada
    assert.equal((await trainer.client.post(`/students/${s.id}/reactivate`)).data.status, 'active');
    assert.equal((await new Client(ctx.base).login('luis@test.com')).status, 200);
  });

  test('cambiar la contraseña exige la actual y cierra las otras sesiones', async () => {
    const s = await makeStudent(ctx, trainer, { firstName: 'Eva', lastName: 'Cambio', email: 'eva@test.com' });
    const other = new Client(ctx.base); await other.login('eva@test.com');
    assert.equal((await s.client.post('/auth/change-password', { currentPassword: 'equivocada1', newPassword: 'NuevaClave2026x' })).status, 400);
    assert.equal((await s.client.post('/auth/change-password', { currentPassword: PASS, newPassword: 'NuevaClave2026x' })).status, 200);
    assert.equal((await s.client.get('/auth/me')).status, 200); // la sesión actual sigue activa
    assert.equal((await other.post('/auth/refresh')).status, 401); // la otra quedó cerrada
    assert.equal((await new Client(ctx.base).login('eva@test.com', 'NuevaClave2026x')).status, 200);
  });
});
