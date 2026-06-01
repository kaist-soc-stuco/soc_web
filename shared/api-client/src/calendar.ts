import type { KoreanHolidayRecord } from "@soc/contracts";

import type { ApiClientContext } from "./core";

export const createCalendarApi = ({
  calendarBaseUrl,
  requestJson,
}: ApiClientContext) => ({
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

