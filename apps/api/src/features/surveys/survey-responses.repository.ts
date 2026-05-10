import { Inject, Injectable } from "@nestjs/common";
import { and, eq, sql } from "drizzle-orm";
import { msToIso, nowDate } from "@soc/shared";

import {
  DRIZZLE_DB,
  PostgresDatabase,
} from "../../infrastructure/postgres/postgres.provider";
import { surveyAnswers, surveyResponses } from "../../infrastructure/postgres/postgres.schema";

import type { SurveyAnswerRecord } from "./entities/survey-answer.entity";
import type { SurveyResponseRecord } from "./entities/survey-response.entity";
import type { ResponseStatus } from "@soc/contracts";

@Injectable()
export class SurveyResponsesRepository {
  constructor(@Inject(DRIZZLE_DB) private readonly db: PostgresDatabase) {}

  private mapResponse(row: typeof surveyResponses.$inferSelect): SurveyResponseRecord {
    return {
      id: row.id,
      surveyId: row.surveyId,
      userId: row.userId ? String(row.userId) : null,
      externalPhone: row.externalPhone,
      status: row.status as ResponseStatus,
      submittedAt: row.submittedAt ? msToIso(row.submittedAt.valueOf()) : null,
      reviewedAt: row.reviewedAt ? msToIso(row.reviewedAt.valueOf()) : null,
      reviewAdminId: row.reviewAdminId ? String(row.reviewAdminId) : null,
      reviewReason: row.reviewReason,
      createdAt: msToIso(row.createdAt.valueOf()),
      updatedAt: msToIso(row.updatedAt.valueOf()),
    };
  }

  private mapAnswer(row: typeof surveyAnswers.$inferSelect): SurveyAnswerRecord {
    return {
      id: row.id,
      responseId: row.responseId,
      questionId: row.questionId,
      content: row.content as Record<string, unknown>,
      submittedAt: msToIso(row.submittedAt.valueOf()),
      updatedAt: msToIso(row.updatedAt.valueOf()),
    };
  }

  async findBySurveyId(surveyId: string): Promise<SurveyResponseRecord[]> {
    const rows = await this.db.query.surveyResponses.findMany({
      where: eq(surveyResponses.surveyId, surveyId),
    });
    return rows.map((r) => this.mapResponse(r));
  }

  async findById(id: string, surveyId: string): Promise<SurveyResponseRecord | null> {
    const row = await this.db.query.surveyResponses.findFirst({
      where: and(eq(surveyResponses.id, id), eq(surveyResponses.surveyId, surveyId)),
    });
    return row ? this.mapResponse(row) : null;
  }

  async countSubmitted(surveyId: string): Promise<number> {
    const result = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(surveyResponses)
      .where(
        and(
          eq(surveyResponses.surveyId, surveyId),
          sql`${surveyResponses.status} != 'draft'`,
        ),
      );
    return result[0]?.count ?? 0;
  }

  async insertResponse(input: {
    surveyId: string;
    userId?: string;
    externalPhone?: string;
  }): Promise<SurveyResponseRecord> {
    const now = nowDate();
    const [row] = await this.db
      .insert(surveyResponses)
      .values({
        surveyId: input.surveyId,
        userId: input.userId,
        externalPhone: input.externalPhone ?? null,
        status: "submitted",
        createdAt: now,
        submittedAt: now,
        updatedAt: now,
      })
      .returning();
    return this.mapResponse(row);
  }

  async insertAnswers(
    responseId: string,
    answers: Array<{ questionId: string; content: Record<string, unknown> }>,
  ): Promise<SurveyAnswerRecord[]> {
    if (answers.length === 0) return [];
    const rows = await this.db
      .insert(surveyAnswers)
      .values(answers.map((a) => ({ responseId, questionId: a.questionId, content: a.content })))
      .returning();
    return rows.map((r) => this.mapAnswer(r));
  }

  async findAnswersByResponseId(responseId: string): Promise<SurveyAnswerRecord[]> {
    const rows = await this.db.query.surveyAnswers.findMany({
      where: eq(surveyAnswers.responseId, responseId),
    });
    return rows.map((r) => this.mapAnswer(r));
  }

  async updateReview(
    id: string,
    surveyId: string,
    reviewAdminId: string,
    status: "approved" | "rejected" | "waitlisted",
    reason?: string,
  ): Promise<SurveyResponseRecord | null> {
    const [row] = await this.db
      .update(surveyResponses)
      .set({
        status,
        reviewAdminId: Number(reviewAdminId),
        reviewReason: reason ?? null,
        reviewedAt: nowDate(),
        updatedAt: nowDate(),
      })
      .where(and(eq(surveyResponses.id, id), eq(surveyResponses.surveyId, surveyId)))
      .returning();
    return row ? this.mapResponse(row) : null;
  }
}
