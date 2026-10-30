import { useDeferredValue, useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { createApiClient } from "@soc/api-client";
import { FAQ_CATEGORIES, resolveFaqCategory } from "@soc/contracts";
import { useQuery } from "@tanstack/react-query";

import { EmptyState, ErrorState } from "@/components/ui/data-state";
import { Button as UiButton } from "@/components/ui/button";
import {
  DataViewBody,
  DataViewCard,
  PageActionLink,
  PageContainer,
  PageHeader,
  PageMain,
  PageSearchField,
  PageShell,
} from "@/components/ui/page-layout";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { FilterSheet } from "@/components/ui/filter-sheet";
import { MobileFilterActions, MobileFilterButton } from "@/components/ui/mobile-filter-controls";
import { useMediaQuery } from "@/hooks/use-media-query";
import { useLanguage } from "@/hooks/use-language";
import { useBoardCatalog } from "@/hooks/use-board-catalog";
import { useCurrentSession } from "@/hooks/use-current-session";
import { resolveApiBaseUrl } from "@/lib/api-base-url";
import { canWriteBoardFromMetadata } from "@/lib/board-metadata";
import { hasPersistedProfile } from "@/lib/require-persisted-profile";
import { RichTextContent } from "@/components/ui/rich-text-content";

const FAQ_SECTIONS = FAQ_CATEGORIES;

type FaqFilter = "all" | (typeof FAQ_SECTIONS)[number]["key"];

const FAQ_FILTERS: Array<{ value: FaqFilter; titleKo: string; titleEn: string }> = [
  { value: "all", titleKo: "전체", titleEn: "All" },
  ...FAQ_SECTIONS.map(section => ({ value: section.key, titleKo: section.titleKo, titleEn: section.titleEn })),
];


export function FaqPage() {
  const { lang } = useLanguage();
  const [openItems, setOpenItems] = useState<Set<string>>(() => new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<FaqFilter>("all");
  const isMobile = useMediaQuery("(max-width: 767px)");
  const [filterOpen, setFilterOpen] = useState(false);
  const [draftFilter, setDraftFilter] = useState<FaqFilter>("all");
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const { data: session } = useCurrentSession();
  const apiClient = useMemo(
    () => createApiClient({ baseUrl: resolveApiBaseUrl() }),
    [],
  );
  const { boards, source: boardCatalogSource } = useBoardCatalog(apiClient);
  const faqBoard = boards.find((board) => board.code === "faq");
  const canWriteFaq =
    boardCatalogSource === "server" &&
    hasPersistedProfile(session ?? null) &&
    canWriteBoardFromMetadata(faqBoard, "faq", {
      permission: session?.permission ?? 0,
      primaryMajor: session?.primaryMajor,
      feeStatus: session?.feeStatus,
    });
  const faqQuery = useQuery({
    queryKey: ["faq-articles"],
    queryFn: () => apiClient.getArticles("faq", { page: 1, limit: 100 }),
  });
  const items = faqQuery.data?.items ?? [];
  const filteredItems = useMemo(() => {
    const query = deferredSearchQuery.trim().toLocaleLowerCase();
    return items.filter((item) => {
      if (activeFilter !== "all" && resolveFaqCategory(item) !== activeFilter) {
        return false;
      }
      if (!query) return true;
      return [item.titleKo, item.titleEn, item.snippetKo, item.snippetEn]
        .filter(Boolean)
        .some((value) => value!.toLocaleLowerCase().includes(query));
    });
  }, [activeFilter, deferredSearchQuery, items]);
  const faqSections = useMemo(() => {
    const sections = FAQ_SECTIONS.flatMap((section) => {
      const sectionItems = filteredItems.filter(
        (item) => resolveFaqCategory(item) === section.key,
      );
      return sectionItems.length > 0 ? [{ ...section, items: sectionItems }] : [];
    });
    return sections;
  }, [filteredItems]);

  return (
    <PageShell className="mobile-white-page">

      <PageMain>
        <PageHeader
          className="mb-0"
          containerClassName="max-w-4xl"
          title={lang === "ko" ? "자주 묻는 질문 (FAQ)" : "Frequently asked questions (FAQ)"}
          titleId="faq-page-title"
        />

        <PageContainer className="faq-page-container max-w-4xl pb-12">
         <div className="faq-page-tools">
          {isMobile ? <>
            <div className="mobile-filter-toolbar">
              <PageSearchField ariaLabel={lang === "ko" ? "FAQ 검색" : "Search FAQ"} placeholder={lang === "ko" ? "질문 검색" : "Search questions"} value={searchQuery} onChange={setSearchQuery} onClear={() => setSearchQuery("")} className="!w-full" />
              <MobileFilterButton label={lang === "ko" ? "필터" : "Filters"} open={filterOpen} active={activeFilter !== "all"} onClick={() => { setDraftFilter(activeFilter); setFilterOpen(true); }} />
            </div>
            <FilterSheet className="mobile-filter-sheet" open={filterOpen} onClose={() => setFilterOpen(false)} title={lang === "ko" ? "FAQ 필터" : "FAQ filters"} closeLabel={lang === "ko" ? "필터 닫기" : "Close filters"} footer={<MobileFilterActions lang={lang} onReset={() => setDraftFilter("all")} onApply={() => { setActiveFilter(draftFilter); setFilterOpen(false); }} />}>
              <fieldset className="mobile-filter-fieldset"><legend>{lang === "ko" ? "분류" : "Category"}</legend>{FAQ_FILTERS.map(filter => <label key={filter.value} className="mobile-filter-option"><input type="radio" name="mobile-faq-category" checked={draftFilter === filter.value} onChange={() => setDraftFilter(filter.value)} /><span>{lang === "ko" ? filter.titleKo : filter.titleEn}</span></label>)}</fieldset>
            </FilterSheet>
            {canWriteFaq && <PageActionLink state={{ initialCategory: "faq" }} to="/board/write" tone="primary">{lang === "ko" ? "작성" : "Write"}</PageActionLink>}
          </> : <>
           <div className="min-w-0 max-w-full overflow-x-auto">
             <SegmentedControl
               ariaLabel={lang === "ko" ? "FAQ 분류" : "FAQ categories"}
               className="clean-segmented-control"
               options={FAQ_FILTERS.map((filter) => ({
                 value: filter.value,
                 label: <><span className="sm:hidden">{lang === "ko" ? filter.value === "account" ? "계정" : filter.value === "fees" ? "과비" : filter.titleKo : filter.value === "account" ? "Account" : filter.value === "fees" ? "Fees" : filter.value === "events-surveys" ? "Events" : filter.titleEn}</span><span className="hidden sm:inline">{lang === "ko" ? filter.titleKo : filter.titleEn}</span></>,
               }))}
               value={activeFilter}
               onChange={setActiveFilter}
             />
           </div>
            <div className="faq-page-actions">
              <PageSearchField
                ariaLabel={lang === "ko" ? "FAQ 검색" : "Search FAQ"}
                placeholder={lang === "ko" ? "질문 키워드를 검색해 보세요" : "Search FAQ keywords"}
                value={searchQuery}
                onChange={setSearchQuery}
                onClear={() => setSearchQuery("")}
                className="faq-search-field"
              />
              {canWriteFaq ? (
                <PageActionLink state={{ initialCategory: "faq" }} to="/board/write" tone="primary">
                  {lang === "ko" ? "작성" : "Write"}
                </PageActionLink>
              ) : null}
            </div>
          </>}
         </div>

          <span className="sr-only" aria-live="polite">
            {lang === "ko" ? `전체 ${filteredItems.length}건` : `${filteredItems.length} items`}
          </span>
         <div
           aria-label={lang === "ko" ? "FAQ 목록" : "FAQ list"}
           className={faqQuery.isPending || faqQuery.isError || filteredItems.length === 0
             ? "overflow-hidden rounded-[var(--ui-card-radius)] border border-slate-200 bg-white"
             : undefined}
         >
           <DataViewBody>
              {faqQuery.isPending ? (
                <div className="min-h-48 divide-y divide-slate-100" aria-label="FAQ 불러오는 중">
                  {Array.from({ length: 5 }, (_, index) => (
                    <div key={index} className="h-14 bg-slate-50/70" />
                  ))}
                </div>
              ) : faqQuery.isError ? (
                <ErrorState
                  error={faqQuery.error}
                  requestIdLabel={lang === "ko" ? "요청 번호" : "Request ID"}
                  description={
                    lang === "ko"
                      ? "일시적인 네트워크 오류일 수 있습니다. 잠시 후 다시 시도해 주세요."
                      : "This may be a temporary network issue. Please try again."
                  }
                  onRetry={() => void faqQuery.refetch()}
                  retryLabel={lang === "ko" ? "다시 시도" : "Retry"}
                  title={
                    lang === "ko"
                      ? "FAQ 목록을 불러오지 못했습니다."
                      : "We couldn't load the FAQ."
                  }
                />
              ) : filteredItems.length === 0 ? (
                <EmptyState
                  className="min-h-48 rounded-none border-0 bg-transparent"
                  message={
                    deferredSearchQuery.trim() || activeFilter !== "all"
                      ? lang === "ko"
                        ? "조건에 맞는 FAQ가 없습니다."
                        : "No FAQ matches these filters."
                      : lang === "ko"
                        ? "등록된 FAQ가 없습니다."
                        : "No FAQ available."
                  }
                  minHeightClassName="min-h-48"
                >
                  {deferredSearchQuery.trim() || activeFilter !== "all" ? (
                    <>
                      <span>
                        {lang === "ko"
                          ? "조건에 맞는 FAQ가 없습니다."
                          : "No FAQ matches these filters."}
                      </span>
                      <button
                        type="button"
                        className="mx-auto mt-3 block text-xs font-medium text-brand-primary hover:underline"
                        onClick={() => {
                          setSearchQuery("");
                          setActiveFilter("all");
                        }}
                      >
                        {lang === "ko" ? "필터 초기화" : "Reset filters"}
                      </button>
                    </>
                  ) : undefined}
                </EmptyState>
              ) : (
                <div className="space-y-4">
                  {faqSections.map((section) => (
                    <DataViewCard
                      key={section.key}
                      aria-labelledby={`faq-section-${section.key}`}
                      className="mobile-faq-group shadow-none"
                    >
                      <h3
                        id={`faq-section-${section.key}`}
                        className="border-b border-slate-100 px-4 py-4 text-base font-bold tracking-tight text-slate-900 sm:px-6"
                      >
                        {lang === "ko" ? section.titleKo : section.titleEn}
                      </h3>
                      <div className="divide-y divide-slate-100">
                        {section.items.map((item) => {
                          const isOpen = openItems.has(item.articleId);
                          const title = lang === "ko" ? item.titleKo : item.titleEn || item.titleKo;
                          const answer = lang === "ko" ? item.snippetKo : item.snippetEn || item.snippetKo;
                          const answerId = `faq-answer-${item.articleId}`;
                          const questionId = `faq-question-${item.articleId}`;

                          return (
                            <div key={item.articleId}>
                              <UiButton
                                type="button"
                                variant="ghost"
                                id={questionId}
                                aria-expanded={isOpen}
                                aria-controls={answerId}
                                onClick={() => {
                                  setOpenItems((current) => {
                                    const next = new Set(current);
                                    if (next.has(item.articleId)) {
                                      next.delete(item.articleId);
                                    } else {
                                      next.add(item.articleId);
                                    }
                                    return next;
                                  });
                                }}
                                className="faq-question flex min-h-14 w-full items-center justify-between gap-4 rounded-none border-0 px-4 py-3 text-left text-[length:var(--ui-text-section-size)] font-medium leading-6 text-slate-800 hover:bg-slate-50 sm:px-6"
                              >
                                <span className="flex min-w-0 flex-1 items-baseline whitespace-normal">
                                 <span className="break-keep [overflow-wrap:anywhere]">{title}</span>
                               </span>
                                <ChevronDown
                                  className={`size-4 shrink-0 text-slate-400 transition-transform duration-150 ${
                                    isOpen ? "rotate-180 text-brand-primary" : ""
                                  }`}
                                  aria-hidden="true"
                                />
                              </UiButton>
                              <div
                                id={answerId}
                                role="region"
                                aria-labelledby={questionId}
                                aria-hidden={!isOpen}
                                inert={!isOpen}
                                className={`grid overflow-hidden transition-[grid-template-rows,opacity] duration-200 ease-out motion-reduce:transition-none ${
                                  isOpen
                                    ? "grid-rows-[1fr] opacity-100"
                                    : "pointer-events-none grid-rows-[0fr] opacity-0"
                                }`}
                              >
                                <div className="min-h-0 overflow-hidden">
                                  <div className="border-t border-slate-100 bg-slate-50/70 px-4 py-4 pl-10 text-[length:var(--ui-text-body-sm-size)] font-normal leading-6 text-slate-600 sm:px-6 sm:pl-12">
                                    <RichTextContent content={answer ?? ""} />
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </DataViewCard>
                  ))}
                </div>
              )}
            </DataViewBody>
          </div>
        </PageContainer>
      </PageMain>
    </PageShell>
  );
}
