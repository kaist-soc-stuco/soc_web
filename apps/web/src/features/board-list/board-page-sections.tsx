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
    <div className="border-b border-slate-200 bg-white mb-6">
      <div className="max-w-7xl mx-auto px-6 lg:px-8 flex flex-col md:flex-row md:items-stretch md:justify-between gap-2 md:gap-4 select-none">
        <div className="flex flex-wrap items-stretch gap-6 lg:gap-8">
          <Link to="/board" className="relative group flex items-center">
            <div
              className={`relative flex items-center justify-center h-full text-[14px] lg:text-[14.5px] tracking-tight transition-all py-4 cursor-pointer ${
                !category
                  ? "text-brand-primary font-semibold"
                  : "text-slate-400 hover:text-brand-primary font-medium"
              }`}
            >
              <span>{lang === "ko" ? "전체" : "All"}</span>
              <span
                className={`absolute bottom-0 left-[-0.45rem] right-[-0.45rem] h-[3px] rounded-full bg-brand-primary transition-transform duration-200 origin-center ${
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
                className="relative group flex items-center"
              >
                <div
                  className={`relative flex items-center justify-center h-full text-[14px] lg:text-[14.5px] tracking-tight transition-all py-4 cursor-pointer ${
                    isActive
                      ? "text-brand-primary font-semibold"
                      : "text-slate-400 hover:text-brand-primary font-medium"
                  }`}
                >
                  <span>{getBoardLabelFromMetadata(board, board.code, lang)}</span>
                  <span
                    className={`absolute bottom-0 left-[-0.45rem] right-[-0.45rem] h-[3px] rounded-full bg-brand-primary transition-transform duration-200 origin-center ${
                      isActive ? "scale-x-100" : "scale-x-0 group-hover:scale-x-100"
                    }`}
                  />
                </div>
              </Link>
            );
          })}
        </div>

        <div className="flex w-full items-center gap-2 pb-2 pt-0 md:w-auto md:shrink-0 md:self-center md:py-0">
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
              className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-[13px] font-medium tracking-tight text-slate-800 shadow-sm transition-colors placeholder:text-slate-400 focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/10 md:w-64"
            />
          </div>

          <div className="relative">
            <button
              onClick={() => onFilterDropdownOpenChange(!isFilterDropdownOpen)}
              className={`flex h-9 items-center gap-1.5 rounded-lg border px-3 text-[13px] font-semibold shadow-sm transition-colors cursor-pointer select-none ${
                isFilterDropdownOpen
                  ? "border-brand-primary bg-brand-primary-light text-brand-primary"
                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              <Filter className="h-3.5 w-3.5" />
              <span>{lang === "ko" ? "필터" : "Filter"}</span>
            </button>

            {isFilterDropdownOpen && (
              <div className="absolute right-0 z-30 mt-2 flex w-72 animate-in select-none flex-col gap-2.5 rounded-xl border border-slate-200 bg-white p-3 shadow-xl fade-in slide-in-from-top-1 duration-200">
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
      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
        {label}
      </span>
      <div className="bg-slate-100 p-0.5 rounded-lg flex items-stretch">
        {options.map((option) => {
          const active = value === option.id;
          return (
            <button
              key={option.id}
              onClick={() => onChange(option.id)}
              className={`flex-1 py-1 px-1 text-[11px] font-bold rounded-md transition-all cursor-pointer text-center whitespace-nowrap ${
                active
                  ? "bg-white text-brand-primary shadow-xs"
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
  return (
    <div className="max-w-7xl mx-auto px-6 lg:px-8">
      <div className="bg-white border border-card-border-subtle rounded-2xl shadow-card overflow-hidden">
        <div className="flex items-center justify-between gap-4 border-b border-slate-100 px-6 py-2 bg-white">
          <div className="text-[14px] font-bold text-slate-800 tracking-tight">
            {lang === "ko" ? (
              <span>
                총 <strong className="font-black text-brand-primary">{totalCount}</strong>
                건
              </span>
            ) : (
              <span>
                <strong className="font-black text-brand-primary">
                  {totalCount}
                </strong>{" "}
                posts
              </span>
            )}
          </div>
          <PostsPerPageSelect
            lang={lang}
            postsPerPage={postsPerPage}
            onPostsPerPageChange={onPostsPerPageChange}
          />
        </div>

        <div className="grid grid-cols-[3.75rem_minmax(0,1fr)_5.25rem] gap-3 border-b border-slate-200 bg-slate-50/50 px-4 py-3.5 text-[13px] font-bold tracking-tight text-slate-500 md:grid-cols-[8%_1fr_15%_12%_8%] md:gap-4 md:px-6">
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
                    className="group grid grid-cols-[3.75rem_minmax(0,1fr)_5.25rem] items-center gap-3 px-4 py-4 transition-colors hover:bg-slate-50/50 md:grid-cols-[8%_1fr_15%_12%_8%] md:gap-4 md:px-6"
                  >
                    <div className="flex justify-center text-center shrink-0">
                      <span className="inline-flex items-center px-2 py-1 rounded-md text-[10.5px] font-bold tracking-tight bg-brand-primary-light text-brand-primary select-none shrink-0">
                        {getBoardLabelFromMetadata(postBoard, postCategory, lang)}
                      </span>
                    </div>
                    <div className="flex min-w-0 items-center gap-2 text-left text-[14px] font-semibold tracking-tight text-slate-800 transition-colors group-hover:text-brand-primary md:pl-2">
                      {post.isPinned && (
                        <Pin className="h-3.5 w-3.5 shrink-0 fill-[#E11D48] text-[#E11D48]" />
                      )}
                      <span className="truncate">
                        {lang === "ko" ? post.titleKo : post.titleEn || post.titleKo}
                      </span>
                      {isNew && (
                        <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#f03e3e] text-[9px] font-black text-white select-none">
                          N
                        </span>
                      )}
                      {(post.hasAttachment ?? false) && (
                        <Paperclip className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                      )}
                    </div>
                    <div className="hidden text-center text-[13px] font-medium tracking-tight text-slate-600 shrink-0 md:block">
                      {post.isAnonymous
                        ? lang === "ko"
                          ? "익명"
                          : "Anonymous"
                        : post.author.name}
                    </div>
                    <div className="text-center text-[13px] font-medium tracking-tight text-slate-400 shrink-0">
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

        <div className="border-t border-slate-200 bg-slate-50/20 px-6 py-4 relative flex items-center justify-center select-none">
          <Pagination
            currentPage={currentPage}
            lang={lang}
            onPageChange={onPageChange}
            size="sm"
            totalPages={totalPages}
          />
          {canWrite && (
            <div className="absolute right-6">
              <Link
                state={writeState}
                to="/board/write"
                className="inline-flex items-center justify-center px-3.5 py-1.5 bg-brand-primary border border-transparent text-white rounded-lg text-[13px] font-bold tracking-tight hover:opacity-90 transition-all shadow-sm"
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
      buttonClassName="h-9 rounded-xl border-slate-200/80 px-3 py-0 text-[13px] font-semibold text-slate-700 shadow-sm focus:ring-brand-primary/10"
      menuClassName="rounded-xl border-slate-200 shadow-xl"
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
