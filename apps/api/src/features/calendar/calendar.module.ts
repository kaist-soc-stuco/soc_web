import { Module } from "@nestjs/common";

import { PostgresModule } from "../../infrastructure/postgres/postgres.module";

import { CalendarController } from "./calendar.controller";
import { CalendarService } from "./calendar.service";

@Module({
  imports: [PostgresModule],
  controllers: [CalendarController],
  providers: [CalendarService],
})
export class CalendarModule {}
