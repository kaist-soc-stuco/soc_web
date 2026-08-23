import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { and, eq, gte, ilike, inArray, lte, or } from "drizzle-orm";
import type {
  CalendarEventCreateRequest,
  CalendarEventCategory,
  CalendarEventListResponse,
  CalendarEventPresentationUpdateRequest,
  CalendarEventRecord,
  CalendarEventUpdateRequest,
  CalendarExternalSyncResponse,
  CalendarGoogleSyncResponse,
  CalendarIcsImportResponse,
  CalendarKaistSyncResponse,
  KoreanHolidayRecord,
  PublicCalendarEventItem,
  PublicCalendarEventsResponse,
} from "@soc/contracts";
import { isoToDate, msToDate, msToIso, nowDate, nowMs } from "@soc/shared";

import {
  DRIZZLE_DB,
  PostgresDatabase,
} from "../../infrastructure/postgres/postgres.provider";
import {
  articles,
  boards,
  calendarEvents,
  surveys,
} from "../../infrastructure/postgres/postgres.schema";
import { CalendarSyncService } from "./calendar-sync.service";
import { addSeoulDays, formatSeoulDate } from "./calendar.utils";

const HOLIDAY_API_URL =
  "https://apis.data.go.kr/B090041/openapi/service/SpcdeInfoService/getRestDeInfo";

interface DataGoKrHolidayItem {
  locdate?: number | string;
  dateName?: string;
  isHoliday?: string;
}

interface HolidayCacheEntry {
  expiresAt: number;
  items: KoreanHolidayRecord[];
}

@Injectable()
export class CalendarService {
  private readonly logger = new Logger(CalendarService.name);
  private readonly cache = new Map<string, HolidayCacheEntry>();

  constructor(
    @Inject(DRIZZLE_DB) private readonly db: PostgresDatabase,
    private readonly configService: ConfigService,
    private readonly calendarSyncService: CalendarSyncService,
  ) {}

  async listPublicCalendarEvents(
    from: Date,
    to: Date,
    query?: string,
  ): Promise<PublicCalendarEventsResponse> {
    const [surveyEvents, articleEvents, manualEvents] = await Promise.all([
      this.listSurveyCalendarEvents(from, to, query),
      this.listArticleCalendarEvents(from, to, query),
      this.listManualCalendarEvents(from, to, query),
    ]);

    return {
      items: [...surveyEvents, ...articleEvents, ...manualEvents].sort(
        (a, b) => a.date.localeCompare(b.date) || a.titleKo.localeCompare(b.titleKo),
      ),
    };
  }

  async searchPublicCalendarEvents(
    query: string | undefined,
    limit: number,
  ): Promise<PublicCalendarEventsResponse> {
    const [surveyEvents, articleEvents, manualEvents] = await Promise.all([
      this.listSurveyCalendarEvents(undefined, undefined, query),
      this.listArticleCalendarEvents(undefined, undefined, query),
      this.listManualCalendarEvents(undefined, undefined, query),
    ]);
    const normalizedLimit = Math.min(Math.max(limit, 1), 100);

    return {
      items: [...surveyEvents, ...articleEvents, ...manualEvents]
        .sort(
          (a, b) =>
            a.date.localeCompare(b.date) || a.titleKo.localeCompare(b.titleKo),
        )
        .slice(0, normalizedLimit),
    };
  }

  async listManualEvents(): Promise<CalendarEventListResponse> {
    const rows = await this.db
      .select()
      .from(calendarEvents)
      .orderBy(calendarEvents.startAt, calendarEvents.calendarEventId);
    const holidayDates = await this.loadKoreanHolidayDates(rows);

    return { items: rows.map((row) => this.mapManualEvent(row, holidayDates)) };
  }

  async listManagedEvents(): Promise<CalendarEventListResponse> {
    return this.listManualEvents();
  }

  async createManualEvent(
    userId: string,
    input: CalendarEventCreateRequest,
  ): Promise<CalendarEventRecord> {
    const [row] = await this.db
      .insert(calendarEvents)
      .values({
        titleKo: input.titleKo,
        titleEn: input.titleEn ?? null,
        descriptionKo: input.descriptionKo ?? null,
        descriptionEn: input.descriptionEn ?? null,
        startAt: this.parseDate(input.startAt),
        endAt: this.parseDate(input.endAt),
        location: input.location ?? null,
        sourceUid: input.sourceUid ?? null,
        sourceType: "MANUAL",
        createdByUserId: userId,
      })
      .returning();

    await this.calendarSyncService.enqueueEvent(row.calendarEventId);
    return this.mapManualEvent(row);
  }

  async updateManualEvent(
    id: string,
    input: CalendarEventUpdateRequest,
  ): Promise<CalendarEventRecord> {
    const eventId = this.parseId(id);
    const current = await this.findManualEvent(eventId);
    if (!current) throw new NotFoundException("calendar_event_not_found");

    const startAt = input.startAt ? this.parseDate(input.startAt) : current.startAt;
    const endAt = input.endAt ? this.parseDate(input.endAt) : current.endAt;
    if (endAt.valueOf() < startAt.valueOf()) {
      throw new BadRequestException("calendar_end_before_start");
    }

    const [row] = await this.db
      .update(calendarEvents)
      .set({
        ...(input.titleKo !== undefined ? { titleKo: input.titleKo } : {}),
        ...(input.titleEn !== undefined ? { titleEn: input.titleEn ?? null } : {}),
        ...(input.descriptionKo !== undefined ? { descriptionKo: input.descriptionKo ?? null } : {}),
        ...(input.descriptionEn !== undefined ? { descriptionEn: input.descriptionEn ?? null } : {}),
        ...(input.startAt !== undefined ? { startAt } : {}),
        ...(input.endAt !== undefined ? { endAt } : {}),
        ...(input.location !== undefined ? { location: input.location ?? null } : {}),
        ...(input.sourceUid !== undefined ? { sourceUid: input.sourceUid ?? null } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
        updatedAt: nowDate(),
      })
      .where(
        and(
          eq(calendarEvents.calendarEventId, eventId),
          eq(calendarEvents.sourceType, "MANUAL"),
          eq(calendarEvents.isReadOnly, false),
        ),
      )
      .returning();

    if (!row) throw new NotFoundException("calendar_event_not_found");
    await this.calendarSyncService.enqueueEvent(row.calendarEventId);
    return this.mapManualEvent(row);
  }

  async archiveManualEvent(id: string): Promise<{ ok: true; calendarEventId: string }> {
    const eventId = this.parseId(id);
    const current = await this.findManualEvent(eventId);
    if (!current) throw new NotFoundException("calendar_event_not_found");
    const [row] = await this.db
      .update(calendarEvents)
      .set({
        isHiddenByAdmin: true,
        overrideUpdatedAt: nowDate(),
        updatedAt: nowDate(),
      })
      .where(
        and(
          eq(calendarEvents.calendarEventId, eventId),
          eq(calendarEvents.sourceType, "MANUAL"),
          eq(calendarEvents.isReadOnly, false),
        ),
      )
      .returning({ calendarEventId: calendarEvents.calendarEventId });

    if (!row) throw new NotFoundException("calendar_event_not_found");
    await this.calendarSyncService.enqueueEvent(eventId);
    return { ok: true, calendarEventId: String(row.calendarEventId) };
  }

  async updateEventPresentation(
    userId: string,
    id: string,
    input: CalendarEventPresentationUpdateRequest,
  ): Promise<CalendarEventRecord> {
    const eventId = this.parseId(id);
    const [current] = await this.db
      .select()
      .from(calendarEvents)
      .where(eq(calendarEvents.calendarEventId, eventId));
    if (!current) throw new NotFoundException("calendar_event_not_found");

    const [row] = await this.db
      .update(calendarEvents)
      .set({
        ...(input.categoryOverride !== undefined
          ? { categoryOverride: input.categoryOverride }
          : {}),
        ...(input.isHiddenByAdmin !== undefined
          ? { isHiddenByAdmin: input.isHiddenByAdmin }
          : {}),
        overrideUpdatedByUserId: userId,
        overrideUpdatedAt: nowDate(),
        updatedAt: nowDate(),
      })
      .where(eq(calendarEvents.calendarEventId, eventId))
      .returning();

    if (!row) throw new NotFoundException("calendar_event_not_found");
    if (input.isHiddenByAdmin !== undefined) {
      await this.calendarSyncService.enqueueEvent(row.calendarEventId);
    }
    const holidayDates = await this.loadKoreanHolidayDates([row]);
    return this.mapManualEvent(row, holidayDates);
  }

  async importIcs(userId: string, ics: string): Promise<CalendarIcsImportResponse> {
    const parsed = parseIcsEvents(ics);
    if (parsed.length === 0) {
      throw new BadRequestException("ics_event_not_found");
    }

    const uids = parsed.flatMap((item) => (item.sourceUid ? [item.sourceUid] : []));
    const existing = uids.length
      ? await this.db
          .select({ sourceUid: calendarEvents.sourceUid })
          .from(calendarEvents)
          .where(inArray(calendarEvents.sourceUid, uids))
      : [];
    const existingUids = new Set(existing.map((item) => item.sourceUid).filter(Boolean));
    const newItems = parsed.filter((item) => !item.sourceUid || !existingUids.has(item.sourceUid));

    if (newItems.length === 0) {
      return { importedCount: 0, skippedCount: parsed.length, items: [] };
    }

    const rows = await this.db
      .insert(calendarEvents)
      .values(
        newItems.map((item) => ({
          titleKo: item.titleKo,
          titleEn: item.titleEn ?? null,
          descriptionKo: item.descriptionKo ?? null,
          descriptionEn: item.descriptionEn ?? null,
          startAt: item.startAt,
          endAt: item.endAt,
          location: item.location ?? null,
          sourceUid: item.sourceUid ?? null,
          sourceType: "MANUAL",
          createdByUserId: userId,
        })),
      )
      .returning();

    const items = rows.map((row) => this.mapManualEvent(row));
    for (const row of rows) {
      await this.calendarSyncService.enqueueEvent(row.calendarEventId);
    }

    return {
      importedCount: rows.length,
      skippedCount: parsed.length - rows.length,
      items,
    };
  }

  async syncKaistAcademicCalendar(
    year: number,
  ): Promise<CalendarKaistSyncResponse> {
    return this.calendarSyncService.syncKaistAcademicCalendar(year);
  }

  async syncGoogleCalendars(): Promise<CalendarGoogleSyncResponse> {
    return this.calendarSyncService.syncGoogleCalendars();
  }

  async syncExternalCalendarIcs(userId: string): Promise<CalendarExternalSyncResponse> {
    const configuredSources = (this.configService.get<string>("CALENDAR_EXTERNAL_ICS_URLS") ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter((value) => value.length > 0)
      .filter((value) => {
        try {
          const url = new URL(value);
          return url.protocol === "https:" || (url.protocol === "http:" && this.configService.get<string>("NODE_ENV") !== "production");
        } catch {
          return false;
        }
      });

    let importedCount = 0;
    let skippedCount = 0;
    const failedSources: string[] = [];

    for (const source of configuredSources) {
      try {
        const response = await fetch(source, { signal: AbortSignal.timeout(15_000) });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const result = await this.importIcs(userId, await response.text());
        importedCount += result.importedCount;
        skippedCount += result.skippedCount;
      } catch (error) {
        failedSources.push(this.safeSourceLabel(source));
        this.logger.warn(
          `External calendar sync failed for ${this.safeSourceLabel(source)}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    return {
      sourceCount: configuredSources.length,
      importedCount,
      skippedCount,
      failedSources,
    };
  }

  async exportIcs(): Promise<string> {
    const rows = await this.db
      .select()
      .from(calendarEvents)
      .where(
        and(
          eq(calendarEvents.isActive, true),
          eq(calendarEvents.isHiddenByAdmin, false),
        ),
      )
      .orderBy(calendarEvents.startAt);

    const lines = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//KAIST SOC//Calendar//KO",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
    ];

    for (const row of rows) {
      lines.push(
        "BEGIN:VEVENT",
        `UID:${escapeIcsText(row.sourceUid ?? `soc-${row.calendarEventId}@soc.kaist.ac.kr`)}`,
        `DTSTAMP:${formatIcsDate(nowDate())}`,
        ...(row.sourceType === "KAIST_ACADEMIC"
          ? [
              `DTSTART;VALUE=DATE:${formatIcsDateOnly(row.startAt)}`,
              `DTEND;VALUE=DATE:${formatIcsDateOnly(addSeoulDays(row.endAt, 1))}`,
            ]
          : [
              `DTSTART:${formatIcsDate(row.startAt)}`,
              `DTEND:${formatIcsDate(row.endAt)}`,
            ]),
        `SUMMARY:${escapeIcsText(row.titleKo)}`,
        ...(row.descriptionKo ? [`DESCRIPTION:${escapeIcsText(row.descriptionKo)}`] : []),
        ...(row.location ? [`LOCATION:${escapeIcsText(row.location)}`] : []),
        "END:VEVENT",
      );
    }

    lines.push("END:VCALENDAR");
    return `${lines.join("\r\n")}\r\n`;
  }

  async listKoreanHolidays(
    year: number,
    month: number,
  ): Promise<KoreanHolidayRecord[]> {
    const cacheKey = `${year}-${String(month).padStart(2, "0")}`;
    const cached = this.cache.get(cacheKey);
    const now = nowMs();

    if (cached && cached.expiresAt > now) {
      return cached.items;
    }

    const holidayApiKey = this.configService
      .get<string>("KOREAN_HOLIDAY_API_KEY")
      ?.trim();
    if (!holidayApiKey) {
      this.logger.warn(
        "Korean holiday lookup is disabled because KOREAN_HOLIDAY_API_KEY is not configured.",
      );
      return [];
    }

    const params = new URLSearchParams({
      ServiceKey: holidayApiKey,
      pageNo: "1",
      numOfRows: "100",
      solYear: String(year),
      solMonth: String(month).padStart(2, "0"),
      _type: "json",
    });

    try {
      const response = await fetch(`${HOLIDAY_API_URL}?${params.toString()}`);

      if (!response.ok) {
        this.logger.warn(`Holiday API failed with HTTP ${response.status}`);
        return [];
      }

      const text = await response.text();
      const items = text.trim().startsWith("<")
        ? this.parseXmlItems(text)
        : this.parseJsonItems(text);

      const holidayItems = items
        .map((item) => ({
          locdate: String(item.locdate ?? ""),
          dateName: String(item.dateName ?? ""),
          isHoliday: item.isHoliday === "Y",
        }))
        .filter((item) => item.locdate.length === 8 && item.dateName)
        .sort((a, b) => a.locdate.localeCompare(b.locdate));

      this.cache.set(cacheKey, {
        expiresAt: now + 24 * 60 * 60 * 1000,
        items: holidayItems,
      });

      return holidayItems;
    } catch (error) {
      this.logger.warn(
        `Holiday API request failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return [];
    }
  }

  private parseJsonItems(text: string): DataGoKrHolidayItem[] {
    const payload = JSON.parse(text) as {
      response?: {
        body?: {
          items?: {
            item?: DataGoKrHolidayItem | DataGoKrHolidayItem[];
          };
        };
      };
    };
    const item = payload.response?.body?.items?.item;

    if (!item) return [];
    return Array.isArray(item) ? item : [item];
  }

  private parseXmlItems(text: string): DataGoKrHolidayItem[] {
    const itemBlocks = text.match(/<item>[\s\S]*?<\/item>/g) ?? [];

    return itemBlocks.map((block) => ({
      locdate: this.readXmlTag(block, "locdate"),
      dateName: this.readXmlTag(block, "dateName"),
      isHoliday: this.readXmlTag(block, "isHoliday"),
    }));
  }

  private readXmlTag(block: string, tag: string): string {
    const match = block.match(new RegExp(`<${tag}>(.*?)<\\/${tag}>`));
    return match?.[1] ?? "";
  }

  private async listSurveyCalendarEvents(
    from: Date | undefined,
    to: Date | undefined,
    query?: string,
  ): Promise<PublicCalendarEventItem[]> {
    const titleFilter = query?.trim()
      ? or(ilike(surveys.titleKo, `%${query.trim()}%`), ilike(surveys.titleEn, `%${query.trim()}%`))
      : undefined;
    const rows = await this.db
      .select({
        id: surveys.surveyId,
        kind: surveys.kind,
        titleKo: surveys.titleKo,
        titleEn: surveys.titleEn,
        opensAt: surveys.openAt,
      })
      .from(surveys)
      .where(
        and(
          eq(surveys.isPublished, true),
          eq(surveys.showOnCalendar, true),
          ...(titleFilter ? [titleFilter] : []),
          ...(from && to
            ? [and(gte(surveys.openAt, from), lte(surveys.openAt, to))]
            : []),
        ),
      );

    return rows.flatMap((row) => {
      const items: PublicCalendarEventItem[] = [];

      if (!row.opensAt || (from && to && !this.isWithinRange(row.opensAt, from, to))) {
        return items;
      }

      items.push({
        id: row.id,
        sourceType: "SURVEY",
        surveyId: row.id,
        kind: row.kind,
        titleKo: row.titleKo,
        titleEn: row.titleEn,
        date: msToIso(row.opensAt.valueOf()),
        dateType: "open",
      });

      return items;
    });
  }

  private async listArticleCalendarEvents(
    from: Date | undefined,
    to: Date | undefined,
    query?: string,
  ): Promise<PublicCalendarEventItem[]> {
    const titleFilter = query?.trim()
      ? or(ilike(articles.titleKo, `%${query.trim()}%`), ilike(articles.titleEn, `%${query.trim()}%`))
      : undefined;
    const rows = await this.db
      .select({
        id: articles.articleId,
        surveyId: surveys.surveyId,
        titleKo: articles.titleKo,
        titleEn: articles.titleEn,
        startsAt: articles.eventStartDate,
        endsAt: articles.eventEndDate,
      })
      .from(articles)
      .innerJoin(boards, eq(articles.boardId, boards.boardId))
      .leftJoin(
        surveys,
        and(
          eq(surveys.connectedArticleId, articles.articleId),
          eq(surveys.isPublished, true),
        ),
      )
      .where(
        and(
          eq(boards.code, "_EVENT"),
          eq(boards.isActive, true),
          eq(articles.status, "PUBLISHED"),
          eq(articles.visibilityScope, "PUBLIC"),
          ...(titleFilter ? [titleFilter] : []),
          ...(from && to
            ? [
                or(
                  and(gte(articles.eventStartDate, from), lte(articles.eventStartDate, to)),
                  and(gte(articles.eventEndDate, from), lte(articles.eventEndDate, to)),
                  and(lte(articles.eventStartDate, from), gte(articles.eventEndDate, to)),
                ),
              ]
            : []),
        ),
      );

    return rows.flatMap((row) => {
      const start = row.startsAt ?? row.endsAt;
      const end = row.endsAt ?? row.startsAt;
      if (!start || !end) return [];

      return [{
        id: String(row.id),
        sourceType: "ARTICLE" as const,
        articleId: String(row.id),
        surveyId: row.surveyId,
        kind: "EVENT",
        titleKo: row.titleKo,
        titleEn: row.titleEn,
        date: msToIso(start.valueOf()),
        dateType: "open" as const,
        startAt: msToIso(start.valueOf()),
        endAt: msToIso(end.valueOf()),
      }];
    });
  }

  private async listManualCalendarEvents(
    from: Date | undefined,
    to: Date | undefined,
    query?: string,
  ): Promise<PublicCalendarEventItem[]> {
    const titleFilter = query?.trim()
      ? or(
          ilike(calendarEvents.titleKo, `%${query.trim()}%`),
          ilike(calendarEvents.titleEn, `%${query.trim()}%`),
          ilike(calendarEvents.location, `%${query.trim()}%`),
        )
      : undefined;
    const rows = await this.db
      .select()
      .from(calendarEvents)
      .where(
        and(
          eq(calendarEvents.isActive, true),
          eq(calendarEvents.isHiddenByAdmin, false),
          ...(from && to
            ? [lte(calendarEvents.startAt, to), gte(calendarEvents.endAt, from)]
            : []),
          ...(titleFilter ? [titleFilter] : []),
        ),
      );
    const holidayDates = await this.loadKoreanHolidayDates(rows);

    return rows.map((row) => ({
      id: `manual-${row.calendarEventId}`,
      calendarEventId: String(row.calendarEventId),
      sourceType: row.sourceType === "KAIST_ACADEMIC" ? "KAIST_ACADEMIC" as const : "MANUAL" as const,
      category: this.resolveCategory(row, holidayDates),
      kind: "EVENT",
      titleKo: row.titleKo,
      titleEn: row.titleEn,
      date: msToIso(row.startAt.valueOf()),
      dateType: "open" as const,
      startAt: msToIso(row.startAt.valueOf()),
      endAt: msToIso(row.endAt.valueOf()),
      location: row.location,
    }));
  }

  private async findManualEvent(id: number) {
    const [row] = await this.db
      .select()
      .from(calendarEvents)
      .where(
        and(
          eq(calendarEvents.calendarEventId, id),
          eq(calendarEvents.sourceType, "MANUAL"),
          eq(calendarEvents.isReadOnly, false),
        ),
      );
    return row ?? null;
  }

  private mapManualEvent(
    row: typeof calendarEvents.$inferSelect,
    holidayDates = new Set<string>(),
  ): CalendarEventRecord {
    return {
      calendarEventId: String(row.calendarEventId),
      titleKo: row.titleKo,
      titleEn: row.titleEn,
      descriptionKo: row.descriptionKo,
      descriptionEn: row.descriptionEn,
      startAt: msToIso(row.startAt.valueOf()),
      endAt: msToIso(row.endAt.valueOf()),
      location: row.location,
      sourceUid: row.sourceUid,
      sourceType: row.sourceType === "KAIST_ACADEMIC" ? "KAIST_ACADEMIC" : "MANUAL",
      sourceYear: row.sourceYear,
      isReadOnly: row.isReadOnly,
      isActive: row.isActive,
      isHiddenByAdmin: row.isHiddenByAdmin,
      category: this.resolveCategory(row, holidayDates),
      categoryOverride: this.isCalendarCategory(row.categoryOverride)
        ? row.categoryOverride
        : null,
      createdByUserId: row.createdByUserId,
      googleCalendarId: row.googleCalendarId,
      googleEventId: row.googleEventId,
      googleSyncStatus: row.googleSyncStatus as CalendarEventRecord["googleSyncStatus"],
      googleSyncedAt: row.googleSyncedAt ? msToIso(row.googleSyncedAt.valueOf()) : null,
      googleSyncError: row.googleSyncError,
      createdAt: msToIso(row.createdAt.valueOf()),
      updatedAt: msToIso(row.updatedAt.valueOf()),
    };
  }

  private resolveCategory(
    row: typeof calendarEvents.$inferSelect,
    holidayDates: ReadonlySet<string>,
  ): CalendarEventCategory {
    if (this.isCalendarCategory(row.categoryOverride)) return row.categoryOverride;
    if (row.sourceType === "MANUAL") return "EVENT";
    return this.isKoreanHolidayRange(row.startAt, row.endAt, holidayDates)
      ? "HOLIDAY"
      : "ACADEMIC";
  }

  private async loadKoreanHolidayDates(
    rows: Array<typeof calendarEvents.$inferSelect>,
  ): Promise<Set<string>> {
    const months = new Set<string>();

    for (const row of rows) {
      if (
        row.sourceType !== "KAIST_ACADEMIC" ||
        this.isCalendarCategory(row.categoryOverride)
      ) {
        continue;
      }

      let cursor = row.startAt;
      const endDate = formatSeoulDate(row.endAt);
      for (let day = 0; day < 370; day += 1) {
        const date = formatSeoulDate(cursor);
        if (date > endDate) break;
        months.add(date.slice(0, 7));
        cursor = addSeoulDays(cursor, 1);
      }
    }

    const monthlyHolidays = await Promise.all(
      [...months].map(async (yearMonth) => {
        const [year, month] = yearMonth.split("-").map(Number);
        return this.listKoreanHolidays(year, month);
      }),
    );

    return new Set(
      monthlyHolidays
        .flat()
        .filter((holiday) => holiday.isHoliday)
        .map((holiday) => [
          holiday.locdate.slice(0, 4),
          holiday.locdate.slice(4, 6),
          holiday.locdate.slice(6, 8),
        ].join("-")),
    );
  }

  private isKoreanHolidayRange(
    startAt: Date,
    endAt: Date,
    holidayDates: ReadonlySet<string>,
  ): boolean {
    let cursor = startAt;
    const endDate = formatSeoulDate(endAt);
    let dateCount = 0;

    for (let day = 0; day < 370; day += 1) {
      const date = formatSeoulDate(cursor);
      if (date > endDate) break;
      if (!holidayDates.has(date)) return false;
      dateCount += 1;
      cursor = addSeoulDays(cursor, 1);
    }

    return dateCount > 0;
  }

  private isCalendarCategory(value: string | null): value is CalendarEventCategory {
    return value === "EVENT" || value === "ACADEMIC" || value === "HOLIDAY";
  }

  private parseDate(value: string): Date {
    const date = isoToDate(value);
    if (Number.isNaN(date.valueOf())) {
      throw new BadRequestException("invalid_calendar_datetime");
    }
    return date;
  }

  private parseId(value: string): number {
    const id = Number(value);
    if (!Number.isInteger(id) || id <= 0) {
      throw new BadRequestException("invalid_calendar_event_id");
    }
    return id;
  }

  private isWithinRange(date: Date | null, from: Date, to: Date): date is Date {
    if (!date) return false;
    const time = date.valueOf();
    return time >= from.valueOf() && time <= to.valueOf();
  }

  private safeSourceLabel(source: string): string {
    try {
      return new URL(source).hostname;
    } catch {
      return "invalid-source";
    }
  }
}

interface ParsedIcsEvent {
  titleKo: string;
  titleEn?: string;
  descriptionKo?: string;
  descriptionEn?: string;
  startAt: Date;
  endAt: Date;
  location?: string;
  sourceUid?: string;
}

function parseIcsEvents(input: string): ParsedIcsEvent[] {
  const lines = input.replace(/\r\n[ \t]/g, "").replace(/\n[ \t]/g, "").split(/\r?\n/);
  const events: ParsedIcsEvent[] = [];
  let current: Record<string, string> | null = null;

  for (const line of lines) {
    if (line.toUpperCase() === "BEGIN:VEVENT") {
      current = {};
      continue;
    }
    if (line.toUpperCase() === "END:VEVENT") {
      if (current) {
        const start = parseIcsDate(current.DTSTART);
        const rawEnd = parseIcsDate(current.DTEND);
        if (current.SUMMARY && start && rawEnd) {
          const isDateOnly = current.DTSTART_PARAMS?.includes("VALUE=DATE") || /^\d{8}$/.test(current.DTSTART ?? "");
          const end = isDateOnly ? msToDate(rawEnd.valueOf() - 1) : rawEnd;
          events.push({
            titleKo: unescapeIcsText(current.SUMMARY),
            descriptionKo: current.DESCRIPTION ? unescapeIcsText(current.DESCRIPTION) : undefined,
            startAt: start,
            endAt: end.valueOf() >= start.valueOf() ? end : start,
            location: current.LOCATION ? unescapeIcsText(current.LOCATION) : undefined,
            sourceUid: current.UID ? unescapeIcsText(current.UID) : undefined,
          });
        }
      }
      current = null;
      continue;
    }
    if (!current) continue;
    const separator = line.indexOf(":");
    if (separator <= 0) continue;
    const keyWithParams = line.slice(0, separator).toUpperCase();
    const value = line.slice(separator + 1);
    const [key, ...params] = keyWithParams.split(";");
    current[key] = value;
    if (params.length > 0) current[`${key}_PARAMS`] = params.join(";");
  }

  return events;
}

function parseIcsDate(value: string | undefined): Date | null {
  if (!value) return null;
  if (/^\d{8}$/.test(value)) {
    const year = Number(value.slice(0, 4));
    const month = Number(value.slice(4, 6)) - 1;
    const day = Number(value.slice(6, 8));
    return msToDate(Date.UTC(year, month, day));
  }
  if (/^\d{8}T\d{6}Z$/.test(value)) {
    const year = Number(value.slice(0, 4));
    const month = Number(value.slice(4, 6)) - 1;
    const day = Number(value.slice(6, 8));
    const hour = Number(value.slice(9, 11));
    const minute = Number(value.slice(11, 13));
    const second = Number(value.slice(13, 15));
    return msToDate(Date.UTC(year, month, day, hour, minute, second));
  }
  if (/^\d{8}T\d{6}$/.test(value)) {
    const year = Number(value.slice(0, 4));
    const month = Number(value.slice(4, 6)) - 1;
    const day = Number(value.slice(6, 8));
    const hour = Number(value.slice(9, 11));
    const minute = Number(value.slice(11, 13));
    const second = Number(value.slice(13, 15));
    return msToDate(Date.UTC(year, month, day, hour, minute, second));
  }
  const parsed = isoToDate(value);
  return Number.isNaN(parsed.valueOf()) ? null : parsed;
}

function unescapeIcsText(value: string): string {
  return value.replace(/\\n/gi, "\n").replace(/\\,/g, ",").replace(/\\;/g, ";").replace(/\\\\/g, "\\");
}

function escapeIcsText(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/\r?\n/g, "\\n").replace(/;/g, "\\;").replace(/,/g, "\\,");
}

function formatIcsDate(date: Date): string {
  const iso = date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  return iso;
}

function formatIcsDateOnly(date: Date): string {
  const iso = date.toISOString();
  return iso.slice(0, 10).replace(/-/g, "");
}
