import { randomUUID } from "node:crypto";

import { Inject, Injectable } from "@nestjs/common";
import { and, asc, eq, gt, inArray, isNull, lt, lte, or, sql } from "drizzle-orm";

import {
  DRIZZLE_DB,
  PostgresDatabase,
  PostgresTransaction,
} from "../../../infrastructure/postgres/postgres.provider";
import {
  articleAssets,
  articles,
  assets,
  assetUploadReservations,
  boards,
  contentBlocks,
  executiveContacts,
  surveyAnswers,
  surveyQuestions,
  surveySections,
  surveys,
  assetCleanupLeases,
  users,
} from "../../../infrastructure/postgres/postgres.schema";
import { msToDate, nowDate, nowMs } from "@soc/shared";

@Injectable()
export class AssetRepository {
  constructor(@Inject(DRIZZLE_DB) private readonly db: PostgresDatabase) {}

  async createAsset(input: {
    storageKey: string;
    originalFilename: string;
    mimeType: string;
    sizeBytes: number;
    uploadedBy: string;
    publicContentImage?: boolean;
    uploadStatus?: "PENDING" | "COMPLETED";
    uploadExpiresAt?: Date | null;
  }): Promise<{ assetId: string }> {
    const [created] = await this.db
      .insert(assets)
      .values({
        storageKey: input.storageKey,
        originalFilename: input.originalFilename,
        mimeType: input.mimeType,
        sizeBytes: input.sizeBytes,
        checksum: null,
        uploadStatus: input.uploadStatus ?? "COMPLETED",
        uploadExpiresAt: input.uploadExpiresAt ?? null,
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
    publicContentImage: boolean;
    surveyAnswerFile: boolean;
    uploadStatus: "PENDING" | "COMPLETED";
    uploadExpiresAt: Date | null;
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
        uploadStatus: assets.uploadStatus,
        uploadExpiresAt: assets.uploadExpiresAt,
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

    const [publicContentImage] = await this.db
      .select({ contentBlockId: contentBlocks.contentBlockId })
      .from(contentBlocks)
      .where(and(
        or(
          eq(contentBlocks.imageUrl, `asset:${assetId}`),
          eq(contentBlocks.imageUrlEn, `asset:${assetId}`),
        ),
        eq(contentBlocks.status, "PUBLISHED"),
      ))
      .limit(1);

    const [publicContactAvatar] = await this.db
      .select({ contactId: executiveContacts.id })
      .from(executiveContacts)
      .where(eq(executiveContacts.avatarStorageKey, `asset:${assetId}`))
      .limit(1);

    const [surveyAnswerFile] = await this.db
      .select({ answerId: surveyAnswers.id })
      .from(surveyAnswers)
      .where(sql`
        ${surveyAnswers.content}->>'assetId' = ${assetId}
        OR (${surveyAnswers.content}->'assetIds') ? ${assetId}
      `)
      .limit(1);

    const assetReference = `asset:${assetId}`;
    const assetContentPath = `/assets/${assetId}/content`;
    const [publicSurveyImage] = await this.db
      .select({ surveyId: surveys.surveyId })
      .from(surveys)
      .leftJoin(surveySections, eq(surveySections.surveyId, surveys.surveyId))
      .leftJoin(surveyQuestions, eq(surveyQuestions.sectionId, surveySections.id))
      .where(and(
        eq(surveys.isPublished, true),
        or(
          eq(surveys.descriptionImageUrlKo, assetReference),
          eq(surveys.descriptionImageUrlEn, assetReference),
          sql`${surveys.descriptionKo}::text LIKE ${`%${assetContentPath}%`}`,
          sql`${surveys.descriptionEn}::text LIKE ${`%${assetContentPath}%`}`,
          sql`${surveySections.descriptionKo}::text LIKE ${`%${assetContentPath}%`}`,
          sql`${surveySections.descriptionEn}::text LIKE ${`%${assetContentPath}%`}`,
          sql`${surveyQuestions.options}::text LIKE ${`%${assetReference}%`}`,
          sql`${surveyQuestions.config}::text LIKE ${`%${assetReference}%`}`,
        ),
      ))
      .limit(1);

    return {
      assetId: String(asset.assetId),
      storageKey: asset.storageKey,
      originalFilename: asset.originalFilename,
      mimeType: asset.mimeType,
      sizeBytes: asset.sizeBytes,
      uploadedBy: String(asset.uploadedBy),
      uploadStatus: asset.uploadStatus === "PENDING" ? "PENDING" : "COMPLETED",
      uploadExpiresAt: asset.uploadExpiresAt,
      publicContentImage: Boolean(publicContentImage || publicContactAvatar || publicSurveyImage),
      surveyAnswerFile: Boolean(surveyAnswerFile),
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
    uploadStatus: "PENDING";
    uploadExpiresAt: Date | null;
  } | null> {
    const [asset] = await this.db
      .select({
        assetId: assets.assetId,
        storageKey: assets.storageKey,
        originalFilename: assets.originalFilename,
        mimeType: assets.mimeType,
        sizeBytes: assets.sizeBytes,
        uploadStatus: assets.uploadStatus,
        uploadExpiresAt: assets.uploadExpiresAt,
      })
      .from(assets)
      .where(
        and(
          eq(assets.storageKey, storageKey),
          eq(assets.uploadedBy, uploadedBy),
          eq(assets.uploadStatus, "PENDING"),
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
          uploadStatus: "PENDING",
          uploadExpiresAt: asset.uploadExpiresAt,
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
          eq(assets.uploadStatus, "COMPLETED"),
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
          eq(assets.uploadStatus, "COMPLETED"),
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

  /** Reserve quota before a storage provider or presigned upload is touched. */
  async reserveAssetUpload(input: {
    uploadedBy: string;
    sizeBytes: number;
    maxCount: number;
    maxBytes: number;
    expiresAt: Date;
  }): Promise<string> {
    return this.db.transaction(async (tx) => {
      const [owner] = await tx
        .select({ userId: users.userId })
        .from(users)
        .where(eq(users.userId, input.uploadedBy))
        .for("update");
      if (!owner) throw new Error("asset_owner_not_found");

      const now = nowDate();
      const [assetUsage] = await tx
        .select({
          count: sql<number>`count(*)`,
          bytes: sql<number>`coalesce(sum(${assets.sizeBytes}), 0)`,
        })
        .from(assets)
        .where(and(
          eq(assets.uploadedBy, input.uploadedBy),
          or(
            eq(assets.uploadStatus, "COMPLETED"),
            and(
              eq(assets.uploadStatus, "PENDING"),
              or(isNull(assets.uploadExpiresAt), gt(assets.uploadExpiresAt, now)),
            ),
          ),
        ));
      const [reservationUsage] = await tx
        .select({
          count: sql<number>`count(*)`,
          bytes: sql<number>`coalesce(sum(${assetUploadReservations.sizeBytes}), 0)`,
        })
        .from(assetUploadReservations)
        .where(and(
          eq(assetUploadReservations.uploadedBy, input.uploadedBy),
          gt(assetUploadReservations.expiresAt, now),
        ));

      const count = Number(assetUsage?.count ?? 0) + Number(reservationUsage?.count ?? 0);
      const bytes = Number(assetUsage?.bytes ?? 0) + Number(reservationUsage?.bytes ?? 0);
      if (count + 1 > input.maxCount || bytes + input.sizeBytes > input.maxBytes) {
        throw new Error("asset_quota_exceeded");
      }

      const [reservation] = await tx
        .insert(assetUploadReservations)
        .values({
          uploadedBy: input.uploadedBy,
          sizeBytes: input.sizeBytes,
          expiresAt: input.expiresAt,
        })
        .returning({ reservationId: assetUploadReservations.reservationId });
      return String(reservation.reservationId);
    });
  }

  /** Turn a reservation into the asset row in one transaction. */
  async createAssetFromReservation(input: {
    reservationId: string;
    storageKey: string;
    originalFilename: string;
    mimeType: string;
    sizeBytes: number;
    uploadedBy: string;
    uploadStatus?: "PENDING" | "COMPLETED";
    uploadExpiresAt?: Date | null;
  }): Promise<{ assetId: string }> {
    return this.db.transaction(async (tx) => {
      const [reservation] = await tx
        .select({
          uploadedBy: assetUploadReservations.uploadedBy,
          sizeBytes: assetUploadReservations.sizeBytes,
          expiresAt: assetUploadReservations.expiresAt,
        })
        .from(assetUploadReservations)
        .where(and(
          eq(assetUploadReservations.reservationId, input.reservationId),
          eq(assetUploadReservations.uploadedBy, input.uploadedBy),
        ))
        .for("update");
      if (
        !reservation ||
        reservation.expiresAt.valueOf() <= nowMs() ||
        reservation.sizeBytes !== input.sizeBytes
      ) {
        throw new Error("asset_upload_reservation_invalid");
      }

      const [created] = await tx
        .insert(assets)
        .values({
          storageKey: input.storageKey,
          originalFilename: input.originalFilename,
          mimeType: input.mimeType,
          sizeBytes: input.sizeBytes,
          checksum: null,
          uploadStatus: input.uploadStatus ?? "COMPLETED",
          uploadExpiresAt: input.uploadExpiresAt ?? null,
          uploadedBy: input.uploadedBy,
        })
        .returning({ assetId: assets.assetId });
      await tx
        .delete(assetUploadReservations)
        .where(eq(assetUploadReservations.reservationId, input.reservationId));
      return { assetId: String(created.assetId) };
    });
  }

  async releaseAssetUploadReservation(reservationId: string, uploadedBy: string): Promise<void> {
    await this.db
      .delete(assetUploadReservations)
      .where(and(
        eq(assetUploadReservations.reservationId, reservationId),
        eq(assetUploadReservations.uploadedBy, uploadedBy),
      ));
  }

  async releaseExpiredAssetUploadReservations(): Promise<number> {
    const deleted = await this.db
      .delete(assetUploadReservations)
      .where(lte(assetUploadReservations.expiresAt, nowDate()))
      .returning({ reservationId: assetUploadReservations.reservationId });
    return deleted.length;
  }

  /**
   * Survey definitions may reuse an asset only when the actor owns it or the
   * asset already has an explicit public reference.  A secret/private article
   * link alone never qualifies as a public reference.
   */
  async canUseAsSurveyReference(
    assetId: string,
    actorUserId: string,
    tx?: PostgresTransaction,
  ): Promise<boolean> {
    const db = tx ?? this.db;
    const [asset] = await db
      .select({ uploadedBy: assets.uploadedBy })
      .from(assets)
      .where(eq(assets.assetId, Number(assetId)))
      .for("update")
      .limit(1);

    if (!asset) return false;
    if (String(asset.uploadedBy) === actorUserId) return true;

    const [publicArticle] = await db
      .select({ articleAssetId: articleAssets.articleAssetId })
      .from(articleAssets)
      .innerJoin(articles, eq(articleAssets.articleId, articles.articleId))
      .where(and(
        eq(articleAssets.assetId, Number(assetId)),
        eq(articles.status, "PUBLISHED"),
        eq(articles.visibilityScope, "PUBLIC"),
        eq(articles.isSecret, false),
      ))
      .limit(1);

    if (publicArticle) return true;

    const assetReference = `asset:${assetId}`;
    const assetContentPath = `/assets/${assetId}/content`;
    const [publicContent] = await db
      .select({ contentBlockId: contentBlocks.contentBlockId })
      .from(contentBlocks)
      .where(and(
        eq(contentBlocks.status, "PUBLISHED"),
        or(
          eq(contentBlocks.imageUrl, assetReference),
          eq(contentBlocks.imageUrlEn, assetReference),
        ),
      ))
      .limit(1);

    if (publicContent) return true;

    const [publicSurvey] = await db
      .select({ surveyId: surveys.surveyId })
      .from(surveys)
      .where(and(
        eq(surveys.isPublished, true),
        or(
          eq(surveys.descriptionImageUrlKo, assetReference),
          eq(surveys.descriptionImageUrlEn, assetReference),
          sql`${surveys.descriptionKo}::text LIKE ${`%${assetContentPath}%`}`,
          sql`${surveys.descriptionEn}::text LIKE ${`%${assetContentPath}%`}`,
        ),
      ))
      .limit(1);

    return Boolean(publicSurvey);
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
    const assetContentPath = sql`'/assets/' || ${assets.assetId}::text || '/content'`;
    const rows = await this.db
      .select({
        assetId: assets.assetId,
        storageKey: assets.storageKey,
      })
      .from(assets)
      .leftJoin(articleAssets, eq(articleAssets.assetId, assets.assetId))
      .leftJoin(contentBlocks, or(
        eq(contentBlocks.imageUrl, sql`'asset:' || ${assets.assetId}::text`),
        eq(contentBlocks.imageUrlEn, sql`'asset:' || ${assets.assetId}::text`),
      ))
      .leftJoin(executiveContacts, eq(executiveContacts.avatarStorageKey, sql`'asset:' || ${assets.assetId}::text`))
      .leftJoin(surveyAnswers, sql`
        ${surveyAnswers.content}->>'assetId' = ${assets.assetId}::text
        OR (${surveyAnswers.content}->'assetIds') ? ${assets.assetId}::text
      `)
      .leftJoin(surveys, or(
        eq(surveys.descriptionImageUrlKo, sql`'asset:' || ${assets.assetId}::text`),
        eq(surveys.descriptionImageUrlEn, sql`'asset:' || ${assets.assetId}::text`),
        sql`${surveys.descriptionKo}::text LIKE ('%' || ${assetContentPath} || '%')`,
        sql`${surveys.descriptionEn}::text LIKE ('%' || ${assetContentPath} || '%')`,
        sql`EXISTS (
          SELECT 1
          FROM "survey_sections" AS section
          WHERE section."survey_id" = ${surveys.surveyId}
            AND (
              section."description_ko"::text LIKE ('%' || ${assetContentPath} || '%')
              OR section."description_en"::text LIKE ('%' || ${assetContentPath} || '%')
            )
        )`,
      ))
      .leftJoin(surveyQuestions, sql`
        ${surveyQuestions.options}::text LIKE ('%asset:' || ${assets.assetId}::text || '%')
        OR ${surveyQuestions.config}::text LIKE ('%asset:' || ${assets.assetId}::text || '%')
      `)
      .where(
        and(
          isNull(articleAssets.articleAssetId),
          isNull(contentBlocks.contentBlockId),
          isNull(executiveContacts.id),
          isNull(surveyAnswers.id),
          isNull(surveys.surveyId),
          isNull(surveyQuestions.id),
          or(
            lt(assets.createdAt, cutoff),
            and(
              eq(assets.uploadStatus, "PENDING"),
              lte(assets.uploadExpiresAt, nowDate()),
            ),
          ),
        ),
      )
      .orderBy(asc(assets.createdAt))
      .limit(limit);

    return rows.map((row) => ({
      assetId: String(row.assetId),
      storageKey: row.storageKey,
    }));
  }

  async completeDirectUpload(assetId: string, uploadedBy: string): Promise<boolean> {
    const updated = await this.db
      .update(assets)
      .set({ uploadStatus: "COMPLETED", uploadExpiresAt: null })
      .where(and(
        eq(assets.assetId, Number(assetId)),
        eq(assets.uploadedBy, uploadedBy),
        eq(assets.uploadStatus, "PENDING"),
        or(isNull(assets.uploadExpiresAt), gt(assets.uploadExpiresAt, nowDate())),
      ))
      .returning({ assetId: assets.assetId });
    return updated.length > 0;
  }

  async getUserAssetUsage(uploadedBy: string): Promise<{ count: number; bytes: number }> {
    const now = nowDate();
    const [usage] = await this.db
      .select({
        count: sql<number>`count(*)`,
        bytes: sql<number>`coalesce(sum(${assets.sizeBytes}), 0)`,
      })
      .from(assets)
      .where(and(
        eq(assets.uploadedBy, uploadedBy),
        or(
          eq(assets.uploadStatus, "COMPLETED"),
          and(
            eq(assets.uploadStatus, "PENDING"),
            or(isNull(assets.uploadExpiresAt), gt(assets.uploadExpiresAt, now)),
          ),
        ),
      ));
    const [reservations] = await this.db
      .select({
        count: sql<number>`count(*)`,
        bytes: sql<number>`coalesce(sum(${assetUploadReservations.sizeBytes}), 0)`,
      })
      .from(assetUploadReservations)
      .where(and(
        eq(assetUploadReservations.uploadedBy, uploadedBy),
        gt(assetUploadReservations.expiresAt, now),
      ));
    return {
      count: Number(usage?.count ?? 0) + Number(reservations?.count ?? 0),
      bytes: Number(usage?.bytes ?? 0) + Number(reservations?.bytes ?? 0),
    };
  }

  /** Re-check every supported reference immediately before a cleanup delete. */
  async isStillUnlinked(assetId: string): Promise<boolean> {
    const [row] = await this.db
      .select({ assetId: assets.assetId })
      .from(assets)
      .where(and(
        eq(assets.assetId, Number(assetId)),
        unlinkedAssetReferencesPredicate(),
      ))
      .limit(1);
    return Boolean(row);
  }

  /**
   * Atomically fences a cleanup candidate from new DB references. Storage is
   * deleted only after this transaction commits, so a later request cannot
   * authorize a reference to a row that cleanup already removed.
   */
  async deleteUnlinkedAsset(assetId: string): Promise<{ storageKey: string } | null> {
    return this.db.transaction(async (tx) => {
      // Lock the asset row before evaluating the reference predicate.  Every
      // supported reference writer follows the same lock order, so cleanup
      // cannot observe an unlinked row and then race a committed reference.
      const [candidate] = await tx
        .select({ storageKey: assets.storageKey })
        .from(assets)
        .where(eq(assets.assetId, Number(assetId)))
        .for("update")
        .limit(1);
      if (!candidate) return null;

      const [unlinked] = await tx
        .select({ assetId: assets.assetId })
        .from(assets)
        .where(and(
          eq(assets.assetId, Number(assetId)),
          unlinkedAssetReferencesPredicate(),
        ))
        .limit(1);
      if (!unlinked) return null;

      const [deleted] = await tx
        .delete(assets)
        .where(eq(assets.assetId, Number(assetId)))
        .returning({ storageKey: assets.storageKey });
      return deleted ? { storageKey: deleted.storageKey } : null;
    });
  }

  async tryAcquireCleanupLease(
    leaseName: string,
    leaseMs: number,
  ): Promise<string | null> {
    const ownerToken = randomUUID();
    const now = nowDate();
    const leaseUntil = msToDate(nowMs() + leaseMs);
    const [lease] = await this.db
      .insert(assetCleanupLeases)
      .values({ leaseName, ownerToken, leaseUntil, updatedAt: now })
      .onConflictDoUpdate({
        target: assetCleanupLeases.leaseName,
        set: { ownerToken, leaseUntil, updatedAt: now },
        where: lte(assetCleanupLeases.leaseUntil, now),
      })
      .returning({ ownerToken: assetCleanupLeases.ownerToken });
    return lease?.ownerToken === ownerToken ? ownerToken : null;
  }

  async releaseCleanupLease(leaseName: string, ownerToken: string): Promise<void> {
    await this.db
      .update(assetCleanupLeases)
      .set({ leaseUntil: msToDate(0), updatedAt: nowDate() })
      .where(and(
        eq(assetCleanupLeases.leaseName, leaseName),
        eq(assetCleanupLeases.ownerToken, ownerToken),
      ));
  }

  async deleteAssetsByIds(assetIds: string[]): Promise<number> {
    if (assetIds.length === 0) {
      return 0;
    }

    return this.db.transaction(async (tx) => {
      const candidates = await tx
        .select({ assetId: assets.assetId })
        .from(assets)
        .where(inArray(assets.assetId, assetIds.map((assetId) => Number(assetId))))
        .for("update");
      let deletedCount = 0;
      for (const candidate of candidates) {
        const deleted = await tx
          .delete(assets)
          .where(and(
            eq(assets.assetId, candidate.assetId),
            unlinkedAssetReferencesPredicate(),
          ))
          .returning({ assetId: assets.assetId });
        deletedCount += deleted.length;
      }
      return deletedCount;
    });
  }
}

function unlinkedAssetReferencesPredicate() {
  const assetReference = sql`'asset:' || ${assets.assetId}::text`;
  const assetContentPath = sql`'/assets/' || ${assets.assetId}::text || '/content'`;

  return sql`
    NOT EXISTS (
      SELECT 1 FROM "article_asset" aa
      WHERE aa."asset_id" = ${assets.assetId}
    )
    AND NOT EXISTS (
      SELECT 1 FROM "content_block" cb
      WHERE cb."image_url" = ${assetReference}
         OR cb."image_url_en" = ${assetReference}
    )
    AND NOT EXISTS (
      SELECT 1 FROM "executive_contact" ec
      WHERE ec."avatar_storage_key" = ${assetReference}
    )
    AND NOT EXISTS (
      SELECT 1 FROM "survey_answers" sa
      WHERE sa."content"->>'assetId' = ${assets.assetId}::text
         OR (sa."content"->'assetIds') ? ${assets.assetId}::text
    )
    AND NOT EXISTS (
      SELECT 1 FROM "survey" s
      WHERE s."description_image_url_ko" = ${assetReference}
         OR s."description_image_url_en" = ${assetReference}
         OR s."description_ko"::text LIKE ('%' || ${assetContentPath} || '%')
         OR s."description_en"::text LIKE ('%' || ${assetContentPath} || '%')
         OR EXISTS (
           SELECT 1 FROM "survey_sections" ss
           WHERE ss."survey_id" = s."survey_id"
             AND (
               ss."description_ko"::text LIKE ('%' || ${assetContentPath} || '%')
               OR ss."description_en"::text LIKE ('%' || ${assetContentPath} || '%')
             )
         )
         OR EXISTS (
           SELECT 1
           FROM "survey_questions" sq
           INNER JOIN "survey_sections" sqs ON sqs."id" = sq."section_id"
           WHERE sqs."survey_id" = s."survey_id"
             AND (
               sq."options"::text LIKE ('%' || ${assetReference} || '%')
               OR sq."config"::text LIKE ('%' || ${assetReference} || '%')
             )
         )
    )
  `;
}
