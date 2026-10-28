import { Module } from "@nestjs/common";
import { PostgresModule } from "../../infrastructure/postgres/postgres.module";
import { AuthModule } from "../auth/auth.module";
import { UsersModule } from "../users/users.module";
import { AuditLogModule } from "../audit/audit-log.module";
import { AssetModule } from "../asset/asset.module";
import { RetentionRepository } from "./retention.repository";
import { RetentionService } from "./retention.service";
import { RetentionController } from "./retention.controller";

@Module({
  imports: [PostgresModule, AuthModule, UsersModule, AuditLogModule, AssetModule],
  providers: [RetentionRepository, RetentionService],
  controllers: [RetentionController],
})
export class RetentionModule {}
