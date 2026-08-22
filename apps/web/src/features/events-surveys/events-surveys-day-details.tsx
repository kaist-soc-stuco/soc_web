import { Link } from "react-router-dom";
import type { KoreanHolidayRecord } from "@soc/contracts";
import { isoToDate } from "@soc/shared";
import { ArrowRight, Clock } from "lucide-react";

import type { Language } from "@/hooks/use-language";
import { getKoreanHolidayName } from "@/lib/korean-holidays";
import { formatShortDate } from "@/lib/date-display";
import { stripCalendarPrefix, type CalendarEvent } from "@/lib/events-surveys";
import { getCalendarEventStyles } from "./events-surveys-calendar-utils";

interface EventsSurveysDayDetailsProps {
  events: CalendarEvent[];
  lang: Language;
  selectedDateStr: string;
  selectedHoliday?: KoreanHolidayRecord;
}

export function EventsSurveysDayDetails({
  events,
  lang,
  selectedDateStr,
  selectedHoliday,
}: EventsSurveysDayDetailsProps) {
  return (
    <aside className="sticky top-24 flex h-full min-h-[500px] flex-col rounded-lg border border-card-border-subtle bg-white p-5 shadow-none lg:col-span-1">
      <div className="shrink-0 border-b border-slate-100 pb-4 select-none">
        <h3 className="text-lg font-bold text-slate-800">{selectedDateStr}</h3>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
          <p className="text-sm font-medium text-slate-400">
            {lang === "ko"
              ? `${events.length}개의 일정`
              : `${events.length} event${events.length === 1 ? "" : "s"}`}
          </p>
          {selectedHoliday && (
            <span className="text-xs font-medium text-rose-300">
              {getKoreanHolidayName(selectedHoliday.dateName, lang)}
            </span>
          )}
        </div>
      </div>

      {events.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center py-12 text-center select-none">
          <p className="text-sm font-semibold text-slate-400">
            {lang === "ko" ? "등록된 일정이 없습니다." : "No events scheduled."}
          </p>
        </div>
      ) : (
        <div className="flex-1 space-y-2.5 overflow-y-auto py-4 pr-1">
          {events.map((event, idx) => {
            const style = getCalendarEventStyles(
              event.kind,
              lang,
              event.sourceType,
            );
            const isAcademic = event.sourceType === "KAIST_ACADEMIC";
            const eventDate = isoToDate(event.rawDate);
            const startDate = event.startAt ?? event.date;
            const endDate = event.endAt ?? event.date;
            const isMultiDay = !isSameLocalDay(startDate, endDate);
            const formattedTime = isAcademic
              ? isMultiDay
                ? `${formatShortDate(startDate, lang)} ～ ${formatShortDate(endDate, lang)}`
                : lang === "ko"
                  ? "종일"
                  : "All day"
              : eventDate.toLocaleTimeString(
                  lang === "ko" ? "ko-KR" : "en-US",
                  {
                    hour: "2-digit",
                    minute: "2-digit",
                    hour12: false,
                  },
                );
            const shortTitle = stripCalendarPrefix(event.title);

            return (
              <div
                key={idx}
                className="relative shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-white p-3.5"
              >
                <div
                  className={`absolute inset-y-0 left-0 w-1 ${style.bullet}`}
                  aria-hidden="true"
                />
                <div className="flex items-start gap-2.5 pl-1">
                  <div className="min-w-0 flex-1">
                    <h4 className="truncate text-sm font-bold leading-snug text-slate-800">
                      {shortTitle}
                    </h4>
                    {event.description && (
                      <p className="mt-1 line-clamp-2 text-xs font-medium leading-relaxed text-slate-500">
                        {event.description}
                      </p>
                    )}
                    <div className="mt-3 flex items-center justify-between gap-2 border-t border-slate-100 pt-2 text-[11px] font-medium text-slate-400 select-none">
                      <div className="flex min-w-0 items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                        <span className="truncate">{formattedTime}</span>
                      </div>

                      {event.sourceType === "ARTICLE" && event.articleId ? (
                        <Link
                          to={`/board/행사/${event.articleId}`}
                          className="inline-flex shrink-0 items-center gap-0.5 text-xs font-semibold text-brand-primary transition hover:opacity-85"
                        >
                          <span>{lang === "ko" ? "자세히 보기" : "View details"}</span>
                          <ArrowRight className="h-3 w-3" />
                        </Link>
                      ) : event.sourceType === "SURVEY" && event.surveyId ? (
                        <Link
                          to={`/survey/${event.surveyId}`}
                          className="inline-flex shrink-0 items-center gap-0.5 text-xs font-semibold text-brand-primary transition hover:opacity-85"
                        >
                          <span>{lang === "ko" ? "자세히 보기" : "View details"}</span>
                          <ArrowRight className="h-3 w-3" />
                        </Link>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </aside>
  );
}

function isSameLocalDay(first: Date, second: Date) {
  return (
    first.getFullYear() === second.getFullYear() &&
    first.getMonth() === second.getMonth() &&
    first.getDate() === second.getDate()
  );
}
