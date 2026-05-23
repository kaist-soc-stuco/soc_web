import type { SurveyStatus, ComputedSurveyState } from "@soc/contracts";

export interface SurveyRecord {
  id: string;
  kind: string;
  resultVisibility: string;
  titleKo: string;
  titleEn: string | null;
  descriptionKo: string | null;
  descriptionEn: string | null;
  creatorId: string | null;
  status: SurveyStatus;
  publishedAt: string | null;
  connectedPostId: string | null;
  feePayersOnly: boolean;
  allowAnonymous: boolean;
  allowMultipleResponses: boolean;
  isKoreanOnly: boolean;
  isPublished: boolean;
  maxResponses: number | null;
  opensAt: string | null;
  closesAt: string | null;
  createdAt: string;
  updatedAt: string;
  responseCount?: number;
}

export interface SurveyRecordWithState extends SurveyRecord {
  computedState: ComputedSurveyState;
}
