import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { isoToDate, msToIso, nowMs } from "@soc/shared";

import { AssetRepository } from "./repositories/asset.repository";
import { AssetStorageProvider } from "./asset.storage";

type UploadedAssetFile = {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
  size: number;
};

@Injectable()
export class AssetService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AssetService.name);
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;
  private cleanupRunning = false;

  constructor(
    private readonly assetRepository: AssetRepository,
    private readonly configService: ConfigService,
    @Inject(AssetStorageProvider)
    private readonly storage: AssetStorageProvider,
  ) {}

  onModuleInit() {
    const intervalHours = this.configService.get<number>(
      "ASSET_ORPHAN_CLEANUP_INTERVAL_HOURS",
      6,
    );
    const intervalMs = intervalHours * 60 * 60 * 1000;

    this.cleanupInterval = setInterval(() => {
      void this.runScheduledCleanup();
    }, intervalMs);

    this.logger.log(
      `Scheduled asset orphan cleanup every ${intervalHours}h; grace=${this.configService.get<number>(
        "ASSET_ORPHAN_GRACE_HOURS",
        24,
      )}h`,
    );
  }

  onModuleDestroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  async uploadFile(input: {
    file: UploadedAssetFile;
    userId: string;
  }): Promise<{
    assetId: string;
    originalFilename: string;
    mimeType: string;
    sizeBytes: number;
    storageKey: string;
  }> {
    const storageKey = await this.storage.upload({
      buffer: input.file.buffer,
      contentType: input.file.mimetype,
      originalName: input.file.originalname,
    });

    const asset = await this.assetRepository.createAsset({
      storageKey,
      originalFilename: input.file.originalname,
      mimeType: input.file.mimetype,
      sizeBytes: input.file.size,
      uploadedBy: input.userId,
    });

    return {
      assetId: asset.assetId,
      originalFilename: input.file.originalname,
      mimeType: input.file.mimetype,
      sizeBytes: input.file.size,
      storageKey,
    };
  }

  async cleanupUnlinkedAssets(): Promise<{
    scanned: number;
    deleted: number;
    failed: number;
    olderThanHours: number;
  }> {
    const olderThanHours = this.configService.get<number>(
      "ASSET_ORPHAN_GRACE_HOURS",
      24,
    );
    const cutoff = isoToDate(msToIso(nowMs() - olderThanHours * 60 * 60 * 1000));
    const candidates = await this.assetRepository.findUnlinkedAssetsBefore(
      cutoff,
      100,
    );

    const deletableAssetIds: string[] = [];
    let failed = 0;

    for (const candidate of candidates) {
      try {
        await this.storage.delete(candidate.storageKey);
        deletableAssetIds.push(candidate.assetId);
      } catch {
        failed += 1;
      }
    }

    const deleted =
      await this.assetRepository.deleteAssetsByIds(deletableAssetIds);

    return {
      scanned: candidates.length,
      deleted,
      failed,
      olderThanHours,
    };
  }

  private async runScheduledCleanup() {
    if (this.cleanupRunning) {
      this.logger.warn(
        "Skipped asset orphan cleanup because a previous run is still active.",
      );
      return;
    }

    this.cleanupRunning = true;
    try {
      const result = await this.cleanupUnlinkedAssets();
      this.logger.log(
        `Asset orphan cleanup complete: scanned=${result.scanned}, deleted=${result.deleted}, failed=${result.failed}, grace=${result.olderThanHours}h`,
      );
    } catch (error) {
      this.logger.error(
        "Asset orphan cleanup failed.",
        error instanceof Error ? error.stack : String(error),
      );
    } finally {
      this.cleanupRunning = false;
    }
  }
}
