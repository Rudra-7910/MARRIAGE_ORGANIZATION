import pino from "pino";

// Logs contain operational metadata, never request bodies, cookies or email links.
export const logger = pino({
  enabled: process.env.NODE_ENV !== "test",
  level: process.env.NODE_ENV === "production" ? "info" : "warn",
  base: undefined,
  redact: {
    paths: ["req.headers", "req.body", "res.headers", "password", "token"],
    remove: true,
  },
});
