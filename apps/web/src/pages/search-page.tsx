import { Footer } from "@/components/organisms/footer";
import { Header } from "@/components/organisms/header";
import { PageHero } from "@/components/organisms/page-hero";
import {
  SearchForm,
  SearchResults,
  SearchStatus,
} from "@/features/search/search-page-sections";
import { useSearchPageController } from "@/features/search/use-search-page-controller";

export function SearchPage() {
  const {
    aboutResults,
    articles,
    boardById,
    error,
    handleSubmit,
    inputValue,
    lang,
    loading,
    query,
    setInputValue,
    surveys,
    totalCount,
  } = useSearchPageController();

  return (
    <div className="flex min-h-screen flex-col bg-gray-50/50">
      <Header showLogo />
      <PageHero
        title={lang === "ko" ? "통합검색" : "Search"}
        variant="medium"
        description={
          lang === "ko"
            ? "게시글, 설문조사, 소개 페이지를 한 번에 검색합니다."
            : "Search board posts, surveys, and about pages together."
        }
      />

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-5 px-4 py-8 md:px-8">
        <SearchForm
          inputValue={inputValue}
          lang={lang}
          onInputValueChange={setInputValue}
          onSubmit={handleSubmit}
        />
        <SearchStatus
          lang={lang}
          loading={loading}
          query={query}
          totalCount={totalCount}
        />
        <SearchResults
          aboutResults={aboutResults}
          articles={articles}
          boardById={boardById}
          error={error}
          lang={lang}
          loading={loading}
          query={query}
          surveys={surveys}
          totalCount={totalCount}
        />
      </main>

      <Footer />
    </div>
  );
}
