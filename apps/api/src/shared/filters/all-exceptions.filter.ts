import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Request, Response } from 'express';
import { nowIso } from '@soc/shared';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const httpError = exception as { statusCode?: unknown } | null;
    const status = exception instanceof HttpException ? exception.getStatus()
      : typeof httpError?.statusCode === 'number' && httpError.statusCode >= 400 && httpError.statusCode <= 599
        ? httpError.statusCode : HttpStatus.INTERNAL_SERVER_ERROR;
    const header = request.headers['x-request-id'];
    const requestId = typeof header === 'string' ? header : randomUUID();
    const path = request.path ?? request.url.split('?')[0];
    const details = exception instanceof HttpException ? exception.getResponse() : {
      message: status >= 500 ? 'Internal server error' : status === 413 ? 'Payload Too Large' : 'Bad Request',
    };
    const log = JSON.stringify({ requestId, method: request.method, path, statusCode: status,
      error: exception instanceof Error ? exception.name : 'UnknownError' });
    if (status >= 500) {
      // Keep source locations useful without logging query values, tokens or request bodies.
      const frames = exception instanceof Error ? exception.stack?.split('\n').filter(line => /^\s+at /.test(line)).join('\n') : undefined;
      this.logger.error(log, frames);
    } else {
      this.logger.warn(log);
    }

    if (response.headersSent) { response.end(); return; }
    response.setHeader('x-request-id', requestId);
    response.status(status).json({
      ...(typeof details === 'string' ? { message: details } : details),
      statusCode: status,
      path,
      timestamp: nowIso(),
      requestId,
    });
  }
}
