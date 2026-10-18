import type { Request, Response, NextFunction } from 'express';

export function errorHandler(error: unknown, _req: Request, res: Response, next: NextFunction) {
  if (res.headersSent) {
    next(error);
    return;
  }

  let status = 500;
  let code = 'INTERNAL_ERROR';
  let message = 'An unexpected server error occurred.';

  if (error instanceof SyntaxError && 'body' in error) {
    status = 400;
    code = 'INVALID_JSON';
    message = 'Request body must contain valid JSON.';
  }

  if (typeof error === 'object' && error !== null && 'type' in error) {
    if (error.type === 'entity.too.large') {
      status = 413;
      code = 'PAYLOAD_TOO_LARGE';
      message = 'Request body exceeds the size limit.';
    }
  }

  if (status === 500) {
    console.error('[request] Unexpected failure. Request ID:', res.locals.requestId);
  }

  res.status(status).json({
    error: { code, message },
    requestId: res.locals.requestId,
  });
}
