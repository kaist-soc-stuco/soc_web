import { Module, forwardRef } from "@nestjs/common";

import { PostgresModule } from "../../infrastructure/postgres/postgres.module";
import { RedisModule } from "../../infrastructure/redis/redis.module";
import { UsersModule } from "../users/users.module";
import { AuthController } from "./auth.controller";
import { PendingLoginRepository } from "./pending-login.repository";
import { AuthSessionRepository } from "./auth-session.repository";
import { AuthSessionService } from "./auth-session.service";
import { AuthService } from "./auth.service";
import { AuthGuard } from "../../shared/guards";

@Module({
  imports: [PostgresModule, RedisModule, forwardRef(() => UsersModule)],
  controllers: [AuthController],
  providers: [
    AuthGuard,
    AuthService,
    AuthSessionRepository,
    AuthSessionService,
    PendingLoginRepository,
  ],
  exports: [AuthGuard, AuthSessionRepository, AuthSessionService, UsersModule],
})
export class AuthModule {}
