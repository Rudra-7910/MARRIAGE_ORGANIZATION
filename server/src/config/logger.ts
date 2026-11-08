import pino from "pino";
import { env } from "./env.js";

// Logs contain operational metadata, never request bodies, cookies or email links.
export const logger = pino({
  enabled: env.nodeEnv !== "test",
  level: env.isProduction ? "info" : "warn",
  base: undefined,
  redact: {
    paths: ["req.headers", "req.body", "res.headers", "password", "token"],
    remove: true,
  },
});
