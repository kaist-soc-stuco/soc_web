import { forwardRef, Module } from "@nestjs/common";

import { PostgresModule } from "../../infrastructure/postgres/postgres.module";
import { AuthGuard } from "../../shared/guards";
import { PiiCipherService } from "../../shared/security/pii-cipher.service";
import { AuthModule } from "../auth/auth.module";
import { UsersController } from "./users.controller";
import { UsersRepository } from "./repositories/users.repository";
import { UsersService } from "./users.service";

@Module({
  imports: [PostgresModule, forwardRef(() => AuthModule)],
  controllers: [UsersController],
  providers: [UsersRepository, UsersService, AuthGuard, PiiCipherService],
  exports: [UsersService],
})
export class UsersModule {}
