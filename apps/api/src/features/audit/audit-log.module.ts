import { Module } from "@nestjs/common";

import { PostgresModule } from "../../infrastructure/postgres/postgres.module";
import { AuditLogRepository } from "./audit-log.repository";
import { AuditLogService } from "./audit-log.service";

@Module({
  imports: [PostgresModule],
  providers: [AuditLogRepository, AuditLogService],
  exports: [AuditLogService],
})
export class AuditLogModule {}
