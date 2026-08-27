import { Module } from "@nestjs/common";
import { BulkEmailRepository } from "./bulk-email.repository";
import { BulkEmailTemplateRepository } from "./bulk-email-template.repository";
import { BulkEmailService } from "./bulk-email.service";
import { BulkEmailController } from "./bulk-email.controller";
import { AuthModule } from "../auth/auth.module";
import { UsersModule } from "../users/users.module";
import { PostgresModule } from "../../infrastructure/postgres/postgres.module";
import { EmailDeliveryModule } from "./email-delivery.module";
import { AssetModule } from "../asset/asset.module";

@Module({
  imports: [AuthModule, UsersModule, PostgresModule, AssetModule, EmailDeliveryModule],
  controllers: [BulkEmailController],
  providers: [BulkEmailRepository, BulkEmailTemplateRepository, BulkEmailService],
  exports: [BulkEmailService, BulkEmailRepository],
})
export class BulkEmailModule {}
