import type { ResponseStatus } from "@soc/contracts";

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
