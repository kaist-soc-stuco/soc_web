import path from "node:path";

import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ScheduleModule } from "@nestjs/schedule";

import { AuthModule } from './features/auth/auth.module';
import { AuthDevModule } from "./features/auth/auth-dev.module";
import { HealthModule } from './features/health/health.module';
import { MockModule } from './features/mock/mock.module';
import { SurveysModule } from './features/surveys/surveys.module';
import { UsersHttpModule } from './features/users/users-http.module';
import { RoleGroupsModule } from "./features/role-groups/role-groups.module";
import { PostgresModule } from './infrastructure/postgres/postgres.module';
import { RedisModule } from './infrastructure/redis/redis.module';
import { validateEnv } from './shared/config/env.validation';
import { BoardModule } from "./features/board/board.module";
import { AssetModule } from "./features/asset/asset.module";
import { ContactsModule } from "./features/contacts/contacts.module";
import { BulkEmailModule } from "./features/email/bulk-email.module";
import { CalendarModule } from "./features/calendar/calendar.module";
import { AuditLogHttpModule } from "./features/audit/audit-log-http.module";
import { SiteContentModule } from "./features/site-content/site-content.module";
import { NotificationsModule } from "./features/notifications/notifications.module";

const devOnlyModules =
  process.env.NODE_ENV === "production" ? [] : [AuthDevModule, MockModule];

@Module({
  imports: [
    ScheduleModule.forRoot(),
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
      envFilePath: [
        path.resolve(process.cwd(), ".env.local"),
        path.resolve(process.cwd(), ".env"),
        path.resolve(process.cwd(), "../../.env.local"),
        path.resolve(process.cwd(), "../../.env"),
      ],
    }),
    PostgresModule,
    RedisModule,
    AuthModule,
    AssetModule,
    BoardModule,
    UsersHttpModule,
    SurveysModule,
    ContactsModule,
    BulkEmailModule,
    CalendarModule,
    AuditLogHttpModule,
    SiteContentModule,
    NotificationsModule,
    RoleGroupsModule,
    HealthModule,
    ...devOnlyModules,
  ],
})
export class AppModule {}
