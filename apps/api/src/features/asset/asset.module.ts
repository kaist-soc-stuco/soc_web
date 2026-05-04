import { Module } from "@nestjs/common";

import { PostgresModule } from "../../infrastructure/postgres/postgres.module";
import { RedisModule } from "../../infrastructure/redis/redis.module";
import { AssetController } from "./asset.controller";
import { AssetService } from "./asset.service";
import { AssetRepository } from "./repositories/asset.repository";
import {
  AssetStorageProvider,
  MemoryAssetStorageProvider,
} from "./asset.storage";
import { AuthModule } from "../auth/auth.module";

@Module({
  imports: [AuthModule, PostgresModule, RedisModule],
  controllers: [AssetController],
  providers: [
    AssetRepository,
    AssetService,
    {
      provide: AssetStorageProvider,
      useClass: MemoryAssetStorageProvider,
    },
  ],
})
export class AssetModule {}
