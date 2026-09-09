import { createHash } from "node:crypto";

import {
  Inject,
  HttpException,
  HttpStatus,
  Injectable,
  ServiceUnavailableException,
} from "@nestjs/common";
import type { Request } from "express";
import Redis from "ioredis";
import { nowMs } from "@soc/shared";

import { REDIS_CLIENT } from "./redis.provider";

type RateCategory = "auth" | "auth_read" | "search" | "calendar" | "survey" | "upload" | "receipt";

type RateScope = "ip" | "user";

interface RateBudget {
  limit: number;
  windowSeconds: number;
  failClosed: boolean;
}

const BUDGETS: Record<RateCategory, RateBudget> = {
  auth: { limit: 30, windowSeconds: 60, failClosed: true },
  // Session summaries are polled by several authenticated UI surfaces during
  // a normal login/account switch. Keep them IP-bound and fail-closed, but do
  // not let read-only polling consume the smaller token-issuing budget.
  auth_read: { limit: 60, windowSeconds: 60, failClosed: true },
  search: { limit: 90, windowSeconds: 60, failClosed: false },
  calendar: { limit: 90, windowSeconds: 60, failClosed: false },
  survey: { limit: 45, windowSeconds: 60, failClosed: true },
  upload: { limit: 12, windowSeconds: 60, failClosed: true },
  receipt: { limit: 30, windowSeconds: 60, failClosed: true },
};

const INCREMENT_WITH_TTL = `
local current = redis.call('INCR', KEYS[1])
if current == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end
return current
`;

@Injectable()
export class RequestRateLimitService {
  private readonly localBuckets = new Map<string, { count: number; resetAt: number }>();

  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async check(request: Request): Promise<{
    category: RateCategory | null;
    allowed: boolean;
    unavailable: boolean;
    limit: number | null;
    remaining: number | null;
    retryAfterSeconds: number | null;
  }> {
    const category = classifyPath(request.path);
    if (!category) {
      return {
        category: null,
        allowed: true,
        unavailable: false,
        limit: null,
        remaining: null,
        retryAfterSeconds: null,
      };
    }

    const ip = request.ip || request.socket.remoteAddress || "unknown";
    return this.consume(category, "ip", ip, BUDGETS[category]);
  }

  /**
   * Applies the second, authenticated budget. The caller supplies an identity
   * only after a session has been verified; raw cookies and Authorization
   * headers never reach this method.
   */
  async checkAuthenticated(request: Request, userId: string) {
    const category = classifyPath(request.path);
    if (!category) {
      return {
        category: null,
        allowed: true,
        unavailable: false,
        limit: null,
        remaining: null,
        retryAfterSeconds: null,
      };
    }

    return this.consume(category, "user", userId, BUDGETS[category]);
  }

  async enforceAuthenticated(request: Request, userId: string): Promise<void> {
    const result = await this.checkAuthenticated(request, userId);
    if (result.unavailable) {
      throw new ServiceUnavailableException("rate_limit_unavailable");
    }
    if (!result.allowed) {
      throw new HttpException("rate_limit_exceeded", HttpStatus.TOO_MANY_REQUESTS);
    }
  }

  private async consume(
    category: RateCategory,
    scope: RateScope,
    identity: string,
    budget: RateBudget,
  ) {
    const key = `soc:rate:v2:${category}:${scope}:${this.identityKey(identity)}`;
    try {
      const count = Number(await this.redis.eval(
        INCREMENT_WITH_TTL,
        1,
        key,
        budget.windowSeconds,
      ));
      const allowed = count <= budget.limit;
      return {
        category,
        allowed,
        unavailable: false,
        limit: budget.limit,
        remaining: Math.max(0, budget.limit - count),
        retryAfterSeconds: allowed ? null : budget.windowSeconds,
      };
    } catch {
      if (budget.failClosed) {
        return {
          category,
          allowed: false,
          unavailable: true,
          limit: budget.limit,
          remaining: 0,
          retryAfterSeconds: 5,
        };
      }
      return this.checkLocal(category, key, budget);
    }
  }

  private checkLocal(
    category: RateCategory,
    key: string,
    budget: RateBudget,
  ) {
    const now = nowMs();
    const existing = this.localBuckets.get(key);
    const bucket = existing && existing.resetAt > now
      ? existing
      : { count: 0, resetAt: now + budget.windowSeconds * 1_000 };
    bucket.count += 1;

    // Redis outages must not turn attacker-controlled identities into an
    // unbounded in-process cache. Keys are only IPs or verified user IDs and
    // the map has a hard bound even when every entry is still live.
    if (!existing && this.localBuckets.size >= 10_000) {
      for (const [bucketKey, value] of this.localBuckets) {
        if (value.resetAt <= now) this.localBuckets.delete(bucketKey);
      }
      while (this.localBuckets.size >= 10_000) {
        const oldest = this.localBuckets.keys().next().value as string | undefined;
        if (!oldest) break;
        this.localBuckets.delete(oldest);
      }
    }
    this.localBuckets.set(key, bucket);
    const allowed = bucket.count <= budget.limit;
    return {
      category,
      allowed,
      unavailable: false,
      limit: budget.limit,
      remaining: Math.max(0, budget.limit - bucket.count),
      retryAfterSeconds: allowed ? null : Math.ceil((bucket.resetAt - now) / 1_000),
    };
  }

  private identityKey(identity: string): string {
    return createHash("sha256")
      .update(identity.trim() || "unknown")
      .digest("hex")
      .slice(0, 32);
  }
}

function classifyPath(path: string): RateCategory | null {
  const normalized = path.replace(/^\/v1(?=\/|$)/, "");
  if (/^\/auth\/(?:session|me)$/.test(normalized)) return "auth_read";
  if (normalized === "/auth" || normalized.startsWith("/auth/")) return "auth";
  if (normalized === "/calendar" || normalized.startsWith("/calendar/")) return "calendar";
  if (normalized.includes("/search") || normalized === "/articles/search") return "search";
  if (normalized === "/surveys" || normalized.startsWith("/surveys/")) return "survey";
  if (/^\/assets\/(upload|presign|complete)$/.test(normalized)) return "upload";
  if (/^\/votes\/[^/]+\/receipts\//.test(normalized)) return "receipt";
  return null;
}
