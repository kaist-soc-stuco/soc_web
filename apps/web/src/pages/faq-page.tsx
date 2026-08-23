import { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { createApiClient } from "@soc/api-client";
import { useQuery } from "@tanstack/react-query";

import { Header } from "@/components/organisms/header";
import { EmptyState } from "@/components/ui/data-state";
import { Button as UiButton } from "@/components/ui/button";
import {
  DataViewBody,
  DataViewCard,
  DataViewToolbar,
  PageContainer,
  PageHeader,
  PageMain,
  PageShell,
} from "@/components/ui/page-layout";
import { useLanguage } from "@/hooks/use-language";
import { useBoardCatalog } from "@/hooks/use-board-catalog";
import { resolveApiBaseUrl } from "@/lib/api-base-url";
import {
  BoardCategoryNavigation,
  BoardDataControls,
} from "@/features/board-list/board-page-sections";
import { RichTextContent } from "@/components/ui/rich-text-content";

export function FaqPage() {
  const { lang } = useLanguage();
  const [openIndex, setOpenIndex] = useState<number | null>(0);
  const [searchQuery, setSearchQuery] = useState("");
  const apiClient = useMemo(
    () => createApiClient({ baseUrl: resolveApiBaseUrl() }),
    [],
  );
  const { boards } = useBoardCatalog(apiClient);
  const faqQuery = useQuery({
    queryKey: ["faq-articles"],
    queryFn: () => apiClient.getArticles("FAQ", { page: 1, limit: 100 }),
  });
  const items = faqQuery.data?.items ?? [];
  const filteredItems = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase();
    if (!query) return items;

    return items.filter((item) =>
      [item.titleKo, item.titleEn, item.snippetKo, item.snippetEn]
        .filter(Boolean)
        .some((value) => value!.toLocaleLowerCase().includes(query)),
    );
  }, [items, searchQuery]);

  return (
    <PageShell>
      <Header />
      <PageMain>
        <PageHeader
          title={lang === "ko" ? "자주 묻는 질문" : "Frequently asked questions"}
          titleId="faq-page-title"
        />

        <BoardCategoryNavigation boards={boards} lang={lang} />

        <PageContainer className="pb-8">
          <DataViewCard aria-label={lang === "ko" ? "FAQ 목록" : "FAQ list"}>
            <DataViewToolbar>
              <BoardDataControls
                canWrite={false}
                lang={lang}
                onCurrentPageChange={() => undefined}
                onSearchQueryChange={setSearchQuery}
                searchQuery={searchQuery}
                totalCount={filteredItems.length}
              />
            </DataViewToolbar>
            <DataViewBody>
              {faqQuery.isPending ? (
                <div className="min-h-48 divide-y divide-slate-100" aria-label="FAQ 불러오는 중">
                  {Array.from({ length: 5 }, (_, index) => (
                    <div key={index} className="h-14 animate-pulse bg-slate-50/70" />
                  ))}
                </div>
              ) : filteredItems.length === 0 ? (
                <EmptyState
                  className="min-h-48 rounded-none border-0 bg-transparent"
                  message={lang === "ko" ? "등록된 FAQ가 없습니다." : "No FAQ available."}
                  minHeightClassName="min-h-48"
                />
              ) : (
                <div className="min-h-48 divide-y divide-slate-100">
                  {filteredItems.map((item, index) => {
                    const isOpen = openIndex === index;
                    const title = lang === "ko" ? item.titleKo : item.titleEn || item.titleKo;
                    const answer = lang === "ko" ? item.snippetKo : item.snippetEn || item.snippetKo;

                    return (
                      <div key={item.articleId}>
                        <UiButton
                          type="button"
                          variant="ghost"
                          aria-expanded={isOpen}
                          onClick={() => setOpenIndex(isOpen ? null : index)}
                          className="flex min-h-14 w-full items-center justify-between gap-4 rounded-none border-0 px-4 py-3 text-left text-[15px] font-medium text-slate-800 hover:bg-slate-50 sm:px-6"
                        >
                          <span className="min-w-0 truncate">{title}</span>
                          <ChevronDown
                            className={`size-4 shrink-0 text-slate-400 transition-transform duration-150 ${
                              isOpen ? "rotate-180 text-brand-primary" : ""
                            }`}
                            aria-hidden="true"
                          />
                        </UiButton>
                        {isOpen ? (
                          <div className="border-t border-slate-100 bg-slate-50/70 px-4 py-4 text-sm font-normal leading-6 text-slate-600 sm:px-6">
                            <RichTextContent content={answer ?? ""} />
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              )}
            </DataViewBody>
          </DataViewCard>
        </PageContainer>
      </PageMain>
    </PageShell>
  );
}
