import { Controller, Delete, Get, INestApplication, Patch, Post, Put } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createOriginMiddleware } from '../src/shared/middleware/origin.middleware';

const PUBLIC_ORIGIN = 'https://committee.example.test';

@Controller('origin-probe')
class OriginProbeController {
  @Post()
  post() {
    return { allowed: true };
  }
  @Get()
  get() {
    return { allowed: true };
  }


  @Put()
  put() {
    return { allowed: true };
  }

  @Patch()
  patch() {
    return { allowed: true };
  }

  @Delete()
  delete() {
    return { allowed: true };
  }
}

@Controller('auth')
class CallbackProbeController {
  @Post('login')
  callback() {
    return { callback: true };
  }
}

describe('origin middleware HTTP contract', () => {
  let app: INestApplication | undefined;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [OriginProbeController, CallbackProbeController],
    }).compile();

    app = module.createNestApplication();
    app.use(createOriginMiddleware(PUBLIC_ORIGIN));
    app.setGlobalPrefix('api');
    await app.init();
  });

  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  it.each(['post', 'put', 'patch', 'delete'] as const)('rejects %s without an exact Origin header', async (method) => {
    const response = await request(app!.getHttpServer())[method]('/api/origin-probe').expect(403);
    expect(response.body).toMatchObject({ code: 'origin_required_or_mismatch', requestId: expect.any(String) });
  });

  it.each([
    'null',
    `${PUBLIC_ORIGIN}/`,
    'https://COMMITTEE.example.test',
    'https://committee.example.test:443',
    `${PUBLIC_ORIGIN}?unexpected=true`,
  ])('rejects a non-canonical Origin value %s', async (origin) => {
    const response = await request(app!.getHttpServer())
      .post('/api/origin-probe')
      .set('Origin', origin)
      .expect(403);
    expect(response.body).toMatchObject({ code: 'origin_required_or_mismatch', requestId: expect.any(String) });
  });


  it.each([undefined, 'null', 'https://mismatch.example.test'])('allows safe GET requests regardless of Origin %s', async (origin) => {
    const requestBuilder = request(app!.getHttpServer()).get('/api/origin-probe');
    if (origin) requestBuilder.set('Origin', origin);
    const response = await requestBuilder.expect(200);
    expect(response.body).toEqual({ allowed: true });
  });

  it.each(['post', 'put', 'patch', 'delete'] as const)('allows %s only with the configured Origin header', async (method) => {
    const response = await request(app!.getHttpServer())
      [method]('/api/origin-probe')
      .set('Origin', PUBLIC_ORIGIN)
      .expect(method === 'post' ? 201 : 200);
    expect(response.body).toEqual({ allowed: true });
  });

  it('exempts only the exact POST callback route from Origin validation', async () => {
    await request(app!.getHttpServer()).post('/api/auth/login').expect(201);
    await request(app!.getHttpServer()).post('/api/auth/login?provider=sso').expect(201);

    for (const path of ['/api/auth/login/', '/api/auth/login/extra']) {
      const response = await request(app!.getHttpServer()).post(path).expect(403);
      expect(response.body).toMatchObject({ code: 'origin_required_or_mismatch', requestId: expect.any(String) });
    }

    await request(app!.getHttpServer()).get('/api/auth/login').expect(404);
  });
  it.each(['put', 'patch', 'delete'] as const)('rejects unsafe %s requests to the exact callback path without Origin', async (method) => {
    const response = await request(app!.getHttpServer())[method]('/api/auth/login').expect(403);
    expect(response.body).toMatchObject({ code: 'origin_required_or_mismatch', requestId: expect.any(String) });
  });
});
