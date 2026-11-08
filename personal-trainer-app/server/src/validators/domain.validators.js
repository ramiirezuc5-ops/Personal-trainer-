import { z } from 'zod';
import { MUSCLE_GROUPS } from '../models/Exercise.js';
import { STUDENT_EDITABLE_FIELDS } from '../models/StudentProfile.js';
import { paginationQuery } from '../utils/pagination.js';
import { currencyCode, hhmm, isoDate, objectId, text } from '../utils/schemas.js';
import { emailSchema } from './auth.validators.js';

const LEVELS = ['principiante', 'intermedio', 'avanzado'];
const unit = z.enum(['kg', 'lb']);
const httpUrl = z.string().trim().url().max(500).refine((u) => /^https?:\/\//i.test(u), 'Debe ser un enlace http(s)');

/* ---------- Alumnos ---------- */
export const studentCreate = z.object({
  firstName: text(60, 1), lastName: text(60, 1), email: emailSchema,
  phone: text(30).optional(), birthDate: isoDate.optional(), goal: text(300).optional(),
  experienceLevel: z.enum(LEVELS).optional(), availability: text(300).optional(), notes: text(1000).optional(),
  studentEditableFields: z.array(z.enum(STUDENT_EDITABLE_FIELDS)).max(STUDENT_EDITABLE_FIELDS.length).optional(),
}).strict();
export const studentUpdate = studentCreate.partial().strict();
export const studentListQuery = z.object({
  q: text(80).optional(), status: z.enum(['active', 'inactive', 'pending']).optional(), level: z.enum(LEVELS).optional(),
  sort: z.enum(['name', 'recent']).default('name'), ...paginationQuery,
});
export const studentSelfUpdate = z.object({ phone: text(30), birthDate: isoDate, goal: text(300), availability: text(300) }).partial().strict();

/* ---------- Ejercicios ---------- */
export const exerciseCreate = z.object({
  name: text(100, 2), muscleGroup: z.enum(MUSCLE_GROUPS), description: text(500).optional(), equipment: text(100).optional(),
  instructions: text(1500).optional(), commonMistakes: text(800).optional(),
  media: z.object({ url: httpUrl, kind: z.enum(['image', 'video']) }).strict().optional(),
}).strict();
export const exerciseUpdate = exerciseCreate.partial().strict();
export const exerciseListQuery = z.object({
  q: text(80).optional(), muscleGroup: z.enum(MUSCLE_GROUPS).optional(),
  archived: z.enum(['true', 'false']).default('false').transform((v) => v === 'true'), ...paginationQuery,
});

/* ---------- Rutinas ---------- */
const routineExercise = z.object({
  exercise: objectId, sets: z.number().int().min(1).max(20), reps: text(20, 1),
  weight: z.object({ value: z.number().min(0).max(1000), unit: unit.default('kg') }).strict().optional(),
  restSeconds: z.number().int().min(0).max(900).optional(), notes: text(300).optional(),
}).strict();
const routineDay = z.object({ dayOfWeek: z.number().int().min(0).max(6), label: text(60).optional(), exercises: z.array(routineExercise).min(1).max(30) }).strict();
const days = z.array(routineDay).min(1).max(7).refine((d) => new Set(d.map((x) => x.dayOfWeek)).size === d.length, 'No repitas el mismo día de la semana');
const routineBase = z.object({
  student: objectId, name: text(100, 2), description: text(600).optional(), goal: text(200).optional(),
  difficulty: z.enum(['baja', 'media', 'alta']).optional(), estimatedMinutes: z.number().int().min(5).max(300).optional(),
  startDate: isoDate, endDate: isoDate.optional(), status: z.enum(['borrador', 'activa']).default('borrador'), days,
}).strict();
export const routineCreate = routineBase.refine((r) => !r.endDate || r.endDate >= r.startDate, { message: 'La fecha de fin no puede ser anterior al inicio', path: ['endDate'] });
export const routineUpdate = routineBase.omit({ student: true, status: true }).partial().extend({ endDate: isoDate.nullable().optional() }).strict();
export const routineStatus = z.object({ status: z.enum(['borrador', 'activa', 'finalizada', 'archivada']) }).strict();
export const routineListQuery = z.object({ student: objectId.optional(), status: z.enum(['borrador', 'activa', 'finalizada', 'archivada']).optional(), ...paginationQuery });

/* ---------- Entrenamientos ---------- */
export const workoutCreate = z.object({
  routine: objectId, dayId: objectId, performedAt: isoDate.optional(),
  exercises: z.array(z.object({
    exercise: objectId, completed: z.boolean(),
    sets: z.array(z.object({ reps: z.number().int().min(0).max(1000), weight: z.number().min(0).max(1000).optional(), unit: unit.optional() }).strict()).max(20).optional(),
  }).strict()).max(40).default([]),
  durationMinutes: z.number().int().min(0).max(600).optional(), notes: text(500).optional(),
  clientRequestId: z.string().trim().min(8).max(80),
}).strict();
export const rangeQuery = z.object({ from: isoDate.optional(), to: isoDate.optional(), ...paginationQuery });

/* ---------- Progreso ---------- */
const vu = z.object({ value: z.number().min(0).max(100000), unit: text(10, 1) }).strict();
const progressBase = z.object({
  measuredAt: isoDate.optional(), bodyWeight: vu.optional(),
  bodyMeasures: z.array(vu.extend({ name: text(40, 1) })).max(30).optional(),
  performance: z.array(vu.extend({ metric: text(40, 1), exercise: objectId.optional() })).max(30).optional(),
});
const hasData = (p) => p.bodyWeight || p.bodyMeasures?.length || p.performance?.length;
const noData = { message: 'Registrá al menos un dato (peso, medidas o rendimiento)' };
export const progressCreateTrainer = progressBase.extend({ trainerNotes: text(1000).optional() }).strict().refine(hasData, noData);
export const progressCreateStudent = progressBase.strict().refine(hasData, noData);
export const compareQuery = z.object({ aFrom: isoDate, aTo: isoDate, bFrom: isoDate, bTo: isoDate });

/* ---------- Turnos ---------- */
export const apptCreate = z.object({ student: objectId, start: isoDate, end: isoDate, type: text(60).optional(), notes: text(400).optional(), status: z.enum(['reservado', 'confirmado']).default('confirmado') }).strict();
export const apptReschedule = z.object({ start: isoDate, end: isoDate }).strict();
export const apptStatus = z.object({ status: z.enum(['confirmado', 'completado']) }).strict();
export const apptCancel = z.object({ reason: text(300).optional() }).strict();
export const apptListQuery = z.object({
  from: isoDate.optional(), to: isoDate.optional(), status: z.enum(['reservado', 'confirmado', 'completado', 'cancelado']).optional(),
  student: objectId.optional(), page: paginationQuery.page, limit: z.coerce.number().int().min(1).max(200).default(50),
});
export const studentBook = z.object({ start: isoDate, notes: text(400).optional() }).strict();
export const availabilityQuery = z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Usá AAAA-MM-DD') });

/* ---------- Planes, membresías y pagos ---------- */
export const planCreate = z.object({
  name: text(80, 2), description: text(300).optional(), price: z.number().min(0).max(1e9), currency: currencyCode.optional(),
  durationDays: z.number().int().min(1).max(730), sessionsIncluded: z.number().int().min(0).nullable().optional(),
}).strict();
export const planUpdate = planCreate.partial().extend({ active: z.boolean().optional() }).strict();
const discount = z.object({ amount: z.number().min(0).max(1e9), reason: text(200).optional() }).strict();
export const membershipCreate = z.object({ plan: objectId, startDate: isoDate.optional(), discount: discount.optional(), notes: text(300).optional() }).strict();
export const paymentCreate = z.object({
  amount: z.number().gt(0).max(1e9), currency: currencyCode.optional(), paidAt: isoDate.optional(),
  method: z.enum(['efectivo', 'transferencia', 'tarjeta', 'otro']), membership: objectId.optional(),
  periodStart: isoDate.optional(), periodEnd: isoDate.optional(), discount: discount.optional(), notes: text(400).optional(),
}).strict();
export const paymentVoid = z.object({ reason: text(300, 3) }).strict();
export const paymentListQuery = z.object({ student: objectId.optional(), from: isoDate.optional(), to: isoDate.optional(), status: z.enum(['registrado', 'anulado']).optional(), ...paginationQuery });
export const summaryQuery = z.object({ from: isoDate.optional(), to: isoDate.optional() });

/* ---------- Configuración ---------- */
const tzValid = (tz) => { try { new Intl.DateTimeFormat('es-AR', { timeZone: tz }); return true; } catch { return false; } };
export const settingsUpdate = z.object({
  name: text(120, 2), businessName: text(100), phone: text(30), bio: text(500),
  photoUrl: httpUrl.or(z.literal('')), timezone: z.string().refine(tzValid, 'Zona horaria inválida'), currency: currencyCode,
  workingHours: z.array(z.object({ weekday: z.number().int().min(0).max(6), start: hhmm, end: hhmm }).strict().refine((h) => h.end > h.start, 'La hora de fin debe ser posterior')).max(21),
  notifications: z.object({ email: z.boolean(), paymentDue: z.boolean(), appointmentReminders: z.boolean() }).partial().strict(),
  booking: z.object({
    allowStudentBooking: z.boolean(), slotMinutes: z.number().int().min(15).max(240).refine((n) => n % 15 === 0, 'Debe ser múltiplo de 15'),
    minNoticeHours: z.number().int().min(0).max(720), maxAdvanceDays: z.number().int().min(1).max(365), cancellationHours: z.number().int().min(0).max(720),
  }).partial().strict(),
}).partial().strict();
