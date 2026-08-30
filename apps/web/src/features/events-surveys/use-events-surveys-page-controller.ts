import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { createApiClient } from "@soc/api-client";
import type { ArticleEngagementKind, KoreanHolidayRecord } from "@soc/contracts";
import { isoToDate, isoToMs, localDate, nowDate } from "@soc/shared";

import { useCurrentSession } from "@/hooks/use-current-session";
import { useToast } from "@/components/ui/toast";
import { resolveApiBaseUrl } from "@/lib/api-base-url";
import { resolveAssetUrl } from "@/lib/asset-url";
import {
  buildCalendarEventsFromPublicItems,
  buildUnifiedItems,
  filterItemsByTab,
  sortVisibleItems,
  type CalendarEvent,
  type EventsSurveysStateFilter,
  type UnifiedItem,
} from "@/lib/events-surveys";
import { buildCalendarGrid } from "./events-surveys-calendar-utils";

const PUBLIC_ITEMS_PAGE_SIZE = 9;

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
  const [stateFilter, setStateFilter] =
    useState<EventsSurveysStateFilter>("all");
  const [currentDate, setCurrentDate] = useState(() => {
    const selected = parseSelectedCalendarDate(selectedParam);
    return selected
      ? localDate(selected.getFullYear(), selected.getMonth(), 1)
      : nowDate();
  });
  const [calendarRequestDate, setCalendarRequestDate] = useState(() => {
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
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [engagementSubmitting, setEngagementSubmitting] = useState<string | null>(null);
  const [engagementOverrides, setEngagementOverrides] = useState<
    Record<string, Partial<UnifiedItem>>
  >({});
  const { data: session } = useCurrentSession();
  const navigate = useNavigate();
  const { toast } = useToast();

  const requestedYear = calendarRequestDate.getFullYear();
  const requestedMonth = calendarRequestDate.getMonth();
  const calendarRange = useMemo(() => {
    const grid = buildCalendarGrid(requestedYear, requestedMonth);
    const firstDate =
      grid[0]?.date ?? localDate(requestedYear, requestedMonth, 1);
    const lastDate =
      grid[grid.length - 1]?.date ??
      localDate(requestedYear, requestedMonth + 1, 0);

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
  }, [requestedMonth, requestedYear]);
  const calendarRangeFrom = calendarRange.from.toISOString();
  const calendarRangeTo = calendarRange.to.toISOString();

  const listQuery = useQuery({
    queryKey: ["events-surveys", "list", session?.userId ?? "anonymous"],
    queryFn: async () => {
      const [surveysData, eventsData] = await Promise.all([
        apiClient.getPublicSurveys(),
        apiClient
          .getArticles("_EVENT", { page: 1, limit: 100 })
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
    placeholderData: keepPreviousData,
    staleTime: 60 * 1000,
  });

  const holidaysQuery = useQuery<KoreanHolidayRecord[]>({
    queryKey: ["calendar", "holidays", requestedYear, requestedMonth + 1],
    queryFn: () => apiClient.getKoreanHolidays(requestedYear, requestedMonth + 1),
    enabled: currentTab === "calendar",
    placeholderData: keepPreviousData,
    staleTime: 24 * 60 * 60 * 1000,
  });

  useEffect(() => {
    const selected = parseSelectedCalendarDate(selectedParam);
    if (!selected) return;
    const month = localDate(selected.getFullYear(), selected.getMonth(), 1);
    setSelectedDate(selected);
    setCurrentDate(month);
    setCalendarRequestDate(month);
  }, [selectedParam]);

  useEffect(() => {
    if (currentTab !== "calendar") return;
    if (
      calendarEventsQuery.isPending ||
      calendarEventsQuery.isPlaceholderData ||
      holidaysQuery.isPending ||
      holidaysQuery.isPlaceholderData
    ) {
      return;
    }
    setCurrentDate(calendarRequestDate);
  }, [
    calendarEventsQuery.isPending,
    calendarEventsQuery.isPlaceholderData,
    calendarRequestDate,
    currentTab,
    holidaysQuery.isPending,
    holidaysQuery.isPlaceholderData,
  ]);

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

  const dateFilteredItems = useMemo(() => {
    if (!dateFrom && !dateTo) return searchedItems;

    const from = dateFrom ? isoToMs(`${dateFrom}T00:00:00+09:00`) : -Infinity;
    const to = dateTo ? isoToMs(`${dateTo}T23:59:59.999+09:00`) : Infinity;
    if (from > to) return [];

    return searchedItems.filter((item) => {
      const itemStart = item.opensAt ? isoToMs(item.opensAt) : null;
      const itemEnd = item.closesAt ? isoToMs(item.closesAt) : itemStart;
      if (itemStart === null || Number.isNaN(itemStart)) return false;
      if (itemEnd !== null && Number.isNaN(itemEnd)) return false;
      return (itemEnd ?? itemStart) >= from && itemStart <= to;
    });
  }, [dateFrom, dateTo, searchedItems]);

  const sortedItems = useMemo(() => {
    return sortVisibleItems(dateFilteredItems, "latest", stateFilter);
  }, [dateFilteredItems, stateFilter]);

  const totalItems = sortedItems.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / PUBLIC_ITEMS_PAGE_SIZE));

  useEffect(() => {
    setCurrentPage(1);
  }, [currentTab, dateFrom, dateTo, itemQuery, stateFilter]);

  useEffect(() => {
    setCurrentPage((page) => Math.min(page, totalPages));
  }, [totalPages]);

  const visibleItems = useMemo(() => {
    const start = (currentPage - 1) * PUBLIC_ITEMS_PAGE_SIZE;
    return sortedItems.slice(start, start + PUBLIC_ITEMS_PAGE_SIZE);
  }, [currentPage, sortedItems]);

  const stateCounts = useMemo(
    () => ({
      all: dateFilteredItems.length,
      before_open: dateFilteredItems.filter((item) => item.computedState === "before_open").length,
      open: dateFilteredItems.filter((item) => item.computedState === "open").length,
      closed: dateFilteredItems.filter((item) => item.computedState === "closed").length,
    }),
    [dateFilteredItems],
  );

  const handleSetEngagement = async (
    item: UnifiedItem,
    kind: ArticleEngagementKind,
    active: boolean,
  ) => {
    if (item.kind !== "EVENT") return;
    if (!session?.canUsePersistentFeatures) {
      toast({
        type: "info",
        message:
          lang === "ko"
            ? "로그인이 필요한 기능입니다."
            : "You need to sign in to use this feature.",
        action: {
          label: lang === "ko" ? "로그인" : "Login",
          onClick: () => navigate("/login"),
        },
      });
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
        item.articleBoardCode ?? "_EVENT",
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
      toast({
        type: "error",
        message:
          lang === "ko"
            ? "좋아요 또는 스크랩 처리에 실패했습니다."
            : "Failed to update like or scrap.",
      });
    } finally {
      setEngagementSubmitting(null);
    }
  };

  const handleCurrentDateChange = (date: Date) => {
    setCalendarRequestDate(
      localDate(date.getFullYear(), date.getMonth(), 1),
    );
  };

  return {
    calendarEvents,
    currentDate,
    dateFrom,
    dateTo,
    error:
      currentTab === "calendar"
        ? calendarEventsQuery.isError
          && !calendarEventsQuery.data
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
          && !calendarEventsQuery.data
        : listQuery.isPending,
    selectedDate,
    calendarQuery,
    currentPage,
    engagementSubmitting,
    handleSetEngagement,
    setCurrentDate: handleCurrentDateChange,
    setCalendarQuery,
    setCurrentPage,
    setDateFrom,
    setDateTo,
    itemQuery,
    setItemQuery,
    setSelectedDate,
    setStateFilter,
    stateCounts,
    stateFilter,
    totalItems,
    totalPages,
    visibleItems,
  };
}
