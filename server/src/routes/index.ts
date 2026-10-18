import { Router } from 'express';
import healthRouter from '../modules/health/health.routes.js';

const apiRouter = Router();

apiRouter.use('/health', healthRouter);

// Mount business modules here only when their real access checks exist.
export default apiRouter;
