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
export type SurveySectionItemDto =
  | { id: string; ordinal: number; kind: "QUESTION"; question: SurveyQuestionDto }
  | { id: string; ordinal: number; kind: "DESCRIPTION"; body: LocalizedContent }
  | { id: string; ordinal: number; kind: "IMAGE_BLOCK"; mode: SurveyImageBlockMode; membershipCounts: SurveyImageBlockMembershipCounts };
export interface SurveySectionDto { id: string; ordinal: number; title: LocalizedContent; items: SurveySectionItemDto[]; }
export type SurveyImageBlockMode = "SHARED" | "LOCALIZED";
export type SurveyImageMembershipSet = "SHARED" | "KO" | "EN";
export interface SurveyImageBlockMembershipCounts { shared: number; ko: number; en: number; }
export interface SurveyImageBlockMembershipDto { id: string; asset: { id: string; src: string; contentType: string; byteSize: number; width: number; height: number }; }
export interface SurveyImageBlockMembershipPage { items: SurveyImageBlockMembershipDto[]; nextCursor: string | null; membershipCount: number; definitionVersion: number; requestedLocale: ContentLocale; effectiveContentLocale: ContentLocale; }
export interface SurveyImageBlockMembershipPageQuery { set: SurveyImageMembershipSet; limit?: number; cursor?: string; }
export interface AddSurveyImageBlockMembershipRequest { expectedDefinitionVersion: number; clientMutationId: string; set: SurveyImageMembershipSet; assetId: string; afterMembershipId?: string | null; }
export interface RemoveSurveyImageBlockMembershipRequest { expectedDefinitionVersion: number; clientMutationId: string; }
export interface MoveSurveyImageBlockMembershipRequest { expectedDefinitionVersion: number; clientMutationId: string; afterMembershipId?: string | null; }
export interface ChangeSurveyImageBlockModeRequest { expectedDefinitionVersion: number; clientMutationId: string; mode: SurveyImageBlockMode; retainSet?: "KO" | "EN"; }
export interface SurveyImageBlockMutationResponse { definitionVersion: number; membership: SurveyImageBlockMembershipDto | null; membershipCount: number; }
export interface SurveyImageBlockModeMutationResponse { definitionVersion: number; mode: SurveyImageBlockMode; membershipCounts: SurveyImageBlockMembershipCounts; }
export interface InitiateSurveyImageAssetV2Request {
  contentType: string; byteSize: number; checksumSha256: string;
}
export interface CompleteSurveyImageAssetV2Request { checksumSha256: string; }
export interface SurveyImageAssetInitiatedV2 {
  image: { id: string; contentType: string; byteSize: number; width: number | null; height: number | null; status: "INITIATED" | "COMPLETED" | "DELETED" };
  uploadUrl: string; uploadHeaders: Record<string, string>;
}
export interface SurveyDto {
  id: string; revision: number; definitionVersion: number; locale: ContentLocale; requestedLocale: ContentLocale; effectiveContentLocale: ContentLocale; onlyForKoreanSpeaker: boolean;
  title: LocalizedContent; description: LocalizedContent | null; state: SurveyState; guestAllowed: boolean; phoneRequired: boolean; feeRestriction: "ANY" | "PAID_ONLY"; cap: number | null; opensAt: string | null; closesAt: string | null; editDeadlineAt: string | null; responseRetentionDays: number; sections: SurveySectionDto[]; updatedAt: string | null;
}
export interface SurveyListQuery { locale?: ContentLocale; }
export interface SurveyListResponse { locale: ContentLocale; items: SurveyDto[]; }
export interface SurveyReviewQueueItem {
  surveyId: string;
  title: LocalizedContent;
  state: SurveyState;
  responseCount: number;
  latestResponseAt: string | null;
}
export interface SurveyReviewQueueResponse { items: SurveyReviewQueueItem[]; }
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
export type AdminReviewableResponseState = "SUBMITTED" | "APPROVED" | "REJECTED" | "WAITLISTED";
export type LocalizedField = { value: string | null; translationUnavailable: boolean };
export type AdminResponseValue =
  | { kind: "text"; textValue: string }
  | { kind: "number"; numberValue: number }
  | { kind: "date"; dateValue: string }
  | { kind: "choices"; choices: Array<{ choiceOptionId: string; label: LocalizedField }> };
export interface AdminSurveyResponsesQuery { state?: AdminReviewableResponseState; limit?: number; cursor?: string; locale?: ContentLocale; }
export interface AdminSurveyResponsePageItem { responseId: string; surveyId: string; surveyRevisionId: string; revision: number; state: AdminReviewableResponseState; submittedAt: string; reviewedAt: string | null; }
export interface AdminSurveyResponsePage { surveyId: string; locale: ContentLocale; state: AdminReviewableResponseState; limit: number; matchingCount: number; items: AdminSurveyResponsePageItem[]; nextCursor: string | null; }
export interface AdminSurveyResponseDetail { responseId: string; surveyId: string; surveyRevisionId: string; revision: number; locale: ContentLocale; state: AdminReviewableResponseState; submittedAt: string; reviewedAt: string | null; reviewReason: string | null; answers: Array<{ questionId: string; prompt: LocalizedField; value: AdminResponseValue }>; }
export type ReviewAdminSurveyResponseRequest =
  | { expectedSurveyRevisionId: string; state: "REJECTED"; reason: string }
  | { expectedSurveyRevisionId: string; state: "APPROVED" | "WAITLISTED" };
export interface MySurveyResponseListItem { survey: SurveyDto; response: SurveyResponseDto; }
export interface MySurveyResponsesQuery { locale?: ContentLocale; }
export interface MySurveyResponsesResponse { locale: ContentLocale; items: MySurveyResponseListItem[]; }
export interface CreateSurveyRequest {
  onlyForKoreanSpeaker?: boolean;
  title: SurveyBilingualText; description?: SurveyBilingualText | null; guestAllowed: boolean; phoneRequired: boolean;
  feeRestriction: "ANY" | "PAID_ONLY"; cap?: number | null; opensAt?: string | null; closesAt?: string | null; editDeadlineAt?: string | null; responseRetentionDays: number;
}
export type PatchSurveyRequest = Partial<Omit<CreateSurveyRequest, "onlyForKoreanSpeaker">> & {
  onlyForKoreanSpeaker?: boolean;
  expectedDefinitionVersion?: number;
};
interface SurveyQuestionDefinitionBase {
  id?: string;
  ordinal: number;
  prompt: SurveyBilingualText;
  helpText?: SurveyBilingualText | null;
  required: boolean;
}

type SurveyQuestionChoiceDefinition = { id?: string; ordinal: number; value: SurveyBilingualText };

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
export type SurveySectionItemDefinitionInput =
  | { id?: string; ordinal: number; kind: "QUESTION"; question: SurveyQuestionDefinitionInput }
  | { id?: string; ordinal: number; kind: "DESCRIPTION"; body: SurveyBilingualText }
  | { id?: string; ordinal: number; kind: "IMAGE_BLOCK"; mode: SurveyImageBlockMode };
export interface ReplaceSurveyDefinitionRequest {
  expectedDefinitionVersion: number;
  sections: Array<{ id?: string; ordinal: number; title: SurveyBilingualText; items: SurveySectionItemDefinitionInput[] }>;
}
export interface ReplaceSurveyDefinitionResponse { survey: SurveyDto; }
export interface PublishSurveyResponse { survey: SurveyDto; }
export interface AdminSurveyAggregate {
  surveyId: string; locale: ContentLocale; surveySuppressed: boolean;
  revisions: Array<{ surveyRevisionId: string; revision: number; suppressed: boolean; responseCount: number | null; questions: Array<{ questionId: string; prompt: LocalizedField; responseCount: number | null; choices: Array<{ choiceOptionId: string; label: LocalizedField; count: number | null }> }> }>;
}
export interface AdminSurveyExactAggregate {
  surveyId: string; locale: ContentLocale;
  revisions: Array<{ surveyRevisionId: string; revision: number; responseCount: number; questions: Array<{ questionId: string; prompt: LocalizedField; responseCount: number; choices: Array<{ choiceOptionId: string; label: LocalizedField; count: number }> }> }>;
}
export interface ExportSurveyRequest { format: "CSV"; locale?: ContentLocale; }
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
