import { useDeferredValue, useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { createApiClient } from "@soc/api-client";
import { hasPermission } from "@soc/shared";
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
import { useCurrentSession } from "@/hooks/use-current-session";
import { resolveApiBaseUrl } from "@/lib/api-base-url";
import { getBoardWritePermissionBitFromMetadata } from "@/lib/board-metadata";
import { hasPersistedProfile } from "@/lib/require-persisted-profile";
import {
  BoardCategoryNavigation,
  BoardDataControls,
} from "@/features/board-list/board-page-sections";
import { RichTextContent } from "@/components/ui/rich-text-content";

export function FaqPage() {
  const { lang } = useLanguage();
  const [openIndex, setOpenIndex] = useState<number | null>(0);
  const [searchQuery, setSearchQuery] = useState("");
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const { data: session } = useCurrentSession();
  const apiClient = useMemo(
    () => createApiClient({ baseUrl: resolveApiBaseUrl() }),
    [],
  );
  const { boards, source: boardCatalogSource } = useBoardCatalog(apiClient);
  const faqBoard = boards.find((board) => board.code === "FAQ");
  const faqWritePermissionBit = faqBoard
    ? getBoardWritePermissionBitFromMetadata(faqBoard, "FAQ")
    : Number.MAX_SAFE_INTEGER;
  const canWriteFaq =
    boardCatalogSource === "server" &&
    hasPersistedProfile(session ?? null) &&
    (faqWritePermissionBit === 0 ||
      hasPermission(session?.permission ?? 0, faqWritePermissionBit));
  const faqQuery = useQuery({
    queryKey: ["faq-articles"],
    queryFn: () => apiClient.getArticles("FAQ", { page: 1, limit: 100 }),
  });
  const items = faqQuery.data?.items ?? [];
  const filteredItems = useMemo(() => {
    const query = deferredSearchQuery.trim().toLocaleLowerCase();
    if (!query) return items;

    return items.filter((item) =>
      [item.titleKo, item.titleEn, item.snippetKo, item.snippetEn]
        .filter(Boolean)
        .some((value) => value!.toLocaleLowerCase().includes(query)),
    );
  }, [deferredSearchQuery, items]);

  return (
    <PageShell>
      <Header />
      <PageMain>
        <PageHeader
          title="FAQ"
          titleId="faq-page-title"
        />

        <BoardCategoryNavigation boards={boards} category="FAQ" lang={lang} />

        <PageContainer className="pb-8">
          <DataViewCard aria-label={lang === "ko" ? "FAQ 목록" : "FAQ list"}>
            <DataViewToolbar>
              <BoardDataControls
                canWrite={canWriteFaq}
                lang={lang}
                onCurrentPageChange={() => undefined}
                onSearchQueryChange={setSearchQuery}
                searchQuery={searchQuery}
                totalCount={filteredItems.length}
                writeState={{ initialCategory: "FAQ" }}
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
                  message={
                    deferredSearchQuery.trim()
                      ? lang === "ko"
                        ? "검색 결과가 없습니다."
                        : "No search results."
                      : lang === "ko"
                        ? "등록된 FAQ가 없습니다."
                        : "No FAQ available."
                  }
                  minHeightClassName="min-h-48"
                />
              ) : (
                <div className="min-h-48 divide-y divide-slate-100">
                  {filteredItems.map((item, index) => {
                    const isOpen = openIndex === index;
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
                          onClick={() => setOpenIndex(isOpen ? null : index)}
                          className="flex min-h-14 w-full items-center justify-between gap-4 rounded-none border-0 px-4 py-3 text-left text-[length:var(--ui-text-section-size)] font-medium text-slate-800 hover:bg-slate-50 sm:px-6"
                        >
                          <span className="min-w-0 truncate">{title}</span>
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
                          className={`grid overflow-hidden transition-[grid-template-rows,opacity] duration-200 ease-out ${
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
              )}
            </DataViewBody>
          </DataViewCard>
        </PageContainer>
      </PageMain>
    </PageShell>
  );
}
