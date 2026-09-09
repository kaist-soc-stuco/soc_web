import { Inject, Injectable } from "@nestjs/common";
import { and, asc, desc, eq } from "drizzle-orm";
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
import type { ReorderSurveySectionsRequest } from "@soc/contracts";
import { sanitizeSurveyRichText } from "./survey-rich-text";

const MAX_SURVEY_SECTIONS = 200;

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
      nextSectionId: row.nextSectionId,
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
    const rows = await db
      .select()
      .from(surveySections)
      .where(eq(surveySections.surveyId, surveyId))
      .orderBy(
        asc(surveySections.sortOrder),
        asc(surveySections.createdAt),
        asc(surveySections.id),
      )
      .limit(MAX_SURVEY_SECTIONS + 1);
    if (rows.length > MAX_SURVEY_SECTIONS) {
      throw new Error("survey_section_limit_exceeded");
    }
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
    const [lastSection] = await db
      .select({ sortOrder: surveySections.sortOrder })
      .from(surveySections)
      .where(eq(surveySections.surveyId, surveyId))
      .orderBy(desc(surveySections.sortOrder))
      .limit(1);
    const sortOrder = dto.sortOrder ?? (lastSection?.sortOrder ?? -1) + 1;
    const [row] = await db
      .insert(surveySections)
      .values({
        surveyId,
        titleKo: dto.titleKo,
        titleEn: dto.titleEn ?? null,
        descriptionKo: sanitizeSurveyRichText(dto.descriptionKo),
        descriptionEn: sanitizeSurveyRichText(dto.descriptionEn),
        nextSectionId: dto.nextSectionId ?? null,
        sortOrder,
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
    if (dto.descriptionKo !== undefined) {
      set.descriptionKo = sanitizeSurveyRichText(dto.descriptionKo);
    }
    if (dto.descriptionEn !== undefined) {
      set.descriptionEn = sanitizeSurveyRichText(dto.descriptionEn);
    }
    if (dto.nextSectionId !== undefined) set.nextSectionId = dto.nextSectionId;
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

  async reorder(
    surveyId: string,
    items: ReorderSurveySectionsRequest["items"],
    tx?: PostgresTransaction,
  ): Promise<SurveySectionRecord[]> {
    const db = tx ?? this.db;
    const updatedAt = nowDate();
    for (const item of items) {
      await db
        .update(surveySections)
        .set({ sortOrder: item.sortOrder, updatedAt })
        .where(and(eq(surveySections.id, item.id), eq(surveySections.surveyId, surveyId)));
    }
    return this.findBySurveyId(surveyId, tx);
  }
}
