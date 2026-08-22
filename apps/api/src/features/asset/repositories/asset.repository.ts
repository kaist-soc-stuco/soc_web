import { Inject, Injectable } from "@nestjs/common";
import { and, asc, eq, inArray, isNull, lt, sql } from "drizzle-orm";

import {
  DRIZZLE_DB,
  PostgresDatabase,
} from "../../../infrastructure/postgres/postgres.provider";
import {
  articleAssets,
  articles,
  assets,
  boards,
} from "../../../infrastructure/postgres/postgres.schema";

@Injectable()
export class AssetRepository {
  constructor(@Inject(DRIZZLE_DB) private readonly db: PostgresDatabase) {}

  async createAsset(input: {
    storageKey: string;
    originalFilename: string;
    mimeType: string;
    sizeBytes: number;
    uploadedBy: string;
  }): Promise<{ assetId: string }> {
    const [created] = await this.db
      .insert(assets)
      .values({
        storageKey: input.storageKey,
        originalFilename: input.originalFilename,
        mimeType: input.mimeType,
        sizeBytes: input.sizeBytes,
        checksum: null,
        uploadedBy: input.uploadedBy,
      })
      .returning({ assetId: assets.assetId });

    return { assetId: String(created.assetId) };
  }

  async findAssetWithLinks(assetId: string): Promise<{
    assetId: string;
    storageKey: string;
    originalFilename: string;
    mimeType: string;
    sizeBytes: number;
    uploadedBy: string;
    links: Array<{
      articleId: string;
      boardCode: string;
      usageType: string;
    }>;
  } | null> {
    const [asset] = await this.db
      .select({
        assetId: assets.assetId,
        storageKey: assets.storageKey,
        originalFilename: assets.originalFilename,
        mimeType: assets.mimeType,
        sizeBytes: assets.sizeBytes,
        uploadedBy: assets.uploadedBy,
      })
      .from(assets)
      .where(eq(assets.assetId, Number(assetId)))
      .limit(1);

    if (!asset) {
      return null;
    }

    const links = await this.db
      .select({
        articleId: articleAssets.articleId,
        boardCode: boards.code,
        usageType: articleAssets.usageType,
      })
      .from(articleAssets)
      .innerJoin(articles, eq(articleAssets.articleId, articles.articleId))
      .innerJoin(boards, eq(articles.boardId, boards.boardId))
      .where(eq(articleAssets.assetId, Number(assetId)));

    return {
      assetId: String(asset.assetId),
      storageKey: asset.storageKey,
      originalFilename: asset.originalFilename,
      mimeType: asset.mimeType,
      sizeBytes: asset.sizeBytes,
      uploadedBy: String(asset.uploadedBy),
      links: links.map((link) => ({
        articleId: String(link.articleId),
        boardCode: link.boardCode,
        usageType: link.usageType,
      })),
    };
  }

  async findOwnedAssetByStorageKey(
    storageKey: string,
    uploadedBy: string,
  ): Promise<{
    assetId: string;
    storageKey: string;
    originalFilename: string;
    mimeType: string;
    sizeBytes: number;
  } | null> {
    const [asset] = await this.db
      .select({
        assetId: assets.assetId,
        storageKey: assets.storageKey,
        originalFilename: assets.originalFilename,
        mimeType: assets.mimeType,
        sizeBytes: assets.sizeBytes,
      })
      .from(assets)
      .where(
        and(eq(assets.storageKey, storageKey), eq(assets.uploadedBy, uploadedBy)),
      )
      .limit(1);

    return asset
      ? {
          assetId: String(asset.assetId),
          storageKey: asset.storageKey,
          originalFilename: asset.originalFilename,
          mimeType: asset.mimeType,
          sizeBytes: asset.sizeBytes,
        }
      : null;
  }

  async findOwnedAsset(
    assetId: string,
    uploadedBy: string,
  ): Promise<{ assetId: string; originalFilename: string } | null> {
    const [asset] = await this.db
      .select({ assetId: assets.assetId, originalFilename: assets.originalFilename })
      .from(assets)
      .where(
        and(
          eq(assets.assetId, Number(assetId)),
          eq(assets.uploadedBy, uploadedBy),
        ),
      )
      .limit(1);
    return asset
      ? { assetId: String(asset.assetId), originalFilename: asset.originalFilename }
      : null;
  }

  async findOwnedAssetDetails(
    assetId: string,
    uploadedBy: string,
  ): Promise<{
    assetId: string;
    storageKey: string;
    originalFilename: string;
    mimeType: string;
    sizeBytes: number;
  } | null> {
    const [asset] = await this.db
      .select({
        assetId: assets.assetId,
        storageKey: assets.storageKey,
        originalFilename: assets.originalFilename,
        mimeType: assets.mimeType,
        sizeBytes: assets.sizeBytes,
      })
      .from(assets)
      .where(
        and(
          eq(assets.assetId, Number(assetId)),
          eq(assets.uploadedBy, uploadedBy),
        ),
      )
      .limit(1);

    return asset
      ? {
          assetId: String(asset.assetId),
          storageKey: asset.storageKey,
          originalFilename: asset.originalFilename,
          mimeType: asset.mimeType,
          sizeBytes: asset.sizeBytes,
        }
      : null;
  }

  async findLocalAssets(limit: number): Promise<
    Array<{
      assetId: string;
      storageKey: string;
      originalFilename: string;
      mimeType: string;
    }>
  > {
    const rows = await this.db
      .select({
        assetId: assets.assetId,
        storageKey: assets.storageKey,
        originalFilename: assets.originalFilename,
        mimeType: assets.mimeType,
      })
      .from(assets)
      .where(sql`${assets.storageKey} NOT LIKE 's3://%'`)
      .orderBy(asc(assets.createdAt))
      .limit(limit);

    return rows.map((row) => ({
      assetId: String(row.assetId),
      storageKey: row.storageKey,
      originalFilename: row.originalFilename,
      mimeType: row.mimeType,
    }));
  }

  async updateStorageKey(assetId: string, storageKey: string): Promise<void> {
    await this.db
      .update(assets)
      .set({ storageKey })
      .where(eq(assets.assetId, Number(assetId)));
  }

  async findUnlinkedAssetsBefore(
    cutoff: Date,
    limit: number,
  ): Promise<Array<{ assetId: string; storageKey: string }>> {
    const rows = await this.db
      .select({
        assetId: assets.assetId,
        storageKey: assets.storageKey,
      })
      .from(assets)
      .leftJoin(articleAssets, eq(articleAssets.assetId, assets.assetId))
      .where(
        and(isNull(articleAssets.articleAssetId), lt(assets.createdAt, cutoff)),
      )
      .orderBy(asc(assets.createdAt))
      .limit(limit);

    return rows.map((row) => ({
      assetId: String(row.assetId),
      storageKey: row.storageKey,
    }));
  }

  async deleteAssetsByIds(assetIds: string[]): Promise<number> {
    if (assetIds.length === 0) {
      return 0;
    }

    const deleted = await this.db
      .delete(assets)
      .where(
        inArray(
          assets.assetId,
          assetIds.map((assetId) => Number(assetId)),
        ),
      )
      .returning({ assetId: assets.assetId });

    return deleted.length;
  }
}
