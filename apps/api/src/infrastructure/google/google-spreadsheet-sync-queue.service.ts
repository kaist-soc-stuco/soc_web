import { Injectable } from "@nestjs/common";

export const GOOGLE_SHEET_RESOURCE = {
  CONTACTS: "CONTACTS",
  STUDENT_FEES: "STUDENT_FEES",
  SURVEY: "SURVEY",
} as const;

type GoogleSheetResourceType =
  (typeof GOOGLE_SHEET_RESOURCE)[keyof typeof GOOGLE_SHEET_RESOURCE];
export interface GoogleSpreadsheetSyncJobContext {
  jobId: string;
  resourceKey: string;
  resourceType: GoogleSheetResourceType;
  revision: number;
  claimToken: string;
  leaseUntil: Date;
  isCurrentClaim: () => Promise<boolean>;
}
type SyncHandler = (
  resourceKey: string,
  context: GoogleSpreadsheetSyncJobContext,
) => Promise<void>;

/** Retired: internal data is no longer queued or sent to Google Sheets. */
@Injectable()
export class GoogleSpreadsheetSyncQueueService {
  registerHandler(_resourceType: GoogleSheetResourceType, _handler: SyncHandler): void {}
  async enqueue(_resourceType: GoogleSheetResourceType, _resourceKey = "global"): Promise<void> {}
  async processPendingJobs(_limit = 25) { return { processedCount: 0, succeededCount: 0, failedCount: 0 }; }
  async processQueue(): Promise<void> {}
}
