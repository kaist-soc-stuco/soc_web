import type {
  ArticleDetailResponse,
  BoardSummary,
  CommentItem,
} from "@soc/contracts";
import { createApiClient } from "@soc/api-client";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { useConfirmDialog } from "@/components/ui/confirm-dialog";
import { useBoardCatalog } from "@/hooks/use-board-catalog";
import { useCurrentSession } from "@/hooks/use-current-session";
import { useLanguage } from "@/hooks/use-language";
import {
  getBoardDescriptionFromMetadata,
  getBoardLabelFromMetadata,
  getBoardTitleFromMetadata,
} from "@/lib/board-metadata";
import { Permissions } from "@/lib/permissions";
import { resolveApiBaseUrl } from "@/lib/api-base-url";

export function useBoardDetailPageController() {
  const { category = "공지", articleId } = useParams<{
    category: string;
    articleId: string;
  }>();
  const [article, setArticle] = useState<ArticleDetailResponse | null>(null);
  const [board, setBoard] = useState<BoardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const [commentError, setCommentError] = useState<string | null>(null);
  const { lang } = useLanguage();
  const { data: session } = useCurrentSession();
  const navigate = useNavigate();
  const { confirm: requestConfirm, ConfirmDialog } = useConfirmDialog();

  const apiClient = useMemo(
    () => createApiClient({ baseUrl: resolveApiBaseUrl() }),
    [],
  );
  const { boards, boardByCode } = useBoardCatalog(apiClient);
  const catalogBoard = boardByCode.get(category);

  const canEdit = useMemo(() => {
    if (!article || !board) return false;
    if (!session?.authenticated || !session.userId) return false;
    if (session.userId === article.author.userId) return true;

    const permission = session.permission ?? 0;
    return (
      board.managePermissionBit > 0 &&
      Permissions.has(permission, board.managePermissionBit)
    );
  }, [article, board, session]);

  const canManageComments = useMemo(() => {
    if (!board) return false;
    const permission = session?.permission ?? 0;
    return (
      board.managePermissionBit > 0 &&
      Permissions.has(permission, board.managePermissionBit)
    );
  }, [board, session]);

  const canCreateComment = useMemo(() => {
    if (!board?.allowComment) return false;
    if (!article?.allowComment) return false;
    if (!session?.canUsePersistentFeatures) return false;

    const permission = session.permission ?? 0;
    return (
      board.commentPermissionBit <= 0 ||
      Permissions.has(permission, board.commentPermissionBit)
    );
  }, [article, board, session]);

  const posterAsset = useMemo(
    () =>
      article?.assets?.find(
        (asset) =>
          asset.usageType === "THUMBNAIL" || asset.usageType === "IMAGE",
      ),
    [article],
  );

  const attachmentAssets = useMemo(
    () =>
      article?.assets?.filter(
        (asset) => asset.assetId !== posterAsset?.assetId,
      ) ?? [],
    [article, posterAsset],
  );

  useEffect(() => {
    if (!articleId) return;

    let cancelled = false;
    setLoading(true);
    setArticle(null);
    setBoard(null);

    Promise.all([
      apiClient.getArticle(category, articleId),
      apiClient.getBoard(category).catch(() => null),
    ])
      .then(([articleResponse, boardResponse]) => {
        if (!cancelled) {
          setArticle(articleResponse);
          setBoard(boardResponse);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setArticle(null);
          setBoard(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [apiClient, articleId, category]);

  useEffect(() => {
    if (!articleId || !article) return;

    let cancelled = false;
    setCommentsLoading(true);
    setCommentError(null);

    apiClient
      .getComments(category, articleId, { page: 1, limit: 50 })
      .then((response) => {
        if (!cancelled) setComments(response.items);
      })
      .catch(() => {
        if (!cancelled) setCommentError("댓글을 불러오지 못했습니다.");
      })
      .finally(() => {
        if (!cancelled) setCommentsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [apiClient, article, articleId, category]);

  const refreshComments = async () => {
    if (!articleId) return;
    const response = await apiClient.getComments(category, articleId, {
      page: 1,
      limit: 50,
    });
    setComments(response.items);
  };

  const handleCreateComment = async () => {
    if (!articleId || !commentText.trim()) return;

    setCommentSubmitting(true);
    setCommentError(null);
    try {
      await apiClient.createComment(category, articleId, {
        content: commentText.trim(),
      });
      setCommentText("");
      await refreshComments();
    } catch {
      setCommentError("댓글 작성에 실패했습니다.");
    } finally {
      setCommentSubmitting(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!articleId) return;
    const confirmed = await requestConfirm({
      confirmLabel: "삭제",
      description: "삭제한 댓글은 되돌릴 수 없습니다.",
      title: "댓글을 삭제하시겠습니까?",
      tone: "danger",
    });
    if (!confirmed) return;

    setCommentError(null);
    try {
      await apiClient.deleteComment(category, articleId, commentId);
      await refreshComments();
    } catch {
      setCommentError("댓글 삭제에 실패했습니다.");
    }
  };

  const handleDeleteArticle = async () => {
    if (!articleId || !canEdit) return;
    const confirmed = await requestConfirm({
      confirmLabel: "삭제",
      description: "게시글과 연결된 댓글 정보가 함께 삭제됩니다.",
      title: "게시글을 삭제하시겠습니까?",
      tone: "danger",
    });
    if (!confirmed) return;

    try {
      await apiClient.deleteArticle(category, articleId);
      navigate(`/board/${category}`, { replace: true });
    } catch {
      alert("게시글 삭제에 실패했습니다.");
    }
  };

  const displayBoardLabel = getBoardLabelFromMetadata(
    board ?? catalogBoard,
    category,
    lang,
  );
  const title = article
    ? lang === "ko"
      ? article.titleKo
      : article.titleEn || article.titleKo
    : "";
  const content = article
    ? lang === "ko"
      ? article.contentKo
      : article.contentEn || article.contentKo
    : "";
  const surveyTitle = article?.survey
    ? lang === "ko"
      ? article.survey.titleKo
      : article.survey.titleEn || article.survey.titleKo
    : "";
  const surveyDescription = article?.survey
    ? lang === "ko"
      ? article.survey.descriptionKo ?? ""
      : article.survey.descriptionEn || article.survey.descriptionKo || ""
    : "";
  const boardTitle = getBoardTitleFromMetadata(
    board ?? catalogBoard,
    category,
    lang,
  );
  const boardDescription = getBoardDescriptionFromMetadata(
    board ?? catalogBoard,
    category,
    lang,
  );

  return {
    ConfirmDialog,
    article,
    articleId,
    attachmentAssets,
    boardDescription,
    boardTitle,
    boards,
    canCreateComment,
    canEdit,
    canManageComments,
    category,
    commentError,
    commentSubmitting,
    commentText,
    comments,
    commentsLoading,
    content,
    displayBoardLabel,
    handleCreateComment,
    handleDeleteArticle,
    handleDeleteComment,
    lang,
    loading,
    posterAsset,
    session,
    setCommentText,
    surveyDescription,
    surveyTitle,
    title,
  };
}
