import { Module } from "@nestjs/common";

import { PostgresModule } from "../../infrastructure/postgres/postgres.module";
import { RedisModule } from "../../infrastructure/redis/redis.module";
import { AuthSessionRepository } from "../auth/auth-session.repository";
import { UsersRepository } from "../users/repositories/users.repository";
import { UsersService } from "../users/users.service";
import { AuthGuard, PermissionGuard } from "../../shared/guards";

import { RoleGroupsController } from "./role-groups.controller";
import { RoleGroupsRepository } from "./role-groups.repository";
import { RoleGroupsService } from "./role-groups.service";

@Module({
  imports: [PostgresModule, RedisModule],
  controllers: [RoleGroupsController],
  providers: [
    AuthSessionRepository,
    UsersRepository,
    UsersService,
    AuthGuard,
    PermissionGuard,
    RoleGroupsRepository,
    RoleGroupsService,
  ],
})
export class RoleGroupsModule {}