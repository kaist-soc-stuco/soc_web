export type DateInput = Date | number | string;

interface ScheduleFormatOptions {
  referenceDate?: Date;
  includeTime?: boolean;
}

function parseDate(input: DateInput): Date | null {
  if (input instanceof Date) {
    const copy = new Date(input.getTime());
    return Number.isNaN(copy.getTime()) ? null : copy;
  }

  if (typeof input === 'string') {
    const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(input);
    if (dateOnly) {
      const [, year, month, day] = dateOnly;
      const parsed = new Date(Number(year), Number(month) - 1, Number(day));
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    }
  }

  const parsed = new Date(input);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

const twoDigits = (value: number) => String(value).padStart(2, '0');

function dateParts(input: DateInput) {
  const date = parseDate(input);
  if (!date) return null;
  return {
    date,
    year: date.getFullYear(),
    month: twoDigits(date.getMonth() + 1),
    day: twoDigits(date.getDate()),
  };
}

/**
 * Formats calendar dates as MM.DD in the reference year and YYYY.MM.DD otherwise.
 * Date-only ISO strings are interpreted as local calendar dates, not UTC instants.
 */
export function formatScheduleDate(input: DateInput, referenceDate = new Date()): string {
  const parts = dateParts(input);
  if (!parts) return '';
  const prefix = parts.year === referenceDate.getFullYear() ? '' : `${parts.year}.`;
  return `${prefix}${parts.month}.${parts.day}`;
}

export function formatScheduleTime(input: DateInput): string {
  const parts = dateParts(input);
  if (!parts) return '';
  return `${twoDigits(parts.date.getHours())}:${twoDigits(parts.date.getMinutes())}`;
}

export function formatScheduleDateTime(input: DateInput, referenceDate = new Date()): string {
  const date = formatScheduleDate(input, referenceDate);
  const time = formatScheduleTime(input);
  return date && time ? `${date} ${time}` : date;
}

/** Record/audit timestamps always keep the year, unlike public schedule dates. */
export function formatRecordDateTime(input: DateInput): string {
  const parts = dateParts(input);
  if (!parts) return '';
  return `${parts.year}.${parts.month}.${parts.day} ${formatScheduleTime(parts.date)}`;
}

export function formatScheduleRange(
  start: DateInput | null | undefined,
  end: DateInput | null | undefined,
  options: ScheduleFormatOptions = {},
): string {
  const { referenceDate = new Date(), includeTime = true } = options;
  if (!start && !end) return '';
  if (!start) return formatScheduleDateTime(end!, referenceDate);
  if (!end) return formatScheduleDateTime(start, referenceDate);

  const startParts = dateParts(start);
  const endParts = dateParts(end);
  if (!startParts || !endParts) return '';

  const startDate = formatScheduleDate(startParts.date, referenceDate);
  const endDate = formatScheduleDate(endParts.date, referenceDate);
  if (!includeTime) return startDate === endDate ? startDate : `${startDate}–${endDate}`;

  const startTime = formatScheduleTime(startParts.date);
  const endTime = formatScheduleTime(endParts.date);
  return startDate === endDate
    ? `${startDate} ${startTime}–${endTime}`
    : `${startDate} ${startTime}–${endDate} ${endTime}`;
}
