import { Inject, Injectable, Logger } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import Redis from 'ioredis';
import { nowIso, nowMs } from '@soc/shared';
import { randomUUID } from 'node:crypto';

import {
  DRIZZLE_DB,
  PostgresDatabase,
} from '../../infrastructure/postgres/postgres.provider';
import { REDIS_CLIENT } from '../../infrastructure/redis/redis.provider';

interface DependencyHealth {
  ok: boolean;
  latencyMs: number;
  code: 'ok' | 'postgres_unavailable' | 'redis_unavailable';
}

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  constructor(
    @Inject(DRIZZLE_DB) private readonly db: PostgresDatabase,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  async getHealth(correlationId: string = randomUUID()) {
    const [postgres, redis] = await Promise.all([
      this.checkPostgres(correlationId),
      this.checkRedis(correlationId),
    ]);

    return {
      status: postgres.ok && redis.ok ? 'ok' : 'degraded',
      code: postgres.ok && redis.ok ? 'ok' : 'dependency_unavailable',
      correlationId,
      timestamp: nowIso(),
    };
  }

  private async checkPostgres(correlationId: string): Promise<DependencyHealth> {
    const start = nowMs();

    try {
      await this.withDeadline(this.db.execute(sql`SELECT 1`));

      return {
        ok: true,
        latencyMs: nowMs() - start,
        code: 'ok',
      };
    } catch {
      this.logger.error(
        `dependency=postgres code=postgres_unavailable requestId=${correlationId}`,
      );
      return {
        ok: false,
        latencyMs: nowMs() - start,
        code: 'postgres_unavailable',
      };
    }
  }

  private async checkRedis(correlationId: string): Promise<DependencyHealth> {
    const start = nowMs();

    try {
      await this.withDeadline((async () => {
        if (this.redis.status === 'wait') await this.redis.connect();
        await this.redis.ping();
      })());

      return {
        ok: true,
        latencyMs: nowMs() - start,
        code: 'ok',
      };
    } catch {
      this.logger.error(
        `dependency=redis code=redis_unavailable requestId=${correlationId}`,
      );
      return {
        ok: false,
        latencyMs: nowMs() - start,
        code: 'redis_unavailable',
      };
    }
  }

  private async withDeadline(operation: PromiseLike<unknown>): Promise<void> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        operation,
        new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('health_check_timeout')), 3_000); }),
      ]);
    } finally {
      clearTimeout(timer);
    }
  }
}
