import { readFile } from "node:fs/promises";

import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { nowMs } from "@soc/shared";

import { SurveyQuestionsRepository } from "./survey-questions.repository";
import { SurveyResponsesRepository } from "./survey-responses.repository";
import { SurveySectionsRepository } from "./survey-sections.repository";
import { SurveysRepository } from "./surveys.repository";
import type { SurveyAnswerRecord } from "./entities/survey-answer.entity";
import type { SurveyQuestionRecord } from "./entities/survey-question.entity";

interface GoogleOAuthClient {
  client_id: string;
  client_secret: string;
  token_uri?: string;
}

interface GoogleOAuthClientFile {
  installed?: GoogleOAuthClient;
  web?: GoogleOAuthClient;
}

interface GoogleOAuthTokenFile {
  refresh_token?: string;
}

interface GoogleTokenResponse {
  access_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
}

const DEFAULT_RESULTS_FOLDER_NAME = "KAIST SOC 설문 결과";
const RESULTS_FOLDER_PURPOSE = "survey-results";
const SHEET_TITLE = "응답";

@Injectable()
export class GoogleSurveySheetsService {
  private readonly logger = new Logger(GoogleSurveySheetsService.name);
  private cachedToken: { value: string; expiresAt: number } | null = null;

  constructor(
    private readonly config: ConfigService,
    private readonly surveysRepo: SurveysRepository,
    private readonly sectionsRepo: SurveySectionsRepository,
    private readonly questionsRepo: SurveyQuestionsRepository,
    private readonly responsesRepo: SurveyResponsesRepository,
  ) {}

  async connect(surveyId: string) {
    const survey = await this.surveysRepo.findById(surveyId);
    if (!survey) throw new NotFoundException("survey_not_found");

    if (!survey.spreadsheetId) {
      const folderId = await this.getOrCreateResultsFolder();

      const spreadsheet = await this.request<{
        spreadsheetId: string;
        spreadsheetUrl?: string;
      }>("POST", "https://sheets.googleapis.com/v4/spreadsheets", {
        properties: { title: `${survey.titleKo} 응답 · ${survey.id}` },
        sheets: [{ properties: { title: SHEET_TITLE, gridProperties: { frozenRowCount: 1 } } }],
      });

      await this.moveFileToFolder(spreadsheet.spreadsheetId, folderId);
      await this.surveysRepo.updateSpreadsheetConnection(surveyId, {
        spreadsheetId: spreadsheet.spreadsheetId,
        spreadsheetUrl:
          spreadsheet.spreadsheetUrl ??
          `https://docs.google.com/spreadsheets/d/${spreadsheet.spreadsheetId}/edit`,
        spreadsheetSyncStatus: "CONNECTED",
      });
    }

    await this.refresh(surveyId, true);
    return this.surveysRepo.findById(surveyId);
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

      const values: Array<Array<string | number>> = [
        [
          "응답 ID",
          "제출 시각",
          "이름",
          "이메일",
          "소속",
          "학번",
          ...questions.map((question) => question.titleKo),
        ],
        ...responses.map((response) => {
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
        }),
      ];

      const range = encodeURIComponent(`'${SHEET_TITLE}'!A:ZZ`);
      await this.request(
        "POST",
        `https://sheets.googleapis.com/v4/spreadsheets/${survey.spreadsheetId}/values/${range}:clear`,
        {},
      );
      await this.request(
        "PUT",
        `https://sheets.googleapis.com/v4/spreadsheets/${survey.spreadsheetId}/values/${range}?valueInputOption=RAW`,
        { majorDimension: "ROWS", values },
      );
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

  private async assertFolderWritable(folderId: string): Promise<void> {
    const folder = await this.request<{
      mimeType?: string;
      capabilities?: { canAddChildren?: boolean };
    }>(
      "GET",
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(folderId)}?fields=mimeType,capabilities(canAddChildren)&supportsAllDrives=true`,
    );
    if (
      folder.mimeType !== "application/vnd.google-apps.folder" ||
      folder.capabilities?.canAddChildren !== true
    ) {
      throw new Error("google_survey_results_folder_not_writable");
    }
  }

  private async getOrCreateResultsFolder(): Promise<string> {
    const configuredFolderId = this.config
      .get<string>("GOOGLE_SURVEY_RESULTS_FOLDER_ID")
      ?.trim();
    if (configuredFolderId) {
      await this.assertFolderWritable(configuredFolderId);
      return configuredFolderId;
    }

    const query = new URLSearchParams({
      q: [
        "mimeType = 'application/vnd.google-apps.folder'",
        "trashed = false",
        `appProperties has { key='socPurpose' and value='${RESULTS_FOLDER_PURPOSE}' }`,
      ].join(" and "),
      spaces: "drive",
      fields: "files(id,name)",
      pageSize: "1",
    });
    const existing = await this.request<{ files?: Array<{ id: string }> }>(
      "GET",
      `https://www.googleapis.com/drive/v3/files?${query.toString()}`,
    );
    const existingFolderId = existing.files?.[0]?.id;
    if (existingFolderId) return existingFolderId;

    const folderName =
      this.config.get<string>("GOOGLE_SURVEY_RESULTS_FOLDER_NAME")?.trim() ||
      DEFAULT_RESULTS_FOLDER_NAME;
    const created = await this.request<{ id?: string }>(
      "POST",
      "https://www.googleapis.com/drive/v3/files?fields=id,name,webViewLink",
      {
        name: folderName,
        mimeType: "application/vnd.google-apps.folder",
        appProperties: { socPurpose: RESULTS_FOLDER_PURPOSE },
      },
    );
    if (!created.id) throw new Error("google_survey_results_folder_create_failed");
    return created.id;
  }

  private async moveFileToFolder(fileId: string, folderId: string): Promise<void> {
    const current = await this.request<{ parents?: string[] }>(
      "GET",
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?fields=parents&supportsAllDrives=true`,
    );
    const query = new URLSearchParams({
      addParents: folderId,
      supportsAllDrives: "true",
      fields: "id,webViewLink",
    });
    if (current.parents?.length) query.set("removeParents", current.parents.join(","));
    await this.request(
      "PATCH",
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?${query.toString()}`,
      {},
    );
  }

  private async request<T = unknown>(method: string, url: string, body?: unknown): Promise<T> {
    const response = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${await this.getAccessToken()}`,
        Accept: "application/json",
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(20_000),
    });
    const text = await response.text();
    if (!response.ok) {
      throw new Error(`google_workspace_http_${response.status}${text ? `: ${text.slice(0, 300)}` : ""}`);
    }
    return text ? (JSON.parse(text) as T) : (undefined as T);
  }

  private async getAccessToken(): Promise<string> {
    if (this.cachedToken && this.cachedToken.expiresAt > nowMs() + 60_000) {
      return this.cachedToken.value;
    }
    const clientFile = this.config.get<string>("GOOGLE_OAUTH_CLIENT_KEY_FILE")?.trim();
    const tokenFile = this.config.get<string>("GOOGLE_OAUTH_TOKEN_FILE")?.trim();
    if (!clientFile) throw new Error("google_oauth_client_file_not_configured");
    if (!tokenFile) throw new Error("google_oauth_token_file_not_configured");

    const clientDocument = JSON.parse(
      await readFile(clientFile, "utf8"),
    ) as GoogleOAuthClientFile;
    const client = clientDocument.installed ?? clientDocument.web;
    const token = JSON.parse(await readFile(tokenFile, "utf8")) as GoogleOAuthTokenFile;
    if (!client?.client_id || !client.client_secret) {
      throw new Error("google_oauth_client_file_invalid");
    }
    if (!token.refresh_token) throw new Error("google_oauth_refresh_token_missing");

    const response = await fetch(client.token_uri ?? "https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: client.client_id,
        client_secret: client.client_secret,
        refresh_token: token.refresh_token,
        grant_type: "refresh_token",
      }),
      signal: AbortSignal.timeout(20_000),
    });
    const payload = (await response.json()) as GoogleTokenResponse;
    if (!response.ok || !payload.access_token) {
      const detail = payload.error_description ?? payload.error;
      throw new Error(
        `google_oauth_token_failed${detail ? `: ${detail.slice(0, 200)}` : ""}`,
      );
    }
    this.cachedToken = {
      value: payload.access_token,
      expiresAt: nowMs() + Math.max((payload.expires_in ?? 3_600) - 60, 60) * 1_000,
    };
    return payload.access_token;
  }
}
