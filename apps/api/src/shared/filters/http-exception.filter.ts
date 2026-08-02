import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { Request, Response } from 'express';

const REQUEST_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;

interface RequestWithId extends Request {
  requestId?: string;
}

const messageForStatus = (status: number): string => {
  if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
    return 'Internal server error';
  }

  return 'Request failed';
};


@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();
    const request = context.getRequest<RequestWithId>();
    const status = exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const exceptionResponse = exception instanceof HttpException ? exception.getResponse() : undefined;
    const details =
      typeof exceptionResponse === 'object' && exceptionResponse !== null
        ? (exceptionResponse as { code?: unknown; message?: unknown })
        : undefined;
    const machineMessage =
      typeof details?.message === 'string'
        ? details.message
        : typeof exceptionResponse === 'string'
          ? exceptionResponse
          : undefined;
    const code =
      typeof details?.code === 'string'
        ? details.code
        : machineMessage && /^[a-z][a-z0-9_]*$/.test(machineMessage)
          ? machineMessage
          : status >= 500
            ? 'internal_server_error'
            : 'http_error';
    const message = messageForStatus(status);
    const requestId =
      request.requestId && REQUEST_ID_PATTERN.test(request.requestId) ? request.requestId : randomUUID();

    if (!(exception instanceof HttpException)) {
      this.logger.error(
        JSON.stringify({
          code,
          feature: 'http',
          outcome: 'error',
          status,
          requestId,
        }),
      );
    }

    response.setHeader('x-request-id', requestId);
    response.status(status).json({ code, message, requestId });
  }
}
