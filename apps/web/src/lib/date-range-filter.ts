import { isoToMs, localDate } from "@soc/shared";

/** Include records whose active period overlaps the selected calendar days. */
export function overlapsDateRange(start: string | null, end: string | null, range: { from: string; to: string }): boolean {
  const boundary = (value: string, endOfDay: boolean) => {
    const [year, month, day] = value.split("-").map(Number);
    return localDate(year, month - 1, day, endOfDay ? 23 : 0, endOfDay ? 59 : 0, endOfDay ? 59 : 0, endOfDay ? 999 : 0).getTime();
  };
  if (range.from && end && isoToMs(end) < boundary(range.from, false)) return false;
  if (range.to && start && isoToMs(start) > boundary(range.to, true)) return false;
  return true;
}
