import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { tzParts } from '../../src/utils/dates.js';
import { boot, makeExercise, makeStudent, makeTrainer, routineBody, skip } from './helpers.js';

const TZ = 'America/Argentina/Buenos_Aires';
const iso = (ms) => new Date(ms).toISOString();
const HOUR = 3_600_000;
// Un instante futuro alineado a la hora en punto (13:00Z = 10:00 en Buenos Aires).
const futureAt = (days, hourUtc = 13) => { const d = new Date(Date.now() + days * 86_400_000); d.setUTCHours(hourUtc, 0, 0, 0); return d; };

describe('reglas de negocio (MongoDB real)', { skip }, () => {
  let ctx; let T; let s1; let s2; let ex1; let ex2;
  before(async () => {
    ctx = await boot('pt_domain');
    T = await makeTrainer(ctx, 't@test.com', 'Entrenadora Test');
    s1 = await makeStudent(ctx, T, { firstName: 'Ana', lastName: 'Uno', email: 's1@test.com' });
    s2 = await makeStudent(ctx, T, { firstName: 'Bruno', lastName: 'Dos', email: 's2@test.com' });
    ex1 = await makeExercise(T, 'Sentadilla');
    ex2 = await makeExercise(T, 'Press banca', 'pecho');
  });
  after(() => ctx.close());

  describe('alumnos y ejercicios', () => {
    test('búsqueda, filtros y paginación de alumnos', async () => {
      assert.equal((await T.client.get('/students?q=bru')).data.total, 1);
      assert.equal((await T.client.get('/students?status=active')).data.total, 2);
      const p1 = (await T.client.get('/students?limit=1&page=1')).data;
      assert.equal(p1.items.length, 1); assert.equal(p1.pages, 2);
      assert.equal((await T.client.get('/students?limit=1&page=2')).data.items[0].lastName, 'Uno');
    });
    test('no permite alumnos con correo repetido (409) ni datos inválidos (400)', async () => {
      assert.equal((await T.client.post('/students', { firstName: 'X', lastName: 'Y', email: 's1@test.com' })).status, 409);
      assert.equal((await T.client.post('/students', { firstName: 'X', lastName: 'Y', email: 'mal', role: 'trainer' })).status, 400);
    });
    test('ejercicios: sin duplicados por nombre y archivado en lugar de borrado', async () => {
      assert.equal((await T.client.post('/exercises', { name: ' sentadilla ', muscleGroup: 'piernas' })).status, 409);
      const id = await makeExercise(T, 'Remo', 'espalda');
      assert.equal((await T.client.post(`/exercises/${id}/archive`)).data.archived, true);
      assert.equal((await T.client.get('/exercises?q=remo')).data.total, 0);
      assert.equal((await T.client.get('/exercises?q=remo&archived=true')).data.total, 1);
    });
  });

  describe('rutinas y entrenamientos', () => {
    let routineId; let dayId;
    test('crear, asignar y que el alumno la vea ordenada con los detalles de cada ejercicio', async () => {
      const bad = await T.client.post('/routines', routineBody(s1.id, ex1, { days: [{ dayOfWeek: 1, exercises: [{ exercise: ex1, sets: 3, reps: '10' }] }, { dayOfWeek: 1, exercises: [{ exercise: ex1, sets: 3, reps: '10' }] }] }));
      assert.equal(bad.status, 400); // día repetido
      const r = await T.client.post('/routines', routineBody(s1.id, ex1, { days: [{ dayOfWeek: 3, exercises: [{ exercise: ex2, sets: 4, reps: '8-10', weight: { value: 40, unit: 'kg' } }] }, { dayOfWeek: 1, label: 'Piernas', exercises: [{ exercise: ex1, sets: 3, reps: '10' }] }] }));
      assert.equal(r.status, 201);
      routineId = r.data._id;
      const mine = await s1.client.get(`/me/routines/${routineId}`);
      assert.equal(mine.status, 200);
      assert.equal(mine.data.days[0].exercises[0].exercise.name, 'Press banca'); // detalle poblado
      dayId = mine.data.days[1]._id;
      assert.equal((await ctx.models.Notification.countDocuments({ type: 'rutina' })), 1);
    });
    test('los borradores no son visibles para el alumno', async () => {
      const d = await T.client.post('/routines', routineBody(s1.id, ex1, { status: 'borrador', name: 'Borrador' }));
      assert.equal((await s1.client.get(`/me/routines/${d.data._id}`)).status, 404);
      assert.equal((await s1.client.get('/me/routines')).data.length, 1);
    });
    test('registrar un entrenamiento es idempotente (doble clic / reintento)', async () => {
      const body = { routine: routineId, dayId, clientRequestId: 'req-123456789' };
      const a = await s1.client.post('/me/workouts', body);
      const b = await s1.client.post('/me/workouts', body);
      assert.equal(a.status, 201); assert.equal(b.status, 200);
      assert.equal(b.data.duplicate, true);
      assert.equal(await ctx.models.WorkoutLog.countDocuments({ student: s1.id }), 1);
      const par = await Promise.all(Array.from({ length: 5 }, () => s1.client.post('/me/workouts', { ...body, clientRequestId: 'req-paralelo-1' })));
      assert.equal(par.filter((r) => r.status === 201).length, 1);
      assert.equal(await ctx.models.WorkoutLog.countDocuments({ student: s1.id }), 2);
    });
    test('validaciones del entrenamiento: día ajeno, fecha futura, antigua y rutina de otro alumno', async () => {
      assert.equal((await s1.client.post('/me/workouts', { routine: routineId, dayId: 'aaaaaaaaaaaaaaaaaaaaaaaa', clientRequestId: 'req-dia-ajeno' })).status, 400);
      assert.equal((await s1.client.post('/me/workouts', { routine: routineId, dayId, performedAt: iso(Date.now() + 3 * 86_400_000), clientRequestId: 'req-futuro-1' })).status, 400);
      assert.equal((await s1.client.post('/me/workouts', { routine: routineId, dayId, performedAt: iso(Date.now() - 40 * 86_400_000), clientRequestId: 'req-antiguo-1' })).status, 400);
      assert.equal((await s2.client.post('/me/workouts', { routine: routineId, dayId, clientRequestId: 'req-ajena-001' })).status, 404);
    });
    test('el entrenador ve el historial y el cumplimiento del alumno', async () => {
      assert.equal((await T.client.get(`/students/${s1.id}/workouts`)).data.total, 2);
      const from = iso(Date.now() - 7 * 86_400_000); const to = iso(Date.now() + 1000);
      const c = (await T.client.get(`/students/${s1.id}/compliance?from=${from}&to=${to}`)).data;
      assert.equal(c.completed, 2);
      assert.ok(c.expected >= 1);
    });
  });

  describe('progreso', () => {
    test('las mediciones se agregan sin sobrescribir y se comparan por período', async () => {
      const d = (days) => iso(Date.now() - days * 86_400_000);
      await T.client.post(`/students/${s2.id}/progress`, { measuredAt: d(60), bodyWeight: { value: 85, unit: 'kg' }, bodyMeasures: [{ name: 'cintura', value: 95, unit: 'cm' }] });
      await T.client.post(`/students/${s2.id}/progress`, { measuredAt: d(55), bodyWeight: { value: 84, unit: 'kg' } });
      await T.client.post(`/students/${s2.id}/progress`, { measuredAt: d(2), bodyWeight: { value: 80, unit: 'kg' }, bodyMeasures: [{ name: 'cintura', value: 90, unit: 'cm' }], trainerNotes: 'buen avance' });
      assert.equal((await T.client.get(`/students/${s2.id}/progress`)).data.total, 3);
      assert.equal((await T.client.post(`/students/${s2.id}/progress`, {})).status, 400);
      const q = new URLSearchParams({ aFrom: d(70), aTo: d(50), bFrom: d(10), bTo: iso(Date.now()) });
      const cmp = (await T.client.get(`/students/${s2.id}/progress/compare?${q}`)).data;
      assert.equal(cmp.periodA.count, 2); assert.equal(cmp.periodB.count, 1);
      assert.deepEqual(cmp.delta.bodyWeight, { value: -4, unit: 'kg' });
      assert.deepEqual(cmp.delta.measures.cintura, { value: -5, unit: 'cm' });
      const own = (await s2.client.get(`/me/progress/compare?${q}`)).data;
      assert.deepEqual(own.delta.bodyWeight, { value: -4, unit: 'kg' });
    });
    test('el alumno registra sus propias mediciones y no se pueden usar fechas futuras', async () => {
      assert.equal((await s2.client.post('/me/progress', { bodyWeight: { value: 79.5, unit: 'kg' } })).status, 201);
      assert.equal((await s2.client.post('/me/progress', { measuredAt: iso(Date.now() + 5 * 86_400_000), bodyWeight: { value: 70, unit: 'kg' } })).status, 400);
    });
  });

  describe('agenda y turnos', () => {
    test('rechaza turnos superpuestos, mal alineados o inválidos', async () => {
      const start = futureAt(2);
      const ok = await T.client.post('/appointments', { student: s1.id, start: iso(start), end: iso(+start + HOUR) });
      assert.equal(ok.status, 201);
      const overlap = await T.client.post('/appointments', { student: s2.id, start: iso(+start + 30 * 60_000), end: iso(+start + 90 * 60_000) });
      assert.equal(overlap.status, 409); assert.equal(overlap.data.error.code, 'SLOT_TAKEN');
      assert.equal((await T.client.post('/appointments', { student: s2.id, start: iso(+start + HOUR), end: iso(+start + 2 * HOUR) })).status, 201); // contiguo: permitido
      assert.equal((await T.client.post('/appointments', { student: s2.id, start: iso(+start + 5 * 60_000 + 3 * HOUR), end: iso(+start + 4 * HOUR) })).status, 400); // no alineado
      assert.equal((await T.client.post('/appointments', { student: s2.id, start: iso(+start + 5 * HOUR), end: iso(+start + 4 * HOUR) })).status, 400); // fin antes del inicio
    });
    test('CONCURRENCIA: 8 reservas simultáneas del mismo horario → solo una se confirma', async () => {
      const start = futureAt(3);
      const res = await Promise.all(Array.from({ length: 8 }, (_, i) => T.client.post('/appointments', { student: i % 2 ? s1.id : s2.id, start: iso(start), end: iso(+start + HOUR) })));
      assert.equal(res.filter((r) => r.status === 201).length, 1);
      assert.equal(res.filter((r) => r.status === 409).length, 7);
      assert.equal(await ctx.models.Appointment.countDocuments({ start, active: true }), 1);
    });
    test('cancelar libera el horario; reprogramar se mueve sin chocar consigo mismo y deja historial', async () => {
      const start = futureAt(4);
      const a = (await T.client.post('/appointments', { student: s1.id, start: iso(start), end: iso(+start + HOUR) })).data;
      assert.equal((await T.client.patch(`/appointments/${a._id}`, { start: iso(+start + 30 * 60_000), end: iso(+start + 90 * 60_000) })).data.history.length, 1); // solapa con su propio horario anterior
      assert.equal((await T.client.post(`/appointments/${a._id}/cancel`, { reason: 'imprevisto' })).data.status, 'cancelado');
      assert.equal((await T.client.post('/appointments', { student: s2.id, start: iso(start), end: iso(+start + HOUR) })).status, 201); // quedó libre
      assert.equal((await T.client.post(`/appointments/${a._id}/cancel`, {})).status, 409); // ya cancelado
      assert.equal((await T.client.patch(`/appointments/${a._id}`, { start: iso(start), end: iso(+start + HOUR) })).status, 409);
    });
    test('transiciones de estado válidas', async () => {
      const start = futureAt(5);
      const a = (await T.client.post('/appointments', { student: s1.id, start: iso(start), end: iso(+start + HOUR), status: 'reservado' })).data;
      assert.equal((await T.client.post(`/appointments/${a._id}/status`, { status: 'confirmado' })).data.status, 'confirmado');
      assert.equal((await T.client.post(`/appointments/${a._id}/status`, { status: 'confirmado' })).status, 409);
      assert.equal((await T.client.post(`/appointments/${a._id}/status`, { status: 'completado' })).data.status, 'completado');
      assert.equal((await T.client.post(`/appointments/${a._id}/cancel`, {})).status, 409);
    });
    test('el alumno solo reserva según las reglas del entrenador', async () => {
      const day = futureAt(6);
      const { ymd, weekday } = tzParts(day, TZ);
      assert.equal((await s1.client.post('/me/appointments', { start: iso(day) })).status, 403); // reserva deshabilitada por defecto
      assert.equal((await s1.client.get(`/me/availability?date=${ymd}`)).data.enabled, false);

      const set = await T.client.patch('/settings', { workingHours: [{ weekday, start: '10:00', end: '12:00' }], booking: { allowStudentBooking: true, slotMinutes: 60, minNoticeHours: 1, maxAdvanceDays: 30, cancellationHours: 12 } });
      assert.equal(set.status, 200);
      const av = (await s1.client.get(`/me/availability?date=${ymd}`)).data;
      assert.deepEqual(av.slots.map((s) => s.slice(11, 16)), ['13:00', '14:00']); // 10:00 y 11:00 hora local

      assert.equal((await s1.client.post('/me/appointments', { start: iso(+day + 30 * 60_000) })).status, 400); // fuera de la grilla
      assert.equal((await s1.client.post('/me/appointments', { start: iso(+day + 5 * HOUR) })).status, 400); // fuera del horario de atención
      const booked = await s1.client.post('/me/appointments', { start: iso(day) });
      assert.equal(booked.status, 201); assert.equal(booked.data.status, 'reservado');
      assert.equal((await s2.client.post('/me/appointments', { start: iso(day) })).status, 400); // ya no figura disponible
      assert.deepEqual((await s2.client.get(`/me/availability?date=${ymd}`)).data.slots.map((s) => s.slice(11, 16)), ['14:00']);
      assert.equal((await ctx.models.Notification.countDocuments({ user: T.user._id, type: 'turno' })), 1);
      assert.equal((await s2.client.post(`/me/appointments/${booked.data._id}/cancel`)).status, 404); // turno ajeno
      assert.equal((await s1.client.get('/me/appointments')).data.items.some((a) => a._id === booked.data._id), true);
      assert.equal((await s1.client.post(`/me/appointments/${booked.data._id}/cancel`)).data.status, 'cancelado');
    });
    test('el alumno no puede cancelar dentro de la ventana de cancelación', async () => {
      const start = new Date(Math.ceil((Date.now() + 2 * HOUR) / HOUR) * HOUR); // en ~2-3 h, ventana = 12 h
      const a = (await T.client.post('/appointments', { student: s1.id, start: iso(start), end: iso(+start + HOUR) })).data;
      const r = await s1.client.post(`/me/appointments/${a._id}/cancel`);
      assert.equal(r.status, 403); assert.equal(r.data.error.code, 'CANCELLATION_WINDOW');
    });
  });

  describe('planes, membresías y pagos', () => {
    let plan; let membership;
    test('crear plan, asignarlo (con snapshot de precio) y evitar membresías superpuestas', async () => {
      plan = (await T.client.post('/billing/plans', { name: 'Mensual 3x', price: 50000, durationDays: 30 })).data;
      assert.equal(plan.currency, 'ARS');
      const m = await T.client.post(`/students/${s1.id}/memberships`, { plan: plan._id, discount: { amount: 5000, reason: 'promo' } });
      assert.equal(m.status, 201); assert.equal(m.data.status, 'activa'); membership = m.data;
      await T.client.patch(`/billing/plans/${plan._id}`, { price: 99999 });
      assert.equal((await T.client.get(`/students/${s1.id}/memberships`)).data[0].priceSnapshot.amount, 50000); // el historial no cambia
      assert.equal((await T.client.post(`/students/${s1.id}/memberships`, { plan: plan._id })).status, 409);
      assert.equal((await T.client.post(`/students/${s2.id}/memberships`, { plan: plan._id, discount: { amount: 999999 } })).status, 400);
    });
    test('los pagos son siempre manuales: no se puede fingir un pago de proveedor', async () => {
      const forged = await T.client.post(`/students/${s1.id}/payments`, { amount: 100, method: 'tarjeta', source: 'provider', provider: { name: 'mercadopago', externalId: 'x' }, status: 'registrado' });
      assert.equal(forged.status, 400);
      assert.equal((await T.client.post(`/students/${s1.id}/payments`, { amount: -5, method: 'efectivo' })).status, 400);
      assert.equal((await T.client.post(`/students/${s1.id}/payments`, { amount: 100, method: 'bitcoin' })).status, 400);
      assert.equal((await T.client.post(`/students/${s1.id}/payments`, { amount: 100, method: 'efectivo', paidAt: iso(Date.now() + 10 * 86_400_000) })).status, 400);
    });
    test('saldo pendiente, pagos, anulación y resumen de ingresos', async () => {
      assert.equal((await T.client.get('/billing/pending')).data[0].due, 45000);
      const p1 = await T.client.post(`/students/${s1.id}/payments`, { amount: 20000, method: 'transferencia', membership: membership._id });
      assert.equal(p1.status, 201); assert.equal(p1.data.source, 'manual');
      const p2 = await T.client.post(`/students/${s1.id}/payments`, { amount: 25000, method: 'efectivo', membership: membership._id });
      assert.equal((await T.client.get('/billing/pending')).data.length, 0); // 20000 + 25000 = 45000 → saldado
      assert.equal((await T.client.post(`/billing/payments/${p2.data._id}/void`, { reason: 'error de carga' })).data.status, 'anulado');
      assert.equal((await T.client.post(`/billing/payments/${p2.data._id}/void`, { reason: 'otra vez' })).status, 409);
      assert.equal((await T.client.get('/billing/pending')).data[0].due, 25000); // el pago anulado ya no cuenta
      const sum = (await T.client.get('/billing/summary')).data;
      assert.deepEqual(sum.totals, [{ currency: 'ARS', total: 20000, count: 1 }]);
      assert.equal((await T.client.get('/billing/payments?status=anulado')).data.total, 1); // no se borra: queda el historial
      const mine = (await s1.client.get('/me/billing')).data;
      assert.equal(mine.memberships[0].due, 25000);
      assert.equal(mine.payments.length, 2);
      assert.equal(mine.payments[0].recordedBy, undefined);
    });
  });

  describe('dashboard y configuración', () => {
    test('un entrenador sin datos ve un estado vacío (no cifras inventadas)', async () => {
      const E = await makeTrainer(ctx, 'vacio@test.com', 'Sin Datos');
      const d = (await E.client.get('/dashboard')).data;
      assert.equal(d.isEmpty, true);
      assert.equal(d.students.total, 0);
      assert.deepEqual(d.revenueThisMonth, []);
      assert.equal(d.charts.months.length, 6);
      assert.deepEqual(d.charts.newStudentsByMonth, [0, 0, 0, 0, 0, 0]);
    });
    test('las métricas reflejan los datos reales', async () => {
      const d = (await T.client.get('/dashboard')).data;
      assert.equal(d.isEmpty, false);
      assert.equal(d.students.active, 2);
      assert.equal(d.students.new30d, 2);
      assert.equal(d.pendingPayments.count, 1);
      assert.deepEqual(d.pendingPayments.totals, { ARS: 25000 });
      assert.deepEqual(d.revenueThisMonth, [{ currency: 'ARS', total: 20000, count: 1 }]);
      assert.equal(d.charts.newStudentsByMonth.at(-1), 2);
      assert.ok(d.recentActivity.length > 0);
    });
    test('configuración: valida zona horaria, moneda, franjas y reglas de reserva', async () => {
      assert.equal((await T.client.patch('/settings', { timezone: 'Marte/Olimpo' })).status, 400);
      assert.equal((await T.client.patch('/settings', { currency: 'pesos' })).status, 400);
      assert.equal((await T.client.patch('/settings', { booking: { slotMinutes: 50 } })).status, 400);
      assert.equal((await T.client.patch('/settings', { workingHours: [{ weekday: 1, start: '10:00', end: '12:00' }, { weekday: 1, start: '11:00', end: '13:00' }] })).status, 400);
      assert.equal((await T.client.patch('/settings', { role: 'student' })).status, 400);
      const ok = await T.client.patch('/settings', { businessName: 'Fuerza Total', currency: 'usd', timezone: 'America/Argentina/Cordoba' });
      assert.equal(ok.status, 200); assert.equal(ok.data.currency, 'USD'); assert.equal(ok.data.booking.slotMinutes, 60);
      await T.client.patch('/settings', { currency: 'ARS', timezone: TZ });
    });
  });
});
