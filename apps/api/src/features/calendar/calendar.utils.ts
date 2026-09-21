import { msToDate, msToTimeObj, nowDate, timeObjToMs } from "@soc/shared";

export const SEOUL_TIME_ZONE = "Asia/Seoul";
export const DAY_MS = 24 * 60 * 60 * 1000;

export function seoulStartOfDay(year: number, month: number, day: number): Date {
  return msToDate(
    timeObjToMs(
      {
        year,
        month,
        day,
        hour: 0,
        minute: 0,
        second: 0,
        millisecond: 0,
      },
      SEOUL_TIME_ZONE,
    ),
  );
}

export function seoulEndOfDay(year: number, month: number, day: number): Date {
  return msToDate(seoulStartOfDay(year, month, day).valueOf() + DAY_MS - 1);
}

export function addSeoulDays(date: Date, amount: number): Date {
  return msToDate(date.valueOf() + amount * DAY_MS);
}

export function formatSeoulDate(date: Date): string {
  const time = msToTimeObj(date.valueOf(), SEOUL_TIME_ZONE);
  return [
    String(time.year).padStart(4, "0"),
    String(time.month).padStart(2, "0"),
    String(time.day).padStart(2, "0"),
  ].join("-");
}

export function formatSeoulDateTime(date: Date): string {
  const time = msToTimeObj(date.valueOf(), SEOUL_TIME_ZONE);
  return [
    String(time.year).padStart(4, "0"),
    String(time.month).padStart(2, "0"),
    String(time.day).padStart(2, "0"),
  ].join("") + "T" + [
    String(time.hour).padStart(2, "0"),
    String(time.minute).padStart(2, "0"),
    String(time.second).padStart(2, "0"),
  ].join("");
}

export function seoulYear(date = nowDate()): number {
  return msToTimeObj(date.valueOf(), SEOUL_TIME_ZONE).year;
}

/** Academic feed titles that explicitly name a public holiday (not academic breaks). */
export function isPublicHolidayTitle(title: string): boolean {
  return /^(?:(?:대체|임시)\s*공휴일|신정|설날(?:\s*연휴)?|추석(?:\s*연휴)?|삼일절|3[·.]1절|어린이날|부처님\s*오신\s*날|석가탄신일|현충일|광복절|개천절|한글날|성탄절|크리스마스|기독탄신일)(?:\s*\([^)]*\))?$/.test(title.trim());
}
