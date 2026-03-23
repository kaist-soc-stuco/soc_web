import { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';

export const POSTGRES_POOL = Symbol('POSTGRES_POOL');

export const postgresProvider: Provider = {
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
