import { Module } from "@nestjs/common";
import { BulkEmailRepository } from "./bulk-email.repository";
import { BulkEmailService } from "./bulk-email.service";
import { BulkEmailController } from "./bulk-email.controller";
import { AuthModule } from "../auth/auth.module";
import { UsersModule } from "../users/users.module";
import { PostgresModule } from "../../infrastructure/postgres/postgres.module";

@Module({
  imports: [AuthModule, UsersModule, PostgresModule],
  controllers: [BulkEmailController],
  providers: [BulkEmailRepository, BulkEmailService],
  exports: [BulkEmailService, BulkEmailRepository],
})
export class BulkEmailModule {}
