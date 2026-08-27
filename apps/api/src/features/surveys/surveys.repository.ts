import { Inject, Injectable } from "@nestjs/common";
import { and, eq, sql } from "drizzle-orm";
import { isoToDate, msToIso, nowDate } from "@soc/shared";

import {
  DRIZZLE_DB,
  PostgresDatabase,
  PostgresTransaction,
} from "../../infrastructure/postgres/postgres.provider";
import { surveys, surveyResponses } from "../../infrastructure/postgres/postgres.schema";

import type { SurveyRecord } from "./entities/survey.entity";
import type { CreateSurveyDto } from "./dto/create-survey.dto";
import type { UpdateSurveyDto } from "./dto/update-survey.dto";
import { sanitizeSurveyRichText } from "./survey-rich-text";

interface SurveyVersionLineage {
  previousVersionId: string;
  versionNumber: number;
}

@Injectable()
export class SurveysRepository {
  constructor(@Inject(DRIZZLE_DB) private readonly db: PostgresDatabase) {}

  private map(row: typeof surveys.$inferSelect): SurveyRecord {
    return {
      id: row.surveyId,
      kind: row.kind,
      resultVisibility: row.resultVisibility,
      titleKo: row.titleKo,
      titleEn: row.titleEn,
      descriptionKo: row.descriptionKo,
      descriptionEn: row.descriptionEn,
      descriptionImageUrlKo: row.descriptionImageUrlKo,
      descriptionImageUrlEn: row.descriptionImageUrlEn,
      creatorId: row.creatorId ? String(row.creatorId) : null,
      publishedAt: null,
      connectedPostId: row.connectedArticleId ? String(row.connectedArticleId) : null,
      feePayersOnly: row.feeRequirementPolicy === "PAID_ONLY",
      eligibleSocAffiliations: row.eligibleSocAffiliations,
      academicEligibility: row.academicEligibility as SurveyRecord["academicEligibility"],
      allowAnonymous: row.allowAnonymous,
      allowMultipleResponses: row.allowMultipleResponses,
      allowResponseEdit: row.allowResponseEdit,
      isKoreanOnly: row.isKoreanOnly,
      isPublished: row.isPublished,
      lifecycleStatus: row.lifecycleStatus as SurveyRecord["lifecycleStatus"],
      previousVersionId: row.previousVersionId,
      versionNumber: row.versionNumber,
      derivedVersionCount: 0,
      showOnCalendar: row.showOnCalendar,
      maxResponses: row.maxResponseCount,
      isAlwaysOpen: row.isAlwaysOpen,
      opensAt: row.openAt ? msToIso(row.openAt.valueOf()) : null,
      closesAt: row.closeAt ? msToIso(row.closeAt.valueOf()) : null,
      createdAt: msToIso(row.createdAt.valueOf()),
      updatedAt: msToIso(row.updatedAt.valueOf()),
      spreadsheetId: row.spreadsheetId,
      spreadsheetUrl: row.spreadsheetUrl,
      spreadsheetSyncStatus: row.spreadsheetSyncStatus as SurveyRecord["spreadsheetSyncStatus"],
      spreadsheetLastSyncedAt: row.spreadsheetLastSyncedAt
        ? msToIso(row.spreadsheetLastSyncedAt.valueOf())
        : null,
    };
  }

  async findAll(): Promise<SurveyRecord[]> {
    const rows = await this.db
      .select({
        survey: surveys,
        responseCount: sql<number>`COALESCE((SELECT COUNT(*)::int FROM ${surveyResponses} WHERE ${surveyResponses.surveyId} = ${surveys.surveyId} AND ${surveyResponses.status} != 'draft'), 0)`,
        derivedVersionCount: sql<number>`COALESCE((SELECT COUNT(*)::int FROM "survey" AS child WHERE child."previous_version_id" = ${surveys.surveyId}), 0)`,
      })
      .from(surveys);
    return rows.map((r) => ({
      ...this.map(r.survey),
      responseCount: r.responseCount,
      derivedVersionCount: r.derivedVersionCount,
    }));
  }

  async findById(
    id: string,
    tx?: PostgresTransaction,
  ): Promise<SurveyRecord | null> {
    const db = tx ?? this.db;
    const row = await db.query.surveys.findFirst({
      where: eq(surveys.surveyId, id),
    });
    if (!row) return null;
    const mapped = this.map(row);
    const countResult = await db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(surveyResponses)
      .where(and(eq(surveyResponses.surveyId, id), sql`${surveyResponses.status} != 'draft'`));
    mapped.responseCount = countResult[0]?.count ?? 0;
    const derivedVersionResult = await db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(surveys)
      .where(eq(surveys.previousVersionId, id));
    mapped.derivedVersionCount = derivedVersionResult[0]?.count ?? 0;
    return mapped;
  }

  async insert(
    creatorId: string,
    dto: CreateSurveyDto,
    tx?: PostgresTransaction,
    lineage?: SurveyVersionLineage,
  ): Promise<SurveyRecord> {
    const db = tx ?? this.db;
    const [row] = await db
      .insert(surveys)
      .values({
        creatorId: creatorId,
        kind: dto.kind,
        titleKo: dto.titleKo,
        titleEn: dto.titleEn,
        descriptionKo: sanitizeSurveyRichText(dto.descriptionKo),
        descriptionEn: sanitizeSurveyRichText(dto.descriptionEn),
        descriptionImageUrlKo: dto.descriptionImageUrlKo ?? null,
        descriptionImageUrlEn: dto.descriptionImageUrlEn ?? null,
        feeRequirementPolicy: dto.feeRequirementPolicy ?? "NONE",
        eligibleSocAffiliations: dto.eligibleSocAffiliations ?? [],
        academicEligibility: dto.academicEligibility ?? "ANY",
        allowAnonymous: dto.allowAnonymous ?? false,
        allowMultipleResponses: dto.allowMultipleResponses ?? false,
        allowResponseEdit: dto.allowResponseEdit ?? false,
        isKoreanOnly: dto.isKoreanOnly ?? false,
        isPublished: dto.isPublished ?? false,
        lifecycleStatus: dto.isPublished ? "PUBLISHED" : "DRAFT",
        previousVersionId: lineage?.previousVersionId ?? null,
        versionNumber: lineage?.versionNumber ?? 1,
        showOnCalendar: dto.showOnCalendar ?? false,
        resultVisibility: dto.resultVisibility ?? "PRIVATE",
        maxResponseCount: dto.maxResponseCount ?? null,
        isAlwaysOpen: dto.isAlwaysOpen ?? false,
        openAt: dto.isAlwaysOpen ? null : dto.openAt ? isoToDate(dto.openAt) : null,
        closeAt: dto.isAlwaysOpen ? null : dto.closeAt ? isoToDate(dto.closeAt) : null,
        connectedArticleId: dto.connectedArticleId ? Number(dto.connectedArticleId) : null,
        updatedAt: nowDate(),
      })
      .returning();
    return this.map(row);
  }

  async update(
    id: string,
    dto: UpdateSurveyDto,
    tx?: PostgresTransaction,
  ): Promise<SurveyRecord | null> {
    const set: Partial<typeof surveys.$inferInsert> & { updatedAt: Date } = {
      updatedAt: nowDate(),
    };

    if (dto.kind !== undefined) set.kind = dto.kind;
    if (dto.titleKo !== undefined) set.titleKo = dto.titleKo;
    if (dto.titleEn !== undefined) set.titleEn = dto.titleEn;
    if (dto.descriptionKo !== undefined) {
      set.descriptionKo = sanitizeSurveyRichText(dto.descriptionKo);
    }
    if (dto.descriptionEn !== undefined) {
      set.descriptionEn = sanitizeSurveyRichText(dto.descriptionEn);
    }
    if (dto.descriptionImageUrlKo !== undefined) set.descriptionImageUrlKo = dto.descriptionImageUrlKo;
    if (dto.descriptionImageUrlEn !== undefined) set.descriptionImageUrlEn = dto.descriptionImageUrlEn;
    if (dto.feeRequirementPolicy !== undefined) {
      set.feeRequirementPolicy = dto.feeRequirementPolicy;
    }
    if (dto.eligibleSocAffiliations !== undefined) {
      set.eligibleSocAffiliations = dto.eligibleSocAffiliations;
    }
    if (dto.academicEligibility !== undefined) {
      set.academicEligibility = dto.academicEligibility;
    }
    if (dto.allowAnonymous !== undefined) set.allowAnonymous = dto.allowAnonymous;
    if (dto.allowMultipleResponses !== undefined) set.allowMultipleResponses = dto.allowMultipleResponses;
    if (dto.allowResponseEdit !== undefined) set.allowResponseEdit = dto.allowResponseEdit;
    if (dto.isKoreanOnly !== undefined) set.isKoreanOnly = dto.isKoreanOnly;
    if (dto.isPublished !== undefined) {
      set.isPublished = dto.isPublished;
      set.lifecycleStatus = dto.isPublished ? "PUBLISHED" : "DRAFT";
    }
    if (dto.showOnCalendar !== undefined) set.showOnCalendar = dto.showOnCalendar;
    if (dto.resultVisibility !== undefined) set.resultVisibility = dto.resultVisibility;
    if (dto.maxResponseCount !== undefined) set.maxResponseCount = dto.maxResponseCount;
    if (dto.isAlwaysOpen !== undefined) {
      set.isAlwaysOpen = dto.isAlwaysOpen;
      if (dto.isAlwaysOpen) {
        set.openAt = null;
        set.closeAt = null;
      }
    }
    if (!dto.isAlwaysOpen) {
      if (dto.openAt !== undefined) set.openAt = dto.openAt ? isoToDate(dto.openAt) : null;
      if (dto.closeAt !== undefined) set.closeAt = dto.closeAt ? isoToDate(dto.closeAt) : null;
    }
    if (dto.connectedArticleId !== undefined) {
      set.connectedArticleId = dto.connectedArticleId ? Number(dto.connectedArticleId) : null;
    }

    const db = tx ?? this.db;
    const [row] = await db
      .update(surveys)
      .set(set)
      .where(eq(surveys.surveyId, id))
      .returning();
    return row ? this.map(row) : null;
  }

  async delete(id: string, tx?: PostgresTransaction): Promise<void> {
    const db = tx ?? this.db;
    await db
      .update(surveys)
      .set({ previousVersionId: null, updatedAt: nowDate() })
      .where(eq(surveys.previousVersionId, id));
    await db.delete(surveys).where(eq(surveys.surveyId, id));
  }

  async updateSpreadsheetConnection(
    id: string,
    input: {
      spreadsheetId: string | null;
      spreadsheetUrl: string | null;
      spreadsheetSyncStatus: "NOT_CONNECTED" | "CONNECTED" | "ERROR";
      spreadsheetLastSyncedAt?: Date | null;
    },
  ): Promise<SurveyRecord | null> {
    const [row] = await this.db
      .update(surveys)
      .set({
        spreadsheetId: input.spreadsheetId,
        spreadsheetUrl: input.spreadsheetUrl,
        spreadsheetSyncStatus: input.spreadsheetSyncStatus,
        spreadsheetLastSyncedAt: input.spreadsheetLastSyncedAt ?? null,
        updatedAt: nowDate(),
      })
      .where(eq(surveys.surveyId, id))
      .returning();
    return row ? this.map(row) : null;
  }

  async updateSpreadsheetSyncState(
    id: string,
    status: "CONNECTED" | "ERROR",
  ): Promise<void> {
    await this.db
      .update(surveys)
      .set({
        spreadsheetSyncStatus: status,
        spreadsheetLastSyncedAt: status === "CONNECTED" ? nowDate() : undefined,
        updatedAt: nowDate(),
      })
      .where(eq(surveys.surveyId, id));
  }

  async findByConnectedArticleId(
    articleId: string,
    tx?: PostgresTransaction,
  ): Promise<SurveyRecord | null> {
    const db = tx ?? this.db;
    const row = await db.query.surveys.findFirst({
      where: eq(surveys.connectedArticleId, Number(articleId)),
    });
    return row ? this.map(row) : null;
  }

  async countPublished(surveyId: string): Promise<number> {
    const result = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(surveys)
      .where(eq(surveys.surveyId, surveyId));
    return result[0]?.count ?? 0;
  }

  async findPublished(): Promise<SurveyRecord[]> {
    const rows = await this.db
      .select({
        survey: surveys,
        responseCount: sql<number>`COALESCE((SELECT COUNT(*)::int FROM ${surveyResponses} WHERE ${surveyResponses.surveyId} = ${surveys.surveyId} AND ${surveyResponses.status} != 'draft'), 0)`,
        derivedVersionCount: sql<number>`COALESCE((SELECT COUNT(*)::int FROM "survey" AS child WHERE child."previous_version_id" = ${surveys.surveyId}), 0)`,
      })
      .from(surveys)
      .where(eq(surveys.lifecycleStatus, "PUBLISHED"));
    return rows.map((r) => ({
      ...this.map(r.survey),
      responseCount: r.responseCount,
      derivedVersionCount: r.derivedVersionCount,
    }));
  }
}
