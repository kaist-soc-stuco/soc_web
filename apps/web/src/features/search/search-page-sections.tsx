import type { FormEvent, ReactNode } from "react";
import { Link } from "react-router-dom";
import type { ArticleListItem, BoardSummary, SurveyRecord } from "@soc/contracts";
import { isoToDate } from "@soc/shared";
import {
  ArrowRight,
  ClipboardList,
  FileText,
  Info,
  Loader2,
  Search,
} from "lucide-react";

import { getBoardLabelFromMetadata } from "@/lib/board-metadata";

import type { AboutSearchItem } from "./search-utils";

function formatDate(value: string) {
  const date = isoToDate(value);
  if (Number.isNaN(date.getTime())) return "";
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}.${mm}.${dd}`;
}

function getSurveyKindLabel(kind: string, lang: string) {
  if (kind === "VOTE") return lang === "ko" ? "투표" : "Vote";
  if (kind === "APPLICATION") {
    return lang === "ko" ? "신청" : "Application";
  }
  return lang === "ko" ? "설문" : "Survey";
}

function getSurveyStateLabel(state: string, lang: string) {
  if (state === "before_open") return lang === "ko" ? "시작 전" : "Upcoming";
  if (state === "closed") return lang === "ko" ? "마감" : "Closed";
  return lang === "ko" ? "진행 중" : "Open";
}

export function SearchForm({
  inputValue,
  lang,
  onInputValueChange,
  onSubmit,
}: {
  inputValue: string;
  lang: string;
  onInputValueChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <form
      onSubmit={onSubmit}
      className="rounded-2xl border border-card-border-subtle bg-white p-4 shadow-card"
    >
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative min-w-0 flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={inputValue}
            onChange={(event) => onInputValueChange(event.target.value)}
            className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-kaist-darkgreen focus:ring-2 focus:ring-kaist-darkgreen/10"
            placeholder={lang === "ko" ? "검색어를 입력하세요" : "Enter a search term"}
          />
        </div>
        <button
          type="submit"
          className="h-11 rounded-xl bg-kaist-darkgreen-main px-5 text-sm font-extrabold text-white transition-colors hover:bg-kaist-darkgreen"
        >
          {lang === "ko" ? "검색" : "Search"}
        </button>
      </div>
    </form>
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
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-5 py-8 text-center text-sm font-semibold text-slate-500">
        {lang === "ko"
          ? "검색어를 입력하면 게시판, 설문, 소개 결과가 함께 표시됩니다."
          : "Enter a query to search board posts, surveys, and about pages."}
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between px-1 text-sm font-bold text-slate-500">
      <span>{lang === "ko" ? `"${query}" 검색 결과` : `Results for "${query}"`}</span>
      {!loading && (
        <span>{lang === "ko" ? `총 ${totalCount}건` : `${totalCount} results`}</span>
      )}
    </div>
  );
}

export function SearchResults({
  aboutResults,
  articles,
  boardById,
  error,
  lang,
  loading,
  query,
  surveys,
  totalCount,
}: {
  aboutResults: AboutSearchItem[];
  articles: ArticleListItem[];
  boardById: Map<number, BoardSummary>;
  error: string | null;
  lang: string;
  loading: boolean;
  query: string;
  surveys: SurveyRecord[];
  totalCount: number;
}) {
  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-2xl border border-slate-100 bg-white py-12 text-sm font-bold text-slate-400 shadow-card">
        <Loader2 className="h-4 w-4 animate-spin text-kaist-darkgreen" />
        <span>{lang === "ko" ? "검색 중..." : "Searching..."}</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-100 bg-red-50 px-5 py-4 text-sm font-bold text-red-600">
        {error}
      </div>
    );
  }

  if (query && totalCount === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-5 py-12 text-center text-sm font-semibold text-slate-500">
        {lang === "ko" ? "검색 결과가 없습니다." : "No results found."}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <ArticleResults articles={articles} boardById={boardById} lang={lang} />
      <SurveyResults lang={lang} surveys={surveys} />
      <AboutResults items={aboutResults} lang={lang} />
    </div>
  );
}

function SectionShell({
  children,
  count,
  icon,
  title,
}: {
  children: ReactNode;
  count: number;
  icon: ReactNode;
  title: string;
}) {
  return (
    <section className="rounded-2xl border border-card-border-subtle bg-white p-5 shadow-card">
      <h2 className="mb-3 flex items-center gap-2 text-base font-extrabold text-slate-950">
        {icon}
        <span>{title}</span>
        <span className="text-xs font-bold text-slate-400">({count})</span>
      </h2>
      {children}
    </section>
  );
}

function ArticleResults({
  articles,
  boardById,
  lang,
}: {
  articles: ArticleListItem[];
  boardById: Map<number, BoardSummary>;
  lang: string;
}) {
  return (
    <SectionShell
      count={articles.length}
      icon={<FileText className="h-4 w-4 text-kaist-darkgreen" />}
      title={lang === "ko" ? "게시판" : "Board"}
    >
      {articles.length === 0 ? (
        <p className="py-5 text-sm font-semibold text-slate-400">
          {lang === "ko" ? "게시글 결과가 없습니다." : "No board posts found."}
        </p>
      ) : (
        <div className="divide-y divide-slate-100">
          {articles.map((article) => {
            const board = boardById.get(article.boardId);
            const boardCode = article.boardCode ?? board?.code ?? "공지";
            return (
              <SearchLink key={article.articleId} to={`/board/${boardCode}/${article.articleId}`}>
                <div className="min-w-0">
                  <p className="truncate text-sm font-extrabold text-slate-900 transition-colors group-hover:text-kaist-darkgreen">
                    {lang === "ko" ? article.titleKo : article.titleEn || article.titleKo}
                  </p>
                  <p className="mt-1 flex items-center gap-2 text-xs font-semibold text-slate-500">
                    <span>{getBoardLabelFromMetadata(board, boardCode, lang)}</span>
                    <span>·</span>
                    <span>{formatDate(article.postedAt)}</span>
                  </p>
                </div>
              </SearchLink>
            );
          })}
        </div>
      )}
    </SectionShell>
  );
}

function SurveyResults({
  lang,
  surveys,
}: {
  lang: string;
  surveys: SurveyRecord[];
}) {
  return (
    <SectionShell
      count={surveys.length}
      icon={<ClipboardList className="h-4 w-4 text-kaist-darkgreen" />}
      title={lang === "ko" ? "설문 / 투표" : "Surveys / Votes"}
    >
      {surveys.length === 0 ? (
        <p className="py-5 text-sm font-semibold text-slate-400">
          {lang === "ko" ? "설문 결과가 없습니다." : "No surveys found."}
        </p>
      ) : (
        <div className="divide-y divide-slate-100">
          {surveys.map((survey) => (
            <SearchLink key={survey.id} to={`/survey/${survey.id}`}>
              <div className="min-w-0">
                <div className="mb-1 flex flex-wrap items-center gap-1.5">
                  <span className="rounded-md bg-kaist-lightgreen/20 px-1.5 py-0.5 text-[10px] font-bold text-kaist-darkgreen">
                    {getSurveyKindLabel(survey.kind, lang)}
                  </span>
                  <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-500">
                    {getSurveyStateLabel(survey.computedState, lang)}
                  </span>
                </div>
                <p className="truncate text-sm font-extrabold text-slate-900 transition-colors group-hover:text-kaist-darkgreen">
                  {lang === "ko" ? survey.titleKo : survey.titleEn || survey.titleKo}
                </p>
                {(survey.descriptionKo || survey.descriptionEn) && (
                  <p className="mt-1 line-clamp-1 text-xs font-semibold text-slate-500">
                    {lang === "ko" ? survey.descriptionKo : survey.descriptionEn || survey.descriptionKo}
                  </p>
                )}
              </div>
            </SearchLink>
          ))}
        </div>
      )}
    </SectionShell>
  );
}

function AboutResults({
  items,
  lang,
}: {
  items: AboutSearchItem[];
  lang: string;
}) {
  return (
    <SectionShell
      count={items.length}
      icon={<Info className="h-4 w-4 text-kaist-darkgreen" />}
      title={lang === "ko" ? "소개" : "About"}
    >
      {items.length === 0 ? (
        <p className="py-5 text-sm font-semibold text-slate-400">
          {lang === "ko" ? "소개 결과가 없습니다." : "No about pages found."}
        </p>
      ) : (
        <div className="divide-y divide-slate-100">
          {items.map((item) => (
            <SearchLink key={item.id} to={item.href}>
              <div className="min-w-0">
                <p className="truncate text-sm font-extrabold text-slate-900 transition-colors group-hover:text-kaist-darkgreen">
                  {lang === "ko" ? item.titleKo : item.titleEn}
                </p>
                <p className="mt-1 line-clamp-1 text-xs font-semibold text-slate-500">
                  {lang === "ko" ? item.descriptionKo : item.descriptionEn}
                </p>
              </div>
            </SearchLink>
          ))}
        </div>
      )}
    </SectionShell>
  );
}

function SearchLink({
  children,
  to,
}: {
  children: ReactNode;
  to: string;
}) {
  return (
    <Link
      to={to}
      className="group flex items-center justify-between gap-4 py-3"
    >
      {children}
      <ArrowRight className="h-4 w-4 shrink-0 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-kaist-darkgreen" />
    </Link>
  );
}
