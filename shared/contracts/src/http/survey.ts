export type SurveyStatus = 'draft' | 'scheduled' | 'open' | 'closed' | 'archived';
export type ResponseStatus = 'draft' | 'submitted' | 'approved' | 'rejected' | 'waitlisted';
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
  titleKo: string;
  titleEn: string;
  descriptionKo: string | null;
  descriptionEn: string | null;
  creatorId: string | null;
  status: SurveyStatus;
  computedState: ComputedSurveyState;
  publishedAt: string | null;
  connectedPostId: string | null;
  feePayersOnly: boolean;
  allowAnonymous: boolean;
  maxResponses: number | null;
  opensAt: string | null;
  closesAt: string | null;
  createdAt: string;
  updatedAt: string;
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
  externalPhone: string | null;
  status: ResponseStatus;
  submittedAt: string | null;
  reviewedAt: string | null;
  reviewAdminId: string | null;
  reviewReason: string | null;
  createdAt: string;
  updatedAt: string;
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
  titleKo: string;
  titleEn: string;
  descriptionKo?: string;
  descriptionEn?: string;
  feePayersOnly?: boolean;
  allowAnonymous?: boolean;
  maxResponses?: number;
  opensAt?: string;
  closesAt?: string;
  connectedPostId?: string;
}

export interface UpdateSurveyRequest {
  titleKo?: string;
  titleEn?: string;
  descriptionKo?: string;
  descriptionEn?: string;
  status?: SurveyStatus;
  feePayersOnly?: boolean;
  allowAnonymous?: boolean;
  maxResponses?: number;
  opensAt?: string;
  closesAt?: string;
  connectedPostId?: string;
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
  externalPhone?: string;
  answers: AnswerInput[];
}

export interface ReviewResponseRequest {
  status: 'approved' | 'rejected' | 'waitlisted';
  reason?: string;
}

// ─── Response DTOs ────────────────────────────────────────────────────────────

export interface SurveyDetailResponse extends SurveyRecord {
  sections: Array<SurveySectionRecord & { questions: SurveyQuestionRecord[] }>;
}

export interface ResponseDetailResponse extends SurveyResponseRecord {
  answers: SurveyAnswerRecord[];
}
