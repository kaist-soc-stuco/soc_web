import type { PartialSearchKind } from "./use-search-page-controller";
import type { FormEvent, ReactNode } from "react";
import { useState } from "react";
import { useMediaQuery } from "@/hooks/use-media-query";
import { FilterSheet } from "@/components/ui/filter-sheet";
import { MobileFilterActions, MobileFilterButton } from "@/components/ui/mobile-filter-controls";
import { Link } from "react-router-dom";
import type {
  ArticleListItem,
  BoardSummary,
  PublicCalendarEventItem,
  PublicSurveyRecord,
  VoteRecord,
} from "@soc/contracts";
import { ArrowRight, Loader2, RefreshCw, RotateCcw, SearchX, WifiOff } from "lucide-react";
import { ListState, ListStateAction } from "@/components/ui/data-state";

import { PageActionButton, PageSearchField, PageTabButton, PageTabs } from "@/components/ui/page-layout";
import { Button } from "@/components/ui/button";
import { MobileSectionSelector } from "@/components/ui/mobile-section-selector";
import { SelectDropdown } from "@/components/atoms/select-dropdown";
import { stripRichText } from "@/components/ui/rich-text-content";
import { getBoardLabelFromMetadata } from "@/lib/board-metadata";
import { formatShortDate } from "@/lib/date-display";

import type { AboutSearchItem, SearchFilter } from "./search-utils";


function formatDate(value: string, lang: string) {
  return formatShortDate(value, lang);
}

function getSurveyKindLabel(kind: string, lang: string) {
  if (kind === "APPLICATION") return lang === "ko" ? "행사 신청" : "Event application";
  return lang === "ko" ? "일반 설문" : "Survey";
}

function getSurveyStateLabel(state: string, lang: string) {
  if (state === "before_open") return lang === "ko" ? "시작 예정" : "Upcoming";
  if (state === "closed") return lang === "ko" ? "마감" : "Closed";
  return lang === "ko" ? "진행 중" : "Open";
}

export function SearchForm({
  inputValue,
  lang,
  onInputValueChange,
  onSubmit,
  onSearchByChange,
  searchBy,
  mobileFilter,
}: {
  inputValue: string;
  lang: string;
  onInputValueChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onSearchByChange: (value: "title" | "title_content") => void;
  searchBy: "title" | "title_content";
  mobileFilter?: ReactNode;
}) {
  const isMobile = useMediaQuery("(max-width: 767px)");
  if (isMobile) return <form onSubmit={onSubmit} className="mobile-filter-toolbar mobile-search-page-form">
    <PageSearchField ariaLabel={lang === "ko" ? "통합검색" : "Site search"} className="!w-full min-w-0 flex-1" value={inputValue} onChange={onInputValueChange} onClear={() => onInputValueChange("")} placeholder={lang === "ko" ? "검색어를 입력하세요" : "Enter a search term"} />
    {mobileFilter}
  </form>;
  return (
    <form
      onSubmit={onSubmit}
      className="rounded-lg border border-card-border-subtle bg-white p-3"
    >
      <div className="search-form-controls grid grid-cols-[minmax(0,1fr)_auto] gap-2 md:flex md:gap-3">
        <PageSearchField
          ariaLabel={lang === "ko" ? "통합검색" : "Site search"}
          className="col-start-1 row-start-1 !w-full min-w-0 md:order-1 md:!w-auto md:!flex-1"
          value={inputValue}
          onChange={onInputValueChange}
          onClear={() => onInputValueChange("")}
          placeholder={lang === "ko" ? "검색어를 입력하세요" : "Enter a search term"}
        />
        <div className="col-span-2 row-start-2 flex min-w-0 gap-2 md:order-2 md:w-36">
        <SelectDropdown
          ariaLabel={lang === "ko" ? "검색 범위" : "Search scope"}
          className="min-w-0 flex-1 md:w-36"
          value={searchBy}
          onChange={(value) => onSearchByChange(value as "title" | "title_content")}
          options={[
            { value: "title_content", label: lang === "ko" ? "제목+내용" : "Title + content" },
            { value: "title", label: lang === "ko" ? "제목" : "Title" },
          ]}
          buttonClassName="text-sm font-normal"
          optionClassName="text-sm !font-normal"
        />
        {mobileFilter ? <div className="min-w-0 flex-1 md:hidden">{mobileFilter}</div> : null}
        </div>
        <PageActionButton type="submit" tone="primary" className="col-start-2 row-start-1 px-5 md:order-3">
          {lang === "ko" ? "검색" : "Search"}
        </PageActionButton>
      </div>
    </form>
  );
}

export function MobileSearchFilters({ searchBy, filter, counts, lang, onApply }: {
  searchBy: "title" | "title_content"; filter: SearchFilter;
  counts: Record<SearchFilter, number>; lang: string;
  onApply: (scope: "title" | "title_content", kind: SearchFilter) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState({ scope: searchBy, kind: filter });
  const kinds: Array<{ value: SearchFilter; label: string }> = [
    { value: "all", label: lang === "ko" ? "전체" : "All" },
    { value: "board", label: lang === "ko" ? "게시판" : "Board" },
    { value: "faq", label: "FAQ" },
    { value: "event", label: lang === "ko" ? "행사" : "Events" },
    { value: "survey", label: lang === "ko" ? "설문" : "Surveys" },
    { value: "vote", label: lang === "ko" ? "투표" : "Votes" },
  ];
  return <><MobileFilterButton open={open} active={filter !== "all" || searchBy !== "title_content"} label={lang === "ko" ? "필터" : "Filters"} onClick={() => { setDraft({ scope: searchBy, kind: filter }); setOpen(true); }} />
    <FilterSheet className="mobile-filter-sheet" open={open} onClose={() => setOpen(false)} title={lang === "ko" ? "검색 필터" : "Search filters"} closeLabel={lang === "ko" ? "필터 닫기" : "Close filters"} footer={<MobileFilterActions lang={lang} onReset={() => setDraft({ scope: "title_content", kind: "all" })} onApply={() => { onApply(draft.scope, draft.kind); setOpen(false); }} />}>
      <fieldset className="mobile-filter-fieldset"><legend>{lang === "ko" ? "검색 범위" : "Search scope"}</legend>{(["title_content", "title"] as const).map(scope => <label key={scope} className="mobile-filter-option"><input type="radio" name="mobile-search-scope" checked={draft.scope === scope} onChange={() => setDraft(previous => ({ ...previous, scope }))} /><span>{scope === "title" ? (lang === "ko" ? "제목" : "Title") : (lang === "ko" ? "제목 + 내용" : "Title + content")}</span></label>)}</fieldset>
      <fieldset className="mobile-filter-fieldset"><legend>{lang === "ko" ? "결과 종류" : "Result type"}</legend>{kinds.map(kind => <label key={kind.value} className="mobile-filter-option"><input type="radio" name="mobile-search-kind" checked={draft.kind === kind.value} onChange={() => setDraft(previous => ({ ...previous, kind: kind.value }))} /><span>{kind.label}</span><span className="ml-auto text-xs tabular-nums text-slate-400">{counts[kind.value]}</span></label>)}</fieldset>
    </FilterSheet>
  </>;
}

export function SearchFilterTabs({
  partialErrors,
  activeFilter,
  boardCount,
  eventCount,
  faqCount,
  lang,
  onFilterChange,
  surveyCount,
  totalCount,
  voteCount,
  visible,
  mode = "desktop",
}: {
  partialErrors: PartialSearchKind[];
  activeFilter: SearchFilter;
  boardCount: number;
  eventCount: number;
  faqCount: number;
  lang: string;
  onFilterChange: (filter: SearchFilter) => void;
  surveyCount: number;
  totalCount: number;
  voteCount: number;
  visible: boolean;
  mode?: "mobile" | "desktop";
}) {
  if (!visible) return null;

  const tabs: Array<{ count: number; filter: SearchFilter; label: string }> = [
    { count: totalCount, filter: "all", label: lang === "ko" ? "전체" : "All" },
    { count: boardCount, filter: "board", label: lang === "ko" ? "게시판" : "Board" },
    { count: faqCount, filter: "faq", label: "FAQ" },
    { count: eventCount, filter: "event", label: lang === "ko" ? "행사" : "Events" },
    {
      count: surveyCount,
      filter: "survey",
      label: lang === "ko" ? "설문" : "Surveys",
    },
    { count: voteCount, filter: "vote", label: lang === "ko" ? "투표" : "Votes" },
  ];

  if (mode === "mobile") return (
      <MobileSectionSelector
        ariaLabel={lang === "ko" ? "검색 결과 필터 선택" : "Select search result filter"}
        closeLabel={lang === "ko" ? "검색 결과 필터 닫기" : "Close search result filters"}
        onChange={(value) => onFilterChange(value as SearchFilter)}
        options={tabs.map((tab) => ({
          label: `${tab.label} ${partialErrors.some(kind => kind === tab.filter) ? "—" : tab.count}`,
          value: tab.filter,
        }))}
        title={lang === "ko" ? "검색 결과 필터" : "Search result filters"}
        value={activeFilter}
      />
  );
  return (
      <PageTabs
        variant="trackless"
        aria-label={lang === "ko" ? "검색 결과 필터" : "Search result filters"}
        className="hidden md:inline-flex"
      >
        {tabs.map((tab) => (
          <PageTabButton
            key={tab.filter}
            active={activeFilter === tab.filter}
            onClick={() => onFilterChange(tab.filter)}
            className="!h-9 !min-h-9 gap-1.5 px-2.5 text-[length:var(--ui-text-body-sm-size)]"
          >
            <span>{tab.label}</span>
            <span className="tabular-nums text-slate-400">{partialErrors.some(kind => kind === tab.filter) ? "—" : tab.count}</span>
          </PageTabButton>
        ))}
      </PageTabs>
  );
}

export function SearchStatus({
  lang,
  loading,
  error,
  query,
  totalCount,
}: {
  lang: string;
  loading: boolean;
  error: string | null;
  query: string;
  totalCount: number;
}) {
  if (!query) {
    return null;
  }

  return (
    <div className="flex items-center justify-between gap-4 px-1 text-sm font-normal text-slate-500">
      <span>
        {lang === "ko" ? (
          <>
            <span className="md:hidden">&quot;{query}&quot;</span><span className="hidden md:inline"><HighlightedText value={`"${query}"`} query={query} /></span> 검색 결과
          </>
        ) : (
          <>Results for &quot;{query}&quot;</>
        )}
      </span>
      {!loading && !error ? <span className="hidden md:inline">{lang === "ko" ? `표시된 결과 ${totalCount}건` : `${totalCount} results shown`}</span> : null}
    </div>
  );
}

export function SearchResults({
  partialErrors, retryingPart, onRetryPart,
  more, loadingMore, moreError, onLoadMore,
  aboutResults,
  boardById,
  boardArticles,
  calendarEvents,
  error,
  eventArticles,
  faqArticles,
  filter,
  lang,
  loading,
  onRetry,
  onReset,
  query,
  surveys,
  totalCount,
  votes,
}: {
  partialErrors: PartialSearchKind[];
  retryingPart: PartialSearchKind | null;
  onRetryPart: (kind: PartialSearchKind) => Promise<void>;
  more: { event: boolean; survey: boolean };
  loadingMore: "event" | "survey" | null;
  moreError: string | null;
  onLoadMore: (kind: "event" | "survey") => Promise<void>;
  aboutResults: AboutSearchItem[];
  boardById: Map<number, BoardSummary>;
  boardArticles: ArticleListItem[];
  calendarEvents: PublicCalendarEventItem[];
  error: string | null;
  eventArticles: ArticleListItem[];
  faqArticles: ArticleListItem[];
  filter: SearchFilter;
  lang: string;
  loading: boolean;
  onRetry?: () => void;
  onReset: () => void;
  query: string;
  surveys: PublicSurveyRecord[];
  totalCount: number;
  votes: VoteRecord[];
}) {
  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-10 text-sm font-normal text-slate-400">
        <Loader2 className="h-4 w-4 animate-spin text-kaist-darkgreen" />
        <span>{lang === "ko" ? "검색 중..." : "Searching..."}</span>
      </div>
    );
  }

  if (error) {
    return (
      <ListState
        role="alert"
        icon={WifiOff}
        title={lang === "ko" ? "검색 결과를 불러오지 못했습니다" : "Could not load search results"}
        description={lang === "ko" ? "일시적인 오류가 발생했습니다. 잠시 후 다시 시도해 주세요." : "A temporary error occurred. Please try again shortly."}
        action={onRetry ? <ListStateAction icon={RefreshCw} onClick={onRetry}>
          {lang === "ko" ? "다시 시도" : "Try again"}
        </ListStateAction> : undefined}
      />
    );
  }

  const visibleCount =
    filter === "all"
      ? totalCount
      : filter === "board"
        ? boardArticles.length
        : filter === "faq"
          ? faqArticles.length
          : filter === "event"
            ? eventArticles.length + calendarEvents.length
            : filter === "survey"
              ? surveys.length
              : votes.length;

  const visibleErrors = partialErrors.filter(kind => filter === "all" || filter === kind);
  if (query && visibleCount === 0 && visibleErrors.length === 0) {
    return (
      <ListState
        icon={SearchX}
        title={lang === "ko" ? "검색 결과가 없습니다" : "No results found"}
        description={lang === "ko" ? "입력하신 키워드가 정확한지 확인하거나, 다른 검색어로 다시 시도해 보세요." : "Check your spelling or try searching with a different keyword."}
        action={<ListStateAction icon={RotateCcw} onClick={onReset}>
          {lang === "ko" ? "검색어 초기화" : "Clear search"}
        </ListStateAction>}
      />
    );
  }

  const showAll = filter === "all";
  return (
    <div className="space-y-9">
      {visibleErrors.map(kind => <ListState key={kind} role="alert" icon={WifiOff}
        title={lang === "ko" ? `${kind === "faq" ? "FAQ" : "투표"} 검색 결과를 불러오지 못했습니다` : `Could not load ${kind === "faq" ? "FAQ" : "vote"} results`}
        description={lang === "ko" ? "일시적인 오류가 발생했습니다. 잠시 후 다시 시도해 주세요." : "A temporary error occurred. Please try again shortly."}
        action={<ListStateAction icon={RefreshCw} disabled={retryingPart !== null} loading={retryingPart === kind} onClick={() => void onRetryPart(kind)}>
          {lang === "ko" ? "다시 시도" : "Try again"}
        </ListStateAction>}
      />)}
      {filter === "board" || showAll ? (
        <ArticleResults articles={boardArticles} boardById={boardById} lang={lang} query={query} />
      ) : null}
      {filter === "faq" || showAll ? (
        <FaqResults articles={faqArticles} lang={lang} query={query} />
      ) : null}
      {filter === "event" || showAll ? (
        <>
          <EventResults articles={eventArticles} lang={lang} query={query} />
          {more.event && <Button variant="ghost" disabled={loadingMore !== null} onClick={() => void onLoadMore("event")}>{lang === "ko" ? "행사 결과 더보기" : "Show more events"}</Button>}
          <CalendarResults events={calendarEvents} lang={lang} query={query} />
        </>
      ) : null}
      {filter === "survey" || showAll ? (
        <><SurveyResults lang={lang} query={query} surveys={surveys} />{more.survey && <Button variant="ghost" disabled={loadingMore !== null} onClick={() => void onLoadMore("survey")}>{lang === "ko" ? "설문 결과 더보기" : "Show more surveys"}</Button>}</>
      ) : null}
      {filter === "vote" || showAll ? (
        <VoteResults lang={lang} query={query} votes={votes} />
      ) : null}
      {moreError && <p role="alert" className="text-sm text-rose-600">{moreError}</p>}
      {showAll ? <AboutResults items={aboutResults} lang={lang} query={query} /> : null}
    </div>
  );
}

function SectionShell({
  children,
  count,
  title,
}: {
  children: ReactNode;
  count: number;
  title: string;
}) {
  if (count === 0) return null;

  return (
    <section>
      <h2 className="mb-3 flex items-baseline gap-2 text-[length:var(--ui-text-section-size)] font-semibold text-slate-900">
        <span>{title}</span>
        <span className="text-xs font-normal tabular-nums text-slate-400">{count}</span>
      </h2>
      <div className="border-t border-slate-200">{children}</div>
    </section>
  );
}

function ArticleResults({
  articles,
  boardById,
  lang,
  query,
}: {
  articles: ArticleListItem[];
  boardById: Map<number, BoardSummary>;
  lang: string;
  query: string;
}) {
  const isMobile = useMediaQuery("(max-width: 767px)");
  return (
    <SectionShell count={articles.length} title={lang === "ko" ? "게시판" : "Board"}>
      {articles.map((article) => {
        const board = boardById.get(article.boardId);
        const boardCode = article.boardCode ?? board?.code ?? "notice";
        const title = lang === "ko" ? article.titleKo : article.titleEn || article.titleKo;
        const snippet = getSnippet(
          matchingSnippet(article.snippetKo, article.snippetEn, article.titleKo, article.titleEn, query, lang),
          query,
          isMobile,
        );

        return (
          <SearchLink key={article.articleId} to={`/board/${boardCode}/${article.articleId}`}>
            <p className="line-clamp-2 break-words text-sm font-medium text-slate-900">
              <HighlightedText value={title} query={query} />
            </p>
            {snippet ? <Snippet value={snippet} query={query} /> : null}
            <p className="mt-1 flex items-center gap-2 text-xs font-normal text-slate-400">
              <span>{getBoardLabelFromMetadata(board, boardCode, lang)}</span>
              <span>·</span>
              <span>{formatDate(article.postedAt, lang)}</span>
            </p>
          </SearchLink>
        );
      })}
    </SectionShell>
  );
}

function EventResults({
  articles,
  lang,
  query,
}: {
  articles: ArticleListItem[];
  lang: string;
  query: string;
}) {
  const isMobile = useMediaQuery("(max-width: 767px)");
  return (
    <SectionShell count={articles.length} title={lang === "ko" ? "행사" : "Events"}>
      {articles.map((article) => {
        const start = formatDate(article.eventStartDate ?? article.postedAt, lang);
        const end = article.eventEndDate ? formatDate(article.eventEndDate, lang) : "";
        const period = end && end !== start ? `${start} ～ ${end}` : start;
        const description = matchingSnippet(article.eventDescriptionKo, article.eventDescriptionEn, article.titleKo, article.titleEn, query, lang);
        const title = lang === "ko" ? article.titleKo : article.titleEn || article.titleKo;
        const snippet = getSnippet(description, query, isMobile);

        return (
          <SearchLink key={article.articleId} to={`/events/${article.articleId}`}>
            <p className="line-clamp-2 break-words text-sm font-medium text-slate-900">
              <HighlightedText value={title} query={query} />
            </p>
            {snippet ? <Snippet value={snippet} query={query} /> : null}
            <p className="mt-1 flex items-center gap-2 text-xs font-normal text-slate-400">
              <span>{period}</span>
              <span>·</span>
              <span>{lang === "ko" ? "행사 게시글" : "Event post"}</span>
            </p>
          </SearchLink>
        );
      })}
    </SectionShell>
  );
}

function CalendarResults({
  events,
  lang,
  query,
}: {
  events: PublicCalendarEventItem[];
  lang: string;
  query: string;
}) {
  return (
    <SectionShell count={events.length} title={lang === "ko" ? "일정" : "Calendar"}>
      {events.map((event) => {
        const start = event.startAt ?? event.date;
        const end = event.endAt && event.endAt !== start ? formatDate(event.endAt, lang) : "";
        const period = end ? `${formatDate(start, lang)} ～ ${end}` : formatDate(start, lang);
        const title = lang === "ko" ? event.titleKo : event.titleEn || event.titleKo;
        const href = event.articleId
          ? `/events/${event.articleId}`
          : event.surveyId
            ? `/survey/${event.surveyId}`
            : `/calendar?selected=${encodeURIComponent(event.date)}`;

        return (
          <SearchLink key={`${event.sourceType}-${event.id}`} to={href}>
            <p className="line-clamp-2 break-words text-sm font-medium text-slate-900">
              <HighlightedText value={title} query={query} />
            </p>
            {event.location ? <Snippet value={event.location} query={query} /> : null}
            <p className="mt-1 flex items-center gap-2 text-xs font-normal text-slate-400">
              <span>{period}</span>
              <span>·</span>
              <span>
                {event.category === "HOLIDAY"
                  ? lang === "ko" ? "공휴일" : "Public holiday"
                  : event.sourceType === "KAIST_ACADEMIC"
                    ? lang === "ko" ? "KAIST 학사일정" : "KAIST Academic"
                    : lang === "ko" ? "학생회 일정" : "Council calendar"}
              </span>
            </p>
          </SearchLink>
        );
      })}
    </SectionShell>
  );
}

function SurveyResults({
  lang,
  query,
  surveys,
}: {
  lang: string;
  query: string;
  surveys: PublicSurveyRecord[];
}) {
  const isMobile = useMediaQuery("(max-width: 767px)");
  return (
    <SectionShell count={surveys.length} title={lang === "ko" ? "설문" : "Surveys"}>
      {surveys.map((survey) => {
        const title = lang === "ko" ? survey.titleKo : survey.titleEn || survey.titleKo;
        const description = matchingSnippet(survey.descriptionKo, survey.descriptionEn, survey.titleKo, survey.titleEn, query, lang);
        const snippet = getSnippet(description, query, isMobile);

        return (
          <SearchLink key={survey.id} to={`/survey/${survey.id}`}>
            <div className="mb-1 flex flex-wrap items-center gap-1.5">
              <span className="text-[length:var(--ui-text-caption-size)] font-medium text-kaist-darkgreen">{getSurveyKindLabel(survey.kind, lang)}</span>
              <span className="text-[length:var(--ui-text-caption-size)] font-normal text-slate-400">· {getSurveyStateLabel(survey.computedState, lang)}</span>
            </div>
            <p className="line-clamp-2 break-words text-sm font-medium text-slate-900">
              <HighlightedText value={title} query={query} />
            </p>
            {snippet ? <Snippet value={snippet} query={query} /> : null}
          </SearchLink>
        );
      })}
    </SectionShell>
  );
}

function FaqResults({
  articles,
  lang,
  query,
}: {
  articles: ArticleListItem[];
  lang: string;
  query: string;
}) {
  const isMobile = useMediaQuery("(max-width: 767px)");
  return (
    <SectionShell count={articles.length} title="FAQ">
      {articles.map((article) => {
        const title = lang === "ko" ? article.titleKo : article.titleEn || article.titleKo;
        const snippet = getSnippet(
          matchingSnippet(article.snippetKo, article.snippetEn, article.titleKo, article.titleEn, query, lang),
          query,
          isMobile,
        );

        return (
          <SearchLink key={article.articleId} to={`/board/faq/${article.articleId}`}>
            <p className="line-clamp-2 break-words text-sm font-medium text-slate-900">
              <HighlightedText value={title} query={query} />
            </p>
            {snippet ? <Snippet value={snippet} query={query} /> : null}
            <p className="mt-1 flex items-center gap-2 text-xs font-normal text-slate-400">
              <span>FAQ</span>
              <span>·</span>
              <span>{formatDate(article.postedAt, lang)}</span>
            </p>
          </SearchLink>
        );
      })}
    </SectionShell>
  );
}

function VoteResults({
  lang,
  query,
  votes,
}: {
  lang: string;
  query: string;
  votes: VoteRecord[];
}) {
  return (
    <SectionShell count={votes.length} title={lang === "ko" ? "투표" : "Votes"}>
      {votes.map((vote) => {
        const title = lang === "ko" ? vote.titleKo : vote.titleEn || vote.titleKo;
        const description = matchingSnippet(vote.descriptionKo, vote.descriptionEn, vote.titleKo, vote.titleEn, query, lang);
        const period = `${formatDate(vote.startsAt, lang)} ～ ${formatDate(vote.endsAt, lang)}`;
        const status = vote.status === "PUBLISHED"
          ? lang === "ko" ? "진행 중" : "Open"
          : vote.status === "CLOSED" || vote.status === "TALLIED"
            ? lang === "ko" ? "마감" : "Closed"
            : lang === "ko" ? "시작 예정" : "Upcoming";

        return (
          <SearchLink key={vote.id} to={`/votes/${vote.id}`}>
            <p className="line-clamp-2 break-words text-sm font-medium text-slate-900">
              <HighlightedText value={title} query={query} />
            </p>
            {description ? <Snippet value={description} query={query} /> : null}
            <p className="mt-1 flex items-center gap-2 text-xs font-normal text-slate-400">
              <span>{status}</span>
              <span>·</span>
              <span>{period}</span>
            </p>
          </SearchLink>
        );
      })}
    </SectionShell>
  );
}

function AboutResults({
  items,
  lang,
  query,
}: {
  items: AboutSearchItem[];
  lang: string;
  query: string;
}) {
  return (
    <SectionShell count={items.length} title={lang === "ko" ? "소개" : "About"}>
      {items.map((item) => {
        const title = lang === "ko" ? item.titleKo : item.titleEn;
        const description = matchingSnippet(item.descriptionKo, item.descriptionEn, item.titleKo, item.titleEn, query, lang) || "";

        return (
          <SearchLink key={item.id} to={item.href}>
            <p className="line-clamp-2 break-words text-sm font-medium text-slate-900">
              <HighlightedText value={title} query={query} />
            </p>
            <Snippet value={description} query={query} />
          </SearchLink>
        );
      })}
    </SectionShell>
  );
}

function SearchLink({ children, to }: { children: ReactNode; to: string }) {
  return (
    <Link
      to={to}
      className="group flex items-start justify-between gap-4 border-b border-slate-100 px-1 py-4 transition-colors hover:bg-slate-50"
    >
      <div className="min-w-0 flex-1">{children}</div>
      <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-slate-300 transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}

function Snippet({ value, query }: { value: string; query: string }) {
  const isMobile = useMediaQuery("(max-width: 767px)");
  return (
    <p className="search-result-snippet mt-1 line-clamp-2 text-[length:var(--ui-text-body-sm-size)] font-normal leading-5 text-slate-500">
      <span className="md:hidden">{isMobile ? getSnippet(value, query, true) : value}</span><span className="hidden md:inline"><HighlightedText value={value} query={query} /></span>
    </p>
  );
}

function getSnippet(value: string | null | undefined, query: string, mobile = false) {
  const text = stripRichText(mobile ? value?.replace(/\r?\n/g, " ").replace(/(<\/(?:p|div|li|h[1-6]|tr|blockquote)>|<br\s*\/?>)/gi, "$1 ") : value);
  if (!text) return "";

  const normalizedText = text.toLocaleLowerCase();
  const normalizedQuery = query.toLocaleLowerCase();
  const matchIndex = normalizedQuery ? normalizedText.indexOf(normalizedQuery) : -1;
  const maxLength = 180;
  if (text.length <= maxLength || matchIndex < 0) return text.slice(0, maxLength);

  let start = Math.max(0, matchIndex - 42);
  if (mobile && start > 0) {
    const prefix = text.slice(start, matchIndex);
    const boundaries = [...prefix.matchAll(/[.!?。！？]\s+/g)];
    const boundary = boundaries.at(-1);
    if (boundary) start += boundary.index + boundary[0].length;
    else if (/\S/.test(text[start - 1])) {
      const space = prefix.indexOf(" ");
      if (space >= 0) start += space + 1;
    }
  }
  const end = Math.min(text.length, start + maxLength);
  return `${start > 0 ? "…" : ""}${text.slice(start, end)}${end < text.length ? "…" : ""}`;
}

function HighlightedText({ value, query }: { value: string; query: string }) {
  if (!query) return value;

  const normalizedValue = value.toLocaleLowerCase();
  const normalizedQuery = query.toLocaleLowerCase();
  const nodes: ReactNode[] = [];
  let cursor = 0;
  let matchIndex = normalizedValue.indexOf(normalizedQuery, cursor);

  while (matchIndex >= 0) {
    if (matchIndex > cursor) nodes.push(value.slice(cursor, matchIndex));
    nodes.push(
      <mark
        key={`${matchIndex}-${cursor}`}
        className="search-keyword-highlight rounded-sm bg-emerald-50 px-0.5 font-medium text-emerald-700"
      >
        {value.slice(matchIndex, matchIndex + query.length)}
      </mark>,
    );
    cursor = matchIndex + query.length;
    matchIndex = normalizedValue.indexOf(normalizedQuery, cursor);
  }

  if (cursor === 0) return value;
  if (cursor < value.length) nodes.push(value.slice(cursor));
  return nodes;
}

function matchingSnippet(ko: string | null | undefined, en: string | null | undefined, titleKo: string | null | undefined, titleEn: string | null | undefined, query: string, lang: string) {
  const needle = query.trim().toLocaleLowerCase();
  const matches = (value: string | null | undefined) => Boolean(needle && stripRichText(value).toLocaleLowerCase().includes(needle));
  if (matches(en) && !matches(ko)) return en;
  if (matches(titleEn) && !matches(titleKo) && en) return en;
  if (matches(ko) && !matches(en)) return ko;
  return lang === "ko" ? ko : en || ko;
}
