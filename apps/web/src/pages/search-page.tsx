import { PageContainer, PageHeader, PageMain, PageShell } from "@/components/ui/page-layout";
import {
  SearchForm,
  SearchFilterTabs,
  SearchResults,
  SearchStatus,
  MobileSearchFilters,
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
    retrySearch,
    resetSearch,
    query,
    setInputValue,
    setFilter,
    searchBy,
    setSearchBy,
    setSearchFilters,
    surveys,
    votes,
    totalCount,
    more, loadingMore, moreError, loadMore,
    partialErrors, retryingPart, retryPart,
  } = useSearchPageController();

  return (
    <PageShell className="mobile-white-page">

      <PageMain>
      <PageHeader title={lang === "ko" ? "통합검색" : "Search"} containerClassName="max-w-5xl" />

      <PageContainer className="mobile-search-results flex max-w-5xl flex-col gap-5 py-8">
        <SearchForm
          inputValue={inputValue}
          lang={lang}
          onInputValueChange={setInputValue}
          onSubmit={handleSubmit}
          onSearchByChange={setSearchBy}
          searchBy={searchBy}
          mobileFilter={<MobileSearchFilters searchBy={searchBy} filter={filter} lang={lang} onApply={setSearchFilters} counts={{ all: totalCount, board: boardArticles.length, event: eventArticles.length + calendarEvents.length, faq: faqArticles.length, survey: surveys.length, vote: votes.length }} />}
        />
        <SearchFilterTabs
          partialErrors={partialErrors}
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
          error={error}
          lang={lang}
          loading={loading}
          query={query}
          totalCount={totalCount}
        />
        <SearchResults
          partialErrors={partialErrors} retryingPart={retryingPart} onRetryPart={retryPart}
          more={more} loadingMore={loadingMore} moreError={moreError} onLoadMore={loadMore}
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
          onRetry={retrySearch}
          onReset={resetSearch}
          query={query}
          surveys={surveys}
          totalCount={totalCount}
          votes={votes}
        />
      </PageContainer>
      </PageMain>

    </PageShell>
  );
}
