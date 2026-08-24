import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { createApiClient } from "@soc/api-client";
import { isoToDate, localDate, msToDate, nowDate } from "@soc/shared";
import type {
  KoreanHolidayRecord,
  PublicCalendarEventItem,
} from "@soc/contracts";
import { resolveApiBaseUrl } from "@/lib/api-base-url";
import { formatShortDate } from "@/lib/date-display";
import { useLanguage } from "@/hooks/use-language";
import { getKoreanHolidayName } from "@/lib/korean-holidays";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";

interface CompactEvent {
  id: string;
  sourceType: PublicCalendarEventItem["sourceType"];
  category?: PublicCalendarEventItem["category"];
  kind: string;
  cleanTitleKo: string;
  cleanTitleEn?: string | null;
  date: Date;
  dateType: "open" | "close";
  startAt: Date;
  endAt: Date;
}

interface CalendarBarEvent {
  id: string;
  sourceType: PublicCalendarEventItem["sourceType"];
  category?: PublicCalendarEventItem["category"];
  cleanTitle: string;
  kind: string;
  startAt: Date;
  endAt: Date;
  lane: number;
  colorIndex: number;
  isMultiDay: boolean;
  middleDate: Date;
}

function toDateKey(date: Date) {
  const yyyy = String(date.getFullYear());
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}${mm}${dd}`;
}

function formatMonthTitle(year: number, monthIndex: number, lang: string) {
  const showYear = year !== nowDate().getFullYear();
  if (lang === "ko") return showYear ? `${year}년 ${monthIndex + 1}월` : `${monthIndex + 1}월`;
  return new Intl.DateTimeFormat("en", {
    month: "long",
    ...(showYear ? { year: "numeric" } : {}),
  }).format(dateFromParts(year, monthIndex));
}

function formatCalendarEventRange(event: CalendarBarEvent, lang: string) {
  const start = formatShortDate(event.startAt, lang);
  const end = formatShortDate(event.endAt, lang);
  return start === end ? start : `${start} – ${end}`;
}

function getCalendarToneClass(
  event: Pick<CalendarBarEvent, "colorIndex">,
) {
  return `calendar-event-bar-tone-${event.colorIndex}`;
}

function getPreferredCalendarColor(eventId: string) {
  return Array.from(eventId).reduce(
    (sum, character) => sum + character.charCodeAt(0),
    0,
  ) % 10;
}

function dateFromParts(year: number, monthIndex: number) {
  return localDate(year, monthIndex, 1);
}

function getCalendarGridRange(year: number, monthIndex: number) {
  const firstDay = localDate(year, monthIndex, 1);
  const start = msToDate(firstDay.getTime());
  start.setDate(firstDay.getDate() - firstDay.getDay());
  start.setHours(0, 0, 0, 0);

  const end = msToDate(start.getTime());
  end.setDate(start.getDate() + 41);
  end.setHours(23, 59, 59, 999);

  return { from: start, to: end };
}

function getCompactEventTitle(event: CompactEvent, lang: string) {
  return lang === "ko"
    ? event.cleanTitleKo
    : event.cleanTitleEn || event.cleanTitleKo;
}

function startOfDay(date: Date) {
  return localDate(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

function endOfDay(date: Date) {
  return (
    localDate(date.getFullYear(), date.getMonth(), date.getDate() + 1).getTime() - 1
  );
}

function buildCalendarBarEvents(
  events: CompactEvent[],
  lang: string,
  gridFrom: Date,
  gridTo: Date,
): CalendarBarEvent[] {
  const grouped = new Map<string, CompactEvent[]>();

  for (const event of events) {
    const group = grouped.get(event.id) ?? [];
    group.push(event);
    grouped.set(event.id, group);
  }

  const bars = [...grouped.entries()]
    .map(([id, group]) => {
      const representative =
        group.find((event) => event.dateType === "open") ?? group[0];
      const startAt = msToDate(
        Math.min(...group.map((event) => event.startAt.getTime())),
      );
      const endAt = msToDate(
        Math.max(...group.map((event) => event.endAt.getTime())),
      );
      const startDate = localDate(
        startAt.getFullYear(),
        startAt.getMonth(),
        startAt.getDate(),
      );
      const endDate = localDate(
        endAt.getFullYear(),
        endAt.getMonth(),
        endAt.getDate(),
      );
      const spanDays = Math.max(
        0,
        Math.round((startOfDay(endDate) - startOfDay(startDate)) / 86_400_000),
      );
      const visibleStartDate =
        startOfDay(startDate) < startOfDay(gridFrom) ? gridFrom : startDate;
      const visibleEndDate =
        startOfDay(endDate) > startOfDay(gridTo) ? gridTo : endDate;
      const visibleSpanDays = Math.max(
        0,
        Math.round(
          (startOfDay(visibleEndDate) - startOfDay(visibleStartDate)) /
            86_400_000,
        ),
      );
      const titleDate = localDate(
        visibleStartDate.getFullYear(),
        visibleStartDate.getMonth(),
        visibleStartDate.getDate() + Math.floor((visibleSpanDays + 1) / 2),
      );

      return {
        id,
        sourceType: representative.sourceType,
        category: representative.category,
        cleanTitle: getCompactEventTitle(representative, lang),
        kind: representative.kind,
        startAt,
        endAt: endAt.getTime() < startAt.getTime() ? startAt : endAt,
        isMultiDay: spanDays > 0,
        middleDate: titleDate,
      };
    })
    .filter(
      (event) =>
        endOfDay(event.endAt) >= startOfDay(gridFrom) &&
        startOfDay(event.startAt) <= endOfDay(gridTo),
    )
    .sort(
      (a, b) =>
        a.startAt.getTime() - b.startAt.getTime() ||
        a.endAt.getTime() - b.endAt.getTime() ||
        a.cleanTitle.localeCompare(b.cleanTitle),
    );

  const laneEndDates: number[] = [];
  const assignedEvents: CalendarBarEvent[] = [];

  return bars.map((event) => {
    const eventStart = startOfDay(event.startAt);
    const lane = laneEndDates.findIndex((laneEnd) => laneEnd < eventStart);
    const resolvedLane = lane === -1 ? laneEndDates.length : lane;
    laneEndDates[resolvedLane] = endOfDay(event.endAt);

    const unavailableColors = new Set(
      assignedEvents
        .filter(
          (assigned) =>
            startOfDay(assigned.startAt) <= endOfDay(event.endAt) &&
            endOfDay(assigned.endAt) >= startOfDay(event.startAt),
        )
        .map((assigned) => assigned.colorIndex),
    );
    const preferredColor = getPreferredCalendarColor(event.id);
    let colorIndex = preferredColor;
    for (let offset = 0; offset < 10; offset += 1) {
      const candidate = (preferredColor + offset) % 10;
      if (!unavailableColors.has(candidate)) {
        colorIndex = candidate;
        break;
      }
    }

    const assignedEvent = { ...event, lane: resolvedLane, colorIndex };
    assignedEvents.push(assignedEvent);
    return assignedEvent;
  });
}

function CalendarGridSkeleton() {
  return (
    <div
      className="grid min-h-0 flex-1 grid-cols-7 gap-y-0.5 overflow-hidden bg-white"
      aria-busy="true"
    >
      {Array.from({ length: 42 }).map((_, index) => (
        <div
          key={index}
          className="flex h-6 flex-col items-center justify-start rounded-lg py-0.5"
        >
          <div
            className={`home-loading-surface rounded-full ${
              index % 11 === 0 ? "h-4.5 w-4.5" : "mt-0.5 h-3 w-3"
            }`}
          />
          <div className="flex flex-1 items-end justify-center pb-1">
            {index % 5 === 0 ? (
              <div className="flex h-2 items-center gap-1">
                <span className="home-loading-surface h-1.5 w-1.5 rounded-full" />
                <span className="home-loading-surface h-1.5 w-1.5 rounded-full" />
              </div>
            ) : (
              <div className="h-2" />
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

export function Calendar() {
  const { lang } = useLanguage();
  const apiClient = useMemo(
    () => createApiClient({ baseUrl: resolveApiBaseUrl() }),
    [],
  );

  // Navigation states
  const [currentDate, setCurrentDate] = useState(() => nowDate());
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth();

  // DB events
  const [selectedDateKey, setSelectedDateKey] = useState(() =>
    toDateKey(nowDate()),
  );
  const calendarGridRange = useMemo(
    () => getCalendarGridRange(currentYear, currentMonth),
    [currentMonth, currentYear],
  );
  const calendarRangeFrom = calendarGridRange.from.toISOString();
  const calendarRangeTo = calendarGridRange.to.toISOString();

  const calendarEventsQuery = useQuery({
    queryKey: ["calendar", "events", calendarRangeFrom, calendarRangeTo],
    queryFn: async () => {
      const response = await apiClient.getPublicCalendarEvents({
        from: calendarRangeFrom,
        to: calendarRangeTo,
      });

      return response.items.map((event: PublicCalendarEventItem) => ({
        id: event.id,
        sourceType: event.sourceType,
        category: event.category,
        kind: event.kind,
        cleanTitleKo: event.titleKo,
        cleanTitleEn: event.titleEn || event.titleKo,
        date: isoToDate(event.date),
        dateType: event.dateType,
        startAt: isoToDate(event.startAt ?? event.date),
        endAt: isoToDate(event.endAt ?? event.date),
      }));
    },
    staleTime: 60 * 1000,
  });

  const holidaysQuery = useQuery<KoreanHolidayRecord[]>({
    queryKey: ["calendar", "holidays", currentYear, currentMonth + 1],
    queryFn: () => apiClient.getKoreanHolidays(currentYear, currentMonth + 1),
    staleTime: 24 * 60 * 60 * 1000,
  });

  const events = calendarEventsQuery.data ?? [];
  const holidays = holidaysQuery.data ?? [];
  const loading = calendarEventsQuery.isPending;

  // Generate compact calendar grid
  const days = useMemo(() => {
    const firstDay = localDate(currentYear, currentMonth, 1);
    const lastDay = localDate(currentYear, currentMonth + 1, 0);

    const firstDayOfWeek = firstDay.getDay();
    const daysCount = lastDay.getDate();

    const grid = [];

    // Pad preceding days with actual dates of previous month
    const prevMonthLastDay = localDate(currentYear, currentMonth, 0).getDate();
    for (let i = firstDayOfWeek - 1; i >= 0; i--) {
      const d = prevMonthLastDay - i;
      const cellDate = localDate(currentYear, currentMonth - 1, d);
      grid.push({
        day: d,
        date: cellDate,
        isCurrentMonth: false,
        today: false,
      });
    }

    // Add current month days
    const todayDate = nowDate();
    for (let d = 1; d <= daysCount; d++) {
      const cellDate = localDate(currentYear, currentMonth, d);
      const isToday =
        todayDate.getFullYear() === currentYear &&
        todayDate.getMonth() === currentMonth &&
        todayDate.getDate() === d;

      grid.push({
        day: d,
        date: cellDate,
        isCurrentMonth: true,
        today: isToday,
      });
    }

    // Pad remaining days to make complete weeks (always 42 grid cells to prevent height fluctuation!)
    const totalCells = 42;
    const remaining = totalCells - grid.length;
    for (let i = 1; i <= remaining; i++) {
      const cellDate = localDate(currentYear, currentMonth + 1, i);
      grid.push({
        day: i,
        date: cellDate,
        isCurrentMonth: false,
        today: false,
      });
    }

    return grid;
  }, [currentYear, currentMonth]);

  const handlePrevMonth = () => {
    const nextDate = localDate(currentYear, currentMonth - 1, 1);
    setCurrentDate(nextDate);
    setSelectedDateKey(toDateKey(nextDate));
  };

  const handleNextMonth = () => {
    const nextDate = localDate(currentYear, currentMonth + 1, 1);
    setCurrentDate(nextDate);
    setSelectedDateKey(toDateKey(nextDate));
  };

  const calendarBars = useMemo(
    () =>
      buildCalendarBarEvents(
      events,
      lang,
      calendarGridRange.from,
      calendarGridRange.to,
      ),
    [calendarGridRange.from, calendarGridRange.to, events, lang],
  );
  const calendarBarsByDate = useMemo(() => {
    const byDate = new Map<string, CalendarBarEvent[]>();

    for (const item of days) {
      if (!item.date) continue;
      const dayStart = startOfDay(item.date);
      const dayEnd = endOfDay(item.date);
      byDate.set(
        toDateKey(item.date),
        calendarBars.filter(
          (bar) =>
            startOfDay(bar.startAt) <= dayEnd && endOfDay(bar.endAt) >= dayStart,
        ),
      );
    }

    return byDate;
  }, [calendarBars, days]);

  const selectedDate = days.find(
    (item) => item.date && toDateKey(item.date) === selectedDateKey,
  )?.date;
  const selectedDateBars = selectedDate
    ? calendarBarsByDate.get(selectedDateKey) ?? []
    : [];

  const holidayMap = useMemo(() => {
    return new Map(holidays.map((holiday) => [holiday.locdate, holiday]));
  }, [holidays]);

  return (
    <section className="home-bento-card flex h-full min-h-0 min-w-0 flex-col overflow-visible px-4 pb-3 pt-2.5 md:px-5">
      <div className="flex min-h-0 flex-1 flex-col">
        {/* Header */}
        <div className="mb-1.5 flex h-9 shrink-0 items-center justify-between">
          <div className="flex items-center justify-center gap-1.5">
            <IconButton
              size="sm"
              tone="navigation"
              onClick={handlePrevMonth}
              className="text-slate-600"
              aria-label={lang === "ko" ? "이전 달" : "Previous month"}
            >
              <ChevronLeft strokeWidth={2} />
            </IconButton>

            <h3 className="home-calendar-title min-w-24 text-center text-slate-800">
              {formatMonthTitle(currentYear, currentMonth, lang)}
            </h3>

            <IconButton
              size="sm"
              tone="navigation"
              onClick={handleNextMonth}
              className="text-slate-600"
              aria-label={lang === "ko" ? "다음 달" : "Next month"}
            >
              <ChevronRight strokeWidth={2} />
            </IconButton>
          </div>

          <Link
            to={`/calendar?selected=${selectedDate ? `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, "0")}-${String(selectedDate.getDate()).padStart(2, "0")}` : ""}`}
            className="home-more-link shrink-0"
          >
            <span>{lang === "ko" ? "더보기" : "More"}</span>
            <ChevronRight aria-hidden="true" className="h-3 w-3" />
          </Link>
        </div>

         <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(15rem,0.85fr)]">
           <div className="flex min-h-0 min-w-0 flex-col">
             {/* Weekday Headers */}
             <div className="mb-1.5 grid flex-shrink-0 grid-cols-7 gap-x-1 text-center">
           {(lang === "ko"
            ? ["일", "월", "화", "수", "목", "금", "토"]
            : ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
          ).map((day, index) => (
            <div key={index}>
              <span
                    className={`text-[length:var(--home-calendar-weekday-size)] font-normal tracking-tight ${
                  index === 0
                    ? "text-red-500"
                    : index === 6
                      ? "text-blue-500"
                      : "text-slate-400"
                }`}
              >
                {day}
              </span>
            </div>
          ))}
             </div>

             {/* Calendar Grid */}
             {loading ? (
               <CalendarGridSkeleton />
             ) : (
               <div className="grid min-h-[12rem] flex-1 grid-rows-6 gap-y-1 overflow-visible bg-white">
                 {Array.from({ length: 6 }).map((_, weekIndex) => {
                   const weekDays = days.slice(weekIndex * 7, weekIndex * 7 + 7);
                   const weekStart = weekDays[0]?.date;
                   const weekEnd = weekDays[6]?.date;
                   const weekBars =
                     weekStart && weekEnd
                       ? calendarBars.filter(
                           (bar) =>
                             bar.lane < 3 &&
                             startOfDay(bar.startAt) <= endOfDay(weekEnd) &&
                             endOfDay(bar.endAt) >= startOfDay(weekStart),
                         )
                       : [];

                   return (
                     <div key={weekIndex} className="relative grid min-h-[2.75rem] grid-cols-7">
                       {weekDays.map((item, dayIndex) => {
                         const absoluteIndex = weekIndex * 7 + dayIndex;
                         const cellDateKey = item.date
                           ? toDateKey(item.date)
                           : `empty-${absoluteIndex}`;
                         const isSunday = item.date?.getDay() === 0;
                         const isSaturday = item.date?.getDay() === 6;
                         const holiday = item.date
                           ? holidayMap.get(toDateKey(item.date))
                           : undefined;
                         const isPublicHoliday = holiday?.isHoliday === true;
                         const dayBars = item.date
                           ? calendarBarsByDate.get(cellDateKey) ?? []
                           : [];
                         const isSelected = selectedDateKey === cellDateKey;

                         return (
                           <Button variant="ghost"
                             key={cellDateKey}
                             type="button"
                             aria-pressed={isSelected}
                             aria-label={
                               item.date
                                 ? `${formatShortDate(item.date, lang)}${
                                     dayBars.length > 0
                                       ? lang === "ko"
                                         ? ` 일정 ${dayBars.length}개`
                                         : `, ${dayBars.length} event${dayBars.length === 1 ? "" : "s"}`
                                       : ""
                                   }`
                                 : undefined
                             }
                             onClick={() => {
                               if (item.date) setSelectedDateKey(cellDateKey);
                             }}
                             className={`calendar-day-button relative z-10 flex h-full min-h-[2.75rem] cursor-pointer flex-col items-center justify-start rounded-md border px-0 py-0 font-normal transition-colors ${
                               isSelected
                                 ? "border-[#cedbd3] bg-[#f5f8f6]"
                                 : "border-transparent bg-white hover:bg-slate-50/80"
                             }`}
                           >
                             <span
                               title={
                                 holiday
                                   ? getKoreanHolidayName(holiday.dateName, lang)
                                   : undefined
                               }
                               className={`calendar-day-number ${
                                 item.today
                                   ? "calendar-day-number-today"
                                   : item.isCurrentMonth
                                     ? isSunday || isPublicHoliday
                                       ? "text-red-500"
                                       : isSaturday
                                         ? "text-blue-500"
                                         : "text-slate-700"
                                     : "text-slate-300"
                               }`}
                             >
                               {item.day}
                             </span>
                           </Button>
                         );
                       })}

                       <div className="calendar-week-bars" aria-hidden="true">
                         {weekBars.map((bar) => {
                           if (!weekStart || !weekEnd) return null;
                           const visibleStart =
                             startOfDay(bar.startAt) < startOfDay(weekStart)
                               ? weekStart
                               : bar.startAt;
                           const visibleEnd =
                             endOfDay(bar.endAt) > endOfDay(weekEnd)
                               ? weekEnd
                               : bar.endAt;
                           const startColumn = Math.max(
                             0,
                             Math.round(
                               (startOfDay(visibleStart) - startOfDay(weekStart)) /
                                 86_400_000,
                             ),
                           );
                           const endColumn = Math.min(
                             6,
                             Math.round(
                               (startOfDay(visibleEnd) - startOfDay(weekStart)) /
                                 86_400_000,
                             ),
                           );
                           const startsHere = startOfDay(bar.startAt) >= startOfDay(weekStart);
                           const endsHere = endOfDay(bar.endAt) <= endOfDay(weekEnd);

                           const monthSegments: Array<{
                             startColumn: number;
                             endColumn: number;
                             isCurrentMonth: boolean;
                           }> = [];
                           for (let column = startColumn; column <= endColumn; column += 1) {
                             const isCurrentMonth = weekDays[column]?.isCurrentMonth ?? false;
                             const previous = monthSegments.at(-1);
                             if (previous?.isCurrentMonth === isCurrentMonth) {
                               previous.endColumn = column;
                             } else {
                               monthSegments.push({ startColumn: column, endColumn: column, isCurrentMonth });
                             }
                           }

                           return monthSegments.map((segment, segmentIndex) => (
                             <span
                               key={`${bar.id}-${weekIndex}-${segmentIndex}`}
                               className={`calendar-week-event-bar ${getCalendarToneClass(bar)} ${
                                 !segment.isCurrentMonth
                                   ? "calendar-week-event-bar-outside-month"
                                   : ""
                               } ${
                                 startsHere && segment.startColumn === startColumn
                                   ? "calendar-week-event-bar-start"
                                   : ""
                               } ${
                                 endsHere && segment.endColumn === endColumn
                                   ? "calendar-week-event-bar-end"
                                   : ""
                               }`}
                               style={{
                                 gridColumn: `${segment.startColumn + 1} / ${segment.endColumn + 2}`,
                                 gridRow: bar.lane + 1,
                               }}
                             />
                           ));
                         })}
                       </div>
                     </div>
                   );
                 })}
               </div>
             )}
           </div>

           <aside className="flex min-h-0 min-w-0 flex-col overflow-hidden border-t border-slate-100 pt-3 lg:border-l lg:border-t-0 lg:pl-4 lg:pt-0">
             <div className="flex shrink-0 items-start justify-between gap-2 border-b border-slate-100 pb-2.5">
               <div className="min-w-0">
                 <h4 className="home-calendar-body-text truncate text-[length:var(--ui-text-body-sm-size)] font-semibold tabular-nums text-slate-800">
                   {selectedDate ? formatShortDate(selectedDate, lang) : "—"}
                 </h4>
               </div>
               <span className="home-calendar-body-text shrink-0 text-[length:var(--ui-text-micro-size)] font-normal tabular-nums text-slate-400">
                 {lang === "ko"
                   ? `${selectedDateBars.length}개 일정`
                   : `${selectedDateBars.length} event${selectedDateBars.length === 1 ? "" : "s"}`}
               </span>
             </div>

             <div className="home-calendar-detail-scroll min-h-0 flex-1 overflow-y-auto pt-1.5">
               {selectedDateBars.length > 0 ? (
                 <ul className="grid gap-1">
                   {selectedDateBars.map((bar) => (
                     <li
                       key={`${bar.id}-detail`}
                       className="flex min-w-0 gap-2 border-b border-slate-100 px-0.5 py-2 last:border-b-0"
                     >
                       <span
                         aria-hidden="true"
                         className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${getCalendarToneClass(bar)}`}
                       />
                       <div className="min-w-0 flex-1">
                         <p
                           className="home-calendar-body-text line-clamp-2 overflow-hidden text-[length:var(--home-calendar-event-size)] font-normal leading-4 text-slate-700"
                           title={bar.cleanTitle}
                         >
                           {bar.cleanTitle}
                         </p>
                         <p className="mt-0.5 truncate text-[length:var(--home-calendar-detail-size)] font-normal leading-3 tabular-nums text-slate-400">
                            {bar.category === "HOLIDAY"
                              ? lang === "ko"
                                ? "공휴일"
                                : "Public holiday"
                              : bar.sourceType === "KAIST_ACADEMIC"
                             ? lang === "ko"
                               ? "학사 일정"
                               : "Academic"
                             : lang === "ko"
                               ? "학생회 일정"
                               : "Council event"}
                           {" · "}
                           {formatCalendarEventRange(bar, lang)}
                         </p>
                       </div>
                     </li>
                   ))}
                 </ul>
               ) : (
                 <p className="px-1 py-2 text-[length:var(--ui-text-caption-size)] font-normal leading-4 text-slate-400">
                   {lang === "ko"
                     ? "선택한 날짜에 일정이 없습니다."
                     : "No schedules on this date."}
                 </p>
               )}
             </div>
           </aside>
         </div>
       </div>
   </section>
  );
}
