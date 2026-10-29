import { randomBytes, timingSafeEqual } from "node:crypto";
import type { Request, Response, NextFunction, RequestHandler } from "express";
import session from "express-session";
import MongoStore from "connect-mongo";
import mongoose from "mongoose";
import { z } from "zod";
import { isDatabaseReady } from "../../config/database.js";
import { env } from "../../config/env.js";
import { httpError } from "../../middleware/error-handler.js";

declare module "express-session" {
  interface SessionData {
    userId?: string;
    csrfToken?: string;
  }
}
export const cookieName = env.isProduction ? "__Host-mmm.sid" : "mmm.sid";
export const cookieOptions = {
  httpOnly: true,
  secure: env.isProduction,
  sameSite: "lax" as const,
  path: "/",
};

// Reuse Mongoose's connection. No extra DB connection and no in-memory session fallback.
export function createSessionMiddleware(): RequestHandler {
  let middleware: RequestHandler | undefined;
  let sessionClient:
    ReturnType<typeof mongoose.connection.getClient> | undefined;
  return (req, res, next) => {
    if (!isDatabaseReady()) {
      next(
        httpError(
          503,
          "AUTH_UNAVAILABLE",
          "The database is temporarily unavailable. Please try again shortly.",
        ),
      );
      return;
    }
    const client = mongoose.connection.getClient();
    if (!middleware || sessionClient !== client) {
      sessionClient = client;
      const store = MongoStore.create({
        client,
        dbName: mongoose.connection.name,
        collectionName: "sessions",
        ttl: 7 * 24 * 60 * 60,
      });
      store.on("error", () =>
        console.error("[session] MongoDB session storage is unavailable."),
      );
      middleware = session({
        name: cookieName,
        secret: env.sessionSecret,
        store,
        resave: false,
        saveUninitialized: false,
        cookie: { ...cookieOptions, maxAge: 7 * 24 * 60 * 60 * 1000 },
      });
    }
    middleware(req, res, (error) => {
      if (error) {
        next(
          httpError(
            503,
            "SESSION_UNAVAILABLE",
            "Could not access your session. Please try again.",
          ),
        );
        return;
      }
      next();
    });
  };
}
const csrfTokenInput = z.hex().length(64).lowercase();

export function checkCsrf(req: Request, _res: Response, next: NextFunction) {
  const origin = req.get("origin");
  if (origin && !env.allowedOrigins.includes(origin)) {
    next(
      httpError(
        403,
        "INVALID_ORIGIN",
        "This website address is not allowed. Open the app using its configured URL.",
      ),
    );
    return;
  }
  const expected = req.session.csrfToken;
  const received = req.get("x-csrf-token");
  if (
    !expected ||
    !received ||
    !csrfTokenInput.safeParse(received).success ||
    received.length !== expected.length ||
    !timingSafeEqual(Buffer.from(received), Buffer.from(expected))
  ) {
    next(
      httpError(
        403,
        "INVALID_CSRF",
        "Your form session expired. Please try again.",
      ),
    );
    return;
  }
  next();
}
export async function startUserSession(req: Request, userId: string) {
  await new Promise<void>((resolve, reject) =>
    req.session.regenerate((error) => (error ? reject(error) : resolve())),
  );
  req.session.userId = userId;
  req.session.csrfToken = randomBytes(32).toString("hex");
  await new Promise<void>((resolve, reject) =>
    req.session.save((error) => (error ? reject(error) : resolve())),
  );
}
