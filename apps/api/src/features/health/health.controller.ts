import { Controller, Get, Inject } from '@nestjs/common';
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
  message?: string;
}

@Controller('health')
export class HealthController {
  constructor(
    @Inject(DRIZZLE_DB) private readonly db: PostgresDatabase,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  @Get()
  async getHealth() {
    const [postgres, redis] = await Promise.all([this.checkPostgres(), this.checkRedis()]);

    return {
      status: postgres.ok && redis.ok ? 'ok' : 'degraded',
      postgres,
      redis,
      timestamp: nowIso(),
    };
  }

  private async checkPostgres(): Promise<DependencyHealth> {
    const start = Date.now();

    try {
      await this.db.execute(sql`SELECT 1`);

      return {
        ok: true,
        latencyMs: Date.now() - start,
      };
    } catch (error) {
      return {
        ok: false,
        latencyMs: Date.now() - start,
        message: error instanceof Error ? error.message : 'postgres check failed',
      };
    }
  }

  private async checkRedis(): Promise<DependencyHealth> {
    const start = Date.now();

    try {
      if (this.redis.status === 'wait') {
        await this.redis.connect();
      }

      await this.redis.ping();

      return {
        ok: true,
        latencyMs: Date.now() - start,
      };
    } catch (error) {
      return {
        ok: false,
        latencyMs: Date.now() - start,
        message: error instanceof Error ? error.message : 'redis check failed',
      };
    }
  }
}
