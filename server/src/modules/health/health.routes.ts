import { Router } from 'express';
import { getDatabaseStatus } from '../../config/database.js';

const healthRouter = Router();

healthRouter.get('/live', (_req, res) => {
  res.json({
    data: {
      service: 'make-my-marriage-api',
      status: 'live',
      uptimeSeconds: Math.floor(process.uptime()),
    },
  });
});

healthRouter.get('/ready', (_req, res) => {
  const database = getDatabaseStatus();
  const ready = database === 'connected';

  res.status(ready ? 200 : 503).json({
    data: {
      status: ready ? 'ready' : 'not_ready',
      database,
    },
  });
});

export default healthRouter;
