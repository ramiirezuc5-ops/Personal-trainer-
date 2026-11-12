import crypto from 'node:crypto';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import { env } from './config/env.js';
import { csrfProtection } from './middlewares/csrf.js';
import { errorHandler, notFoundHandler } from './middlewares/errorHandler.js';
import { globalLimiter } from './middlewares/rateLimiters.js';
import apiRouter from './routes/index.js';
import { logger } from './utils/logger.js';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  if (env.TRUST_PROXY > 0) app.set('trust proxy', env.TRUST_PROXY);

  app.use(pinoHttp({
    logger,
    genReqId: (_req, res) => { const id = crypto.randomUUID(); res.setHeader('X-Request-Id', id); return id; },
    customLogLevel: (_req, res, err) => (err || res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info'),
  }));
  app.use(helmet());
  app.use(cors({
    origin: (origin, cb) => cb(null, !origin || env.ALLOWED_ORIGINS.includes(origin)), // sin cabecera CORS para otros orígenes
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'X-CSRF-Token'],
    maxAge: 600,
  }));
  app.use(globalLimiter);
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());
  app.use(csrfProtection);

  app.use('/api/v1', apiRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
