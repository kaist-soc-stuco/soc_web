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
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 items-start">
      <div className="lg:col-span-3 bg-white rounded-3xl border border-kaist-grey/15 p-6 shadow-sm flex flex-col">
        <div className="flex items-center justify-between pb-4 border-b border-kaist-grey/10 mb-5 select-none">
          <h3 className="text-lg md:text-xl font-extrabold tracking-tight text-brand-primary whitespace-nowrap">
            {formatMonthTitle(currentYear, currentMonth, lang)}
          </h3>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() =>
                onCurrentDateChange(localDate(currentYear, currentMonth - 1, 1))
              }
              className="p-1.5 border border-kaist-grey/20 rounded-xl hover:bg-gray-50 text-kaist-black transition-colors cursor-pointer"
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
              className="px-3 py-1.5 border border-kaist-grey/20 text-xs font-bold rounded-xl hover:bg-gray-50 text-kaist-black transition-colors cursor-pointer"
            >
              {lang === "ko" ? "오늘" : "Today"}
            </button>
            <button
              type="button"
              onClick={() =>
                onCurrentDateChange(localDate(currentYear, currentMonth + 1, 1))
              }
              className="p-1.5 border border-kaist-grey/20 rounded-xl hover:bg-gray-50 text-kaist-black transition-colors cursor-pointer"
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
