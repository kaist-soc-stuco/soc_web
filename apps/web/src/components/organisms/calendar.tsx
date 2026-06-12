import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { createApiClient } from "@soc/api-client";
import { isoToDate, localDate, msToDate, nowDate } from "@soc/shared";
import type {
  ArticleListItem,
  KoreanHolidayRecord,
  SurveyRecord,
} from "@soc/contracts";
import { resolveApiBaseUrl } from "@/lib/api-base-url";
import { useLanguage } from "@/hooks/use-language";

interface CompactEvent {
  id: string;
  kind: string;
  cleanTitleKo: string;
  cleanTitleEn?: string | null;
  date: Date;
  dateType: "open" | "close";
}

interface CalendarPreviewEvent {
  key: string;
  cleanTitle: string;
  timeText: string;
  dateType: "open" | "close" | "range";
  sortDate: Date;
}

function toDateKey(date: Date) {
  const yyyy = String(date.getFullYear());
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}${mm}${dd}`;
}

function isSameDate(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function formatTime(date: Date) {
  const hh = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  return `${hh}:${min}`;
}

function formatDate(date: Date) {
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${mm}.${dd}`;
}

function formatMonthTitle(year: number, monthIndex: number, lang: string) {
  if (lang === "ko") return `${year}년 ${monthIndex + 1}월`;
  return new Intl.DateTimeFormat("en", {
    month: "long",
    year: "numeric",
  }).format(dateFromParts(year, monthIndex));
}

function dateFromParts(year: number, monthIndex: number) {
  return new Date(year, monthIndex, 1);
}

function formatWeekDate(date: Date, lang: string) {
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const daysKo = ["일", "월", "화", "수", "목", "금", "토"];
  const daysEn = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const dayName = lang === "ko" ? daysKo[date.getDay()] : daysEn[date.getDay()];
  const hh = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  return `${mm}.${dd} (${dayName}) ${hh}:${min}`;
}

function getCompactEventTitle(event: CompactEvent, lang: string) {
  return lang === "ko"
    ? event.cleanTitleKo
    : event.cleanTitleEn || event.cleanTitleKo;
}

function buildPreviewEvents(
  dayEvents: CompactEvent[],
  lang: string,
): CalendarPreviewEvent[] {
  const sortedEvents = [...dayEvents].sort(
    (a, b) => a.date.getTime() - b.date.getTime(),
  );
  const consumed = new Set<string>();
  const previewEvents: CalendarPreviewEvent[] = [];

  sortedEvents.forEach((event, index) => {
    const eventKey = `${event.id}-${event.dateType}`;
    if (consumed.has(eventKey)) return;

    if (event.kind === "EVENT" && event.dateType === "open") {
      const closeEvent = sortedEvents.find(
        (candidate) =>
          candidate.id === event.id &&
          candidate.kind === event.kind &&
          candidate.dateType === "close" &&
          isSameDate(candidate.date, event.date),
      );

      if (closeEvent) {
        consumed.add(eventKey);
        consumed.add(`${closeEvent.id}-${closeEvent.dateType}`);
        previewEvents.push({
          key: `${event.id}-range`,
          cleanTitle: getCompactEventTitle(event, lang),
          timeText: `(${formatTime(event.date)} ~ ${formatTime(closeEvent.date)})`,
          dateType: "range",
          sortDate: event.date,
        });
        return;
      }
    }

    consumed.add(eventKey);
    previewEvents.push({
      key: `${event.id}-${event.dateType}-${index}`,
      cleanTitle: getCompactEventTitle(event, lang),
      timeText:
        event.dateType === "open"
          ? `(${formatTime(event.date)}~)`
          : `(~${formatTime(event.date)})`,
      dateType: event.dateType,
      sortDate: event.date,
    });
  });

  return previewEvents.sort(
    (a, b) => a.sortDate.getTime() - b.sortDate.getTime(),
  );
}

export function Calendar() {
  const navigate = useNavigate();
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
  const [events, setEvents] = useState<CompactEvent[]>([]);
  const [holidays, setHolidays] = useState<KoreanHolidayRecord[]>([]);
  const [hoveredDateKey, setHoveredDateKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const holidayCacheRef = useRef(new Map<string, KoreanHolidayRecord[]>());

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([
      apiClient.getPublicSurveys(),
      apiClient
        .getArticles("행사", { page: 1, limit: 100 })
        .then((res) => res.items)
        .catch(() => [] as ArticleListItem[]),
    ])
      .then(([surveys, eventArticles]) => {
        const parsed: CompactEvent[] = [];
        surveys.forEach((survey: SurveyRecord) => {
          if (!survey.isPublished || !survey.showOnCalendar) return;

          if (survey.opensAt) {
            parsed.push({
              id: survey.id,
              kind: survey.kind,
              cleanTitleKo: survey.titleKo,
              cleanTitleEn: survey.titleEn || survey.titleKo,
              date: isoToDate(survey.opensAt),
              dateType: "open",
            });
          }
          if (survey.closesAt) {
            parsed.push({
              id: survey.id,
              kind: survey.kind,
              cleanTitleKo: survey.titleKo,
              cleanTitleEn: survey.titleEn || survey.titleKo,
              date: isoToDate(survey.closesAt),
              dateType: "close",
            });
          }
        });
        eventArticles.forEach((article: ArticleListItem) => {
          if (article.eventStartDate) {
            parsed.push({
              id: article.articleId,
              kind: "EVENT",
              cleanTitleKo: article.titleKo,
              cleanTitleEn: article.titleEn || article.titleKo,
              date: isoToDate(article.eventStartDate),
              dateType: "open",
            });
          }

          if (article.eventEndDate) {
            parsed.push({
              id: article.articleId,
              kind: "EVENT",
              cleanTitleKo: article.titleKo,
              cleanTitleEn: article.titleEn || article.titleKo,
              date: isoToDate(article.eventEndDate),
              dateType: "close",
            });
          }
        });

        if (active) {
          setEvents(parsed);
        }
      })
      .catch((err) => {
        console.error("Failed to load compact calendar events:", err);
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [apiClient]);

  useEffect(() => {
    let active = true;
    const cacheKey = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}`;
    const cached = holidayCacheRef.current.get(cacheKey);

    if (cached) {
      setHolidays(cached);
      return;
    }

    apiClient
      .getKoreanHolidays(currentYear, currentMonth + 1)
      .then((holidayItems) => {
        holidayCacheRef.current.set(cacheKey, holidayItems);
        if (active) {
          setHolidays(holidayItems);
        }
      })
      .catch((err) => {
        console.error("Failed to load Korean holidays:", err);
        if (active) {
          setHolidays([]);
        }
      });

    return () => {
      active = false;
    };
  }, [apiClient, currentMonth, currentYear]);

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
    setCurrentDate(localDate(currentYear, currentMonth - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(localDate(currentYear, currentMonth + 1, 1));
  };

  const weeklyEvents = useMemo(() => {
    const today = nowDate();
    // Get Sunday of the current week
    const currentDay = today.getDay();
    const sunday = msToDate(today.getTime());
    sunday.setDate(today.getDate() - currentDay);
    sunday.setHours(0, 0, 0, 0);

    const saturday = msToDate(sunday.getTime());
    saturday.setDate(sunday.getDate() + 6);
    saturday.setHours(23, 59, 59, 999);

    return events
      .filter((e) => {
        const time = e.date.getTime();
        return time >= sunday.getTime() && time <= saturday.getTime();
      })
      .sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [events]);
  const visibleWeeklyEvents = weeklyEvents.slice(0, 2);
  const hiddenWeeklyEventCount = Math.max(
    0,
    weeklyEvents.length - visibleWeeklyEvents.length,
  );
  const holidayMap = useMemo(() => {
    return new Map(holidays.map((holiday) => [holiday.locdate, holiday]));
  }, [holidays]);

  return (
    <section className="home-bento-card px-6 pt-4 pb-4 h-full flex flex-col justify-between select-none">
      <div className="flex flex-col pb-1">
        {/* Header */}
        <div className="mb-2.5 mt-1 flex-shrink-0 flex items-center justify-between">
          <div className="grid w-[14rem] grid-cols-[1.75rem_1fr_1.75rem] items-center gap-2">
            <button
              onClick={handlePrevMonth}
              className="w-7 h-7 rounded-full border border-slate-200 flex items-center justify-center hover:border-brand-primary-border hover:bg-brand-primary-light transition-colors text-slate-600 cursor-pointer"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>

            <h3 className="text-center text-[15px] font-extrabold text-brand-primary">
              {formatMonthTitle(currentYear, currentMonth, lang)}
            </h3>

            <button
              onClick={handleNextMonth}
              className="w-7 h-7 rounded-full border border-slate-200 flex items-center justify-center hover:border-brand-primary-border hover:bg-brand-primary-light transition-colors text-slate-600 cursor-pointer"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Weekday Headers */}
        <div className="mb-1.5 grid grid-cols-7 gap-x-1 flex-shrink-0 text-center">
          {(lang === "ko"
            ? ["일", "월", "화", "수", "목", "금", "토"]
            : ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
          ).map((day, index) => (
            <div key={index}>
              <span
                className={`text-[11.5px] font-semibold tracking-tight ${
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
          <div className="flex-1 flex items-center justify-center min-h-[176px]">
            <div className="w-6 h-6 border-2 border-brand-primary/30 border-t-brand-primary rounded-full animate-spin"></div>
          </div>
        ) : (
          <div className="flex-1 grid grid-cols-7 gap-y-0.5 bg-white min-h-[176px] overflow-visible">
            {days.map((item, index) => {
              const cellDateKey = item.date
                ? toDateKey(item.date)
                : `empty-${index}`;
              const dayEvents = item.date
                ? events.filter(
                    (e) =>
                      e.date.getFullYear() === item.date!.getFullYear() &&
                      e.date.getMonth() === item.date!.getMonth() &&
                      e.date.getDate() === item.date!.getDate(),
                  )
                : [];

              const isSunday = item.date?.getDay() === 0;
              const isSaturday = item.date?.getDay() === 6;
              const holiday = item.date
                ? holidayMap.get(toDateKey(item.date))
                : undefined;
              const isPublicHoliday = holiday?.isHoliday === true;
              const previewEvents = buildPreviewEvents(dayEvents, lang);

              return (
                <button
                  key={index}
                  onClick={() => {
                    if (item.date) {
                      navigate(
                        `/events-surveys?tab=calendar&selected=${item.date.toISOString()}`,
                      );
                    }
                  }}
                  onMouseEnter={() => setHoveredDateKey(cellDateKey)}
                  onMouseLeave={() =>
                    setHoveredDateKey((current) =>
                      current === cellDateKey ? null : current,
                    )
                  }
                  onFocus={() => setHoveredDateKey(cellDateKey)}
                  onBlur={() =>
                    setHoveredDateKey((current) =>
                      current === cellDateKey ? null : current,
                    )
                  }
                  className={`relative flex h-[34px] cursor-pointer flex-col items-center justify-start rounded-lg bg-white py-0.5 transition-all hover:z-40 ${
                    item.today ? "" : "hover:bg-slate-50/80"
                  }`}
                >
                  {item.today ? (
                    <div className="w-4.5 h-4.5 rounded-full bg-slate-900 text-white flex items-center justify-center text-[11px] font-bold shrink-0">
                      {item.day}
                    </div>
                  ) : (
                    <span
                      title={holiday?.dateName}
                      className={`text-[11.5px] font-semibold ${
                        item.isCurrentMonth
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
                  )}

                  {/* Bullet/Badge Space */}
                  <div className="flex flex-col items-center justify-end flex-1 w-full pb-0.5">
                    {dayEvents.length > 0 ? (
                      <div className="flex h-2 items-center justify-center gap-1">
                        {previewEvents.slice(0, 4).map((event) => (
                          <span
                            key={event.key}
                            title={`${event.cleanTitle} ${event.timeText}`}
                            className={`h-1.5 w-1.5 rounded-full ${
                              event.dateType === "close"
                                ? "bg-red-500"
                                : "bg-brand-primary"
                            }`}
                          />
                        ))}
                      </div>
                    ) : item.today ? (
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-900 shrink-0 mb-0.5" />
                    ) : (
                      <div className="h-2" />
                    )}
                  </div>

                  {/* Preview Tooltip on Hover */}
                  {item.date &&
                    dayEvents.length > 0 &&
                    hoveredDateKey === cellDateKey && (
                      <div
                        className={`absolute bottom-full mb-2.5 w-56 rounded-2xl border border-card-border-subtle bg-white p-3 text-[10px] text-slate-800 shadow-[0_18px_45px_rgba(15,23,42,0.16)] pointer-events-none z-50 select-none flex flex-col gap-2 ${(() => {
                          const column = index % 7;
                          if (column <= 2) return "left-0 translate-x-0";
                          if (column >= 4) return "right-0 translate-x-0";
                          return "left-1/2 -translate-x-1/2";
                        })()}`}
                      >
                        <div className="flex items-center justify-between border-b border-slate-100 pb-1.5 font-extrabold text-brand-primary">
                          <span>{formatDate(item.date)}</span>
                          <span>
                            {lang === "ko"
                              ? `${previewEvents.length}개 일정`
                              : `${previewEvents.length} event${
                                  previewEvents.length === 1 ? "" : "s"
                                }`}
                          </span>
                        </div>
                        <div className="flex flex-col gap-1.5 text-[10px] font-semibold text-slate-700">
                          {previewEvents.slice(0, 4).map((event) => (
                            <div
                              key={event.key}
                              className="flex min-w-0 items-center gap-1.5"
                            >
                              <span
                                className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                                  event.dateType === "close"
                                    ? "bg-red-500"
                                    : "bg-brand-primary"
                                }`}
                              />
                              <span className="min-w-0 flex-1 truncate">
                                {event.cleanTitle}
                              </span>
                              <span className="shrink-0 text-[9px] font-bold text-slate-500">
                                {event.timeText}
                              </span>
                            </div>
                          ))}
                          {previewEvents.length > 4 && (
                            <div className="pl-3 text-[9px] font-semibold text-slate-400">
                              {lang === "ko"
                                ? `+ ${previewEvents.length - 4}개 더보기`
                                : `+ ${previewEvents.length - 4} more`}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* 이번 주 예정 일정 */}
      <div className="mt-1.5 flex-shrink-0 flex flex-col gap-1">
        <div className="flex items-center justify-between border-b border-slate-100 pb-1">
          <h4 className="home-card-title text-slate-800">
            {lang === "ko" ? "이번 주 예정 일정" : "This Week"}
          </h4>
          <Link
            to="/events-surveys?tab=calendar"
            className="home-more-link"
          >
            <span>{lang === "ko" ? "더보기" : "More"}</span>
            <svg
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              strokeWidth="2.5"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 5l7 7-7 7"
              />
            </svg>
          </Link>
        </div>
        <div className="flex flex-col gap-0.5">
          {weeklyEvents.length > 0 ? (
            visibleWeeklyEvents.map((event, index) => {
              const isDeadline = event.dateType === "close";
              const cleanTitle = getCompactEventTitle(event, lang);
              const statusLabel = isDeadline
                ? lang === "ko"
                  ? "마감"
                  : "Deadline"
                : lang === "ko"
                  ? "시작"
                  : "Start";
              const showHiddenCount =
                hiddenWeeklyEventCount > 0 &&
                index === visibleWeeklyEvents.length - 1;

              return (
                <div
                  key={`${event.id}-${event.dateType}`}
                  onClick={() =>
                    navigate(
                      `/events-surveys?tab=calendar&selected=${event.date.toISOString()}`,
                    )
                  }
                  className="flex items-center justify-between py-0.5 transition-colors hover:bg-slate-50 rounded-lg px-2 -mx-2 cursor-pointer"
                >
                  <div className="flex items-center gap-3 w-full min-w-0">
                    <span className="home-meta-text shrink-0 text-slate-500">
                      {formatWeekDate(event.date, lang)}
                    </span>
                    <span className="home-meta-text min-w-0 flex-1 truncate text-slate-700">
                      {cleanTitle}
                    </span>
                    <span
                      className={`shrink-0 rounded-md border px-1.5 py-0.5 text-[9px] font-bold ${
                        isDeadline
                          ? "border-slate-200 bg-slate-50 text-slate-400"
                          : "border-brand-primary-border bg-brand-primary-light text-brand-primary"
                      }`}
                    >
                      {statusLabel}
                    </span>
                    {showHiddenCount && (
                      <span className="shrink-0 rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-extrabold text-slate-500">
                        +{hiddenWeeklyEventCount}
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          ) : (
            <p className="text-xs text-slate-500 text-center py-4">
              {lang === "ko"
                ? "이번 주 예정된 일정이 없습니다."
                : "No scheduled events this week."}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
