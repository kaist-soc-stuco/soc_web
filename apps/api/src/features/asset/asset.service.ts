import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
  Optional,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { isoToDate, msToDate, msToIso, nowMs } from "@soc/shared";
import type { Readable } from "node:stream";

import { AssetRepository } from "./repositories/asset.repository";
import { AssetStorageProvider } from "./asset.storage";
import { toAssetReference } from "./asset-reference";
import { BoardRepository } from "../board/repositories/board.repository";
import { ArticleRepository } from "../board/repositories/article.repository";
import type { CurrentUserContext } from "../board/article-access";
import {
  canReadSecretArticles,
  getReadableArticleScopes,
} from "../board/article-access";
import { AuditLogService } from "../audit/audit-log.service";
import type { AuditMetadata } from "../audit/audit-context";
import type {
  AssetDirectUploadPrepareResponse,
  AssetUploadResponse,
} from "@soc/contracts";
import { Permissions } from "@soc/contracts";

type UploadedAssetFile = {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
  size: number;
};

const DEFAULT_ASSET_USER_MAX_COUNT = 100;
const DEFAULT_ASSET_USER_MAX_BYTES = 512 * 1024 * 1024;
const DIRECT_UPLOAD_EXPIRES_MS = 10 * 60 * 1_000;
const MAX_BUFFERED_ASSET_BYTES = 20 * 1024 * 1024;

@Injectable()
export class AssetService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AssetService.name);
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly assetRepository: AssetRepository,
    private readonly configService: ConfigService,
    @Inject(AssetStorageProvider)
    private readonly storage: AssetStorageProvider,
    private readonly boardRepository: BoardRepository,
    private readonly articleRepository: ArticleRepository,
    @Optional() private readonly auditLogService?: AuditLogService,
  ) {}

  onModuleInit() {
    const enabled = this.configService.get<boolean>(
      "ASSET_ORPHAN_CLEANUP_ENABLED",
      false,
    );

    if (!enabled) {
      this.logger.log(
        "Asset orphan cleanup scheduler is disabled. Use POST /assets/cleanup-orphans or enable ASSET_ORPHAN_CLEANUP_ENABLED.",
      );
      return;
    }

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
    audit?: AuditMetadata;
  }): Promise<{
    assetId: string;
    originalFilename: string;
    mimeType: string;
    sizeBytes: number;
    storageKey: string;
  }> {
    const reservationId = await this.reserveAssetUpload(input.userId, input.file.size);
    let storageKey: string | null = null;
    let asset: { assetId: string };
    try {
      storageKey = await this.storage.upload({
        buffer: input.file.buffer,
        contentType: input.file.mimetype,
        originalName: input.file.originalname,
      });

      asset = await this.assetRepository.createAssetFromReservation({
        reservationId,
        storageKey,
        originalFilename: input.file.originalname,
        mimeType: input.file.mimetype,
        sizeBytes: input.file.size,
        uploadedBy: input.userId,
      });
    } catch (error) {
      await this.releaseAssetUploadReservation(reservationId, input.userId);
      if (storageKey) {
        try {
          await this.storage.delete(storageKey);
        } catch (cleanupError) {
          this.logger.error(
            `Uploaded asset cleanup failed after DB failure (${storageKey}).`,
            cleanupError instanceof Error ? cleanupError.stack : String(cleanupError),
          );
        }
      }
      throw error;
    }

    await this.auditLogService?.record({
      action: "asset.upload",
      actorUserId: input.audit?.actorUserId ?? input.userId,
      ipAddress: input.audit?.ipAddress ?? null,
      payload: {
        extension: fileExtension(input.file.originalname),
        mimeType: input.file.mimetype,
        operation: "multipart",
        sizeBytes: input.file.size,
      },
      targetId: asset.assetId,
      targetType: "asset",
    });

    return {
      assetId: asset.assetId,
      originalFilename: input.file.originalname,
      mimeType: input.file.mimetype,
      sizeBytes: input.file.size,
      storageKey: toAssetReference(asset.assetId),
    };
  }

  async prepareDirectUpload(input: {
    originalFilename: string;
    mimeType: string;
    sizeBytes: number;
    userId: string;
    audit?: AuditMetadata;
  }): Promise<AssetDirectUploadPrepareResponse> {
    if (
      this.configService.get<string>("ASSET_STORAGE_PROVIDER") !== "s3" ||
      !this.storage.createPresignedUpload
    ) {
      throw new ConflictException("asset_direct_upload_unavailable");
    }

    const uploadExpiresAt = msToDate(nowMs() + DIRECT_UPLOAD_EXPIRES_MS);
    const reservationId = await this.reserveAssetUpload(input.userId, input.sizeBytes, uploadExpiresAt);
    let preparation: AssetDirectUploadPrepareResponse;
    let storageKey: string | null = null;
    let asset: { assetId: string };
    try {
      preparation = await this.storage.createPresignedUpload({
        contentType: input.mimeType,
        originalName: input.originalFilename,
        sizeBytes: input.sizeBytes,
      });
      storageKey = preparation.storageKey;

      asset = await this.assetRepository.createAssetFromReservation({
        reservationId,
        storageKey: preparation.storageKey,
        originalFilename: input.originalFilename,
        mimeType: input.mimeType,
        sizeBytes: input.sizeBytes,
        uploadedBy: input.userId,
        uploadStatus: "PENDING",
        uploadExpiresAt,
      });
    } catch (error) {
      await this.releaseAssetUploadReservation(reservationId, input.userId);
      if (storageKey) {
        try {
          await this.storage.delete(storageKey);
        } catch (cleanupError) {
          this.logger.error(
            `Presigned asset cleanup failed after DB failure (${storageKey}).`,
            cleanupError instanceof Error ? cleanupError.stack : String(cleanupError),
          );
        }
      }
      throw error;
    }

    await this.auditLogService?.record({
      action: "asset.upload.prepare",
      actorUserId: input.audit?.actorUserId ?? input.userId,
      ipAddress: input.audit?.ipAddress ?? null,
      payload: {
        extension: fileExtension(input.originalFilename),
        mimeType: input.mimeType,
        operation: "direct",
        sizeBytes: input.sizeBytes,
      },
      targetId: asset.assetId,
      targetType: "asset",
    });

    return preparation;
  }

  async completeDirectUpload(input: {
    storageKey: string;
    userId: string;
    audit?: AuditMetadata;
  }): Promise<AssetUploadResponse> {
    if (
      this.configService.get<string>("ASSET_STORAGE_PROVIDER") !== "s3" ||
      !this.storage.verifyUpload
    ) {
      throw new ConflictException("asset_direct_upload_unavailable");
    }

    const asset = await this.assetRepository.findOwnedAssetByStorageKey(
      input.storageKey,
      input.userId,
    );
    if (!asset) {
      throw new NotFoundException("asset_upload_not_found");
    }
    if (asset.uploadStatus !== "PENDING") {
      throw new ConflictException("asset_upload_already_completed");
    }
    if (asset.uploadExpiresAt && asset.uploadExpiresAt.valueOf() <= nowMs()) {
      throw new BadRequestException("asset_upload_expired");
    }

    let uploadedObject: Awaited<ReturnType<NonNullable<AssetStorageProvider["verifyUpload"]>>>;
    try {
      uploadedObject = await this.storage.verifyUpload(input.storageKey);
    } catch {
      throw new BadRequestException("asset_upload_incomplete");
    }

    if (uploadedObject.sizeBytes !== asset.sizeBytes) {
      throw new BadRequestException("asset_upload_size_mismatch");
    }
    if (
      uploadedObject.contentType &&
      uploadedObject.contentType.toLowerCase() !== asset.mimeType.toLowerCase()
    ) {
      throw new BadRequestException("asset_upload_mime_mismatch");
    }

    const completed = await this.assetRepository.completeDirectUpload(
      asset.assetId,
      input.userId,
    );
    if (!completed) {
      throw new ConflictException("asset_upload_expired");
    }

    const result = {
      assetId: asset.assetId,
      originalFilename: asset.originalFilename,
      mimeType: asset.mimeType,
      sizeBytes: asset.sizeBytes,
      storageKey: toAssetReference(asset.assetId),
    };
    await this.auditLogService?.record({
      action: "asset.upload.complete",
      actorUserId: input.audit?.actorUserId ?? input.userId,
      ipAddress: input.audit?.ipAddress ?? null,
      payload: {
        mimeType: result.mimeType,
        operation: "direct",
        sizeBytes: result.sizeBytes,
      },
      targetId: result.assetId,
      targetType: "asset",
    });
    return result;
  }

  async migrateLocalAssets(limit: number, audit?: AuditMetadata): Promise<{
    scanned: number;
    migrated: number;
    failed: number;
  }> {
    if (
      this.configService.get<string>("ASSET_STORAGE_PROVIDER") !== "s3" ||
      !this.storage.migrateLocalObject
    ) {
      throw new ConflictException("asset_s3_provider_not_configured");
    }

    const candidates = await this.assetRepository.findLocalAssets(limit);
    let migrated = 0;
    let failed = 0;

    for (const candidate of candidates) {
      try {
        const storageKey = await this.storage.migrateLocalObject({
          storageKey: candidate.storageKey,
          originalName: candidate.originalFilename,
          contentType: candidate.mimeType,
        });
        await this.assetRepository.updateStorageKey(
          candidate.assetId,
          storageKey,
        );
        migrated += 1;
      } catch (error) {
        failed += 1;
        this.logger.warn(
          `Asset migration failed for ${candidate.assetId}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }

    const result = { scanned: candidates.length, migrated, failed };
    await this.auditLogService?.record({
      action: "asset.migrate",
      actorUserId: audit?.actorUserId ?? null,
      ipAddress: audit?.ipAddress ?? null,
      payload: { ...result, source: "local" },
      targetType: "asset",
    });
    return result;
  }

  async getFile(
    assetId: string,
    currentUser: CurrentUserContext,
    audit?: AuditMetadata,
    streaming = false,
  ): Promise<{
    buffer?: Buffer;
    stream?: Readable;
    inline: boolean;
    mimeType: string;
    originalFilename: string;
    sizeBytes: number;
  }> {
    const asset = await this.assetRepository.findAssetWithLinks(assetId);
    if (!asset) {
      throw new NotFoundException("asset_not_found");
    }
    if (asset.uploadStatus && asset.uploadStatus !== "COMPLETED") {
      throw new NotFoundException("asset_not_found");
    }

    let readableUsageTypes: string[] = [];

    if (asset.links.length === 0) {
      if (asset.publicContentImage) {
        readableUsageTypes = ["IMAGE"];
      } else if (
        asset.surveyAnswerFile &&
        currentUser.user &&
        Permissions.has(currentUser.user.permission, Permissions.MANAGE_SURVEY)
      ) {
        readableUsageTypes = ["ATTACHMENT"];
      } else if (!currentUser.user || currentUser.user.id !== asset.uploadedBy) {
        throw new NotFoundException("asset_not_found");
      }
    } else {
      for (const link of asset.links) {
        const board = await this.boardRepository.findByCode(link.boardCode);
        if (!board || !board.isActive) {
          continue;
        }

        const readableScopes = getReadableArticleScopes(
          currentUser,
          board.allowGuestRead,
        );
        if (readableScopes.length === 0) continue;

        const articleReadable = await this.articleRepository.isReadableArticle(
          board.boardId,
          link.articleId,
          readableScopes,
          currentUser.user?.id,
          false,
          canReadSecretArticles(currentUser),
        );

        if (articleReadable) {
          readableUsageTypes.push(link.usageType);
        }
      }

      if (readableUsageTypes.length === 0) {
        throw new NotFoundException("asset_not_found");
      }
    }

    let buffer: Buffer | undefined;
    let stream: Readable | undefined;
    try {
      if (streaming) {
        if (!this.storage.readStream) throw new Error("asset_stream_unavailable");
        stream = await this.storage.readStream(asset.storageKey);
      } else {
        if (asset.sizeBytes > MAX_BUFFERED_ASSET_BYTES) {
          throw new BadRequestException("asset_buffer_limit_exceeded");
        }
        buffer = await this.storage.read(asset.storageKey);
      }
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      throw new NotFoundException("asset_not_found");
    }

    if (
      asset.surveyAnswerFile &&
      currentUser.user &&
      Permissions.has(currentUser.user.permission, Permissions.MANAGE_SURVEY)
    ) {
      await this.auditLogService?.record({
        action: "survey.answer_file.download",
        actorUserId: currentUser.user.id,
        ipAddress: audit?.ipAddress ?? null,
        targetId: asset.assetId,
        targetType: "survey_answer_file",
        payload: {
          filename: asset.originalFilename,
          mimeType: asset.mimeType,
        },
      });
    }

    const isImage = asset.mimeType.startsWith("image/");
    const inline =
      isImage &&
      (asset.publicContentImage || asset.links.length === 0 ||
        readableUsageTypes.some(
          (usageType) => usageType === "IMAGE" || usageType === "THUMBNAIL",
        ));

    return {
      buffer,
      stream,
      inline,
      mimeType: asset.mimeType,
      originalFilename: asset.originalFilename,
      sizeBytes: asset.sizeBytes,
    };
  }

  /**
   * Reads an asset that is still owned by the requesting user.
   *
   * This deliberately does not use article-link visibility. Admin mail
   * attachments are uploaded before they are attached to any article, so the
   * ownership check is the authorization boundary for this workflow.
   */
  async getOwnedFile(
    assetId: string,
    userId: string,
  ): Promise<{
    buffer: Buffer;
    mimeType: string;
    originalFilename: string;
    sizeBytes: number;
  }> {
    const asset = await this.assetRepository.findOwnedAssetDetails(assetId, userId);
    if (!asset) {
      throw new NotFoundException("asset_not_found");
    }
    if (asset.sizeBytes > MAX_BUFFERED_ASSET_BYTES) {
      throw new BadRequestException("asset_buffer_limit_exceeded");
    }

    try {
      return {
        buffer: await this.storage.read(asset.storageKey),
        mimeType: asset.mimeType,
        originalFilename: asset.originalFilename,
        sizeBytes: asset.sizeBytes,
      };
    } catch {
      throw new NotFoundException("asset_not_found");
    }
  }

  async cleanupUnlinkedAssets(audit?: AuditMetadata): Promise<{
    scanned: number;
    deleted: number;
    failed: number;
    olderThanHours: number;
  }> {
    const cleanupLease = await this.assetRepository.tryAcquireCleanupLease(
      "orphan-assets",
      10 * 60 * 1_000,
    );
    if (!cleanupLease) {
      this.logger.log("Skipped asset orphan cleanup because another runner owns the DB lease.");
      return {
        scanned: 0,
        deleted: 0,
        failed: 0,
        olderThanHours: this.configService.get<number>(
          "ASSET_ORPHAN_GRACE_HOURS",
          24,
        ),
      };
    }

    try {
      const olderThanHours = this.configService.get<number>(
        "ASSET_ORPHAN_GRACE_HOURS",
        24,
      );
      const cutoff = isoToDate(msToIso(nowMs() - olderThanHours * 60 * 60 * 1000));
      await this.assetRepository.releaseExpiredAssetUploadReservations();
      const candidates = await this.assetRepository.findUnlinkedAssetsBefore(
        cutoff,
        100,
      );
      let failed = 0;
      let deleted = 0;

      for (const candidate of candidates) {
        try {
          // Delete the DB row under the same reference predicate and row lock
          // before touching storage. A concurrent reference either commits
          // first (so this returns null) or is rejected by the asset fence.
          const deletable = await this.assetRepository.deleteUnlinkedAsset(candidate.assetId);
          if (!deletable) continue;
          await this.storage.delete(deletable.storageKey);
          deleted += 1;
        } catch {
          failed += 1;
        }
      }

      const result = {
        scanned: candidates.length,
        deleted,
        failed,
        olderThanHours,
      };
      await this.auditLogService?.record({
        action: "asset.cleanup",
        actorUserId: audit?.actorUserId ?? null,
        ipAddress: audit?.ipAddress ?? null,
        payload: { ...result, source: audit ? "admin" : "scheduler" },
        targetType: "asset",
      });
      return result;
    } finally {
      try {
        await this.assetRepository.releaseCleanupLease("orphan-assets", cleanupLease);
      } catch (error) {
        this.logger.error(
          "Asset orphan cleanup lease release failed.",
          error instanceof Error ? error.stack : String(error),
        );
      }
    }
  }

  private async runScheduledCleanup() {
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
    }
  }

  private async reserveAssetUpload(
    userId: string,
    incomingBytes: number,
    expiresAt = msToDate(nowMs() + DIRECT_UPLOAD_EXPIRES_MS),
  ): Promise<string> {
    const maxCount = this.configService.get<number>(
      "ASSET_USER_MAX_COUNT",
      DEFAULT_ASSET_USER_MAX_COUNT,
    );
    const maxBytes = this.configService.get<number>(
      "ASSET_USER_MAX_BYTES",
      DEFAULT_ASSET_USER_MAX_BYTES,
    );
    try {
      return await this.assetRepository.reserveAssetUpload({
        uploadedBy: userId,
        sizeBytes: incomingBytes,
        maxCount,
        maxBytes,
        expiresAt,
      });
    } catch (error) {
      if (error instanceof Error && error.message === "asset_quota_exceeded") {
        throw new BadRequestException("asset_quota_exceeded");
      }
      throw error;
    }
  }

  private async releaseAssetUploadReservation(
    reservationId: string,
    userId: string,
  ): Promise<void> {
    try {
      await this.assetRepository.releaseAssetUploadReservation(reservationId, userId);
    } catch (releaseError) {
      this.logger.error(
        `Asset upload reservation release failed (${reservationId}).`,
        releaseError instanceof Error ? releaseError.stack : String(releaseError),
      );
    }
  }
}

function fileExtension(filename: string): string | null {
  const match = filename.trim().match(/\.([a-z0-9]{1,12})$/i);
  return match?.[1]?.toLowerCase() ?? null;
}
