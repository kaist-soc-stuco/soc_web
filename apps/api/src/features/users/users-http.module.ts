import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module";
import { UsersController } from "./users.controller";
import { UsersModule } from "./users.module";

@Module({
  imports: [UsersModule, AuthModule],
  controllers: [UsersController],
})
export class UsersHttpModule {}
