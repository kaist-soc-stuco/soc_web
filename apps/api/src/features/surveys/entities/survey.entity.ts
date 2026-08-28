import type {
  ComputedSurveyState,
  SurveyLifecycleStatus,
  SurveyParticipationEligibility,
  SurveySocAffiliation,
  SurveyAcademicEligibility,
} from "@soc/contracts";

export interface SurveyRecord {
  id: string;
  kind: string;
  resultVisibility: string;
  titleKo: string;
  titleEn: string | null;
  descriptionKo: string | null;
  descriptionEn: string | null;
  descriptionImageUrlKo: string | null;
  descriptionImageUrlEn: string | null;
  creatorId: string | null;
  publishedAt: string | null;
  connectedPostId: string | null;
  feePayersOnly: boolean;
  eligibleSocAffiliations: SurveySocAffiliation[];
  academicEligibility: SurveyAcademicEligibility;
  allowAnonymous: boolean;
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
  participationEligibility?: SurveyParticipationEligibility;
  spreadsheetId: string | null;
  spreadsheetUrl: string | null;
  spreadsheetSyncStatus: "NOT_CONNECTED" | "CONNECTED" | "ERROR";
  spreadsheetLastSyncedAt: string | null;
}

export interface SurveyRecordWithState extends SurveyRecord {
  computedState: ComputedSurveyState;
}
