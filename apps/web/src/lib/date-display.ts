import { isoToDate, msToDate, nowDate } from "@soc/shared";

export type DisplayDateValue = string | Date | null | undefined;

function toLocalDate(value: DisplayDateValue): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? msToDate(value.getTime()) : isoToDate(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * The shared date-only display rule:
 * - current year: `8월 21일` in Korean / `08.21` in numeric English UI
 * - another year: include the year before the same month/day format
 */
export function formatShortDate(
  value: DisplayDateValue,
  lang: string = "ko",
  referenceDate: Date = nowDate(),
): string {
  const date = toLocalDate(value);
  if (!date) return "";

  const month = date.getMonth() + 1;
  const day = date.getDate();
  const sameYear = date.getFullYear() === referenceDate.getFullYear();

  if (lang === "ko") {
    return sameYear
      ? `${month}월 ${day}일`
      : `${date.getFullYear()}년 ${month}월 ${day}일`;
  }

  const monthText = String(month).padStart(2, "0");
  const dayText = String(day).padStart(2, "0");
  return sameYear
    ? `${monthText}.${dayText}`
    : `${date.getFullYear()}.${monthText}.${dayText}`;
}

export function formatNumericDate(
  value: DisplayDateValue,
  referenceDate: Date = nowDate(),
): string {
  const date = toLocalDate(value);
  if (!date) return "";
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return date.getFullYear() === referenceDate.getFullYear()
    ? `${month}.${day}`
    : `${date.getFullYear()}.${month}.${day}`;
}

function formatNumericDatePart(date: Date, includeYear: boolean): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return includeYear
    ? `${date.getFullYear()}.${month}.${day}`
    : `${month}.${day}`;
}

function formatNumericTimePart(date: Date): string {
  return `${String(date.getHours()).padStart(2, "0")}:${String(
    date.getMinutes(),
  ).padStart(2, "0")}`;
}

/**
 * Formats dashboard date ranges without locale punctuation drift.
 * The end year is omitted when both dates share a year:
 * `2026.01.05 ~ 01.09`.
 */
export function formatNumericDateRange(
  startValue: DisplayDateValue,
  endValue: DisplayDateValue,
  options: { includeTime?: boolean } = {},
): string {
  const start = toLocalDate(startValue);
  const end = toLocalDate(endValue);
  if (!start && !end) return "";
  if (!start) return end ? formatNumericDatePart(end, true) : "";
  if (!end) return formatNumericDatePart(start, true);

  const sameYear = start.getFullYear() === end.getFullYear();
  const sameDate =
    sameYear &&
    start.getMonth() === end.getMonth() &&
    start.getDate() === end.getDate();
  const includeTime = options.includeTime === true;
  const startDate = formatNumericDatePart(start, true);
  const endDate = formatNumericDatePart(end, !sameYear);

  if (!includeTime) {
    return sameDate ? startDate : `${startDate} ~ ${endDate}`;
  }

  const startText = `${startDate} ${formatNumericTimePart(start)}`;
  const endText = sameDate
    ? formatNumericTimePart(end)
    : `${endDate} ${formatNumericTimePart(end)}`;
  return startText === endText ? startText : `${startText} ~ ${endText}`;
}

export function formatShortDateWithWeekday(
  value: DisplayDateValue,
  lang: string = "ko",
  referenceDate: Date = nowDate(),
): string {
  const date = toLocalDate(value);
  if (!date) return "";

  const dateText = formatShortDate(date, lang, referenceDate);
  const weekday = new Intl.DateTimeFormat(lang === "ko" ? "ko-KR" : "en-US", {
    weekday: "short",
  }).format(date);
  return `${dateText} (${weekday})`;
}
