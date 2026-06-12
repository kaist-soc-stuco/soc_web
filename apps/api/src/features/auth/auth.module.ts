import { Module } from "@nestjs/common";

import { PostgresModule } from "../../infrastructure/postgres/postgres.module";
import { RedisModule } from "../../infrastructure/redis/redis.module";
import { UsersModule } from "../users/users.module";
import { AuthCookieService } from "./auth-cookie.service";
import { AuthController } from "./auth.controller";
import { PendingLoginRepository } from "./pending-login.repository";
import { AuthSessionRepository } from "./auth-session.repository";
import { AuthSessionService } from "./auth-session.service";
import { AuthService } from "./auth.service";
import { AuthGuard, OptionalAuthGuard, PermissionBitsGuard } from "./guards";

@Module({
  imports: [PostgresModule, RedisModule, UsersModule],
  controllers: [AuthController],
  providers: [
    AuthGuard,
    OptionalAuthGuard,
    PermissionBitsGuard,
    AuthCookieService,
    AuthService,
    AuthSessionRepository,
    AuthSessionService,
    PendingLoginRepository,
  ],
  exports: [
    AuthGuard,
    OptionalAuthGuard,
    PermissionBitsGuard,
    AuthCookieService,
    AuthSessionRepository,
    AuthSessionService,
  ],
})
export class AuthModule {}
