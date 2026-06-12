import { Module } from "@nestjs/common";

import { PostgresModule } from "../../infrastructure/postgres/postgres.module";
import { AuditLogModule } from "../audit/audit-log.module";
import { AuthModule } from "../auth/auth.module";
import { UsersModule } from "../users/users.module";

import { RoleGroupsController } from "./role-groups.controller";
import { RoleGroupsRepository } from "./role-groups.repository";
import { RoleGroupsService } from "./role-groups.service";

@Module({
  imports: [PostgresModule, AuthModule, UsersModule, AuditLogModule],
  controllers: [RoleGroupsController],
  providers: [RoleGroupsRepository, RoleGroupsService],
})
export class RoleGroupsModule {}
