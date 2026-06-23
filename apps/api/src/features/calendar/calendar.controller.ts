import { BadRequestException, Controller, Get, Query } from "@nestjs/common";
import type {
  KoreanHolidayRecord,
  PublicCalendarEventsResponse,
} from "@soc/contracts";
import { isoToDate } from "@soc/shared";

import { CalendarService } from "./calendar.service";

@Controller("calendar")
export class CalendarController {
  constructor(private readonly calendarService: CalendarService) {}

  @Get("events")
  async listPublicCalendarEvents(
    @Query("from") from: string,
    @Query("to") to: string,
  ): Promise<PublicCalendarEventsResponse> {
    const fromDate = this.parseRangeDate(from);
    const toDate = this.parseRangeDate(to);

    if (fromDate.valueOf() > toDate.valueOf()) {
      throw new BadRequestException("Invalid date range");
    }

    const maxRangeMs = 370 * 24 * 60 * 60 * 1000;
    if (toDate.valueOf() - fromDate.valueOf() > maxRangeMs) {
      throw new BadRequestException("Date range is too large");
    }

    return this.calendarService.listPublicCalendarEvents(fromDate, toDate);
  }

  @Get("holidays")
  async listKoreanHolidays(
    @Query("year") year: string,
    @Query("month") month: string,
  ): Promise<KoreanHolidayRecord[]> {
    const parsedYear = Number(year);
    const parsedMonth = Number(month);

    if (
      !Number.isInteger(parsedYear) ||
      !Number.isInteger(parsedMonth) ||
      parsedYear < 1900 ||
      parsedYear > 2100 ||
      parsedMonth < 1 ||
      parsedMonth > 12
    ) {
      throw new BadRequestException("Invalid year or month");
    }

    return this.calendarService.listKoreanHolidays(parsedYear, parsedMonth);
  }

  private parseRangeDate(value: string | undefined): Date {
    if (!value) {
      throw new BadRequestException("Missing date range");
    }

    const date = isoToDate(value);
    if (Number.isNaN(date.valueOf())) {
      throw new BadRequestException("Invalid date range");
    }

    return date;
  }
}
