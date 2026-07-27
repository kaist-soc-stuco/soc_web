import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { HealthController } from '../src/features/health/health.controller';
import { DRIZZLE_DB } from '../src/infrastructure/postgres/postgres.provider';
import { REDIS_CLIENT } from '../src/infrastructure/redis/redis.provider';
import { HttpExceptionFilter } from '../src/shared/filters/http-exception.filter';
import { RequestIdMiddleware } from '../src/shared/middleware/request-id.middleware';

describe('GET /health', () => {
  let app: INestApplication | undefined;
  let database: { execute: ReturnType<typeof vi.fn> };
  let redis: { status: string; connect: ReturnType<typeof vi.fn>; ping: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    app = undefined;
    database = { execute: vi.fn().mockResolvedValue([]) };
    redis = {
      status: 'ready',
      connect: vi.fn().mockResolvedValue(undefined),
      ping: vi.fn().mockResolvedValue('PONG'),
    };

    const module = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        { provide: DRIZZLE_DB, useValue: database },
        { provide: REDIS_CLIENT, useValue: redis },
      ],
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
  });

  it('reports healthy dependencies', async () => {
    const response = await request(app!.getHttpServer()).get('/health').expect(200);

    expect(response.body).toMatchObject({
      status: 'ok',
      postgres: { ok: true },
      redis: { ok: true },
    });
    expect(response.body.postgres.latencyMs).toEqual(expect.any(Number));
    expect(response.body.redis.latencyMs).toEqual(expect.any(Number));
    expect(new Date(response.body.timestamp).toISOString()).toBe(response.body.timestamp);
    expect(database.execute).toHaveBeenCalledTimes(1);
    expect(redis.ping).toHaveBeenCalledTimes(1);
  });
  it('reports process liveness without touching broken or hanging dependencies', async () => {
    database.execute.mockRejectedValueOnce(new Error('postgres unavailable'));
    redis.ping.mockImplementationOnce(() => new Promise<never>(() => {}));

    const response = await request(app!.getHttpServer()).get('/health/live').expect(200);

    expect(response.body).toMatchObject({ status: 'ok', timestamp: expect.any(String) });
    expect(database.execute).not.toHaveBeenCalled();
    expect(redis.ping).not.toHaveBeenCalled();
  });

  it('reports unavailable when Postgres fails without exposing dependency details', async () => {
    database.execute.mockRejectedValueOnce(new Error('postgres unavailable'));

    const response = await request(app!.getHttpServer()).get('/health').expect(503);

    expect(response.body).toEqual({
      code: 'service_unavailable',
      message: 'Internal server error',
      requestId: expect.any(String),
    });
    expect(response.text).not.toContain('postgres unavailable');
  });

  it('reports unavailable when Redis fails without exposing dependency details', async () => {
    redis.ping.mockRejectedValueOnce(new Error('redis unavailable'));

    const response = await request(app!.getHttpServer()).get('/health/ready').expect(503);

    expect(response.body).toEqual({
      code: 'service_unavailable',
      message: 'Internal server error',
      requestId: expect.any(String),
    });
    expect(response.text).not.toContain('redis unavailable');
  });

  it('reports unavailable when Postgres health checks time out', async () => {
    database.execute.mockImplementationOnce(() => new Promise<never>(() => {}));

    const response = await request(app!.getHttpServer()).get('/health').expect(503);

    expect(response.body).toEqual({
      code: 'service_unavailable',
      message: 'Internal server error',
      requestId: expect.any(String),
    });
    expect(response.text).not.toContain('Dependency health check timed out');
  });

  it('reports unavailable when Redis health checks time out', async () => {
    redis.ping.mockImplementationOnce(() => new Promise<never>(() => {}));

    const response = await request(app!.getHttpServer()).get('/health').expect(503);

    expect(response.body).toEqual({
      code: 'service_unavailable',
      message: 'Internal server error',
      requestId: expect.any(String),
    });
    expect(response.text).not.toContain('Dependency health check timed out');
  });
});
