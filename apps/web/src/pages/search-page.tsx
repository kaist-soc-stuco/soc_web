import { Header } from "@/components/organisms/header";
import { PageHeader, PageShell } from "@/components/ui/page-layout";
import {
  SearchForm,
  SearchFilterTabs,
  SearchResults,
  SearchStatus,
} from "@/features/search/search-page-sections";
import { useSearchPageController } from "@/features/search/use-search-page-controller";

export function SearchPage() {
  const {
    aboutResults,
    boardById,
    boardArticles,
    calendarEvents,
    error,
    eventArticles,
    faqArticles,
    filter,
    handleSubmit,
    inputValue,
    lang,
    loading,
    query,
    setInputValue,
    setFilter,
    searchBy,
    setSearchBy,
    surveys,
    votes,
    totalCount,
  } = useSearchPageController();

  return (
    <PageShell>
      <Header />
      <PageHeader title={lang === "ko" ? "통합검색" : "Search"} />

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-5 px-4 py-8 md:px-8">
        <SearchForm
          inputValue={inputValue}
          lang={lang}
          onInputValueChange={setInputValue}
          onSubmit={handleSubmit}
          onSearchByChange={setSearchBy}
          searchBy={searchBy}
        />
        <SearchFilterTabs
          activeFilter={filter}
          boardCount={boardArticles.length}
          eventCount={eventArticles.length + calendarEvents.length}
          faqCount={faqArticles.length}
          lang={lang}
          onFilterChange={setFilter}
          surveyCount={surveys.length}
          totalCount={totalCount}
          voteCount={votes.length}
          visible={Boolean(query)}
        />
        <SearchStatus
          lang={lang}
          loading={loading}
          query={query}
          totalCount={totalCount}
        />
        <SearchResults
          aboutResults={aboutResults}
          boardById={boardById}
          boardArticles={boardArticles}
          calendarEvents={calendarEvents}
          error={error}
          eventArticles={eventArticles}
          faqArticles={faqArticles}
          filter={filter}
          lang={lang}
          loading={loading}
          query={query}
          surveys={surveys}
          totalCount={totalCount}
          votes={votes}
        />
      </main>

    </PageShell>
  );
}
