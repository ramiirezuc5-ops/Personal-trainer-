import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requireRole } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import * as appts from '../services/appointments.service.js';
import * as billing from '../services/billing.service.js';
import * as notifications from '../services/notifications.service.js';
import * as progress from '../services/progress.service.js';
import * as routines from '../services/routines.service.js';
import * as students from '../services/students.service.js';
import * as workouts from '../services/workouts.service.js';
import { asyncHandler as h } from '../utils/asyncHandler.js';
import * as exercisesService from '../services/exercises.service.js';
import { scopeFor } from '../utils/ownership.js';
import { idParam, isoDate } from '../utils/schemas.js';
import * as v from '../validators/domain.validators.js';

// Rutas del ALUMNO: todo se filtra con scopeFor(req.user) → solo ve y modifica lo propio.
export const meRouter = Router();
meRouter.use(authenticate, requireRole('student'));

meRouter.get('/profile', h(async (req, res) => res.json(await students.getMyProfile(req.user))));
meRouter.patch('/profile', validate(v.studentSelfUpdate), h(async (req, res) => res.json(await students.updateMyProfile(req.user, req.body))));

meRouter.get('/routines', h(async (req, res) => res.json(await routines.listMyRoutines(req.user))));
meRouter.get('/routines/:id', validate(idParam, 'params'), h(async (req, res) => res.json(await routines.getMyRoutine(req.user, req.params.id))));

meRouter.post('/workouts', validate(v.workoutCreate), h(async (req, res) => {
  const { log, duplicate } = await workouts.logWorkout(req.user, req.body);
  res.status(duplicate ? 200 : 201).json({ ...log.toObject(), duplicate });
}));
meRouter.get('/exercises', h(async (req, res) => res.json(await exercisesService.listActiveForTrainer(req.user.trainerId))));
meRouter.get('/workouts', validate(v.rangeQuery, 'query'), h(async (req, res) => res.json(await workouts.listWorkouts(scopeFor(req.user), req.query))));
meRouter.get('/workouts/last-performance', validate(v.exerciseIdList, 'query'), h(async (req, res) => res.json(await workouts.lastPerformance(scopeFor(req.user), req.query.exercises))));
meRouter.get('/compliance', validate(z.object({ from: isoDate, to: isoDate }), 'query'), h(async (req, res) => res.json(await workouts.compliance(scopeFor(req.user), req.query.from, req.query.to))));

meRouter.post('/progress', validate(v.progressCreateStudent), h(async (req, res) => res.status(201).json(await progress.createMeasurement(req.user, null, req.body))));
meRouter.get('/progress', validate(v.rangeQuery, 'query'), h(async (req, res) => res.json(await progress.listMeasurements(scopeFor(req.user), req.query, { includeNotes: false }))));
meRouter.get('/progress/compare', validate(v.compareQuery, 'query'), h(async (req, res) => res.json(await progress.comparePeriods(scopeFor(req.user), req.query))));

meRouter.get('/appointments', validate(v.apptListQuery, 'query'), h(async (req, res) => res.json(await appts.listAppointments(scopeFor(req.user), req.query))));
meRouter.get('/availability', validate(v.availabilityQuery, 'query'), h(async (req, res) => res.json(await appts.availability(req.user, req.query.date))));
meRouter.post('/appointments', validate(v.studentBook), h(async (req, res) => res.status(201).json(await appts.bookAsStudent(req.user, req.body))));
meRouter.post('/appointments/:id/cancel', validate(idParam, 'params'), h(async (req, res) => res.json(await appts.cancelAsStudent(req.user, req.params.id))));

meRouter.get('/billing', h(async (req, res) => res.json(await billing.myBilling(req.user))));

export const notificationsRouter = Router();
notificationsRouter.use(authenticate);
notificationsRouter.get('/', h(async (req, res) => res.json(await notifications.listMine(req.user.id))));
notificationsRouter.post('/read-all', h(async (req, res) => { await notifications.markAllRead(req.user.id); res.status(204).end(); }));
notificationsRouter.post('/:id/read', validate(idParam, 'params'), h(async (req, res) => res.json(await notifications.markRead(req.user.id, req.params.id))));
