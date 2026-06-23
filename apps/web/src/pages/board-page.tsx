import { Header } from "@/components/organisms/header";
import { Footer } from "@/components/organisms/footer";
import { PageHero } from "@/components/organisms/page-hero";
import {
  BoardArticleTable,
  BoardNavigationBar,
} from "@/features/board-list/board-page-sections";
import { useBoardPageController } from "@/features/board-list/use-board-page-controller";

export function BoardPage() {
  const {
    articles,
    boardByCode,
    boardDescription,
    boards,
    boardTitle,
    canWrite,
    category,
    currentPage,
    handlePageChange,
    handleSortChange,
    isArticleLoading,
    isFilterDropdownOpen,
    lang,
    period,
    postsPerPage,
    searchCriteria,
    searchQuery,
    setCurrentPage,
    setIsFilterDropdownOpen,
    setPeriod,
    setPostsPerPage,
    setSearchCriteria,
    setSearchQuery,
    sortBy,
    sortDirection,
    totalCount,
    totalPages,
    writeState,
  } = useBoardPageController();

  return (
    <div className="min-h-screen flex flex-col bg-[#fafafa]">
      <Header showLogo={true} />

      <main className="flex-1 w-full mx-auto pb-16">
        <PageHero
          title={boardTitle}
          description={boardDescription}
          variant="medium"
        />

        <BoardNavigationBar
          boards={boards}
          category={category}
          isFilterDropdownOpen={isFilterDropdownOpen}
          lang={lang}
          onCurrentPageChange={setCurrentPage}
          onFilterDropdownOpenChange={setIsFilterDropdownOpen}
          onPeriodChange={setPeriod}
          onSearchCriteriaChange={setSearchCriteria}
          onSearchQueryChange={setSearchQuery}
          period={period}
          searchCriteria={searchCriteria}
          searchQuery={searchQuery}
        />

        <BoardArticleTable
          articles={articles}
          boardByCode={boardByCode}
          canWrite={canWrite}
          category={category}
          currentPage={currentPage}
          isLoading={isArticleLoading}
          lang={lang}
          onPageChange={handlePageChange}
          onPostsPerPageChange={(value) => {
            setPostsPerPage(value);
            setCurrentPage(1);
          }}
          onSortChange={handleSortChange}
          postsPerPage={postsPerPage}
          sortBy={sortBy}
          sortDirection={sortDirection}
          totalCount={totalCount}
          totalPages={totalPages}
          writeState={writeState}
        />
      </main>

      <Footer />
    </div>
  );
}
