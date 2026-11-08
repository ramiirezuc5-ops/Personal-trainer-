import { Router } from 'express';
import { z } from 'zod';
import { StudentProfile } from '../models/StudentProfile.js';
import { authenticate, authorize } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import * as appointmentsOverview from '../services/billing.service.js';
import * as students from '../services/students.service.js';
import * as workouts from '../services/workouts.service.js';
import * as progress from '../services/progress.service.js';
import { asyncHandler as h } from '../utils/asyncHandler.js';
import { badRequest, notFound } from '../utils/errors.js';
import { isoDate } from '../utils/schemas.js';
import * as v from '../validators/domain.validators.js';

const router = Router();
router.use(authenticate, authorize('students:manage'));

// Todo recurso anidado verifica que el alumno pertenezca al entrenador autenticado (si no, 404).
router.param('id', (req, _res, next, id) => {
  if (!/^[a-f\d]{24}$/i.test(id)) return next(badRequest('Identificador inválido.', 'INVALID_ID'));
  return StudentProfile.exists({ _id: id, trainer: req.user.id })
    .then((ok) => (ok ? next() : next(notFound('Alumno no encontrado.', 'STUDENT_NOT_FOUND'))))
    .catch(next);
});

const meta = (req) => ({ ip: req.ip, userAgent: req.get('user-agent')?.slice(0, 200) });
const scope = (req) => ({ trainer: req.user.id, student: req.params.id });
const period = z.object({ from: isoDate, to: isoDate });

router.get('/', validate(v.studentListQuery, 'query'), h(async (req, res) => res.json(await students.listStudents(req.user.id, req.query))));
router.post('/', validate(v.studentCreate), h(async (req, res) => res.status(201).json(await students.createStudent(req.user, req.body, meta(req)))));
router.get('/:id', h(async (req, res) => res.json(await students.getStudent(req.user.id, req.params.id))));
router.patch('/:id', validate(v.studentUpdate), h(async (req, res) => res.json(await students.updateStudent(req.user.id, req.params.id, req.body))));
router.post('/:id/deactivate', h(async (req, res) => res.json(await students.deactivateStudent(req.user.id, req.params.id))));
router.post('/:id/reactivate', h(async (req, res) => res.json(await students.reactivateStudent(req.user, req.params.id, meta(req)))));
router.post('/:id/resend-invite', h(async (req, res) => { await students.resendInvite(req.user, req.params.id, meta(req)); res.status(202).json({ message: 'Invitación enviada.' }); }));

router.get('/:id/workouts', validate(v.rangeQuery, 'query'), h(async (req, res) => res.json(await workouts.listWorkouts(scope(req), req.query))));
router.get('/:id/compliance', validate(period, 'query'), h(async (req, res) => res.json(await workouts.compliance(scope(req), req.query.from, req.query.to))));
router.get('/:id/progress', validate(v.rangeQuery, 'query'), h(async (req, res) => res.json(await progress.listMeasurements(scope(req), req.query, { includeNotes: true }))));
router.post('/:id/progress', validate(v.progressCreateTrainer), h(async (req, res) => res.status(201).json(await progress.createMeasurement(req.user, req.params.id, req.body))));
router.get('/:id/progress/compare', validate(v.compareQuery, 'query'), h(async (req, res) => res.json(await progress.comparePeriods(scope(req), req.query))));

router.get('/:id/memberships', h(async (req, res) => res.json(await appointmentsOverview.listMemberships(req.user.id, req.params.id))));
router.post('/:id/memberships', validate(v.membershipCreate), h(async (req, res) => res.status(201).json(await appointmentsOverview.assignMembership(req.user.id, req.params.id, req.body))));
router.post('/:id/payments', validate(v.paymentCreate), h(async (req, res) => res.status(201).json(await appointmentsOverview.createPayment(req.user.id, req.params.id, req.body))));

export default router;
