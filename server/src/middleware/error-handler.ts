import type { Request, Response, NextFunction } from "express";

export function httpError(status: number, code: string, message: string) {
  return Object.assign(new Error(message), { status, code, expose: true });
}

export function errorHandler(
  error: unknown,
  _req: Request,
  res: Response,
  next: NextFunction,
) {
  if (res.headersSent) {
    next(error);
    return;
  }

  let status = 500;
  let code = "INTERNAL_ERROR";
  let message = "An unexpected server error occurred.";

  if (error instanceof SyntaxError && "body" in error) {
    status = 400;
    code = "INVALID_JSON";
    message = "Request body must contain valid JSON.";
  }

  if (typeof error === "object" && error !== null && "type" in error) {
    if (error.type === "entity.too.large") {
      status = 413;
      code = "PAYLOAD_TOO_LARGE";
      message = "Request body exceeds the size limit.";
    }
  }

  if (
    error instanceof Error &&
    "expose" in error &&
    error.expose === true &&
    "status" in error &&
    typeof error.status === "number" &&
    "code" in error &&
    typeof error.code === "string"
  ) {
    status = error.status;
    code = error.code;
    message = error.message;
  }

  if (status === 500) {
    console.error(
      "[request] Unexpected failure. Request ID:",
      res.locals.requestId,
    );
  }

  res.status(status).json({
    error: { code, message },
    requestId: res.locals.requestId,
  });
}
