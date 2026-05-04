import { Inject, Injectable } from "@nestjs/common";
import { and, eq } from "drizzle-orm";

import {
  DRIZZLE_DB,
  PostgresDatabase,
} from "../../infrastructure/postgres/postgres.provider";
import { surveyQuestions } from "../../infrastructure/postgres/postgres.schema";

import type { SurveyQuestionRecord } from "./entities/survey-question.entity";
import type { CreateQuestionDto } from "./dto/create-question.dto";
import type { UpdateQuestionDto } from "./dto/update-question.dto";
import type { QuestionType, QuestionOption } from "@soc/contracts";

@Injectable()
export class SurveyQuestionsRepository {
  constructor(@Inject(DRIZZLE_DB) private readonly db: PostgresDatabase) {}

  private map(row: typeof surveyQuestions.$inferSelect): SurveyQuestionRecord {
    return {
      id: row.id,
      sectionId: row.sectionId,
      titleKo: row.titleKo,
      titleEn: row.titleEn,
      descriptionKo: row.descriptionKo,
      descriptionEn: row.descriptionEn,
      questionType: row.questionType as QuestionType,
      options: row.options as QuestionOption[] | null,
      answerRegex: row.answerRegex,
      isRequired: row.isRequired,
      editDeadlineAt: row.editDeadlineAt ? row.editDeadlineAt.toISOString() : null,
      sortOrder: row.sortOrder,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async findBySectionId(sectionId: string): Promise<SurveyQuestionRecord[]> {
    const rows = await this.db.query.surveyQuestions.findMany({
      where: eq(surveyQuestions.sectionId, sectionId),
    });
    return rows.map((r) => this.map(r));
  }

  async findById(id: string, sectionId: string): Promise<SurveyQuestionRecord | null> {
    const row = await this.db.query.surveyQuestions.findFirst({
      where: and(eq(surveyQuestions.id, id), eq(surveyQuestions.sectionId, sectionId)),
    });
    return row ? this.map(row) : null;
  }

  async insert(sectionId: string, dto: CreateQuestionDto): Promise<SurveyQuestionRecord> {
    const [row] = await this.db
      .insert(surveyQuestions)
      .values({
        sectionId,
        titleKo: dto.titleKo,
        titleEn: dto.titleEn ?? null,
        descriptionKo: dto.descriptionKo ?? null,
        descriptionEn: dto.descriptionEn ?? null,
        questionType: dto.questionType,
        options: dto.options ?? null,
        answerRegex: dto.answerRegex ?? null,
        isRequired: dto.isRequired ?? true,
        editDeadlineAt: dto.editDeadlineAt ? new Date(dto.editDeadlineAt) : null,
        sortOrder: dto.sortOrder ?? 0,
      })
      .returning();
    return this.map(row);
  }

  async update(
    id: string,
    sectionId: string,
    dto: UpdateQuestionDto,
  ): Promise<SurveyQuestionRecord | null> {
    const set: Partial<typeof surveyQuestions.$inferInsert> & { updatedAt: Date } = {
      updatedAt: new Date(),
    };

    if (dto.titleKo !== undefined) set.titleKo = dto.titleKo;
    if (dto.titleEn !== undefined) set.titleEn = dto.titleEn;
    if (dto.descriptionKo !== undefined) set.descriptionKo = dto.descriptionKo;
    if (dto.descriptionEn !== undefined) set.descriptionEn = dto.descriptionEn;
    if (dto.questionType !== undefined) set.questionType = dto.questionType;
    if (dto.options !== undefined) set.options = dto.options;
    if (dto.answerRegex !== undefined) set.answerRegex = dto.answerRegex;
    if (dto.isRequired !== undefined) set.isRequired = dto.isRequired;
    if (dto.editDeadlineAt !== undefined) set.editDeadlineAt = new Date(dto.editDeadlineAt);
    if (dto.sortOrder !== undefined) set.sortOrder = dto.sortOrder;

    const [row] = await this.db
      .update(surveyQuestions)
      .set(set)
      .where(and(eq(surveyQuestions.id, id), eq(surveyQuestions.sectionId, sectionId)))
      .returning();
    return row ? this.map(row) : null;
  }

  async delete(id: string, sectionId: string): Promise<void> {
    await this.db
      .delete(surveyQuestions)
      .where(and(eq(surveyQuestions.id, id), eq(surveyQuestions.sectionId, sectionId)));
  }
}
