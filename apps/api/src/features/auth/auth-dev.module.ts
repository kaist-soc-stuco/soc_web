import { Module } from "@nestjs/common";

import { PostgresModule } from "../../infrastructure/postgres/postgres.module";
import { UsersModule } from "../users/users.module";
import { AuthDevController } from "./auth-dev.controller";
import { AuthDevLoginRepository } from "./auth-dev-login.repository";
import { AuthDevLoginService } from "./auth-dev-login.service";
import { AuthModule } from "./auth.module";

@Module({
  imports: [AuthModule, PostgresModule, UsersModule],
  controllers: [AuthDevController],
  providers: [AuthDevLoginRepository, AuthDevLoginService],
})
export class AuthDevModule {}
