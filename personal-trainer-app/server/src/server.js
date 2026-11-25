import { createApp } from './app.js';
import { connectDB, disconnectDB } from './config/db.js';
import { env } from './config/env.js';
import { ensureIndexes } from './models/index.js';
import { logger } from './utils/logger.js';

async function main() {
  await connectDB();
  await ensureIndexes();
  // const server = createApp().listen(env.PORT, () => logger.info({ port: env.PORT, env: env.NODE_ENV }, 'API escuchando'));
  const server = createApp().listen(env.PORT, '0.0.0.0', () => {
  logger.info({ port: env.PORT, env: env.NODE_ENV }, 'API escuchando');
});
  const shutdown = (signal) => {
    logger.info({ signal }, 'Cerrando servidor');
    server.close(async () => { await disconnectDB(); process.exit(0); });
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('unhandledRejection', (err) => logger.error({ err }, 'unhandledRejection'));
}

main().catch((err) => { logger.fatal({ err }, 'No se pudo iniciar el servidor'); process.exit(1); });
