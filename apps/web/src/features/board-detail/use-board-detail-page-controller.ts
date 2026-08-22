import type {
  ArticleDetailResponse,
  ArticleEngagementKind,
  BoardSummary,
  CommentEngagementKind,
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
  const [replyTargetId, setReplyTargetId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [replySubmitting, setReplySubmitting] = useState(false);
  const [commentError, setCommentError] = useState<string | null>(null);
  const [commentActionSubmitting, setCommentActionSubmitting] =
    useState<string | null>(null);
  const [engagementSubmitting, setEngagementSubmitting] =
    useState<ArticleEngagementKind | null>(null);
  const [shareCopied, setShareCopied] = useState(false);
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
    return Boolean(
      article &&
        session?.authenticated &&
        session.userId &&
        session.userId === article.author.userId,
    );
  }, [article, session]);

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
        if (!cancelled) {
          setCommentError(
            lang === "ko"
              ? "댓글을 불러오지 못했습니다."
              : "Failed to load comments.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setCommentsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [apiClient, article, articleId, category, lang]);

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
      setCommentError(
        lang === "ko"
          ? "댓글 작성에 실패했습니다."
          : "Failed to post the comment.",
      );
    } finally {
      setCommentSubmitting(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!articleId) return;
    const confirmed = await requestConfirm({
      confirmLabel: lang === "ko" ? "삭제" : "Delete",
      description:
        lang === "ko"
          ? "삭제한 댓글은 되돌릴 수 없습니다."
          : "A deleted comment cannot be restored.",
      title:
        lang === "ko" ? "댓글을 삭제하시겠습니까?" : "Delete this comment?",
      tone: "danger",
    });
    if (!confirmed) return;

    setCommentError(null);
    try {
      await apiClient.deleteComment(category, articleId, commentId);
      await refreshComments();
    } catch {
      setCommentError(
        lang === "ko"
          ? "댓글 삭제에 실패했습니다."
          : "Failed to delete the comment.",
      );
    }
  };

  const handleDeleteArticle = async () => {
    if (!articleId || !canEdit) return;
    const confirmed = await requestConfirm({
      confirmLabel: lang === "ko" ? "삭제" : "Delete",
      description:
        lang === "ko"
          ? "게시글과 연결된 댓글 정보가 함께 삭제됩니다."
          : "Comments linked to this post will also be deleted.",
      title:
        lang === "ko" ? "게시글을 삭제하시겠습니까?" : "Delete this post?",
      tone: "danger",
    });
    if (!confirmed) return;

    try {
      await apiClient.deleteArticle(category, articleId);
      navigate(`/board/${category}`, { replace: true });
    } catch {
      alert(
        lang === "ko"
          ? "게시글 삭제에 실패했습니다."
          : "Failed to delete the post.",
      );
    }
  };

  const handleCreateReply = async (parentCommentId: string) => {
    if (!articleId || !replyText.trim() || !canCreateComment) return;

    setReplySubmitting(true);
    setCommentError(null);
    try {
      await apiClient.createComment(category, articleId, {
        content: replyText.trim(),
        parentCommentId,
      });
      setReplyText("");
      setReplyTargetId(null);
      await refreshComments();
    } catch {
      setCommentError(
        lang === "ko"
          ? "대댓글 작성에 실패했습니다."
          : "Failed to post the reply.",
      );
    } finally {
      setReplySubmitting(false);
    }
  };

  const handleSetArticleEngagement = async (
    kind: ArticleEngagementKind,
    active: boolean,
  ) => {
    if (!articleId || !article) return;

    if (!session?.canUsePersistentFeatures) {
      alert(
        lang === "ko"
          ? "좋아요와 스크랩은 로그인 후 사용할 수 있습니다."
          : "Like and scrap are available after signing in.",
      );
      return;
    }

    const previousArticle = article;
    setEngagementSubmitting(kind);
    setArticle((current) => {
      if (!current) return current;
      const isLike = kind === "LIKE";
      return {
        ...current,
        ...(isLike
          ? {
              viewerHasLiked: active,
              likeCount: Math.max(
                0,
                current.likeCount + (active ? 1 : -1),
              ),
            }
          : {
              viewerHasScrapped: active,
              scrapCount: Math.max(
                0,
                current.scrapCount + (active ? 1 : -1),
              ),
            }),
      };
    });

    try {
      const response = await apiClient.setArticleEngagement(
        category,
        articleId,
        kind,
        active,
      );
      setArticle((current) => (current ? { ...current, ...response } : current));
    } catch {
      setArticle(previousArticle);
      alert(
        lang === "ko"
          ? "좋아요 또는 스크랩 처리에 실패했습니다."
          : "Failed to update like or scrap.",
      );
    } finally {
      setEngagementSubmitting(null);
    }
  };

  const handleSetCommentEngagement = async (
    commentId: string,
    kind: CommentEngagementKind,
    active: boolean,
  ) => {
    if (!articleId) return;

    if (!session?.canUsePersistentFeatures) {
      alert(
        lang === "ko"
          ? "댓글 좋아요는 로그인 후 사용할 수 있습니다."
          : "Comment likes are available after signing in.",
      );
      return;
    }

    const actionKey = `${commentId}:${kind}`;
    setCommentActionSubmitting(actionKey);
    setComments((current) =>
      current.map((comment) =>
        comment.commentId === commentId
          ? {
              ...comment,
              likeCount: Math.max(
                0,
                comment.likeCount + (active ? 1 : -1),
              ),
              viewerHasLiked: active,
            }
          : comment,
      ),
    );

    try {
      const response = await apiClient.setCommentEngagement(
        category,
        articleId,
        commentId,
        kind,
        active,
      );
      setComments((current) =>
        current.map((comment) =>
          comment.commentId === commentId
            ? {
                ...comment,
                likeCount: response.likeCount,
                viewerHasLiked: response.viewerHasLiked,
                viewerHasReported: response.viewerHasReported,
              }
            : comment,
        ),
      );
    } catch {
      await refreshComments();
      alert(
        lang === "ko"
          ? "댓글 좋아요 처리에 실패했습니다."
          : "Failed to update the comment like.",
      );
    } finally {
      setCommentActionSubmitting(null);
    }
  };

  const handleReportComment = async (commentId: string) => {
    if (!articleId) return;

    if (!session?.canUsePersistentFeatures) {
      alert(
        lang === "ko"
          ? "댓글 신고는 로그인 후 사용할 수 있습니다."
          : "Comment reports are available after signing in.",
      );
      return;
    }

    const confirmed = await requestConfirm({
      confirmLabel: lang === "ko" ? "신고" : "Report",
      description:
        lang === "ko"
          ? "신고된 댓글은 운영진이 검토합니다."
          : "Reported comments will be reviewed by the moderators.",
      title: lang === "ko" ? "이 댓글을 신고하시겠습니까?" : "Report this comment?",
      tone: "danger",
    });
    if (!confirmed) return;

    setCommentActionSubmitting(`${commentId}:REPORT`);
    try {
      const response = await apiClient.reportComment(
        category,
        articleId,
        commentId,
      );
      setComments((current) =>
        current.map((comment) =>
          comment.commentId === commentId
            ? { ...comment, viewerHasReported: response.reported }
            : comment,
        ),
      );
    } catch {
      setCommentError(
        lang === "ko"
          ? "댓글 신고에 실패했습니다."
          : "Failed to report the comment.",
      );
    } finally {
      setCommentActionSubmitting(null);
    }
  };

  const handleShareArticle = async () => {
    if (!article) return;

    const shareUrl = window.location.href;
    try {
      if (typeof navigator.share === "function") {
        await navigator.share({ title, url: shareUrl });
        return;
      }

      if (navigator.clipboard) {
        await navigator.clipboard.writeText(shareUrl);
        setShareCopied(true);
        window.setTimeout(() => setShareCopied(false), 1800);
        return;
      }

      alert(shareUrl);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      alert(
        lang === "ko"
          ? "공유 링크를 복사하지 못했습니다."
          : "The share link could not be copied.",
      );
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
    commentActionSubmitting,
    commentSubmitting,
    commentText,
    comments,
    commentsLoading,
    content,
    displayBoardLabel,
    engagementSubmitting,
    handleCreateComment,
    handleCreateReply,
    handleDeleteArticle,
    handleDeleteComment,
    handleReportComment,
    handleSetCommentEngagement,
    handleSetArticleEngagement,
    handleShareArticle,
    lang,
    loading,
    posterAsset,
    replySubmitting,
    replyTargetId,
    replyText,
    session,
    shareCopied,
    setCommentText,
    setReplyTargetId,
    setReplyText,
    surveyDescription,
    surveyTitle,
    title,
  };
}
