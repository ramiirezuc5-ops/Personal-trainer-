// Utilidades para pruebas de integración. Requieren MONGODB_TEST_URI (p. ej. mongodb://127.0.0.1:27017); sin ella se omiten.
import '../setupEnv.js';
import mongoose from 'mongoose';

export const BASE_URI = process.env.MONGODB_TEST_URI;
export const skip = BASE_URI ? false : 'Definí MONGODB_TEST_URI para ejecutar las pruebas de integración';
export const PASS = 'Clave12345seg';

export async function boot(dbName) {
  await mongoose.connect(`${BASE_URI.replace(/\/$/, '')}/${dbName}`);
  await mongoose.connection.dropDatabase();
  const models = await import('../../src/models/index.js');
  await models.ensureIndexes();
  const { createApp } = await import('../../src/app.js');
  const server = await new Promise((r) => { const s = createApp().listen(0, () => r(s)); });
  return {
    models, base: `http://127.0.0.1:${server.address().port}/api/v1`,
    async close() { await new Promise((r) => server.close(r)); await mongoose.connection.dropDatabase(); await mongoose.disconnect(); },
  };
}

// Cliente HTTP con "cookie jar" y manejo automático del token CSRF.
export class Client {
  constructor(base) { this.base = base; this.cookies = {}; }
  #store(res) {
    for (const c of res.headers.getSetCookie()) {
      const [pair] = c.split(';');
      const i = pair.indexOf('=');
      const k = pair.slice(0, i); const v = pair.slice(i + 1);
      if (/Expires=Thu, 01 Jan 1970/i.test(c) || !v) delete this.cookies[k]; else this.cookies[k] = v;
    }
  }
  async request(method, path, body) {
    if (!this.cookies.pt_csrf) this.#store(await fetch(`${this.base}/auth/csrf`));
    const res = await fetch(this.base + path, {
      method, body: body === undefined ? undefined : JSON.stringify(body),
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': this.cookies.pt_csrf, Cookie: Object.entries(this.cookies).map(([k, v]) => `${k}=${v}`).join('; ') },
    });
    this.#store(res);
    const text = await res.text();
    let data = null; try { data = text ? JSON.parse(text) : null; } catch { /* sin cuerpo JSON */ }
    return { status: res.status, data };
  }
  get(p) { return this.request('GET', p); }
  post(p, b = {}) { return this.request('POST', p, b); }
  patch(p, b) { return this.request('PATCH', p, b); }
  login(email, password = PASS) { return this.post('/auth/login', { email, password }); }
}

export async function makeTrainer(ctx, email, name = 'Entrenador Test') {
  const { hashPassword } = await import('../../src/services/auth.service.js');
  const user = await ctx.models.User.create({ name, email, role: 'trainer', status: 'active', passwordHash: await hashPassword(PASS) });
  await ctx.models.TrainerProfile.create({ user: user._id, businessName: name });
  const client = new Client(ctx.base);
  const r = await client.login(email);
  if (r.status !== 200) throw new Error(`login entrenador falló: ${JSON.stringify(r.data)}`);
  return { client, user };
}

// Crea un alumno por la API (como lo haría el entrenador) y lo activa con el token de la invitación.
export async function makeStudent(ctx, trainer, { firstName, lastName, email, ...rest }) {
  const { outbox } = await import('../../src/services/email.service.js');
  const created = await trainer.client.post('/students', { firstName, lastName, email, ...rest });
  if (created.status !== 201) throw new Error(`crear alumno falló: ${JSON.stringify(created.data)}`);
  const token = /token=([^&\s]+)/.exec(outbox.filter((m) => m.to === email).at(-1).text)[1];
  const client = new Client(ctx.base);
  const set = await client.post('/auth/reset-password', { token, password: PASS });
  if (set.status !== 200) throw new Error(`activar alumno falló: ${JSON.stringify(set.data)}`);
  const login = await client.login(email);
  if (login.status !== 200) throw new Error(`login alumno falló: ${JSON.stringify(login.data)}`);
  return { client, id: created.data.id, token };
}

export async function makeExercise(trainer, name, muscleGroup = 'piernas') {
  const r = await trainer.client.post('/exercises', { name, muscleGroup });
  if (r.status !== 201) throw new Error(`crear ejercicio falló: ${JSON.stringify(r.data)}`);
  return r.data._id;
}

export const routineBody = (student, exerciseId, extra = {}) => ({
  student, name: 'Rutina test', startDate: '2026-01-01', status: 'activa',
  days: [{ dayOfWeek: 1, label: 'Día A', exercises: [{ exercise: exerciseId, sets: 3, reps: '10' }] }], ...extra,
});
