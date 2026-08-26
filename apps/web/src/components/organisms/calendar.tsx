import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { createApiClient } from "@soc/api-client";
import { isoToDate, localDate, nowDate } from "@soc/shared";
import type { PublicCalendarEventItem } from "@soc/contracts";
import { ChevronRight } from "lucide-react";

import { resolveApiBaseUrl } from "@/lib/api-base-url";
import { formatNumericDate } from "@/lib/date-display";
import { useLanguage } from "@/hooks/use-language";

interface HomeScheduleItem {
  id: string;
  sourceType: PublicCalendarEventItem["sourceType"];
  category?: PublicCalendarEventItem["category"];
  titleKo: string;
  titleEn?: string | null;
  startAt: Date;
  endAt: Date;
}

function toIsoDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getScheduleType(item: HomeScheduleItem, lang: string) {
  if (item.category === "HOLIDAY") {
    return lang === "ko" ? "공휴일" : "Public holiday";
  }
  if (item.sourceType === "KAIST_ACADEMIC") {
    return lang === "ko" ? "학사 일정" : "Academic schedule";
  }
  return lang === "ko" ? "학생회 일정" : "Council schedule";
}

function formatScheduleRange(item: HomeScheduleItem) {
  const start = formatNumericDate(item.startAt);
  const end = formatNumericDate(item.endAt);
  return start === end ? start : `${start} – ${end}`;
}

function ScheduleSkeleton() {
  return (
    <div className="grid flex-1 grid-rows-6 divide-y divide-slate-100" aria-busy="true">
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={index} className="flex items-center gap-4 px-4 py-3">
          <div className="home-loading-surface h-4 w-12 rounded" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="home-loading-surface h-3.5 w-4/5 rounded" />
            <div className="home-loading-surface h-3 w-32 rounded" />
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
  const range = useMemo(() => {
    const from = nowDate();
    from.setHours(0, 0, 0, 0);
    const to = localDate(from.getFullYear(), from.getMonth() + 4, from.getDate());
    to.setHours(23, 59, 59, 999);
    return { from, to };
  }, []);

  const eventsQuery = useQuery({
    queryKey: ["calendar", "home-upcoming", range.from.toISOString(), range.to.toISOString()],
    queryFn: () => apiClient.getPublicCalendarEvents({
      from: range.from.toISOString(),
      to: range.to.toISOString(),
    }),
    staleTime: 60 * 1000,
  });

  const schedules = useMemo(() => {
    const grouped = new Map<string, HomeScheduleItem>();
    for (const event of eventsQuery.data?.items ?? []) {
      const startAt = isoToDate(event.startAt ?? event.date);
      const endAt = isoToDate(event.endAt ?? event.date);
      const previous = grouped.get(event.id);
      if (!previous) {
        grouped.set(event.id, {
          id: event.id,
          sourceType: event.sourceType,
          category: event.category,
          titleKo: event.titleKo,
          titleEn: event.titleEn,
          startAt,
          endAt,
        });
        continue;
      }
      if (startAt.getTime() < previous.startAt.getTime()) previous.startAt = startAt;
      if (endAt.getTime() > previous.endAt.getTime()) previous.endAt = endAt;
    }

    return [...grouped.values()]
      .filter((item) => item.endAt.getTime() >= range.from.getTime())
      .sort((a, b) => a.startAt.getTime() - b.startAt.getTime() || a.titleKo.localeCompare(b.titleKo))
      .slice(0, 6);
  }, [eventsQuery.data?.items, range.from]);

  return (
    <section className="home-bento-card flex h-full min-h-0 min-w-0 flex-col overflow-hidden">
      <header className="flex h-11 shrink-0 items-center justify-between border-b border-slate-100 px-4">
        <h3 className="text-sm font-semibold tracking-[-0.01em] text-[#172033]">
          {lang === "ko" ? "다가오는 일정" : "Upcoming schedule"}
        </h3>
        <Link to="/calendar" className="home-more-link shrink-0">
          <span>{lang === "ko" ? "더보기" : "More"}</span>
          <ChevronRight aria-hidden="true" className="h-3 w-3" />
        </Link>
      </header>

      {eventsQuery.isPending ? (
        <ScheduleSkeleton />
      ) : schedules.length > 0 ? (
        <ul className="grid min-h-0 flex-1 divide-y divide-slate-100">
          {schedules.map((item) => {
            const title = lang === "ko" ? item.titleKo : item.titleEn || item.titleKo;
            return (
              <li key={item.id}>
                <Link
                  to={`/calendar?selected=${toIsoDate(item.startAt)}`}
                  className="home-schedule-row flex h-full min-h-[3.625rem] items-center gap-4 px-4 py-2.5 hover:bg-slate-50/80"
                >
                  <time className="w-[6.75rem] shrink-0 whitespace-nowrap text-[0.8125rem] font-normal tabular-nums text-[#667085]">
                    {formatScheduleRange(item)}
                  </time>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-normal text-[#172033]">{title}</p>
                    <p className="mt-0.5 truncate text-xs font-normal text-[#667085]">
                      {getScheduleType(item, lang)}
                    </p>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="flex min-h-[12rem] flex-1 items-center justify-center px-4 text-sm font-normal text-[#667085]">
          {lang === "ko" ? "예정된 일정이 없습니다." : "No upcoming schedules."}
        </p>
      )}
    </section>
  );
}
