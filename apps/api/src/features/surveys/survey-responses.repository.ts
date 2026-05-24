import { Inject, Injectable } from "@nestjs/common";
import { and, desc, eq, sql } from "drizzle-orm";
import { msToIso, nowDate } from "@soc/shared";

import {
  DRIZZLE_DB,
  PostgresDatabase,
} from "../../infrastructure/postgres/postgres.provider";
import { surveyAnswers, surveyResponses, users } from "../../infrastructure/postgres/postgres.schema";

import type { SurveyAnswerRecord } from "./entities/survey-answer.entity";
import type { SurveyResponseRecord } from "./entities/survey-response.entity";
import type { ResponseStatus } from "@soc/contracts";

type SurveyResponseQueryRow = {
  id: string;
  surveyId: string;
  userId: string | null;
  externalPhone: string | null;
  status: string;
  submittedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  userNameKo: string | null;
  userEmail: string | null;
  userDepartmentKo: string | null;
  userStdNo: string | null;
};

@Injectable()
export class SurveyResponsesRepository {
  constructor(@Inject(DRIZZLE_DB) private readonly db: PostgresDatabase) {}

  private mapResponse(row: SurveyResponseQueryRow): SurveyResponseRecord {
    return {
      id: row.id,
      surveyId: row.surveyId,
      userId: row.userId,
      externalPhone: row.externalPhone,
      status: row.status as ResponseStatus,
      submittedAt: row.submittedAt ? msToIso(row.submittedAt.valueOf()) : null,
      user: row.userId
        ? {
            nameKo: row.userNameKo,
            email: row.userEmail,
            departmentKo: row.userDepartmentKo,
            stdNo: row.userStdNo,
          }
        : null,
      createdAt: msToIso(row.createdAt.valueOf()),
      updatedAt: msToIso(row.updatedAt.valueOf()),
    };
  }

  private responseSelectFields = {
    id: surveyResponses.id,
    surveyId: surveyResponses.surveyId,
    userId: surveyResponses.userId,
    externalPhone: surveyResponses.externalPhone,
    status: surveyResponses.status,
    submittedAt: surveyResponses.submittedAt,
    createdAt: surveyResponses.createdAt,
    updatedAt: surveyResponses.updatedAt,
    userNameKo: users.nameKo,
    userEmail: users.email,
    userDepartmentKo: users.departmentKo,
    userStdNo: users.stdNo,
  };

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
    const rows = await this.db
      .select(this.responseSelectFields)
      .from(surveyResponses)
      .leftJoin(users, eq(surveyResponses.userId, users.userId))
      .where(eq(surveyResponses.surveyId, surveyId))
      .orderBy(desc(surveyResponses.submittedAt), desc(surveyResponses.createdAt));
    return rows.map((r) => this.mapResponse(r));
  }

  async findById(id: string, surveyId: string): Promise<SurveyResponseRecord | null> {
    const rows = await this.db
      .select(this.responseSelectFields)
      .from(surveyResponses)
      .leftJoin(users, eq(surveyResponses.userId, users.userId))
      .where(and(eq(surveyResponses.id, id), eq(surveyResponses.surveyId, surveyId)))
      .limit(1);
    return rows[0] ? this.mapResponse(rows[0]) : null;
  }

  async findByUserAndSurvey(surveyId: string, userId: string): Promise<SurveyResponseRecord | null> {
    const rows = await this.db
      .select(this.responseSelectFields)
      .from(surveyResponses)
      .leftJoin(users, eq(surveyResponses.userId, users.userId))
      .where(and(eq(surveyResponses.surveyId, surveyId), eq(surveyResponses.userId, userId)))
      .limit(1);
    return rows[0] ? this.mapResponse(rows[0]) : null;
  }

  async countSubmitted(surveyId: string): Promise<number> {
    const result = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(surveyResponses)
      .where(
        and(
          eq(surveyResponses.surveyId, surveyId),
          eq(surveyResponses.status, "submitted"),
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
    const inserted = await this.findById(row.id, row.surveyId);
    if (inserted) return inserted;
    return this.mapResponse({
      id: row.id,
      surveyId: row.surveyId,
      userId: row.userId,
      externalPhone: row.externalPhone,
      status: row.status,
      submittedAt: row.submittedAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      userNameKo: null,
      userEmail: null,
      userDepartmentKo: null,
      userStdNo: null,
    });
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

  async findAnswersBySurveyId(surveyId: string): Promise<SurveyAnswerRecord[]> {
    const rows = await this.db
      .select({
        id: surveyAnswers.id,
        responseId: surveyAnswers.responseId,
        questionId: surveyAnswers.questionId,
        content: surveyAnswers.content,
        submittedAt: surveyAnswers.submittedAt,
        updatedAt: surveyAnswers.updatedAt,
      })
      .from(surveyAnswers)
      .innerJoin(surveyResponses, eq(surveyAnswers.responseId, surveyResponses.id))
      .where(
        and(
          eq(surveyResponses.surveyId, surveyId),
          eq(surveyResponses.status, "submitted")
        )
      );
    return rows.map((r) => this.mapAnswer(r));
  }
}
