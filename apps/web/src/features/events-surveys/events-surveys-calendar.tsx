import { useMemo } from "react";
import type { KoreanHolidayRecord } from "@soc/contracts";
import { localDate } from "@soc/shared";
import { ChevronLeft, ChevronRight } from "lucide-react";

import type { Language } from "@/hooks/use-language";
import { formatShortDateWithWeekday } from "@/lib/date-display";
import { isCalendarEventOnDay, type CalendarEvent } from "@/lib/events-surveys";
import { EventsSurveysCalendarGrid } from "./events-surveys-calendar-grid";
import { EventsSurveysCalendarManagement } from "./events-surveys-calendar-management";
import { EventsSurveysDayDetails } from "./events-surveys-day-details";
import {
  buildCalendarGrid,
  toDateKey,
} from "./events-surveys-calendar-utils";
import { IconButton } from "@/components/ui/icon-button";
import { PageSearchField } from "@/components/ui/page-layout";

interface EventsSurveysCalendarProps {
  calendarEvents: CalendarEvent[];
  currentDate: Date;
  holidays: KoreanHolidayRecord[];
  lang: Language;
  onCurrentDateChange: (date: Date) => void;
  onSelectedDateChange: (date: Date) => void;
  calendarQuery: string;
  onCalendarQueryChange: (value: string) => void;
  selectedDate: Date;
}

function formatMonthTitle(year: number, monthIndex: number, lang: Language) {
  if (lang === "ko") {
    return `${year}년 ${monthIndex + 1}월`;
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
  }).format(localDate(year, monthIndex, 1));
}

export function EventsSurveysCalendar({
  calendarEvents,
  currentDate,
  holidays,
  lang,
  onCurrentDateChange,
  onSelectedDateChange,
  calendarQuery,
  onCalendarQueryChange,
  selectedDate,
}: EventsSurveysCalendarProps) {
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth();
  const calendarGrid = useMemo(
    () => buildCalendarGrid(currentYear, currentMonth),
    [currentMonth, currentYear],
  );
  const holidayMap = useMemo(() => {
    return new Map(holidays.map((holiday) => [holiday.locdate, holiday]));
  }, [holidays]);
  const selectedDayEvents = useMemo(
    () => calendarEvents.filter((event) => isCalendarEventOnDay(event, selectedDate)),
    [calendarEvents, selectedDate],
  );
  const selectedDateStr = useMemo(
    () => formatShortDateWithWeekday(selectedDate, lang),
    [lang, selectedDate],
  );
  const weekHeaders =
    lang === "ko"
      ? ["일", "월", "화", "수", "목", "금", "토"]
      : ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 items-stretch gap-6 lg:grid-cols-4">
        <div className="flex h-full min-w-0 flex-col rounded-lg border border-card-border-subtle bg-white p-5 lg:col-span-3">
          <div className="mb-5 grid min-w-0 grid-cols-1 items-center gap-3 border-b border-slate-200 pb-4 select-none sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
            <div className="hidden sm:block" aria-hidden="true" />
            <div className="flex items-center justify-center gap-2">
              <IconButton
                size="sm"
                tone="navigation"
                type="button"
                aria-label={lang === "ko" ? "이전 달" : "Previous month"}
                onClick={() =>
                  onCurrentDateChange(localDate(currentYear, currentMonth - 1, 1))
                }
              >
                <ChevronLeft className="h-4 w-4" />
              </IconButton>
              <h3 className="whitespace-nowrap text-lg font-bold tracking-tight text-slate-800 md:text-xl">
                {formatMonthTitle(currentYear, currentMonth, lang)}
              </h3>
              <IconButton
                size="sm"
                tone="navigation"
                type="button"
                aria-label={lang === "ko" ? "다음 달" : "Next month"}
                onClick={() =>
                  onCurrentDateChange(localDate(currentYear, currentMonth + 1, 1))
                }
              >
                <ChevronRight className="h-4 w-4" />
              </IconButton>
            </div>
            <div className="min-w-0 w-full justify-self-end sm:max-w-56">
              <PageSearchField
                ariaLabel={lang === "ko" ? "일정 검색" : "Search calendar events"}
                className="!w-full"
                onChange={onCalendarQueryChange}
                onClear={() => onCalendarQueryChange("")}
                placeholder={lang === "ko" ? "일정 검색" : "Search events"}
                value={calendarQuery}
              />
            </div>
          </div>

          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div
              className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[length:var(--ui-text-caption-size)] font-semibold text-slate-500"
              aria-label={lang === "ko" ? "캘린더 공급원 안내" : "Calendar sources"}
            >
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-brand-primary" aria-hidden="true" />
                {lang === "ko" ? "학생회 행사·일정" : "Council Schedule"}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-sky-500" aria-hidden="true" />
                {lang === "ko" ? "설문·투표" : "Surveys & Polls"}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-slate-400" aria-hidden="true" />
                {lang === "ko" ? "학사일정" : "Academic schedule"}
              </span>
            </div>
            <EventsSurveysCalendarManagement />
          </div>

          <EventsSurveysCalendarGrid
            calendarEvents={calendarEvents}
            calendarGrid={calendarGrid}
            holidayMap={holidayMap}
            lang={lang}
            onSelectedDateChange={onSelectedDateChange}
            selectedDate={selectedDate}
            weekHeaders={weekHeaders}
          />
        </div>

        <EventsSurveysDayDetails
          events={selectedDayEvents}
          lang={lang}
          selectedDateStr={selectedDateStr}
        />
      </div>
    </div>
  );
}
