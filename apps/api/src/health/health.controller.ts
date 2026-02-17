import { Controller, Get, Inject } from '@nestjs/common';
import { Pool } from 'pg';
import Redis from 'ioredis';

import { REDIS_CLIENT } from '../cache/redis/redis.provider';
import { POSTGRES_POOL } from '../database/postgres/postgres.provider';

interface DependencyHealth {
  ok: boolean;
  latencyMs: number;
  message?: string;
}

@Controller('health')
export class HealthController {
  constructor(
    @Inject(POSTGRES_POOL) private readonly pool: Pool,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  @Get()
  async getHealth() {
    const [postgres, redis] = await Promise.all([this.checkPostgres(), this.checkRedis()]);

    return {
      status: postgres.ok && redis.ok ? 'ok' : 'degraded',
      postgres,
      redis,
      timestamp: new Date().toISOString(),
    };
  }

  private async checkPostgres(): Promise<DependencyHealth> {
    const start = Date.now();

    try {
      await this.pool.query('SELECT 1');

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
