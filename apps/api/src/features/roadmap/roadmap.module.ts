import { Module } from "@nestjs/common";

import { PostgresModule } from "../../infrastructure/postgres/postgres.module";
import { AuditLogModule } from "../audit/audit-log.module";
import { AuthModule } from "../auth/auth.module";
import { UsersModule } from "../users/users.module";
import { RoadmapController } from "./roadmap.controller";
import { RoadmapRepository } from "./roadmap.repository";
import { RoadmapService } from "./roadmap.service";

@Module({
  imports: [AuditLogModule, AuthModule, PostgresModule, UsersModule],
  controllers: [RoadmapController],
  providers: [RoadmapRepository, RoadmapService],
})
export class RoadmapModule {}
