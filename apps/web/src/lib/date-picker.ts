import { localDate } from "@soc/shared";

/** Calendar values stay in local date components; ISO conversion belongs to callers. */
export function parsePickerDate(value: string): Date | undefined {
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:T|$)/.exec(value);
  if (!match) return undefined;
  const [, year, month, day] = match.map(Number);
  const date = localDate(2000, 0, 1);
  date.setFullYear(year, month - 1, day);
  date.setHours(0, 0, 0, 0);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day ? date : undefined;
}

export function formatPickerDate(date: Date): string {
  return `${String(date.getFullYear()).padStart(4, "0")}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function replacePickerDate(value: string, date: Date, withTime: boolean, min = "", max = ""): string {
  const day = formatPickerDate(date);
  let next = withTime ? `${day}T${value.split("T")[1] || "00:00"}` : day;
  if (min && next < min) next = min;
  if (max && next > max) next = max;
  return next;
}

