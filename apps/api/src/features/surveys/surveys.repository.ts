import { Inject, Injectable } from "@nestjs/common";
import { eq, sql } from "drizzle-orm";
import { isoToDate, msToIso, nowDate } from "@soc/shared";

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
      opensAt: row.openAt ? msToIso(row.openAt.valueOf()) : null,
      closesAt: row.closeAt ? msToIso(row.closeAt.valueOf()) : null,
      createdAt: msToIso(row.createdAt.valueOf()),
      updatedAt: msToIso(row.updatedAt.valueOf()),
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
        creatorId: creatorId,
        kind: dto.kind,
        titleKo: dto.titleKo,
        titleEn: dto.titleEn,
        descriptionKo: dto.descriptionKo ?? null,
        descriptionEn: dto.descriptionEn ?? null,
        status: "DRAFT",
        feeRequirementPolicy: dto.feeRequirementPolicy ?? "NONE",
        allowGuestResponse: dto.allowGuestResponse ?? false,
        resultVisibility: dto.resultVisibility,
        maxResponseCount: dto.maxResponseCount ?? null,
        openAt: dto.openAt ? isoToDate(dto.openAt) : null,
        closeAt: dto.closeAt ? isoToDate(dto.closeAt) : null,
        connectedArticleId: dto.connectedArticleId ? Number(dto.connectedArticleId) : null,
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

    if (dto.kind !== undefined) set.kind = dto.kind;
    if (dto.titleKo !== undefined) set.titleKo = dto.titleKo;
    if (dto.titleEn !== undefined) set.titleEn = dto.titleEn;
    if (dto.descriptionKo !== undefined) set.descriptionKo = dto.descriptionKo;
    if (dto.descriptionEn !== undefined) set.descriptionEn = dto.descriptionEn;
    if (dto.status !== undefined) set.status = dto.status.toUpperCase();
    if (dto.feeRequirementPolicy !== undefined) {
      set.feeRequirementPolicy = dto.feeRequirementPolicy;
    }
    if (dto.allowGuestResponse !== undefined) set.allowGuestResponse = dto.allowGuestResponse;
    if (dto.resultVisibility !== undefined) set.resultVisibility = dto.resultVisibility;
    if (dto.maxResponseCount !== undefined) set.maxResponseCount = dto.maxResponseCount;
    if (dto.openAt !== undefined) set.openAt = dto.openAt ? isoToDate(dto.openAt) : null;
    if (dto.closeAt !== undefined) set.closeAt = dto.closeAt ? isoToDate(dto.closeAt) : null;
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
}
