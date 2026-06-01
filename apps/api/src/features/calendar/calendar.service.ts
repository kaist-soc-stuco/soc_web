import { Injectable, Logger } from "@nestjs/common";
import type { KoreanHolidayRecord } from "@soc/contracts";
import { nowMs } from "@soc/shared";

const HOLIDAY_API_KEY =
  "20cf41ac7ae1a30ef4bf27e3ad0141f41ec3e815aea7c45c0972fbf90a1070bb";
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

    const params = new URLSearchParams({
      ServiceKey: HOLIDAY_API_KEY,
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
}
