import type { Language } from "./i18n";

const KOREAN_HOLIDAY_NAMES_EN: Readonly<Record<string, string>> = {
  "1월1일": "New Year's Day",
  개천절: "National Foundation Day",
  광복절: "Liberation Day",
  기독탄신일: "Christmas Day",
  대체공휴일: "Substitute holiday",
  부처님오신날: "Buddha's Birthday",
  삼일절: "Independence Movement Day",
  설날: "Lunar New Year's Day",
  "설날 연휴": "Lunar New Year holiday",
  어린이날: "Children's Day",
  제헌절: "Constitution Day",
  추석: "Chuseok",
  "추석 연휴": "Chuseok holiday",
  한글날: "Hangeul Day",
  현충일: "Memorial Day",
};

export function getKoreanHolidayName(name: string, lang: Language | string) {
  if (lang === "ko") return name;
  return KOREAN_HOLIDAY_NAMES_EN[name] ?? name;
}
