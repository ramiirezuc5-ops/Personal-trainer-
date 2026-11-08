import { Appointment } from '../models/Appointment.js';
import { Membership } from '../models/Membership.js';
import { Payment } from '../models/Payment.js';
import { StudentProfile } from '../models/StudentProfile.js';
import { TrainerProfile } from '../models/TrainerProfile.js';
import { WorkoutLog } from '../models/WorkoutLog.js';
import { localDayRange, localMonthStart, tzParts } from '../utils/dates.js';
import { oid } from '../utils/mongo.js';
import { pendingPayments, refreshMembershipStatuses } from './billing.service.js';

// Todas las métricas se calculan en el momento a partir de los datos reales. Sin datos → ceros y `isEmpty: true`.
export async function trainerDashboard(trainerId) {
  const tid = oid(trainerId);
  const profile = await TrainerProfile.findOne({ user: trainerId }).select('timezone currency');
  const tz = profile?.timezone ?? 'America/Argentina/Buenos_Aires';
  const now = new Date();
  await refreshMembershipStatuses(trainerId);

  const [dayStart, dayEnd] = localDayRange(tzParts(now, tz).ymd, tz);
  const monthStart = localMonthStart(now, tz, 0);
  const sixMonthsAgo = localMonthStart(now, tz, 5);
  const months = Array.from({ length: 6 }, (_, i) => { const p = tzParts(localMonthStart(now, tz, 5 - i), tz); return `${p.year}-${String(p.month).padStart(2, '0')}`; });
  const fmt = { $dateToString: { format: '%Y-%m', timezone: tz } };

  const [statusCounts, newStudents, today, dueSoon, pending, revenueMonth, studentsSeries, revenueSeries, lastWorkouts, lastPayments, lastAppointments] = await Promise.all([
    StudentProfile.aggregate([{ $match: { trainer: tid } }, { $lookup: { from: 'users', localField: 'user', foreignField: '_id', as: 'u' } }, { $unwind: '$u' }, { $group: { _id: '$u.status', n: { $sum: 1 } } }]),
    StudentProfile.countDocuments({ trainer: trainerId, createdAt: { $gte: new Date(now.getTime() - 30 * 86_400_000) } }),
    Appointment.find({ trainer: trainerId, active: true, start: { $gte: dayStart, $lt: dayEnd } }).sort({ start: 1 }).limit(30).populate('student', 'firstName lastName'),
    Membership.find({ trainer: trainerId, status: 'activa', endDate: { $gte: now, $lte: new Date(now.getTime() + 7 * 86_400_000) } }).sort({ endDate: 1 }).limit(20).populate('student', 'firstName lastName'),
    pendingPayments(trainerId),
    Payment.aggregate([{ $match: { trainer: tid, status: 'registrado', paidAt: { $gte: monthStart } } }, { $group: { _id: '$currency', total: { $sum: '$amount' }, count: { $sum: 1 } } }]),
    StudentProfile.aggregate([{ $match: { trainer: tid, createdAt: { $gte: sixMonthsAgo } } }, { $group: { _id: { $dateToString: { ...fmt.$dateToString, date: '$createdAt' } }, n: { $sum: 1 } } }]),
    Payment.aggregate([{ $match: { trainer: tid, status: 'registrado', paidAt: { $gte: sixMonthsAgo } } }, { $group: { _id: { month: { $dateToString: { ...fmt.$dateToString, date: '$paidAt' } }, currency: '$currency' }, total: { $sum: '$amount' } } }]),
    WorkoutLog.find({ trainer: trainerId }).sort({ performedAt: -1 }).limit(5).populate('student', 'firstName lastName').populate('routine', 'name'),
    Payment.find({ trainer: trainerId }).sort({ createdAt: -1 }).limit(5).populate('student', 'firstName lastName'),
    Appointment.find({ trainer: trainerId }).sort({ createdAt: -1 }).limit(5).populate('student', 'firstName lastName'),
  ]);

  const counts = Object.fromEntries(statusCounts.map((s) => [s._id, s.n]));
  const totalStudents = Object.values(counts).reduce((a, b) => a + b, 0);
  const name = (s) => (s ? `${s.firstName} ${s.lastName}` : 'Alumno');
  const recent = [
    ...lastWorkouts.map((w) => ({ type: 'entrenamiento', at: w.performedAt, text: `${name(w.student)} completó ${w.routine?.name ?? 'una rutina'}` })),
    ...lastPayments.map((p) => ({ type: 'pago', at: p.createdAt, text: `Pago de ${name(p.student)}: ${p.currency} ${p.amount}${p.status === 'anulado' ? ' (anulado)' : ''}` })),
    ...lastAppointments.map((a) => ({ type: 'turno', at: a.createdAt, text: `Turno de ${name(a.student)} (${a.status})` })),
  ].sort((a, b) => b.at - a.at).slice(0, 10);

  const currencies = [...new Set(revenueSeries.map((r) => r._id.currency))];
  const dueTotals = {};
  for (const p of pending) dueTotals[p.currency] = Math.round(((dueTotals[p.currency] ?? 0) + p.due) * 100) / 100;

  return {
    timezone: tz, isEmpty: totalStudents === 0,
    students: { active: counts.active ?? 0, pending: counts.pending ?? 0, inactive: counts.inactive ?? 0, total: totalStudents, new30d: newStudents },
    todayAppointments: today,
    membershipsDueSoon: dueSoon.map((m) => ({ id: m._id, endDate: m.endDate, student: m.student && { id: m.student._id, name: name(m.student) } })),
    pendingPayments: { count: pending.length, totals: dueTotals, items: pending.slice(0, 10) },
    revenueThisMonth: revenueMonth.map((r) => ({ currency: r._id, total: r.total, count: r.count })),
    charts: {
      months,
      newStudentsByMonth: months.map((m) => studentsSeries.find((s) => s._id === m)?.n ?? 0),
      revenueByMonth: currencies.map((c) => ({ currency: c, values: months.map((m) => revenueSeries.find((r) => r._id.month === m && r._id.currency === c)?.total ?? 0) })),
    },
    recentActivity: recent,
  };
}
