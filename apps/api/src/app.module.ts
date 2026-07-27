import path from 'node:path';

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { AuthModule } from './features/auth/auth.module';
import { BoardsModule } from './features/boards/boards.module';
import { FaqsModule } from './features/faqs/faqs.module';
import { EventsModule } from './features/events/events.module';
import { HealthModule } from './features/health/health.module';
import { PermissionsModule } from './features/permissions/permissions.module';
import { UsersModule } from './features/users/users.module';
import { PostgresModule } from './infrastructure/postgres/postgres.module';
import { RedisModule } from './infrastructure/redis/redis.module';
import { validateEnv } from './shared/config/env.validation';
import { ClockModule } from './shared/time/clock.module';

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
    ClockModule,
    AuthModule,
    UsersModule,
    PermissionsModule,
    FaqsModule,
    BoardsModule,
    EventsModule,
    HealthModule,
  ],
})
export class AppModule {}
