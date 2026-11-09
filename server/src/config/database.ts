import mongoose from "mongoose";
import { Family, Wedding } from "../modules/weddings/wedding.models.js";
import { User } from "../modules/auth/user.model.js";
import { Guest } from "../modules/invitations/invitation.model.js";
import { TranslationCache } from "../modules/integrations/integration.routes.js";
import { Provider, Review } from "../modules/providers/provider.models.js";
import { Photo, UploadGrant } from "../modules/media/media.models.js";
import { env } from "./env.js";

let initialized = false;
let initializationFailed = false;

export function isDatabaseReady() {
  return initialized && mongoose.connection.readyState === 1;
}

export async function connectDatabase() {
  initialized = false;
  initializationFailed = false;
  try {
    await mongoose.connect(env.mongoUri, {
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 5000,
      bufferCommands: false,
      // A small pool per Vercel instance avoids exhausting Atlas connections.
      maxPoolSize: process.env.VERCEL === "1" ? 10 : 100,
      maxIdleTimeMS: 60000,
      // Build required indexes explicitly before enabling authentication.
      autoIndex: false,
    });
    await User.createIndexes();
    await Family.createIndexes();
    await Wedding.createIndexes();
    await Guest.createIndexes();
    await Provider.createIndexes();
    await Review.createIndexes();
    await Photo.createIndexes();
    await UploadGrant.createIndexes();
    await TranslationCache.createIndexes();
    initialized = true;
    console.info(
      "[database] Connected to MongoDB; required indexes are ready.",
    );
  } catch (error) {
    initializationFailed = true;
    await mongoose.disconnect();
    throw error;
  }
}

export function getDatabaseStatus() {
  if (initializationFailed) return "initialization_failed";
  if (mongoose.connection.readyState === 1)
    return initialized ? "connected" : "initializing";
  if (mongoose.connection.readyState === 2) return "connecting";
  if (mongoose.connection.readyState === 3) return "disconnecting";
  return "disconnected";
}

export async function disconnectDatabase() {
  initialized = false;
  await mongoose.disconnect();
}
