import 'reflect-metadata';

import { RequestMethod } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import express from 'express';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

import { RequestRateLimitService } from './infrastructure/redis/request-rate-limit.service';
import {
  AUTH_ACCESS_COOKIE_NAME,
  AUTH_CSRF_COOKIE_NAME,
  AUTH_LOGIN_TRANSACTION_COOKIE_NAME,
  AUTH_REFRESH_COOKIE_NAME,
  AUTH_SESSION_COOKIE_NAME,
} from './features/auth/auth.tokens';

function preloadNodeEnvironment(): void {
  if (process.env.NODE_ENV?.trim()) return;

  const candidates = [
    path.resolve(process.cwd(), '.env.local'),
    path.resolve(process.cwd(), '.env'),
    path.resolve(process.cwd(), '../../.env.local'),
    path.resolve(process.cwd(), '../../.env'),
  ];

  for (const candidate of candidates) {
    if (!existsSync(candidate)) continue;

    let content: string;
    try {
      content = readFileSync(candidate, 'utf8');
    } catch {
      continue;
    }

    for (const line of content.split(/\r?\n/)) {
      const match = /^\s*NODE_ENV\s*=\s*(.*?)\s*$/.exec(line);
      if (!match) continue;
      const value = match[1].replace(/^['"]|['"]$/g, '').trim();
      if (value) process.env.NODE_ENV = value;
      return;
    }
  }
}

async function bootstrap(): Promise<void> {
  preloadNodeEnvironment();
  const { AppModule } = await import('./app.module');
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  const httpServer = app.getHttpAdapter().getInstance();
  // Keep JSON/urlencoded requests bounded independently of the multipart
  // 21 MiB ingress allowance used for 20 MiB file uploads.
  httpServer.use(express.json({ limit: '4mb' }));
  httpServer.use(express.urlencoded({ extended: false, limit: '256kb' }));
  const configService = app.get(ConfigService);

  const corsOrigin = configService.get<string>('CORS_ORIGIN');
  const isProd = configService.get<string>('NODE_ENV') === 'production';
  const trustedProxyIps = (configService.get<string>('TRUST_PROXY_IPS') ?? '')
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  const trustedProxyHops = Number.parseInt(
    configService.get<string>('TRUST_PROXY_HOPS') ?? '0',
    10,
  );

  // Never trust an arbitrary X-Forwarded-* header. A proxy hop is trusted only
  // when its address is explicitly configured by the operator.
  if (trustedProxyHops > 0 && trustedProxyIps.length > 0) {
    app.getHttpAdapter().getInstance().set('trust proxy', (ip: string, hop: number) =>
      hop < trustedProxyHops &&
      trustedProxyIps.includes(ip.replace(/^::ffff:/i, '').toLowerCase()),
    );
  } else {
    app.getHttpAdapter().getInstance().set('trust proxy', false);
  }

  app.enableCors({
    origin: corsOrigin
      ? corsOrigin.split(',').map((o) => o.trim())
      : isProd
        ? false
        : true,
    credentials: true,
  });

  app.use(cookieParser());

  const requestRateLimitService = app.get(RequestRateLimitService);
  app.use(async (request: Request, response: Response, next: NextFunction) => {
    const result = await requestRateLimitService.check(request);
    if (result.category && result.limit !== null) {
      response.setHeader('RateLimit-Limit', String(result.limit));
      response.setHeader('RateLimit-Remaining', String(result.remaining ?? 0));
    }
    if (result.unavailable) {
      response.setHeader('Retry-After', String(result.retryAfterSeconds ?? 5));
      response.status(503).json({ message: 'rate_limit_unavailable' });
      return;
    }
    if (!result.allowed) {
      response.setHeader('Retry-After', String(result.retryAfterSeconds ?? 1));
      response.status(429).json({ message: 'rate_limit_exceeded' });
      return;
    }
    next();
  });

  const allowedOrigins = corsOrigin
    ? corsOrigin.split(',').map((origin) => origin.trim()).filter(Boolean)
    : [];

  app.use((request: Request & { cookies?: Record<string, string | undefined> }, response: Response, next: NextFunction) => {
    const csrfCookie = request.cookies?.[AUTH_CSRF_COOKIE_NAME];
    if (!csrfCookie) {
      response.cookie(AUTH_CSRF_COOKIE_NAME, randomBytes(32).toString('base64url'), {
        httpOnly: false,
        maxAge: 2 * 60 * 60 * 1000,
        path: '/',
        sameSite: 'lax',
        secure: isProd || Boolean(request.secure),
      });
    }

    const method = request.method.toUpperCase();
    const unsafe = !['GET', 'HEAD', 'OPTIONS'].includes(method);
    const isSsoCallback =
      request.path === '/v1/auth/login' || request.path === '/auth/login';
    if (!unsafe || isSsoCallback) {
      next();
      return;
    }

    const origin = request.get('origin');
    if (
      origin &&
      allowedOrigins.length > 0 &&
      !allowedOrigins.includes('*') &&
      !allowedOrigins.includes(origin)
    ) {
      response.status(403).json({ message: 'csrf_origin_invalid' });
      return;
    }

    const hasCookieAuth = Boolean(
      request.cookies?.[AUTH_ACCESS_COOKIE_NAME] ||
      request.cookies?.[AUTH_REFRESH_COOKIE_NAME] ||
      request.cookies?.[AUTH_SESSION_COOKIE_NAME] ||
      request.cookies?.[AUTH_LOGIN_TRANSACTION_COOKIE_NAME],
    );
    if (hasCookieAuth) {
      const headerToken = request.get('x-csrf-token');
      const cookieBuffer = Buffer.from(csrfCookie ?? '');
      const headerBuffer = Buffer.from(headerToken ?? '');
      if (
        !csrfCookie ||
        !headerToken ||
        cookieBuffer.length !== headerBuffer.length ||
        !timingSafeEqual(cookieBuffer, headerBuffer)
      ) {
        response.status(403).json({ message: 'csrf_token_invalid' });
        return;
      }
    }

    next();
  });

  // app.useGlobalPipes(
  //   new ZodValidationPipe()
  // );

  app.setGlobalPrefix('v1', {
    exclude: [{ path: 'health', method: RequestMethod.GET }],
  });

  const port = configService.getOrThrow<number>('API_PORT');
  const server = await app.listen(port);
  server.requestTimeout = 30_000;
  server.headersTimeout = 35_000;
  server.keepAliveTimeout = 5_000;

  console.log(`API server listening on http://localhost:${port}`);
}

bootstrap();
