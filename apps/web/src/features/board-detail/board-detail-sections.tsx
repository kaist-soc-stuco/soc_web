import type { ArticleDetailResponse, ArticleAssetItem } from "@soc/contracts";
import { isoToDate } from "@soc/shared";
import {
  ChevronDown,
  ChevronUp,
  ClipboardCheck,
  Edit2,
  Eye,
  Trash2,
} from "lucide-react";
import { Link } from "react-router-dom";

import { AttachmentList } from "@/components/ui/attachment-list";
import { resolveAssetUrl } from "@/lib/asset-url";
import {
  getBoardLabelFromMetadata,
  type BoardMetadata,
} from "@/lib/board-metadata";

function formatDate(isoString: string) {
  const date = isoToDate(isoString);
  if (Number.isNaN(date.getTime())) return "";
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}.${mm}.${dd}`;
}

function formatDateSlash(isoString: string) {
  const date = isoToDate(isoString);
  if (Number.isNaN(date.getTime())) return "";
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}/${mm}/${dd}`;
}

interface BoardDetailTabsProps {
  boards: BoardMetadata[];
  category: string;
  lang: string;
}

export function BoardDetailTabs({ boards, category, lang }: BoardDetailTabsProps) {
  return (
    <div className="border-b border-slate-200 bg-white mb-6">
      <div className="max-w-7xl mx-auto px-6 lg:px-8 flex flex-col md:flex-row md:items-stretch md:justify-between gap-4 select-none">
        <div className="flex flex-wrap items-stretch gap-6 lg:gap-8">
          <Link to="/board" className="relative group flex items-center">
            <div className="relative flex items-center justify-center h-full text-[14px] lg:text-[14.5px] tracking-tight transition-all py-4 cursor-pointer text-slate-400 hover:text-kaist-darkgreen font-medium">
              <span>{lang === "ko" ? "전체" : "All"}</span>
              <span className="absolute bottom-0 left-0 right-0 h-[3px] bg-kaist-darkgreen transition-transform duration-200 origin-center scale-x-0 group-hover:scale-x-100" />
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
                      isActive ? "scale-x-100" : "scale-x-0 group-hover:scale-x-100"
                    }`}
                  />
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}

interface ArticleCardProps {
  article: ArticleDetailResponse;
  attachmentAssets: ArticleAssetItem[];
  canEdit: boolean;
  category: string;
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
  content,
  lang,
  onDeleteArticle,
  posterAsset,
  surveyDescription,
  surveyTitle,
  title,
}: ArticleCardProps) {
  return (
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
            <span>{article.isAnonymous ? "익명" : article.author.name}</span>
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
                to={`/board/${category}/${article.articleId}/edit`}
                className="inline-flex h-7 items-center gap-1 rounded-md px-2 text-xs font-bold leading-none text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                title="수정"
              >
                <Edit2 className="h-3.5 w-3.5" />
                수정
              </Link>
              <button
                type="button"
                onClick={onDeleteArticle}
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
  );
}

export function BoardDetailBreadcrumb({
  category,
  displayBoardLabel,
}: {
  category: string;
  displayBoardLabel: string;
}) {
  return (
    <div className="flex items-center gap-1.5 text-[13px] text-slate-400 font-semibold select-none">
      <Link to="/board" className="hover:text-kaist-darkgreen transition-colors">
        게시판
      </Link>
      <svg
        className="w-2.5 h-2.5 text-slate-350"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        strokeWidth="2.5"
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
      </svg>
      <Link
        to={`/board/${category}`}
        className="text-slate-500 font-bold hover:text-kaist-darkgreen"
      >
        {displayBoardLabel}
      </Link>
    </div>
  );
}

export function BoardDetailAdjacentLinks({
  article,
  category,
}: {
  article: ArticleDetailResponse;
  category: string;
}) {
  return (
    <div className="w-full flex flex-col gap-2 mt-2">
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-[0_8px_28px_rgba(15,23,42,0.03)] divide-y divide-slate-100">
        <AdjacentLink
          article={article.prevArticle}
          category={category}
          emptyText="이전 게시글이 없습니다."
          icon="prev"
          label="이전글"
        />
        <AdjacentLink
          article={article.nextArticle}
          category={category}
          emptyText="다음 게시글이 없습니다."
          icon="next"
          label="다음글"
        />
      </div>

      <div className="flex justify-end mt-1">
        <Link
          to={`/board/${category}`}
          className="inline-flex items-center justify-center gap-1 px-4 py-2 bg-white border border-slate-200 hover:border-slate-300 rounded-lg text-[13px] font-bold text-slate-600 hover:text-slate-800 transition shadow-sm cursor-pointer"
        >
          목록으로
        </Link>
      </div>
    </div>
  );
}

function AdjacentLink({
  article,
  category,
  emptyText,
  icon,
  label,
}: {
  article: ArticleDetailResponse["prevArticle"];
  category: string;
  emptyText: string;
  icon: "prev" | "next";
  label: string;
}) {
  const Icon = icon === "prev" ? ChevronUp : ChevronDown;

  if (!article) {
    return (
      <div className="flex items-center px-5 py-3.5 text-sm text-slate-400 select-none">
        <span className="font-bold text-slate-350 shrink-0 mr-4 flex items-center gap-1">
          <Icon className="h-4 w-4 text-slate-300" />
          {label}
        </span>
        <span className="font-medium">{emptyText}</span>
      </div>
    );
  }

  return (
    <Link
      to={`/board/${category}/${article.articleId}`}
      className="flex items-center justify-between px-5 py-3.5 hover:bg-slate-50 transition-colors group text-sm"
    >
      <div className="flex items-center gap-4 min-w-0">
        <span className="font-bold text-slate-400 shrink-0 select-none flex items-center gap-1">
          <Icon className="h-4 w-4" />
          {label}
        </span>
        <span className="text-slate-700 font-semibold truncate group-hover:text-kaist-darkgreen transition-colors">
          {article.titleKo}
        </span>
      </div>
      <span className="text-xs text-slate-400 shrink-0 font-medium ml-4">
        {formatDate(article.postedAt)}
      </span>
    </Link>
  );
}
