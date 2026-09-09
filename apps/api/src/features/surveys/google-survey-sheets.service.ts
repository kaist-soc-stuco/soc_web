import { Injectable, Logger, NotFoundException, OnModuleInit, Optional } from "@nestjs/common";

import { GoogleSheetsClient } from "../../infrastructure/google/google-sheets.client";
import {
  GOOGLE_SHEET_RESOURCE,
  GoogleSpreadsheetSyncQueueService,
  type GoogleSpreadsheetSyncJobContext,
} from "../../infrastructure/google/google-spreadsheet-sync-queue.service";
import { SurveysRepository } from "./surveys.repository";
import { SurveySectionsRepository } from "./survey-sections.repository";
import { SurveyQuestionsRepository } from "./survey-questions.repository";
import { SurveyResponsesRepository } from "./survey-responses.repository";
import type { SurveyAnswerRecord } from "./entities/survey-answer.entity";
import type { SurveyQuestionRecord } from "./entities/survey-question.entity";
import { AuditLogService } from "../audit/audit-log.service";

const SHEET_TITLE = "응답";

@Injectable()
export class GoogleSurveySheetsService implements OnModuleInit {
  private readonly logger = new Logger(GoogleSurveySheetsService.name);

  constructor(
    private readonly sheets: GoogleSheetsClient,
    private readonly surveysRepo: SurveysRepository,
    private readonly sectionsRepo: SurveySectionsRepository,
    private readonly questionsRepo: SurveyQuestionsRepository,
    private readonly responsesRepo: SurveyResponsesRepository,
    private readonly syncQueue: GoogleSpreadsheetSyncQueueService,
    @Optional() private readonly auditLogService?: AuditLogService,
  ) {}

  onModuleInit(): void {
    this.syncQueue.registerHandler(GOOGLE_SHEET_RESOURCE.SURVEY, (surveyId, job) =>
      this.refresh(surveyId, true, job),
    );
  }

  async enqueueRefresh(surveyId: string): Promise<void> {
    await this.syncQueue.enqueue(GOOGLE_SHEET_RESOURCE.SURVEY, surveyId);
  }

  async connect(surveyId: string, actorUserId?: string) {
    const survey = await this.surveysRepo.findById(surveyId);
    if (!survey) throw new NotFoundException("survey_not_found");

    try {
      if (!survey.spreadsheetId) {
        const surveyTitle = survey.titleKo.trim() || "설문";
        const spreadsheet = await this.sheets.getOrCreateSpreadsheet({
          title: `${surveyTitle}(응답)`,
          duplicateTitle: `${surveyTitle} (응답)`,
          sheetTitle: SHEET_TITLE,
          purpose: "survey-results",
          key: survey.id,
          ensureUniqueTitle: true,
        });
        await this.surveysRepo.updateSpreadsheetConnection(surveyId, {
          spreadsheetId: spreadsheet.spreadsheetId,
          spreadsheetUrl: spreadsheet.spreadsheetUrl,
          spreadsheetSyncStatus: "CONNECTED",
        });
      } else {
        await this.sheets.ensureSpreadsheetInTargetFolder(survey.spreadsheetId);
      }
    } catch (error) {
      await this.markConnectionError(surveyId, error);
      throw error;
    }

    await this.refresh(surveyId, true);
    const connected = await this.surveysRepo.findById(surveyId);
    await this.auditLogService?.record({
      action: "survey.spreadsheet.connect",
      actorUserId: actorUserId ?? null,
      targetId: surveyId,
      targetType: "survey",
      payload: {
        surveyId,
        spreadsheetId: connected?.spreadsheetId ?? null,
        syncStatus: connected?.spreadsheetSyncStatus ?? null,
      },
    });
    return connected;
  }

  private async markConnectionError(surveyId: string, error: unknown): Promise<void> {
    try {
      await this.surveysRepo.updateSpreadsheetSyncState(surveyId, "ERROR");
    } catch (stateError) {
      this.logger.warn(
        `Unable to persist survey sheet error state (${surveyId}): ${
          stateError instanceof Error ? stateError.message : String(stateError)
        }`,
      );
    }
    this.logger.warn(
      `Survey sheet connection failed (${surveyId}): ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }

  async refresh(
    surveyId: string,
    throwOnError = false,
    job?: GoogleSpreadsheetSyncJobContext,
  ): Promise<void> {
    const survey = await this.surveysRepo.findById(surveyId);
    if (!survey?.spreadsheetId) return;
    const auditContext = {
      executor: job ? "background-worker" : "request",
      jobId: job?.jobId ?? null,
      resource: job?.resourceKey ?? surveyId,
      revision: job?.revision ?? null,
    };

    try {
      if (job && !(await job.isCurrentClaim())) return;
      const sections = await this.sectionsRepo.findBySurveyId(surveyId);
      const questions = (
        await Promise.all(
          sections.map((section) => this.questionsRepo.findBySectionId(section.id)),
        )
      ).flat();
      const responsePage = await this.responsesRepo.findBySurveyId(surveyId, {
        page: 1,
        pageSize: 100,
      });
      if (responsePage.total > responsePage.items.length) {
        throw new Error("survey_sheet_response_limit_exceeded");
      }
      const responses = responsePage.items;
      const answers = await this.responsesRepo.findAnswersByResponseIds(
        responses.map((response) => response.id),
      );
      const answersByResponse = new Map<string, Map<string, SurveyAnswerRecord>>();
      for (const answer of answers) {
        const responseAnswers = answersByResponse.get(answer.responseId) ?? new Map();
        responseAnswers.set(answer.questionId, answer);
        answersByResponse.set(answer.responseId, responseAnswers);
      }

      const headers = [
        "응답 ID",
        "제출 시각",
        "이름",
        "이메일",
        "소속",
        "학번",
        ...questions.map((question) => question.titleKo),
      ];
      const rows = responses.map((response) => {
        const responseAnswers = answersByResponse.get(response.id);
        return [
          response.id,
          response.submittedAt ?? "",
          response.user?.nameKo ?? "익명",
          response.user?.email ?? "",
          response.user?.departmentKo ?? "",
          response.user?.stdNo ?? "",
          ...questions.map((question) =>
            this.formatAnswer(responseAnswers?.get(question.id), question),
          ),
        ];
      });

      if (job && !(await job.isCurrentClaim())) return;

      await this.sheets.syncSheet({
        spreadsheetId: survey.spreadsheetId,
        sheetTitle: SHEET_TITLE,
        headers,
        rows,
        dateTimeColumns: [1],
        columnWidths: [230, 155, 105, 240, 150, 100, ...questions.map(() => 240)],
        protectionDescription: `KAIST SOC · 설문 응답 · ${survey.id} (읽기 전용)`,
      });
      if (job && !(await job.isCurrentClaim())) return;
      const stateUpdated = job
        ? await this.surveysRepo.updateSpreadsheetSyncStateForClaim(
            surveyId,
            "CONNECTED",
            job,
          )
        : await this.surveysRepo.updateSpreadsheetSyncState(surveyId, "CONNECTED").then(() => true);
      if (!stateUpdated) return;
      await this.recordAuditSafely({
        action: "survey.spreadsheet.refresh",
        actorUserId: null,
        payload: { ...auditContext, result: "succeeded", responseCount: responses.length },
        targetId: surveyId,
        targetType: "survey",
      });
    } catch (error) {
      if (job) {
        await this.surveysRepo.updateSpreadsheetSyncStateForClaim(surveyId, "ERROR", job);
      } else {
        await this.surveysRepo.updateSpreadsheetSyncState(surveyId, "ERROR");
      }
      await this.recordAuditSafely({
        action: "survey.spreadsheet.refresh",
        actorUserId: null,
        payload: {
          ...auditContext,
          result: "failed",
          errorCode: error instanceof Error ? error.name : "unknown_error",
        },
        targetId: surveyId,
        targetType: "survey",
      });
      this.logger.warn(
        `Survey sheet sync failed (${surveyId}): ${error instanceof Error ? error.message : String(error)}`,
      );
      if (throwOnError) throw error;
    }
  }

  private async recordAuditSafely(input: {
    action: string;
    actorUserId: string | null;
    payload: Record<string, unknown>;
    targetId: string;
    targetType: string;
  }): Promise<void> {
    try {
      await this.auditLogService?.record(input);
    } catch (error) {
      // Audit retry is independent from the already-completed Google write.
      this.logger.warn(
        `Survey spreadsheet audit failed (${input.action}): ${error instanceof Error ? error.name : "unknown_error"}`,
      );
    }
  }

  private formatAnswer(
    answer: SurveyAnswerRecord | undefined,
    question: SurveyQuestionRecord,
  ): string {
    if (!answer) return "";
    const content = answer.content;
    const optionByValue = new Map(
      (question.options ?? []).map((option) => [option.value, option.labelKo]),
    );
    if (question.questionType === "multiple_choice") {
      return (Array.isArray(content.values) ? content.values : [])
        .map((value) => optionByValue.get(String(value)) ?? String(value))
        .join(", ");
    }
    if (question.questionType === "single_choice" || question.questionType === "dropdown") {
      const value = typeof content.value === "string" ? content.value : "";
      return optionByValue.get(value) ?? value;
    }
    if (question.questionType === "rating") {
      return typeof content.rating === "string" || typeof content.rating === "number"
        ? String(content.rating)
        : "";
    }
    if (question.questionType === "grid_single" || question.questionType === "grid_multiple") {
      return content.grid ? JSON.stringify(content.grid) : "";
    }
    if (question.questionType === "file_upload") {
      const name = typeof content.fileName === "string" ? content.fileName : "첨부 파일";
      const id = typeof content.assetId === "string" ? content.assetId : "";
      return id ? `${name} (asset:${id})` : name;
    }
    for (const key of ["text", "date", "time", "value"]) {
      if (typeof content[key] === "string") return content[key] as string;
    }
    return "";
  }
}
