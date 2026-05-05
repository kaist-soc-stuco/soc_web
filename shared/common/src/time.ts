import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import duration from 'dayjs/plugin/duration';

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(duration);

const DEFAULT_TZ = 'Asia/Seoul';

export interface TimeObj {
  year: number;
  month: number;       // 1–12 (1-indexed)
  day: number;
  hour: number;
  minute: number;
  second: number;
  millisecond: number;
}

export type TimeUnit =
  | 'millisecond'
  | 'second'
  | 'minute'
  | 'hour'
  | 'day'
  | 'week'
  | 'month'
  | 'year';

// ─── Current time ─────────────────────────────────────────────────────────────

export function nowMs(): number {
  return Date.now();
}

export function nowIso(): string {
  return dayjs.utc().toISOString();
}

// ─── ms / ISO conversions ─────────────────────────────────────────────────────

export function msToIso(ms: number): string {
  return dayjs.utc(ms).toISOString();
}

export function isoToMs(iso: string): number {
  return dayjs.utc(iso).valueOf();
}

// ─── TimeObj conversions ──────────────────────────────────────────────────────

export function msToTimeObj(ms: number, tz = DEFAULT_TZ): TimeObj {
  const d = tz === 'UTC' ? dayjs.utc(ms) : dayjs(ms).tz(tz);
  return {
    year: d.year(),
    month: d.month() + 1,
    day: d.date(),
    hour: d.hour(),
    minute: d.minute(),
    second: d.second(),
    millisecond: d.millisecond(),
  };
}

function timeObjToString(obj: TimeObj): string {
  const p = (n: number, w = 2) => String(n).padStart(w, '0');
  return `${obj.year}-${p(obj.month)}-${p(obj.day)}T${p(obj.hour)}:${p(obj.minute)}:${p(obj.second)}.${p(obj.millisecond, 3)}`;
}

export function timeObjToMs(obj: TimeObj, tz = DEFAULT_TZ): number {
  const s = timeObjToString(obj);
  const d = tz === 'UTC' ? dayjs.utc(s) : dayjs.tz(s, tz);
  return d.valueOf();
}

export function isoToTimeObj(iso: string, tz = DEFAULT_TZ): TimeObj {
  return msToTimeObj(isoToMs(iso), tz);
}

export function timeObjToIso(obj: TimeObj, tz = DEFAULT_TZ): string {
  return msToIso(timeObjToMs(obj, tz));
}

// ─── Arithmetic ───────────────────────────────────────────────────────────────

export function addMs(ms: number, amount: number, unit: TimeUnit): number {
  return dayjs.utc(ms).add(amount, unit).valueOf();
}

export function subtractMs(ms: number, amount: number, unit: TimeUnit): number {
  return dayjs.utc(ms).subtract(amount, unit).valueOf();
}

export function diffMs(
  laterMs: number,
  earlierMs: number,
  unit: TimeUnit,
  float = false,
): number {
  return dayjs.utc(laterMs).diff(dayjs.utc(earlierMs), unit, float);
}

// ─── Expiry helpers ───────────────────────────────────────────────────────────

export function isExpired(expiresAtMs: number): boolean {
  return expiresAtMs <= Date.now();
}

export function secondsUntil(futureMs: number): number {
  return Math.max(Math.floor((futureMs - Date.now()) / 1000), 0);
}

export function expiresAtMs(ttlSeconds: number): number {
  return Date.now() + ttlSeconds * 1000;
}

// ─── ORM compatibility ────────────────────────────────────────────────────────
// Drizzle ORM requires Date objects for timestamp columns.
// Use these instead of new Date() directly in repositories.

export function nowDate(): Date {
  return new Date(nowMs());
}

export function isoToDate(iso: string): Date {
  return new Date(isoToMs(iso));
}

// ─── Calendar helpers ─────────────────────────────────────────────────────────

/** Returns day-of-week: 0 = Sunday … 6 = Saturday (same as Date.prototype.getDay). */
export function getDayOfWeek(ms: number, tz = DEFAULT_TZ): number {
  return tz === 'UTC' ? dayjs.utc(ms).day() : dayjs(ms).tz(tz).day();
}

// ─── HTML form helpers ────────────────────────────────────────────────────────

// HTML <input type="datetime-local"> returns "YYYY-MM-DDTHH:mm" with no timezone.
// These two functions convert between that format and UTC ISO strings.

export function htmlDatetimeLocalToIso(value: string, tz = DEFAULT_TZ): string {
  const [datePart, timePart = '00:00'] = value.split('T');
  const [year, month, day] = datePart.split('-').map(Number);
  const [hour, minute] = timePart.split(':').map(Number);
  return timeObjToIso({ year, month, day, hour, minute, second: 0, millisecond: 0 }, tz);
}

export function isoToHtmlDatetimeLocal(iso: string, tz = DEFAULT_TZ): string {
  const t = isoToTimeObj(iso, tz);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${t.year}-${p(t.month)}-${p(t.day)}T${p(t.hour)}:${p(t.minute)}`;
}

// ─── Formatting ───────────────────────────────────────────────────────────────

export function formatKorean(input: number | string, tz = DEFAULT_TZ): string {
  const ms = typeof input === 'string' ? isoToMs(input) : input;

  if (Number.isNaN(ms)) {
    return 'invalid-date';
  }

  return new Intl.DateTimeFormat('ko-KR', {
    dateStyle: 'medium',
    timeStyle: 'medium',
    timeZone: tz,
  }).format(new Date(ms));
}
