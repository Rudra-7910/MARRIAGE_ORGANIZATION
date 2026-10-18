import express from 'express';
import helmet from 'helmet';
import { env } from './config/env.js';
import apiRouter from './routes/index.js';
import { requestId } from './middleware/request-id.js';
import { notFound } from './middleware/not-found.js';
import { errorHandler } from './middleware/error-handler.js';

export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.use(helmet({ strictTransportSecurity: env.isProduction ? undefined : false }));
  app.use(requestId);
  app.use(express.json({ limit: '100kb' }));
  app.use((_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  });

  app.get('/', (_req, res) => {
    res.json({
      data: {
        name: 'Make My Marriage API',
        status: 'running',
        apiVersion: 'v1',
        health: '/api/v1/health/live',
      },
    });
  });

  app.use('/api/v1', apiRouter);
  app.use(notFound);
  app.use(errorHandler);

  return app;
}
