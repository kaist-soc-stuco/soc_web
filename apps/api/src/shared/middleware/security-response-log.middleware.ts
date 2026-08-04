import type { NextFunction, Request, Response } from 'express';

type RequestWithSecurityContext = Request & { requestId?: string; user?: { id: string } };

const aggregatePath = /^\/api\/admin\/surveys\/([0-9a-f-]+)\/aggregate(?:\/(v2))?\/?$/i;

export function securityResponseLogMiddleware(request: RequestWithSecurityContext, response: Response, next: NextFunction): void {
  if (!request.path.startsWith('/api/')) {
    next();
    return;
  }

  response.once('finish', () => {
    try {
      const aggregate = aggregatePath.exec(request.path);
      const outcome = response.statusCode >= 200 && response.statusCode < 400
        ? 'success'
        : response.statusCode === 401
          ? 'unauthorized'
          : response.statusCode === 403
            ? 'forbidden'
            : 'error';
      // eslint-disable-next-line no-console
      console.log(JSON.stringify({
        actorId: request.user?.id ?? null,
        surveyId: aggregate?.[1] ?? null,
        routeVersion: aggregate ? (aggregate[2] ? 'V2' : 'V1') : null,
        outcome,
        requestId: request.requestId ?? null,
      }));
    } catch {
      // Security event emission is best-effort and must not affect the response.
    }
  });
  next();
}
