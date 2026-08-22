import type { KoreanHolidayRecord } from "@soc/contracts";
import { localDate, msToDate } from "@soc/shared";

import type { Language } from "@/hooks/use-language";
import { formatShortDate } from "@/lib/date-display";
import { getKoreanHolidayName } from "@/lib/korean-holidays";
import {
  isCalendarEventOnDay,
  stripCalendarPrefix,
  type CalendarEvent,
} from "@/lib/events-surveys";
import {
  getCalendarEventStyles,
  isSameDay,
  toDateKey,
  type CalendarCell,
} from "./events-surveys-calendar-utils";

const MAX_VISIBLE_EVENTS = 4;
const DAY_MS = 24 * 60 * 60 * 1000;

interface EventRange {
  end: Date;
  start: Date;
}

interface CalendarEventEntry {
  event: CalendarEvent;
  eventIndex: number;
  range: EventRange;
}

interface WeekLaneLayout {
  eventLanes: Map<number, number>;
  laneCount: number;
}

function dayStamp(date: Date) {
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
}

function dateFromDayStamp(stamp: number) {
  const date = msToDate(stamp);
  return localDate(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

function getVisibleEventRange(
  event: CalendarEvent,
  calendarGrid: CalendarCell[],
): EventRange | null {
  const startValue = event.startAt ?? event.date;
  const endValue = event.endAt ?? event.date;
  const startStamp = dayStamp(startValue);
  const endStamp = dayStamp(endValue);
  const start = Math.min(startStamp, endStamp);
  const end = Math.max(startStamp, endStamp);
  const gridStart = dayStamp(calendarGrid[0].date);
  const gridEnd = dayStamp(calendarGrid[calendarGrid.length - 1].date);

  if (end < gridStart || start > gridEnd) return null;

  return {
    start: dateFromDayStamp(start),
    end: dateFromDayStamp(end),
  };
}

function buildWeekLaneLayouts(
  ranges: Array<EventRange | null>,
  calendarGrid: CalendarCell[],
): WeekLaneLayout[] {
  const weekCount = Math.ceil(calendarGrid.length / 7);

  return Array.from({ length: weekCount }, (_, weekIndex) => {
    const weekStart = dayStamp(calendarGrid[weekIndex * 7].date);
    const weekEnd = dayStamp(calendarGrid[weekIndex * 7 + 6].date);
    const entries = ranges
      .map((range, eventIndex) => {
        if (!range) return null;

        const start = dayStamp(range.start);
        const end = dayStamp(range.end);
        if (end < weekStart || start > weekEnd) return null;

        return { end, eventIndex, start };
      })
      .filter(
        (entry): entry is { end: number; eventIndex: number; start: number } =>
          entry !== null,
      )
      .sort(
        (first, second) =>
          first.start - second.start ||
          first.end - second.end ||
          first.eventIndex - second.eventIndex,
      );

    const laneEnds: number[] = [];
    const eventLanes = new Map<number, number>();

    entries.forEach(({ end, eventIndex, start }) => {
      const availableLane = laneEnds.findIndex((laneEnd) => laneEnd < start);
      const laneIndex = availableLane === -1 ? laneEnds.length : availableLane;
      laneEnds[laneIndex] = end;
      eventLanes.set(eventIndex, laneIndex);
    });

    return { eventLanes, laneCount: laneEnds.length };
  });
}

function isEventLabelDay(
  range: EventRange,
  cell: CalendarCell,
  calendarGrid: CalendarCell[],
) {
  const visibleStart = Math.max(
    dayStamp(range.start),
    dayStamp(calendarGrid[0].date),
  );
  const visibleEnd = Math.min(
    dayStamp(range.end),
    dayStamp(calendarGrid[calendarGrid.length - 1].date),
  );
  const centerDay =
    visibleStart + Math.floor((visibleEnd - visibleStart) / DAY_MS / 2) * DAY_MS;

  return dayStamp(cell.date) === centerDay;
}

function getDateTextClass(
  cell: CalendarCell,
  cellIndex: number,
  holiday?: KoreanHolidayRecord,
) {
  if (!cell.isCurrentMonth) return "text-slate-300";
  if (holiday?.isHoliday || cellIndex % 7 === 0) return "text-rose-300";
  if (cellIndex % 7 === 6) return "text-sky-300";
  return "text-slate-700";
}

export function EventsSurveysCalendarGrid({
  calendarEvents,
  calendarGrid,
  holidayMap,
  lang,
  onSelectedDateChange,
  selectedDate,
  weekHeaders,
}: {
  calendarEvents: CalendarEvent[];
  calendarGrid: CalendarCell[];
  holidayMap: Map<string, KoreanHolidayRecord>;
  lang: Language;
  onSelectedDateChange: (date: Date) => void;
  selectedDate: Date;
  weekHeaders: string[];
}) {
  const eventRanges = calendarEvents.map((event) =>
    getVisibleEventRange(event, calendarGrid),
  );
  const weekLaneLayouts = buildWeekLaneLayouts(eventRanges, calendarGrid);

  return (
    <div className="min-w-0 overflow-x-auto lg:overflow-x-visible lg:overflow-y-visible">
      <div className="min-w-[560px] lg:min-w-0">
        <div className="grid grid-cols-7 border-x border-b border-slate-200 text-center text-[11px] font-semibold text-slate-400">
          {weekHeaders.map((header, index) => (
            <div
              className={`py-2 ${
                index < weekHeaders.length - 1 ? "border-r border-slate-200" : ""
              } ${index === 0 ? "text-rose-300" : ""} ${
                index === weekHeaders.length - 1 ? "text-sky-300" : ""
              }`}
              key={header}
            >
              {header}
            </div>
          ))}
        </div>

        <div className="grid min-h-[720px] grid-cols-7 grid-rows-6 overflow-visible border-x border-slate-200">
          {calendarGrid.map((cell, cellIndex) => {
            const holiday = holidayMap.get(toDateKey(cell.date));
            const selected = isSameDay(cell.date, selectedDate);
            const weekLaneLayout =
              weekLaneLayouts[Math.floor(cellIndex / 7)] ?? {
                eventLanes: new Map<number, number>(),
                laneCount: 0,
              };
            const dayEventEntries = calendarEvents
              .map((event, eventIndex) => {
                if (!isCalendarEventOnDay(event, cell.date)) return null;
                const range = eventRanges[eventIndex];
                return range ? { event, eventIndex, range } : null;
              })
              .filter(
                (entry): entry is CalendarEventEntry => entry !== null,
              );
            const eventByLane = new Map<number, CalendarEventEntry>();

            dayEventEntries.forEach((entry) => {
              const laneIndex = weekLaneLayout.eventLanes.get(entry.eventIndex);
              if (laneIndex !== undefined && laneIndex < MAX_VISIBLE_EVENTS) {
                eventByLane.set(laneIndex, entry);
              }
            });

            const visibleLaneCount = Math.min(
              weekLaneLayout.laneCount,
              MAX_VISIBLE_EVENTS,
            );
            const hiddenEventCount = Math.max(
              0,
              dayEventEntries.length - MAX_VISIBLE_EVENTS,
            );
            const holidayName = holiday
              ? getKoreanHolidayName(holiday.dateName, lang)
              : "";

            return (
              <button
                aria-label={`${formatShortDate(cell.date, lang)}${
                  dayEventEntries.length > 0
                    ? `, ${dayEventEntries.length} ${
                        lang === "ko" ? "개 일정" : "events"
                      }`
                    : ""
                }`}
                aria-pressed={selected}
                className={`relative z-0 flex min-h-[120px] min-w-0 flex-col overflow-visible p-2 text-left transition-[background-color,z-index] duration-150 hover:z-40 focus-visible:z-50 focus:outline-none focus-visible:ring-0 ${
                  cellIndex % 7 < 6 ? "border-r border-slate-200" : ""
                } ${selected ? "bg-slate-100" : "bg-white hover:bg-slate-50/80"}`}
                key={toDateKey(cell.date)}
                onClick={() => onSelectedDateChange(cell.date)}
                title={holidayName || undefined}
                type="button"
              >
                <span
                  className={`shrink-0 text-xs font-semibold ${getDateTextClass(
                    cell,
                    cellIndex,
                    holiday,
                  )}`}
                >
                  {cell.day}
                </span>

                <span className="mt-2 flex min-h-0 w-full flex-1 flex-col gap-0.5 overflow-visible">
                  {Array.from({ length: visibleLaneCount }, (_, laneIndex) => {
                    const entry = eventByLane.get(laneIndex);
                    if (!entry) {
                      return (
                        <span
                          aria-hidden="true"
                          className="h-5 shrink-0"
                          key={`empty-lane-${laneIndex}`}
                        />
                      );
                    }

                    const { event, range } = entry;
                    const eventStyle = getCalendarEventStyles(
                      event.kind,
                      lang,
                      event.sourceType,
                    );
                    const isStart = isSameDay(cell.date, range.start);
                    const isEnd = isSameDay(cell.date, range.end);
                    const showLabel = isEventLabelDay(
                      range,
                      cell,
                      calendarGrid,
                    );
                    const titleText = stripCalendarPrefix(event.title);
                    const widthClass =
                      isStart && isEnd
                        ? "w-full"
                        : isStart || isEnd
                          ? "w-[calc(100%+1rem)]"
                          : "w-[calc(100%+1.5rem)]";

                    return (
                      <span
                        className="min-w-0 shrink-0 px-1"
                        key={`${event.id}-${event.dateType}-${laneIndex}`}
                      >
                        <span
                          className={`group relative z-10 flex h-5 min-h-5 items-center overflow-visible rounded-md px-2 py-0.5 text-[10px] font-semibold leading-4 transition-colors ${
                            isStart ? "-ml-1" : "-ml-3"
                          } ${widthClass} ${
                            isStart ? "rounded-l-md" : "rounded-l-none"
                          } ${isEnd ? "rounded-r-md" : "rounded-r-none"} ${
                            eventStyle.bg
                          }`}
                          tabIndex={0}
                        >
                          {showLabel ? (
                            <span className="min-w-0 truncate whitespace-nowrap">
                              {titleText}
                            </span>
                          ) : (
                            <span className="block h-4 w-full" aria-hidden="true" />
                          )}

                          <span className="pointer-events-none absolute left-1/2 top-full z-[100] mt-2 flex -translate-x-1/2 flex-col rounded-lg border border-slate-200 bg-white px-3 py-2 text-left opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100 group-focus:opacity-100">
                            <span className="flex max-w-[18rem] items-center gap-1.5 whitespace-nowrap text-[11px] font-semibold text-slate-800">
                              <span
                                className={`h-1.5 w-1.5 shrink-0 rounded-full ${eventStyle.bullet}`}
                                aria-hidden="true"
                              />
                              <span className="max-w-[16rem] truncate">
                                {titleText}
                              </span>
                            </span>
                            <span className="mt-1 whitespace-nowrap text-[10px] font-medium text-slate-400">
                              {formatShortDate(cell.date, lang)}
                            </span>
                          </span>
                        </span>
                      </span>
                    );
                  })}

                  {hiddenEventCount > 0 && cell.isCurrentMonth ? (
                    <span className="self-end pr-1 text-[10px] font-semibold leading-4 text-slate-400">
                      +{hiddenEventCount}
                    </span>
                  ) : null}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
