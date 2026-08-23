import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  Patch,
  Post,
  ParseIntPipe,
  Query,
  Req,
} from "@nestjs/common";
import {
  CalendarEventCreateSchema,
  CalendarEventPresentationUpdateSchema,
  CalendarEventUpdateSchema,
  CalendarIcsImportSchema,
  Permissions,
} from "@soc/contracts";
import type {
  CalendarEventCreateRequest,
  CalendarEventListResponse,
  CalendarEventPresentationUpdateRequest,
  CalendarEventRecord,
  CalendarEventUpdateRequest,
  CalendarExternalSyncResponse,
  CalendarGoogleSyncResponse,
  CalendarIcsImportRequest,
  CalendarIcsImportResponse,
  CalendarKaistSyncResponse,
  KoreanHolidayRecord,
  PublicCalendarEventsResponse,
} from "@soc/contracts";
import { isoToDate } from "@soc/shared";
import type { Request } from "express";

import { RequirePermissions } from "../auth/guards";
import { ZodValidationPipe } from "../../shared/pipes/zod-validation.pipe";
import { CalendarService } from "./calendar.service";
import { seoulYear } from "./calendar.utils";

type AuthenticatedRequest = Request & { user?: { id: string } };

@Controller("calendar")
export class CalendarController {
  constructor(private readonly calendarService: CalendarService) {}

  @Get("events")
  async listPublicCalendarEvents(
    @Query("from") from: string,
    @Query("to") to: string,
    @Query("q") query?: string,
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

    return this.calendarService.listPublicCalendarEvents(fromDate, toDate, query);
  }

  @Get("search")
  async searchPublicCalendarEvents(
    @Query("q") query?: string,
    @Query("limit", new ParseIntPipe({ optional: true })) limit?: number,
  ): Promise<PublicCalendarEventsResponse> {
    return this.calendarService.searchPublicCalendarEvents(query, limit ?? 40);
  }

  @Get("manual")
  @RequirePermissions(Permissions.MANAGE_CONTENT)
  async listManualEvents(): Promise<CalendarEventListResponse> {
    return this.calendarService.listManualEvents();
  }

  @Get("admin/events")
  @RequirePermissions(Permissions.MANAGE_CONTENT)
  async listManagedEvents(): Promise<CalendarEventListResponse> {
    return this.calendarService.listManagedEvents();
  }

  @Patch("admin/events/:id/presentation")
  @RequirePermissions(Permissions.MANAGE_CONTENT)
  async updateEventPresentation(
    @Req() request: AuthenticatedRequest,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(CalendarEventPresentationUpdateSchema))
    body: CalendarEventPresentationUpdateRequest,
  ): Promise<CalendarEventRecord> {
    return this.calendarService.updateEventPresentation(request.user!.id, id, body);
  }

  @Get("manual/export")
  @RequirePermissions(Permissions.MANAGE_CONTENT)
  @Header("Content-Type", "text/calendar; charset=utf-8")
  @Header("Content-Disposition", "attachment; filename=\"soc-calendar.ics\"")
  async exportIcs(): Promise<string> {
    return this.calendarService.exportIcs();
  }

  @Post("manual")
  @RequirePermissions(Permissions.MANAGE_CONTENT)
  async createManualEvent(
    @Req() request: AuthenticatedRequest,
    @Body(new ZodValidationPipe(CalendarEventCreateSchema))
    body: CalendarEventCreateRequest,
  ): Promise<CalendarEventRecord> {
    return this.calendarService.createManualEvent(request.user!.id, body);
  }

  @Post("manual/sync-external")
  @RequirePermissions(Permissions.MANAGE_CONTENT)
  async syncExternalCalendarIcs(
    @Req() request: AuthenticatedRequest,
  ): Promise<CalendarExternalSyncResponse> {
    return this.calendarService.syncExternalCalendarIcs(request.user!.id);
  }

  @Post("manual/sync-kaist")
  @RequirePermissions(Permissions.MANAGE_CONTENT)
  async syncKaistAcademicCalendar(
    @Query("year") year?: string,
  ): Promise<CalendarKaistSyncResponse> {
    const parsedYear = year === undefined ? seoulYear() : Number(year);
    if (!Number.isInteger(parsedYear) || parsedYear < 2000 || parsedYear > 2100) {
      throw new BadRequestException("Invalid year");
    }
    return this.calendarService.syncKaistAcademicCalendar(parsedYear);
  }

  @Post("manual/sync-google")
  @RequirePermissions(Permissions.MANAGE_CONTENT)
  async syncGoogleCalendars(): Promise<CalendarGoogleSyncResponse> {
    return this.calendarService.syncGoogleCalendars();
  }

  @Post("manual/import")
  @RequirePermissions(Permissions.MANAGE_CONTENT)
  async importIcs(
    @Req() request: AuthenticatedRequest,
    @Body(new ZodValidationPipe(CalendarIcsImportSchema))
    body: CalendarIcsImportRequest,
  ): Promise<CalendarIcsImportResponse> {
    return this.calendarService.importIcs(request.user!.id, body.ics);
  }

  @Patch("manual/:id")
  @RequirePermissions(Permissions.MANAGE_CONTENT)
  async updateManualEvent(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(CalendarEventUpdateSchema))
    body: CalendarEventUpdateRequest,
  ): Promise<CalendarEventRecord> {
    return this.calendarService.updateManualEvent(id, body);
  }

  @Delete("manual/:id")
  @RequirePermissions(Permissions.MANAGE_CONTENT)
  async archiveManualEvent(
    @Param("id") id: string,
  ): Promise<{ ok: true; calendarEventId: string }> {
    return this.calendarService.archiveManualEvent(id);
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
