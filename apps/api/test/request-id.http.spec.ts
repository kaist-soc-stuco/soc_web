import { ArgumentsHost, Controller, Get, INestApplication, InternalServerErrorException, Logger } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { HttpExceptionFilter } from '../src/shared/filters/http-exception.filter';
import { RequestIdMiddleware } from '../src/shared/middleware/request-id.middleware';

@Controller('request-id')
class RequestIdController {
  @Get('error')
  getError(): never {
    throw new InternalServerErrorException({ code: 'test_error' });
  }
}

describe('request ID correlation', () => {
  let app: INestApplication | undefined;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [RequestIdController],
    }).compile();

    app = module.createNestApplication();
    const requestIdMiddleware = new RequestIdMiddleware();
    app.use(requestIdMiddleware.use.bind(requestIdMiddleware));
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();
  });

  afterEach(async () => {
    await app?.close();
    app = undefined;
    vi.restoreAllMocks();
  });

  it('uses the generated request ID in both the response header and error envelope', async () => {
    const response = await request(app!.getHttpServer()).get('/request-id/error').expect(500);

    expect(response.headers['x-request-id']).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
    expect(response.body).toMatchObject({ requestId: response.headers['x-request-id'] });
  });

  it('echoes a valid supplied request ID in the header and error envelope', async () => {
    const requestId = 'trace-123.abc';
    const response = await request(app!.getHttpServer())
      .get('/request-id/error')
      .set('x-request-id', requestId)
      .expect(500);

    expect(response.headers['x-request-id']).toBe(requestId);
    expect(response.body).toMatchObject({ requestId });
  });

  it('replaces an invalid supplied request ID', async () => {
    const response = await request(app!.getHttpServer())
      .get('/request-id/error')
      .set('x-request-id', 'invalid request id')
      .expect(500);

    expect(response.headers['x-request-id']).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
    expect(response.headers['x-request-id']).not.toBe('invalid request id');
    expect(response.body).toMatchObject({ requestId: response.headers['x-request-id'] });
  });

  it('generates a trusted fallback ID and logs only sanitized unknown-exception evidence', () => {
    const logger = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const response = {
      json: vi.fn(),
      setHeader: vi.fn(),
      status: vi.fn().mockReturnThis(),
    };
    const host = {
      switchToHttp: () => ({
        getRequest: () => ({
          method: 'GET',
          path: '/request-id/error',
          requestId: 'invalid request id',
        }),
        getResponse: () => response,
      }),
    } as unknown as ArgumentsHost;
    const exception = new Error('secret-token=do-not-log');
    exception.stack = 'Error: secret-token=do-not-log\n    at handler (/app/handler.ts:1:1)';

    new HttpExceptionFilter().catch(exception, host);

    const requestId = response.setHeader.mock.calls[0][1] as string;
    expect(requestId).toMatch(/^[0-9a-f-]{36}$/i);
    expect(response.json).toHaveBeenCalledWith({
      code: 'internal_server_error',
      message: 'Internal server error',
      requestId,
    });
    expect(logger).toHaveBeenCalledWith(
      JSON.stringify({
        requestId,
        method: 'GET',
        path: '/request-id/error',
        exceptionClass: 'Error',
        stackFrames: ['at handler (/app/handler.ts:1:1)'],
      }),
    );
  });
});
