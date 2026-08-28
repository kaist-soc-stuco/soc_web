import { Module } from "@nestjs/common";

import { PostgresModule } from "../../infrastructure/postgres/postgres.module";
import { RedisModule } from "../../infrastructure/redis/redis.module";
import { AuditLogModule } from "../audit/audit-log.module";
import { UsersRepository } from "./repositories/users.repository";
import { UserRestrictionsRepository } from "./repositories/user-restrictions.repository";
import { StudentFeeGoogleSheetsRepository } from "./repositories/student-fee-google-sheets.repository";
import { StudentFeeGoogleSheetsService } from "./student-fee-google-sheets.service";
import { UsersService } from "./users.service";

@Module({
  imports: [PostgresModule, RedisModule, AuditLogModule],
  providers: [
    UsersRepository,
    UserRestrictionsRepository,
    UsersService,
    StudentFeeGoogleSheetsRepository,
    StudentFeeGoogleSheetsService,
  ],
  exports: [UsersService, StudentFeeGoogleSheetsService],
})
export class UsersModule {}
