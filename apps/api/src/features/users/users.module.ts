import { Module } from "@nestjs/common";

import { PostgresModule } from "../../infrastructure/postgres/postgres.module";
import { RedisModule } from "../../infrastructure/redis/redis.module";
import { AuditLogModule } from "../audit/audit-log.module";
import { UsersRepository } from "./repositories/users.repository";
import { UsersService } from "./users.service";
import { GoogleFeeSheetsService } from "./google-fee-sheets.service";
import { EmailDeliveryModule } from "../email/email-delivery.module";
import { StudentFeeRosterImportService } from "./student-fee-roster-import.service";

@Module({
  imports: [PostgresModule, RedisModule, AuditLogModule, EmailDeliveryModule],
  providers: [UsersRepository, UsersService, GoogleFeeSheetsService, StudentFeeRosterImportService],
  exports: [UsersService, GoogleFeeSheetsService],
})
export class UsersModule {}
