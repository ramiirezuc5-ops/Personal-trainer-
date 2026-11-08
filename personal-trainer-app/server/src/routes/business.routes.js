import { Router } from 'express';
import { z } from 'zod';
import { authenticate, authorize } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import * as appts from '../services/appointments.service.js';
import * as billing from '../services/billing.service.js';
import { trainerDashboard } from '../services/dashboard.service.js';
import * as settings from '../services/settings.service.js';
import { asyncHandler as h } from '../utils/asyncHandler.js';
import { idParam } from '../utils/schemas.js';
import * as v from '../validators/domain.validators.js';

/* ---------- Agenda ---------- */
export const appointmentsRouter = Router();
appointmentsRouter.use(authenticate, authorize('appointments:manage'));
appointmentsRouter.get('/', validate(v.apptListQuery, 'query'), h(async (req, res) => res.json(await appts.listAppointments({ trainer: req.user.id }, req.query))));
appointmentsRouter.post('/', validate(v.apptCreate), h(async (req, res) => res.status(201).json(await appts.createByTrainer(req.user, req.body))));
appointmentsRouter.patch('/:id', validate(idParam, 'params'), validate(v.apptReschedule), h(async (req, res) => res.json(await appts.reschedule(req.user, req.params.id, req.body))));
appointmentsRouter.post('/:id/status', validate(idParam, 'params'), validate(v.apptStatus), h(async (req, res) => res.json(await appts.setStatus(req.user, req.params.id, req.body.status))));
appointmentsRouter.post('/:id/cancel', validate(idParam, 'params'), validate(v.apptCancel), h(async (req, res) => res.json(await appts.cancelByTrainer(req.user, req.params.id, req.body.reason))));

/* ---------- Planes, membresías y pagos ---------- */
export const billingRouter = Router();
billingRouter.use(authenticate);
const plansQuery = z.object({ includeInactive: z.enum(['true', 'false']).default('false').transform((x) => x === 'true') });
billingRouter.get('/plans', authorize('plans:manage'), validate(plansQuery, 'query'), h(async (req, res) => res.json(await billing.listPlans(req.user.id, req.query))));
billingRouter.post('/plans', authorize('plans:manage'), validate(v.planCreate), h(async (req, res) => res.status(201).json(await billing.createPlan(req.user.id, req.body))));
billingRouter.patch('/plans/:id', authorize('plans:manage'), validate(idParam, 'params'), validate(v.planUpdate), h(async (req, res) => res.json(await billing.updatePlan(req.user.id, req.params.id, req.body))));
billingRouter.post('/memberships/:id/cancel', authorize('plans:manage'), validate(idParam, 'params'), h(async (req, res) => res.json(await billing.cancelMembership(req.user.id, req.params.id))));
billingRouter.get('/payments', authorize('payments:manage'), validate(v.paymentListQuery, 'query'), h(async (req, res) => res.json(await billing.listPayments({ trainer: req.user.id }, req.query))));
billingRouter.post('/payments/:id/void', authorize('payments:manage'), validate(idParam, 'params'), validate(v.paymentVoid), h(async (req, res) => res.json(await billing.voidPayment(req.user.id, req.params.id, req.body.reason))));
billingRouter.get('/pending', authorize('payments:manage'), h(async (req, res) => res.json(await billing.pendingPayments(req.user.id))));
billingRouter.get('/summary', authorize('payments:manage'), validate(v.summaryQuery, 'query'), h(async (req, res) => res.json(await billing.revenueSummary(req.user.id, req.query))));

/* ---------- Dashboard y configuración ---------- */
export const dashboardRouter = Router();
dashboardRouter.get('/dashboard', authenticate, authorize('stats:read'), h(async (req, res) => res.json(await trainerDashboard(req.user.id))));
dashboardRouter.get('/settings', authenticate, authorize('settings:manage'), h(async (req, res) => res.json(await settings.getSettings(req.user.id))));
dashboardRouter.patch('/settings', authenticate, authorize('settings:manage'), validate(v.settingsUpdate), h(async (req, res) => res.json(await settings.updateSettings(req.user.id, req.body))));
