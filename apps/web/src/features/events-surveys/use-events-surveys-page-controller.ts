import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { createApiClient } from "@soc/api-client";
import type { KoreanHolidayRecord } from "@soc/contracts";
import { isoToDate, localDate, nowDate } from "@soc/shared";

import { resolveApiBaseUrl } from "@/lib/api-base-url";
import { resolveAssetUrl } from "@/lib/asset-url";
import {
  buildCalendarEventsFromPublicItems,
  buildUnifiedItems,
  filterItemsByTab,
  sortVisibleItems,
  type CalendarEvent,
  type EventsSurveysSortKey,
  type EventsSurveysStateFilter,
  type UnifiedItem,
} from "@/lib/events-surveys";
import { buildCalendarGrid } from "./events-surveys-calendar-utils";

export function useEventsSurveysPageController({
  currentTab,
  lang,
  selectedParam,
}: {
  currentTab: string;
  lang: string;
  selectedParam: string | null;
}) {
  const apiClient = useMemo(
    () => createApiClient({ baseUrl: resolveApiBaseUrl() }),
    [],
  );
  const [sortBy, setSortBy] = useState<EventsSurveysSortKey>("latest");
  const [stateFilter, setStateFilter] =
    useState<EventsSurveysStateFilter>("all");
  const [currentDate, setCurrentDate] = useState(() => nowDate());
  const [selectedDate, setSelectedDate] = useState<Date>(() => {
    if (selectedParam) {
      const parsed = isoToDate(selectedParam);
      if (!Number.isNaN(parsed.getTime())) return parsed;
    }
    return nowDate();
  });

  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth();
  const calendarRange = useMemo(() => {
    const grid = buildCalendarGrid(currentYear, currentMonth);
    const firstDate = grid[0]?.date ?? localDate(currentYear, currentMonth, 1);
    const lastDate =
      grid[grid.length - 1]?.date ?? localDate(currentYear, currentMonth + 1, 0);

    return {
      from: localDate(
        firstDate.getFullYear(),
        firstDate.getMonth(),
        firstDate.getDate(),
      ),
      to: localDate(
        lastDate.getFullYear(),
        lastDate.getMonth(),
        lastDate.getDate(),
        23,
        59,
        59,
        999,
      ),
    };
  }, [currentMonth, currentYear]);
  const calendarRangeFrom = calendarRange.from.toISOString();
  const calendarRangeTo = calendarRange.to.toISOString();

  const listQuery = useQuery({
    queryKey: ["events-surveys", "list"],
    queryFn: async () => {
      const [surveysData, eventsData] = await Promise.all([
        apiClient.getPublicSurveys(),
        apiClient
          .getArticles("행사", { page: 1, limit: 100 })
          .catch(() => ({ items: [], total: 0 })),
      ]);

      const eventsWithImages = eventsData.items.map((event) => ({
        ...event,
        imageUrl: event.thumbnailStorageKey
          ? resolveAssetUrl(event.thumbnailStorageKey)
          : null,
      }));

      return {
        surveys: surveysData,
        events: eventsWithImages,
      };
    },
    enabled: currentTab !== "calendar",
    staleTime: 60 * 1000,
  });

  const calendarEventsQuery = useQuery({
    queryKey: [
      "events-surveys",
      "calendar-events",
      calendarRangeFrom,
      calendarRangeTo,
    ],
    queryFn: () =>
      apiClient.getPublicCalendarEvents({
        from: calendarRangeFrom,
        to: calendarRangeTo,
      }),
    enabled: currentTab === "calendar",
    staleTime: 60 * 1000,
  });

  const holidaysQuery = useQuery<KoreanHolidayRecord[]>({
    queryKey: ["calendar", "holidays", currentYear, currentMonth + 1],
    queryFn: () => apiClient.getKoreanHolidays(currentYear, currentMonth + 1),
    enabled: currentTab === "calendar",
    staleTime: 24 * 60 * 60 * 1000,
  });

  useEffect(() => {
    if (selectedParam) {
      const parsed = isoToDate(selectedParam);
      if (!Number.isNaN(parsed.getTime())) {
        setSelectedDate(parsed);
        setCurrentDate(parsed);
      }
    }
  }, [selectedParam]);

  const surveys = listQuery.data?.surveys ?? [];
  const events = listQuery.data?.events ?? [];
  const holidays = holidaysQuery.data ?? [];
  const calendarEvents = useMemo<CalendarEvent[]>(
    () =>
      buildCalendarEventsFromPublicItems(
        calendarEventsQuery.data?.items ?? [],
        lang,
      ),
    [calendarEventsQuery.data?.items, lang],
  );

  const unifiedItems = useMemo<UnifiedItem[]>(
    () => buildUnifiedItems(surveys, events),
    [surveys, events],
  );

  const filteredItems = useMemo(() => {
    return filterItemsByTab(unifiedItems, currentTab);
  }, [unifiedItems, currentTab]);

  const visibleItems = useMemo(() => {
    return sortVisibleItems(filteredItems, sortBy, stateFilter);
  }, [filteredItems, stateFilter, sortBy]);

  return {
    calendarEvents,
    currentDate,
    error:
      currentTab === "calendar"
        ? calendarEventsQuery.isError
          ? lang === "ko"
            ? "일정을 불러오는 중 오류가 발생했습니다."
            : "Failed to load calendar events."
          : null
        : listQuery.isError
          ? lang === "ko"
            ? "목록을 불러오는 중 오류가 발생했습니다."
            : "Failed to load events and surveys."
          : null,
    holidays,
    loading:
      currentTab === "calendar"
        ? calendarEventsQuery.isPending
        : listQuery.isPending,
    selectedDate,
    setCurrentDate,
    setSelectedDate,
    setSortBy,
    setStateFilter,
    sortBy,
    stateFilter,
    visibleItems,
  };
}
