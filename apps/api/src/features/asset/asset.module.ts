import { Module } from "@nestjs/common";

import { PostgresModule } from "../../infrastructure/postgres/postgres.module";
import { RedisModule } from "../../infrastructure/redis/redis.module";
import { AssetController } from "./asset.controller";
import { AssetService } from "./asset.service";
import { AssetRepository } from "./repositories/asset.repository";
import {
  AssetStorageProvider,
  LocalAssetStorageProvider,
} from "./asset.storage";
import { AuthModule } from "../auth/auth.module";
import { UsersModule } from "../users/users.module";

@Module({
  imports: [AuthModule, UsersModule, PostgresModule, RedisModule],
  controllers: [AssetController],
  providers: [
    AssetRepository,
    AssetService,
    {
      provide: AssetStorageProvider,
      useClass: LocalAssetStorageProvider,
    },
  ],
})
export class AssetModule {}
