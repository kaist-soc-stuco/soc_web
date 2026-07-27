import { ConflictException, INestApplication, UnauthorizedException, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import express from 'express';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthController } from '../src/features/auth/auth.controller';
import { AuthSessionService } from '../src/features/auth/auth-session.service';
import { AuthService } from '../src/features/auth/auth.service';
import { createOriginMiddleware } from '../src/shared/middleware/origin.middleware';

const PUBLIC_ORIGIN = 'https://committee.example.test';
const normalizeCookieHeaders = (headers: string | string[] | undefined): string[] =>
  headers ? (Array.isArray(headers) ? headers : [headers]) : [];
const cookieNames = (headers: string | string[] | undefined) =>
  normalizeCookieHeaders(headers).map((header) => header.split('=', 1)[0]);
const cookieFor = (headers: string | string[] | undefined, name: string) =>
  normalizeCookieHeaders(headers).find((header) => header.startsWith(`${name}=`));

const expectCookie = (headers: string | string[] | undefined, name: string, path: string) => {
  const cookie = cookieFor(headers, name);
  expect(cookie).toBeDefined();
  expect(cookie).toContain('HttpOnly');
  expect(cookie).toContain('SameSite=Lax');
  expect(cookie).toContain(`Path=${path}`);
};
const expectClearedCookie = (headers: string | string[] | undefined, name: string, path: string) => {
  expectCookie(headers, name, path);
  const cookie = cookieFor(headers, name);
  expect(cookie).toMatch(/Max-Age=0/i);
  expect(cookie).toMatch(/Expires=/i);
};
describe('AuthController HTTP contract', () => {
  let app: INestApplication | undefined;
  let authService: { createLoginStartPayload: ReturnType<typeof vi.fn>; handleLoginCallback: ReturnType<typeof vi.fn> };
  let authSessionService: {
    handleConsentDecision: ReturnType<typeof vi.fn>;
    getSession: ReturnType<typeof vi.fn>;
    refreshSession: ReturnType<typeof vi.fn>;
    logout: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    authService = {
      createLoginStartPayload: vi.fn(),
      handleLoginCallback: vi.fn(),
    };
    authSessionService = {
      handleConsentDecision: vi.fn(),
      getSession: vi.fn(),
      refreshSession: vi.fn(),
      logout: vi.fn(),
    };

    const module = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: authService },
        { provide: AuthSessionService, useValue: authSessionService },
        { provide: ConfigService, useValue: { getOrThrow: vi.fn().mockReturnValue(PUBLIC_ORIGIN) } },
      ],
    }).compile();

    app = module.createNestApplication({ bodyParser: false });
    app.use(express.json({ limit: '32kb' }));
    app.use(express.urlencoded({ extended: false, limit: '32kb' }));
    app.use(cookieParser());
    app.use(createOriginMiddleware(PUBLIC_ORIGIN));
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
    app.setGlobalPrefix('api');
    await app.init();
  });

  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  it('marks production auth cookies Secure', async () => {
    const originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    authService.handleLoginCallback.mockResolvedValue({
      kind: 'persisted',
      session: { accessToken: 'test-access', refreshToken: 'test-refresh' },
      userId: 'user-1',
    });

    try {
      const response = await request(app!.getHttpServer())
        .post('/api/auth/login')
        .type('form')
        .send({ code: 'callback-code', state: 'callback-state' })
        .expect(303);

      expect(cookieFor(response.headers['set-cookie'], 'soc_at')).toContain('Secure');
      expect(cookieFor(response.headers['set-cookie'], 'soc_rt')).toContain('Secure');
    } finally {
      process.env.NODE_ENV = originalNodeEnv;
    }
  });

  it('persists session cookies and redirects cleanly after a callback', async () => {
    authService.handleLoginCallback.mockResolvedValue({
      kind: 'persisted',
      session: { accessToken: 'test-access', refreshToken: 'test-refresh' },
      userId: 'user-1',
    });

    const response = await request(app!.getHttpServer())
      .post('/api/auth/login')
      .type('form')
      .send({ code: 'callback-code', state: 'callback-state' })
      .expect(303);

    expect(response.headers.location).toBe(`${PUBLIC_ORIGIN}/login?status=success`);
    expect(response.headers.location).not.toMatch(/[?&](?:code|state|token|access_token)=/i);
    expect(response.body).toEqual({});
    expect(cookieNames(response.headers['set-cookie'])).toEqual(['soc_at', 'soc_rt']);
    expectCookie(response.headers['set-cookie'], 'soc_at', '/api');
    expectCookie(response.headers['set-cookie'], 'soc_rt', '/api/auth');
  });

  it('sets only the flow cookie and redirects cleanly when consent is required', async () => {
    authService.handleLoginCallback.mockResolvedValue({ kind: 'consent_required', flowToken: 'test-flow' });

    const response = await request(app!.getHttpServer())
      .post('/api/auth/login')
      .type('form')
      .send({ code: 'callback-code', state: 'callback-state' })
      .expect(303);

    expect(response.headers.location).toBe(`${PUBLIC_ORIGIN}/login/consent`);
    expect(response.headers.location).not.toMatch(/[?&](?:code|state|token|access_token)=/i);
    expect(response.body).toEqual({});
    expect(cookieNames(response.headers['set-cookie'])).toEqual(['soc_flow']);
    expectCookie(response.headers['set-cookie'], 'soc_flow', '/api/auth');
  });

  it('rejects login callback bodies that are not form-urlencoded before calling the service', async () => {
    await request(app!.getHttpServer())
      .post('/api/auth/login')
      .send({ code: 'callback-code', state: 'callback-state' })
      .expect(415);

    expect(authService.handleLoginCallback).not.toHaveBeenCalled();
  });

  it('uses the flow cookie for consent and returns an empty 204 response', async () => {
    authSessionService.handleConsentDecision.mockResolvedValue({
      kind: 'persisted',
      session: { accessToken: 'test-access', refreshToken: 'test-refresh' },
      userId: 'user-1',
    });

    const response = await request(app!.getHttpServer())
      .post('/api/auth/login/consent')
      .set('Origin', PUBLIC_ORIGIN)
      .set('Cookie', ['soc_flow=test-flow'])
      .send({ consent: true })
      .expect(204);

    expect(response.text).toBe('');
    expect(authSessionService.handleConsentDecision).toHaveBeenCalledWith({ consent: true, pendingLoginToken: 'test-flow' });
    expect(cookieNames(response.headers['set-cookie'])).toEqual(['soc_flow', 'soc_at', 'soc_rt']);
    expectCookie(response.headers['set-cookie'], 'soc_flow', '/api/auth');
    expectCookie(response.headers['set-cookie'], 'soc_at', '/api');
    expectCookie(response.headers['set-cookie'], 'soc_rt', '/api/auth');
  });

  it('sets only an opaque temporary cookie for temporary consent', async () => {
    authSessionService.handleConsentDecision.mockResolvedValue({
      kind: 'temporary',
      temporaryHandle: 'test-temporary-handle',
      session: {},
    });

    const response = await request(app!.getHttpServer())
      .post('/api/auth/login/consent')
      .set('Origin', PUBLIC_ORIGIN)
      .set('Cookie', ['soc_flow=test-flow'])
      .send({ consent: false })
      .expect(204);

    expect(response.text).toBe('');
    expect(cookieNames(response.headers['set-cookie'])).toEqual(['soc_flow', 'soc_tmp']);
    expectCookie(response.headers['set-cookie'], 'soc_tmp', '/api/auth');
    expect(cookieFor(response.headers['set-cookie'], 'soc_tmp')).not.toContain('.');
  });

  it('refreshes persisted cookies with an empty 204 response', async () => {
    authSessionService.refreshSession.mockResolvedValue({ accessToken: 'test-access', refreshToken: 'test-refresh' });

    const response = await request(app!.getHttpServer())
      .post('/api/auth/refresh')
      .set('Origin', PUBLIC_ORIGIN)
      .set('Cookie', ['soc_rt=test-refresh'])
      .expect(204);

    expect(response.text).toBe('');
    expect(authSessionService.refreshSession).toHaveBeenCalledWith({ refreshToken: 'test-refresh' });
    expect(cookieNames(response.headers['set-cookie'])).toEqual(['soc_at', 'soc_rt']);
  });

  it('returns retry guidance when refresh conflicts', async () => {
    authSessionService.refreshSession.mockRejectedValue(new ConflictException('refresh_conflict'));

    const response = await request(app!.getHttpServer())
      .post('/api/auth/refresh')
      .set('Origin', PUBLIC_ORIGIN)
      .expect(409);

    expect(response.headers['retry-after']).toBe('1');
  });

  it('clears every auth cookie using its original path and explicit expiry', async () => {
    authSessionService.logout.mockResolvedValue(undefined);

    const response = await request(app!.getHttpServer())
      .post('/api/auth/logout')
      .set('Origin', PUBLIC_ORIGIN)
      .set('Cookie', ['soc_at=test-access', 'soc_rt=test-refresh', 'soc_tmp=test-temporary'])
      .expect(204);

    expect(response.text).toBe('');
    expect(cookieNames(response.headers['set-cookie'])).toEqual(['soc_at', 'soc_rt', 'soc_flow', 'soc_tmp']);
    expectClearedCookie(response.headers['set-cookie'], 'soc_at', '/api');
    expectClearedCookie(response.headers['set-cookie'], 'soc_rt', '/api/auth');
    expectClearedCookie(response.headers['set-cookie'], 'soc_flow', '/api/auth');
    expectClearedCookie(response.headers['set-cookie'], 'soc_tmp', '/api/auth');
    expect(authSessionService.logout).toHaveBeenCalledWith({
      accessToken: 'test-access',
      refreshToken: 'test-refresh',
      temporaryToken: 'test-temporary',
    });
  });

  it('passes missing session cookies to the session service without authenticating', async () => {
    authSessionService.getSession.mockResolvedValue({
      authenticated: false,
      canUsePersistentFeatures: false,
      requiresConsent: false,
      storageMode: null,
    });

    await request(app!.getHttpServer()).get('/api/auth/session').expect(200);

    expect(authSessionService.getSession).toHaveBeenCalledWith({ accessToken: undefined, temporaryToken: undefined });
  });

  it('fails safely when a stale access cookie is rejected by the session service', async () => {
    authSessionService.getSession.mockRejectedValue(new UnauthorizedException('invalid_access_token'));

    await request(app!.getHttpServer())
      .get('/api/auth/session')
      .set('Cookie', ['soc_at=stale-token'])
      .expect(401);

    expect(authSessionService.getSession).toHaveBeenCalledWith({ accessToken: 'stale-token', temporaryToken: undefined });
  });

  it.each(['/api/auth/result', '/api/auth/access-check'])('does not expose retired auth route %s', async (path) => {
    const response = await request(app!.getHttpServer()).get(path).expect(404);
    expect(response.body).not.toHaveProperty('accessToken');
    expect(response.body).not.toHaveProperty('token');
  });
});
