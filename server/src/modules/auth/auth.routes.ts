import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import { createSessionMiddleware, checkCsrf } from "./auth.session.js";
import * as auth from "./auth.controller.js";

export function createAuthRouter() {
  const router = Router();
  // Suitable for this single-process monolith; a shared limiter is needed before scaling instances.
  const limit = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 15,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: {
      error: {
        code: "RATE_LIMITED",
        message: "Too many attempts. Try again in 15 minutes.",
      },
    },
  });
  const tokenLimit = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 120,
    // A signed-in user must always be able to obtain the token needed to log out.
    skip: (req) => Boolean(req.session.userId),
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: {
      error: {
        code: "RATE_LIMITED",
        message: "Too many requests. Please try again later.",
      },
    },
  });
  router.use(createSessionMiddleware());
  router.get("/csrf", tokenLimit, auth.getCsrf);
  router.get("/me", tokenLimit, auth.me);
  router.post("/signup", limit, checkCsrf, auth.signup);
  router.post("/login", limit, checkCsrf, auth.login);
  router.post("/logout", checkCsrf, auth.logout);
  return router;
}
