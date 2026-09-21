import { localDate } from "@soc/shared";

import type { Language } from "@/hooks/use-language";
import type { CalendarEvent } from "@/lib/events-surveys";

export interface CalendarCell {
  date: Date;
  day: number;
  isCurrentMonth: boolean;
}

export function toDateKey(date: Date) {
  const yyyy = String(date.getFullYear());
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}${mm}${dd}`;
}

export function isSameDay(d1: Date, d2: Date) {
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
}

export function buildCalendarGrid(year: number, month: number): CalendarCell[] {
  const firstDayOfMonth = localDate(year, month, 1);
  const lastDayOfMonth = localDate(year, month + 1, 0);
  const firstDayOfWeek = firstDayOfMonth.getDay();
  const daysInMonth = lastDayOfMonth.getDate();
  const grid: CalendarCell[] = [];

  const prevMonthLastDay = localDate(year, month, 0).getDate();
  for (let i = firstDayOfWeek - 1; i >= 0; i--) {
    grid.push({
      day: prevMonthLastDay - i,
      isCurrentMonth: false,
      date: localDate(year, month - 1, prevMonthLastDay - i),
    });
  }

  for (let i = 1; i <= daysInMonth; i++) {
    grid.push({
      day: i,
      isCurrentMonth: true,
      date: localDate(year, month, i),
    });
  }

  const cellCount = Math.max(35, Math.ceil(grid.length / 7) * 7);
  const remainingCells = cellCount - grid.length;
  for (let i = 1; i <= remainingCells; i++) {
    grid.push({
      day: i,
      isCurrentMonth: false,
      date: localDate(year, month + 1, i),
    });
  }

  return grid;
}

export function getCalendarEventStyles(
  kind: CalendarEvent["kind"],
  lang: Language,
  sourceType?: CalendarEvent["sourceType"],
  category?: CalendarEvent["category"],
) {
  if (category === "HOLIDAY") {
    return {
      bg: "bg-rose-100 text-black hover:bg-rose-200",
      hoverBg: "bg-rose-200",
      bullet: "bg-rose-400",
      label: lang === "ko" ? "공휴일" : "Public holiday",
    };
  }
  if (sourceType === "KAIST_ACADEMIC") {
    return {
      bg: "bg-slate-200 text-black hover:bg-slate-300",
      hoverBg: "bg-slate-300",
      bullet: "bg-slate-500",
      label: lang === "ko" ? "학사일정" : "Academic schedule",
    };
  }

  if (sourceType === "MANUAL") {
    return {
      bg: "bg-brand-primary/15 text-black hover:bg-brand-primary/25",
      hoverBg: "bg-brand-primary/25",
      bullet: "bg-brand-primary",
      label: lang === "ko" ? "학생회 일정" : "Council Schedule",
    };
  }

  if (sourceType === "VOTE") {
    return { bg: "bg-sky-100 text-black hover:bg-sky-200", hoverBg: "bg-sky-200", bullet: "bg-sky-500", label: lang === "ko" ? "투표" : "Vote" };
  }

  switch (kind) {
    case "EVENT":
      return {
        bg: "bg-brand-primary/15 text-black hover:bg-brand-primary/25",
        hoverBg: "bg-brand-primary/25",
        bullet: "bg-brand-primary",
        label: lang === "ko" ? "행사" : "Event",
      };
    case "SURVEY":
    default:
      return {
        bg: "bg-sky-100 text-black hover:bg-sky-200",
        hoverBg: "bg-sky-200",
        bullet: "bg-sky-500",
        label: lang === "ko" ? "설문" : "Survey",
      };
  }
}

export function getCompactKindLabel(
  kind: CalendarEvent["kind"],
  lang: Language = "ko",
  sourceType?: CalendarEvent["sourceType"],
) {
  if (sourceType === "KAIST_ACADEMIC") {
    return lang === "ko" ? "학사" : "Academic";
  }
  if (sourceType === "MANUAL") {
    return lang === "ko" ? "일정" : "Calendar";
  }
  if (sourceType === "VOTE") return lang === "ko" ? "투표" : "Vote";
  if (kind === "EVENT") return lang === "ko" ? "행사" : "Event";
  return lang === "ko" ? "설문" : "Survey";
}

export function getEventLabelSegment(
  range: { start: Date; end: Date },
  cellIndex: number,
  calendarGrid: CalendarCell[],
) {
  const rangeStartIndex = calendarGrid.findIndex(
    (gridCell) => isSameDay(gridCell.date, range.start),
  );
  const rangeEndIndex = calendarGrid.findIndex(
    (gridCell) => isSameDay(gridCell.date, range.end),
  );
  const visibleRangeStartIndex = rangeStartIndex < 0 ? 0 : rangeStartIndex;
  const visibleRangeEndIndex =
    rangeEndIndex < 0 ? calendarGrid.length - 1 : rangeEndIndex;
  const weekStartIndex = Math.floor(cellIndex / 7) * 7;
  const weekEndIndex = Math.min(weekStartIndex + 6, calendarGrid.length - 1);
  let segmentStartIndex = Math.max(weekStartIndex, visibleRangeStartIndex);
  let segmentEndIndex = Math.min(weekEndIndex, visibleRangeEndIndex);
  // Split labels at week and month boundaries so dimming matches each bar segment.
  while (segmentStartIndex < cellIndex && calendarGrid[segmentStartIndex].isCurrentMonth !== calendarGrid[cellIndex].isCurrentMonth) segmentStartIndex += 1;
  while (segmentEndIndex > cellIndex && calendarGrid[segmentEndIndex].isCurrentMonth !== calendarGrid[cellIndex].isCurrentMonth) segmentEndIndex -= 1;

  return {
    dayCount: Math.max(1, segmentEndIndex - segmentStartIndex + 1),
    offsetDays: Math.max(0, cellIndex - segmentStartIndex),
  };
}
