import { Link } from "react-router-dom";
import type { KoreanHolidayRecord } from "@soc/contracts";
import { isoToDate } from "@soc/shared";
import { ArrowRight, Calendar as CalendarIcon, Clock } from "lucide-react";

import type { Language } from "@/hooks/use-language";
import { getKoreanHolidayName } from "@/lib/korean-holidays";
import {
  stripCalendarPrefix,
  type CalendarEvent,
} from "@/lib/events-surveys";
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
    <div className="lg:col-span-1 bg-white rounded-3xl border border-card-border-subtle p-4.5 shadow-card min-h-[380px] lg:h-[500px] sticky top-24 self-start flex flex-col justify-between">
      <div className="flex flex-col min-h-0 flex-1">
        <h3 className="text-base font-extrabold text-kaist-black border-b border-kaist-grey/10 pb-2.5 mb-3.5 flex items-center gap-2 select-none shrink-0">
          <CalendarIcon className="w-4 h-4 text-brand-primary" />
          <span>
            {lang === "ko" ? "일정 상세조회" : "Day Schedule Details"}
          </span>
        </h3>

        <div className="flex flex-col min-h-0 flex-1 space-y-4">
          <div className="bg-brand-primary-light border border-brand-primary/10 rounded-2xl p-3 flex flex-col items-center gap-1 text-center shadow-card select-none shrink-0">
            <span className="text-[12.5px] font-black text-brand-primary">
              {selectedDateStr}
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10.5px] font-extrabold bg-brand-primary text-white shadow-card mt-1">
              <CalendarIcon className="w-3 h-3" />
              <span>
                {lang === "ko"
                  ? `총 ${events.length}개 일정`
                  : `${events.length} Events`}
              </span>
            </span>
            {selectedHoliday && (
              <span className="mt-1 inline-flex items-center rounded-full border border-red-100 bg-red-50 px-2.5 py-0.5 text-[10.5px] font-extrabold text-red-500">
                {getKoreanHolidayName(selectedHoliday.dateName, lang)}
              </span>
            )}
          </div>

          {events.length === 0 ? (
            <div className="text-center py-12 space-y-2 flex-1 flex flex-col justify-center select-none">
              <p className="text-sm font-semibold text-slate-400">
                {lang === "ko"
                  ? "등록된 일정이 없습니다."
                  : "No events scheduled."}
              </p>
              <p className="text-xs text-slate-400/70">
                {lang === "ko"
                  ? "다른 날짜를 선택해보세요."
                  : "Select another date."}
              </p>
            </div>
          ) : (
            <div className="space-y-2.5 overflow-y-auto pr-1 flex-1 max-h-[300px] lg:max-h-[330px]">
              {events.map((event, idx) => {
                const style = getCalendarEventStyles(event.kind, lang);
                const eventDate = isoToDate(event.rawDate);
                const formattedTime = eventDate.toLocaleTimeString(
                  lang === "ko" ? "ko-KR" : "en-US",
                  {
                    hour: "2-digit",
                    minute: "2-digit",
                    hour12: false,
                  },
                );
                const isStateOpen = event.computedState === "open";
                const shortTitle = stripCalendarPrefix(event.title);

                return (
                  <div
                    key={idx}
                    className="bg-white border border-card-border-subtle rounded-xl p-3.5 space-y-2 shadow-card hover:shadow-card-hover transition-shadow relative overflow-hidden shrink-0"
                  >
                    <div
                      className={`absolute top-0 left-0 right-0 h-0.5 ${style.bullet}`}
                    />

                    <div className="flex items-center justify-between select-none">
                      <span
                        className={`text-[9px] font-black px-2 py-0.2 rounded-full border ${style.bg}`}
                      >
                        {style.label}
                      </span>

                      <span
                        className={`text-[9px] font-black px-2 py-0.2 rounded-full ${
                          isStateOpen
                            ? "bg-brand-primary-light text-brand-primary"
                            : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {isStateOpen
                          ? lang === "ko"
                            ? "진행중"
                            : "Ongoing"
                          : lang === "ko"
                            ? "마감됨"
                            : "Closed"}
                      </span>
                    </div>

                    <div className="space-y-1">
                      <h4 className="text-[12.5px] font-bold text-slate-800 leading-snug">
                        {shortTitle}
                      </h4>
                      {event.description && (
                        <p className="text-[10.5px] text-slate-500 leading-relaxed font-medium line-clamp-2">
                          {event.description}
                        </p>
                      )}
                    </div>

                    <div className="pt-2 border-t border-slate-50 flex items-center justify-between text-[10px] font-semibold text-slate-500 select-none">
                      <div className="flex items-center gap-1 text-slate-400">
                        <Clock className="w-3 h-3 text-slate-300 animate-pulse" />
                        <span>{formattedTime}</span>
                        <span className="text-slate-200">|</span>
                        <span>
                          {event.dateType === "open"
                            ? lang === "ko"
                              ? "시작"
                              : "Starts"
                            : lang === "ko"
                              ? "마감"
                              : "Ends"}
                        </span>
                      </div>

                      <div className="flex gap-2">
                        {event.sourceType === "ARTICLE" &&
                          event.surveyId &&
                          isStateOpen && (
                            <Link
                              to={`/survey/${event.surveyId}`}
                              className="inline-flex items-center rounded-md bg-brand-primary-light px-1.5 py-0.5 text-[9px] font-extrabold text-brand-primary hover:opacity-85 transition-all cursor-pointer mr-2"
                            >
                              <span>
                                {lang === "ko"
                                  ? "신청 가능"
                                  : "Application open"}
                              </span>
                            </Link>
                          )}
                        <Link
                          to={
                            event.sourceType === "ARTICLE"
                              ? `/board/행사/${event.articleId ?? event.id}`
                              : `/survey/${event.surveyId ?? event.id}`
                          }
                          className="inline-flex items-center gap-0.5 text-brand-primary hover:opacity-85 transition-all cursor-pointer text-[10px]"
                        >
                          <span>
                            {event.sourceType === "ARTICLE"
                              ? lang === "ko"
                                ? "자세히 보기"
                                : "View"
                              : lang === "ko"
                                ? "보기"
                                : "View"}
                          </span>
                          <ArrowRight className="w-3 h-3" />
                        </Link>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
