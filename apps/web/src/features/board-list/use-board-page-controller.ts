import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ApiClientHttpError, createApiClient } from "@soc/api-client";
import type { ArticleEngagementKind, ArticleListItem } from "@soc/contracts";
import { hasPermission } from "@soc/shared";

import { useBoardCatalog } from "@/hooks/use-board-catalog";
import { useCurrentSession } from "@/hooks/use-current-session";
import { useLanguage } from "@/hooks/use-language";
import { useToast } from "@/components/ui/toast";
import { resolveApiBaseUrl } from "@/lib/api-base-url";
import {
  getBoardDescriptionFromMetadata,
  getBoardTitleFromMetadata,
  getBoardWritePermissionBitFromMetadata,
} from "@/lib/board-metadata";
import { hasPersistedProfile } from "@/lib/require-persisted-profile";

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
  const [hasCompletedInitialLoad, setHasCompletedInitialLoad] = useState(false);
  const [isBoardNotFound, setIsBoardNotFound] = useState(false);
  const [hasArticleLoadError, setHasArticleLoadError] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const { lang } = useLanguage();
  const { data: session } = useCurrentSession();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [postsPerPage, setPostsPerPage] = useState(20);
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

  const totalPages = Math.ceil(totalCount / postsPerPage);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  useEffect(() => {
    let cancelled = false;
    setIsArticleLoading(true);
    setIsBoardNotFound(false);
    setHasArticleLoadError(false);

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
          searchBy: "title_content",
          sortBy: "latest",
          sortDirection: "desc",
        });

    fetchPromise
      .then((data) => {
        if (cancelled) return;
        const items = [...data.items];
        setHasArticleLoadError(false);

        if (!category) {
          items.sort((a, b) => comparePinnedArticles(a, b));
          setArticles(items);
          setTotalCount(data.total);
          return;
        }

        setArticles(items);
        setTotalCount(data.total);
      })
      .catch((error) => {
        const isNotFound =
          error instanceof ApiClientHttpError && error.status === 404;
        if (!isNotFound) {
          console.error("Failed to load board articles:", error);
        }
        if (!cancelled) {
          setIsBoardNotFound(Boolean(category && isNotFound));
          setHasArticleLoadError(!isNotFound);
          setArticles([]);
          setTotalCount(0);
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
    searchQuery,
    postsPerPage,
  ]);

  useEffect(() => {
    setCurrentPage(1);
    setSearchQuery("");
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

    const postCategory = post.boardCode || category || "공지";
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
      alert(
        lang === "ko"
          ? "좋아요 또는 스크랩 처리에 실패했습니다."
          : "Failed to update like or scrap.",
      );
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
    boardByCode,
    boardDescription,
    boards,
    boardTitle,
    canWrite,
    category,
    currentPage,
    handlePageChange,
    handleSetEngagement,
    engagementSubmitting,
    isArticleLoading,
    isBoardNotFound,
    hasArticleLoadError,
    showInitialSkeleton: isArticleLoading && !hasCompletedInitialLoad,
    lang,
    postsPerPage,
    searchQuery,
    setCurrentPage,
    setPostsPerPage,
    setSearchQuery,
    totalCount,
    totalPages,
    writeState,
  };
}
