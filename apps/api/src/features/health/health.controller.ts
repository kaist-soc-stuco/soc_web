import { Controller, Get, Inject, ServiceUnavailableException } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import Redis from 'ioredis';
import { nowIso } from '@soc/shared';

import {
  DRIZZLE_DB,
  PostgresDatabase,
} from '../../infrastructure/postgres/postgres.provider';
import { REDIS_CLIENT } from '../../infrastructure/redis/redis.provider';

interface DependencyHealth {
  ok: boolean;
  latencyMs: number;
}
const DEPENDENCY_TIMEOUT_MS = 1_000;

const withTimeout = <T>(operation: Promise<T>): Promise<T> =>
  new Promise<T>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Dependency health check timed out')), DEPENDENCY_TIMEOUT_MS);

    operation.then(
      (value) => {
        clearTimeout(timeout);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timeout);
        reject(error);
      },
    );
  });

@Controller('health')
export class HealthController {
  constructor(
    @Inject(DRIZZLE_DB) private readonly db: PostgresDatabase,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  @Get('live')
  getLiveness() {
    return {
      status: 'ok',
      timestamp: nowIso(),
    };
  }

  @Get('ready')
  async getReadiness() {
    const [postgres, redis] = await Promise.all([this.checkPostgres(), this.checkRedis()]);

    if (!postgres.ok || !redis.ok) {
      throw new ServiceUnavailableException({
        code: 'service_unavailable',
      });
    }

    return {
      status: 'ok',
      postgres,
      redis,
      timestamp: nowIso(),
    };
  }

  @Get()
  async getHealth() {
    return this.getReadiness();
  }

  private async checkPostgres(): Promise<DependencyHealth> {
    const start = Date.now();

    try {
      await withTimeout(this.db.execute(sql`SELECT 1`));

      return {
        ok: true,
        latencyMs: Date.now() - start,
      };
    } catch {
      return {
        ok: false,
        latencyMs: Date.now() - start,
      };
    }
  }

  private async checkRedis(): Promise<DependencyHealth> {
    const start = Date.now();

    try {
      if (this.redis.status === 'wait') {
        await withTimeout(this.redis.connect());
      }

      await withTimeout(this.redis.ping());

      return {
        ok: true,
        latencyMs: Date.now() - start,
      };
    } catch {
      return {
        ok: false,
        latencyMs: Date.now() - start,
      };
    }
  }
}
