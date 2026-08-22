import { Module } from "@nestjs/common";

import { PostgresModule } from "../../infrastructure/postgres/postgres.module";
import { AuthModule } from "../auth/auth.module";
import { UsersModule } from "../users/users.module";

import { CalendarController } from "./calendar.controller";
import { CalendarService } from "./calendar.service";
import { CalendarSyncService } from "./calendar-sync.service";
import { GoogleCalendarClient } from "./google-calendar.client";
import { KaistAcademicCalendarSource } from "./kaist-academic-calendar.source";

@Module({
  imports: [PostgresModule, AuthModule, UsersModule],
  controllers: [CalendarController],
  providers: [
    CalendarService,
    CalendarSyncService,
    GoogleCalendarClient,
    KaistAcademicCalendarSource,
  ],
})
export class CalendarModule {}
