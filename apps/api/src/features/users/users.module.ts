import { Module, forwardRef } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module";
import { PostgresModule } from "../../infrastructure/postgres/postgres.module";
import { RedisModule } from "../../infrastructure/redis/redis.module";
import { UsersRepository } from "./repositories/users.repository";
import { UsersController } from "./users.controller";
import { UsersService } from "./users.service";

@Module({
  imports: [PostgresModule, RedisModule, forwardRef(() => AuthModule)],
  controllers: [UsersController],
  providers: [UsersRepository, UsersService],
  exports: [UsersService],
})
export class UsersModule {}
