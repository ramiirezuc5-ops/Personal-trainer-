import 'dotenv/config';
import { z } from 'zod';

const bool = z.enum(['true', 'false']).transform((v) => v === 'true');

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  LOG_LEVEL: z.string().default('info'),
  TRUST_PROXY: z.coerce.number().int().min(0).default(0),
  MONGODB_URI: z.string().min(1, 'MONGODB_URI es obligatorio'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET debe tener al menos 32 caracteres'),
  ACCESS_TOKEN_TTL_MIN: z.coerce.number().int().positive().default(15),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(7),
  CLIENT_URL: z.string().url('CLIENT_URL debe ser una URL válida').transform((u) => u.replace(/\/$/, '')),
  COOKIE_SAMESITE: z.enum(['lax', 'strict', 'none']).default('lax'),
  COOKIE_SECURE: bool.default('false'),
  COOKIE_DOMAIN: z.string().optional().transform((v) => v || undefined),
  SMTP_HOST: z.string().optional().transform((v) => v || undefined),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_USER: z.string().optional().transform((v) => v || undefined),
  SMTP_PASS: z.string().optional().transform((v) => v || undefined),
  MAIL_FROM: z.string().default('Personal Trainer App <no-reply@example.com>'),
  APP_NAME: z.string().default('Personal Trainer App'),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  const lines = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
  throw new Error(`Configuración de entorno inválida:\n${lines}\nRevisá tu archivo .env (ver .env.example).`);
}

export const env = Object.freeze(parsed.data);

if (env.NODE_ENV === 'production') {
  if (!env.COOKIE_SECURE) throw new Error('En producción COOKIE_SECURE debe ser "true" (HTTPS).');
  if (env.COOKIE_SAMESITE === 'none' && !env.COOKIE_SECURE) throw new Error('SameSite=None requiere COOKIE_SECURE=true.');
}
