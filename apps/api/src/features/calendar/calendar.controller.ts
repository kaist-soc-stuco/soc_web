import { BadRequestException, Controller, Get, Query } from "@nestjs/common";
import type { KoreanHolidayRecord } from "@soc/contracts";

import { CalendarService } from "./calendar.service";

@Controller("calendar")
export class CalendarController {
  constructor(private readonly calendarService: CalendarService) {}

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
}

