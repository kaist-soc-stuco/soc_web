import { useEffect, useMemo, useRef, useState } from "react";
import { createApiClient } from "@soc/api-client";
import type { ArticleListItem, KoreanHolidayRecord } from "@soc/contracts";
import { isoToDate, nowDate } from "@soc/shared";

import { resolveApiBaseUrl } from "@/lib/api-base-url";
import { resolveAssetUrl } from "@/lib/asset-url";
import {
  buildCalendarEvents,
  buildUnifiedItems,
  filterItemsByTab,
  sortVisibleItems,
  type EventsSurveysSortKey,
  type EventsSurveysStateFilter,
  type SurveyRecordWithState,
  type UnifiedItem,
} from "@/lib/events-surveys";

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
  const [surveys, setSurveys] = useState<SurveyRecordWithState[]>([]);
  const [events, setEvents] = useState<
    Array<ArticleListItem & { imageUrl?: string | null }>
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
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
  const [holidays, setHolidays] = useState<KoreanHolidayRecord[]>([]);
  const holidayCacheRef = useRef(new Map<string, KoreanHolidayRecord[]>());

  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth();

  useEffect(() => {
    setLoading(true);
    Promise.all([
      apiClient.getPublicSurveys(),
      apiClient
        .getArticles("행사", { page: 1, limit: 100 })
        .catch(() => ({ items: [], total: 0 })),
    ])
      .then(async ([surveysData, eventsData]) => {
        const eventsWithImages = await Promise.all(
          eventsData.items.map(async (event) => {
            try {
              const detail = await apiClient.getArticle("행사", event.articleId);
              const posterAsset = detail.assets?.find(
                (asset) =>
                  asset.usageType === "THUMBNAIL" ||
                  asset.usageType === "IMAGE",
              );
              return {
                ...event,
                imageUrl: posterAsset
                  ? resolveAssetUrl(posterAsset.storageKey)
                  : null,
              };
            } catch {
              return { ...event, imageUrl: null };
            }
          }),
        );

        setSurveys(surveysData);
        setEvents(eventsWithImages);
        setError(null);
      })
      .catch(() => {
        setError(
          lang === "ko"
            ? "목록을 불러오는 중 오류가 발생했습니다."
            : "Failed to load events and surveys.",
        );
      })
      .finally(() => {
        setLoading(false);
      });
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
      .catch(() => {
        if (active) {
          setHolidays([]);
        }
      });

    return () => {
      active = false;
    };
  }, [apiClient, currentMonth, currentYear]);

  useEffect(() => {
    if (selectedParam) {
      const parsed = isoToDate(selectedParam);
      if (!Number.isNaN(parsed.getTime())) {
        setSelectedDate(parsed);
        setCurrentDate(parsed);
      }
    }
  }, [selectedParam]);

  const unifiedItems = useMemo<UnifiedItem[]>(() => {
    return buildUnifiedItems(surveys, events);
  }, [surveys, events]);

  const filteredItems = useMemo(() => {
    return filterItemsByTab(unifiedItems, currentTab);
  }, [unifiedItems, currentTab]);

  const visibleItems = useMemo(() => {
    return sortVisibleItems(filteredItems, sortBy, stateFilter);
  }, [filteredItems, stateFilter, sortBy]);

  const calendarEvents = useMemo(() => {
    return buildCalendarEvents(unifiedItems, lang);
  }, [unifiedItems, lang]);

  return {
    calendarEvents,
    currentDate,
    error,
    holidays,
    loading,
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
