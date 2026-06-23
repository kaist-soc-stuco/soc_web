import type { KoreanHolidayRecord } from "@soc/contracts";
import { nowDate } from "@soc/shared";

import type { Language } from "@/hooks/use-language";
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
              className={`min-h-[75px] p-2 rounded-xl text-left border flex flex-col justify-between items-start transition-all cursor-pointer relative group ${
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
                  <div className="w-4.5 h-4.5 rounded-full bg-slate-900 text-white flex items-center justify-center text-[11px] font-bold shrink-0">
                    {cell.day}
                  </div>
                ) : (
                  <span
                    title={holiday?.dateName}
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
                    title={holiday.dateName}
                  >
                    {holiday.dateName}
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
                <div className="absolute bottom-full left-1/2 z-30 mb-2 flex w-56 -translate-x-1/2 scale-95 select-none flex-col gap-2 rounded-2xl border border-card-border-subtle bg-white p-3 text-[10px] text-slate-800 opacity-0 shadow-[0_18px_45px_rgba(15,23,42,0.16)] transition-all duration-200 pointer-events-none group-hover:scale-100 group-hover:opacity-100">
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
