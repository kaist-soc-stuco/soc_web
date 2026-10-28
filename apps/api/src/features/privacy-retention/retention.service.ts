import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Cron } from "@nestjs/schedule";
import { nowDate } from "@soc/shared";
import { AssetService } from "../asset/asset.service";
import { RetentionRepository } from "./retention.repository";

@Injectable()
export class RetentionService {
  private readonly logger = new Logger(RetentionService.name);
  constructor(private readonly repository: RetentionRepository, private readonly config: ConfigService, private readonly assets: AssetService) {}

  @Cron("0 15 * * * *", { timeZone: "Asia/Seoul" })
  async scheduledCleanup() {
    if (!this.config.get<boolean>("DATA_RETENTION_ENABLED", false)) return;
    try {
      const result = await this.run(false);
      this.logger.log(`Retention cleanup: drafts=${result.drafts}, logs=${result.auditLogs}, cases=${result.cases.length}, blocked=${result.cases.filter(item => item.blocked).length}`);
    } catch {
      this.logger.error("Retention cleanup failed; records were preserved or queued storage deletion will be retried.");
    }
  }

  async run(dryRun: boolean) {
    const result = await this.repository.run(dryRun, nowDate());
    if (!dryRun && !result.busy) await this.assets.cleanupUnlinkedAssets();
    return result;
  }
}
