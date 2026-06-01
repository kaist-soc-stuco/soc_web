import type { ComputedSurveyState } from "@soc/contracts";

export interface SurveyRecord {
  id: string;
  kind: string;
  resultVisibility: string;
  titleKo: string;
  titleEn: string | null;
  descriptionKo: string | null;
  descriptionEn: string | null;
  creatorId: string | null;
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

export interface SurveyRecordWithState extends SurveyRecord {
  computedState: ComputedSurveyState;
}
