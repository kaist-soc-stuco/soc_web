import { HttpException, Inject, Injectable, ServiceUnavailableException } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import type Redis from 'ioredis';

import { REDIS_CLIENT } from '../../infrastructure/redis/redis.provider';

type Policy = { name: string; limit: number; windowSeconds: number };
const policies: Array<{ method?: string; path: RegExp; policy: Policy }> = [
  { path: /^\/api\/auth\/(?!session$)/, policy: { name: 'auth', limit: 20, windowSeconds: 60 } },
  { method: 'POST', path: /^\/api\/surveys\/[^/]+\/responses$/, policy: { name: 'guest-survey', limit: 10, windowSeconds: 60 } },
  { path: /^\/api\/articles\/[^/]+\/(comments|reaction)/, policy: { name: 'interaction', limit: 30, windowSeconds: 60 } },
  { method: 'GET', path: /^\/api\/admin\/(users|contacts)(\/|$)/, policy: { name: 'admin-lookup', limit: 60, windowSeconds: 60 } },
];
const SCRIPT = `local current = redis.call('INCR', KEYS[1])
if current == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end
return current`;

@Injectable()
export class RateLimitMiddleware {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async use(request: Request, response: Response, next: NextFunction): Promise<void> {
    const match = policies.find(({ method, path }) => (!method || method === request.method) && path.test(request.path));
    if (!match) return next();
    const identity = request.ip || request.socket.remoteAddress || 'unknown';
    const bucket = Math.floor(Date.now() / (match.policy.windowSeconds * 1_000));
    const key = `rate:${match.policy.name}:${identity}:${bucket}`;
    let count: number;
    try {
      count = Number(await this.redis.eval(SCRIPT, 1, key, match.policy.windowSeconds));
    } catch {
      throw new ServiceUnavailableException('rate_limit_unavailable');
    }
    response.setHeader('RateLimit-Limit', String(match.policy.limit));
    response.setHeader('RateLimit-Remaining', String(Math.max(0, match.policy.limit - count)));
    if (count > match.policy.limit) {
      response.setHeader('Retry-After', String(match.policy.windowSeconds));
      throw new HttpException('rate_limit_exceeded', 429);
    }
    next();
  }
}
