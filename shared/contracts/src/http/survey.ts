import type { ContentLocale, LocalizedContent } from "./faq";

export type SurveyState = "DRAFT" | "SCHEDULED" | "OPEN" | "CLOSED" | "ARCHIVED";
export type SurveyResponseState = "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED" | "WAITLISTED";
export type SurveyQuestionType = "SHORT_TEXT" | "LONG_TEXT" | "SINGLE_CHOICE" | "MULTIPLE_CHOICE" | "NUMBER" | "DATE";

export interface SurveyBilingualText {
  kr: string;
  en: string;
}

export interface SurveyChoiceOptionDto { id: string; ordinal: number; value: LocalizedContent; }
type SurveyQuestionDtoBase = {
  id: string;
  ordinal: number;
  prompt: LocalizedContent;
  helpText: LocalizedContent | null;
  required: boolean;
};

export type SurveyQuestionDto =
  | (SurveyQuestionDtoBase & {
    type: "SHORT_TEXT" | "LONG_TEXT";
    validationRegex: string | null;
    numberMin: null;
    numberMax: null;
    dateMin: null;
    dateMax: null;
    choices: [];
  })
  | (SurveyQuestionDtoBase & {
    type: "SINGLE_CHOICE" | "MULTIPLE_CHOICE";
    validationRegex: null;
    numberMin: null;
    numberMax: null;
    dateMin: null;
    dateMax: null;
    choices: SurveyChoiceOptionDto[];
  })
  | (SurveyQuestionDtoBase & {
    type: "NUMBER";
    validationRegex: null;
    numberMin: number | null;
    numberMax: number | null;
    dateMin: null;
    dateMax: null;
    choices: [];
  })
  | (SurveyQuestionDtoBase & {
    type: "DATE";
    validationRegex: null;
    numberMin: null;
    numberMax: null;
    dateMin: string | null;
    dateMax: string | null;
    choices: [];
  });
export interface SurveySectionDto { id: string; ordinal: number; title: LocalizedContent; description?: LocalizedContent | null; questions: SurveyQuestionDto[]; }
export interface SurveyDto {
  id: string;
  revision: number;
  locale: ContentLocale;
  title: LocalizedContent;
  description: LocalizedContent | null;
  state: SurveyState;
  guestAllowed: boolean;
  phoneRequired: boolean;
  feeRestriction: "ANY" | "PAID_ONLY";
  cap: number | null;
  opensAt: string | null;
  closesAt: string | null;
  editDeadlineAt: string | null;
  responseRetentionDays: number;
  sections: SurveySectionDto[];
  updatedAt: string;
}
export interface SurveyListQuery { locale?: ContentLocale; }
export interface SurveyListResponse { locale: ContentLocale; items: SurveyDto[]; }
export type SurveyResponseAnswerDto =
  | { questionId: string; submittedAt?: string; textValue: string; numberValue?: never; dateValue?: never; choiceOptionIds?: never }
  | { questionId: string; submittedAt?: string; textValue?: never; numberValue: number; dateValue?: never; choiceOptionIds?: never }
  | { questionId: string; submittedAt?: string; textValue?: never; numberValue?: never; dateValue: string; choiceOptionIds?: never }
  | { questionId: string; submittedAt?: string; textValue?: never; numberValue?: never; dateValue?: never; choiceOptionIds: string[] };
export interface SubmitSurveyResponseRequest { answers: SurveyResponseAnswerDto[]; guestPhone?: string; }
export type SubmitSurveyResponse =
  | { response: SurveyResponseDto }
  | { status: "ACCEPTED" };
export interface SurveyResponseDto {
  id: string; state: SurveyResponseState; answers: SurveyResponseAnswerDto[]; submittedAt: string | null;
  reviewedAt: string | null; reviewReason: string | null; phonePresent: boolean; maskedPhone: string | null;
}
export interface AdminSurveyResponseListItem {
  id: string; surveyId: string; state: SurveyResponseState; submittedAt: string | null;
  reviewedAt: string | null; reviewReason: string | null; phonePresent: boolean; maskedPhone: string | null;
}
export interface AdminSurveyResponseListResponse { items: AdminSurveyResponseListItem[]; }
export interface MySurveyResponseListItem { survey: SurveyDto; response: SurveyResponseDto; }
export interface MySurveyResponsesResponse { items: MySurveyResponseListItem[]; }
export interface CreateSurveyRequest {
  title: SurveyBilingualText; description?: SurveyBilingualText | null; guestAllowed: boolean; phoneRequired: boolean;
  feeRestriction: "ANY" | "PAID_ONLY"; cap?: number | null; opensAt?: string | null; closesAt?: string | null; editDeadlineAt?: string | null; responseRetentionDays: number;
}
export type PatchSurveyRequest = Partial<CreateSurveyRequest>;
export interface ReplaceSurveySectionsRequest { sections: Array<{ ordinal: number; title: SurveyBilingualText; description?: SurveyBilingualText | null }>; }
interface SurveyQuestionDefinitionBase {
  ordinal: number;
  prompt: SurveyBilingualText;
  helpText?: SurveyBilingualText | null;
  required: boolean;
}

type SurveyQuestionChoiceDefinition = { ordinal: number; value: SurveyBilingualText };

export type SurveyQuestionDefinitionInput =
  | (SurveyQuestionDefinitionBase & {
    type: "SHORT_TEXT";
    validationRegex?: string | null;
    numberMin?: never;
    numberMax?: never;
    dateMin?: never;
    dateMax?: never;
    choices?: never;
  })
  | (SurveyQuestionDefinitionBase & {
    type: "LONG_TEXT";
    validationRegex?: string | null;
    numberMin?: never;
    numberMax?: never;
    dateMin?: never;
    dateMax?: never;
    choices?: never;
  })
  | (SurveyQuestionDefinitionBase & {
    type: "SINGLE_CHOICE";
    validationRegex?: never;
    numberMin?: never;
    numberMax?: never;
    dateMin?: never;
    dateMax?: never;
    choices: SurveyQuestionChoiceDefinition[];
  })
  | (SurveyQuestionDefinitionBase & {
    type: "MULTIPLE_CHOICE";
    validationRegex?: never;
    numberMin?: never;
    numberMax?: never;
    dateMin?: never;
    dateMax?: never;
    choices: SurveyQuestionChoiceDefinition[];
  })
  | (SurveyQuestionDefinitionBase & {
    type: "NUMBER";
    validationRegex?: never;
    numberMin?: number | null;
    numberMax?: number | null;
    dateMin?: never;
    dateMax?: never;
    choices?: never;
  })
  | (SurveyQuestionDefinitionBase & {
    type: "DATE";
    validationRegex?: never;
    numberMin?: never;
    numberMax?: never;
    dateMin?: string | null;
    dateMax?: string | null;
    choices?: never;
  });
export interface ReplaceSectionQuestionsRequest { questions: SurveyQuestionDefinitionInput[]; }
export interface PublishSurveyResponse { survey: SurveyDto; }
export type ReviewSurveyResponseRequest =
  | { state: "REJECTED"; reason: string }
  | { state: "APPROVED" | "WAITLISTED"; reason?: null };
export interface SurveyAggregateResponse { surveyId: string; responseCount: number | null; suppressed: boolean; questions: Array<{ questionId: string; suppressed: boolean; responseCount: number | null; choices: Array<{ choiceOptionId: string; count: number | null }> }>; }
export interface SurveyCsvExport { filename: string; csv: string; }
export interface ExportSurveyRequest { format: "CSV"; }
export interface ExportSurveyAcceptedResponse { exportId: string; status: "ACCEPTED"; acceptedAt: string; }
export type ContentRelationType = "ANNOUNCEMENT" | "SCHEDULE" | "SURVEY_PERIOD";
export type ContentRelationSyncMode = "NONE" | "SURVEY_TO_EVENT";
export type ContentMatcherDto = {
  id: string;
  relationType: ContentRelationType;
  syncMode: ContentRelationSyncMode;
  createdByUserId: string;
  createdAt: string;
  updatedByUserId: string;
  updatedAt: string;
  synchronizedAt: string | null;
} & (
  | { articleId: string; eventId: string; surveyId: null }
  | { articleId: string; eventId: null; surveyId: string }
  | { articleId: null; eventId: string; surveyId: string }
);
export type CreateContentMatcherRequest =
  | { articleId: string; eventId: string; surveyId?: never; relationType: "ANNOUNCEMENT" | "SCHEDULE"; syncMode?: "NONE" }
  | { articleId: string; eventId?: never; surveyId: string; relationType: "ANNOUNCEMENT"; syncMode?: "NONE" }
  | { articleId?: never; eventId: string; surveyId: string; relationType: "SURVEY_PERIOD"; syncMode?: ContentRelationSyncMode };
export interface ListContentMatchersResponse { items: ContentMatcherDto[]; }
export type RelatedContentCard =
  | { kind: "ARTICLE"; id: string; title: string; href: string; relationType: ContentRelationType }
  | { kind: "EVENT"; id: string; title: string; href: string; relationType: ContentRelationType; startsAt: string }
  | { kind: "SURVEY"; id: string; title: string; href: string; relationType: ContentRelationType; opensAt: string | null; closesAt: string | null };
export interface RelatedContentResponse { items: RelatedContentCard[]; }
export interface MaterializeSurveyEventRequest { location: string; visibility: "PUBLIC" | "AUTHENTICATED" | "COMMITTEE"; }
export interface MaterializeSurveyEventResponse { eventId: string; relation: ContentMatcherDto; }
export interface GetMySurveyResponseResponse { response: SurveyResponseDto | null; }
