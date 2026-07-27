import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { HealthController } from '../src/features/health/health.controller';
import { DRIZZLE_DB } from '../src/infrastructure/postgres/postgres.provider';
import { REDIS_CLIENT } from '../src/infrastructure/redis/redis.provider';

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

  it('reports degraded when dependencies fail without returning a false healthy status', async () => {
    database.execute.mockRejectedValueOnce(new Error('postgres unavailable'));
    redis.ping.mockRejectedValueOnce(new Error('redis unavailable'));

    const response = await request(app!.getHttpServer()).get('/health').expect(200);

    expect(response.body).toMatchObject({
      status: 'degraded',
      postgres: { ok: false, message: 'postgres unavailable' },
      redis: { ok: false, message: 'redis unavailable' },
    });
  });
});
