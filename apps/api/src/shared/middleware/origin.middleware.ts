import type { NextFunction, Request, Response } from "express";

interface RequestWithId extends Request {
  requestId?: string;
}

const UNSAFE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const CALLBACK_PATH = "/api/auth/login";

export const createOriginMiddleware = (publicOrigin: string) =>
  (request: RequestWithId, response: Response, next: NextFunction): void => {
    const path = request.originalUrl.split("?", 1)[0];

    if (
      !UNSAFE_METHODS.has(request.method) ||
      !path.startsWith("/api/") ||
      (request.method === "POST" && path === CALLBACK_PATH)
    ) {
      next();
      return;
    }

    if (request.get("origin") !== publicOrigin) {
      response.status(403).json({
        code: "origin_required_or_mismatch",
        message: "Origin is required and must match the configured public origin",
        requestId: request.requestId ?? request.get("x-request-id") ?? "unknown",
      });
      return;
    }

    next();
  };
