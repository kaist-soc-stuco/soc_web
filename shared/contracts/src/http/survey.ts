export type ResponseStatus = 'submitted';
export type QuestionType =
  | 'short_text'
  | 'long_text'
  | 'single_choice'
  | 'multiple_choice'
  | 'dropdown'
  | 'date'
  | 'time'
  | 'datetime';
export type ComputedSurveyState = 'before_open' | 'open' | 'closed';

export interface QuestionOption {
  value: string;
  labelKo: string;
  labelEn?: string;
}

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
  answerRegex: string | null;
  isRequired: boolean;
  editDeadlineAt: string | null;
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

export interface CreateSurveyRequest {
  kind: string;
  titleKo: string;
  titleEn?: string;
  descriptionKo?: string;
  descriptionEn?: string;
  feeRequirementPolicy?: string;
  allowMultipleResponses?: boolean;
  allowResponseEdit?: boolean;
  isKoreanOnly?: boolean;
  isPublished?: boolean;
  showOnCalendar?: boolean;
  resultVisibility: string;
  maxResponseCount?: number;
  isAlwaysOpen?: boolean;
  openAt?: string | null;
  closeAt?: string | null;
  connectedArticleId?: string | null;
}

export interface UpdateSurveyRequest {
  kind?: string;
  titleKo?: string;
  titleEn?: string;
  descriptionKo?: string;
  descriptionEn?: string;
  feeRequirementPolicy?: string;
  allowMultipleResponses?: boolean;
  allowResponseEdit?: boolean;
  isKoreanOnly?: boolean;
  isPublished?: boolean;
  showOnCalendar?: boolean;
  resultVisibility?: string;
  maxResponseCount?: number;
  isAlwaysOpen?: boolean;
  openAt?: string | null;
  closeAt?: string | null;
  connectedArticleId?: string | null;
}

export interface CreateSectionRequest {
  titleKo: string;
  titleEn?: string;
  descriptionKo?: string;
  descriptionEn?: string;
  sortOrder?: number;
}

export interface UpdateSectionRequest {
  titleKo?: string;
  titleEn?: string;
  descriptionKo?: string;
  descriptionEn?: string;
  sortOrder?: number;
}

export interface CreateQuestionRequest {
  titleKo: string;
  titleEn?: string;
  descriptionKo?: string;
  descriptionEn?: string;
  questionType: QuestionType;
  options?: QuestionOption[];
  answerRegex?: string;
  isRequired?: boolean;
  editDeadlineAt?: string;
  sortOrder?: number;
}

export interface UpdateQuestionRequest {
  titleKo?: string;
  titleEn?: string;
  descriptionKo?: string;
  descriptionEn?: string;
  questionType?: QuestionType;
  options?: QuestionOption[];
  answerRegex?: string;
  isRequired?: boolean;
  editDeadlineAt?: string;
  sortOrder?: number;
}

export interface AnswerInput {
  questionId: string;
  content: Record<string, unknown>;
}

export interface SubmitResponseRequest {
  answers: AnswerInput[];
}

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

export interface SurveyQuestionAnalyticsItem {
  questionId: string;
  questionType: QuestionType;
  titleKo: string;
  titleEn: string | null;
  totalAnswers: number;
  choices?: SurveyChoiceAnalyticsItem[];
  texts?: string[];
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
