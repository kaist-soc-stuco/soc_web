import type {
  ArticleDetailResponse,
  BoardSummary,
  CommentItem,
} from "@soc/contracts";
import { createApiClient } from "@soc/api-client";
import { isoToDate } from "@soc/shared";
import {
  ChevronDown,
  ChevronUp,
  ClipboardCheck,
  Edit2,
  Eye,
  Loader2,
  Trash2,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { Header } from "@/components/organisms/header";
import { Footer } from "@/components/organisms/footer";
import { useCurrentSession } from "@/hooks/use-current-session";
import { useLanguage } from "@/hooks/use-language";
import { resolveApiBaseUrl } from "@/lib/api-base-url";
import { resolveAssetUrl } from "@/lib/asset-url";
import {
  getBoardFallbackMetadata,
  getBoardDescriptionFromMetadata,
  getBoardLabelFromMetadata,
  getBoardTitleFromMetadata,
} from "@/lib/board-metadata";
import { Permissions } from "@/lib/permissions";
import { PageHero } from "@/components/organisms/page-hero";
import { AttachmentList } from "@/components/ui/attachment-list";
import { CommentSection } from "@/components/ui/comment-section";
import { useConfirmDialog } from "@/components/ui/confirm-dialog";
import { useBoardCatalog } from "@/hooks/use-board-catalog";

function formatDate(isoString: string) {
  const date = isoToDate(isoString);
  if (Number.isNaN(date.getTime())) return "";
  const yyyy = date.getFullYear();
  const MM = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}.${MM}.${dd}`;
}

function formatDateSlash(isoString: string) {
  const date = isoToDate(isoString);
  if (Number.isNaN(date.getTime())) return "";
  const yyyy = date.getFullYear();
  const MM = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}/${MM}/${dd}`;
}

export function BoardDetailPage() {
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

  const boardInfo = getBoardFallbackMetadata(category);
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
    if (!session?.canUsePersistentFeatures) return false;

    const permission = session.permission ?? 0;
    return (
      board.commentPermissionBit <= 0 ||
      Permissions.has(permission, board.commentPermissionBit)
    );
  }, [board, session]);

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

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col bg-white">
        <Header showLogo />
        <main className="flex flex-1 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-kaist-darkgreen" />
        </main>
      </div>
    );
  }

  if (!article) {
    return (
      <div className="flex min-h-screen flex-col bg-white">
        <Header showLogo />
        <main className="flex flex-1 items-center justify-center">
          <p className="text-sm font-bold text-slate-500">
            존재하지 않는 게시글입니다.
          </p>
        </main>
      </div>
    );
  }

  const boardLabel =
    lang === "ko"
      ? (board?.nameKo ?? category)
      : (board?.nameEn ?? boardInfo.labelEn);
  const displayBoardLabel =
    lang === "ko" && category === "공지" ? "공지사항" : boardLabel;
  const title =
    lang === "ko" ? article.titleKo : article.titleEn || article.titleKo;
  const content =
    lang === "ko" ? article.contentKo : article.contentEn || article.contentKo;
  const surveyTitle = article.survey
    ? lang === "ko"
      ? article.survey.titleKo
      : article.survey.titleEn || article.survey.titleKo
    : "";
  const surveyDescription = article.survey
    ? lang === "ko"
      ? article.survey.descriptionKo
      : article.survey.descriptionEn || article.survey.descriptionKo
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

  return (
    <div className="min-h-screen bg-[#fafafa] flex flex-col text-slate-950">
      {ConfirmDialog}
      <Header showLogo />

      <main className="flex-1 w-full mx-auto pb-16">
        <PageHero title={boardTitle} description={boardDescription} />

        {/* Board Underlined Tabs Navigation */}
        <div className="border-b border-slate-200 bg-white mb-6">
          <div className="max-w-7xl mx-auto px-6 lg:px-8 flex flex-col md:flex-row md:items-stretch md:justify-between gap-4 select-none">
            {/* Category tabs */}
            <div className="flex flex-wrap items-stretch gap-6 lg:gap-8">
              {/* "전체" Tab */}
              <Link to="/board" className="relative group flex items-center">
                <div
                  className={`relative flex items-center justify-center h-full text-[14px] lg:text-[14.5px] tracking-tight transition-all py-4 cursor-pointer ${
                    !category
                      ? "text-kaist-darkgreen font-semibold"
                      : "text-slate-400 hover:text-kaist-darkgreen font-medium"
                  }`}
                >
                  <span>{lang === "ko" ? "전체" : "All"}</span>
                  <span
                    className={`absolute bottom-0 left-0 right-0 h-[3px] bg-kaist-darkgreen transition-transform duration-200 origin-center ${
                      !category
                        ? "scale-x-100"
                        : "scale-x-0 group-hover:scale-x-100"
                    }`}
                  />
                </div>
              </Link>

              {boards.map((boardItem) => {
                const isActive = category === boardItem.code;
                return (
                  <Link
                    key={boardItem.code}
                    to={`/board/${boardItem.code}`}
                    className="relative group flex items-center"
                  >
                    <div
                      className={`relative flex items-center justify-center h-full text-[14px] lg:text-[14.5px] tracking-tight transition-all py-4 cursor-pointer ${
                        isActive
                          ? "text-kaist-darkgreen font-semibold"
                          : "text-slate-400 hover:text-kaist-darkgreen font-medium"
                      }`}
                    >
                      <span>
                        {getBoardLabelFromMetadata(
                          boardItem,
                          boardItem.code,
                          lang,
                        )}
                      </span>
                      <span
                        className={`absolute bottom-0 left-0 right-0 h-[3px] bg-kaist-darkgreen transition-transform duration-200 origin-center ${
                          isActive
                            ? "scale-x-100"
                            : "scale-x-0 group-hover:scale-x-100"
                        }`}
                      />
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>

        <div className="mx-auto max-w-[1040px] px-6 lg:px-8 pt-1 pb-16 flex flex-col gap-3 w-full">
          {/* Breadcrumb Path */}
          <div className="flex items-center gap-1.5 text-[13px] text-slate-400 font-semibold select-none">
            <Link
              to="/board"
              className="hover:text-kaist-darkgreen transition-colors"
            >
              게시판
            </Link>
            <svg
              className="w-2.5 h-2.5 text-slate-350"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              strokeWidth="2.5"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 5l7 7-7 7"
              />
            </svg>
            <span className="text-slate-500 font-bold">
              {displayBoardLabel}
            </span>
          </div>

          <article className="w-full rounded-xl border border-slate-200 bg-white px-6 md:px-[52px] py-6 md:py-[32px] shadow-[0_10px_35px_rgba(15,23,42,0.05)]">
            <header>
              <span className="inline-flex rounded-md bg-[#e6f4ea] px-2 py-1 text-xs font-bold text-[#137333]">
                {category}
              </span>
              <h1 className="mt-3 text-[1.18rem] font-bold leading-snug tracking-tight text-slate-950 md:text-[1.45rem]">
                {title}
              </h1>
              <div className="mt-3 flex flex-col gap-2 border-b border-slate-100 pb-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-wrap items-center gap-x-2 text-xs font-bold text-slate-500">
                  <span>
                    {article.isAnonymous ? "익명" : article.author.name}
                  </span>
                  <span className="text-slate-300">·</span>
                  <span>{formatDateSlash(article.postedAt)}</span>
                  <span className="text-slate-300">·</span>
                  <span className="inline-flex items-center gap-1">
                    <Eye className="h-3.5 w-3.5" />
                    {article.viewCount}
                  </span>
                </div>

                {canEdit && (
                  <div className="flex shrink-0 items-center gap-1">
                    <Link
                      to={`/board/${category}/${articleId}/edit`}
                      className="inline-flex h-7 items-center gap-1 rounded-md px-2 text-xs font-bold leading-none text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                      title="수정"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                      수정
                    </Link>
                    <button
                      type="button"
                      onClick={() => void handleDeleteArticle()}
                      className="inline-flex h-7 items-center gap-1 rounded-md px-2 text-xs font-bold leading-none text-rose-500 hover:bg-rose-50 hover:text-rose-700"
                      title="삭제"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      삭제
                    </button>
                  </div>
                )}
              </div>
            </header>

            <div className="pt-5">
              {posterAsset && (
                <figure className="w-full mb-6 overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                  <img
                    src={resolveAssetUrl(posterAsset.storageKey)}
                    alt={posterAsset.originalFilename}
                    className="w-full object-cover max-h-[640px]"
                  />
                </figure>
              )}

              <div className="whitespace-pre-line text-[0.94rem] font-medium leading-7 text-slate-800 [overflow-wrap:anywhere]">
                {content}
              </div>
            </div>

            <AttachmentList
              assets={attachmentAssets}
              className="mt-6 border-t border-slate-100 pt-5"
            />

            {article.survey && (
              <section className="mt-6 rounded-xl border border-slate-200 bg-white px-4 py-3.5 shadow-[0_8px_24px_rgba(15,23,42,0.025)]">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-start gap-3">
                    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-emerald-100 bg-emerald-50 text-kaist-darkgreen">
                      <ClipboardCheck className="h-4.5 w-4.5" />
                    </span>
                    <div className="min-w-0">
                      <h2 className="truncate text-[14px] font-extrabold leading-snug tracking-tight text-slate-900">
                        {surveyTitle}
                      </h2>
                      {surveyDescription && (
                        <p className="mt-1 line-clamp-2 text-[12px] font-medium leading-relaxed text-slate-500">
                          {surveyDescription}
                        </p>
                      )}
                    </div>
                  </div>
                  <Link
                    to={`/survey/${article.survey.surveyId}`}
                    className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg bg-kaist-darkgreen px-3.5 py-1.5 text-[12px] font-bold text-white shadow-sm transition hover:opacity-90"
                  >
                    <span>{lang === "ko" ? "설문조사 참여하기" : "Open survey"}</span>
                    <svg
                      className="w-2.5 h-2.5 text-white"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      strokeWidth="3"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  </Link>
                </div>
              </section>
            )}
          </article>

          <CommentSection
            comments={comments}
            commentsLoading={commentsLoading}
            canManageComments={canManageComments}
            canCreateComment={canCreateComment}
            currentUserId={session?.userId ?? null}
            commentText={commentText}
            commentError={commentError}
            commentSubmitting={commentSubmitting}
            isAuthenticated={Boolean(session?.canUsePersistentFeatures)}
            onCommentTextChange={setCommentText}
            onCreateComment={handleCreateComment}
            onDeleteComment={handleDeleteComment}
          />

          {/* 이전글 / 다음글 & 목록으로 버튼 */}
          <div className="w-full flex flex-col gap-2 mt-2">
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-[0_8px_28px_rgba(15,23,42,0.03)] divide-y divide-slate-100">
              {/* 이전글 */}
              {article.prevArticle ? (
                <Link
                  to={`/board/${category}/${article.prevArticle.articleId}`}
                  className="flex items-center justify-between px-5 py-3.5 hover:bg-slate-50 transition-colors group text-sm"
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <span className="font-bold text-slate-400 shrink-0 select-none flex items-center gap-1">
                      <ChevronUp className="h-4 w-4" />
                      이전글
                    </span>
                    <span className="text-slate-700 font-semibold truncate group-hover:text-kaist-darkgreen transition-colors">
                      {article.prevArticle.titleKo}
                    </span>
                  </div>
                  <span className="text-xs text-slate-400 shrink-0 font-medium ml-4">
                    {formatDate(article.prevArticle.postedAt)}
                  </span>
                </Link>
              ) : (
                <div className="flex items-center px-5 py-3.5 text-sm text-slate-400 select-none">
                  <span className="font-bold text-slate-350 shrink-0 mr-4 flex items-center gap-1">
                    <ChevronUp className="h-4 w-4 text-slate-300" />
                    이전글
                  </span>
                  <span className="font-medium">이전 게시글이 없습니다.</span>
                </div>
              )}

              {/* 다음글 */}
              {article.nextArticle ? (
                <Link
                  to={`/board/${category}/${article.nextArticle.articleId}`}
                  className="flex items-center justify-between px-5 py-3.5 hover:bg-slate-50 transition-colors group text-sm"
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <span className="font-bold text-slate-400 shrink-0 select-none flex items-center gap-1">
                      <ChevronDown className="h-4 w-4" />
                      다음글
                    </span>
                    <span className="text-slate-700 font-semibold truncate group-hover:text-kaist-darkgreen transition-colors">
                      {article.nextArticle.titleKo}
                    </span>
                  </div>
                  <span className="text-xs text-slate-400 shrink-0 font-medium ml-4">
                    {formatDate(article.nextArticle.postedAt)}
                  </span>
                </Link>
              ) : (
                <div className="flex items-center px-5 py-3.5 text-sm text-slate-400 select-none">
                  <span className="font-bold text-slate-350 shrink-0 mr-4 flex items-center gap-1">
                    <ChevronDown className="h-4 w-4 text-slate-300" />
                    다음글
                  </span>
                  <span className="font-medium">다음 게시글이 없습니다.</span>
                </div>
              )}
            </div>

            {/* 목록으로 버튼 */}
            <div className="flex justify-end mt-1">
              <Link
                to={`/board/${category}`}
                className="inline-flex items-center justify-center gap-1 px-4 py-2 bg-white border border-slate-200 hover:border-slate-300 rounded-lg text-[13px] font-bold text-slate-600 hover:text-slate-800 transition shadow-sm cursor-pointer"
              >
                목록으로
              </Link>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
