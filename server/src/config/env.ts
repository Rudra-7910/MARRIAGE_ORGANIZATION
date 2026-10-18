import path from 'node:path';
import dotenv from 'dotenv';

// Resolve server/.env from this file, so commands also work from the repo root.
const envFile = path.resolve(import.meta.dirname, '../../.env');
dotenv.config({ path: envFile, quiet: true });

const nodeEnv = process.env.NODE_ENV || 'development';
if (!['development', 'test', 'production'].includes(nodeEnv)) {
  throw new Error('NODE_ENV must be development, test, or production.');
}

const port = Number(process.env.PORT || 3000);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('PORT must be a valid number between 1 and 65535.');
}

const mongoUri = (process.env.MONGODB_URI || '').trim();
if (mongoUri && !mongoUri.startsWith('mongodb://') && !mongoUri.startsWith('mongodb+srv://')) {
  throw new Error('MONGODB_URI must be a MongoDB connection string.');
}

export const env = {
  nodeEnv,
  isProduction: nodeEnv === 'production',
  port,
  host: process.env.HOST || '127.0.0.1',
  mongoUri,
};
