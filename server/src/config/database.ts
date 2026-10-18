import mongoose from 'mongoose';
import { env } from './env.js';

export async function connectDatabase() {
  if (!env.mongoUri) {
    if (env.isProduction) {
      throw new Error('MONGODB_URI is required in production.');
    }

    console.info('[database] Not configured. Health endpoints remain available.');
    return;
  }

  await mongoose.connect(env.mongoUri, {
    serverSelectionTimeoutMS: 5000,
    connectTimeoutMS: 5000,
    bufferCommands: false,
    autoIndex: !env.isProduction,
  });

  console.info('[database] Connected to MongoDB.');
}

export function getDatabaseStatus() {
  if (!env.mongoUri) return 'unconfigured';
  if (mongoose.connection.readyState === 1) return 'connected';
  if (mongoose.connection.readyState === 2) return 'connecting';
  if (mongoose.connection.readyState === 3) return 'disconnecting';
  return 'disconnected';
}

export async function disconnectDatabase() {
  await mongoose.disconnect();
}
