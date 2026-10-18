import type { Request, Response } from 'express';

export function notFound(_req: Request, res: Response) {
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: 'This endpoint is not implemented.',
    },
    requestId: res.locals.requestId,
  });
}
