import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { keepPreviousData, useInfiniteQuery, useQuery, type InfiniteData } from "@tanstack/react-query";
import { createApiClient } from "@soc/api-client";
import type { ArticleEngagementKind, KoreanHolidayRecord, PublicListStateCounts } from "@soc/contracts";
import { isoToDate, localDate, nowDate } from "@soc/shared";

import { useCurrentSession } from "@/hooks/use-current-session";
import { useMediaQuery } from "@/hooks/use-media-query";
import { useToast } from "@/components/ui/toast";
import { resolveApiBaseUrl } from "@/lib/api-base-url";
import { rememberAuthReturnPath } from "@/lib/auth-storage";
import { resolveAssetUrl } from "@/lib/asset-url";
import { VOTING_ENABLED } from "@/lib/feature-flags";
import {
  buildCalendarEventsFromPublicItems,
  buildUnifiedItems,
  type CalendarEvent,
  type EventsSurveysStateFilter,
  type UnifiedItem,
} from "@/lib/events-surveys";
import { buildCalendarGrid } from "./events-surveys-calendar-utils";

const PUBLIC_ITEMS_PAGE_SIZE = 12;
type PublicItemsPage = {
  items: UnifiedItem[];
  total: number;
  page: number;
  stateCounts?: PublicListStateCounts;
};

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
  const [params, setParams] = useSearchParams();
  const isMobile = useMediaQuery("(max-width: 767px)");
  const eventOrder = isMobile && currentTab === "event" ? "date" as const : undefined;
  const requestedState = params.get("state");
  const stateFilter: EventsSurveysStateFilter = requestedState === "all" || requestedState === "closed" || (requestedState === "always" && currentTab === "survey") ? requestedState : "active";
  const itemQuery = params.get("q") ?? "";
  const dateFrom = params.get("from") ?? "";
  const dateTo = params.get("to") ?? "";
  const updateFilters = useCallback((changes: Record<string, string>, preserveScroll = false, flushSync = false) => {
    setParams(previous => {
      const next = new URLSearchParams(previous);
      for (const [key, value] of Object.entries(changes)) {
        if (value) next.set(key, value); else next.delete(key);
      }
      return next;
    }, { replace: true, state: { preserveScroll }, flushSync });
  }, [setParams]);
  const setStateFilter = (value: EventsSurveysStateFilter) => updateFilters({ state: value === "active" ? "" : value, page: "", ...(value === "always" ? { from: "", to: "" } : {}) }, true);
  const setItemQuery = (value: string) => updateFilters({ q: value, page: "" }, true);
  const setDateRange = ({ from, to }: { from: string; to: string }) => updateFilters({ from, to, page: "" }, true, true);
  const setListFilters = ({ state, from, to }: { state: EventsSurveysStateFilter; from: string; to: string }) => updateFilters({ state: state === "active" ? "" : state, from: state === "always" ? "" : from, to: state === "always" ? "" : to, page: "" }, true, true);
  const resetListFilters = () => updateFilters({ q: "", from: "", to: "", state: "", page: "" });
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
  const [engagementSubmitting, setEngagementSubmitting] = useState<string | null>(null);
  const [engagementOverrides, setEngagementOverrides] = useState<
    Record<string, Partial<UnifiedItem>>
  >({});
  const { data: session } = useCurrentSession();
  const listViewerKey = session?.draftNamespace ?? session?.userId ?? "anonymous";
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

  const listQuery = useInfiniteQuery<PublicItemsPage, Error, InfiniteData<PublicItemsPage>, readonly unknown[], number>({
    queryKey: ["events-surveys", "list", currentTab, listViewerKey, session?.permission,
      itemQuery.trim(), stateFilter, dateFrom, dateTo, eventOrder],
    initialPageParam: 1,
    placeholderData: (previous, previousQuery) => previousQuery?.queryKey[2] === currentTab
      && previousQuery.queryKey[3] === listViewerKey && previousQuery.queryKey[4] === session?.permission
      && previousQuery.queryKey[9] === eventOrder ? previous : undefined,
    queryFn: async ({ pageParam: page, signal }): Promise<PublicItemsPage> => {
      const filters = { page, publicList: true, state: stateFilter, from: dateFrom || undefined, to: dateTo || undefined, signal };
      if (currentTab === "survey") {
        const result = await apiClient.getPublicSurveys({ ...filters, pageSize: PUBLIC_ITEMS_PAGE_SIZE, query: itemQuery });
        return { ...result, items: buildUnifiedItems(result.items, []) };
      }
      const result = await apiClient.getArticles("_EVENT", { ...filters, eventOrder, limit: PUBLIC_ITEMS_PAGE_SIZE, q: itemQuery, searchBy: "title_content" });
      const events = result.items.map(event => ({ ...event, imageUrl: event.thumbnailStorageKey?.trim() ? resolveAssetUrl(event.thumbnailStorageKey.trim()) : null }));
      return { ...result, items: buildUnifiedItems([], events) };
    },
    getNextPageParam: last => last.page * PUBLIC_ITEMS_PAGE_SIZE < last.total ? last.page + 1 : undefined,
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

  const retry = () => {
    if (currentTab === "calendar") {
      void Promise.all([
        calendarEventsQuery.refetch(),
        holidaysQuery.refetch(),
      ]);
      return;
    }

    void listQuery.refetch();
  };

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

  const holidays = holidaysQuery.data ?? [];
  const calendarEvents = useMemo<CalendarEvent[]>(
    () =>
      buildCalendarEventsFromPublicItems(
        (calendarEventsQuery.data?.items ?? []).filter(item => VOTING_ENABLED || item.sourceType !== "VOTE"),
        lang,
      ),
    [calendarEventsQuery.data?.items, lang],
  );

  const totalItems = listQuery.data?.pages[0]?.total ?? 0;
  const fetchNextPage = listQuery.fetchNextPage;
  const loadMore = useCallback(() => { void fetchNextPage(); }, [fetchNextPage]);

  const visibleItems = useMemo(() => {
    return (listQuery.data?.pages ?? []).flatMap(page => page.items).map(item => ({ ...item, ...(engagementOverrides[item.id] ?? {}) }));
  }, [listQuery.data, engagementOverrides]);

  const counts = listQuery.data?.pages[0]?.stateCounts;
  const stateCounts = counts ? { ...counts, always: counts.always ?? 0, active: counts.active ?? counts.before_open + counts.open } : { all: 0, active: 0, before_open: 0, open: 0, closed: 0, always: 0 };

  const handleSetEngagement = async (
    item: UnifiedItem,
    kind: ArticleEngagementKind,
    active: boolean,
  ) => {
    if (item.kind !== "EVENT") return;
    if (!session?.canUsePersistentFeatures) {
      toast({
        dedupeKey: "login-required",
        type: "info",
        message:
          lang === "ko"
            ? "로그인이 필요한 기능입니다."
            : "You need to sign in to use this feature.",
        action: {
          label: lang === "ko" ? "로그인" : "Login",
          onClick: () => { rememberAuthReturnPath(); navigate("/login"); },
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

  const calendarLoadError =
    (calendarEventsQuery.isError && !calendarEventsQuery.data) ||
    (holidaysQuery.isError && !holidaysQuery.data);

  return {
    calendarFeedUrl: apiClient.getPublicCalendarIcsUrl(),
    calendarEvents,
    isCalendarFetching: calendarEventsQuery.isFetching || holidaysQuery.isFetching,
    currentDate,
    dateFrom,
    dateTo,
    error:
      currentTab === "calendar"
        ? calendarLoadError
          ? lang === "ko"
            ? "일정을 불러오는 중 오류가 발생했습니다."
            : "Failed to load calendar events."
          : null
        : listQuery.isError && !listQuery.data
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
    retry,
    selectedDate,
    calendarQuery,
    hasMore: listQuery.hasNextPage && !listQuery.isPlaceholderData,
    loadingMore: listQuery.isFetchingNextPage,
    loadMoreError: listQuery.isFetchNextPageError,
    isListUpdating: listQuery.isPlaceholderData && listQuery.isFetching,
    loadMore,
    engagementSubmitting,
    handleSetEngagement,
    setCurrentDate: handleCurrentDateChange,
    setCalendarQuery,
    setDateRange,
    setListFilters,
    resetListFilters,
    itemQuery,
    setItemQuery,
    setSelectedDate,
    setStateFilter,
    stateCounts,
    stateFilter,
    totalItems,
    visibleItems,
  };
}
