import { Inject, Injectable } from "@nestjs/common";
import { eq, sql } from "drizzle-orm";
import { isoToDate, nowDate } from "@soc/shared";

import {
  DRIZZLE_DB,
  PostgresDatabase,
} from "../../infrastructure/postgres/postgres.provider";
import { surveys } from "../../infrastructure/postgres/postgres.schema";

import type { SurveyRecord } from "./entities/survey.entity";
import type { CreateSurveyDto } from "./dto/create-survey.dto";
import type { UpdateSurveyDto } from "./dto/update-survey.dto";

@Injectable()
export class SurveysRepository {
  constructor(@Inject(DRIZZLE_DB) private readonly db: PostgresDatabase) {}

  private map(row: typeof surveys.$inferSelect): SurveyRecord {
    return {
      id: row.surveyId,
      titleKo: row.titleKo,
      titleEn: row.titleEn ?? "",
      descriptionKo: row.descriptionKo,
      descriptionEn: row.descriptionEn,
      creatorId: row.creatorId ? String(row.creatorId) : null,
      status: row.status.toLowerCase() as SurveyRecord["status"],
      publishedAt: null,
      connectedPostId: row.connectedArticleId ? String(row.connectedArticleId) : null,
      feePayersOnly: row.feeRequirementPolicy === "PAID_ONLY",
      allowAnonymous: row.allowGuestResponse,
      maxResponses: row.maxResponseCount,
      opensAt: row.openAt ? row.openAt.toISOString() : null,
      closesAt: row.closeAt ? row.closeAt.toISOString() : null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async findAll(): Promise<SurveyRecord[]> {
    const rows = await this.db.query.surveys.findMany();
    return rows.map((r) => this.map(r));
  }

  async findById(id: string): Promise<SurveyRecord | null> {
    const row = await this.db.query.surveys.findFirst({
      where: eq(surveys.surveyId, id),
    });
    return row ? this.map(row) : null;
  }

  async insert(creatorId: string, dto: CreateSurveyDto): Promise<SurveyRecord> {
    const [row] = await this.db
      .insert(surveys)
      .values({
        creatorId: Number(creatorId),
        kind: "SURVEY",
        titleKo: dto.titleKo,
        titleEn: dto.titleEn,
        descriptionKo: dto.descriptionKo ?? null,
        descriptionEn: dto.descriptionEn ?? null,
        status: "DRAFT",
        feeRequirementPolicy: dto.feePayersOnly ? "PAID_ONLY" : "NONE",
        allowGuestResponse: dto.allowAnonymous ?? false,
        resultVisibility: "PUBLIC",
        maxResponseCount: dto.maxResponses ?? null,
        openAt: dto.opensAt ? isoToDate(dto.opensAt) : null,
        closeAt: dto.closesAt ? isoToDate(dto.closesAt) : null,
        connectedArticleId: dto.connectedPostId ? Number(dto.connectedPostId) : null,
        updatedAt: nowDate(),
      })
      .returning();
    return this.map(row);
  }

  async update(
    id: string,
    dto: UpdateSurveyDto,
    publishedAt?: string,
  ): Promise<SurveyRecord | null> {
    const set: Partial<typeof surveys.$inferInsert> & { updatedAt: Date } = {
      updatedAt: nowDate(),
    };

    if (dto.titleKo !== undefined) set.titleKo = dto.titleKo;
    if (dto.titleEn !== undefined) set.titleEn = dto.titleEn;
    if (dto.descriptionKo !== undefined) set.descriptionKo = dto.descriptionKo;
    if (dto.descriptionEn !== undefined) set.descriptionEn = dto.descriptionEn;
    if (dto.status !== undefined) set.status = dto.status.toUpperCase();
    if (dto.feePayersOnly !== undefined) {
      set.feeRequirementPolicy = dto.feePayersOnly ? "PAID_ONLY" : "NONE";
    }
    if (dto.allowAnonymous !== undefined) set.allowGuestResponse = dto.allowAnonymous;
    if (dto.maxResponses !== undefined) set.maxResponseCount = dto.maxResponses;
    if (dto.opensAt !== undefined) set.openAt = isoToDate(dto.opensAt);
    if (dto.closesAt !== undefined) set.closeAt = isoToDate(dto.closesAt);
    if (dto.connectedPostId !== undefined) {
      set.connectedArticleId = dto.connectedPostId ? Number(dto.connectedPostId) : null;
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
}
