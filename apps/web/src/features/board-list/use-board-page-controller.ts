import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
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
import { rememberAuthReturnPath } from "@/lib/auth-storage";
import {
  getBoardDescriptionFromMetadata,
  getBoardTitleFromMetadata,
  canWriteBoardFromMetadata,
} from "@/lib/board-metadata";
import { hasPersistedProfile } from "@/lib/require-persisted-profile";
import { useMediaQuery } from "@/hooks/use-media-query";

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
  const isMobile = useMediaQuery("(max-width: 767px)");
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

  const queryClient = useQueryClient();
  const fetchArticles = async (page: number, limit: number) => {
    const data = category
      ? await apiClient.getArticles(category, { page, limit, q: searchQuery })
      : await apiClient.getAllArticles({ page, limit, q: searchQuery, searchBy: searchCriteria, sortBy: "latest", sortDirection: "desc" });
    const items = [...data.items];
    if (!category) items.sort(comparePinnedArticles);
    return { ...data, items, renderedCategory: category };
  };
  const articleQueryKey = ["board-articles", session?.userId ?? "guest", category ?? "all", currentPage, postsPerPage, searchQuery, searchCriteria] as const;
  const articleQuery = useQuery({
    queryKey: articleQueryKey,
    queryFn: () => fetchArticles(currentPage, postsPerPage),
    enabled: !isMobile,
    placeholderData: (previous, previousQuery) => previousQuery?.queryKey[1] === (session?.userId ?? "guest") ? previous : undefined,
  });
  const mobileQueryKey = ["board-articles", session?.userId ?? "guest", category ?? "all", "mobile", searchQuery, searchCriteria] as const;
  const mobileQuery = useInfiniteQuery({
    queryKey: mobileQueryKey,
    queryFn: ({ pageParam }) => fetchArticles(pageParam, 20),
    initialPageParam: 1,
    getNextPageParam: (last, pages) => last.items.length > 0 && pages.length * 20 < last.total ? pages.length + 1 : undefined,
    enabled: isMobile,
    placeholderData: (previous, previousQuery) => previousQuery?.queryKey[1] === (session?.userId ?? "guest") ? previous : undefined,
  });
  const activeQuery = isMobile ? mobileQuery : articleQuery;
  const mobileArticles = useMemo(() => {
    const unique = new Map<string, ArticleListItem>();
    for (const page of mobileQuery.data?.pages ?? []) for (const article of page.items) unique.set(String(article.articleId), article);
    return [...unique.values()];
  }, [mobileQuery.data]);
  const articles = isMobile ? mobileArticles : articleQuery.data?.items ?? [];
  const activeData = isMobile ? mobileQuery.data?.pages[0] : articleQuery.data;
  const totalCount = activeData?.total ?? 0;
  const renderedCategory = activeData ? activeData.renderedCategory : category;
  const isArticleLoading = activeQuery.isFetching;
  const hasCompletedInitialLoad = !activeQuery.isPending;
  const articleError = activeQuery.isError && !activeQuery.data ? "failed" : null;
  const setArticles = (update: (items: ArticleListItem[]) => ArticleListItem[]) => {
    if (isMobile) {
      queryClient.setQueryData<NonNullable<typeof mobileQuery.data>>(mobileQueryKey, current => current ? { ...current, pages: current.pages.map(page => ({ ...page, items: update(page.items) })) } : current);
      return;
    }
    queryClient.setQueryData<NonNullable<typeof articleQuery.data>>(articleQueryKey, current => current ? { ...current, items: update(current.items) } : current);
  };

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
    retryArticles: () => void activeQuery.refetch(),
    hasMoreArticles: Boolean(mobileQuery.hasNextPage) && !mobileQuery.isPlaceholderData,
    isLoadingMore: mobileQuery.isFetchingNextPage,
    loadMoreArticles: () => { if (!mobileQuery.isFetching && !mobileQuery.isPlaceholderData) void mobileQuery.fetchNextPage(); },
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
