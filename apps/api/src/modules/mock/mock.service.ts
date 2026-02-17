import { Inject, Injectable } from '@nestjs/common';
import { Pool } from 'pg';
import Redis from 'ioredis';

import { REDIS_CLIENT } from '../../cache/redis/redis.provider';
import { POSTGRES_POOL } from '../../database/postgres/postgres.provider';

@Injectable()
export class MockService {
  constructor(
    @Inject(POSTGRES_POOL) private readonly pool: Pool,
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
      const result = await this.pool.query<{ now: Date }>('SELECT NOW() as now');
      return new Date(result.rows[0]?.now ?? Date.now()).toISOString();
    } catch {
      return new Date().toISOString();
    }
  }
}
