import type {
  ArticleDetailResponse,
  ArticleAssetItem,
  ArticleEngagementKind,
} from "@soc/contracts";
import { ArrowLeft, Check, ClipboardCheck, Edit2, Eye, Share2, Trash2 } from "lucide-react";
import { isoToDate } from "@soc/shared";
import { Link } from "react-router-dom";

import { AttachmentList } from "@/components/ui/attachment-list";
import { ArticleEngagementActions } from "@/components/ui/article-engagement-actions";
import { RichTextContent } from "@/components/ui/rich-text-content";
import { resolveAssetUrl } from "@/lib/asset-url";
import {
  getBoardLabelFromMetadata,
  isLegacyPublicBoardCode,
} from "@/lib/board-metadata";
import { Button } from "@/components/ui/button";
import { Breadcrumbs } from "@/components/ui/page-layout";

function formatDate(isoString: string) {
  const date = isoToDate(isoString);
  if (Number.isNaN(date.getTime())) return "";

  const yyyy = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${yyyy}.${month}.${day} ${hours}:${minutes}`;
}

interface ArticleCardProps {
  article: ArticleDetailResponse;
  attachmentAssets: ArticleAssetItem[];
  canEdit: boolean;
  category: string;
  categoryLabel: string;
  content: string;
  lang: string;
  onDeleteArticle: () => void;
  posterAsset?: ArticleAssetItem;
  surveyDescription: string;
  surveyTitle: string;
  title: string;
}

export function BoardDetailArticleCard({
  article,
  attachmentAssets,
  canEdit,
  category,
  categoryLabel,
  content,
  lang,
  onDeleteArticle,
  posterAsset,
  surveyDescription,
  surveyTitle,
  title,
}: ArticleCardProps) {
  return (
    <article className="w-full rounded-xl border border-card-border-subtle bg-white px-6 py-6 shadow-card md:px-[52px] md:py-[32px]">
      <header>
        <span className="inline-flex rounded-md bg-brand-primary-light px-2 py-1 text-xs font-bold text-brand-primary">
          {categoryLabel}
        </span>
        <h1 className="mt-3 text-[1.18rem] font-semibold leading-snug tracking-tight text-app-text-strong md:text-[1.45rem]">
          {title}
        </h1>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-x-2 text-xs font-medium text-slate-400">
            <span>
              {article.isAnonymous
                ? lang === "ko"
                  ? "익명"
                  : "Anonymous"
                : article.author.name}
            </span>
            <span className="text-slate-300">·</span>
            <span>{formatDate(article.postedAt)}</span>
            <span className="text-slate-300">·</span>
            <span className="inline-flex items-center gap-1">
              <Eye className="h-3.5 w-3.5" aria-hidden="true" />
              {article.viewCount}
            </span>
          </div>
        </div>

        {canEdit && (
          <div className="mt-2 flex justify-end gap-1">
            <Button
              asChild
              variant="ghost"
              size="icon"
              className="size-8 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            >
              <Link
                to={`/board/${category}/${article.articleId}/edit`}
                aria-label={lang === "ko" ? "게시글 수정" : "Edit post"}
                title={lang === "ko" ? "수정" : "Edit"}
              >
                <Edit2 className="size-4" aria-hidden="true" />
              </Link>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              type="button"
              onClick={onDeleteArticle}
              aria-label={lang === "ko" ? "게시글 삭제" : "Delete post"}
              title={lang === "ko" ? "삭제" : "Delete"}
              className="size-8 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
            >
              <Trash2 className="size-4" aria-hidden="true" />
            </Button>
          </div>
        )}
      </header>

      <div className="pt-5">
        {posterAsset && (
          <figure className="w-full mb-6 overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
            <img
              src={resolveAssetUrl(posterAsset.storageKey)}
              alt={posterAsset.originalFilename}
              className="mx-auto max-h-[520px] w-full object-contain"
            />
          </figure>
        )}

        <RichTextContent
          content={content}
          className="text-[0.94rem] font-medium leading-7 text-app-text-body"
        />
      </div>

      <AttachmentList
        assets={attachmentAssets}
        className="mt-6"
        lang={lang}
      />

      {article.survey && (
        <section className="mt-6 rounded-xl border border-brand-primary-border bg-brand-primary-light/55 px-4 py-3.5 shadow-[0_8px_24px_rgba(15,23,42,0.025)]">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/80 bg-white text-brand-primary shadow-sm">
                <ClipboardCheck className="h-4.5 w-4.5" />
              </span>
              <div className="min-w-0">
                <h2 className="truncate text-[14px] font-semibold leading-snug tracking-tight text-app-text-strong">
                  {surveyTitle}
                </h2>
                {surveyDescription && (
                  <RichTextContent
                    content={surveyDescription}
                    className="mt-1 line-clamp-2 text-[12px] font-medium leading-relaxed text-app-text-muted"
                  />
                )}
              </div>
            </div>
            <Link
              to={`/survey/${article.survey.surveyId}`}
              className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg bg-brand-primary px-3.5 py-1.5 text-[12px] font-bold text-white shadow-sm transition hover:bg-[#053b23]"
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
  );
}

interface BoardDetailFloatingActionsProps {
  lang: string;
  likeCount: number;
  scrapCount: number;
  viewerHasLiked: boolean;
  viewerHasScrapped: boolean;
  submitting: ArticleEngagementKind | null;
  shareCopied: boolean;
  onShare: () => void;
  onToggle: (kind: ArticleEngagementKind, active: boolean) => void;
}

export function BoardDetailFloatingActions({
  lang,
  likeCount,
  scrapCount,
  viewerHasLiked,
  viewerHasScrapped,
  submitting,
  shareCopied,
  onShare,
  onToggle,
}: BoardDetailFloatingActionsProps) {
  return (
    <aside
      aria-label={lang === "ko" ? "게시글 액션" : "Post actions"}
      className="fixed bottom-5 left-1/2 z-30 flex -translate-x-1/2 items-center gap-1 rounded-full border border-slate-200/90 bg-white/95 p-1.5 shadow-[0_10px_30px_rgba(15,23,42,0.14)] backdrop-blur"
    >
      <ArticleEngagementActions
        lang={lang}
        likeCount={likeCount}
        scrapCount={scrapCount}
        viewerHasLiked={viewerHasLiked}
        viewerHasScrapped={viewerHasScrapped}
        submitting={submitting}
        onToggle={onToggle}
        compact
      />
      <Button
        type="button"
        variant="ghost"
        size="icon"
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
        title={
          shareCopied
            ? lang === "ko"
              ? "링크 복사됨"
              : "Link copied"
            : lang === "ko"
              ? "공유"
              : "Share"
        }
        className="size-8 rounded-full text-slate-500 hover:text-brand-primary"
      >
        {shareCopied ? (
          <Check className="size-4 text-brand-primary" aria-hidden="true" />
        ) : (
          <Share2 className="size-4" aria-hidden="true" />
        )}
      </Button>
    </aside>
  );
}

export function BoardDetailBreadcrumb({
  category,
  displayBoardLabel,
  lang,
}: {
  category: string;
  displayBoardLabel: string;
  lang: string;
}) {
  return (
    <div className="flex items-center gap-2 select-none">
      <Breadcrumbs
        breadcrumbs={[
          { label: lang === "ko" ? "게시판" : "Board", to: "/board" },
          { label: displayBoardLabel, to: `/board/${category}` },
        ]}
        homeLabel={lang === "ko" ? "홈" : "Home"}
      />
      {isLegacyPublicBoardCode(category) && (
        <span className="mb-1.5 rounded-sm bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
          {lang === "ko" ? "이전 분류" : "Legacy"}
        </span>
      )}
    </div>
  );
}

export function BoardDetailBackLink({
  category,
  lang,
}: {
  category: string;
  lang: string;
}) {
  return (
    <Link
      to={`/board/${category}`}
      className="inline-flex min-h-9 items-center gap-1.5 self-start rounded-md px-2.5 text-[13px] font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
    >
      <ArrowLeft className="size-4" aria-hidden="true" />
      {lang === "ko" ? "목록으로" : "Back to list"}
    </Link>
  );
}
