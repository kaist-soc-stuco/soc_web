import type {
  ArticleDetailResponse,
  ArticleAssetItem,
  ArticleEngagementKind,
} from "@soc/contracts";
import { ArrowLeft, Ban, Check, ClipboardCheck, Edit2, EllipsisVertical, Eye, Pin, Share2, Trash2 } from "lucide-react";
import { isoToDate } from "@soc/shared";
import { Link } from "react-router-dom";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";

import { AttachmentList } from "@/components/ui/attachment-list";
import {
  AdminActionMenuLink,
  AdminActionMenuItem,
  AdminActionMenuPanel,
} from "@/components/ui/admin-action-menu";
import { ArticleEngagementActions } from "@/components/ui/article-engagement-actions";
import { RichTextContent } from "@/components/ui/rich-text-content";
import { resolveAssetUrl } from "@/lib/asset-url";
import { Button } from "@/components/ui/button";

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
  canManageArticle: boolean;
  canRestrictAuthor: boolean;
  category: string;
  content: string;
  editHref?: string;
  isAuthenticated: boolean;
  lang: string;
  onDeleteArticle: () => void;
  onRestrictAuthor: () => void;
  onShare: () => void;
  onToggle: (kind: ArticleEngagementKind, active: boolean) => void;
  posterAsset?: ArticleAssetItem;
  shareCopied: boolean;
  surveyDescription: string;
  surveyTitle: string;
  submitting: ArticleEngagementKind | null;
  title: string;
}

export function BoardDetailArticleCard({
  article,
  attachmentAssets,
  canManageArticle,
  canRestrictAuthor,
  category,
  content,
  editHref,
  isAuthenticated,
  lang,
  onDeleteArticle,
  onRestrictAuthor,
  onShare,
  onToggle,
  posterAsset,
  shareCopied,
  surveyDescription,
  surveyTitle,
  submitting,
  title,
}: ArticleCardProps) {
  return (
    <article className="w-full rounded-xl border border-card-border-subtle bg-white px-6 py-6 shadow-card md:px-[52px] md:py-[32px]">
      <header>
        <div className="flex min-w-0 items-center gap-2">
          {article.isPinned ? (
            <Pin
              className="size-4 shrink-0 rotate-45 text-brand-primary"
              aria-label={lang === "ko" ? "고정된 게시글" : "Pinned post"}
            />
          ) : null}
          <h1 className="min-w-0 text-[1.18rem] font-semibold leading-snug tracking-tight text-app-text-strong md:text-[1.45rem]">
            {title}
          </h1>
        </div>
        <div className="mt-3 flex items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-x-2 text-xs font-normal text-slate-400">
            <span>
              {article.isOfficial
                ? "전산학부 집행위원회"
                : article.isAnonymous
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
          {canManageArticle ? (
            <DropdownMenu.Root modal={false}>
              <DropdownMenu.Trigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={lang === "ko" ? "게시글 더보기" : "More post actions"}
                  className="size-8 bg-transparent text-slate-400 hover:bg-transparent hover:text-slate-700"
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
                  <AdminActionMenuPanel className="w-40 !shadow-[0_4px_12px_rgb(15_23_42_/_0.08)]">
                    <DropdownMenu.Item asChild>
                      <AdminActionMenuLink
                        to={editHref ?? `/board/${category}/${article.articleId}/edit`}
                        icon={<Edit2 className="text-slate-400" aria-hidden="true" />}
                      >
                        {lang === "ko" ? "수정" : "Edit"}
                      </AdminActionMenuLink>
                    </DropdownMenu.Item>
                    {canRestrictAuthor ? (
                      <DropdownMenu.Item asChild>
                        <AdminActionMenuItem
                          icon={<Ban />}
                          tone="danger"
                          onClick={onRestrictAuthor}
                        >
                          {lang === "ko" ? "작성자 제재" : "Restrict author"}
                        </AdminActionMenuItem>
                      </DropdownMenu.Item>
                    ) : null}
                    <DropdownMenu.Item asChild>
                      <AdminActionMenuItem
                        icon={<Trash2 />}
                        tone="danger"
                        onClick={onDeleteArticle}
                      >
                        {lang === "ko" ? "삭제" : "Delete"}
                      </AdminActionMenuItem>
                    </DropdownMenu.Item>
                  </AdminActionMenuPanel>
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
          ) : null}
        </div>
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
                <h2 className="truncate text-[length:var(--ui-text-body-size)] font-semibold leading-snug tracking-tight text-app-text-strong">
                  {surveyTitle}
                </h2>
                {surveyDescription && (
                  <RichTextContent
                    content={surveyDescription}
                    className="mt-1 line-clamp-2 text-xs font-medium leading-relaxed text-app-text-muted"
                  />
                )}
              </div>
            </div>
            <Link
              to={`/survey/${article.survey.surveyId}`}
              className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg bg-brand-primary px-3.5 py-1.5 text-xs font-bold text-white shadow-sm transition hover:bg-[#053b23]"
            >
              <span>{lang === "ko" ? "설문조사 참여하기" : "Take Survey"}</span>
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

      <div className="mt-8 flex items-center justify-start gap-2 border-t border-slate-100 pt-4">
        <ArticleEngagementActions
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
          title={
            shareCopied
              ? lang === "ko"
                ? "링크 복사됨"
                : "Link copied"
              : lang === "ko"
                ? "공유"
                : "Share"
          }
          className="rounded-md border-0 bg-transparent text-xs text-slate-500 active:text-brand-primary hover:border-0 hover:bg-slate-100 hover:text-slate-700"
        >
          {shareCopied ? (
            <Check className="size-3.5 text-brand-primary" aria-hidden="true" />
          ) : (
            <Share2 className="size-3.5" aria-hidden="true" />
          )}
        </Button>
      </div>
    </article>
  );
}

export function BoardDetailBackLink({
  category,
  lang,
  to,
}: {
  category: string;
  lang: string;
  to?: string;
}) {
  return (
    <Link
      to={to ?? `/board/${category}`}
      className="inline-flex min-h-9 items-center gap-1.5 self-start rounded-md px-2.5 text-[length:var(--ui-text-body-sm-size)] font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
    >
      <ArrowLeft className="size-4" aria-hidden="true" />
      {lang === "ko" ? "목록으로" : "Back to list"}
    </Link>
  );
}
