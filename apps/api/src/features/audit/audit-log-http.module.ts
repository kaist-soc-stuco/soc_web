import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module";
import { UsersModule } from "../users/users.module";
import { AuditLogController } from "./audit-log.controller";
import { AuditLogModule } from "./audit-log.module";

@Module({
  imports: [AuditLogModule, AuthModule, UsersModule],
  controllers: [AuditLogController],
})
export class AuditLogHttpModule {}
