// Prueba de integración REAL: el cliente HTTP y los endpoints del frontend contra el backend con MongoDB.
// Se omite si no se define E2E_API_URL (ver README). Requiere cuentas demo: `npm run seed:demo` en el servidor.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ApiError, AUTH_EXPIRED_EVENT, fieldErrors } from '../../src/services/api';
import { authApi, dashboardApi, meApi, studentsApi } from '../../src/services/endpoints';

const API = process.env.E2E_API_URL;
const PASSWORD = process.env.E2E_PASSWORD ?? '';
const run = Boolean(API && PASSWORD);

// "Navegadores" independientes: cada uno con su propio cookie jar (el entrenador y el alumno a la vez).
const jars: Record<string, Map<string, string>> = { trainer: new Map(), student: new Map() };
let current = 'trainer';
const realFetch = globalThis.fetch;

function syncDocumentCookie() {
  document.cookie = 'pt_csrf=; Max-Age=0; path=/';
  const csrf = jars[current].get('pt_csrf');
  if (csrf) document.cookie = `pt_csrf=${csrf}; path=/`;
}
function as(name: 'trainer' | 'student') { current = name; syncDocumentCookie(); }

beforeAll(() => {
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const jar = jars[current];
    const headers = new Headers(init?.headers);
    headers.set('Cookie', [...jar].map(([k, v]) => `${k}=${v}`).join('; '));
    const res = await realFetch(input, { ...init, headers });
    for (const c of res.headers.getSetCookie()) {
      const [pair] = c.split(';'); const i = pair.indexOf('=');
      const k = pair.slice(0, i); const v = pair.slice(i + 1);
      if (!v || /Expires=Thu, 01 Jan 1970/i.test(c)) jar.delete(k); else jar.set(k, v);
    }
    syncDocumentCookie();
    return res;
  }) as typeof fetch;
});
afterAll(() => { globalThis.fetch = realFetch; });

describe.skipIf(!run)('frontend ↔ backend real', () => {
  const unique = `e2e${Date.now()}@test.com`;
  let createdId = '';

  it('el entrenador inicia sesión y /auth/me devuelve su usuario', async () => {
    as('trainer');
    const { user } = await authApi.login('entrenador@demo.local', PASSWORD);
    expect(user).toMatchObject({ role: 'trainer', email: 'entrenador@demo.local', status: 'active' });
    expect((await authApi.me()).user.id).toBe(user.id);
  });

  it('credenciales inválidas devuelven el código esperado por la pantalla de ingreso', async () => {
    as('student');
    const err = await authApi.login('alumno1@demo.local', 'incorrecta123').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ status: 401, code: 'INVALID_CREDENTIALS' });
  });

  it('el panel trae datos reales con la forma que espera la pantalla', async () => {
    as('trainer');
    const d = await dashboardApi.get();
    expect(d.isEmpty).toBe(false);
    expect(d.students.total).toBe(3);
    expect(d.charts.months).toHaveLength(6);
    expect(d.charts.newStudentsByMonth).toHaveLength(6);
    expect(d.pendingPayments.count).toBeGreaterThan(0);
    expect(d.revenueThisMonth.length + d.charts.revenueByMonth.length).toBeGreaterThan(0);
    expect(typeof d.timezone).toBe('string');
  });

  it('listado, búsqueda y paginación de alumnos', async () => {
    const all = await studentsApi.list({ page: 1, limit: 2, sort: 'name' });
    expect(all.total).toBe(3); expect(all.items).toHaveLength(2); expect(all.pages).toBe(2);
    expect((await studentsApi.list({ q: 'luc' })).items.map((s) => s.firstName)).toEqual(['Lucía']);
    expect((await studentsApi.list({ status: 'inactive' })).total).toBe(0);
    expect((await studentsApi.list({ level: 'avanzado' })).total).toBe(1);
  });

  it('alta de alumno: queda pendiente; correo duplicado y datos inválidos se mapean a campos', async () => {
    const created = await studentsApi.create({ firstName: 'Prueba', lastName: 'E2E', email: unique, experienceLevel: 'intermedio', studentEditableFields: ['phone'] });
    createdId = created.id;
    expect(created).toMatchObject({ status: 'pending', email: unique });
    const dup = await studentsApi.create({ firstName: 'X', lastName: 'Y', email: unique }).catch((e: unknown) => e);
    expect(dup).toMatchObject({ status: 409, code: 'EMAIL_TAKEN' });
    const bad = await studentsApi.create({ firstName: '', lastName: 'Y', email: 'no-es-correo' }).catch((e: unknown) => e);
    expect(Object.keys(fieldErrors(bad))).toEqual(expect.arrayContaining(['firstName', 'email']));
  });

  it('ficha, edición, reenvío de invitación, desactivación y reactivación', async () => {
    const detail = await studentsApi.get(createdId);
    expect(detail.summary).toEqual({ activeRoutines: 0, lastWorkoutAt: null, nextAppointment: null, membership: null });
    expect((await studentsApi.update(createdId, { goal: 'Correr 10k', phone: '1155551234' })).goal).toBe('Correr 10k');
    await expect(studentsApi.resendInvite(createdId)).resolves.toBeTruthy();
    expect((await studentsApi.deactivate(createdId)).status).toBe('inactive');
    expect((await studentsApi.list({ status: 'inactive' })).total).toBe(1);
    expect((await studentsApi.reactivate(createdId)).status).toBe('pending'); // nunca activó su cuenta
  });

  it('un id inexistente devuelve 404 (la ficha muestra "No encontramos a este alumno")', async () => {
    const err = await studentsApi.get('aaaaaaaaaaaaaaaaaaaaaaaa').catch((e: unknown) => e);
    expect(err).toMatchObject({ status: 404, code: 'STUDENT_NOT_FOUND' });
  });

  it('SESIÓN: si el token de acceso vence, el cliente renueva solo y reintenta sin que el usuario lo note', async () => {
    jars.trainer.delete('pt_at'); // simula la expiración del token de acceso (15 min)
    const before = jars.trainer.get('pt_rt');
    const d = await dashboardApi.get();
    expect(d.students.total).toBe(4);
    expect(jars.trainer.get('pt_at')).toBeTruthy();
    expect(jars.trainer.get('pt_rt')).not.toBe(before); // el refresh token rotó
  });

  it('el alumno ve solo lo suyo y no puede usar el panel del entrenador', async () => {
    as('student');
    await authApi.login('alumno1@demo.local', PASSWORD);
    const me = await meApi.profile();
    expect(me.email).toBe('alumno1@demo.local');
    expect(me.notes).toBeUndefined(); // observaciones privadas del entrenador
    const forbidden = await dashboardApi.get().catch((e: unknown) => e);
    expect(forbidden).toMatchObject({ status: 403 });
    const list = await studentsApi.list({}).catch((e: unknown) => e);
    expect(list).toMatchObject({ status: 403 });
    const other = await studentsApi.get(createdId).catch((e: unknown) => e);
    expect(other).toMatchObject({ status: 403 });
  });

  it('el alumno edita solo los campos habilitados', async () => {
    expect((await meApi.updateProfile({ phone: '1166667777' })).phone).toBe('1166667777');
    const denied = await meApi.updateProfile({ goal: 'otro' }).catch((e: unknown) => e);
    expect(denied).toMatchObject({ status: 403, code: 'FIELD_NOT_EDITABLE' });
  });

  it('cerrar sesión invalida la sesión y avisa a la app (evento de sesión expirada)', async () => {
    let expired = 0;
    const onExpired = () => { expired += 1; };
    window.addEventListener(AUTH_EXPIRED_EVENT, onExpired);
    await authApi.logout();
    const err = await authApi.me().catch((e: unknown) => e);
    expect(err).toMatchObject({ status: 401 });
    expect(expired).toBeGreaterThan(0);
    window.removeEventListener(AUTH_EXPIRED_EVENT, onExpired);
  });

  it('un servidor caído se informa como error de conexión', async () => {
    as('trainer');
    const saved = globalThis.fetch;
    globalThis.fetch = (() => Promise.reject(new TypeError('fetch failed'))) as typeof fetch;
    const err = await dashboardApi.get().catch((e: unknown) => e);
    globalThis.fetch = saved;
    expect(err).toMatchObject({ status: 0, code: 'NETWORK_ERROR' });
  });
});
