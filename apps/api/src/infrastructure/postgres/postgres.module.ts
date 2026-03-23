import { Inject, Module, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';

import { POSTGRES_POOL, postgresProvider } from './postgres.provider';

@Module({
  providers: [postgresProvider],
  exports: [postgresProvider],
})
export class PostgresModule implements OnModuleDestroy {
  constructor(@Inject(POSTGRES_POOL) private readonly pool: Pool) {}

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }
}
