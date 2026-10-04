import { useEffect, useMemo, useState } from "react";
import type { KoreanHolidayRecord } from "@soc/contracts";
import { localDate, nowDate } from "@soc/shared";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FilterSheet } from "@/components/ui/filter-sheet";

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
  if (isMobile) return <MobileWeekAgenda calendarEvents={calendarEvents} currentDate={currentDate} lang={lang}
    onCurrentDateChange={onCurrentDateChange} onSelectedDateChange={onSelectedDateChange}
    selectedDate={selectedDate} calendarQuery={calendarQuery} onCalendarQueryChange={onCalendarQueryChange}
    holidays={holidays} isFetching={isFetching} />;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 items-stretch gap-6 lg:grid-cols-4">
        <div className="flex h-full min-w-0 flex-col rounded-lg border border-card-border-subtle bg-white px-4 py-3 sm:px-5 sm:py-3 lg:col-span-3">
          <div className="calendar-header mb-1 grid min-w-0 grid-cols-1 items-center gap-1.5 border-b border-slate-200 pb-1 select-none sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
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

function MobileWeekAgenda({ calendarEvents, lang, onCurrentDateChange, onSelectedDateChange, selectedDate,
  holidays, isFetching }: EventsSurveysCalendarProps) {
  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const dateValue = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  const [pickerMonth, setPickerMonth] = useState(localDate(selectedDate.getFullYear(), selectedDate.getMonth(), 1));
  const weekStart = localDate(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate() - selectedDate.getDay());
  const days = Array.from({ length: 7 }, (_, index) => localDate(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + index));
  const weekdays = lang === "ko" ? ["일", "월", "화", "수", "목", "금", "토"] : ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
  const holidayMap = useMemo(() => new Map(holidays.map(holiday => [holiday.locdate, holiday])), [holidays]);
  const selectDate = (date: Date) => {
    onSelectedDateChange(date);
    onCurrentDateChange(localDate(date.getFullYear(), date.getMonth(), 1));
  };
  const moveWeek = (direction: number) => selectDate(localDate(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate() + direction * 7));
  const moveMonth = (direction: number) => {
    const month = localDate(selectedDate.getFullYear(), selectedDate.getMonth() + direction, 1);
    const lastDay = localDate(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    selectDate(localDate(month.getFullYear(), month.getMonth(), Math.min(selectedDate.getDate(), lastDay)));
  };
  const events = calendarEvents.filter((event) => isCalendarEventOnDay(event, selectedDate));
  const selectedDateStr = formatShortDateWithWeekday(selectedDate, lang);
  return <section className="mobile-week-agenda" aria-label={lang === "ko" ? "주간 일정" : "Weekly agenda"}>
    <div className="mobile-calendar-navigation flex items-center justify-between gap-1">
      <div className="mobile-calendar-month-group">
      <IconButton tone="outline" className="mobile-calendar-step" aria-label={lang === "ko" ? "이전 달" : "Previous month"} onClick={() => moveMonth(-1)}><ChevronLeft /></IconButton>
      <h2 className="min-w-0 text-lg font-semibold text-slate-900"><Button variant="outline" className="mobile-calendar-month-trigger" aria-haspopup="dialog" aria-expanded={datePickerOpen} onClick={() => { setPickerMonth(localDate(selectedDate.getFullYear(), selectedDate.getMonth(), 1)); setDatePickerOpen(true); }}><span>{formatMonthTitle(selectedDate.getFullYear(), selectedDate.getMonth(), lang)}</span><ChevronDown className="size-4 shrink-0" aria-hidden="true" /></Button></h2>
      <IconButton tone="outline" className="mobile-calendar-step" aria-label={lang === "ko" ? "다음 달" : "Next month"} onClick={() => moveMonth(1)}><ChevronRight /></IconButton>
      </div>
      <Button variant="outline" className="mobile-calendar-today" onClick={() => selectDate(nowDate())}>{lang === "ko" ? "오늘" : "Today"}</Button>
    </div>
    <div className="mobile-week-strip" onTouchStart={(event) => setTouchStart({ x: event.touches[0].clientX, y: event.touches[0].clientY })}
      onTouchCancel={() => setTouchStart(null)}
      onTouchEnd={(event) => { if (touchStart !== null) { const distance = event.changedTouches[0].clientX - touchStart.x; const verticalDistance = event.changedTouches[0].clientY - touchStart.y; if (Math.abs(distance) > 50 && Math.abs(distance) > Math.abs(verticalDistance)) moveWeek(distance < 0 ? 1 : -1); } setTouchStart(null); }}>
      {days.map((date, index) => {
        const active = date.getTime() === localDate(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate()).getTime();
        const hasEvents = calendarEvents.some((event) => isCalendarEventOnDay(event, date));
        const holiday = holidayMap.get(toDateKey(date));
        const holidayName = holiday?.isHoliday ? getKoreanHolidayName(holiday.dateName, lang) : "";
        const tone = holiday?.isHoliday || index === 0 ? "red" : index === 6 ? "blue" : undefined;
        return <button key={date.getTime()} type="button" className="mobile-week-day" aria-pressed={active} data-outside-month={date.getMonth() !== selectedDate.getMonth() || date.getFullYear() !== selectedDate.getFullYear()}
          data-date={dateValue(date)} data-tone={tone}
          aria-current={dateValue(date) === dateValue(nowDate()) ? "date" : undefined}
          aria-label={`${formatShortDateWithWeekday(date, lang)}${holidayName ? `, ${holidayName}` : ""}`} onClick={() => selectDate(date)}>
          <span className={index === 0 ? "text-rose-500" : index === 6 ? "text-sky-600" : "text-slate-500"}>{weekdays[index]}</span>
          <strong>{date.getDate()}</strong><span className={`mobile-week-event-dot ${hasEvents ? "is-visible" : ""}`} aria-hidden="true" />
        </button>;
      })}
    </div>
    <div className="mobile-agenda-list">
      <h3 className="text-base font-semibold text-slate-900">{selectedDateStr}</h3>
      {isFetching && events.length === 0 ? <div className="min-h-40" aria-busy="true" /> : <EventsSurveysDayDetails events={events} lang={lang} selectedDateStr={selectedDateStr} embedded />}
    </div>
    <FilterSheet className="mobile-filter-sheet mobile-date-picker" bodyClassName="mobile-date-picker-body" open={datePickerOpen} onClose={() => setDatePickerOpen(false)} title={lang === "ko" ? "날짜 선택" : "Choose a date"} closeLabel={lang === "ko" ? "날짜 선택 닫기" : "Close date picker"} footer={<Button variant="outline" onClick={() => { selectDate(nowDate()); setDatePickerOpen(false); }}>{lang === "ko" ? "오늘로 이동" : "Go to today"}</Button>}>
      <div className="mobile-date-picker-navigation">
        <IconButton aria-label={lang === "ko" ? "이전 달" : "Previous month"} onClick={() => setPickerMonth(previous => localDate(previous.getFullYear(), previous.getMonth() - 1, 1))}><ChevronLeft /></IconButton>
        <h3 aria-live="polite">{formatMonthTitle(pickerMonth.getFullYear(), pickerMonth.getMonth(), lang)}</h3>
        <IconButton aria-label={lang === "ko" ? "다음 달" : "Next month"} onClick={() => setPickerMonth(previous => localDate(previous.getFullYear(), previous.getMonth() + 1, 1))}><ChevronRight /></IconButton>
      </div>
      <div className="mobile-date-picker-grid" aria-label={formatMonthTitle(pickerMonth.getFullYear(), pickerMonth.getMonth(), lang)}>
        {weekdays.map((day, index) => <span key={day} className="mobile-date-picker-weekday" data-tone={index === 0 ? "red" : index === 6 ? "blue" : undefined}>{day}</span>)}
        {buildCalendarGrid(pickerMonth.getFullYear(), pickerMonth.getMonth()).map(cell => {
          const holiday = holidayMap.get(toDateKey(cell.date));
          const holidayName = holiday?.isHoliday ? getKoreanHolidayName(holiday.dateName, lang) : "";
          const tone = holiday?.isHoliday || cell.date.getDay() === 0 ? "red" : cell.date.getDay() === 6 ? "blue" : undefined;
          return <button key={dateValue(cell.date)} type="button" data-date={dateValue(cell.date)} data-outside-month={!cell.isCurrentMonth} data-tone={tone} aria-pressed={dateValue(cell.date) === dateValue(selectedDate)} aria-current={dateValue(cell.date) === dateValue(nowDate()) ? "date" : undefined} aria-label={`${formatShortDateWithWeekday(cell.date, lang)}${holidayName ? `, ${holidayName}` : ""}`} onClick={() => { selectDate(cell.date); setDatePickerOpen(false); }}>{cell.day}</button>;
        })}
      </div>
    </FilterSheet>
  </section>;
}
