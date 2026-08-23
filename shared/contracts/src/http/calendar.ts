import type {
  CalendarEventCreateSchema,
  CalendarEventPresentationUpdateSchema,
  CalendarEventUpdateSchema,
  CalendarIcsImportSchema,
} from "../schemas.js";
import type { z } from "zod";

export interface KoreanHolidayRecord {
  locdate: string;
  dateName: string;
  isHoliday: boolean;
}

export type CalendarEventDateType = "open" | "close";
export type CalendarEventCategory = "EVENT" | "ACADEMIC" | "HOLIDAY";
export type PublicCalendarEventSourceType =
  | "ARTICLE"
  | "SURVEY"
  | "MANUAL"
  | "KAIST_ACADEMIC";

export interface PublicCalendarEventItem {
  id: string;
  sourceType: PublicCalendarEventSourceType;
  articleId?: string | null;
  surveyId?: string | null;
  kind: string;
  titleKo: string;
  titleEn?: string | null;
  date: string;
  dateType: CalendarEventDateType;
  startAt?: string;
  endAt?: string;
  location?: string | null;
  calendarEventId?: string | null;
  category?: CalendarEventCategory;
}

export interface PublicCalendarEventsResponse {
  items: PublicCalendarEventItem[];
}

export interface CalendarEventRecord {
  calendarEventId: string;
  titleKo: string;
  titleEn?: string | null;
  descriptionKo?: string | null;
  descriptionEn?: string | null;
  startAt: string;
  endAt: string;
  location?: string | null;
  sourceUid?: string | null;
  sourceType: "MANUAL" | "KAIST_ACADEMIC";
  sourceYear?: number | null;
  isReadOnly: boolean;
  isActive: boolean;
  isHiddenByAdmin: boolean;
  category: CalendarEventCategory;
  categoryOverride?: CalendarEventCategory | null;
  createdByUserId?: string | null;
  googleCalendarId?: string | null;
  googleEventId?: string | null;
  googleSyncStatus: "NOT_CONFIGURED" | "PENDING" | "SYNCED" | "FAILED" | "CONFLICT";
  googleSyncedAt?: string | null;
  googleSyncError?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CalendarEventListResponse {
  items: CalendarEventRecord[];
}

export type CalendarEventCreateRequest = z.infer<typeof CalendarEventCreateSchema>;
export type CalendarEventUpdateRequest = z.infer<typeof CalendarEventUpdateSchema>;
export type CalendarEventPresentationUpdateRequest = z.infer<typeof CalendarEventPresentationUpdateSchema>;
export type CalendarIcsImportRequest = z.infer<typeof CalendarIcsImportSchema>;

export interface CalendarIcsImportResponse {
  importedCount: number;
  skippedCount: number;
  items: CalendarEventRecord[];
}

export interface CalendarExternalSyncResponse {
  sourceCount: number;
  importedCount: number;
  skippedCount: number;
  failedSources: string[];
}

export interface CalendarKaistSyncResponse {
  year: number;
  fetchedCount: number;
  insertedCount: number;
  updatedCount: number;
  unchangedCount: number;
  archivedCount: number;
  googleQueuedCount: number;
  failedMonths: number[];
}

export interface CalendarGoogleSyncResponse {
  queuedCount: number;
  processedCount: number;
  succeededCount: number;
  failedCount: number;
}
