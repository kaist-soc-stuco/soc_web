import { Module } from "@nestjs/common";

import { PostgresModule } from "../../infrastructure/postgres/postgres.module";
import { RedisModule } from "../../infrastructure/redis/redis.module";
import { AssetController } from "./asset.controller";
import { AssetService } from "./asset.service";
import { AssetRepository } from "./repositories/asset.repository";
import {
  AssetStorageProvider,
  ConfiguredAssetStorageProvider,
} from "./asset.storage";
import { AuthModule } from "../auth/auth.module";
import { UsersModule } from "../users/users.module";
import { BoardModule } from "../board/board.module";
import { AuditLogModule } from "../audit/audit-log.module";

@Module({
  imports: [AuthModule, UsersModule, PostgresModule, RedisModule, BoardModule, AuditLogModule],
  controllers: [AssetController],
  providers: [
    AssetRepository,
    AssetService,
    {
      provide: AssetStorageProvider,
      useClass: ConfiguredAssetStorageProvider,
    },
  ],
  exports: [AssetRepository, AssetService],
})
export class AssetModule {}
