import { Module } from "@nestjs/common";

import { AuthModule } from "./auth.module";
import { DevelopmentAuthController } from "./development-auth.controller";
import { UsersModule } from "../users/users.module";

@Module({
  imports: [AuthModule, UsersModule],
  controllers: [DevelopmentAuthController],
})
export class DevelopmentAuthModule {}
