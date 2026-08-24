import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { createApiClient } from "@soc/api-client";
import type { ArticleEngagementKind, KoreanHolidayRecord } from "@soc/contracts";
import { isoToDate, localDate, nowDate } from "@soc/shared";

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
    queryKey: ["events-surveys", "list"],
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

  const visibleItems = useMemo(() => {
    return sortVisibleItems(searchedItems, "latest", stateFilter);
  }, [searchedItems, stateFilter]);

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
      alert(
        lang === "ko"
          ? "좋아요 또는 스크랩 처리에 실패했습니다."
          : "Failed to update like or scrap.",
      );
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
    engagementSubmitting,
    handleSetEngagement,
    setCurrentDate: handleCurrentDateChange,
    setCalendarQuery,
    itemQuery,
    setItemQuery,
    setSelectedDate,
    setStateFilter,
    stateCounts,
    stateFilter,
    visibleItems,
  };
}
