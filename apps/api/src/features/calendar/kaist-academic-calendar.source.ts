import { createHash } from "node:crypto";

import { Injectable, Logger } from "@nestjs/common";
import * as cheerio from "cheerio";
import { msToDate } from "@soc/shared";

import {
  seoulEndOfDay,
  seoulStartOfDay,
} from "./calendar.utils";

const KAIST_CALENDAR_URL = "https://kaist.ac.kr/kr/html/edu/03110101.html";
const REQUEST_DELAY_MS = 300;
const REQUEST_TIMEOUT_MS = 15_000;

export interface KaistAcademicCalendarItem {
  titleKo: string;
  startAt: Date;
  endAt: Date;
  sourceUid: string;
  sourceHash: string;
  sourceYear: number;
}

interface ParsedDateRange {
  startYear: number;
  startMonth: number;
  startDay: number;
  endYear: number;
  endMonth: number;
  endDay: number;
}

@Injectable()
export class KaistAcademicCalendarSource {
  private readonly logger = new Logger(KaistAcademicCalendarSource.name);

  async fetchYear(year: number): Promise<{
    items: KaistAcademicCalendarItem[];
    failedMonths: number[];
  }> {
    const rawItems: Array<{ dates: string; title: string }> = [];
    const failedMonths: number[] = [];

    // KAIST's endpoint accepts one month per request. Keep this sequential so
    // the batch does not create a burst of 12 simultaneous requests.
    for (let month = 1; month <= 12; month += 1) {
      if (month > 1) await sleep(REQUEST_DELAY_MS);

      try {
        rawItems.push(...(await this.fetchMonth(year, month)));
      } catch (error) {
        failedMonths.push(month);
        this.logger.warn(
          `KAIST academic calendar ${year}-${String(month).padStart(2, "0")} failed: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }

    const items: KaistAcademicCalendarItem[] = [];
    const seen = new Set<string>();

    for (const raw of rawItems) {
      const titleKo = cleanTitle(raw.title);
      const dateRange = parseDateRange(year, raw.dates);
      if (!titleKo || !dateRange) continue;

      const startDateKey = dateKey(
        dateRange.startYear,
        dateRange.startMonth,
        dateRange.startDay,
      );
      const endDateKey = dateKey(
        dateRange.endYear,
        dateRange.endMonth,
        dateRange.endDay,
      );
      const hashInput = `${year}-${String(dateRange.startMonth).padStart(2, "0")}-${startDateKey}-${endDateKey}-${titleKo}`;
      const sourceHash = createHash("sha256").update(hashInput, "utf8").digest("hex");
      const sourceUid = `kaist:${year}:${sourceHash}`;

      // The same event can be returned by more than one monthly view. The
      // normalized full-period key makes that repeat idempotent.
      if (seen.has(sourceUid)) continue;
      seen.add(sourceUid);

      items.push({
        titleKo,
        startAt: seoulStartOfDay(
          dateRange.startYear,
          dateRange.startMonth,
          dateRange.startDay,
        ),
        endAt: seoulEndOfDay(
          dateRange.endYear,
          dateRange.endMonth,
          dateRange.endDay,
        ),
        sourceUid,
        sourceHash,
        sourceYear: year,
      });
    }

    return { items, failedMonths };
  }

  private async fetchMonth(
    year: number,
    month: number,
  ): Promise<Array<{ dates: string; title: string }>> {
    const body = new URLSearchParams({
      groups: "university",
      year: String(year),
      month: String(month).padStart(2, "0"),
    });
    const response = await fetch(KAIST_CALENDAR_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "KAIST-SOC-Web/1.0 academic-calendar-sync",
      },
      body,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const html = await response.text();
    const $ = cheerio.load(html);
    const items: Array<{ dates: string; title: string }> = [];

    $(".schedule_table tr").each((_, element) => {
      const cells = $(element).find("td");
      if (cells.length < 2) return;

      const dates = $(cells[0]).text().replace(/\s+/g, " ").trim();
      const title = $(cells[1]).text().replace(/\s+/g, " ").trim();
      if (dates && title) items.push({ dates, title });
    });

    return items;
  }
}

function parseDateRange(year: number, value: string): ParsedDateRange | null {
  const matches = [...value.matchAll(/(\d{1,2})\s*[./-]\s*(\d{1,2})/g)];
  if (matches.length === 0) return null;

  const startMonth = Number(matches[0][1]);
  const startDay = Number(matches[0][2]);
  const endMatch = matches[1] ?? matches[0];
  const endMonth = Number(endMatch[1]);
  const endDay = Number(endMatch[2]);

  const endYear = endMonth < startMonth ? year + 1 : year;
  if (!isValidMonthDay(year, startMonth, startDay) || !isValidMonthDay(endYear, endMonth, endDay)) {
    return null;
  }

  return {
    startYear: year,
    startMonth,
    startDay,
    endYear,
    endMonth,
    endDay,
  };
}

function isValidMonthDay(year: number, month: number, day: number): boolean {
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const candidate = msToDate(Date.UTC(year, month - 1, day));
  return candidate.getUTCFullYear() === year &&
    candidate.getUTCMonth() === month - 1 &&
    candidate.getUTCDate() === day;
}

function dateKey(year: number, month: number, day: number): string {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function cleanTitle(value: string): string {
  return value
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
