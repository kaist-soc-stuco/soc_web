import { Inject, Injectable } from "@nestjs/common";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { msToIso, nowDate } from "@soc/shared";

import {
  DRIZZLE_DB,
  PostgresDatabase,
} from "../../infrastructure/postgres/postgres.provider";
import {
  surveyAnswers,
  surveyQuestions,
  surveyResponses,
  surveySections,
  studentFeeStatus,
  surveys,
  users,
} from "../../infrastructure/postgres/postgres.schema";

import type { SurveyAnswerRecord } from "./entities/survey-answer.entity";
import type { SurveyQuestionRecord } from "./entities/survey-question.entity";
import type { SurveyResponseRecord } from "./entities/survey-response.entity";
import type { PostgresTransaction } from "../../infrastructure/postgres/postgres.provider";
import type { QuestionOption, QuestionType } from "@soc/contracts";
import { isSurveyAnswerEmpty, validateSurveyAnswers } from "./survey-answer-validation";
import {
  getReachableSurveyQuestions,
  type SurveySectionWithQuestions,
} from "./survey-branching";

type SurveyResponseQueryRow = {
  id: string;
  surveyId: string;
  userId: string | null;
  status: string;
  submittedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  userNameKo: string | null;
  userNameEn: string | null;
  userEmail: string | null;
  userPhoneNumber: string | null;
  userDepartmentKo: string | null;
  userStdNo: string | null;
  userPrimaryMajor: string | null;
  userDoubleMajor: string | null;
  userMinor: string | null;
  userAcademicStatus: string | null;
  userFeeStatus: string | null;
};

type InsertSubmissionResult =
  | {
      status: "created";
      response: SurveyResponseRecord;
      answers: SurveyAnswerRecord[];
    }
  | {
      status: "already_submitted";
    }
  | {
      status: "capacity_full";
    }
  | {
      status: "survey_not_found";
    }
  | {
      status: "survey_not_published";
    }
  | {
      status: "survey_not_open_yet";
    }
  | {
      status: "survey_closed";
    }
  | {
      status: "fee_payer_only";
    };

type UpdateSubmissionResult =
  | {
      status: "updated";
      response: SurveyResponseRecord;
      answers: SurveyAnswerRecord[];
    }
  | {
      status:
        | "survey_not_found"
        | "survey_not_published"
        | "survey_not_open_yet"
        | "survey_closed"
        | "fee_payer_only"
        | "response_edit_not_allowed"
        | "multiple_response_edit_not_supported"
        | "response_not_found";
    };

type SubmissionState = {
  isPublished: boolean;
  isAlwaysOpen: boolean;
  openAt: Date | null;
  closeAt: Date | null;
};

type SubmissionStateFailure =
  | "survey_not_published"
  | "survey_not_open_yet"
  | "survey_closed";

const getSubmissionStateFailure = (
  survey: SubmissionState,
  currentMs: number,
): SubmissionStateFailure | null => {
  if (!survey.isPublished) return "survey_not_published";
  if (survey.isAlwaysOpen) return null;
  if (survey.openAt && survey.openAt.valueOf() > currentMs) {
    return "survey_not_open_yet";
  }
  if (survey.closeAt && survey.closeAt.valueOf() <= currentMs) {
    return "survey_closed";
  }
  return null;
};

const SINGLE_RESPONSE_UNIQUE_CONSTRAINT =
  "survey_responses_single_response_user_unique_idx";

const isSingleResponseUniqueViolation = (error: unknown): boolean => {
  let current = error;

  while (current && typeof current === "object") {
    const candidate = current as {
      cause?: unknown;
      code?: unknown;
      constraint?: unknown;
    };
    if (
      candidate.code === "23505" &&
      candidate.constraint === SINGLE_RESPONSE_UNIQUE_CONSTRAINT
    ) {
      return true;
    }
    if (!candidate.cause || candidate.cause === current) break;
    current = candidate.cause;
  }

  return false;
};

@Injectable()
export class SurveyResponsesRepository {
  constructor(@Inject(DRIZZLE_DB) private readonly db: PostgresDatabase) {}

  private mapResponse(row: SurveyResponseQueryRow): SurveyResponseRecord {
    return {
      id: row.id,
      surveyId: row.surveyId,
      userId: row.userId,
      status: "submitted",
      submittedAt: row.submittedAt ? msToIso(row.submittedAt.valueOf()) : null,
      user: row.userId
        ? {
            nameKo: row.userNameKo,
            nameEn: row.userNameEn,
            email: row.userEmail,
            phoneNumber: row.userPhoneNumber,
            departmentKo: row.userDepartmentKo,
            stdNo: row.userStdNo,
            primaryMajor: row.userPrimaryMajor,
            doubleMajor: row.userDoubleMajor,
            minor: row.userMinor,
            academicStatus: row.userAcademicStatus,
            feeStatus:
              row.userFeeStatus === "PAID" ||
              row.userFeeStatus === "PARTIAL" ||
              row.userFeeStatus === "UNPAID"
                ? row.userFeeStatus
                : null,
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
    status: surveyResponses.status,
    submittedAt: surveyResponses.submittedAt,
    createdAt: surveyResponses.createdAt,
    updatedAt: surveyResponses.updatedAt,
    userNameKo: users.nameKo,
    userNameEn: users.nameEn,
    userEmail: users.email,
    userPhoneNumber: users.phoneNumber,
    userDepartmentKo: users.departmentKo,
    userStdNo: users.stdNo,
    userPrimaryMajor: users.primaryMajor,
    userDoubleMajor: users.doubleMajor,
    userMinor: users.minor,
    userAcademicStatus: users.academicStatus,
    userFeeStatus: sql<string | null>`(
      select ${studentFeeStatus.status}
      from ${studentFeeStatus}
      where ${studentFeeStatus.userId} = ${users.userId}
      limit 1
    )`,
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

  private mapQuestion(
    question: typeof surveyQuestions.$inferSelect,
  ): SurveyQuestionRecord {
    return {
      id: question.id,
      sectionId: question.sectionId,
      titleKo: question.titleKo,
      titleEn: question.titleEn,
      descriptionKo: question.descriptionKo,
      descriptionEn: question.descriptionEn,
      questionType: question.questionType as QuestionType,
      options: question.options as QuestionOption[] | null,
      config: question.config as import("@soc/contracts").SurveyQuestionConfig | null,
      answerRegex: question.answerRegex,
      isRequired: question.isRequired,
      sortOrder: question.sortOrder,
      createdAt: msToIso(question.createdAt.valueOf()),
      updatedAt: msToIso(question.updatedAt.valueOf()),
    };
  }

  private async findSurveySectionsForSurvey(
    tx: PostgresTransaction,
    surveyId: string,
  ): Promise<SurveySectionWithQuestions[]> {
    const [sectionRows, questionRows] = await Promise.all([
      tx
        .select({ section: surveySections })
        .from(surveySections)
        .where(eq(surveySections.surveyId, surveyId))
        .orderBy(asc(surveySections.sortOrder), asc(surveySections.id)),
      tx
        .select({ question: surveyQuestions })
        .from(surveyQuestions)
        .innerJoin(
          surveySections,
          eq(surveyQuestions.sectionId, surveySections.id),
        )
        .where(eq(surveySections.surveyId, surveyId))
        .orderBy(asc(surveyQuestions.sortOrder), asc(surveyQuestions.id)),
    ]);

    const questionsBySectionId = new Map<string, SurveyQuestionRecord[]>();
    for (const { question } of questionRows) {
      const questions = questionsBySectionId.get(question.sectionId) ?? [];
      questions.push(this.mapQuestion(question));
      questionsBySectionId.set(question.sectionId, questions);
    }

    return sectionRows.map(({ section }) => ({
      id: section.id,
      sortOrder: section.sortOrder,
      questions: questionsBySectionId.get(section.id) ?? [],
    }));
  }

  private async findReachableQuestionsForSurvey(
    tx: PostgresTransaction,
    surveyId: string,
    answers: Array<{ questionId: string; content: Record<string, unknown> }>,
  ): Promise<SurveyQuestionRecord[]> {
    const sections = await this.findSurveySectionsForSurvey(tx, surveyId);
    return getReachableSurveyQuestions(sections, answers);
  }

  private async satisfiesFeeRequirement(
    tx: PostgresTransaction,
    userId: string | null,
    feeRequirementPolicy: string,
  ): Promise<boolean> {
    if (feeRequirementPolicy !== "PAID_ONLY") return true;
    if (!userId) return false;

    const [feeStatus] = await tx
      .select({ status: studentFeeStatus.status })
      .from(studentFeeStatus)
      .where(eq(studentFeeStatus.userId, userId))
      .limit(1);
    return feeStatus?.status === "PAID";
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

  async findById(
    id: string,
    surveyId: string,
    tx?: PostgresTransaction,
  ): Promise<SurveyResponseRecord | null> {
    const db = tx ?? this.db;
    const rows = await db
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

  async insertSubmission(input: {
    surveyId: string;
    userId: string | null;
    answers: Array<{ questionId: string; content: Record<string, unknown> }>;
  }): Promise<InsertSubmissionResult> {
    const transactionResult = await this.db
      .transaction(async (tx) => {
        const [lockedSurvey] = await tx
          .select({
            isPublished: surveys.isPublished,
            isAlwaysOpen: surveys.isAlwaysOpen,
            openAt: surveys.openAt,
            closeAt: surveys.closeAt,
            feeRequirementPolicy: surveys.feeRequirementPolicy,
            allowMultipleResponses: surveys.allowMultipleResponses,
            maxResponseCount: surveys.maxResponseCount,
          })
          .from(surveys)
          .where(eq(surveys.surveyId, input.surveyId))
          .for("update");

        if (!lockedSurvey) {
          return { status: "survey_not_found" } as const;
        }

        // The public service performs an early check for fast feedback, but
        // this is the authoritative state check. It runs only after an
        // The state update that already owned the row lock has committed.
        const now = nowDate();
        const stateFailure = getSubmissionStateFailure(
          lockedSurvey,
          now.valueOf(),
        );
        if (stateFailure) {
          return { status: stateFailure } as const;
        }
        if (
          !(await this.satisfiesFeeRequirement(
            tx,
            input.userId,
            lockedSurvey.feeRequirementPolicy,
          ))
        ) {
          return { status: "fee_payer_only" } as const;
        }

        const questions = await this.findReachableQuestionsForSurvey(
          tx,
          input.surveyId,
          input.answers,
        );
        validateSurveyAnswers(questions, input.answers);
        const questionById = new Map(questions.map((question) => [question.id, question]));
        const persistedAnswers = input.answers.filter((answer) => {
          const question = questionById.get(answer.questionId);
          return question && !isSurveyAnswerEmpty(question, answer.content);
        });

        const singleResponseUserId = lockedSurvey.allowMultipleResponses || !input.userId
          ? null
          : input.userId;

        if (singleResponseUserId) {
          const [existingResponse] = await tx
            .select({ id: surveyResponses.id })
            .from(surveyResponses)
            .where(
              and(
                eq(surveyResponses.surveyId, input.surveyId),
                eq(surveyResponses.userId, singleResponseUserId),
              ),
            )
            .limit(1);

          if (existingResponse) {
            return { status: "already_submitted" } as const;
          }
        }

        if (lockedSurvey.maxResponseCount !== null) {
          const [responseCount] = await tx
            .select({ count: sql<number>`count(*)::int` })
            .from(surveyResponses)
            .where(
              and(
                eq(surveyResponses.surveyId, input.surveyId),
                eq(surveyResponses.status, "submitted"),
              ),
            );

          if ((responseCount?.count ?? 0) >= lockedSurvey.maxResponseCount) {
            return { status: "capacity_full" } as const;
          }
        }

        const [insertedResponse] = await tx
          .insert(surveyResponses)
          .values({
            surveyId: input.surveyId,
            userId: input.userId,
            singleResponseUserId,
            status: "submitted",
            createdAt: now,
            submittedAt: now,
            updatedAt: now,
          })
          .returning();

        if (persistedAnswers.length > 0) {
          await tx.insert(surveyAnswers).values(
            persistedAnswers.map((answer) => ({
              responseId: insertedResponse.id,
              questionId: answer.questionId,
              content: answer.content,
            })),
          );
        }

        const response = await this.findById(
          insertedResponse.id,
          insertedResponse.surveyId,
          tx,
        );
        const answers = await this.findAnswersByResponseId(
          insertedResponse.id,
          tx,
        );

        return {
          status: "created",
          response:
            response ??
            this.mapResponse({
              id: insertedResponse.id,
              surveyId: insertedResponse.surveyId,
              userId: insertedResponse.userId,
              status: insertedResponse.status,
              submittedAt: insertedResponse.submittedAt,
              createdAt: insertedResponse.createdAt,
              updatedAt: insertedResponse.updatedAt,
              userNameKo: null,
              userNameEn: null,
              userEmail: null,
              userPhoneNumber: null,
              userDepartmentKo: null,
              userStdNo: null,
              userPrimaryMajor: null,
              userDoubleMajor: null,
              userMinor: null,
              userAcademicStatus: null,
              userFeeStatus: null,
            }),
          answers,
        } as const;
      })
      .catch((error: unknown) => {
        if (isSingleResponseUniqueViolation(error)) {
          return { status: "already_submitted" } as const;
        }
        throw error;
      });

    return transactionResult;
  }

  async updateSubmission(input: {
    responseId: string;
    surveyId: string;
    userId: string;
    answers: Array<{ questionId: string; content: Record<string, unknown> }>;
  }): Promise<UpdateSubmissionResult> {
    const transactionResult = await this.db.transaction(async (tx) => {
      const [lockedSurvey] = await tx
        .select({
          isPublished: surveys.isPublished,
          isAlwaysOpen: surveys.isAlwaysOpen,
          openAt: surveys.openAt,
          closeAt: surveys.closeAt,
          feeRequirementPolicy: surveys.feeRequirementPolicy,
          allowResponseEdit: surveys.allowResponseEdit,
          allowMultipleResponses: surveys.allowMultipleResponses,
        })
        .from(surveys)
        .where(eq(surveys.surveyId, input.surveyId))
        .for("update");

      if (!lockedSurvey) {
        return { status: "survey_not_found" } as const;
      }

      const now = nowDate();
      const stateFailure = getSubmissionStateFailure(
        lockedSurvey,
        now.valueOf(),
      );
      if (stateFailure) {
        return { status: stateFailure } as const;
      }
      if (
        !(await this.satisfiesFeeRequirement(
          tx,
          input.userId,
          lockedSurvey.feeRequirementPolicy,
        ))
      ) {
        return { status: "fee_payer_only" } as const;
      }
      if (!lockedSurvey.allowResponseEdit) {
        return { status: "response_edit_not_allowed" } as const;
      }
      if (lockedSurvey.allowMultipleResponses) {
        return { status: "multiple_response_edit_not_supported" } as const;
      }

      const [existingResponse] = await tx
        .select({ id: surveyResponses.id })
        .from(surveyResponses)
        .where(
          and(
            eq(surveyResponses.id, input.responseId),
            eq(surveyResponses.surveyId, input.surveyId),
            eq(surveyResponses.userId, input.userId),
            eq(surveyResponses.status, "submitted"),
          ),
        )
        .limit(1);
      if (!existingResponse) {
        return { status: "response_not_found" } as const;
      }

      const questions = await this.findReachableQuestionsForSurvey(
        tx,
        input.surveyId,
        input.answers,
      );
      validateSurveyAnswers(questions, input.answers);
      const questionById = new Map(questions.map((question) => [question.id, question]));
      const persistedAnswers = input.answers.filter((answer) => {
        const question = questionById.get(answer.questionId);
        return question && !isSurveyAnswerEmpty(question, answer.content);
      });

      const [updatedResponse] = await tx
        .update(surveyResponses)
        .set({
          submittedAt: now,
          updatedAt: now,
        })
        .where(
          and(
            eq(surveyResponses.id, input.responseId),
            eq(surveyResponses.surveyId, input.surveyId),
          ),
        )
        .returning();

      await tx
        .delete(surveyAnswers)
        .where(eq(surveyAnswers.responseId, input.responseId));

      if (persistedAnswers.length > 0) {
        await tx.insert(surveyAnswers).values(
          persistedAnswers.map((answer) => ({
            responseId: input.responseId,
            questionId: answer.questionId,
            content: answer.content,
            submittedAt: now,
            updatedAt: now,
          })),
        );
      }

      const response = await this.findById(
        updatedResponse.id,
        updatedResponse.surveyId,
        tx,
      );
      const answers = await this.findAnswersByResponseId(
        updatedResponse.id,
        tx,
      );

      return {
        status: "updated",
        response:
          response ??
          this.mapResponse({
            id: updatedResponse.id,
            surveyId: updatedResponse.surveyId,
            userId: updatedResponse.userId,
            status: updatedResponse.status,
            submittedAt: updatedResponse.submittedAt,
            createdAt: updatedResponse.createdAt,
            updatedAt: updatedResponse.updatedAt,
            userNameKo: null,
            userNameEn: null,
            userEmail: null,
            userPhoneNumber: null,
            userDepartmentKo: null,
            userStdNo: null,
            userPrimaryMajor: null,
            userDoubleMajor: null,
            userMinor: null,
            userAcademicStatus: null,
            userFeeStatus: null,
          }),
        answers,
      } as const;
    });

    return transactionResult;
  }

  async findAnswersByResponseId(
    responseId: string,
    tx?: PostgresTransaction,
  ): Promise<SurveyAnswerRecord[]> {
    const db = tx ?? this.db;
    const rows = await db.query.surveyAnswers.findMany({
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
