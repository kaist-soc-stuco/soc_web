import { useMemo } from "react";
import type { KoreanHolidayRecord } from "@soc/contracts";
import { localDate, nowDate } from "@soc/shared";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

import type { Language } from "@/hooks/use-language";
import type { CalendarEvent } from "@/lib/events-surveys";
import { EventsSurveysCalendarGrid } from "./events-surveys-calendar-grid";
import { EventsSurveysDayDetails } from "./events-surveys-day-details";
import {
  buildCalendarGrid,
  isSameDay,
  toDateKey,
} from "./events-surveys-calendar-utils";

interface EventsSurveysCalendarProps {
  calendarEvents: CalendarEvent[];
  currentDate: Date;
  holidays: KoreanHolidayRecord[];
  lang: Language;
  onCurrentDateChange: (date: Date) => void;
  onSelectedDateChange: (date: Date) => void;
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
    () => calendarEvents.filter((event) => isSameDay(event.date, selectedDate)),
    [calendarEvents, selectedDate],
  );
  const selectedDateStr = useMemo(
    () =>
      selectedDate.toLocaleDateString(lang === "ko" ? "ko-KR" : "en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
        weekday: "short",
      }),
    [lang, selectedDate],
  );
  const selectedHoliday = holidayMap.get(toDateKey(selectedDate));
  const weekHeaders =
    lang === "ko"
      ? ["일", "월", "화", "수", "목", "금", "토"]
      : ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-4">
      <div className="flex flex-col rounded-lg border border-card-border-subtle bg-white p-5 lg:col-span-3">
        <div className="mb-5 flex items-center justify-between border-b border-slate-200 pb-4 select-none">
          <h3 className="whitespace-nowrap text-lg font-semibold tracking-tight text-app-text-strong md:text-xl">
            {formatMonthTitle(currentYear, currentMonth, lang)}
          </h3>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() =>
                onCurrentDateChange(localDate(currentYear, currentMonth - 1, 1))
              }
              className="flex h-10 w-10 items-center justify-center rounded-md border border-slate-200 text-app-text-body transition-colors hover:bg-slate-50 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => {
                const today = nowDate();
                onCurrentDateChange(today);
                onSelectedDateChange(today);
              }}
              className="min-h-10 rounded-md border border-slate-200 px-3 text-xs font-semibold text-app-text-body transition-colors hover:bg-slate-50 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
            >
              {lang === "ko" ? "오늘" : "Today"}
            </button>
            <button
              type="button"
              onClick={() =>
                onCurrentDateChange(localDate(currentYear, currentMonth + 1, 1))
              }
              className="flex h-10 w-10 items-center justify-center rounded-md border border-slate-200 text-app-text-body transition-colors hover:bg-slate-50 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
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
        selectedHoliday={selectedHoliday}
      />
    </div>
  );
}
