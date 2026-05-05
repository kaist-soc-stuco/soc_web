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
      id: row.id,
      titleKo: row.titleKo,
      titleEn: row.titleEn,
      descriptionKo: row.descriptionKo,
      descriptionEn: row.descriptionEn,
      creatorId: row.creatorId,
      status: row.status as SurveyRecord["status"],
      publishedAt: row.publishedAt ? row.publishedAt.toISOString() : null,
      connectedPostId: row.connectedPostId,
      feePayersOnly: row.feePayersOnly,
      allowAnonymous: row.allowAnonymous,
      maxResponses: row.maxResponses,
      opensAt: row.opensAt ? row.opensAt.toISOString() : null,
      closesAt: row.closesAt ? row.closesAt.toISOString() : null,
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
      where: eq(surveys.id, id),
    });
    return row ? this.map(row) : null;
  }

  async insert(creatorId: string, dto: CreateSurveyDto): Promise<SurveyRecord> {
    const [row] = await this.db
      .insert(surveys)
      .values({
        titleKo: dto.titleKo,
        titleEn: dto.titleEn,
        descriptionKo: dto.descriptionKo ?? null,
        descriptionEn: dto.descriptionEn ?? null,
        creatorId,
        feePayersOnly: dto.feePayersOnly ?? false,
        allowAnonymous: dto.allowAnonymous ?? false,
        maxResponses: dto.maxResponses ?? null,
        opensAt: dto.opensAt ? isoToDate(dto.opensAt) : null,
        closesAt: dto.closesAt ? isoToDate(dto.closesAt) : null,
        connectedPostId: dto.connectedPostId ?? null,
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
    if (dto.status !== undefined) set.status = dto.status;
    if (dto.feePayersOnly !== undefined) set.feePayersOnly = dto.feePayersOnly;
    if (dto.allowAnonymous !== undefined) set.allowAnonymous = dto.allowAnonymous;
    if (dto.maxResponses !== undefined) set.maxResponses = dto.maxResponses;
    if (dto.opensAt !== undefined) set.opensAt = isoToDate(dto.opensAt);
    if (dto.closesAt !== undefined) set.closesAt = isoToDate(dto.closesAt);
    if (dto.connectedPostId !== undefined) set.connectedPostId = dto.connectedPostId;
    if (publishedAt !== undefined) set.publishedAt = isoToDate(publishedAt);

    const [row] = await this.db
      .update(surveys)
      .set(set)
      .where(eq(surveys.id, id))
      .returning();
    return row ? this.map(row) : null;
  }

  async delete(id: string): Promise<void> {
    await this.db.delete(surveys).where(eq(surveys.id, id));
  }

  async countPublished(surveyId: string): Promise<number> {
    const result = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(surveys)
      .where(eq(surveys.id, surveyId));
    return result[0]?.count ?? 0;
  }
}
