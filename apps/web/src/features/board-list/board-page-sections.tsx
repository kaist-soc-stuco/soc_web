import type { ReactNode } from "react";
import type { ArticleListItem } from "@soc/contracts";
import { isoToDate, isoToMs, nowMs } from "@soc/shared";
import { Paperclip } from "lucide-react";
import { Link } from "react-router-dom";

import { PageSizeSelect, Pagination } from "@/components/ui/pagination";
import { TableSkeleton } from "@/components/ui/skeleton";
import {
  getBoardLabelFromMetadata,
  isLegacyPublicBoardCode,
  type BoardMetadata,
} from "@/lib/board-metadata";

import { EmptyState } from "@/components/ui/data-state";
import {
  PageActionLink,
  PageContainer,
  DataViewBody,
  DataViewCard,
  DataViewFooter,
  DataViewToolbar,
  PageSearchField,
  PageTabLink,
  PageTabs,
  PageToolbar,
} from "@/components/ui/page-layout";

function formatBoardListDate(dateIso: string) {
  const date = isoToDate(dateIso);
  if (Number.isNaN(date.getTime())) return "";

  return `${String(date.getMonth() + 1).padStart(2, "0")}.${String(
    date.getDate(),
  ).padStart(2, "0")}`;
}

interface BoardCategoryNavigationProps {
  boards: BoardMetadata[];
  category?: string;
  lang: string;
}

export function BoardCategoryNavigation({
  boards,
  category,
  lang,
}: BoardCategoryNavigationProps) {
  return (
    <PageToolbar>
      <PageTabs
        aria-label={lang === "ko" ? "게시판 분류" : "Board categories"}
        variant="trackless"
      >
        <PageTabLink to="/board" active={!category}>
          {lang === "ko" ? "전체" : "All"}
        </PageTabLink>
        {boards
          .filter((board) => !isLegacyPublicBoardCode(board.code))
          .map((board) => {
            const isActive = category === board.code;
            return (
              <PageTabLink
                key={board.code}
                to={`/board/${board.code}`}
                active={isActive}
              >
                {getBoardLabelFromMetadata(board, board.code, lang)}
              </PageTabLink>
            );
          })}
      </PageTabs>
    </PageToolbar>
  );
}

interface BoardDataControlsProps {
  lang: string;
  onCurrentPageChange: (page: number) => void;
  onSearchQueryChange: (query: string) => void;
  searchQuery: string;
  canWrite: boolean;
  totalCount: number;
  writeState?: { initialCategory: string };
}

export function BoardDataControls({
  lang,
  onCurrentPageChange,
  onSearchQueryChange,
  searchQuery,
  canWrite,
  totalCount,
  writeState,
}: BoardDataControlsProps) {
  return (
      <div className="flex w-full min-w-0 flex-wrap items-center justify-between gap-3">
        <span
          className="shrink-0 text-[14px] font-normal text-[rgb(102,102,102)]"
          aria-live="polite"
        >
          {lang === "ko" ? (
            <>전체 {totalCount}건</>
          ) : (
            <>{totalCount} items</>
          )}
        </span>

        <div className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-2">
          <PageSearchField
            ariaLabel={lang === "ko" ? "게시판 검색" : "Search board"}
            placeholder={lang === "ko" ? "제목, 내용 검색" : "Search title, content"}
            value={searchQuery}
            onChange={(value) => {
              onCurrentPageChange(1);
              onSearchQueryChange(value);
            }}
            onClear={() => {
              onCurrentPageChange(1);
              onSearchQueryChange("");
            }}
          />

          {canWrite ? (
            <PageActionLink
              state={writeState}
              to="/board/write"
              tone="primary"
            >
              {lang === "ko" ? "작성" : "Write"}
            </PageActionLink>
          ) : null}
        </div>
      </div>
  );
}

interface BoardArticleTableProps {
  articles: ArticleListItem[];
  boardByCode: Map<string, BoardMetadata>;
  category?: string;
  currentPage: number;
  isLoading: boolean;
  showInitialSkeleton: boolean;
  lang: string;
  onPageChange: (page: number) => void;
  onPostsPerPageChange: (value: number) => void;
  postsPerPage: number;
  totalCount: number;
  totalPages: number;
  toolbar: ReactNode;
}

function BoardTableSkeleton({ columns }: { columns: number }) {
  return (
    <TableSkeleton
      columns={columns}
      rows={8}
      className="border-t border-slate-100"
    />
  );
}

export function BoardArticleTable({
  articles,
  boardByCode,
  category,
  currentPage,
  isLoading,
  showInitialSkeleton,
  lang,
  onPageChange,
  onPostsPerPageChange,
  postsPerPage,
  totalCount,
  totalPages,
  toolbar,
}: BoardArticleTableProps) {
  const rangeStart = totalCount === 0 ? 0 : (currentPage - 1) * postsPerPage + 1;
  const rangeEnd = Math.min(totalCount, currentPage * postsPerPage);
  const authorLabel = (post: ArticleListItem) =>
    post.isAnonymous
      ? lang === "ko"
        ? "익명"
        : "Anonymous"
      : post.author.name;
  const tableGridClass = `board-table-grid ${category ? "" : "board-table-grid--all"}`;
  const renderArticleRow = (post: ArticleListItem, pinned = false) => {
    const isNew =
      isoToMs(post.postedAt) >= nowMs() - 4 * 24 * 60 * 60 * 1000;
    const postCategory = post.boardCode || category || "공지";
    const postBoard = boardByCode.get(postCategory);

    return (
      <div
        key={post.articleId}
        className={`interaction-row group flex min-h-12 px-4 py-1.5 md:px-6 ${
          pinned ? "bg-emerald-100/35 hover:bg-emerald-100/50" : ""
        }`}
      >
        <Link
          to={`/board/${postCategory}/${post.articleId}`}
          className={`grid min-w-0 w-full grid-cols-1 gap-1.5 md:items-center md:gap-3 ${tableGridClass}`}
        >
          {!category ? (
            <div className="flex shrink-0 justify-start text-left md:justify-center md:text-center">
              <span className="inline-flex items-center rounded-md border-0 bg-slate-100 px-2 py-0.5 text-[11px] font-semibold tracking-tight text-slate-700 select-none">
                {getBoardLabelFromMetadata(postBoard, postCategory, lang)}
              </span>
            </div>
          ) : null}
          <div className={`flex min-w-0 items-center gap-2 text-left text-[15px] leading-5 tracking-tight text-app-text-strong md:pl-1 ${pinned ? "font-semibold" : "font-medium"}`}>
            <span className="line-clamp-2 min-w-0 md:truncate">
              {lang === "ko" ? post.titleKo : post.titleEn || post.titleKo}
            </span>
            {isNew ? (
              <span
                className="h-1.5 w-1.5 shrink-0 rounded-full bg-rose-500"
                title={lang === "ko" ? "새 글" : "New"}
              >
                <span className="sr-only">{lang === "ko" ? "새 글" : "New"}</span>
              </span>
            ) : null}
            {(post.hasAttachment ?? false) && (
              <Paperclip className="h-3.5 w-3.5 shrink-0 text-slate-400" />
            )}
          </div>
          <div className="flex items-center gap-2 text-[14px] font-normal tracking-tight text-[var(--j-color-text-secondary)] md:hidden">
            <span>{authorLabel(post)}</span>
            <span aria-hidden="true">·</span>
            <time dateTime={post.postedAt} className="tabular-nums">
              {formatBoardListDate(post.postedAt)}
            </time>
          </div>
          <div className="hidden shrink-0 text-center text-[14px] font-normal tracking-tight text-[var(--j-color-text-secondary)] md:block">
            {authorLabel(post)}
          </div>
          <div className="hidden shrink-0 text-center text-[14px] font-normal tracking-tight text-[var(--j-color-text-secondary)] md:block">
            <time dateTime={post.postedAt} className="tabular-nums">
              {formatBoardListDate(post.postedAt)}
            </time>
          </div>
          <div className="hidden shrink-0 justify-end pr-1 text-[14px] font-normal tabular-nums tracking-tight text-[var(--j-color-text-secondary)] md:flex">
            <span className="w-10 text-right">{post.viewCount}</span>
          </div>
        </Link>
      </div>
    );
  };

  return (
    <PageContainer className="pb-8">
      <DataViewCard aria-label={lang === "ko" ? "게시글 목록" : "Article list"}>
        <DataViewToolbar>{toolbar}</DataViewToolbar>
        <DataViewBody>
        <div className={`hidden h-12 ${tableGridClass} items-center gap-3 border-b border-[var(--ui-border-subtle)] border-t-2 border-t-brand-primary bg-slate-50/70 px-6 text-[14px] font-medium tracking-tight text-slate-500 md:grid`}>
          {!category ? (
            <div className="shrink-0 text-center">
              {lang === "ko" ? "분류" : "Category"}
            </div>
          ) : null}
          <div className="min-w-0 text-left md:pl-1">
            {lang === "ko" ? "제목" : "Title"}
          </div>
          <div className="hidden shrink-0 text-center md:block">
            {lang === "ko" ? "작성자" : "Author"}
          </div>
          <div className="shrink-0 text-right">
            {lang === "ko" ? "작성일" : "Date"}
          </div>
          <div className="hidden shrink-0 justify-end pr-1 text-right md:flex">
            {lang === "ko" ? "조회수" : "Views"}
          </div>
        </div>

        <div className={isLoading || articles.length === 0 ? "relative min-h-48" : "relative"}>
          <div
            className={`divide-y divide-slate-100 transition-opacity duration-150 ${
              isLoading && articles.length > 0 ? "opacity-70" : "opacity-100"
            }`}
          >
            {articles.length > 0
              ? articles.map((post) => renderArticleRow(post, post.isPinned))
              : articles.length === 0 && !isLoading ? (
                <EmptyState
                  className="min-h-48 rounded-none border-0 bg-transparent"
                  message={lang === "ko" ? "등록된 게시글이 없습니다." : "No posts available."}
                  minHeightClassName="min-h-48"
                />
              ) : null}
          </div>

          {showInitialSkeleton && articles.length === 0 ? (
            <BoardTableSkeleton columns={category ? 4 : 5} />
          ) : null}
        </div>
        </DataViewBody>

        <DataViewFooter className="select-none">
          <Pagination
            className="w-full"
            currentPage={currentPage}
            lang={lang}
            onPageChange={onPageChange}
            pageSizeControl={<PageSizeSelect
              lang={lang}
              value={postsPerPage}
              onChange={onPostsPerPageChange}
            />}
            range={<span className="whitespace-nowrap text-sm font-normal text-[var(--j-color-text-secondary)]">
              {lang === "ko"
                ? `총 ${totalCount}건 중 ${rangeStart}-${rangeEnd}`
                : `${rangeStart}-${rangeEnd} of ${totalCount}`}
            </span>}
            totalPages={totalPages}
          />
        </DataViewFooter>
      </DataViewCard>
    </PageContainer>
  );
}
