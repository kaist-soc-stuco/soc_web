import { PromotionStatus } from "@/components/ui/promotion-period";
import type {
  ArticleDetailResponse,
  ArticleAssetItem,
  ArticleEngagementKind,
} from "@soc/contracts";
import { ArrowUpRight, Bookmark, Heart, MessageCircle, Check, ChevronUp, ChevronDown, Edit2, EllipsisVertical, Eye, EyeOff, Share2, Trash2 } from "lucide-react";
import { isoToDate, isoToMs, nowMs } from "@soc/shared";
import { useEffect, useReducer } from "react";
import { Link } from "react-router-dom";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";

import { AttachmentList } from "@/components/ui/attachment-list";
import {
  AdminActionMenuLink,
  AdminActionMenuItem,
  AdminActionMenuPanel,
} from "@/components/ui/admin-action-menu";
import { ArticleEngagementActions, EngagementActionButton } from "@/components/ui/article-engagement-actions";
import { useMediaQuery } from "@/hooks/use-media-query";
import { RichTextContent, stripRichText } from "@/components/ui/rich-text-content";
import { resolveAssetUrl } from "@/lib/asset-url";
import { Button } from "@/components/ui/button";

function formatDate(isoString: string, omitYear = false) {
  const date = isoToDate(isoString);
  if (Number.isNaN(date.getTime())) return "";

  const yyyy = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${omitYear ? "" : `${yyyy}.`}${month}.${day} ${hours}:${minutes}`;
}

interface ArticleCardProps {
  article: ArticleDetailResponse;
  adjacentBasePath: string;
  allowEngagement: boolean;
  attachmentAssets: ArticleAssetItem[];
  canEdit: boolean;
  canModerate: boolean;
  category: string;
  boardTitle: string;
  listHref: string;
  content: string;
  editHref?: string;
  isAuthenticated: boolean;
  lang: string;
  onDeleteArticle: () => void;
  onHideArticle: () => void;
  onRestoreArticle: () => void;
  onShare: () => void;
  onToggle: (kind: ArticleEngagementKind, active: boolean) => void;
  posterAsset?: ArticleAssetItem;
  posterStorageKey?: string | null;
  shareCopied: boolean;
  surveyDescription: string;
  surveyTitle: string;
  submitting: ArticleEngagementKind | null;
  title: string;
  canComment?: boolean;
  commentTotal?: number;
  onCommentClick?: () => void;
}

export function BoardDetailArticleCard({
  article,
  adjacentBasePath,
  allowEngagement,
  attachmentAssets,
  canEdit,
  canModerate,
  category,
  boardTitle,
  listHref,
  content,
  editHref,
  isAuthenticated,
  lang,
  onDeleteArticle,
  onHideArticle,
  onRestoreArticle,
  onShare,
  onToggle,
  posterAsset,
  posterStorageKey,
  shareCopied,
  surveyTitle,
  submitting,
  title,
  canComment = false,
  commentTotal = 0,
  onCommentClick,
}: ArticleCardProps) {
  const isMobile = useMediaQuery("(width < 768px)");
  const [deadlineTick, refreshDeadline] = useReducer((tick: number) => tick + 1, 0);
  const closeMs = article.survey?.closeAt && !article.survey.isAlwaysOpen
    ? isoToMs(article.survey.closeAt) : Number.NaN;
  const registrationClosed = article.survey?.computedState === "closed" || closeMs <= nowMs();
  useEffect(() => {
    const remaining = closeMs - nowMs();
    if (!Number.isFinite(remaining) || remaining <= 0) return;
    const timer = window.setTimeout(refreshDeadline, Math.min(remaining, 2_147_483_647));
    return () => window.clearTimeout(timer);
  }, [closeMs, deadlineTick]);
  return (
    <article className={article.status === "HIDDEN"
      ? "mobile-flat-article w-full rounded-xl border border-amber-200 bg-white px-4 py-5 shadow-card min-[640px]:px-5 md:py-6 lg:px-[52px] lg:py-[32px]"
      : "mobile-flat-article w-full rounded-xl border border-card-border-subtle bg-white px-4 py-5 shadow-card min-[640px]:px-5 md:py-6 lg:px-[52px] lg:py-[32px]"}>
      <nav aria-label={lang === "ko" ? "페이지 경로" : "Breadcrumb"} className="article-breadcrumb mb-4 flex flex-wrap items-center gap-2 text-xs font-normal leading-5 text-slate-500">
        {category !== "_EVENT" && <>
          <Link to="/board" className="hover:text-slate-700">{lang === "ko" ? "게시판" : "Boards"}</Link>
          <span aria-hidden="true" className="text-slate-300">/</span>
        </>}
        <Link to={listHref} className="hover:text-slate-700">{lang === "ko" && category === "notice" && boardTitle === "공지" ? "공지사항" : boardTitle}</Link>
      </nav>
      {article.status === "HIDDEN" ? (
        <div
          role="status"
          className="mb-5 flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900"
        >
          <EyeOff className="mt-0.5 size-4 shrink-0 text-amber-700" aria-hidden="true" />
          <div className="min-w-0">
            <p className="text-sm font-semibold">
              {lang === "ko" ? "숨김 처리된 게시글입니다." : "This post is hidden."}
            </p>
            <p className="mt-0.5 text-xs font-normal text-amber-800">
              {lang === "ko" ? "관리자에게만 표시되는 게시글입니다." : "Only moderators can see this post."}
            </p>
          </div>
        </div>
      ) : null}
      <header className="relative">
        <h1 className={`${!isMobile && (canEdit || canModerate) ? "pr-12" : ""} break-words text-[1.18rem] font-semibold leading-snug tracking-tight text-app-text-strong [overflow-wrap:anywhere] md:text-[1.45rem]`}>
          {title}
          {category === "promotions" && <span className="ml-3"><PromotionStatus start={article.eventStartDate} end={article.eventEndDate} lang={lang} /></span>}
        </h1>
        <div className="mt-3 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="mobile-article-metadata flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-normal text-slate-400">
            <span className="mobile-article-author">
            {article.isAnonymous
                ? lang === "ko"
                  ? "익명"
                  : "Anonymous"
                : (lang === "en" ? article.author.nameEn || article.author.name : article.author.name)}
            </span>
            <span className="mobile-article-author-divider text-slate-300">·</span>
            <time dateTime={article.postedAt}>{formatDate(article.postedAt, isMobile)}</time>
            <span className="text-slate-300">·</span>
            <span className="inline-flex items-center gap-1">
              <Eye className="h-3.5 w-3.5" aria-hidden="true" />
              {article.viewCount}
            </span>
          </div>
          {!isMobile && (canEdit || canModerate) ? (
            <DropdownMenu.Root modal={false}>
              <DropdownMenu.Trigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={lang === "ko" ? "게시글 더보기" : "More post actions"}
                  className="absolute -right-2 -top-2 min-h-11 min-w-11 bg-transparent text-slate-400 hover:text-slate-700"
                >
                  <EllipsisVertical className="size-4" aria-hidden="true" />
                </Button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content
                  asChild
                  align="end"
                  sideOffset={6}
                  collisionPadding={12}
                >
                  <AdminActionMenuPanel className="!w-max !min-w-32 !shadow-[0_4px_12px_rgb(15_23_42_/_0.08)]">
                    {canEdit ? (
                      <>
                        <DropdownMenu.Item asChild>
                          <AdminActionMenuLink
                            to={editHref ?? `/board/${category}/${article.articleId}/edit`}
                            icon={<Edit2 className="text-slate-400" aria-hidden="true" />}
                          >
                            {lang === "ko" ? "수정" : "Edit"}
                          </AdminActionMenuLink>
                        </DropdownMenu.Item>
                      </>
                    ) : null}
                    {canModerate ? (
                      <DropdownMenu.Item asChild>
                        <AdminActionMenuItem
                          icon={article.status === "HIDDEN" ? <Eye /> : <EyeOff />}
                          onClick={article.status === "HIDDEN" ? onRestoreArticle : onHideArticle}
                        >
                          {article.status === "HIDDEN"
                            ? lang === "ko" ? "숨김 해제" : "Unhide"
                            : lang === "ko" ? "숨기기" : "Hide"}
                        </AdminActionMenuItem>
                      </DropdownMenu.Item>
                    ) : null}
                    {canEdit ? (
                      <DropdownMenu.Item asChild>
                        <AdminActionMenuItem icon={<Trash2 />} tone="danger" onClick={onDeleteArticle}>
                          {lang === "ko" ? "삭제" : "Delete"}
                        </AdminActionMenuItem>
                      </DropdownMenu.Item>
                    ) : null}
                  </AdminActionMenuPanel>
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
          ) : null}
        </div>
      </header>

      <div className="pt-5">
        {lang === "en" && !stripRichText(article.contentEn ?? "") && !/<img\b/i.test(article.contentEn ?? "") ? (
          <p role="note" className="mb-5 rounded-md bg-slate-50 px-4 py-2 text-sm font-normal text-slate-500">This post is only available in Korean.</p>
        ) : null}
        {posterStorageKey ? (
          <figure className="mx-auto mb-6 w-fit max-w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
            <img
              src={resolveAssetUrl(posterStorageKey)}
              alt={posterAsset?.originalFilename ?? title}
              className="block h-auto w-auto max-h-[min(70svh,40rem)] max-w-full object-contain"
            />
          </figure>
        ) : null}

        <RichTextContent
          content={content}
          className="text-base font-medium leading-7 text-app-text-body md:text-[0.94rem]"
        />
      </div>

      <AttachmentList
        assets={attachmentAssets}
        className="mt-6"
        lang={lang}
      />

      {article.survey && (
        <div className="mt-6 flex justify-start" data-survey-cta>
          {registrationClosed ? <Button type="button" variant="secondary" disabled className="w-auto bg-slate-100 text-slate-500 disabled:opacity-100">
            {lang === "ko" ? "신청이 마감되었습니다" : "Registration is closed"}
          </Button> : <Button asChild className="w-auto">
            <Link to={`/survey/${article.survey.surveyId}`} target="_blank" rel="noopener noreferrer"
              aria-label={lang === "ko" ? `${surveyTitle} ${category === "_EVENT" ? "참가 신청하기" : "설문 참여하기"} (새 탭)` : `${category === "_EVENT" ? "Register for" : "Take"} ${surveyTitle} (opens in a new tab)`}>
              {lang === "ko" ? category === "_EVENT" ? "참가 신청하기" : "설문 참여하기" : category === "_EVENT" ? "Register" : "Take survey"}
              <ArrowUpRight aria-hidden="true" className="size-4" />
            </Link>
          </Button>}
        </div>
      )}

      {isMobile ? (allowEngagement || canComment) && <div className="mobile-article-engagement" style={{ gridTemplateColumns: `repeat(${(allowEngagement ? 2 : 0) + (canComment ? 1 : 0)},minmax(0,1fr))` }}>
        {allowEngagement &&
          <EngagementActionButton active={isAuthenticated && article.viewerHasLiked} count={article.likeCount} icon={<Heart className="size-5" fill={isAuthenticated && article.viewerHasLiked ? "currentColor" : "none"} />} label={lang === "ko" ? "좋아요" : "Like"} loading={submitting === "LIKE"} onClick={() => onToggle("LIKE", !article.viewerHasLiked)} className="mobile-detail-engagement-action" tone="like" showLabel />
        }
        {canComment && <Button type="button" variant="ghost" className="mobile-detail-engagement-action" aria-label={lang === "ko" ? "댓글 쓰기" : "Write a comment"} onClick={onCommentClick}><MessageCircle className="size-5" aria-hidden="true" /><span>{lang === "ko" ? "댓글" : "Reply"}</span><span className="tabular-nums">{commentTotal}</span></Button>}
        {allowEngagement &&
          <EngagementActionButton active={isAuthenticated && article.viewerHasScrapped} count={article.scrapCount} icon={<Bookmark className="size-5" fill={isAuthenticated && article.viewerHasScrapped ? "currentColor" : "none"} />} label={lang === "ko" ? "스크랩" : "Save"} loading={submitting === "SCRAP"} onClick={() => onToggle("SCRAP", !article.viewerHasScrapped)} className="mobile-detail-engagement-action" tone="scrap" showLabel />
        }
      </div> : <div className="article-desktop-engagement mt-6 flex min-h-14 items-center justify-start gap-2 py-2">
        <ArticleEngagementActions
          allowLike={allowEngagement}
          allowScrap={allowEngagement}
          isAuthenticated={isAuthenticated}
          lang={lang}
          likeCount={article.likeCount}
          scrapCount={article.scrapCount}
          viewerHasLiked={article.viewerHasLiked}
          viewerHasScrapped={article.viewerHasScrapped}
          submitting={submitting}
          onToggle={onToggle}
        />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onShare}
          aria-label={
            shareCopied
              ? lang === "ko"
                ? "공유 링크가 복사되었습니다"
                : "Share link copied"
              : lang === "ko"
                ? "게시글 공유"
                : "Share post"
          }
          className="rounded-md border-0 bg-transparent text-xs text-slate-500 active:text-brand-primary hover:border-0 hover:bg-slate-100 hover:text-slate-700"
        >
          {shareCopied ? (
            <Check className="size-3.5 text-brand-primary" aria-hidden="true" />
          ) : (
            <Share2 className="size-3.5" aria-hidden="true" />
          )}
        </Button>
      </div>}
      <BoardDetailAdjacentNav
        lang={lang}
        nextArticle={article.nextArticle}
        prevArticle={article.prevArticle}
        toBase={adjacentBasePath}
      />
    </article>
  );
}

type AdjacentArticle = NonNullable<ArticleDetailResponse["prevArticle"]>;

export function BoardDetailAdjacentNav({
  lang,
  nextArticle,
  toBase,
  prevArticle,
}: {
  lang: string;
  nextArticle?: AdjacentArticle | null;
  prevArticle?: AdjacentArticle | null;
  toBase: string;
}) {
  const renderRow = (article: AdjacentArticle | null | undefined, direction: "prev" | "next") => {
    const label = lang === "ko" ? (direction === "prev" ? "이전글" : "다음글") : direction === "prev" ? "Previous" : "Next";
    const content = <>
      <span className="flex shrink-0 items-center gap-1.5 text-sm font-medium text-slate-700 sm:gap-2">
        {direction === "prev" ? <ChevronUp className="size-4" aria-hidden="true" /> : <ChevronDown className="size-4" aria-hidden="true" />}
        {label}
      </span>
      <span className={`min-w-0 line-clamp-2 text-sm font-normal sm:block sm:truncate ${article ? "text-slate-800" : "text-slate-400"}`}>
        {article ? (lang === "ko" ? article.titleKo : article.titleEn || article.titleKo) : (lang === "ko" ? `${label}이 없습니다.` : `No ${direction === "prev" ? "previous" : "next"} post.`)}
      </span>
    </>;
    const className = "grid min-h-14 min-w-0 grid-cols-[5rem_minmax(0,1fr)] items-center gap-3 px-4 py-3 sm:grid-cols-[6rem_minmax(0,1fr)] sm:gap-4";
    return article ? (
      <Link key={direction} to={`${toBase}/${article.articleId}`} className={`${className} transition-colors hover:bg-slate-50`}>
        {content}
      </Link>
    ) : <div key={direction} className={className}>{content}</div>;
  };

  return (
    <nav
      aria-label={lang === "ko" ? "게시글 이동" : "Post navigation"}
      className="article-adjacent-navigation mt-6 w-full divide-y divide-slate-100 border-t border-slate-100"
    >
      {renderRow(prevArticle, "prev")}
      {renderRow(nextArticle, "next")}
    </nav>
  );
}
