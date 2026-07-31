import path from 'node:path';

import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { AuthModule } from './features/auth/auth.module';
import { BoardsModule } from './features/boards/boards.module';
import { ChatModule } from './features/chat/chat.module';
import { ContactsModule } from './features/contacts/contacts.module';
import { FaqsModule } from './features/faqs/faqs.module';
import { EventsModule } from './features/events/events.module';
import { HealthModule } from './features/health/health.module';
import { NotificationsModule } from './features/notifications/notifications.module';
import { PermissionsModule } from './features/permissions/permissions.module';
import { UsersModule } from './features/users/users.module';
import { SurveysModule } from './features/surveys/surveys.module';
import { PostgresModule } from './infrastructure/postgres/postgres.module';
import { RedisModule } from './infrastructure/redis/redis.module';
import { validateEnv } from './shared/config/env.validation';
import { RateLimitMiddleware } from './shared/middleware/rate-limit.middleware';
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
    SurveysModule,
    ContactsModule,
    NotificationsModule,
    ChatModule,
    HealthModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RateLimitMiddleware).forRoutes('*');
  }
}
