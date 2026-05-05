import { Inject, Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import Redis from 'ioredis';
import { msToIso, nowIso, nowMs } from '@soc/shared';

import {
  DRIZZLE_DB,
  PostgresDatabase,
} from '../../infrastructure/postgres/postgres.provider';
import { REDIS_CLIENT } from '../../infrastructure/redis/redis.provider';

@Injectable()
export class MockService {
  constructor(
    @Inject(DRIZZLE_DB) private readonly db: PostgresDatabase,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  async getGreeting() {
    const [visits, dbTime] = await Promise.all([this.readVisits(), this.readDbTime()]);

    return {
      message: 'Vanilla React + NestJS mock platform is running.',
      visits,
      dbTime,
    };
  }

  private async readVisits(): Promise<number> {
    try {
      if (this.redis.status === 'wait') {
        await this.redis.connect();
      }

      return this.redis.incr('mock:greeting:visits');
    } catch {
      return -1;
    }
  }

  private async readDbTime(): Promise<string> {
    try {
      const result = await this.db.execute<{ now: Date }>(sql`SELECT NOW() as now`);
      const row = result.rows[0]?.now;
      return msToIso(row instanceof Date ? row.valueOf() : nowMs());
    } catch {
      return nowIso();
    }
  }
}
