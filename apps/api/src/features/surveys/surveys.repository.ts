import { Inject, Injectable } from "@nestjs/common";
import { and, eq, isNull, sql } from "drizzle-orm";
import { isoToDate, msToIso, nowDate } from "@soc/shared";

import {
  DRIZZLE_DB,
  PostgresDatabase,
} from "../../infrastructure/postgres/postgres.provider";
import { surveys, surveyResponses } from "../../infrastructure/postgres/postgres.schema";

import type { SurveyRecord } from "./entities/survey.entity";
import type { CreateSurveyDto } from "./dto/create-survey.dto";
import type { UpdateSurveyDto } from "./dto/update-survey.dto";

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
      creatorId: row.creatorId ? String(row.creatorId) : null,
      publishedAt: null,
      connectedPostId: row.connectedArticleId ? String(row.connectedArticleId) : null,
      feePayersOnly: row.feeRequirementPolicy === "PAID_ONLY",
      allowMultipleResponses: row.allowMultipleResponses,
      allowResponseEdit: row.allowResponseEdit,
      isKoreanOnly: row.isKoreanOnly,
      isPublished: row.isPublished,
      showOnCalendar: row.showOnCalendar,
      maxResponses: row.maxResponseCount,
      isAlwaysOpen: row.isAlwaysOpen,
      opensAt: row.openAt ? msToIso(row.openAt.valueOf()) : null,
      closesAt: row.closeAt ? msToIso(row.closeAt.valueOf()) : null,
      createdAt: msToIso(row.createdAt.valueOf()),
      updatedAt: msToIso(row.updatedAt.valueOf()),
    };
  }

  async findAll(): Promise<SurveyRecord[]> {
    const rows = await this.db
      .select({
        survey: surveys,
        responseCount: sql<number>`COALESCE((SELECT COUNT(*)::int FROM ${surveyResponses} WHERE ${surveyResponses.surveyId} = ${surveys.surveyId} AND ${surveyResponses.status} != 'draft'), 0)`
      })
      .from(surveys);
    return rows.map((r) => ({
      ...this.map(r.survey),
      responseCount: r.responseCount,
    }));
  }

  async findById(id: string): Promise<SurveyRecord | null> {
    const row = await this.db.query.surveys.findFirst({
      where: eq(surveys.surveyId, id),
    });
    if (!row) return null;
    const mapped = this.map(row);
    const countResult = await this.db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(surveyResponses)
      .where(and(eq(surveyResponses.surveyId, id), sql`${surveyResponses.status} != 'draft'`));
    mapped.responseCount = countResult[0]?.count ?? 0;
    return mapped;
  }

  async insert(creatorId: string, dto: CreateSurveyDto): Promise<SurveyRecord> {
    const [row] = await this.db
      .insert(surveys)
      .values({
        creatorId: creatorId,
        kind: dto.kind,
        titleKo: dto.titleKo,
        titleEn: dto.titleEn,
        descriptionKo: dto.descriptionKo ?? null,
        descriptionEn: dto.descriptionEn ?? null,
        feeRequirementPolicy: dto.feeRequirementPolicy ?? "NONE",
        allowMultipleResponses: dto.allowMultipleResponses ?? false,
        allowResponseEdit: dto.allowResponseEdit ?? false,
        isKoreanOnly: dto.isKoreanOnly ?? false,
        isPublished: dto.isPublished ?? false,
        showOnCalendar: dto.showOnCalendar ?? false,
        resultVisibility: dto.resultVisibility,
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
  ): Promise<SurveyRecord | null> {
    const set: Partial<typeof surveys.$inferInsert> & { updatedAt: Date } = {
      updatedAt: nowDate(),
    };

    if (dto.kind !== undefined) set.kind = dto.kind;
    if (dto.titleKo !== undefined) set.titleKo = dto.titleKo;
    if (dto.titleEn !== undefined) set.titleEn = dto.titleEn;
    if (dto.descriptionKo !== undefined) set.descriptionKo = dto.descriptionKo;
    if (dto.descriptionEn !== undefined) set.descriptionEn = dto.descriptionEn;
    if (dto.feeRequirementPolicy !== undefined) {
      set.feeRequirementPolicy = dto.feeRequirementPolicy;
    }
    if (dto.allowMultipleResponses !== undefined) set.allowMultipleResponses = dto.allowMultipleResponses;
    if (dto.allowResponseEdit !== undefined) set.allowResponseEdit = dto.allowResponseEdit;
    if (dto.isKoreanOnly !== undefined) set.isKoreanOnly = dto.isKoreanOnly;
    if (dto.isPublished !== undefined) set.isPublished = dto.isPublished;
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

    const [row] = await this.db
      .update(surveys)
      .set(set)
      .where(eq(surveys.surveyId, id))
      .returning();
    return row ? this.map(row) : null;
  }

  async delete(id: string): Promise<void> {
    await this.db.delete(surveys).where(eq(surveys.surveyId, id));
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
        responseCount: sql<number>`COALESCE((SELECT COUNT(*)::int FROM ${surveyResponses} WHERE ${surveyResponses.surveyId} = ${surveys.surveyId} AND ${surveyResponses.status} != 'draft'), 0)`
      })
      .from(surveys)
      .where(
        and(eq(surveys.isPublished, true), isNull(surveys.connectedArticleId)),
      );
    return rows.map((r) => ({
      ...this.map(r.survey),
      responseCount: r.responseCount,
    }));
  }
}
