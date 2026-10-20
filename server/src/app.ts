import express from "express";
import helmet from "helmet";
import { randomUUID } from "node:crypto";
import { env } from "./config/env.js";
import { errorHandler } from "./middleware/error-handler.js";
import { createAuthRouter } from "./modules/auth/auth.routes.js";
import { createWeddingRouter } from "./modules/weddings/wedding.routes.js";
import healthRouter from "./modules/health/health.routes.js";

export function createApp() {
  const app = express();


  //sbse phle , ignore krte h , apne framework ko expose krna  
  app.disable("x-powered-by");
  if (env.trustedProxies.length) app.set("trust proxy", env.trustedProxies);

  //lets use helmet
  app.use(
    helmet({ strictTransportSecurity: env.isProduction ? undefined : false }),
  );
//lets design request id for each request 

  app.use((_req, res, next) => {
    const id = randomUUID();
    res.locals.requestId = id;
    res.setHeader("X-Request-Id", id);
    next();
  });

  //express eligible for handling json now 
  app.use(express.json({ limit: "100kb" }));


  app.use((_req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    next();
  });

  //jab bhi / ye aaye 
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

  //jab bhi api/v1/health aaye , forward to , healthRouter
  app.use("/api/v1/health", healthRouter);
  app.use("/api/v1/auth", createAuthRouter());
  app.use("/api/v1", createWeddingRouter());

  app.use((_req, res) => {
    res.status(404).json({
      error: {
        code: "NOT_FOUND",
        message: "This endpoint is not implemented.",
      },
      requestId: res.locals.requestId,
    });
  });
  app.use(errorHandler);

  return app;
}
