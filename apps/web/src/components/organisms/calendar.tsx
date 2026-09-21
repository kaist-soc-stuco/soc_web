import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { createApiClient } from "@soc/api-client";
import { isoToDate, localDate, nowDate } from "@soc/shared";
import { ArrowUpRight } from "lucide-react";

import { resolveApiBaseUrl } from "@/lib/api-base-url";
import { formatNumericDate } from "@/lib/date-display";
import { useLanguage } from "@/hooks/use-language";
import { Button } from "@/components/ui/button";

interface HomeScheduleItem {
  priority: number;
  id: string;
  titleKo: string;
  titleEn?: string | null;
  startAt: Date;
  endAt: Date;
}

const HOME_SCHEDULE_LIMIT = 6;
const HOME_SCHEDULE_DDAY_WINDOW_DAYS = 7;
const DAY_IN_MS = 24 * 60 * 60 * 1000;

function toIsoDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatScheduleRange(item: HomeScheduleItem) {
  const start = formatNumericDate(item.startAt);
  const end = formatNumericDate(item.endAt);
  return start === end ? start : `${start} – ${end}`;
}

function localDayTimestamp(value: Date) {
  return localDate(value.getFullYear(), value.getMonth(), value.getDate()).getTime();
}

function getScheduleDdayLabel(item: HomeScheduleItem) {
  const today = localDayTimestamp(nowDate());
  const start = localDayTimestamp(item.startAt);
  const end = localDayTimestamp(item.endAt);
  const target = start >= today ? start : end >= today ? end : null;
  if (target === null) return null;

  const dayDifference = Math.round((target - today) / DAY_IN_MS);
  if (dayDifference < 0 || dayDifference > HOME_SCHEDULE_DDAY_WINDOW_DAYS) return null;
  return dayDifference === 0 ? "D-Day" : `D-${dayDifference}`;
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
          priority: event.sourceType !== "KAIST_ACADEMIC" ? 0 : event.category === "HOLIDAY" ? 1 : 2,
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
      .sort((a, b) => localDayTimestamp(a.startAt) - localDayTimestamp(b.startAt) || a.priority - b.priority || a.startAt.getTime() - b.startAt.getTime() || a.titleKo.localeCompare(b.titleKo))
      .slice(0, HOME_SCHEDULE_LIMIT);
  }, [eventsQuery.data?.items, range.from]);

  return (
    <section className="home-schedule-section min-w-0" aria-labelledby="home-schedule-title">
      <header className="home-section-heading">
        <h2 id="home-schedule-title">
          <Link to="/calendar" className="home-heading-link">
            {lang === "ko" ? "다가오는 일정" : "Upcoming schedule"}
            <ArrowUpRight aria-hidden="true" />
          </Link>
        </h2>
      </header>

      {eventsQuery.isPending ? null : eventsQuery.isError ? (
        <div className="home-data-error flex-1" role="alert">
          <p>{lang === "ko" ? "일정을 불러오지 못했습니다." : "We couldn't load the schedule."}</p>
          <Button type="button" variant="outline" size="lg" onClick={() => void eventsQuery.refetch()}>
            {lang === "ko" ? "다시 시도" : "Try again"}
          </Button>
        </div>
      ) : schedules.length > 0 ? (
        <ul className="home-editorial-list">
          {schedules.map((item) => {
            const title = lang === "ko" ? item.titleKo : item.titleEn || item.titleKo;
            const ddayLabel = getScheduleDdayLabel(item);
            const showDdayBadge = ddayLabel !== null && ddayLabel !== "D-Day";
            return (
              <li key={item.id} className="min-w-0 overflow-hidden">
                <Link
                  to={`/calendar?selected=${toIsoDate(item.startAt)}`}
                  className="home-schedule-entry"
                >
                  <time dateTime={toIsoDate(item.startAt)}>
                    {formatScheduleRange(item)}
                  </time>
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate">{title}</h3>
                  </div>
                  {showDdayBadge ? <span className="home-editorial-dday home-schedule-dday shrink-0">{ddayLabel}</span> : null}
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
