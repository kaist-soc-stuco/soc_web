import { useEffect, useMemo, useState } from "react";
import type { KoreanHolidayRecord } from "@soc/contracts";
import { localDate } from "@soc/shared";
import { ChevronLeft, ChevronRight } from "lucide-react";

import type { Language } from "@/hooks/use-language";
import { formatShortDateWithWeekday } from "@/lib/date-display";
import { getKoreanHolidayName } from "@/lib/korean-holidays";
import {
  isCalendarEventOnDay,
  type CalendarEvent,
} from "@/lib/events-surveys";
import { EventsSurveysCalendarGrid } from "./events-surveys-calendar-grid";
import { EventsSurveysDayDetails } from "./events-surveys-day-details";
import {
  buildCalendarGrid,
  toDateKey,
} from "./events-surveys-calendar-utils";
import { IconButton } from "@/components/ui/icon-button";
import { PageSearchField } from "@/components/ui/page-layout";
import { Modal } from "@/components/ui/modal";
import { useMediaQuery } from "@/hooks/use-media-query";
import { MobilePublicCalendar } from "./mobile-public-calendar";

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
  isFetching?: boolean;
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
  isFetching = false,
}: EventsSurveysCalendarProps) {
  const isMobile = useMediaQuery("(width < 768px)");
  const [daySheetOpen, setDaySheetOpen] = useState(false);
  useEffect(() => {
    const media = window.matchMedia("(min-width: 1024px)");
    const closeOnDesktop = () => { if (media.matches) setDaySheetOpen(false); };
    media.addEventListener("change", closeOnDesktop);
    return () => media.removeEventListener("change", closeOnDesktop);
  }, []);
  const selectDay = (date: Date) => {
    onSelectedDateChange(date);
    if (window.matchMedia("(max-width: 1023px)").matches) setDaySheetOpen(true);
  };
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
  if (isMobile) return <MobilePublicCalendar calendarEvents={calendarEvents} lang={lang}
    onCurrentDateChange={onCurrentDateChange} onSelectedDateChange={onSelectedDateChange}
    selectedDate={selectedDate} holidays={holidays} isFetching={isFetching} />;
  return (
    <div className="calendar-workspace space-y-6">
      <div className="calendar-workspace-layout grid grid-cols-1 items-stretch gap-6 lg:grid-cols-[minmax(0,1fr)_calc(25%+2rem)]">
        <div className="calendar-month-card flex h-full min-w-0 flex-col rounded-lg border border-card-border-subtle bg-white px-4 py-3 sm:px-5 sm:py-3">
          <div className="calendar-header grid min-w-0 grid-cols-1 items-center gap-1.5 pb-1 select-none sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
            <div
              className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-[length:var(--ui-text-caption-size)] font-semibold text-slate-500"
              aria-label={lang === "ko" ? "캘린더 공급원 안내" : "Calendar sources"}
            >
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-brand-primary" aria-hidden="true" />
                {lang === "ko" ? "행사" : "Events"}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-sky-500" aria-hidden="true" />
                {lang === "ko" ? "설문·투표" : "Surveys & votes"}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-slate-400" aria-hidden="true" />
                {lang === "ko" ? "학사일정" : "Academic schedule"}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-rose-400" aria-hidden="true" />
                {lang === "ko" ? "공휴일" : "Public holidays"}
              </span>
            </div>
            <div className="flex min-w-0 flex-wrap items-center justify-center gap-1.5 sm:gap-2">
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
              <h3 className="whitespace-nowrap px-0.5 text-base font-semibold tracking-tight text-slate-800">
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
                className="!w-full [&_input]:!h-8 [&_button]:!size-8"
                onChange={onCalendarQueryChange}
                onClear={() => onCalendarQueryChange("")}
                placeholder={lang === "ko" ? "일정 검색" : "Search events"}
                value={calendarQuery}
              />
            </div>
          </div>

          <EventsSurveysCalendarGrid
            calendarEvents={calendarEvents}
            calendarGrid={calendarGrid}
            holidayMap={holidayMap}
            lang={lang}
            onSelectedDateChange={selectDay}
            selectedDate={selectedDate}
            weekHeaders={weekHeaders}
          />
        </div>

        <div className="hidden min-h-0 lg:block">
        <EventsSurveysDayDetails
          events={selectedDayEvents}
          lang={lang}
          selectedDateStr={selectedDateStr}
        />
        </div>
      </div>
      <Modal open={daySheetOpen} onClose={() => setDaySheetOpen(false)} title={selectedDateStr} placement="bottom" className="calendar-day-sheet !max-w-none" bodyClassName="!pt-0">
        <EventsSurveysDayDetails events={selectedDayEvents} lang={lang} selectedDateStr={selectedDateStr} embedded />
      </Modal>
    </div>
  );
}
