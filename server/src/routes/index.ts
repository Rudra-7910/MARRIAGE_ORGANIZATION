import { createAuthRouter } from "../modules/auth/auth.routes.js";
import { createWeddingRouter } from "../modules/weddings/wedding.routes.js";
import { Router } from "express";
import healthRouter from "../modules/health/health.routes.js";

const apiRouter = Router();

apiRouter.use("/health", healthRouter);
apiRouter.use("/auth", createAuthRouter());

apiRouter.use(createWeddingRouter());
export default apiRouter;
