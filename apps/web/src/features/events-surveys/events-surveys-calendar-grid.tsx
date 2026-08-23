import type { KoreanHolidayRecord } from "@soc/contracts";
import { localDate, msToDate } from "@soc/shared";
import { createPortal } from "react-dom";
import { useState, type CSSProperties } from "react";

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
const CALENDAR_WEEK_HEIGHT = 144;
const CALENDAR_WEEK_OVERFLOW_HEIGHT = 164;
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

interface CalendarTooltipState {
  event: CalendarEvent;
  x: number;
  y: number;
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

function getEventLabelSegment(
  range: EventRange,
  cellIndex: number,
  calendarGrid: CalendarCell[],
) {
  const rangeStartIndex = calendarGrid.findIndex(
    (gridCell) => dayStamp(gridCell.date) === dayStamp(range.start),
  );
  const rangeEndIndex = calendarGrid.findIndex(
    (gridCell) => dayStamp(gridCell.date) === dayStamp(range.end),
  );
  const visibleRangeStartIndex = rangeStartIndex < 0 ? 0 : rangeStartIndex;
  const visibleRangeEndIndex =
    rangeEndIndex < 0 ? calendarGrid.length - 1 : rangeEndIndex;
  const weekStartIndex = Math.floor(cellIndex / 7) * 7;
  const weekEndIndex = Math.min(weekStartIndex + 6, calendarGrid.length - 1);
  const segmentStartIndex = Math.max(weekStartIndex, visibleRangeStartIndex);
  const segmentEndIndex = Math.min(weekEndIndex, visibleRangeEndIndex);

  return {
    dayCount: Math.max(1, segmentEndIndex - segmentStartIndex + 1),
    offsetDays: Math.max(0, cellIndex - segmentStartIndex),
  };
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

function getCalendarEventKey(event: CalendarEvent) {
  return `${event.id}-${event.dateType}`;
}

function formatCalendarEventRange(event: CalendarEvent, lang: Language) {
  const start = event.startAt ?? event.date;
  const end = event.endAt ?? event.date;
  const formatter = new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "short",
  });
  const formatDate = (date: Date) =>
    lang === "ko"
      ? `${date.getMonth() + 1}월 ${date.getDate()}일`
      : formatter.format(date);
  const startText = formatDate(start);

  if (isSameDay(start, end)) return startText;

  return `${startText} ～ ${formatDate(end)}`;
}

function getTooltipPosition({ x, y }: Pick<CalendarTooltipState, "x" | "y">) {
  const viewportWidth = typeof window === "undefined" ? 1280 : window.innerWidth;
  const viewportHeight = typeof window === "undefined" ? 720 : window.innerHeight;

  return {
    left: Math.min(x + 14, Math.max(8, viewportWidth - 304)),
    top: Math.min(y + 18, Math.max(8, viewportHeight - 96)),
  };
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
  const [hoveredEventKey, setHoveredEventKey] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<CalendarTooltipState | null>(null);

  const showEventTooltip = (
    event: CalendarEvent,
    x: number,
    y: number,
  ) => {
    setHoveredEventKey(getCalendarEventKey(event));
    setTooltip({ event, x, y });
  };

  const clearEventTooltip = () => {
    setHoveredEventKey(null);
    setTooltip(null);
  };

  const eventRanges = calendarEvents.map((event) =>
    getVisibleEventRange(event, calendarGrid),
  );
  const weekLaneLayouts = buildWeekLaneLayouts(eventRanges, calendarGrid);
  const weekRowHeights = Array.from(
    { length: Math.ceil(calendarGrid.length / 7) },
    (_, weekIndex) => {
      const weekStart = weekIndex * 7;
      const weekEnd = weekStart + 7;
      const hasOverflow = calendarGrid
        .slice(weekStart, weekEnd)
        .some((cell) => {
          const eventCount = calendarEvents.filter((event, eventIndex) => {
            return (
              eventRanges[eventIndex] !== null &&
              isCalendarEventOnDay(event, cell.date)
            );
          }).length;
          return eventCount > MAX_VISIBLE_EVENTS;
        });

      return hasOverflow
        ? CALENDAR_WEEK_OVERFLOW_HEIGHT
        : CALENDAR_WEEK_HEIGHT;
    },
  );

  return (
    <div className="min-w-0 overflow-x-auto lg:overflow-x-visible lg:overflow-y-visible">
      <div className="min-w-[560px] lg:min-w-0">
        <div className="grid grid-cols-7 border-b border-slate-200 text-center text-[length:var(--ui-text-caption-size)] font-semibold text-slate-400">
          {weekHeaders.map((header, index) => (
            <div
              className={`py-2 ${index === 0 ? "text-rose-300" : ""} ${
                index === weekHeaders.length - 1 ? "text-sky-300" : ""
              }`}
              key={header}
            >
              {header}
            </div>
          ))}
        </div>

        <div
          className="grid grid-cols-7 overflow-visible"
          style={{
            gridTemplateRows: weekRowHeights
              .map((height) => `${height}px`)
              .join(" "),
          }}
        >
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

            const hiddenEventCount = dayEventEntries.reduce(
              (count, entry) => {
                const laneIndex = weekLaneLayout.eventLanes.get(
                  entry.eventIndex,
                );
                return count +
                  (laneIndex !== undefined && laneIndex >= MAX_VISIBLE_EVENTS
                    ? 1
                    : 0);
              },
              0,
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
                className={`relative flex h-full min-h-0 min-w-0 flex-col overflow-visible p-1.5 text-left transition-colors duration-150 focus:outline-none focus-visible:outline-none focus-visible:ring-0 ${selected ? "bg-slate-100" : "bg-white hover:bg-slate-50/80"}`}
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

                <span className="mt-2 grid min-h-0 w-full flex-1 grid-rows-[repeat(4,20px)_16px] gap-y-0.5 overflow-visible">
                  {Array.from({ length: MAX_VISIBLE_EVENTS }, (_, laneIndex) => {
                    const entry = eventByLane.get(laneIndex);
                    if (!entry) {
                      return (
                        <span aria-hidden="true" key={`empty-lane-${laneIndex}`} />
                      );
                    }

                    const { event, range } = entry;
                    const eventStyle = getCalendarEventStyles(
                      event.kind,
                      lang,
                      event.sourceType,
                      event.category,
                    );
                    const isStart = isSameDay(cell.date, range.start);
                    const isEnd = isSameDay(cell.date, range.end);
                    const showLabel = isEventLabelDay(
                      range,
                      cell,
                      calendarGrid,
                    );
                    const titleText = stripCalendarPrefix(event.title);
                    const eventKey = getCalendarEventKey(event);
                    const isEventHovered = hoveredEventKey === eventKey;
                    const isWeekEnd = cellIndex % 7 === 6;
                    const labelSegment = showLabel
                      ? getEventLabelSegment(range, cellIndex, calendarGrid)
                      : null;
                    const segmentWidthClass =
                      isEnd || isWeekEnd
                        ? "ml-0.5 w-[calc(100%-0.25rem)]"
                        : "ml-0.5 w-[calc(100%+0.75rem)]";

                    return (
                      <span
                        className="min-w-0"
                        key={`${event.id}-${event.dateType}-${laneIndex}`}
                      >
                        <span
                          aria-label={`${titleText}, ${formatCalendarEventRange(event, lang)}`}
                          className={`group relative ${labelSegment ? "z-30" : "z-10"} flex h-5 min-h-5 items-center overflow-visible rounded-md px-2 py-0.5 text-[length:var(--ui-text-micro-size)] font-semibold leading-4 transition-[background-color,box-shadow] focus:outline-none focus-visible:outline-none ${segmentWidthClass} ${
                            isStart ? "rounded-l-md" : "rounded-l-none"
                          } ${isEnd ? "rounded-r-md" : "rounded-r-none"} ${
                            eventStyle.bg
                          } ${isEventHovered ? eventStyle.hoverBg : ""}`}
                          data-calendar-event-key={eventKey}
                          onBlur={clearEventTooltip}
                          onFocus={(focusEvent) => {
                            const rect = focusEvent.currentTarget.getBoundingClientRect();
                            showEventTooltip(event, rect.left + rect.width / 2, rect.top);
                          }}
                          onMouseEnter={(mouseEvent) => {
                            showEventTooltip(event, mouseEvent.clientX, mouseEvent.clientY);
                          }}
                          onMouseLeave={clearEventTooltip}
                          onMouseMove={(mouseEvent) => {
                            showEventTooltip(event, mouseEvent.clientX, mouseEvent.clientY);
                          }}
                          tabIndex={0}
                        >
                          {labelSegment ? (
                            <span
                              className="pointer-events-none absolute inset-y-0 flex min-w-0 items-center justify-center overflow-hidden px-2"
                              style={{
                                left: `calc(-${labelSegment.offsetDays * 100}%)`,
                                width: `calc(${labelSegment.dayCount * 100}% - 1rem)`,
                              } satisfies CSSProperties}
                            >
                              <span className="block min-w-0 max-w-full truncate whitespace-nowrap">
                                {titleText}
                              </span>
                            </span>
                          ) : (
                            <span className="block h-4 w-full" aria-hidden="true" />
                          )}
                        </span>
                      </span>
                    );
                  })}

                  {hiddenEventCount > 0 && cell.isCurrentMonth ? (
                    <span className="self-end pr-1 text-[length:var(--ui-text-micro-size)] font-semibold leading-4 text-slate-400">
                      +{hiddenEventCount}
                    </span>
                  ) : (
                    <span aria-hidden="true" />
                  )}
                </span>
              </button>
            );
          })}
        </div>
      </div>
      {tooltip && typeof document !== "undefined"
        ? createPortal(
            <div
              className="pointer-events-none fixed z-[2000] flex max-w-[calc(100vw-1rem)] -translate-y-0 flex-col rounded-lg border border-slate-200 bg-white px-3 py-2 text-left shadow-md"
              data-calendar-tooltip="true"
              role="tooltip"
              style={getTooltipPosition(tooltip)}
            >
              <span className="flex max-w-[18rem] items-center gap-1.5 whitespace-nowrap text-[length:var(--ui-text-caption-size)] font-semibold text-slate-800">
                <span
                  className={`h-1.5 w-1.5 shrink-0 rounded-full ${getCalendarEventStyles(
                    tooltip.event.kind,
                    lang,
                    tooltip.event.sourceType,
                    tooltip.event.category,
                  ).bullet}`}
                  aria-hidden="true"
                />
                <span className="max-w-[16rem] truncate">
                  {stripCalendarPrefix(tooltip.event.title)}
                </span>
              </span>
              <span className="mt-1 whitespace-nowrap text-[length:var(--ui-text-micro-size)] font-medium text-slate-400">
                {formatCalendarEventRange(tooltip.event, lang)}
              </span>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
