import { Module } from "@nestjs/common";

import { PostgresModule } from "../../infrastructure/postgres/postgres.module";
import { AuthGuard } from "../../shared/guards";
import { AuthModule } from "../auth/auth.module";
import { UsersModule } from "../users/users.module";
import { PermissionsController } from "./permissions.controller";
import { PermissionsRepository } from "./permissions.repository";
import { PermissionsService } from "./permissions.service";

@Module({
  imports: [PostgresModule, AuthModule, UsersModule],
  controllers: [PermissionsController],
  providers: [PermissionsRepository, PermissionsService, AuthGuard],
  exports: [PermissionsService],
})
export class PermissionsModule {}
