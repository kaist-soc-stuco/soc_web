import type { SurveyStatus, ComputedSurveyState } from "@soc/contracts";

export interface SurveyRecord {
  id: string;
  titleKo: string;
  titleEn: string;
  descriptionKo: string | null;
  descriptionEn: string | null;
  creatorId: string | null;
  status: SurveyStatus;
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

export interface SurveyRecordWithState extends SurveyRecord {
  computedState: ComputedSurveyState;
}
