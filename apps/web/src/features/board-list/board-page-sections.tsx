import { SearchLoadingContext } from "@/lib/search-loading-context";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { ArticleListTitle } from "@/components/ui/article-list-title";
import { PromotionStatus } from "@/components/ui/promotion-period";
import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import type { ArticleListItem } from "@soc/contracts";
import { isoToDate, isoToMs, nowMs } from "@soc/shared";
import { FileText, Paperclip, Pin, RotateCcw, SearchX, SquarePen } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";

import { PageSizeSelect, Pagination } from "@/components/ui/pagination";
import {
  getBoardLabelFromMetadata,
  isLegacyPublicBoardCode,
  type BoardMetadata,
} from "@/lib/board-metadata";

import { ListState, ListStateAction, ErrorState } from "@/components/ui/data-state";
import { Button } from "@/components/ui/button";
import {
  PageActionLink,
  PageContainer,
  DataViewBody,
  DataViewCard,
  DataViewFooter,
  DataViewToolbar,
  PageSearchField,
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
  const navigate = useNavigate();
  const tabsRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = tabsRef.current;
    if (!root) return;
    const updateEdges = () => {
      root.dataset.overflowStart = String(root.scrollLeft > 2);
      root.dataset.overflowEnd = String(root.scrollWidth - root.clientWidth - root.scrollLeft > 2);
    };
    const revealActive = () => {
      if (window.innerWidth < 768) {
        const active = root.querySelector<HTMLButtonElement>("button.is-active");
        if (active) {
          const bounds = root.getBoundingClientRect();
          const tab = active.getBoundingClientRect();
          if (tab.left < bounds.left + 16) root.scrollLeft += tab.left - bounds.left - 16;
          else if (tab.right > bounds.right - 16) root.scrollLeft += tab.right - bounds.right + 16;
        }
      }
      updateEdges();
    };
    revealActive();
    const observer = new ResizeObserver(revealActive);
    observer.observe(root);
    const tabs = root.firstElementChild;
    if (tabs) observer.observe(tabs);
    root.addEventListener("scroll", updateEdges, { passive: true });
    return () => { observer.disconnect(); root.removeEventListener("scroll", updateEdges); };
  }, [boards, category]);
  const categoryOptions = [
    { value: "", label: lang === "ko" ? "전체" : "All" },
    ...boards
      .filter((board) => board.code !== "faq" && !isLegacyPublicBoardCode(board.code))
      .map((board) => ({
        value: board.code,
        label: getBoardLabelFromMetadata(board, board.code, lang),
      })),
  ];

  return (
    <PageToolbar>
      <div ref={tabsRef} className="mobile-board-tabs-shell">
      <SegmentedControl
        variant="underline"
        ariaLabel={lang === "ko" ? "게시판 분류" : "Board categories"}
        className="board-category-tabs min-w-0"
        itemClassName="shrink-0"
        value={category ?? ""}
        options={categoryOptions}
        onChange={value => navigate(value ? "/board/" + value : "/board")}
      />
      </div>
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
          className="hidden shrink-0 text-[length:var(--ui-text-body-size)] font-normal text-[var(--ui-text-muted)] md:inline"
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
            className="mobile-board-search-field"
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

          {canWrite && <BoardWriteFloatingAction lang={lang} writeState={writeState} />}
          {canWrite ? (
            <PageActionLink
              state={writeState}
              to="/board/write"
              tone="primary"
              className="hidden md:inline-flex"
            >
              {lang === "ko" ? "작성" : "Write"}
            </PageActionLink>
          ) : null}
        </div>
      </div>
  );
}

function BoardWriteFloatingAction({ lang, writeState }: { lang: string; writeState?: { initialCategory: string } }) {
  useEffect(() => {
    document.body.classList.add("board-write-fab-visible");
    return () => document.body.classList.remove("board-write-fab-visible");
  }, []);
  return createPortal(<Link to="/board/write" state={writeState} className="board-write-fab" aria-label={lang === "ko" ? "게시글 작성" : "Write a post"}><SquarePen aria-hidden="true" className="size-6" strokeWidth={1.5} /></Link>, document.body);
}

interface BoardArticleTableProps {
  articleError: string | null;
  articles: ArticleListItem[];
  boardByCode: Map<string, BoardMetadata>;
  category?: string;
  currentPage: number;
  isLoading: boolean;
  showInitialSkeleton: boolean;
  lang: string;
  onPageChange: (page: number) => void;
  onPostsPerPageChange: (value: number) => void;
  onRetry: () => void;
  postsPerPage: number;
  totalCount: number;
  totalPages: number;
  toolbar: ReactNode;
  hasMoreArticles: boolean;
  isLoadingMore: boolean;
  onLoadMore: () => void;
  searchQuery: string;
  onResetSearch: () => void;
}

function BoardTableSkeleton({ columns }: { columns: number }) {
  void columns;
  return <div className="min-h-48 border-t border-slate-100" aria-label="게시글 불러오는 중" aria-busy="true" />;
}

export function BoardArticleTable({
  articleError,
  articles,
  boardByCode,
  category,
  currentPage,
  isLoading,
  showInitialSkeleton,
  lang,
  onPageChange,
  onPostsPerPageChange,
  onRetry,
  postsPerPage,
  totalCount,
  totalPages,
  toolbar,
  hasMoreArticles,
  isLoadingMore,
  onLoadMore,
  searchQuery,
  onResetSearch,
}: BoardArticleTableProps) {
  const rangeStart = totalCount === 0 ? 0 : (currentPage - 1) * postsPerPage + 1;
  const rangeEnd = Math.min(totalCount, currentPage * postsPerPage);
  const authorLabel = (post: ArticleListItem) =>
    post.isAnonymous
      ? lang === "ko"
        ? "익명"
        : "Anonymous"
      : (lang === "en" ? post.author.nameEn || post.author.name : post.author.name);
  const tableGridClass = `board-table-grid ${category ? "" : "board-table-grid--all"}`;
  const renderArticleRow = (post: ArticleListItem, pinned = false) => {
    const isNew =
      isoToMs(post.postedAt) >= nowMs() - 4 * 24 * 60 * 60 * 1000;
    const postCategory = post.boardCode || category || "notice";
    const postBoard = boardByCode.get(postCategory);

    return (
      <div
        key={post.articleId}
        data-pinned={pinned || undefined}
        className={`interaction-row group flex min-h-12 border-b border-slate-100 px-4 py-1.5 md:px-6 ${
          pinned ? "bg-emerald-50/70 hover:bg-emerald-100/60" : ""
        }`}
      >
        <Link
          to={`/board/${postCategory}/${post.articleId}`}
          className={`grid min-w-0 w-full grid-cols-1 gap-1.5 md:items-center md:gap-3 ${tableGridClass}`}
        >
          {!category ? (
            <div className="hidden shrink-0 items-center justify-start text-left md:flex">
              <span className={`relative -top-[0.5px] text-[length:var(--ui-text-caption-size)] font-medium leading-5 select-none ${pinned ? "text-kaist-darkgreen" : "text-slate-500"}`}>
                {getBoardLabelFromMetadata(postBoard, postCategory, lang)}
              </span>
            </div>
          ) : null}
          <div className={`flex min-w-0 items-center gap-2 text-left text-[length:var(--ui-text-section-size)] leading-5 tracking-tight text-app-text-strong ${pinned ? "font-semibold" : "font-medium"}`}>
            {postCategory === "promotions" && <PromotionStatus start={post.eventStartDate} end={post.eventEndDate} lang={lang} />}
            {pinned ? <Pin role="img" aria-label={lang === "ko" ? "고정 공지" : "Pinned notice"} className="size-3.5 shrink-0 self-center rotate-45 fill-kaist-darkgreen/15 text-kaist-darkgreen" strokeWidth={1.7} /> : null}
            {/* Compensate for Pretendard's visible glyph center without moving the row or icons. */}
            <ArticleListTitle className="relative -top-px mobile-board-title">{lang === "ko" ? post.titleKo : post.titleEn || post.titleKo}</ArticleListTitle>
            {post.commentCount > 0 ? (
              <span
                aria-label={
                  lang === "ko"
                    ? `댓글 ${post.commentCount}개`
                    : `${post.commentCount} comments`
                }
                className="shrink-0 self-center text-xs font-normal leading-4 text-[#1769AA]"
              >
                [{post.commentCount}]
              </span>
            ) : null}
            {(post.hasAttachment ?? false) && (
              <Paperclip className="h-3.5 w-3.5 shrink-0 text-slate-400" />
            )}
            {isNew ? (
              <span
                className="h-[4px] w-[4px] shrink-0 rounded-full bg-rose-500"
              >
                <span className="sr-only">{lang === "ko" ? "새 글" : "New post"}</span>
              </span>
            ) : null}
          </div>
          <div className="mobile-board-metadata flex items-center gap-2 text-[length:var(--ui-text-body-size)] font-normal tracking-tight text-[var(--j-color-text-secondary)] md:hidden">
            {!category && <><span className="mobile-board-category">{getBoardLabelFromMetadata(postBoard, postCategory, lang)}</span><span className="mobile-board-divider" aria-hidden="true">·</span></>}
            <span className="mobile-board-author">{authorLabel(post)}</span>
            <time dateTime={post.postedAt} className="tabular-nums">
              {formatBoardListDate(post.postedAt)}
            </time>
          </div>
          <div className="hidden shrink-0 text-center text-[length:var(--ui-text-body-size)] font-normal tracking-tight text-[var(--j-color-text-secondary)] md:block">
            {authorLabel(post)}
          </div>
          <div className="hidden shrink-0 text-center text-[length:var(--ui-text-body-size)] font-normal tracking-tight text-[var(--j-color-text-secondary)] md:block">
            <time dateTime={post.postedAt} className="tabular-nums">
              {formatBoardListDate(post.postedAt)}
            </time>
          </div>
          <div className="hidden shrink-0 justify-end pr-1 text-[length:var(--ui-text-body-size)] font-normal tabular-nums tracking-tight text-[var(--j-color-text-secondary)] md:flex">
            <span className="w-10 text-right">{post.viewCount}</span>
          </div>
        </Link>
      </div>
    );
  };

  return (
    <PageContainer className="pb-8">
      <DataViewCard className="board-article-table" aria-label={lang === "ko" ? "게시글 목록" : "Article list"}>
        <SearchLoadingContext.Provider value={isLoading}>
          <DataViewToolbar className="mobile-board-list-toolbar">{toolbar}</DataViewToolbar>
        </SearchLoadingContext.Provider>
        <DataViewBody>
        <div className={`hidden h-[var(--ui-table-head-height)] ${tableGridClass} items-center gap-3 border-b border-[var(--ui-border-subtle)] bg-slate-50/70 px-6 text-[length:var(--ui-text-body-size)] font-medium tracking-tight text-slate-500 md:grid`}>
          {!category ? (
            <div className="shrink-0 text-left">
              {lang === "ko" ? "분류" : "Category"}
            </div>
          ) : null}
          <div className="min-w-0 text-left">
            {lang === "ko" ? "제목" : "Title"}
          </div>
          <div className="hidden shrink-0 text-center md:block">
            {lang === "ko" ? "작성자" : "Author"}
          </div>
          <div className="shrink-0 text-center">
            {lang === "ko" ? "작성일" : "Date posted"}
          </div>
          <div className="hidden shrink-0 justify-end pr-1 text-right md:flex">
            {lang === "ko" ? "조회수" : "Views"}
          </div>
        </div>

        <div className="relative min-h-48">
          <div
            aria-busy={isLoading}
          >
            {articleError ? (
              <ErrorState
                description={
                  lang === "ko"
                    ? "일시적인 네트워크 오류일 수 있습니다. 잠시 후 다시 시도해 주세요."
                    : "This may be a temporary network issue. Please try again."
                }
                onRetry={onRetry}
                retryLabel={lang === "ko" ? "다시 시도" : "Retry"}
                title={
                  lang === "ko"
                    ? "게시글 목록을 불러오지 못했습니다."
                    : "We couldn't load the posts."
                }
              />
            ) : articles.length > 0
              ? articles.map((post) => renderArticleRow(post, post.isPinned))
              : !showInitialSkeleton ? (
                <ListState icon={searchQuery.trim() ? SearchX : FileText}
                  title={lang === "ko" ? searchQuery.trim() ? "조건에 맞는 게시글이 없습니다" : "등록된 게시글이 없습니다" : searchQuery.trim() ? "No matching posts" : "No posts yet"}
                  description={lang === "ko" ? searchQuery.trim() ? "다른 검색어로 다시 검색하거나 검색어를 초기화해 주세요." : "새 게시글이 등록되면 여기에 표시됩니다." : searchQuery.trim() ? "Try a different keyword or clear your search." : "New posts will appear here."}
                  action={searchQuery.trim() ? <ListStateAction icon={RotateCcw} onClick={onResetSearch}>{lang === "ko" ? "검색어 초기화" : "Clear search"}</ListStateAction> : undefined}
                />
              ) : null}
          </div>

          {showInitialSkeleton && articles.length === 0 ? (
            <BoardTableSkeleton columns={category ? 4 : 5} />
          ) : null}
        </div>
        </DataViewBody>

        {totalCount > 0 ? (
          <DataViewFooter className="hidden select-none md:flex">
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
        ) : null}
        {hasMoreArticles ? <div className="mobile-board-more md:hidden">
          <Button variant="ghost" onClick={onLoadMore} disabled={isLoading} className="min-h-11 w-full">
            {isLoadingMore ? (lang === "ko" ? "불러오는 중…" : "Loading…") : (lang === "ko" ? `${category === "notice" ? "공지" : "게시글"} 더보기 +` : "Load more posts +")}
          </Button>
        </div> : null}
      </DataViewCard>
    </PageContainer>
  );
}
