export interface KoreanHolidayRecord {
  locdate: string;
  dateName: string;
  isHoliday: boolean;
}

export type CalendarEventDateType = "open" | "close";
export type PublicCalendarEventSourceType = "ARTICLE" | "SURVEY";

export interface PublicCalendarEventItem {
  id: string;
  sourceType: PublicCalendarEventSourceType;
  articleId?: string | null;
  surveyId?: string | null;
  kind: string;
  titleKo: string;
  titleEn?: string | null;
  date: string;
  dateType: CalendarEventDateType;
}

export interface PublicCalendarEventsResponse {
  items: PublicCalendarEventItem[];
}
