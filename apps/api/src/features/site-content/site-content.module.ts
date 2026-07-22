import { Module } from "@nestjs/common";

import { PostgresModule } from "../../infrastructure/postgres/postgres.module";
import { AuditLogModule } from "../audit/audit-log.module";
import { AuthModule } from "../auth/auth.module";
import { UsersModule } from "../users/users.module";
import { SiteContentController } from "./site-content.controller";
import { SiteContentRepository } from "./site-content.repository";
import { SiteContentService } from "./site-content.service";

@Module({
  imports: [AuditLogModule, AuthModule, PostgresModule, UsersModule],
  controllers: [SiteContentController],
  providers: [SiteContentRepository, SiteContentService],
})
export class SiteContentModule {}
