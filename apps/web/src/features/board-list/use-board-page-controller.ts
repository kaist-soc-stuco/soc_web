import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { createApiClient } from "@soc/api-client";
import type { ArticleListItem } from "@soc/contracts";
import { hasPermission, isoToMs, nowMs } from "@soc/shared";

import { useBoardCatalog } from "@/hooks/use-board-catalog";
import { useCurrentSession } from "@/hooks/use-current-session";
import { useLanguage } from "@/hooks/use-language";
import { resolveApiBaseUrl } from "@/lib/api-base-url";
import {
  getBoardDescriptionFromMetadata,
  getBoardTitleFromMetadata,
  getBoardWritePermissionBitFromMetadata,
} from "@/lib/board-metadata";
import { hasPersistedProfile } from "@/lib/require-persisted-profile";

export type BoardSearchCriteria = "title" | "author" | "title_content";
export type BoardSortBy = "latest" | "views";
export type BoardSortDirection = "asc" | "desc";
export type BoardPeriod = "all" | "7days" | "30days";

function comparePinnedArticles(a: ArticleListItem, b: ArticleListItem) {
  if (a.isPinned !== b.isPinned) {
    return Number(b.isPinned) - Number(a.isPinned);
  }

  if (a.isPinned && b.isPinned) {
    const aOrder = a.pinOrder ?? Number.MAX_SAFE_INTEGER;
    const bOrder = b.pinOrder ?? Number.MAX_SAFE_INTEGER;
    if (aOrder !== bOrder) return aOrder - bOrder;
  }

  return 0;
}

export function useBoardPageController() {
  const { category } = useParams<{ category?: string }>();
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [articles, setArticles] = useState<ArticleListItem[]>([]);
  const [isArticleLoading, setIsArticleLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const { lang } = useLanguage();
  const { data: session } = useCurrentSession();
  const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState(false);
  const [searchCriteria, setSearchCriteria] =
    useState<BoardSearchCriteria>("title");
  const [sortBy, setSortBy] = useState<BoardSortBy>("latest");
  const [sortDirection, setSortDirection] =
    useState<BoardSortDirection>("desc");
  const [period, setPeriod] = useState<BoardPeriod>("all");
  const [postsPerPage, setPostsPerPage] = useState(10);

  const apiClient = useMemo(
    () => createApiClient({ baseUrl: resolveApiBaseUrl() }),
    [],
  );
  const {
    boards,
    boardByCode,
    source: boardCatalogSource,
  } = useBoardCatalog(apiClient);
  const currentBoard = category ? boardByCode.get(category) : undefined;

  const totalPages = Math.ceil(totalCount / postsPerPage);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSortChange = (nextSortBy: BoardSortBy) => {
    if (sortBy === nextSortBy) {
      setSortDirection((currentDirection) =>
        currentDirection === "desc" ? "asc" : "desc",
      );
    } else {
      setSortBy(nextSortBy);
      setSortDirection("desc");
    }
    setCurrentPage(1);
  };

  useEffect(() => {
    let cancelled = false;
    setIsArticleLoading(true);

    const queryParam = searchCriteria === "title" ? searchQuery : "";
    const fetchPromise = category
      ? apiClient.getArticles(category, { page: 1, limit: 100, q: queryParam })
      : apiClient.getAllArticles({
          limit: postsPerPage,
          page: currentPage,
          period,
          q: searchQuery,
          searchBy: searchCriteria,
          sortBy,
          sortDirection,
        });

    fetchPromise
      .then((data) => {
        if (cancelled) return;
        let items = [...data.items];

        if (!category) {
          items.sort((a, b) => comparePinnedArticles(a, b));
          setArticles(items);
          setTotalCount(data.total);
          return;
        }

        if (searchQuery) {
          const query = searchQuery.toLowerCase();
          if (searchCriteria === "author") {
            items = items.filter((item) => {
              const authorText = item.isAnonymous
                ? "익명 anonymous"
                : item.author.name;
              return authorText.toLowerCase().includes(query);
            });
          } else if (searchCriteria === "title_content") {
            items = items.filter((item) => {
              const title = `${item.titleKo} ${item.titleEn ?? ""}`.toLowerCase();
              return title.includes(query);
            });
          }
        }

        if (period !== "all") {
          const limitDays = period === "7days" ? 7 : 30;
          const cutoffMs = nowMs() - limitDays * 24 * 60 * 60 * 1000;
          items = items.filter((item) => isoToMs(item.postedAt) >= cutoffMs);
        }

        if (sortBy === "latest") {
          items.sort((a, b) => {
            const pinnedOrder = comparePinnedArticles(a, b);
            if (pinnedOrder !== 0) return pinnedOrder;
            const diff = isoToMs(b.postedAt) - isoToMs(a.postedAt);
            return sortDirection === "desc" ? diff : -diff;
          });
        } else if (sortBy === "views") {
          items.sort((a, b) => {
            const pinnedOrder = comparePinnedArticles(a, b);
            if (pinnedOrder !== 0) return pinnedOrder;
            const diff = (b.viewCount || 0) - (a.viewCount || 0);
            return sortDirection === "desc" ? diff : -diff;
          });
        }

        const total = items.length;
        const startIndex = (currentPage - 1) * postsPerPage;
        setArticles(items.slice(startIndex, startIndex + postsPerPage));
        setTotalCount(total);
      })
      .catch((error) => {
        console.error("Failed to load board articles:", error);
        if (!cancelled) {
          setArticles([]);
          setTotalCount(0);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsArticleLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [
    apiClient,
    category,
    currentPage,
    searchQuery,
    searchCriteria,
    sortBy,
    sortDirection,
    period,
    postsPerPage,
  ]);

  useEffect(() => {
    setCurrentPage(1);
    setSearchQuery("");
    setSearchCriteria("title");
    setSortBy("latest");
    setSortDirection("desc");
    setPeriod("all");
  }, [category]);

  const canUseWriteFeatures = hasPersistedProfile(session ?? null);
  const userPermission = session?.permission ?? 0;
  const writableBoardCodes = useMemo(() => {
    if (!canUseWriteFeatures) return [];
    if (boardCatalogSource !== "server") return [];

    return boards
      .filter((board) => {
        const requiredPermission = getBoardWritePermissionBitFromMetadata(
          board,
          board.code,
        );
        return (
          requiredPermission === 0 ||
          hasPermission(userPermission, requiredPermission)
        );
      })
      .map((board) => board.code);
  }, [boardCatalogSource, boards, canUseWriteFeatures, userPermission]);
  const canWrite = category
    ? writableBoardCodes.includes(category)
    : writableBoardCodes.length > 0;
  const writeState = category ? { initialCategory: category } : undefined;

  const boardTitle = category
    ? getBoardTitleFromMetadata(currentBoard, category, lang)
    : lang === "ko"
      ? "전체 게시판"
      : "All Boards";

  const boardDescription = category
    ? getBoardDescriptionFromMetadata(currentBoard, category, lang)
    : lang === "ko"
      ? "전산학부의 다양한 소식을 한눈에 확인하세요."
      : "View all updates and news from KAIST School of Computing at a glance.";

  return {
    articles,
    boardByCode,
    boardDescription,
    boards,
    boardTitle,
    canWrite,
    category,
    currentPage,
    handlePageChange,
    handleSortChange,
    isArticleLoading,
    isFilterDropdownOpen,
    lang,
    period,
    postsPerPage,
    searchCriteria,
    searchQuery,
    setCurrentPage,
    setIsFilterDropdownOpen,
    setPeriod,
    setPostsPerPage,
    setSearchCriteria,
    setSearchQuery,
    sortBy,
    sortDirection,
    totalCount,
    totalPages,
    writeState,
  };
}
