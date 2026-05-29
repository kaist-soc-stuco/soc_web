import type {
  CreateQuestionRequest,
  CreateSectionRequest,
  CreateSurveyRequest,
  ResponseDetailResponse,
  SubmitResponseRequest,
  SurveyDetailResponse,
  SurveyQuestionRecord,
  SurveyRecord,
  SurveyResponseRecord,
  SurveySectionRecord,
  UpdateQuestionRequest,
  UpdateSectionRequest,
  UpdateSurveyRequest,
} from "@soc/contracts";

import type { ApiClientContext } from "./core";

export const createSurveyApi = ({
  requestJson,
  requestVoid,
  surveyBaseUrl,
}: ApiClientContext) => ({
  getSurveyDetail: async (surveyId: string): Promise<SurveyDetailResponse> => {
    return requestJson<SurveyDetailResponse>(`${surveyBaseUrl}/${surveyId}`, {
      method: "GET",
    });
  },

  submitSurveyResponse: async (
    surveyId: string,
    body: SubmitResponseRequest,
  ): Promise<ResponseDetailResponse> => {
    return requestJson<ResponseDetailResponse>(
      `${surveyBaseUrl}/${surveyId}/responses`,
      {
        body: JSON.stringify(body),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      },
    );
  },

  listSurveys: async (): Promise<SurveyRecord[]> => {
    return requestJson<SurveyRecord[]>(
      surveyBaseUrl,
      {
        method: "GET",
      },
      { retryOnUnauthorized: true },
    );
  },

  createSurvey: async (body: CreateSurveyRequest): Promise<SurveyRecord> => {
    return requestJson<SurveyRecord>(
      surveyBaseUrl,
      {
        body: JSON.stringify(body),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      },
      { retryOnUnauthorized: true },
    );
  },

  updateSurvey: async (
    surveyId: string,
    body: UpdateSurveyRequest,
  ): Promise<SurveyRecord> => {
    return requestJson<SurveyRecord>(
      `${surveyBaseUrl}/${surveyId}`,
      {
        body: JSON.stringify(body),
        headers: { "Content-Type": "application/json" },
        method: "PATCH",
      },
      { retryOnUnauthorized: true },
    );
  },

  deleteSurvey: async (surveyId: string): Promise<void> => {
    await requestVoid(
      `${surveyBaseUrl}/${surveyId}`,
      { method: "DELETE" },
      { retryOnUnauthorized: true },
    );
  },

  duplicateSurvey: async (surveyId: string): Promise<SurveyRecord> => {
    return requestJson<SurveyRecord>(
      `${surveyBaseUrl}/${surveyId}/duplicate`,
      {
        method: "POST",
      },
      { retryOnUnauthorized: true },
    );
  },

  createSection: async (
    surveyId: string,
    body: CreateSectionRequest,
  ): Promise<SurveySectionRecord> => {
    return requestJson<SurveySectionRecord>(
      `${surveyBaseUrl}/${surveyId}/sections`,
      {
        body: JSON.stringify(body),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      },
      { retryOnUnauthorized: true },
    );
  },

  updateSection: async (
    surveyId: string,
    sectionId: string,
    body: UpdateSectionRequest,
  ): Promise<SurveySectionRecord> => {
    return requestJson<SurveySectionRecord>(
      `${surveyBaseUrl}/${surveyId}/sections/${sectionId}`,
      {
        body: JSON.stringify(body),
        headers: { "Content-Type": "application/json" },
        method: "PATCH",
      },
      { retryOnUnauthorized: true },
    );
  },

  deleteSection: async (surveyId: string, sectionId: string): Promise<void> => {
    await requestVoid(
      `${surveyBaseUrl}/${surveyId}/sections/${sectionId}`,
      { method: "DELETE" },
      { retryOnUnauthorized: true },
    );
  },

  createQuestion: async (
    surveyId: string,
    sectionId: string,
    body: CreateQuestionRequest,
  ): Promise<SurveyQuestionRecord> => {
    return requestJson<SurveyQuestionRecord>(
      `${surveyBaseUrl}/${surveyId}/sections/${sectionId}/questions`,
      {
        body: JSON.stringify(body),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      },
      { retryOnUnauthorized: true },
    );
  },

  updateQuestion: async (
    surveyId: string,
    sectionId: string,
    questionId: string,
    body: UpdateQuestionRequest,
  ): Promise<SurveyQuestionRecord> => {
    return requestJson<SurveyQuestionRecord>(
      `${surveyBaseUrl}/${surveyId}/sections/${sectionId}/questions/${questionId}`,
      {
        body: JSON.stringify(body),
        headers: { "Content-Type": "application/json" },
        method: "PATCH",
      },
      { retryOnUnauthorized: true },
    );
  },

  deleteQuestion: async (
    surveyId: string,
    sectionId: string,
    questionId: string,
  ): Promise<void> => {
    await requestVoid(
      `${surveyBaseUrl}/${surveyId}/sections/${sectionId}/questions/${questionId}`,
      { method: "DELETE" },
      { retryOnUnauthorized: true },
    );
  },

  listResponses: async (surveyId: string): Promise<SurveyResponseRecord[]> => {
    return requestJson<SurveyResponseRecord[]>(
      `${surveyBaseUrl}/${surveyId}/responses`,
      {
        method: "GET",
      },
      { retryOnUnauthorized: true },
    );
  },

  getResponseDetail: async (
    surveyId: string,
    responseId: string,
  ): Promise<ResponseDetailResponse> => {
    return requestJson<ResponseDetailResponse>(
      `${surveyBaseUrl}/${surveyId}/responses/${responseId}`,
      { method: "GET" },
      { retryOnUnauthorized: true },
    );
  },

  listResponsesWithAnswers: async (
    surveyId: string,
  ): Promise<Array<SurveyResponseRecord & { answers: any[] }>> => {
    return requestJson<Array<SurveyResponseRecord & { answers: any[] }>>(
      `${surveyBaseUrl}/${surveyId}/responses/with-answers`,
      { method: "GET" },
      { retryOnUnauthorized: true },
    );
  },

  getSurveyAnalytics: async (surveyId: string): Promise<any> => {
    return requestJson<any>(
      `${surveyBaseUrl}/${surveyId}/analytics`,
      { method: "GET" },
      { retryOnUnauthorized: true },
    );
  },

  getPublicSurveys: async (): Promise<any[]> => {
    return requestJson<any[]>(
      `${surveyBaseUrl}/list/public`,
      { method: "GET" },
    );
  },
});
