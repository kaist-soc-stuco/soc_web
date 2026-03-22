import path from 'node:path';

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { RedisModule } from './cache/redis/redis.module';
import { validateEnv } from './common/config/env.validation';
import { PostgresModule } from './database/postgres/postgres.module';
import { HealthController } from './health/health.controller';
import { AuthModule } from './modules/auth/auth.module';
import { MockModule } from './modules/mock/mock.module';
import { UsersModule } from './modules/users/users.module';

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
    MockModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
