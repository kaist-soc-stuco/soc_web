import type {
  CalendarEventCreateRequest,
  CalendarEventListResponse,
  CalendarEventPresentationUpdateRequest,
  CalendarEventRecord,
  CalendarEventUpdateRequest,
  CalendarExternalSyncResponse,
  CalendarGoogleSyncResponse,
  CalendarIcsImportResponse,
  CalendarKaistSyncResponse,
  KoreanHolidayRecord,
  PublicCalendarEventsResponse,
} from "@soc/contracts";

import type { ApiClientContext } from "./core.js";

export const createCalendarApi = ({
  calendarBaseUrl,
  requestJson,
}: ApiClientContext) => ({
  getPublicCalendarEvents: async (params: {
    from: string;
    to: string;
    q?: string;
  }): Promise<PublicCalendarEventsResponse> => {
    const query = new URLSearchParams({
      from: params.from,
      to: params.to,
    });
    if (params.q?.trim()) query.set("q", params.q.trim());

    return requestJson<PublicCalendarEventsResponse>(
      `${calendarBaseUrl}/events?${query.toString()}`,
      { method: "GET" },
    );
  },

  searchPublicCalendarEvents: async (
    query: string,
    limit = 40,
  ): Promise<PublicCalendarEventsResponse> => {
    const params = new URLSearchParams({
      q: query.trim(),
      limit: String(limit),
    });

    return requestJson<PublicCalendarEventsResponse>(
      `${calendarBaseUrl}/search?${params.toString()}`,
      { method: "GET" },
    );
  },

  getManualCalendarEvents: async (): Promise<CalendarEventListResponse> => {
    return requestJson<CalendarEventListResponse>(
      `${calendarBaseUrl}/manual`,
      { method: "GET" },
      { retryOnUnauthorized: true },
    );
  },

  getManagedCalendarEvents: async (): Promise<CalendarEventListResponse> => {
    return requestJson<CalendarEventListResponse>(
      `${calendarBaseUrl}/admin/events`,
      { method: "GET" },
      { retryOnUnauthorized: true },
    );
  },

  updateCalendarEventPresentation: async (
    id: string,
    input: CalendarEventPresentationUpdateRequest,
  ): Promise<CalendarEventRecord> => {
    return requestJson<CalendarEventRecord>(
      `${calendarBaseUrl}/admin/events/${encodeURIComponent(id)}/presentation`,
      {
        body: JSON.stringify(input),
        headers: { "Content-Type": "application/json" },
        method: "PATCH",
      },
      { retryOnUnauthorized: true },
    );
  },

  createManualCalendarEvent: async (
    input: CalendarEventCreateRequest,
  ): Promise<CalendarEventRecord> => {
    return requestJson<CalendarEventRecord>(
      `${calendarBaseUrl}/manual`,
      {
        body: JSON.stringify(input),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      },
      { retryOnUnauthorized: true },
    );
  },

  updateManualCalendarEvent: async (
    id: string,
    input: CalendarEventUpdateRequest,
  ): Promise<CalendarEventRecord> => {
    return requestJson<CalendarEventRecord>(
      `${calendarBaseUrl}/manual/${encodeURIComponent(id)}`,
      {
        body: JSON.stringify(input),
        headers: { "Content-Type": "application/json" },
        method: "PATCH",
      },
      { retryOnUnauthorized: true },
    );
  },

  archiveManualCalendarEvent: async (
    id: string,
  ): Promise<{ ok: true; calendarEventId: string }> => {
    return requestJson<{ ok: true; calendarEventId: string }>(
      `${calendarBaseUrl}/manual/${encodeURIComponent(id)}`,
      { method: "DELETE" },
      { retryOnUnauthorized: true },
    );
  },

  importCalendarIcs: async (ics: string): Promise<CalendarIcsImportResponse> => {
    return requestJson<CalendarIcsImportResponse>(
      `${calendarBaseUrl}/manual/import`,
      {
        body: JSON.stringify({ ics }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      },
      { retryOnUnauthorized: true },
    );
  },

  syncExternalCalendarIcs: async (): Promise<CalendarExternalSyncResponse> => {
    return requestJson<CalendarExternalSyncResponse>(
      `${calendarBaseUrl}/manual/sync-external`,
      { method: "POST" },
      { retryOnUnauthorized: true },
    );
  },

  syncKaistAcademicCalendar: async (
    year?: number,
  ): Promise<CalendarKaistSyncResponse> => {
    const query = year ? `?year=${encodeURIComponent(String(year))}` : "";
    return requestJson<CalendarKaistSyncResponse>(
      `${calendarBaseUrl}/manual/sync-kaist${query}`,
      { method: "POST" },
      { retryOnUnauthorized: true },
    );
  },

  syncGoogleCalendars: async (): Promise<CalendarGoogleSyncResponse> => {
    return requestJson<CalendarGoogleSyncResponse>(
      `${calendarBaseUrl}/manual/sync-google`,
      { method: "POST" },
      { retryOnUnauthorized: true },
    );
  },

  exportCalendarIcs: async (): Promise<Blob> => {
    const response = await fetch(`${calendarBaseUrl}/manual/export`, {
      credentials: "include",
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.blob();
  },

  getKoreanHolidays: async (
    year: number,
    month: number,
  ): Promise<KoreanHolidayRecord[]> => {
    const params = new URLSearchParams({
      year: String(year),
      month: String(month).padStart(2, "0"),
    });

    return requestJson<KoreanHolidayRecord[]>(
      `${calendarBaseUrl}/holidays?${params.toString()}`,
      { method: "GET" },
    );
  },
});
