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
      host: configService.getOrThrow<string>('POSTGRES_HOST'),
      port: configService.getOrThrow<number>('POSTGRES_PORT'),
      database: configService.getOrThrow<string>('POSTGRES_DB'),
      user: configService.getOrThrow<string>('POSTGRES_USER'),
      password: configService.getOrThrow<string>('POSTGRES_PASSWORD'),
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
