import { Inject, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { and, eq, gte, lte, or } from "drizzle-orm";
import type {
  KoreanHolidayRecord,
  PublicCalendarEventItem,
  PublicCalendarEventsResponse,
} from "@soc/contracts";
import { msToIso, nowMs } from "@soc/shared";

import {
  DRIZZLE_DB,
  PostgresDatabase,
} from "../../infrastructure/postgres/postgres.provider";
import {
  articles,
  boards,
  surveys,
} from "../../infrastructure/postgres/postgres.schema";

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
  ) {}

  async listPublicCalendarEvents(
    from: Date,
    to: Date,
  ): Promise<PublicCalendarEventsResponse> {
    const [surveyEvents, articleEvents] = await Promise.all([
      this.listSurveyCalendarEvents(from, to),
      this.listArticleCalendarEvents(from, to),
    ]);

    return {
      items: [...surveyEvents, ...articleEvents].sort(
        (a, b) => a.date.localeCompare(b.date) || a.titleKo.localeCompare(b.titleKo),
      ),
    };
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
    from: Date,
    to: Date,
  ): Promise<PublicCalendarEventItem[]> {
    const rows = await this.db
      .select({
        id: surveys.surveyId,
        kind: surveys.kind,
        titleKo: surveys.titleKo,
        titleEn: surveys.titleEn,
        opensAt: surveys.openAt,
        closesAt: surveys.closeAt,
      })
      .from(surveys)
      .where(
        and(
          eq(surveys.isPublished, true),
          eq(surveys.showOnCalendar, true),
          or(
            and(gte(surveys.openAt, from), lte(surveys.openAt, to)),
            and(gte(surveys.closeAt, from), lte(surveys.closeAt, to)),
          ),
        ),
      );

    return rows.flatMap((row) => {
      const items: PublicCalendarEventItem[] = [];

      if (this.isWithinRange(row.opensAt, from, to)) {
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
      }

      if (this.isWithinRange(row.closesAt, from, to)) {
        items.push({
          id: row.id,
          sourceType: "SURVEY",
          surveyId: row.id,
          kind: row.kind,
          titleKo: row.titleKo,
          titleEn: row.titleEn,
          date: msToIso(row.closesAt.valueOf()),
          dateType: "close",
        });
      }

      return items;
    });
  }

  private async listArticleCalendarEvents(
    from: Date,
    to: Date,
  ): Promise<PublicCalendarEventItem[]> {
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
          eq(boards.code, "행사"),
          eq(boards.isActive, true),
          eq(boards.readScope, "PUBLIC"),
          eq(articles.status, "PUBLISHED"),
          eq(articles.visibilityScope, "PUBLIC"),
          or(
            and(gte(articles.eventStartDate, from), lte(articles.eventStartDate, to)),
            and(gte(articles.eventEndDate, from), lte(articles.eventEndDate, to)),
          ),
        ),
      );

    return rows.flatMap((row) => {
      const items: PublicCalendarEventItem[] = [];

      if (this.isWithinRange(row.startsAt, from, to)) {
        items.push({
          id: String(row.id),
          sourceType: "ARTICLE",
          articleId: String(row.id),
          surveyId: row.surveyId,
          kind: "EVENT",
          titleKo: row.titleKo,
          titleEn: row.titleEn,
          date: msToIso(row.startsAt.valueOf()),
          dateType: "open",
        });
      }

      if (this.isWithinRange(row.endsAt, from, to)) {
        items.push({
          id: String(row.id),
          sourceType: "ARTICLE",
          articleId: String(row.id),
          surveyId: row.surveyId,
          kind: "EVENT",
          titleKo: row.titleKo,
          titleEn: row.titleEn,
          date: msToIso(row.endsAt.valueOf()),
          dateType: "close",
        });
      }

      return items;
    });
  }

  private isWithinRange(date: Date | null, from: Date, to: Date): date is Date {
    if (!date) return false;
    const time = date.valueOf();
    return time >= from.valueOf() && time <= to.valueOf();
  }
}
