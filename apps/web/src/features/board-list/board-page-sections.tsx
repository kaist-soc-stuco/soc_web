import type { ArticleListItem } from "@soc/contracts";
import { isoToDate, isoToMs, nowMs } from "@soc/shared";
import { ArrowDown, Filter, Paperclip, Pin, Search } from "lucide-react";
import { Link } from "react-router-dom";

import { SelectDropdown } from "@/components/atoms/select-dropdown";
import { Pagination } from "@/components/ui/pagination";
import {
  getBoardLabelFromMetadata,
  type BoardMetadata,
} from "@/lib/board-metadata";

import type {
  BoardPeriod,
  BoardSearchCriteria,
  BoardSortBy,
  BoardSortDirection,
} from "./use-board-page-controller";

function formatDate(dateIso: string) {
  const date = isoToDate(dateIso);
  if (Number.isNaN(date.getTime())) return "";
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}.${mm}.${dd}`;
}

interface BoardNavigationBarProps {
  boards: BoardMetadata[];
  category?: string;
  isFilterDropdownOpen: boolean;
  lang: string;
  onCurrentPageChange: (page: number) => void;
  onFilterDropdownOpenChange: (open: boolean) => void;
  onPeriodChange: (period: BoardPeriod) => void;
  onSearchCriteriaChange: (criteria: BoardSearchCriteria) => void;
  onSearchQueryChange: (query: string) => void;
  period: BoardPeriod;
  searchCriteria: BoardSearchCriteria;
  searchQuery: string;
}

export function BoardNavigationBar({
  boards,
  category,
  isFilterDropdownOpen,
  lang,
  onCurrentPageChange,
  onFilterDropdownOpenChange,
  onPeriodChange,
  onSearchCriteriaChange,
  onSearchQueryChange,
  period,
  searchCriteria,
  searchQuery,
}: BoardNavigationBarProps) {
  return (
    <div className="mb-5 border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 px-5 select-none md:flex-row md:items-stretch md:justify-between md:gap-4 lg:px-8">
        <div className="min-w-0 flex-1 overflow-x-auto">
          <div className="flex min-w-max flex-nowrap items-stretch gap-5 lg:gap-7">
            <Link to="/board" className="group relative flex items-center">
            <div
                className={`relative flex min-h-11 items-center justify-center text-[14px] tracking-tight transition-all cursor-pointer ${
                !category
                  ? "text-brand-primary font-semibold"
                  : "text-slate-400 hover:text-brand-primary font-medium"
              }`}
            >
                <span>{lang === "ko" ? "전체" : "All"}</span>
                <span
                  className={`absolute bottom-0 left-0 right-0 h-0.5 bg-brand-primary transition-transform duration-200 origin-center ${
                    !category ? "scale-x-100" : "scale-x-0 group-hover:scale-x-100"
                  }`}
                />
            </div>
          </Link>

            {boards.map((board) => {
              const isActive = category === board.code;
              return (
                <Link
                  key={board.code}
                  to={`/board/${board.code}`}
                  className="group relative flex items-center"
                >
                  <div
                    className={`relative flex min-h-11 items-center justify-center text-[14px] tracking-tight transition-all cursor-pointer ${
                    isActive
                      ? "text-brand-primary font-semibold"
                      : "text-slate-400 hover:text-brand-primary font-medium"
                    }`}
                  >
                    <span>{getBoardLabelFromMetadata(board, board.code, lang)}</span>
                    <span
                      className={`absolute bottom-0 left-0 right-0 h-0.5 bg-brand-primary transition-transform duration-200 origin-center ${
                        isActive ? "scale-x-100" : "scale-x-0 group-hover:scale-x-100"
                      }`}
                    />
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        <div className="flex w-full items-center gap-2 pb-3 pt-0 md:w-auto md:shrink-0 md:self-center md:py-0">
          <div className="relative min-w-0 flex-1 md:flex-none">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              placeholder={
                lang === "ko" ? "검색어를 입력하세요..." : "Enter search query..."
              }
              value={searchQuery}
              onChange={(event) => {
                onCurrentPageChange(1);
                onSearchQueryChange(event.target.value);
              }}
              className="h-10 w-full rounded-md border border-slate-200 bg-white pl-9 pr-3 text-[13px] font-medium tracking-tight text-slate-800 transition-colors placeholder:text-slate-400 focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20 md:w-64"
            />
          </div>

          <div className="relative">
            <button
              onClick={() => onFilterDropdownOpenChange(!isFilterDropdownOpen)}
              className={`flex h-10 items-center gap-1.5 rounded-md border px-3 text-[13px] font-semibold transition-colors cursor-pointer select-none ${
                isFilterDropdownOpen
                  ? "border-brand-primary bg-brand-primary-light text-brand-primary"
                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              <Filter className="h-3.5 w-3.5" />
              <span>{lang === "ko" ? "필터" : "Filter"}</span>
            </button>

            {isFilterDropdownOpen && (
              <div className="absolute right-0 z-30 mt-2 flex w-72 select-none flex-col gap-2.5 rounded-lg border border-slate-200 bg-white p-3 shadow-elevated">
                <FilterSegment
                  label={lang === "ko" ? "검색 기준" : "Search By"}
                  options={[
                    { id: "title", label: lang === "ko" ? "제목" : "Title" },
                    {
                      id: "author",
                      label: lang === "ko" ? "글쓴이" : "Author",
                    },
                    {
                      id: "title_content",
                      label: lang === "ko" ? "제목+내용" : "Title+Content",
                    },
                  ]}
                  value={searchCriteria}
                  onChange={(value) => {
                    onSearchCriteriaChange(value as BoardSearchCriteria);
                    onCurrentPageChange(1);
                  }}
                />
                <FilterSegment
                  label={lang === "ko" ? "조회 기간" : "Period"}
                  options={[
                    { id: "all", label: lang === "ko" ? "전체" : "All" },
                    {
                      id: "7days",
                      label: lang === "ko" ? "최근 7일" : "Last 7 days",
                    },
                    {
                      id: "30days",
                      label: lang === "ko" ? "최근 30일" : "Last 30 days",
                    },
                  ]}
                  value={period}
                  onChange={(value) => {
                    onPeriodChange(value as BoardPeriod);
                    onCurrentPageChange(1);
                  }}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function FilterSegment({
  label,
  onChange,
  options,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  options: ReadonlyArray<{ id: string; label: string }>;
  value: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
        {label}
      </span>
      <div className="flex items-stretch rounded-md border border-slate-200 bg-slate-50 p-0.5">
        {options.map((option) => {
          const active = value === option.id;
          return (
            <button
              key={option.id}
              onClick={() => onChange(option.id)}
                className={`flex-1 rounded-[4px] px-1 py-1.5 text-center text-[11px] font-semibold transition-all cursor-pointer whitespace-nowrap ${
                active
                  ? "bg-white text-brand-primary"
                  : "text-slate-500 hover:text-slate-800 bg-transparent"
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

interface BoardArticleTableProps {
  articles: ArticleListItem[];
  boardByCode: Map<string, BoardMetadata>;
  canWrite: boolean;
  category?: string;
  currentPage: number;
  isLoading: boolean;
  lang: string;
  onPageChange: (page: number) => void;
  onPostsPerPageChange: (value: number) => void;
  onSortChange: (sortBy: BoardSortBy) => void;
  postsPerPage: number;
  sortBy: BoardSortBy;
  sortDirection: BoardSortDirection;
  totalCount: number;
  totalPages: number;
  writeState?: { initialCategory: string };
}

export function BoardArticleTable({
  articles,
  boardByCode,
  canWrite,
  category,
  currentPage,
  isLoading,
  lang,
  onPageChange,
  onPostsPerPageChange,
  onSortChange,
  postsPerPage,
  sortBy,
  sortDirection,
  totalCount,
  totalPages,
  writeState,
}: BoardArticleTableProps) {
  const rangeStart = totalCount === 0 ? 0 : (currentPage - 1) * postsPerPage + 1;
  const rangeEnd = Math.min(totalCount, currentPage * postsPerPage);
  const authorLabel = (post: ArticleListItem) =>
    post.isAnonymous
      ? lang === "ko"
        ? "익명"
        : "Anonymous"
      : post.author.name;

  return (
    <div className="max-w-7xl mx-auto px-6 lg:px-8">
      <div className="overflow-hidden rounded-lg border border-card-border-subtle bg-white shadow-none">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 md:px-6">
          <div className="text-[13px] font-medium tracking-tight text-app-text-muted">
            {lang === "ko" ? (
              <span>
                총 <strong className="font-semibold text-app-text-strong">{totalCount}</strong>건
                {totalCount > 0 ? (
                  <span className="ml-2 text-xs text-app-text-muted">
                    ({rangeStart}–{rangeEnd})
                  </span>
                ) : null}
              </span>
            ) : (
              <span>
                <strong className="font-semibold text-app-text-strong">
                  {totalCount}
                </strong>{" "}posts
                {totalCount > 0 ? (
                  <span className="ml-2 text-xs text-app-text-muted">
                    ({rangeStart}–{rangeEnd})
                  </span>
                ) : null}
              </span>
            )}
          </div>
          <PostsPerPageSelect
            lang={lang}
            postsPerPage={postsPerPage}
            onPostsPerPageChange={onPostsPerPageChange}
          />
        </div>

        <div className="hidden grid-cols-[8%_1fr_15%_12%_8%] gap-4 border-b border-slate-200 bg-slate-50/70 px-6 py-3 text-[12px] font-semibold tracking-tight text-app-text-muted md:grid">
          <div className="text-center shrink-0">
            {lang === "ko" ? "말머리" : "Category"}
          </div>
          <div className="min-w-0 text-left md:pl-2">
            {lang === "ko" ? "제목" : "Title"}
          </div>
          <div className="hidden text-center shrink-0 md:block">
            {lang === "ko" ? "글쓴이" : "Author"}
          </div>
          <SortableHeader
            active={sortBy === "latest"}
            ascending={sortBy === "latest" && sortDirection === "asc"}
            label={lang === "ko" ? "작성일" : "Date"}
            onClick={() => onSortChange("latest")}
          />
          <div className="hidden justify-end pr-4 shrink-0 md:flex">
            <SortableHeader
              active={sortBy === "views"}
              ascending={sortBy === "views" && sortDirection === "asc"}
              label={lang === "ko" ? "조회수" : "Views"}
              onClick={() => onSortChange("views")}
            />
          </div>
        </div>

        <div className="relative min-h-[18rem]">
          <div className="divide-y divide-slate-100">
            {articles.length > 0 ? (
              articles.map((post) => {
                const isNew =
                  isoToMs(post.postedAt) >= nowMs() - 4 * 24 * 60 * 60 * 1000;
                const postCategory = post.boardCode || category || "공지";
                const postBoard = boardByCode.get(postCategory);

                return (
                  <Link
                    key={post.articleId}
                    to={`/board/${postCategory}/${post.articleId}`}
                    className="group flex min-h-[6.25rem] flex-col gap-2 px-4 py-3.5 transition-colors hover:bg-slate-50/70 md:grid md:min-h-0 md:grid-cols-[8%_1fr_15%_12%_8%] md:items-center md:gap-4 md:px-6 md:py-4"
                  >
                    <div className="flex justify-start text-left shrink-0 md:justify-center md:text-center">
                      <span className="inline-flex items-center rounded-md bg-brand-primary-light px-2 py-1 text-[10.5px] font-semibold tracking-tight text-brand-primary select-none shrink-0">
                        {getBoardLabelFromMetadata(postBoard, postCategory, lang)}
                      </span>
                    </div>
                    <div className="flex min-w-0 items-start gap-2 text-left text-[14px] font-semibold leading-5 tracking-tight text-app-text-strong transition-colors group-hover:text-brand-primary md:items-center md:pl-2">
                      {post.isPinned && (
                        <Pin className="h-3.5 w-3.5 shrink-0 fill-[#E11D48] text-[#E11D48]" />
                      )}
                      <span className="line-clamp-2 md:truncate">
                        {lang === "ko" ? post.titleKo : post.titleEn || post.titleKo}
                      </span>
                      {isNew && (
                        <span className="inline-flex shrink-0 items-center rounded-[4px] bg-[#fce8ee] px-1.5 py-0.5 text-[9px] font-semibold text-[#b4234d] select-none">
                          {lang === "ko" ? "새 글" : "New"}
                        </span>
                      )}
                      {(post.hasAttachment ?? false) && (
                        <Paperclip className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs font-medium tracking-tight text-app-text-muted md:hidden">
                      <span>{authorLabel(post)}</span>
                      <span aria-hidden="true">·</span>
                      <time dateTime={post.postedAt}>{formatDate(post.postedAt)}</time>
                    </div>
                    <div className="hidden text-center text-[13px] font-medium tracking-tight text-app-text-body shrink-0 md:block">
                      {authorLabel(post)}
                    </div>
                    <div className="hidden text-center text-[13px] font-medium tracking-tight text-app-text-muted shrink-0 md:block">
                      {formatDate(post.postedAt)}
                    </div>
                    <div className="hidden justify-end pr-4 text-[13px] font-medium tabular-nums tracking-tight text-slate-500 md:flex">
                      <span className="w-12 text-right">{post.viewCount}</span>
                    </div>
                  </Link>
                );
              })
            ) : !isLoading ? (
              <div className="py-20 text-center text-slate-400">
                <p className="text-base font-semibold">
                  {lang === "ko" ? "게시글이 없습니다" : "No posts available"}
                </p>
              </div>
            ) : null}
          </div>

          {isLoading && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-white/72 text-brand-primary backdrop-blur-[1px]">
              <div className="h-7 w-7 rounded-full border-2 border-brand-primary/20 border-t-brand-primary animate-spin" />
              <p className="text-sm font-bold">
                {lang === "ko" ? "게시글 불러오는 중" : "Loading posts"}
              </p>
            </div>
          )}
        </div>

        <div className="relative flex flex-col items-center justify-center gap-3 border-t border-slate-200 bg-slate-50/20 px-4 py-4 select-none sm:flex-row sm:px-6">
          <Pagination
            currentPage={currentPage}
            lang={lang}
            onPageChange={onPageChange}
            size="sm"
            totalPages={totalPages}
          />
          {canWrite && (
            <div className="sm:absolute sm:right-6">
              <Link
                state={writeState}
                to="/board/write"
                className="inline-flex min-h-9 items-center justify-center rounded-md border border-transparent bg-brand-primary px-3.5 text-[13px] font-semibold tracking-tight text-white transition-colors hover:bg-brand-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
              >
                {lang === "ko" ? "글쓰기" : "Write"}
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function PostsPerPageSelect({
  lang,
  onPostsPerPageChange,
  postsPerPage,
}: {
  lang: string;
  onPostsPerPageChange: (value: number) => void;
  postsPerPage: number;
}) {
  return (
    <SelectDropdown
      value={String(postsPerPage)}
      options={[10, 20, 30, 50].map((value) => ({
        value: String(value),
        label: lang === "ko" ? `${value}건` : `${value} per page`,
      }))}
      onChange={(value) => onPostsPerPageChange(Number(value))}
      className="w-36"
      buttonClassName="h-10 rounded-md border-slate-200 px-3 py-0 text-[13px] font-semibold text-slate-700 shadow-none focus:ring-brand-primary/20"
      menuClassName="rounded-lg border-slate-200 shadow-elevated"
      optionClassName="text-[12px]"
      emptyLabel={lang === "ko" ? "선택지가 없습니다." : "No options."}
    />
  );
}

function SortableHeader({
  active,
  ascending,
  label,
  onClick,
}: {
  active: boolean;
  ascending: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <div className="flex justify-center shrink-0">
      <button
        type="button"
        onClick={onClick}
        className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 transition-colors ${
          active ? "text-brand-primary" : "text-slate-500 hover:text-slate-700"
        }`}
      >
        <span>{label}</span>
        <ArrowDown
          className={`h-3 w-3 transition-transform ${ascending ? "rotate-180" : ""}`}
        />
      </button>
    </div>
  );
}
