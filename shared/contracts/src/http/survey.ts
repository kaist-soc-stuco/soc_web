import type { z } from "zod";
import type {
  CreateQuestionSchema,
  CreateSectionSchema,
  CreateSurveySchema,
  QuestionConfigSchema,
  QuestionOptionSchema,
  QuestionTypeSchema,
  SubmitResponseSchema,
  UpdateQuestionSchema,
  UpdateSectionSchema,
  UpdateSurveySchema,
  ReorderSurveyQuestionsSchema,
  ReorderSurveySectionsSchema,
} from "../schemas.js";

export type ResponseStatus = 'submitted';
export type QuestionType = z.infer<typeof QuestionTypeSchema>;
export type ComputedSurveyState = 'before_open' | 'open' | 'closed';
export type SurveyLifecycleStatus = 'DRAFT' | 'PUBLISHED';

export type QuestionOption = z.infer<typeof QuestionOptionSchema>;
export type SurveyQuestionConfig = z.infer<typeof QuestionConfigSchema>;

export interface SurveyRecord {
  id: string;
  kind: string;
  resultVisibility: string;
  titleKo: string;
  titleEn: string | null;
  descriptionKo: string | null;
  descriptionEn: string | null;
  creatorId: string | null;
  computedState: ComputedSurveyState;
  publishedAt: string | null;
  connectedPostId: string | null;
  feePayersOnly: boolean;
  allowMultipleResponses: boolean;
  allowResponseEdit: boolean;
  isKoreanOnly: boolean;
  isPublished: boolean;
  lifecycleStatus: SurveyLifecycleStatus;
  previousVersionId: string | null;
  versionNumber: number;
  derivedVersionCount: number;
  showOnCalendar: boolean;
  maxResponses: number | null;
  isAlwaysOpen: boolean;
  opensAt: string | null;
  closesAt: string | null;
  createdAt: string;
  updatedAt: string;
  responseCount?: number;
}

export interface SurveySectionRecord {
  id: string;
  surveyId: string;
  titleKo: string;
  titleEn: string | null;
  descriptionKo: string | null;
  descriptionEn: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface SurveyQuestionRecord {
  id: string;
  sectionId: string;
  titleKo: string;
  titleEn: string | null;
  descriptionKo: string | null;
  descriptionEn: string | null;
  questionType: QuestionType;
  options: QuestionOption[] | null;
  config: SurveyQuestionConfig | null;
  answerRegex: string | null;
  isRequired: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface SurveyResponseRecord {
  id: string;
  surveyId: string;
  userId: string | null;
  status: ResponseStatus;
  submittedAt: string | null;
  user: SurveyResponseUserRecord | null;
  createdAt: string;
  updatedAt: string;
}

export interface SurveyResponseUserRecord {
  nameKo: string | null;
  email: string | null;
  departmentKo: string | null;
  stdNo: string | null;
}

export interface SurveyAnswerRecord {
  id: string;
  responseId: string;
  questionId: string;
  content: Record<string, unknown>;
  submittedAt: string;
  updatedAt: string;
}

// ─── Request DTOs ─────────────────────────────────────────────────────────────

export type CreateSurveyRequest = z.infer<typeof CreateSurveySchema>;

export type UpdateSurveyRequest = z.infer<typeof UpdateSurveySchema>;

export type CreateSectionRequest = z.infer<typeof CreateSectionSchema>;

export type UpdateSectionRequest = z.infer<typeof UpdateSectionSchema>;

export type CreateQuestionRequest = z.infer<typeof CreateQuestionSchema>;

export type UpdateQuestionRequest = z.infer<typeof UpdateQuestionSchema>;
export type ReorderSurveySectionsRequest = z.infer<typeof ReorderSurveySectionsSchema>;
export type ReorderSurveyQuestionsRequest = z.infer<typeof ReorderSurveyQuestionsSchema>;

export type SubmitResponseRequest = z.infer<typeof SubmitResponseSchema>;

export type AnswerInput = SubmitResponseRequest["answers"][number];

// ─── Response DTOs ────────────────────────────────────────────────────────────

export interface SurveyDetailResponse extends SurveyRecord {
  sections: Array<SurveySectionRecord & { questions: SurveyQuestionRecord[] }>;
  currentResponse?: ResponseDetailResponse | null;
  hasSubmitted?: boolean;
  isPreview?: boolean;
}

export interface ResponseDetailResponse extends SurveyResponseRecord {
  answers: SurveyAnswerRecord[];
}

export interface SurveyResponseWithAnswers extends SurveyResponseRecord {
  answers: SurveyAnswerRecord[];
}

export interface SurveyChoiceAnalyticsItem {
  value: string;
  labelKo: string;
  labelEn: string | null;
  count: number;
  percentage: number;
}

export interface SurveyGridAnalyticsCell {
  rowValue: string;
  columnValue: string;
  count: number;
  percentage: number;
}

export interface SurveyGridAnalytics {
  rows: QuestionOption[];
  columns: QuestionOption[];
  cells: SurveyGridAnalyticsCell[];
}

export interface SurveyQuestionAnalyticsItem {
  questionId: string;
  questionType: QuestionType;
  titleKo: string;
  titleEn: string | null;
  totalAnswers: number;
  choices?: SurveyChoiceAnalyticsItem[];
  grid?: SurveyGridAnalytics;
  rawAnswersHidden: boolean;
}

export interface SurveyAnalyticsResponse {
  surveyId: string;
  kind: string;
  resultVisibility: string;
  feePayersOnly: boolean;
  allowMultipleResponses: boolean;
  isKoreanOnly: boolean;
  descriptionKo: string | null;
  descriptionEn: string | null;
  computedState: ComputedSurveyState;
  isAlwaysOpen: boolean;
  opensAt: string | null;
  closesAt: string | null;
  titleKo: string;
  titleEn: string | null;
  totalResponses: number;
  questions: SurveyQuestionAnalyticsItem[];
}
