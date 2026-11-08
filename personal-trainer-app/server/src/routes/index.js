import { Router } from 'express';
import mongoose from 'mongoose';
import authRoutes from './auth.routes.js';
import { appointmentsRouter, billingRouter, dashboardRouter } from './business.routes.js';
import { exercisesRouter, routinesRouter } from './catalog.routes.js';
import { meRouter, notificationsRouter } from './me.routes.js';
import studentsRouter from './students.routes.js';

const router = Router();
router.get('/health', (_req, res) => {
  const states = ['disconnected', 'connected', 'connecting', 'disconnecting'];
  res.json({ status: 'ok', db: states[mongoose.connection.readyState] ?? 'unknown', uptime: Math.round(process.uptime()) });
});

router.use('/auth', authRoutes);
router.use('/students', studentsRouter);
router.use('/exercises', exercisesRouter);
router.use('/routines', routinesRouter);
router.use('/appointments', appointmentsRouter);
router.use('/billing', billingRouter);
router.use('/notifications', notificationsRouter);
router.use('/me', meRouter);
router.use('/', dashboardRouter); // /dashboard y /settings

export default router;
