import { Router } from 'express';
import { authenticate, authorize } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import * as exercises from '../services/exercises.service.js';
import * as routines from '../services/routines.service.js';
import { asyncHandler as h } from '../utils/asyncHandler.js';
import { idParam } from '../utils/schemas.js';
import * as v from '../validators/domain.validators.js';

export const exercisesRouter = Router();
exercisesRouter.use(authenticate, authorize('exercises:manage'));
exercisesRouter.get('/', validate(v.exerciseListQuery, 'query'), h(async (req, res) => res.json(await exercises.listExercises(req.user.id, req.query))));
exercisesRouter.post('/', validate(v.exerciseCreate), h(async (req, res) => res.status(201).json(await exercises.createExercise(req.user.id, req.body))));
exercisesRouter.get('/:id', validate(idParam, 'params'), h(async (req, res) => res.json(await exercises.getExercise(req.user.id, req.params.id))));
exercisesRouter.patch('/:id', validate(idParam, 'params'), validate(v.exerciseUpdate), h(async (req, res) => res.json(await exercises.updateExercise(req.user.id, req.params.id, req.body))));
exercisesRouter.post('/:id/archive', validate(idParam, 'params'), h(async (req, res) => res.json(await exercises.setArchived(req.user.id, req.params.id, true))));
exercisesRouter.post('/:id/restore', validate(idParam, 'params'), h(async (req, res) => res.json(await exercises.setArchived(req.user.id, req.params.id, false))));

export const routinesRouter = Router();
routinesRouter.use(authenticate, authorize('routines:manage'));
routinesRouter.get('/', validate(v.routineListQuery, 'query'), h(async (req, res) => res.json(await routines.listRoutines(req.user.id, req.query))));
routinesRouter.post('/', validate(v.routineCreate), h(async (req, res) => res.status(201).json(await routines.createRoutine(req.user.id, req.body))));
routinesRouter.get('/:id', validate(idParam, 'params'), h(async (req, res) => res.json(await routines.getRoutine(req.user.id, req.params.id))));
routinesRouter.patch('/:id', validate(idParam, 'params'), validate(v.routineUpdate), h(async (req, res) => res.json(await routines.updateRoutine(req.user.id, req.params.id, req.body))));
routinesRouter.post('/:id/status', validate(idParam, 'params'), validate(v.routineStatus), h(async (req, res) => res.json(await routines.setRoutineStatus(req.user.id, req.params.id, req.body.status))));
