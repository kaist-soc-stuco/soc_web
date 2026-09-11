import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { createApiClient } from "@soc/api-client";
import { normalizeBoardCode, type ArticleEngagementKind, type ArticleListItem } from "@soc/contracts";
import { isoToMs } from "@soc/shared";

import { useBoardCatalog } from "@/hooks/use-board-catalog";
import { useCurrentSession } from "@/hooks/use-current-session";
import { useLanguage } from "@/hooks/use-language";
import { useToast } from "@/components/ui/toast";
import { resolveApiBaseUrl } from "@/lib/api-base-url";
import {
  getBoardDescriptionFromMetadata,
  getBoardTitleFromMetadata,
  canWriteBoardFromMetadata,
} from "@/lib/board-metadata";
import { hasPersistedProfile } from "@/lib/require-persisted-profile";

export type BoardSearchCriteria = "title" | "author" | "title_content";

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

const BOARD_PAGE_SIZES = [20, 50, 100] as const;

function parsePageParam(value: string | null) {
  const page = Number(value);
  return Number.isInteger(page) && page > 0 ? page : 1;
}

function parsePageSizeParam(value: string | null) {
  const pageSize = Number(value);
  return BOARD_PAGE_SIZES.includes(pageSize as (typeof BOARD_PAGE_SIZES)[number])
    ? pageSize
    : 20;
}

export function useBoardPageController() {
  const { category: routeCategory } = useParams<{ category?: string }>();
  const category = routeCategory ? normalizeBoardCode(routeCategory) : undefined;
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchQuery, setSearchQueryState] = useState(
    () => searchParams.get("q")?.trim() ?? "",
  );
  const [currentPage, setCurrentPageState] = useState(() =>
    parsePageParam(searchParams.get("page")),
  );
  const [articles, setArticles] = useState<ArticleListItem[]>([]);
  // Keep the table schema aligned with the rows currently on screen while a
  // category request is in flight. The route/category navigation may update
  // immediately, but the table switches columns only with the new response.
  const [renderedCategory, setRenderedCategory] = useState<string | undefined>(
    () => category,
  );
  const [isArticleLoading, setIsArticleLoading] = useState(true);
  const [hasCompletedInitialLoad, setHasCompletedInitialLoad] = useState(false);
  const [articleError, setArticleError] = useState<string | null>(null);
  const [articleRetryKey, setArticleRetryKey] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const { lang } = useLanguage();
  const { data: session } = useCurrentSession();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchCriteria, setSearchCriteria] =
    useState<BoardSearchCriteria>("title_content");
  const [postsPerPage, setPostsPerPageState] = useState(() =>
    parsePageSizeParam(searchParams.get("limit")),
  );
  const [engagementSubmitting, setEngagementSubmitting] = useState<string | null>(null);

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
  const isBoardNotFound = Boolean(
    category && boardCatalogSource === "server" && !currentBoard,
  );

  const totalPages = Math.ceil(totalCount / postsPerPage);

  const updateListParams = useCallback(
    (updates: { limit?: number; page?: number; query?: string }) => {
      setSearchParams((current) => {
        const next = new URLSearchParams(current);
        if (updates.query !== undefined) {
          const query = updates.query.trim();
          if (query) next.set("q", query);
          else next.delete("q");
        }
        if (updates.page !== undefined) {
          if (updates.page > 1) next.set("page", String(updates.page));
          else next.delete("page");
        }
        if (updates.limit !== undefined) {
          if (updates.limit === 20) next.delete("limit");
          else next.set("limit", String(updates.limit));
        }
        return next;
      }, { replace: true });
    },
    [setSearchParams],
  );

  const setCurrentPage = useCallback(
    (page: number) => {
      setCurrentPageState(page);
      updateListParams({ page });
    },
    [updateListParams],
  );

  const setPostsPerPage = useCallback(
    (value: number) => {
      setPostsPerPageState(value);
      updateListParams({ limit: value });
    },
    [updateListParams],
  );

  const setSearchQuery = useCallback(
    (query: string) => {
      setSearchQueryState(query);
      setCurrentPageState(1);
      updateListParams({ page: 1, query });
    },
    [updateListParams],
  );

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  useEffect(() => {
    setSearchQueryState(searchParams.get("q")?.trim() ?? "");
    setCurrentPageState(parsePageParam(searchParams.get("page")));
    setPostsPerPageState(parsePageSizeParam(searchParams.get("limit")));
  }, [searchParams]);

  useEffect(() => {
    let cancelled = false;
    setIsArticleLoading(true);
    setArticleError(null);

    const queryParam = searchQuery;
    const fetchPromise = category
      ? apiClient.getArticles(category, {
          page: currentPage,
          limit: postsPerPage,
          q: queryParam,
        })
      : apiClient.getAllArticles({
          limit: postsPerPage,
          page: currentPage,
          q: searchQuery,
          searchBy: searchCriteria,
          sortBy: "latest",
          sortDirection: "desc",
        });

    fetchPromise
      .then((data) => {
        if (cancelled) return;
        const items = [...data.items];

        if (!category) {
          items.sort((a, b) => comparePinnedArticles(a, b));
        }

        setArticles(items);
        setTotalCount(data.total);
        setRenderedCategory(category);
      })
      .catch((error) => {
        console.error("Failed to load board articles:", error);
        if (!cancelled) {
          setArticles([]);
          setTotalCount(0);
          setRenderedCategory(category);
          setArticleError("failed");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsArticleLoading(false);
          setHasCompletedInitialLoad(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [
    apiClient,
    category,
    currentPage,
    articleRetryKey,
    searchQuery,
    searchCriteria,
    postsPerPage,
  ]);

  useEffect(() => {
    setSearchCriteria("title_content");
  }, [category]);

  useEffect(() => {
    const scrollKey = `board-list-scroll:${location.pathname}${location.search}`;
    const handleScroll = () => {
      sessionStorage.setItem(scrollKey, String(window.scrollY));
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [location.pathname, location.search]);

  useEffect(() => {
    if (!hasCompletedInitialLoad) return;
    const scrollKey = `board-list-scroll:${location.pathname}${location.search}`;
    const savedScrollY = Number(sessionStorage.getItem(scrollKey));
    if (!Number.isFinite(savedScrollY) || savedScrollY <= 0) return;

    const frame = window.requestAnimationFrame(() => {
      window.scrollTo({ top: savedScrollY, behavior: "auto" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [hasCompletedInitialLoad, location.pathname, location.search]);

  const canUseWriteFeatures = hasPersistedProfile(session ?? null);
  const userPermission = session?.permission ?? 0;
  const writableBoardCodes = useMemo(() => {
    if (!canUseWriteFeatures) return [];
    if (boardCatalogSource !== "server") return [];

    return boards
      .filter((board) => {
        return canWriteBoardFromMetadata(board, board.code, {
          permission: userPermission,
          primaryMajor: session?.primaryMajor,
          feeStatus: session?.feeStatus,
        });
      })
      .map((board) => board.code);
  }, [
    boardCatalogSource,
    boards,
    canUseWriteFeatures,
    session?.feeStatus,
    session?.primaryMajor,
    userPermission,
  ]);
  const canWrite = category
    ? writableBoardCodes.includes(category)
    : writableBoardCodes.length > 0;
  const writeState = category ? { initialCategory: category } : undefined;

  const handleSetEngagement = async (
    post: ArticleListItem,
    kind: ArticleEngagementKind,
    active: boolean,
  ) => {
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

    const postCategory = post.boardCode || category || "notice";
    const isLike = kind === "LIKE";
    const previous = isLike
      ? {
          likeCount: post.likeCount,
          viewerHasLiked: post.viewerHasLiked,
        }
      : {
          scrapCount: post.scrapCount,
          viewerHasScrapped: post.viewerHasScrapped,
        };
    const submissionKey = `${post.articleId}:${kind}`;
    setEngagementSubmitting(submissionKey);

    setArticles((current) =>
      current.map((item) =>
        item.articleId !== post.articleId
          ? item
          : {
              ...item,
              ...(isLike
                ? {
                    likeCount: Math.max(0, item.likeCount + (active ? 1 : -1)),
                    viewerHasLiked: active,
                  }
                : {
                    scrapCount: Math.max(0, item.scrapCount + (active ? 1 : -1)),
                    viewerHasScrapped: active,
                  }),
            },
      ),
    );

    try {
      const response = await apiClient.setArticleEngagement(
        postCategory,
        post.articleId,
        kind,
        active,
      );
      setArticles((current) =>
        current.map((item) =>
          item.articleId === post.articleId
            ? {
                ...item,
                likeCount: response.likeCount,
                scrapCount: response.scrapCount,
                viewerHasLiked: response.viewerHasLiked,
                viewerHasScrapped: response.viewerHasScrapped,
              }
            : item,
        ),
      );
    } catch {
      setArticles((current) =>
        current.map((item) =>
          item.articleId === post.articleId
            ? { ...item, ...previous }
            : item,
        ),
      );
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
    articleError,
    boardByCode,
    boardDescription,
    boards,
    boardTitle,
    canWrite,
    category,
    renderedCategory,
    currentPage,
    handlePageChange,
    handleSetEngagement,
    engagementSubmitting,
    isBoardNotFound,
    isArticleLoading,
    retryArticles: () => setArticleRetryKey((current) => current + 1),
    showInitialSkeleton: isArticleLoading && !hasCompletedInitialLoad,
    lang,
    postsPerPage,
    searchCriteria,
    searchQuery,
    setCurrentPage,
    setPostsPerPage,
    setSearchCriteria,
    setSearchQuery,
    totalCount,
    totalPages,
    writeState,
  };
}
