import { Inject, Injectable } from "@nestjs/common";
import { and, eq } from "drizzle-orm";
import { msToIso, nowDate } from "@soc/shared";

import {
  DRIZZLE_DB,
  PostgresDatabase,
  PostgresTransaction,
} from "../../infrastructure/postgres/postgres.provider";
import { surveySections } from "../../infrastructure/postgres/postgres.schema";

import type { SurveySectionRecord } from "./entities/survey-section.entity";
import type { CreateSectionDto } from "./dto/create-section.dto";
import type { UpdateSectionDto } from "./dto/update-section.dto";

@Injectable()
export class SurveySectionsRepository {
  constructor(@Inject(DRIZZLE_DB) private readonly db: PostgresDatabase) {}

  private map(row: typeof surveySections.$inferSelect): SurveySectionRecord {
    return {
      id: row.id,
      surveyId: row.surveyId,
      titleKo: row.titleKo,
      titleEn: row.titleEn,
      descriptionKo: row.descriptionKo,
      descriptionEn: row.descriptionEn,
      sortOrder: row.sortOrder,
      createdAt: msToIso(row.createdAt.valueOf()),
      updatedAt: msToIso(row.updatedAt.valueOf()),
    };
  }

  async findBySurveyId(
    surveyId: string,
    tx?: PostgresTransaction,
  ): Promise<SurveySectionRecord[]> {
    const db = tx ?? this.db;
    const rows = await db.query.surveySections.findMany({
      where: eq(surveySections.surveyId, surveyId),
    });
    return rows.map((r) => this.map(r));
  }

  async findById(
    id: string,
    surveyId: string,
    tx?: PostgresTransaction,
  ): Promise<SurveySectionRecord | null> {
    const db = tx ?? this.db;
    const row = await db.query.surveySections.findFirst({
      where: and(eq(surveySections.id, id), eq(surveySections.surveyId, surveyId)),
    });
    return row ? this.map(row) : null;
  }

  async insert(
    surveyId: string,
    dto: CreateSectionDto,
    tx?: PostgresTransaction,
  ): Promise<SurveySectionRecord> {
    const db = tx ?? this.db;
    const [row] = await db
      .insert(surveySections)
      .values({
        surveyId,
        titleKo: dto.titleKo,
        titleEn: dto.titleEn ?? null,
        descriptionKo: dto.descriptionKo ?? null,
        descriptionEn: dto.descriptionEn ?? null,
        sortOrder: dto.sortOrder ?? 0,
      })
      .returning();
    return this.map(row);
  }

  async update(
    id: string,
    surveyId: string,
    dto: UpdateSectionDto,
    tx?: PostgresTransaction,
  ): Promise<SurveySectionRecord | null> {
    const set: Partial<typeof surveySections.$inferInsert> & { updatedAt: Date } = {
      updatedAt: nowDate(),
    };

    if (dto.titleKo !== undefined) set.titleKo = dto.titleKo;
    if (dto.titleEn !== undefined) set.titleEn = dto.titleEn;
    if (dto.descriptionKo !== undefined) set.descriptionKo = dto.descriptionKo;
    if (dto.descriptionEn !== undefined) set.descriptionEn = dto.descriptionEn;
    if (dto.sortOrder !== undefined) set.sortOrder = dto.sortOrder;

    const db = tx ?? this.db;
    const [row] = await db
      .update(surveySections)
      .set(set)
      .where(and(eq(surveySections.id, id), eq(surveySections.surveyId, surveyId)))
      .returning();
    return row ? this.map(row) : null;
  }

  async delete(
    id: string,
    surveyId: string,
    tx?: PostgresTransaction,
  ): Promise<void> {
    const db = tx ?? this.db;
    await db
      .delete(surveySections)
      .where(and(eq(surveySections.id, id), eq(surveySections.surveyId, surveyId)));
  }
}
