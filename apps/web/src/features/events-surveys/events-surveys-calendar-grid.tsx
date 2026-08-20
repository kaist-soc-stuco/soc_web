import type { KoreanHolidayRecord } from "@soc/contracts";
import { nowDate } from "@soc/shared";

import type { Language } from "@/hooks/use-language";
import { getKoreanHolidayName } from "@/lib/korean-holidays";
import {
  stripCalendarPrefix,
  type CalendarEvent,
} from "@/lib/events-surveys";
import {
  getCompactKindLabel,
  isSameDay,
  toDateKey,
  type CalendarCell,
} from "./events-surveys-calendar-utils";

interface EventsSurveysCalendarGridProps {
  calendarEvents: CalendarEvent[];
  calendarGrid: CalendarCell[];
  holidayMap: Map<string, KoreanHolidayRecord>;
  lang: Language;
  onSelectedDateChange: (date: Date) => void;
  selectedDate: Date;
  weekHeaders: string[];
}

export function EventsSurveysCalendarGrid({
  calendarEvents,
  calendarGrid,
  holidayMap,
  lang,
  onSelectedDateChange,
  selectedDate,
  weekHeaders,
}: EventsSurveysCalendarGridProps) {
  return (
    <>
      <div className="grid grid-cols-7 gap-1 text-center mb-2 select-none">
        {weekHeaders.map((week, idx) => (
          <div
            key={idx}
            className={`text-xs font-extrabold py-1.5 ${
              idx === 0
                ? "text-red-500"
                : idx === 6
                  ? "text-blue-500"
                  : "text-kaist-greygreen"
            }`}
          >
            {week}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 grid-rows-6 gap-1.5 min-h-[430px]">
        {calendarGrid.map((cell, idx) => {
          const dayEvents = calendarEvents.filter((event) =>
            isSameDay(event.date, cell.date),
          );
          const isToday = isSameDay(nowDate(), cell.date);
          const isSelected = isSameDay(selectedDate, cell.date);
          const holiday = holidayMap.get(toDateKey(cell.date));
          const isPublicHoliday = holiday?.isHoliday === true;

          return (
            <button
              key={idx}
              type="button"
              onClick={() => onSelectedDateChange(cell.date)}
              className={`relative flex min-h-[75px] cursor-pointer flex-col items-start justify-between rounded-md border p-2 text-left transition-colors group ${
                cell.isCurrentMonth
                  ? isSelected
                    ? "bg-brand-primary-light border-brand-primary-border"
                    : "bg-white hover:bg-slate-50/50 border-kaist-grey/10"
                  : isSelected
                    ? "bg-brand-primary-light/70 border-brand-primary-border text-kaist-grey/40"
                    : "bg-slate-50/40 border-transparent text-kaist-grey/40"
              }`}
            >
              <div className="flex items-center justify-between w-full select-none">
                {isToday ? (
                  <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-brand-primary bg-brand-primary-light text-[11px] font-semibold text-brand-primary">
                    {cell.day}
                  </div>
                ) : (
                  <span
                    title={
                      holiday
                        ? getKoreanHolidayName(holiday.dateName, lang)
                        : undefined
                    }
                    className={`text-xs leading-none ${
                      isSelected
                        ? "text-brand-primary font-extrabold"
                        : cell.isCurrentMonth
                          ? cell.date.getDay() === 0 || isPublicHoliday
                            ? "text-red-500"
                            : cell.date.getDay() === 6
                              ? "text-blue-500"
                              : "text-kaist-black"
                          : "text-kaist-grey/40 font-bold"
                    } ${cell.isCurrentMonth && !isSelected ? "font-bold" : ""}`}
                  >
                    {cell.day}
                  </span>
                )}
                {holiday && cell.isCurrentMonth && (
                  <span
                    className={`truncate text-[9px] font-extrabold ${
                      holiday.isHoliday ? "text-red-400" : "text-slate-400"
                    }`}
                    title={getKoreanHolidayName(holiday.dateName, lang)}
                  >
                    {getKoreanHolidayName(holiday.dateName, lang)}
                  </span>
                )}
              </div>

              <div
                className="mt-2.5 flex w-full items-center gap-1.5 overflow-hidden"
                aria-label={
                  lang === "ko"
                    ? `${dayEvents.length}개 일정`
                    : `${dayEvents.length} events`
                }
              >
                {dayEvents.slice(0, 4).map((event, eventIdx) => {
                  const isStart = event.dateType === "open";
                  return (
                    <span
                      key={eventIdx}
                      className={`h-1.5 w-1.5 shrink-0 rounded-full ${isStart ? "bg-brand-primary" : "bg-red-500"}`}
                      title={event.title}
                    />
                  );
                })}
                {dayEvents.length > 4 && (
                  <span className="text-[8px] font-bold leading-none text-slate-400 select-none">
                    +{dayEvents.length - 4}
                  </span>
                )}
              </div>

              {cell.isCurrentMonth && dayEvents.length > 0 && (
                <div className="absolute bottom-full left-1/2 z-30 mb-2 flex w-56 -translate-x-1/2 select-none flex-col gap-2 rounded-lg border border-card-border-subtle bg-white p-3 text-[10px] text-slate-800 opacity-0 shadow-elevated transition-opacity duration-200 pointer-events-none group-hover:opacity-100">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-1.5 font-extrabold text-brand-primary">
                    <span>
                      {cell.date.toLocaleDateString(
                        lang === "ko" ? "ko-KR" : "en-US",
                        {
                          month: "short",
                          day: "numeric",
                        },
                      )}
                    </span>
                    <span>
                      {lang === "ko"
                        ? `${dayEvents.length}개 일정`
                        : `${dayEvents.length} event${dayEvents.length === 1 ? "" : "s"}`}
                    </span>
                  </div>
                  <div className="flex flex-col gap-1.5 text-left text-[9px] font-semibold text-slate-700">
                    {dayEvents.map((event, eventIdx) => {
                      const isStart = event.dateType === "open";
                      const titleText = stripCalendarPrefix(event.title);

                      return (
                        <div
                          key={eventIdx}
                          className="flex items-center justify-between gap-2 text-left"
                        >
                          <div className="truncate flex items-center gap-1.5 text-left">
                            <span
                              className={`w-1.5 h-1.5 rounded-full shrink-0 ${isStart ? "bg-brand-primary" : "bg-red-500"}`}
                            />
                            <span className="truncate text-left">{titleText}</span>
                          </div>
                          <span className="shrink-0 select-none rounded-sm bg-brand-primary-light px-1 text-[8px] font-extrabold uppercase text-brand-primary">
                            {getCompactKindLabel(event.kind, lang)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </button>
          );
        })}
      </div>
    </>
  );
}
