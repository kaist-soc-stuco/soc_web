import { Module } from "@nestjs/common";

import { PostgresModule } from "../../infrastructure/postgres/postgres.module";
import { AuthModule } from "../auth/auth.module";
import { AuditLogModule } from "../audit/audit-log.module";
import { UsersModule } from "../users/users.module";
import { VoteCryptoService } from "./vote-crypto.service";
import { VotesController } from "./votes.controller";
import { VotesRepository } from "./votes.repository";
import { VotesService } from "./votes.service";

@Module({
  imports: [PostgresModule, AuthModule, UsersModule, AuditLogModule],
  controllers: [VotesController],
  providers: [VoteCryptoService, VotesRepository, VotesService],
})
export class VotesModule {}
