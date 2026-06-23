import type {
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
  }): Promise<PublicCalendarEventsResponse> => {
    const query = new URLSearchParams({
      from: params.from,
      to: params.to,
    });

    return requestJson<PublicCalendarEventsResponse>(
      `${calendarBaseUrl}/events?${query.toString()}`,
      { method: "GET" },
    );
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
