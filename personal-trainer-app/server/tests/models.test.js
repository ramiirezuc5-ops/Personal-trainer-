// Validaciones de esquema que se pueden comprobar sin conexión a la base (validateSync).
import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import './setupEnv.js';
const m = await import('../src/models/index.js');
const id = () => new mongoose.Types.ObjectId();

test('Appointment: la finalización debe ser posterior al inicio', () => {
  const base = { trainer: id(), student: id(), createdBy: id(), start: new Date('2026-01-10T10:00:00Z') };
  assert.ok(new m.Appointment({ ...base, end: new Date('2026-01-10T09:00:00Z') }).validateSync()?.errors.end);
  assert.equal(new m.Appointment({ ...base, end: new Date('2026-01-10T11:00:00Z') }).validateSync(), undefined);
});
test('Appointment: estado fuera de la lista es inválido', () => {
  const doc = new m.Appointment({ trainer: id(), student: id(), createdBy: id(), start: new Date(), end: new Date(Date.now() + 3600e3), status: 'raro' });
  assert.ok(doc.validateSync().errors.status);
});
test('TrainerProfile: zona horaria y moneda inválidas son rechazadas', () => {
  const bad = new m.TrainerProfile({ user: id(), timezone: 'Marte/Olimpo', currency: 'pesos' }).validateSync();
  assert.ok(bad.errors.timezone && bad.errors.currency);
  assert.equal(new m.TrainerProfile({ user: id() }).validateSync(), undefined);
});
test('TrainerProfile: valores por defecto ARS y Buenos Aires', () => {
  const t = new m.TrainerProfile({ user: id() });
  assert.equal(t.currency, 'ARS');
  assert.equal(t.timezone, 'America/Argentina/Buenos_Aires');
});
test('Routine: series fuera de rango y ejercicio sin referencia son inválidos', () => {
  const doc = new m.Routine({ trainer: id(), student: id(), name: 'R', startDate: new Date(), days: [{ dayOfWeek: 9, exercises: [{ sets: 0, reps: '10' }] }] });
  const errs = Object.keys(doc.validateSync().errors);
  assert.ok(errs.some((e) => e.includes('dayOfWeek')) && errs.some((e) => e.includes('sets')) && errs.some((e) => e.includes('exercise')));
});
test('Payment: monto negativo y método desconocido son inválidos; origen por defecto = manual', () => {
  const doc = new m.Payment({ trainer: id(), student: id(), recordedBy: id(), amount: -5, paidAt: new Date(), method: 'bitcoin' });
  const errs = doc.validateSync().errors;
  assert.ok(errs.amount && errs.method);
  assert.equal(doc.source, 'manual');
});
test('StudentProfile: el entrenador solo puede habilitar campos de la lista blanca', () => {
  const doc = new m.StudentProfile({ trainer: id(), user: id(), firstName: 'A', lastName: 'B', studentEditableFields: ['phone', 'notes'] });
  assert.ok(Object.keys(doc.validateSync().errors).some((k) => k.startsWith('studentEditableFields')));
});
test('User: el rol es obligatorio y el hash nunca se serializa', () => {
  assert.ok(new m.User({ name: 'Ana', email: 'a@b.com', passwordHash: 'x' }).validateSync().errors.role);
  const json = new m.User({ name: 'Ana', email: 'a@b.com', passwordHash: 'x', role: 'student' }).toJSON();
  assert.equal(json.passwordHash, undefined);
});
test('Exercise y MembershipPlan: validaciones básicas', () => {
  assert.ok(new m.Exercise({ trainer: id(), name: 'Sentadilla', nameKey: 'sentadilla', muscleGroup: 'xx' }).validateSync().errors.muscleGroup);
  assert.ok(new m.MembershipPlan({ trainer: id(), name: 'Mensual', price: -1, durationDays: 0 }).validateSync().errors.price);
});
