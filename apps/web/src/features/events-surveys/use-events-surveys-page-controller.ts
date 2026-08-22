import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { createApiClient } from "@soc/api-client";
import type { ArticleEngagementKind, KoreanHolidayRecord } from "@soc/contracts";
import { isoToDate, localDate, nowDate } from "@soc/shared";

import { useCurrentSession } from "@/hooks/use-current-session";
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

function parseSelectedCalendarDate(value: string | null) {
  if (!value) return null;
  const parsed = isoToDate(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

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
  const [currentDate, setCurrentDate] = useState(() => {
    const selected = parseSelectedCalendarDate(selectedParam);
    return selected
      ? localDate(selected.getFullYear(), selected.getMonth(), 1)
      : nowDate();
  });
  const [selectedDate, setSelectedDate] = useState<Date>(
    () => parseSelectedCalendarDate(selectedParam) ?? nowDate(),
  );
  const [calendarQuery, setCalendarQuery] = useState("");
  const [itemQuery, setItemQuery] = useState("");
  const [engagementSubmitting, setEngagementSubmitting] = useState<string | null>(null);
  const [engagementOverrides, setEngagementOverrides] = useState<
    Record<string, Partial<UnifiedItem>>
  >({});
  const { data: session } = useCurrentSession();

  useEffect(() => {
    const selected = parseSelectedCalendarDate(selectedParam);
    if (!selected) return;
    setSelectedDate(selected);
    setCurrentDate(localDate(selected.getFullYear(), selected.getMonth(), 1));
  }, [selectedParam]);

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
      calendarQuery,
    ],
    queryFn: () =>
      apiClient.getPublicCalendarEvents({
        from: calendarRangeFrom,
        to: calendarRangeTo,
        q: calendarQuery,
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

  const unifiedItems = useMemo<UnifiedItem[]>(() => {
    return buildUnifiedItems(surveys, events).map((item) => ({
      ...item,
      ...(engagementOverrides[item.id] ?? {}),
    }));
  }, [engagementOverrides, events, surveys]);

  const filteredItems = useMemo(() => {
    return filterItemsByTab(unifiedItems, currentTab);
  }, [unifiedItems, currentTab]);

  const searchedItems = useMemo(() => {
    const query = itemQuery.trim().toLocaleLowerCase();
    if (!query) return filteredItems;

    return filteredItems.filter((item) =>
      [item.titleKo, item.titleEn, item.descriptionKo, item.descriptionEn]
        .filter(Boolean)
        .some((value) => value!.toLocaleLowerCase().includes(query)),
    );
  }, [filteredItems, itemQuery]);

  const visibleItems = useMemo(() => {
    return sortVisibleItems(searchedItems, sortBy, stateFilter);
  }, [searchedItems, stateFilter, sortBy]);

  const stateCounts = useMemo(
    () => ({
      all: searchedItems.length,
      before_open: searchedItems.filter((item) => item.computedState === "before_open").length,
      open: searchedItems.filter((item) => item.computedState === "open").length,
      closed: searchedItems.filter((item) => item.computedState === "closed").length,
    }),
    [searchedItems],
  );

  const handleSetEngagement = async (
    item: UnifiedItem,
    kind: ArticleEngagementKind,
    active: boolean,
  ) => {
    if (item.kind !== "EVENT") return;
    if (!session?.canUsePersistentFeatures) {
      alert(
        lang === "ko"
          ? "좋아요와 스크랩은 로그인 후 사용할 수 있습니다."
          : "Like and scrap are available after signing in.",
      );
      return;
    }

    const isLike = kind === "LIKE";
    const previous = {
      ...(isLike
        ? {
            likeCount: item.likeCount ?? 0,
            viewerHasLiked: item.viewerHasLiked ?? false,
          }
        : {
            scrapCount: item.scrapCount ?? 0,
            viewerHasScrapped: item.viewerHasScrapped ?? false,
          }),
    };
    const key = `${item.id}:${kind}`;
    setEngagementSubmitting(key);
    setEngagementOverrides((current) => ({
      ...current,
      [item.id]: {
        ...current[item.id],
        ...(isLike
          ? {
              likeCount: Math.max(0, (item.likeCount ?? 0) + (active ? 1 : -1)),
              viewerHasLiked: active,
            }
          : {
              scrapCount: Math.max(0, (item.scrapCount ?? 0) + (active ? 1 : -1)),
              viewerHasScrapped: active,
            }),
      },
    }));

    try {
      const response = await apiClient.setArticleEngagement(
        item.articleBoardCode ?? "행사",
        item.id,
        kind,
        active,
      );
      setEngagementOverrides((current) => ({
        ...current,
        [item.id]: {
          ...current[item.id],
          likeCount: response.likeCount,
          scrapCount: response.scrapCount,
          viewerHasLiked: response.viewerHasLiked,
          viewerHasScrapped: response.viewerHasScrapped,
        },
      }));
    } catch {
      setEngagementOverrides((current) => ({
        ...current,
        [item.id]: {
          ...current[item.id],
          ...previous,
        },
      }));
      alert(
        lang === "ko"
          ? "좋아요 또는 스크랩 처리에 실패했습니다."
          : "Failed to update like or scrap.",
      );
    } finally {
      setEngagementSubmitting(null);
    }
  };

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
    calendarQuery,
    engagementSubmitting,
    handleSetEngagement,
    setCurrentDate,
    setCalendarQuery,
    itemQuery,
    setItemQuery,
    setSelectedDate,
    setSortBy,
    setStateFilter,
    stateCounts,
    sortBy,
    stateFilter,
    visibleItems,
  };
}
