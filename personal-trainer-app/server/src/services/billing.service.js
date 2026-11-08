import { Membership } from '../models/Membership.js';
import { MembershipPlan } from '../models/MembershipPlan.js';
import { Payment } from '../models/Payment.js';
import { StudentProfile } from '../models/StudentProfile.js';
import { TrainerProfile } from '../models/TrainerProfile.js';
import { badRequest, conflict, notFound } from '../utils/errors.js';
import { oid } from '../utils/mongo.js';
import { scopeFor } from '../utils/ownership.js';
import { pageInfo, pageResult } from '../utils/pagination.js';

const DAY = 86_400_000;
const round2 = (n) => Math.round(n * 100) / 100;
const defaultCurrency = async (trainerId) => (await TrainerProfile.findOne({ user: trainerId }).select('currency'))?.currency ?? 'ARS';
const ownStudent = async (trainerId, id) => { if (!(await StudentProfile.exists({ _id: id, trainer: trainerId }))) throw notFound('Alumno no encontrado.', 'STUDENT_NOT_FOUND'); };

// Las membresías cambian de estado con el tiempo: se actualizan al consultar (sin tareas programadas).
export async function refreshMembershipStatuses(trainerId) {
  const now = new Date();
  await Membership.updateMany({ trainer: trainerId, status: 'activa', endDate: { $lt: now } }, { status: 'vencida' });
  await Membership.updateMany({ trainer: trainerId, status: 'pendiente', startDate: { $lte: now }, endDate: { $gte: now } }, { status: 'activa' });
}

/* ---------- planes ---------- */
export async function createPlan(trainerId, input) {
  return MembershipPlan.create({ ...input, currency: input.currency ?? (await defaultCurrency(trainerId)), trainer: trainerId });
}
export const listPlans = (trainerId, { includeInactive }) => MembershipPlan.find({ trainer: trainerId, ...(includeInactive ? {} : { active: true }) }).sort({ name: 1 });
export async function updatePlan(trainerId, id, patch) {
  const plan = await MembershipPlan.findOneAndUpdate({ _id: id, trainer: trainerId }, { $set: patch }, { new: true, runValidators: true });
  if (!plan) throw notFound('Plan no encontrado.');
  return plan;
}

/* ---------- membresías ---------- */
export async function assignMembership(trainerId, studentId, input) {
  await ownStudent(trainerId, studentId);
  const plan = await MembershipPlan.findOne({ _id: input.plan, trainer: trainerId, active: true });
  if (!plan) throw notFound('Plan no encontrado o inactivo.', 'PLAN_NOT_FOUND');
  const now = new Date();
  const startDate = input.startDate ?? now;
  const endDate = new Date(startDate.getTime() + plan.durationDays * DAY);
  if ((input.discount?.amount ?? 0) > plan.price) throw badRequest('El descuento no puede superar el precio del plan.', 'INVALID_DISCOUNT');
  if (await Membership.exists({ student: studentId, status: { $in: ['pendiente', 'activa'] }, startDate: { $lt: endDate }, endDate: { $gt: startDate } })) {
    throw conflict('El alumno ya tiene una membresía en ese período.', 'MEMBERSHIP_OVERLAP');
  }
  return Membership.create({
    trainer: trainerId, student: studentId, plan: plan._id, priceSnapshot: { amount: plan.price, currency: plan.currency },
    startDate, endDate, status: startDate <= now ? 'activa' : 'pendiente', discount: input.discount, notes: input.notes,
  });
}

export async function cancelMembership(trainerId, id) {
  const m = await Membership.findOneAndUpdate({ _id: id, trainer: trainerId, status: { $in: ['pendiente', 'activa'] } }, { status: 'cancelada' }, { new: true });
  if (m) return m;
  if (!(await Membership.exists({ _id: id, trainer: trainerId }))) throw notFound('Membresía no encontrada.');
  throw conflict('Esa membresía no se puede cancelar.', 'INVALID_STATE');
}

async function withBalances(memberships) {
  const ids = memberships.map((m) => m._id);
  const paid = await Payment.aggregate([{ $match: { membership: { $in: ids }, status: 'registrado' } }, { $group: { _id: '$membership', total: { $sum: '$amount' } } }]);
  const byId = Object.fromEntries(paid.map((p) => [String(p._id), p.total]));
  return memberships.map((m) => {
    const o = m.toObject();
    const owed = o.priceSnapshot.amount - (o.discount?.amount ?? 0);
    const paidTotal = byId[String(o._id)] ?? 0;
    return { ...o, paid: round2(paidTotal), owed: round2(owed), due: round2(Math.max(0, owed - paidTotal)) };
  });
}

export async function listMemberships(trainerId, studentId) {
  await ownStudent(trainerId, studentId);
  await refreshMembershipStatuses(trainerId);
  return withBalances(await Membership.find({ trainer: trainerId, student: studentId }).sort({ endDate: -1 }).populate('plan', 'name'));
}

/* ---------- pagos ---------- */
export async function createPayment(trainerId, studentId, input) {
  await ownStudent(trainerId, studentId);
  if (input.membership && !(await Membership.exists({ _id: input.membership, trainer: trainerId, student: studentId }))) throw notFound('Membresía no encontrada para ese alumno.', 'MEMBERSHIP_NOT_FOUND');
  if (input.periodStart && input.periodEnd && input.periodEnd < input.periodStart) throw badRequest('El fin del período no puede ser anterior al inicio.', 'INVALID_PERIOD');
  const paidAt = input.paidAt ?? new Date();
  if (paidAt.getTime() > Date.now() + DAY) throw badRequest('La fecha del pago no puede ser futura.', 'FUTURE_DATE');
  // source = 'manual' siempre: los pagos 'provider' solo pueden originarse en un webhook verificado (no implementado).
  return Payment.create({ ...input, paidAt, currency: input.currency ?? (await defaultCurrency(trainerId)), trainer: trainerId, student: studentId, source: 'manual', recordedBy: trainerId });
}

export async function voidPayment(trainerId, id, reason) {
  const p = await Payment.findOneAndUpdate({ _id: id, trainer: trainerId, status: 'registrado' }, { $set: { status: 'anulado', voided: { at: new Date(), by: trainerId, reason } } }, { new: true });
  if (p) return p;
  if (!(await Payment.exists({ _id: id, trainer: trainerId }))) throw notFound('Pago no encontrado.');
  throw conflict('El pago ya está anulado.', 'ALREADY_VOIDED');
}

export async function listPayments(scope, q) {
  const info = pageInfo(q);
  const filter = { ...scope };
  if (q.student) filter.student = q.student;
  if (q.status) filter.status = q.status;
  if (q.from || q.to) filter.paidAt = { ...(q.from && { $gte: q.from }), ...(q.to && { $lte: q.to }) };
  const [items, total] = await Promise.all([
    Payment.find(filter).sort({ paidAt: -1 }).skip(info.skip).limit(info.limit).populate('student', 'firstName lastName'),
    Payment.countDocuments(filter),
  ]);
  return pageResult(items, total, info);
}

// Saldo pendiente por membresía = precio − descuento − pagos registrados (los anulados no cuentan).
export async function pendingPayments(trainerId) {
  await refreshMembershipStatuses(trainerId);
  return Membership.aggregate([
    { $match: { trainer: oid(trainerId), status: { $in: ['pendiente', 'activa', 'vencida'] } } },
    { $lookup: { from: 'payments', let: { mid: '$_id' }, pipeline: [{ $match: { $expr: { $and: [{ $eq: ['$membership', '$$mid'] }, { $eq: ['$status', 'registrado'] }] } } }, { $group: { _id: null, total: { $sum: '$amount' } } }], as: 'paid' } },
    { $addFields: { paidTotal: { $ifNull: [{ $arrayElemAt: ['$paid.total', 0] }, 0] }, owed: { $subtract: ['$priceSnapshot.amount', { $ifNull: ['$discount.amount', 0] }] } } },
    { $addFields: { due: { $subtract: ['$owed', '$paidTotal'] } } },
    { $match: { due: { $gt: 0 } } },
    { $lookup: { from: 'studentprofiles', localField: 'student', foreignField: '_id', as: 's' } },
    { $unwind: '$s' },
    { $sort: { endDate: 1 } },
    { $project: { _id: 1, status: 1, endDate: 1, due: 1, currency: '$priceSnapshot.currency', student: { id: '$s._id', firstName: '$s.firstName', lastName: '$s.lastName' } } },
  ]);
}

export async function revenueSummary(trainerId, { from, to }) {
  const tz = (await TrainerProfile.findOne({ user: trainerId }).select('timezone'))?.timezone ?? 'America/Argentina/Buenos_Aires';
  const match = { trainer: oid(trainerId), status: 'registrado' };
  if (from || to) match.paidAt = { ...(from && { $gte: from }), ...(to && { $lte: to }) };
  const byMonth = await Payment.aggregate([
    { $match: match },
    { $group: { _id: { month: { $dateToString: { format: '%Y-%m', date: '$paidAt', timezone: tz } }, currency: '$currency' }, total: { $sum: '$amount' }, count: { $sum: 1 } } },
    { $sort: { '_id.month': 1 } },
    { $project: { _id: 0, month: '$_id.month', currency: '$_id.currency', total: 1, count: 1 } },
  ]);
  const totals = {};
  for (const r of byMonth) { totals[r.currency] ??= { currency: r.currency, total: 0, count: 0 }; totals[r.currency].total = round2(totals[r.currency].total + r.total); totals[r.currency].count += r.count; }
  return { timezone: tz, byMonth, totals: Object.values(totals) };
}

/* ---------- el propio alumno (solo lectura) ---------- */
export async function myBilling(me) {
  await refreshMembershipStatuses(me.trainerId);
  const [memberships, payments] = await Promise.all([
    Membership.find(scopeFor(me)).sort({ endDate: -1 }).populate('plan', 'name'),
    Payment.find(scopeFor(me)).sort({ paidAt: -1 }).limit(50).select('-recordedBy -trainer -provider'),
  ]);
  return { memberships: await withBalances(memberships), payments };
}
