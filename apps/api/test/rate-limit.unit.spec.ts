import type { NextFunction, Request, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';

import { RateLimitMiddleware } from '../src/shared/middleware/rate-limit.middleware';

const request = (path: string, method = 'POST') => ({ path, method, ip: '192.0.2.1', socket: {} }) as Request;
const response = () => ({ setHeader: vi.fn() }) as unknown as Response;

 describe('RateLimitMiddleware', () => {
  it('does not access Redis for ordinary routes', async () => {
    const redis = { eval: vi.fn() };
    const next = vi.fn() as NextFunction;
    await new RateLimitMiddleware(redis as never).use(request('/api/health', 'GET'), response(), next);
    expect(redis.eval).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledOnce();
  });

  it('limits sensitive authentication traffic and returns retry guidance', async () => {
    const redis = { eval: vi.fn().mockResolvedValue(21) };
    const headers = response();
    await expect(new RateLimitMiddleware(redis as never).use(request('/api/auth/login'), headers, vi.fn())).rejects.toMatchObject({ status: 429 });
    expect(headers.setHeader).toHaveBeenCalledWith('RateLimit-Limit', '20');
    expect(headers.setHeader).toHaveBeenCalledWith('Retry-After', '60');
  });

  it.each([
    ['/api/surveys/id/responses', 'POST'],
    ['/api/articles/id/comments', 'POST'],
    ['/api/admin/users', 'GET'],
  ])('applies a bounded policy to %s', async (path, method) => {
    const redis = { eval: vi.fn().mockResolvedValue(1) };
    const next = vi.fn() as NextFunction;
    await new RateLimitMiddleware(redis as never).use(request(path, method), response(), next);
    expect(redis.eval).toHaveBeenCalledOnce();
    expect(next).toHaveBeenCalledOnce();
  });

  it('fails closed when the limiter store is unavailable', async () => {
    const redis = { eval: vi.fn().mockRejectedValue(new Error('offline')) };
    await expect(new RateLimitMiddleware(redis as never).use(request('/api/auth/login'), response(), vi.fn())).rejects.toMatchObject({ status: 503 });
  });
});
