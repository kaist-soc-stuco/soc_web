import type { FormEvent, ReactNode } from "react";
import { Link } from "react-router-dom";
import type {
  ArticleListItem,
  BoardSummary,
  PublicCalendarEventItem,
  SurveyRecord,
  VoteRecord,
} from "@soc/contracts";
import { ArrowRight, Loader2 } from "lucide-react";

import { PageActionButton, PageSearchField, PageTabButton, PageTabs } from "@/components/ui/page-layout";
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
}: {
  inputValue: string;
  lang: string;
  onInputValueChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onSearchByChange: (value: "title" | "title_content") => void;
  searchBy: "title" | "title_content";
}) {
  return (
    <form
      onSubmit={onSubmit}
      className="rounded-lg border border-card-border-subtle bg-white p-3"
    >
      <div className="flex flex-col gap-3 sm:flex-row">
        <PageSearchField
          ariaLabel={lang === "ko" ? "통합검색" : "Site search"}
          className="lg:w-auto lg:flex-1"
          value={inputValue}
          onChange={onInputValueChange}
          onClear={() => onInputValueChange("")}
          placeholder={lang === "ko" ? "검색어를 입력하세요" : "Enter a search term"}
        />
        <SelectDropdown
          ariaLabel={lang === "ko" ? "검색 범위" : "Search scope"}
          className="w-full sm:w-36"
          value={searchBy}
          onChange={(value) => onSearchByChange(value as "title" | "title_content")}
          options={[
            { value: "title_content", label: lang === "ko" ? "제목+내용" : "Title + content" },
            { value: "title", label: lang === "ko" ? "제목" : "Title" },
          ]}
          buttonClassName="text-sm font-normal"
          optionClassName="text-sm !font-normal"
        />
        <PageActionButton type="submit" tone="primary" className="px-5">
          {lang === "ko" ? "검색" : "Search"}
        </PageActionButton>
      </div>
    </form>
  );
}

export function SearchFilterTabs({
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
}: {
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

  return (
    <PageTabs
      variant="trackless"
      aria-label={lang === "ko" ? "검색 결과 필터" : "Search result filters"}
    >
      {tabs.map((tab) => (
        <PageTabButton
          key={tab.filter}
          active={activeFilter === tab.filter}
          onClick={() => onFilterChange(tab.filter)}
          className="!h-9 !min-h-9 gap-1.5 px-2.5 text-[length:var(--ui-text-body-sm-size)]"
        >
          <span>{tab.label}</span>
          <span className="tabular-nums text-slate-400">{tab.count}</span>
        </PageTabButton>
      ))}
    </PageTabs>
  );
}

export function SearchStatus({
  lang,
  loading,
  query,
  totalCount,
}: {
  lang: string;
  loading: boolean;
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
            <HighlightedText value={`"${query}"`} query={query} /> 검색 결과
          </>
        ) : (
          <>Results for &quot;{query}&quot;</>
        )}
      </span>
      {!loading ? <span>{lang === "ko" ? `총 ${totalCount}건` : `${totalCount} results`}</span> : null}
    </div>
  );
}

export function SearchResults({
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
  query,
  surveys,
  totalCount,
  votes,
}: {
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
  query: string;
  surveys: SurveyRecord[];
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
    return <p className="px-1 py-4 text-sm font-normal text-red-600">{error}</p>;
  }

  if (query && totalCount === 0) {
    return (
      <p className="px-1 py-10 text-center text-sm font-normal text-slate-500">
        {lang === "ko" ? "검색 결과가 없습니다." : "No results found."}
      </p>
    );
  }

  const showAll = filter === "all";
  return (
    <div className="space-y-9">
      {filter === "board" || showAll ? (
        <ArticleResults articles={boardArticles} boardById={boardById} lang={lang} query={query} />
      ) : null}
      {filter === "faq" || showAll ? (
        <FaqResults articles={faqArticles} lang={lang} query={query} />
      ) : null}
      {filter === "event" || showAll ? (
        <>
          <EventResults articles={eventArticles} lang={lang} query={query} />
          <CalendarResults events={calendarEvents} lang={lang} query={query} />
        </>
      ) : null}
      {filter === "survey" || showAll ? (
        <SurveyResults lang={lang} query={query} surveys={surveys} />
      ) : null}
      {filter === "vote" || showAll ? (
        <VoteResults lang={lang} query={query} votes={votes} />
      ) : null}
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
  return (
    <SectionShell count={articles.length} title={lang === "ko" ? "게시판" : "Board"}>
      {articles.map((article) => {
        const board = boardById.get(article.boardId);
        const boardCode = article.boardCode ?? board?.code ?? "공지";
        const title = lang === "ko" ? article.titleKo : article.titleEn || article.titleKo;
        const snippet = getSnippet(
          lang === "ko" ? article.snippetKo : article.snippetEn || article.snippetKo,
          query,
        );

        return (
          <SearchLink key={article.articleId} to={`/board/${boardCode}/${article.articleId}`}>
            <p className="truncate text-sm font-medium text-slate-900">
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
  return (
    <SectionShell count={articles.length} title={lang === "ko" ? "행사" : "Events"}>
      {articles.map((article) => {
        const start = formatDate(article.eventStartDate ?? article.postedAt, lang);
        const end = article.eventEndDate ? formatDate(article.eventEndDate, lang) : "";
        const period = end && end !== start ? `${start} ～ ${end}` : start;
        const description = lang === "ko" ? article.eventDescriptionKo : article.eventDescriptionEn || article.eventDescriptionKo;
        const title = lang === "ko" ? article.titleKo : article.titleEn || article.titleKo;
        const snippet = getSnippet(description, query);

        return (
          <SearchLink key={article.articleId} to={`/events/${article.articleId}`}>
            <p className="truncate text-sm font-medium text-slate-900">
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
            <p className="truncate text-sm font-medium text-slate-900">
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
  surveys: SurveyRecord[];
}) {
  return (
    <SectionShell count={surveys.length} title={lang === "ko" ? "설문" : "Surveys"}>
      {surveys.map((survey) => {
        const title = lang === "ko" ? survey.titleKo : survey.titleEn || survey.titleKo;
        const description = lang === "ko" ? survey.descriptionKo : survey.descriptionEn || survey.descriptionKo;
        const snippet = getSnippet(description, query);

        return (
          <SearchLink key={survey.id} to={`/survey/${survey.id}`}>
            <div className="mb-1 flex flex-wrap items-center gap-1.5">
              <span className="text-[length:var(--ui-text-caption-size)] font-medium text-kaist-darkgreen">{getSurveyKindLabel(survey.kind, lang)}</span>
              <span className="text-[length:var(--ui-text-caption-size)] font-normal text-slate-400">· {getSurveyStateLabel(survey.computedState, lang)}</span>
            </div>
            <p className="truncate text-sm font-medium text-slate-900">
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
  return (
    <SectionShell count={articles.length} title="FAQ">
      {articles.map((article) => {
        const title = lang === "ko" ? article.titleKo : article.titleEn || article.titleKo;
        const snippet = getSnippet(
          lang === "ko" ? article.snippetKo : article.snippetEn || article.snippetKo,
          query,
        );

        return (
          <SearchLink key={article.articleId} to={`/board/faq/${article.articleId}`}>
            <p className="truncate text-sm font-medium text-slate-900">
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
        const description = lang === "ko" ? vote.descriptionKo : vote.descriptionEn || vote.descriptionKo;
        const period = `${formatDate(vote.startsAt, lang)} ～ ${formatDate(vote.endsAt, lang)}`;
        const status = vote.status === "PUBLISHED"
          ? lang === "ko" ? "진행 중" : "Open"
          : vote.status === "CLOSED" || vote.status === "TALLIED"
            ? lang === "ko" ? "마감" : "Closed"
            : lang === "ko" ? "시작 예정" : "Upcoming";

        return (
          <SearchLink key={vote.id} to={`/votes/${vote.id}`}>
            <p className="truncate text-sm font-medium text-slate-900">
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
        const description = lang === "ko" ? item.descriptionKo : item.descriptionEn;

        return (
          <SearchLink key={item.id} to={item.href}>
            <p className="truncate text-sm font-medium text-slate-900">
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
  return (
    <p className="mt-1 line-clamp-2 text-[length:var(--ui-text-body-sm-size)] font-normal leading-5 text-slate-500">
      <HighlightedText value={value} query={query} />
    </p>
  );
}

function getSnippet(value: string | null | undefined, query: string) {
  const text = stripRichText(value);
  if (!text) return "";

  const normalizedText = text.toLocaleLowerCase();
  const normalizedQuery = query.toLocaleLowerCase();
  const matchIndex = normalizedQuery ? normalizedText.indexOf(normalizedQuery) : -1;
  const maxLength = 180;
  if (text.length <= maxLength || matchIndex < 0) return text.slice(0, maxLength);

  const start = Math.max(0, matchIndex - 42);
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
        className="rounded-sm bg-emerald-50 px-0.5 font-medium text-emerald-700"
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
