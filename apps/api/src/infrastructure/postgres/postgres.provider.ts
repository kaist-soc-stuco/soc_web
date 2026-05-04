import { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

import * as schema from './postgres.schema';

export type PostgresDatabase = NodePgDatabase<typeof schema>;

export const DRIZZLE_DB = Symbol('DRIZZLE_DB');
export const POSTGRES_POOL = Symbol('POSTGRES_POOL');

const postgresPoolProvider: Provider = {
  provide: POSTGRES_POOL,
  inject: [ConfigService],
  useFactory: (configService: ConfigService): Pool => {
    return new Pool({
      host: configService.get<string>('POSTGRES_HOST', 'localhost'),
      port: configService.get<number>('POSTGRES_PORT', 5432),
      database: configService.get<string>('POSTGRES_DB', 'soc_web'),
      user: configService.get<string>('POSTGRES_USER', 'soc'),
      password: configService.get<string>('POSTGRES_PASSWORD', 'soc'),
      max: 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
    });
  },
};

export const postgresProvider: Provider = {
  provide: DRIZZLE_DB,
  inject: [POSTGRES_POOL],
  useFactory: (pool: Pool): PostgresDatabase => drizzle(pool, { schema }),
};

export const postgresProviders: Provider[] = [postgresPoolProvider, postgresProvider];
