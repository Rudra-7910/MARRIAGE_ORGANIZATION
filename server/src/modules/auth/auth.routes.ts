import { Router } from "express";
import { createHash, randomBytes } from "node:crypto";
import { rateLimit } from "express-rate-limit";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { z } from "zod";
import {
  createSessionMiddleware,
  checkCsrf,
  cookieName,
  cookieOptions,
  startUserSession,
} from "./auth.session.js";
import { User } from "./user.model.js";
import { httpError } from "../../middleware/error-handler.js";
import { env } from "../../config/env.js";
import { logger } from "../../config/logger.js";
import { passwordResetEmail } from "./auth.email.js";
import {
  sendWithResend,
  type EmailSender,
} from "../invitations/invitation.email.js";

const email = z
  .string()
  .trim()
  .toLowerCase()
  .max(254)
  .pipe(z.email("Enter a valid email address."));

const password = z
  .string()
  .min(8, "Use at least 8 characters.")
  .refine(
    (value) => Buffer.byteLength(value, "utf8") <= 72,
    "Password must be at most 72 bytes.",
  );

const signupSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email,
  password,
});
const loginSchema = z.object({
  email,
  password: z.string().min(1).max(1024),
});

// Never include the password hash in an API response.
function publicUser(user: { id: string; name: string; email: string }) {
  return { id: user.id, name: user.name, email: user.email };
}

// Unknown emails still perform a password comparison to reduce timing differences.
const dummyHash = bcrypt.hashSync("unused-login-comparison", 12);

export function createAuthRouter(sendEmail: EmailSender = sendWithResend) {
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
  const recoveryLimit = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: {
      error: {
        code: "RATE_LIMITED",
        message: "Too many recovery attempts. Try again in 15 minutes.",
      },
    },
  });

  router.get("/csrf", tokenLimit, (req, res) => {
    if (!req.session.csrfToken)
      req.session.csrfToken = randomBytes(32).toString("hex");
    res.json({ data: { token: req.session.csrfToken } });
  });

  router.get("/me", tokenLimit, async (req, res) => {
    if (!req.session.userId)
      throw httpError(401, "UNAUTHENTICATED", "Please log in to continue.");
    const user = res.locals.user as InstanceType<typeof User> | undefined;
    if (!user)
      throw httpError(401, "UNAUTHENTICATED", "Please log in to continue.");
    res.json({ data: publicUser(user) });
  });

  router.post("/signup", limit, checkCsrf, async (req, res) => {
    const { name, email, password } = signupSchema.parse(req.body);
    let user;
    try {
      // The model's save hook hashes this before MongoDB receives the document.
      user = await User.create({ name, email, passwordHash: password });
    } catch (error) {
      if (
        error instanceof mongoose.mongo.MongoServerError &&
        error.code === 11000
      ) {
        throw httpError(
          409,
          "EMAIL_IN_USE",
          "An account already uses that email. Try logging in.",
        );
      }
      throw error;
    }
    await startUserSession(req, user.id);
    res.status(201).json({ data: publicUser(user) });
  });

  router.post("/login", limit, checkCsrf, async (req, res) => {
    const result = loginSchema.safeParse(req.body);
    if (!result.success)
      throw httpError(
        422,
        "INVALID_INPUT",
        "Enter a valid email and password.",
      );
    const { email, password } = result.data;
    const user = await User.findOne({ email }).select(
      "+passwordHash +sessionVersion",
    );
    const valid = await bcrypt.compare(
      password,
      user?.passwordHash || dummyHash,
    );
    if (!user || !valid || Buffer.byteLength(password, "utf8") > 72) {
      throw httpError(
        401,
        "INVALID_CREDENTIALS",
        "Email or password is incorrect.",
      );
    }
    await startUserSession(req, user.id, user.sessionVersion || 0);
    res.json({ data: publicUser(user) });
  });

  router.post(
    "/forgot-password",
    recoveryLimit,
    checkCsrf,
    async (req, res) => {
      const values = z.object({ email }).strict().parse(req.body);
      if (!env.resendApiKey || !env.resendFrom)
        throw httpError(
          503,
          "EMAIL_UNAVAILABLE",
          "Password recovery is temporarily unavailable. Please contact support.",
        );
      const now = new Date();
      const token = randomBytes(32).toString("hex");
      // One atomic cooldown also prevents email flooding through different IPs.
      const user = await User.findOneAndUpdate(
        {
          email: values.email,
          $or: [
            { resetRequestedAt: { $exists: false } },
            { resetRequestedAt: { $lte: new Date(now.getTime() - 5 * 60000) } },
          ],
        },
        {
          $set: {
            resetTokenHash: createHash("sha256").update(token).digest("hex"),
            resetExpiresAt: new Date(now.getTime() + 15 * 60000),
            resetRequestedAt: now,
          },
        },
        { returnDocument: "after" },
      );
      if (user) {
        const content = await passwordResetEmail(
          env.appOrigin + "/reset-password#" + token,
        );
        try {
          const result = await sendEmail(
            {
              from: env.resendFrom,
              to: user.email,
              subject: "Reset your Make My Marriage password",
              ...content,
            },
            "password-reset/" +
              createHash("sha256").update(token).digest("hex"),
          );
          if (result.status !== "submitted")
            logger.warn("Password recovery email was not confirmed.");
        } catch {
          logger.warn("Password recovery email was not confirmed.");
        }
      }
      // Match the response for unknown addresses and requests inside the cooldown.
      res.json({
        data: {
          message:
            "If an account matches that email, a reset link will arrive shortly. Check spam too, and wait five minutes before requesting another.",
        },
      });
    },
  );

  router.post("/reset-password", recoveryLimit, checkCsrf, async (req, res) => {
    const values = z
      .object({ token: z.hex().length(64).lowercase(), password })
      .strict()
      .parse(req.body);
    // findOneAndUpdate does not run the save hook: hash first, then consume once.
    const passwordHash = await bcrypt.hash(values.password, 12);
    const user = await User.findOneAndUpdate(
      {
        resetTokenHash: createHash("sha256").update(values.token).digest("hex"),
        resetExpiresAt: { $gt: new Date() },
      },
      {
        $set: { passwordHash },
        $unset: { resetTokenHash: 1, resetExpiresAt: 1 },
        $inc: { sessionVersion: 1 },
      },
      { returnDocument: "after" },
    );
    if (!user)
      throw httpError(
        400,
        "RESET_UNAVAILABLE",
        "This reset link is invalid, expired or already used. Request a new one.",
      );
    req.app.locals.realtime?.disconnectUser(user.id);
    res.json({
      data: { message: "Password updated. Sign in with your new password." },
    });
  });

  router.post("/logout", checkCsrf, async (req, res) => {
    await new Promise<void>((resolve, reject) =>
      req.session.destroy((error) => (error ? reject(error) : resolve())),
    );
    res.clearCookie(cookieName, cookieOptions);
    res.json({ data: null });
  });

  return router;
}
