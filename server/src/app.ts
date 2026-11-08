import express from "express";
import helmet from "helmet";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { rateLimit } from "express-rate-limit";
import { pinoHttp } from "pino-http";
import { logger } from "./config/logger.js";
import { env } from "./config/env.js";
import { errorHandler } from "./middleware/error-handler.js";
import { createAuthRouter } from "./modules/auth/auth.routes.js";
import { createWeddingRouter } from "./modules/weddings/wedding.routes.js";
import healthRouter from "./modules/health/health.routes.js";
import { createInvitationRouter } from "./modules/invitations/invitation.routes.js";
import type { EmailSender } from "./modules/invitations/invitation.email.js";
import { createTeamRouter } from "./modules/weddings/team.routes.js";
import { createPlanningRouter } from "./modules/planning/planning.routes.js";

import { publishChanges } from "./config/realtime.js";
import { createIntegrationRouter } from "./modules/integrations/integration.routes.js";
import { createFinanceRouter } from "./modules/finance/finance.routes.js";
import { createSiteRouter } from "./modules/site/site.routes.js";
import { createMediaRouter } from "./modules/media/media.routes.js";
import { createProviderRouter } from "./modules/providers/provider.routes.js";

export function createApp(
  options: { sendEmail?: EmailSender; webRoot?: string } = {},
) {
  const app = express();
  app.disable("x-powered-by");
  if (env.trustedProxies.length) app.set("trust proxy", env.trustedProxies);
  const webRoot =
    options.webRoot ||
    (env.isProduction
      ? path.resolve(import.meta.dirname, "../../web/dist")
      : null);
  const storageOrigin =
    env.s3Bucket && env.awsRegion
      ? "https://" + env.s3Bucket + ".s3." + env.awsRegion + ".amazonaws.com"
      : null;
  const storageSources = storageOrigin ? [storageOrigin] : [];
  app.use(
    helmet({
      strictTransportSecurity: env.isProduction ? undefined : false,
      referrerPolicy: { policy: "no-referrer" },
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: [
            "'self'",
            "'unsafe-inline'",
            "https://fonts.googleapis.com",
          ],
          fontSrc: ["'self'", "https://fonts.gstatic.com"],
          imgSrc: ["'self'", "data:", "blob:", ...storageSources],
          connectSrc: [
            "'self'",
            env.appOrigin.replace(/^http/, "ws"),
            ...storageSources,
          ],
          frameSrc: ["'self'", "https://www.youtube-nocookie.com"],
          frameAncestors: ["'none'"],
          upgradeInsecureRequests: env.isProduction ? [] : null,
        },
      },
    }),
  );
  app.use(
    pinoHttp<express.Request, express.Response>({
      logger,
      genReqId: (_req, res) => {
        const id = randomUUID();
        res.locals.requestId = id;
        res.setHeader("X-Request-Id", id);
        return id;
      },
      serializers: {
        req: (req) => ({
          id: req.id,
          method: req.method,
          path: req.url?.split("?")[0],
        }),
        res: (res) => ({ statusCode: res.statusCode }),
      },
      autoLogging: {
        ignore: (req) => req.url?.startsWith("/api/v1/health") || false,
      },
    }),
  );
  app.use("/api", (_req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    next();
  });
  app.use(
    "/api",
    rateLimit({
      windowMs: 60000,
      limit: 600,
      standardHeaders: "draft-8",
      legacyHeaders: false,
      skip: (req) => req.path.startsWith("/v1/health"),
      message: {
        error: {
          code: "RATE_LIMITED",
          message: "Too many requests. Please try again shortly.",
        },
      },
    }),
  );
  app.use(express.json({ limit: "100kb" }));
  app.use(publishChanges);
  if (!webRoot)
    app.get("/", (_req, res) => {
      res.status(200).json({
        data: {
          name: "Make My Marriage API",
          status: "running",
          apiVersion: "v1",
          health: "/api/v1/health/live",
        },
      });
    });

  app.use("/api/v1/health", healthRouter);
  app.get("/api/v1/site-info", (_req, res) => {
    res.json({
      data: {
        supportEmail: env.supportEmail,
        privacyPolicyUrl: env.privacyPolicyUrl,
        termsUrl: env.termsUrl,
      },
    });
  });
  app.use("/api/v1/auth", createAuthRouter(options.sendEmail));
  app.use("/api/v1/weddings/current/planning", createPlanningRouter());
  app.use(
    "/api/v1/weddings/current/guests",
    createInvitationRouter(options.sendEmail),
  );
  app.use("/api/v1/weddings/current/budget", createFinanceRouter());
  app.use("/api/v1", createSiteRouter());
  app.use("/api/v1", createMediaRouter());
  app.use("/api/v1", createProviderRouter());
  app.use("/api/v1", createIntegrationRouter());
  app.use("/api/v1", createTeamRouter());
  app.use("/api/v1", createWeddingRouter());

  const notFound: express.RequestHandler = (_req, res) => {
    res.status(404).json({
      error: {
        code: "NOT_FOUND",
        message: "This address could not be found.",
      },
      requestId: res.locals.requestId,
    });
  };
  // An unknown API/asset must never accidentally return the SPA with status 200.
  app.use("/api", notFound);
  if (webRoot) {
    app.use(
      "/assets",
      express.static(path.join(webRoot, "assets"), {
        immutable: true,
        maxAge: "1y",
        index: false,
      }),
    );
    app.use(
      express.static(webRoot, { index: false, maxAge: 0, dotfiles: "deny" }),
    );
    app.get("/{*page}", (req, res, next) => {
      if (
        path.extname(req.path) ||
        req.path.split("/").some((part) => part.startsWith(".")) ||
        !req.accepts("html")
      )
        return next();
      res.setHeader("Cache-Control", "no-cache");
      res.sendFile(path.join(webRoot, "index.html"));
    });
  }
  app.use(notFound);
  app.use(errorHandler);

  return app;
}
