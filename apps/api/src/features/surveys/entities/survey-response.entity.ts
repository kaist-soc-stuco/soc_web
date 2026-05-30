import type { ResponseStatus } from "@soc/contracts";
import type { SurveyResponseUserRecord } from "@soc/contracts";

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
