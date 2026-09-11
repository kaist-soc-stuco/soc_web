import { Header } from "@/components/organisms/header";
import { PageHeader, PageMain, PageShell } from "@/components/ui/page-layout";
import { NotFoundPage } from "@/pages/not-found-page";
import {
  BoardArticleTable,
  BoardCategoryNavigation,
  BoardDataControls,
} from "@/features/board-list/board-page-sections";
import { useBoardPageController } from "@/features/board-list/use-board-page-controller";

export function BoardPage() {
  const {
    articleError,
    articles,
    boardByCode,
    boards,
    boardTitle,
    canWrite,
    category,
    currentPage,
    handlePageChange,
    isBoardNotFound,
    isArticleLoading,
    retryArticles,
    renderedCategory,
    lang,
    postsPerPage,
    searchQuery,
    showInitialSkeleton,
    setCurrentPage,
    setPostsPerPage,
    setSearchQuery,
    totalCount,
    totalPages,
    writeState,
  } = useBoardPageController();

  if (isBoardNotFound) {
    return <NotFoundPage />;
  }

  return (
    <PageShell>
      <Header />

      <PageMain className="board-page-main">
        <PageHeader title={boardTitle} titleId="board-page-title" />

        <BoardCategoryNavigation
          boards={boards}
          category={category}
          lang={lang}
        />

        <BoardArticleTable
          toolbar={
            <BoardDataControls
              lang={lang}
              onCurrentPageChange={setCurrentPage}
              onSearchQueryChange={setSearchQuery}
              searchQuery={searchQuery}
              canWrite={canWrite}
              totalCount={totalCount}
              writeState={writeState}
            />
          }
          articles={articles}
          articleError={articleError}
          boardByCode={boardByCode}
          category={renderedCategory}
          currentPage={currentPage}
          isLoading={isArticleLoading}
          showInitialSkeleton={showInitialSkeleton}
          lang={lang}
          onPageChange={handlePageChange}
          onPostsPerPageChange={(value) => {
            setPostsPerPage(value);
            setCurrentPage(1);
          }}
          onRetry={retryArticles}
          postsPerPage={postsPerPage}
          totalCount={totalCount}
          totalPages={totalPages}
        />
      </PageMain>
    </PageShell>
  );
}
