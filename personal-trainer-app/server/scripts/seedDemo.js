// Datos de DEMOSTRACIÓN, claramente marcados (isDemo: true) y con correos @demo.local.
//   npm run seed:demo               crea el entrenador y los alumnos de ejemplo
//   npm run seed:demo -- --remove   borra SOLO lo marcado como demo
// Genera una contraseña aleatoria y la muestra una única vez. Se niega a ejecutarse en producción.
import { connectDB, disconnectDB } from '../src/config/db.js';
import { env } from '../src/config/env.js';
import { ROLES, USER_STATUS } from '../src/config/constants.js';
import * as M from '../src/models/index.js';
import { hashPassword } from '../src/services/auth.service.js';
import { slotBlocks } from '../src/utils/dates.js';
import { randomToken } from '../src/utils/tokens.js';

if (env.NODE_ENV === 'production') { console.error('seed:demo no se ejecuta en producción.'); process.exit(1); }
const DAY = 86_400_000;
const daysAgo = (n) => new Date(Date.now() - n * DAY);

async function removeDemo() {
  const trainers = await M.User.find({ isDemo: true, role: ROLES.TRAINER }).select('_id');
  const tids = trainers.map((t) => t._id);
  const demoUsers = await M.User.find({ isDemo: true }).select('_id');
  const uids = demoUsers.map((u) => u._id);
  const byTrainer = { trainer: { $in: tids } };
  const counts = {};
  for (const [name, Model] of Object.entries({ Exercise: M.Exercise, Routine: M.Routine, WorkoutLog: M.WorkoutLog, ProgressMeasurement: M.ProgressMeasurement, Appointment: M.Appointment, MembershipPlan: M.MembershipPlan, Membership: M.Membership, Payment: M.Payment, StudentProfile: M.StudentProfile })) {
    counts[name] = (await Model.deleteMany(byTrainer)).deletedCount;
  }
  counts.TrainerProfile = (await M.TrainerProfile.deleteMany({ user: { $in: uids } })).deletedCount;
  await M.Notification.deleteMany({ user: { $in: uids } });
  await M.AuthToken.deleteMany({ user: { $in: uids } });
  counts.User = (await M.User.deleteMany({ _id: { $in: uids } })).deletedCount;
  console.log('Datos de demostración eliminados:', counts);
}

async function createDemo() {
  if (await M.User.exists({ email: 'entrenador@demo.local' })) throw new Error('Ya existen datos de demostración. Usá --remove primero.');
  const password = `Demo-${randomToken(9)}1`;
  const passwordHash = await hashPassword(password);
  const mkUser = (name, email, role) => M.User.create({ name, email, role, status: USER_STATUS.ACTIVE, passwordHash, passwordChangedAt: new Date(), isDemo: true });

  const trainer = await mkUser('Entrenador Demo', 'entrenador@demo.local', ROLES.TRAINER);
  await M.TrainerProfile.create({ user: trainer._id, businessName: 'Entrenamiento Demo', isDemo: true, workingHours: [1, 2, 3, 4, 5].map((weekday) => ({ weekday, start: '09:00', end: '18:00' })), booking: { allowStudentBooking: true, slotMinutes: 60, minNoticeHours: 12, maxAdvanceDays: 30, cancellationHours: 12 } });

  const names = [['Lucía', 'Fernández', 'principiante', 'Bajar de peso'], ['Martín', 'Gómez', 'intermedio', 'Ganar masa muscular'], ['Sofía', 'Romero', 'avanzado', 'Mejorar rendimiento']];
  const students = [];
  for (const [i, [firstName, lastName, experienceLevel, goal]] of names.entries()) {
    const u = await mkUser(`${firstName} ${lastName}`, `alumno${i + 1}@demo.local`, ROLES.STUDENT);
    students.push(await M.StudentProfile.create({ trainer: trainer._id, user: u._id, firstName, lastName, experienceLevel, goal, isDemo: true, joinedAt: daysAgo(40 - i * 10) }));
  }

  const ex = {};
  for (const [name, muscleGroup] of [['Sentadilla', 'piernas'], ['Peso muerto', 'espalda'], ['Press banca', 'pecho'], ['Remo con barra', 'espalda'], ['Plancha', 'core'], ['Press militar', 'hombros']]) {
    ex[name] = await M.Exercise.create({ trainer: trainer._id, name, nameKey: name.toLowerCase(), muscleGroup, instructions: 'Contenido de demostración.', isDemo: true });
  }
  const line = (name, sets, reps) => ({ exercise: ex[name]._id, sets, reps, restSeconds: 60 });
  const routines = [];
  for (const s of students) {
    routines.push(await M.Routine.create({ trainer: trainer._id, student: s._id, name: 'Full body (demo)', goal: s.goal, difficulty: 'media', startDate: daysAgo(30), status: 'activa', isDemo: true, days: [
      { dayOfWeek: 1, label: 'Día A', exercises: [line('Sentadilla', 4, '10'), line('Press banca', 3, '8-10'), line('Plancha', 3, '30s')] },
      { dayOfWeek: 3, label: 'Día B', exercises: [line('Peso muerto', 3, '8'), line('Remo con barra', 3, '10'), line('Press militar', 3, '10')] },
    ] }));
  }
  for (const [i, s] of students.entries()) {
    for (let w = 0; w < 6; w += 1) {
      const r = routines[i]; const day = r.days[w % 2];
      await M.WorkoutLog.create({ trainer: trainer._id, student: s._id, routine: r._id, dayId: day._id, performedAt: daysAgo(w * 4 + 1 + i), exercises: day.exercises.map((e) => ({ exercise: e.exercise, completed: true })), isDemo: true });
    }
    for (const [k, weight] of [[56, 82], [28, 80.5], [3, 79]]) {
      await M.ProgressMeasurement.create({ trainer: trainer._id, student: s._id, measuredAt: daysAgo(k), bodyWeight: { value: weight - i * 4, unit: 'kg' }, bodyMeasures: [{ name: 'cintura', value: 92 - (56 - k) / 10, unit: 'cm' }], recordedBy: trainer._id, isDemo: true });
    }
  }
  for (const [i, s] of students.entries()) {
    const start = new Date(Date.now() + (i + 1) * DAY); start.setUTCHours(13, 0, 0, 0);
    const end = new Date(+start + 3_600_000);
    await M.Appointment.create({ trainer: trainer._id, student: s._id, start, end, status: 'confirmado', createdBy: trainer._id, blocks: slotBlocks(trainer._id, start, end), isDemo: true });
  }
  const plan = await M.MembershipPlan.create({ trainer: trainer._id, name: 'Mensual 3 veces por semana (demo)', price: 60000, durationDays: 30, isDemo: true });
  for (const [i, s] of students.entries()) {
    const start = daysAgo(10 + i * 8);
    const m = await M.Membership.create({ trainer: trainer._id, student: s._id, plan: plan._id, priceSnapshot: { amount: 60000, currency: 'ARS' }, startDate: start, endDate: new Date(+start + 30 * DAY), status: 'activa', isDemo: true });
    if (i < 2) await M.Payment.create({ trainer: trainer._id, student: s._id, membership: m._id, amount: i === 0 ? 60000 : 30000, paidAt: start, method: 'transferencia', recordedBy: trainer._id, source: 'manual', isDemo: true });
  }

  console.log('\nDatos de demostración creados.');
  console.log('  Entrenador: entrenador@demo.local');
  console.log('  Alumnos:    alumno1@demo.local, alumno2@demo.local, alumno3@demo.local');
  console.log(`  Contraseña (se muestra UNA vez, igual para todas las cuentas demo): ${password}\n`);
}

async function main() {
  await connectDB();
  await M.ensureIndexes();
  await (process.argv.includes('--remove') ? removeDemo() : createDemo());
}
main().catch((e) => { console.error(`Error: ${e.message ?? e}`); process.exitCode = 1; }).finally(() => disconnectDB());
