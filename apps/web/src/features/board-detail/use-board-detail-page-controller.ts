import type {
  ArticleDetailResponse,
  ArticleEngagementKind,
  BoardSummary,
  CommentEngagementKind,
  CommentItem,
  CommentModerationRequest,
  UserRestrictionCreateRequest,
} from "@soc/contracts";
import { createApiClient } from "@soc/api-client";
import { createElement, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { useConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { useBoardCatalog } from "@/hooks/use-board-catalog";
import { useCurrentSession } from "@/hooks/use-current-session";
import { useLanguage } from "@/hooks/use-language";
import {
  getBoardDescriptionFromMetadata,
  getBoardLabelFromMetadata,
  getBoardTitleFromMetadata,
} from "@/lib/board-metadata";
import {
  canUseOfficialIdentityForBoard,
  canWriteOfficialResponseForBoard,
  Permissions,
} from "@/lib/permissions";
import { resolveApiBaseUrl } from "@/lib/api-base-url";

export function useBoardDetailPageController(forcedCategory?: string) {
  const { category: routeCategory = "공지", articleId } = useParams<{
    category: string;
    articleId: string;
  }>();
  const category = forcedCategory ?? routeCategory;
  const [article, setArticle] = useState<ArticleDetailResponse | null>(null);
  const [board, setBoard] = useState<BoardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [isOfficialComment, setIsOfficialComment] = useState(false);
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const [replyTargetId, setReplyTargetId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [isOfficialReply, setIsOfficialReply] = useState(false);
  const [replySubmitting, setReplySubmitting] = useState(false);
  const [commentError, setCommentError] = useState<string | null>(null);
  const [commentActionSubmitting, setCommentActionSubmitting] =
    useState<string | null>(null);
  const [engagementSubmitting, setEngagementSubmitting] =
    useState<ArticleEngagementKind | null>(null);
  const [shareCopied, setShareCopied] = useState(false);
  const [authorRestrictionOpen, setAuthorRestrictionOpen] = useState(false);
  const [authorRestrictionSubmitting, setAuthorRestrictionSubmitting] =
    useState(false);
  const { lang } = useLanguage();
  const { data: session } = useCurrentSession();
  const navigate = useNavigate();
  const { confirm: requestConfirm, ConfirmDialog } = useConfirmDialog();
  const { toast } = useToast();

  const showLoginRequiredToast = () => {
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
  };

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
    return Permissions.hasAny(permission, Permissions.MODERATE_POST_COMMENT, Permissions.SUPER_ADMIN);
  }, [board, session]);

  const canManageArticle = canEdit || canManageComments;

  const canUseOfficialIdentity = Boolean(
    board &&
      canUseOfficialIdentityForBoard(board, session?.permission),
  );

  const canWriteOfficialResponse = Boolean(
    board && canWriteOfficialResponseForBoard(board, session?.permission),
  );

  const officialResponseOnly = Boolean(
    canWriteOfficialResponse &&
      (board?.allowComment === false || article?.allowComment === false),
  );

  useEffect(() => {
    if (!officialResponseOnly) return;
    setIsOfficialComment(true);
    setIsOfficialReply(true);
  }, [officialResponseOnly]);

  const canCreateComment = useMemo(() => {
    if (!session?.canUsePersistentFeatures) return false;

    if (canWriteOfficialResponse) return true;
    return Boolean(board?.allowComment && article?.allowComment);
  }, [article, board, canWriteOfficialResponse, session]);

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
    if (!articleId || loading) return;

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
  }, [apiClient, articleId, category, lang, loading]);

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
        isOfficial: isOfficialComment || officialResponseOnly,
      });
      setCommentText("");
      setIsOfficialComment(officialResponseOnly);
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

  const handleModerateComment = async (
    commentId: string,
    status: CommentModerationRequest["status"],
    reason?: string,
  ) => {
    if (!articleId || !canManageComments) return;
    setCommentActionSubmitting(commentId);
    try {
      await apiClient.moderateComment(category, articleId, commentId, {
        status,
        reason,
      });
      await refreshComments();
      toast({
        type: "success",
        message:
          status === "HIDDEN"
            ? "댓글을 숨겼습니다."
            : "댓글 숨김을 해제했습니다.",
      });
    } catch (error) {
      setCommentError(
        lang === "ko"
          ? status === "HIDDEN"
            ? "댓글을 숨기지 못했습니다."
            : "댓글 숨김을 해제하지 못했습니다."
          : "Failed to update comment visibility.",
      );
      throw error;
    } finally {
      setCommentActionSubmitting(null);
    }
  };

  const handleDeleteArticle = async () => {
    if (!articleId || !canManageArticle) return;
    const confirmed = await requestConfirm({
      confirmLabel: lang === "ko" ? "삭제" : "Delete",
      description:
        lang === "ko"
          ? createElement(
              "span",
              null,
              "정말 ",
              createElement("strong", { className: "font-semibold text-slate-900" }, `“${article?.titleKo || "이 게시글"}”`),
              " 게시글을 영구적으로 삭제하시겠습니까?",
            )
          : createElement(
              "span",
              null,
              "Are you sure you want to permanently delete ",
              createElement("strong", { className: "font-semibold text-slate-900" }, `“${article?.titleKo || "this post"}”`),
              "?",
            ),
      warning:
        lang === "ko"
          ? "(삭제된 게시글은 영구히 복구할 수 없습니다.)"
          : "(Deleted posts cannot be restored.)",
      title:
        lang === "ko" ? "게시글 삭제" : "Delete post",
      tone: "danger",
    });
    if (!confirmed) return;

    try {
      await apiClient.deleteArticle(category, articleId);
      navigate(category === "_EVENT" ? "/events" : `/board/${category}`, { replace: true });
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
        isOfficial: isOfficialReply || officialResponseOnly,
      });
      setReplyText("");
      setIsOfficialReply(officialResponseOnly);
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

  const handleRestrictAuthor = async (
    input: UserRestrictionCreateRequest,
  ) => {
    if (!articleId || !article || !canManageComments) return;

    setAuthorRestrictionSubmitting(true);
    try {
      await apiClient.restrictArticleAuthor(category, articleId, input);
      setAuthorRestrictionOpen(false);
      toast({
        type: "success",
        message: "작성자의 이용을 제한했습니다.",
      });
    } finally {
      setAuthorRestrictionSubmitting(false);
    }
  };

  const handleSetArticleEngagement = async (
    kind: ArticleEngagementKind,
    active: boolean,
  ) => {
    if (!articleId || !article) return;

    if (!session?.canUsePersistentFeatures) {
      showLoginRequiredToast();
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
      showLoginRequiredToast();
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

  const handleShareArticle = async () => {
    if (!article) return;

    const shareUrl = window.location.href;
    const isDesktop =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(pointer: fine)").matches;
    try {
      if (!isDesktop && typeof navigator.share === "function") {
        await navigator.share({ title, url: shareUrl });
        return;
      }

      if (navigator.clipboard) {
        await navigator.clipboard.writeText(shareUrl);
        setShareCopied(true);
        window.setTimeout(() => setShareCopied(false), 1800);
        toast({ type: "success", message: lang === "ko" ? "링크를 복사했습니다." : "Link copied." });
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

  const displayBoardLabel = category === "_EVENT"
    ? (lang === "ko" ? "행사" : "Events")
    : getBoardLabelFromMetadata(
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
    canManageArticle,
    canManageComments,
    canUseOfficialIdentity,
    officialResponseOnly,
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
    handleModerateComment,
    handleRestrictAuthor,
    handleSetCommentEngagement,
    handleSetArticleEngagement,
    handleShareArticle,
    lang,
    loading,
    posterAsset,
    replySubmitting,
    authorRestrictionOpen,
    authorRestrictionSubmitting,
    isOfficialComment,
    isOfficialReply,
    replyTargetId,
    replyText,
    session,
    shareCopied,
    setCommentText,
    setAuthorRestrictionOpen,
    setIsOfficialComment,
    setIsOfficialReply,
    setReplyTargetId,
    setReplyText,
    surveyDescription,
    surveyTitle,
    title,
  };
}
