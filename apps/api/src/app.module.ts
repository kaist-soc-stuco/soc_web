import path from 'node:path';

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { AuthModule } from './features/auth/auth.module';
import { HealthModule } from './features/health/health.module';
import { MockModule } from './features/mock/mock.module';
import { UsersModule } from './features/users/users.module';
import { PostgresModule } from './infrastructure/postgres/postgres.module';
import { RedisModule } from './infrastructure/redis/redis.module';
import { validateEnv } from './shared/config/env.validation';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
      envFilePath: [
        path.resolve(process.cwd(), '.env.local'),
        path.resolve(process.cwd(), '.env'),
        path.resolve(process.cwd(), '../../.env.local'),
        path.resolve(process.cwd(), '../../.env'),
      ],
    }),
    PostgresModule,
    RedisModule,
    AuthModule,
    UsersModule,
    HealthModule,
    MockModule,
  ],
})
export class AppModule {}
