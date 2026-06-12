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

  const remainingCells = 42 - grid.length;
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
) {
  switch (kind) {
    case "VOTE":
      return {
        bg: "bg-purple-100 border-purple-300 font-extrabold text-purple-950 shadow-[0_1px_2px_rgba(0,0,0,0.02)]",
        bullet: "bg-purple-600",
        label: lang === "ko" ? "투표" : "Vote",
      };
    case "EVENT":
      return {
        bg: "bg-brand-primary-light border-brand-primary-border font-extrabold text-brand-primary",
        bullet: "bg-brand-primary",
        label: lang === "ko" ? "행사" : "Event",
      };
    case "APPLICATION":
      return {
        bg: "bg-blue-100 border-blue-300 font-extrabold text-blue-950 shadow-[0_1px_2px_rgba(0,0,0,0.02)]",
        bullet: "bg-blue-600",
        label: lang === "ko" ? "신청" : "Application",
      };
    case "SURVEY":
    default:
      return {
        bg: "bg-teal-100 border-teal-300 font-extrabold text-teal-950 shadow-[0_1px_2px_rgba(0,0,0,0.02)]",
        bullet: "bg-teal-600",
        label: lang === "ko" ? "설문" : "Survey",
      };
  }
}

export function getCompactKindLabel(
  kind: CalendarEvent["kind"],
  lang: Language = "ko",
) {
  if (kind === "VOTE") return lang === "ko" ? "투표" : "Vote";
  if (kind === "APPLICATION") return lang === "ko" ? "신청" : "Apply";
  if (kind === "EVENT") return lang === "ko" ? "행사" : "Event";
  return lang === "ko" ? "설문" : "Survey";
}
