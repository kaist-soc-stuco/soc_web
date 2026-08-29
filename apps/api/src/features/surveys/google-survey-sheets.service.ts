import { Injectable, Logger, NotFoundException } from "@nestjs/common";

import { GoogleSheetsClient } from "../../infrastructure/google/google-sheets.client";
import { SurveysRepository } from "./surveys.repository";
import { SurveySectionsRepository } from "./survey-sections.repository";
import { SurveyQuestionsRepository } from "./survey-questions.repository";
import { SurveyResponsesRepository } from "./survey-responses.repository";
import type { SurveyAnswerRecord } from "./entities/survey-answer.entity";
import type { SurveyQuestionRecord } from "./entities/survey-question.entity";

const SHEET_TITLE = "응답";

@Injectable()
export class GoogleSurveySheetsService {
  private readonly logger = new Logger(GoogleSurveySheetsService.name);

  constructor(
    private readonly sheets: GoogleSheetsClient,
    private readonly surveysRepo: SurveysRepository,
    private readonly sectionsRepo: SurveySectionsRepository,
    private readonly questionsRepo: SurveyQuestionsRepository,
    private readonly responsesRepo: SurveyResponsesRepository,
  ) {}

  async connect(surveyId: string) {
    const survey = await this.surveysRepo.findById(surveyId);
    if (!survey) throw new NotFoundException("survey_not_found");

    try {
      if (!survey.spreadsheetId) {
        const spreadsheet = await this.sheets.getOrCreateSpreadsheet({
          title: `${survey.titleKo} 응답 · ${survey.id}`,
          sheetTitle: SHEET_TITLE,
          purpose: "survey-results",
          key: survey.id,
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
    return this.surveysRepo.findById(surveyId);
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

  async refresh(surveyId: string, throwOnError = false): Promise<void> {
    const survey = await this.surveysRepo.findById(surveyId);
    if (!survey?.spreadsheetId) return;

    try {
      const sections = await this.sectionsRepo.findBySurveyId(surveyId);
      const questions = (
        await Promise.all(
          sections.map((section) => this.questionsRepo.findBySectionId(section.id)),
        )
      ).flat();
      const responses = await this.responsesRepo.findBySurveyId(surveyId);
      const answers = await this.responsesRepo.findAnswersBySurveyId(surveyId);
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

      await this.sheets.syncSheet({
        spreadsheetId: survey.spreadsheetId,
        sheetTitle: SHEET_TITLE,
        headers,
        rows,
        dateTimeColumns: [1],
        columnWidths: [230, 155, 105, 240, 150, 100, ...questions.map(() => 240)],
        protectionDescription: `KAIST SOC · 설문 응답 · ${survey.id} (읽기 전용)`,
      });
      await this.surveysRepo.updateSpreadsheetSyncState(surveyId, "CONNECTED");
    } catch (error) {
      await this.surveysRepo.updateSpreadsheetSyncState(surveyId, "ERROR");
      this.logger.warn(
        `Survey sheet sync failed (${surveyId}): ${error instanceof Error ? error.message : String(error)}`,
      );
      if (throwOnError) throw error;
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
    for (const key of ["text", "date", "time", "datetime", "value"]) {
      if (typeof content[key] === "string") return content[key] as string;
    }
    return "";
  }
}
