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
import { InitialAdminRepository } from "./initial-admin.repository";
import { InitialAdminService } from "./initial-admin.service";
import { AuthGuard, OptionalAuthGuard, PermissionBitsGuard } from "./guards";
import { AuditLogModule } from "../audit/audit-log.module";

@Module({
  imports: [PostgresModule, RedisModule, UsersModule, AuditLogModule],
  controllers: [AuthController],
  providers: [
    AuthGuard,
    OptionalAuthGuard,
    PermissionBitsGuard,
    AuthCookieService,
    AuthService,
    InitialAdminRepository,
    InitialAdminService,
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
