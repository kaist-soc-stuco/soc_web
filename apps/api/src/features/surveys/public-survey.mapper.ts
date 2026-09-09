import type {
  PublicSurveyDetailResponse,
  PublicSurveyRecord,
  SurveyDetailResponse,
} from "@soc/contracts";

import type { SurveyRecordWithState } from "./entities/survey.entity";

/** Strip fields that belong to administration and integrations. */
export function toPublicSurveyRecord(
  survey: SurveyRecordWithState,
): PublicSurveyRecord {
  const {
    creatorId: _creatorId,
    derivedVersionCount: _derivedVersionCount,
    previousVersionId: _previousVersionId,
    spreadsheetId: _spreadsheetId,
    spreadsheetLastSyncedAt: _spreadsheetLastSyncedAt,
    spreadsheetSyncStatus: _spreadsheetSyncStatus,
    spreadsheetUrl: _spreadsheetUrl,
    versionNumber: _versionNumber,
    ...publicSurvey
  } = survey;
  return publicSurvey;
}

export function toPublicSurveyDetail(
  detail: SurveyDetailResponse,
): PublicSurveyDetailResponse {
  const {
    creatorId: _creatorId,
    derivedVersionCount: _derivedVersionCount,
    previousVersionId: _previousVersionId,
    spreadsheetId: _spreadsheetId,
    spreadsheetLastSyncedAt: _spreadsheetLastSyncedAt,
    spreadsheetSyncStatus: _spreadsheetSyncStatus,
    spreadsheetUrl: _spreadsheetUrl,
    versionNumber: _versionNumber,
    ...publicDetail
  } = detail;
  return publicDetail;
}
