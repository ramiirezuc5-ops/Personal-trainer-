import mongoose from 'mongoose';
import { env } from './env.js';
import { logger } from '../utils/logger.js';
import dns from 'node:dns';

dns.setServers(['8.8.8.8', '1.1.1.1']);

mongoose.set('strictQuery', true);

export async function connectDB() {
  await mongoose.connect(env.MONGODB_URI, { serverSelectionTimeoutMS: 8000 });
  logger.info({ db: mongoose.connection.name }, 'MongoDB conectado');
}

export const disconnectDB = () => mongoose.disconnect();
