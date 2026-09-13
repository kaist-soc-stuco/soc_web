import { useDeferredValue, useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { createApiClient } from "@soc/api-client";
import { useQuery } from "@tanstack/react-query";

import { Header } from "@/components/organisms/header";
import { EmptyState } from "@/components/ui/data-state";
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
  PageTabButton,
  PageTabs,
} from "@/components/ui/page-layout";
import { useLanguage } from "@/hooks/use-language";
import { useBoardCatalog } from "@/hooks/use-board-catalog";
import { useCurrentSession } from "@/hooks/use-current-session";
import { resolveApiBaseUrl } from "@/lib/api-base-url";
import { canWriteBoardFromMetadata } from "@/lib/board-metadata";
import { hasPersistedProfile } from "@/lib/require-persisted-profile";
import { RichTextContent } from "@/components/ui/rich-text-content";

const FAQ_SECTIONS = [
  {
    key: "account",
    titleKo: "계정·이용",
    titleEn: "Account & access",
    titles: new Set([
      "KAIST 계정으로 어떻게 로그인하나요?",
      "게시글·댓글 작성 권한은 어떻게 되나요?",
      "프로필 정보가 잘못 표시되면 어떻게 하나요?",
      "계정 비활성화 안내가 표시되면 어떻게 하나요?",
    ]),
  },
  {
    key: "fees",
    titleKo: "과비 납부",
    titleEn: "Student fees",
    titles: new Set([
      "과비는 어떻게 납부하나요?",
      "제 과비 납부 여부는 어디서 확인하나요?",
      "과비를 환급받을 수 있나요?",
    ]),
  },
  {
    key: "events-surveys",
    titleKo: "행사·설문",
    titleEn: "Events & surveys",
    titles: new Set([
      "행사·일정은 어디서 확인하나요?",
      "행사는 어떻게 신청하나요?",
      "행사 신청을 수정하거나 취소하려면 어떻게 하나요?",
      "설문이나 투표에 참여할 수 없다고 표시되는 이유는 무엇인가요?",
    ]),
  },
  {
    key: "other",
    titleKo: "기타",
    titleEn: "Other",
    titles: new Set([
      "학생회에 사업이나 정책을 건의하려면 어떻게 하나요?",
      "비밀 건의사항과 공식 답변은 누가 볼 수 있나요?",
      "댓글이나 공식 답변 알림은 어디서 확인하나요?",
      "사이트 오류는 어떻게 신고하나요?",
      "행사나 동아리 홍보글 게시를 요청하려면 어떻게 하나요?",
      "학번별 단체 카카오톡방에 참여하려면 어떻게 하나요?",
      "졸업 요건과 교과목 이수 순서는 어디서 확인하나요?",
      "연구실, 교수진, 시설 정보는 어디서 확인하나요?",
      "집행위원회 모집은 언제 하나요?",
      "학생회 활동인증서는 어디에 요청하나요?",
      "기업 후원이나 제휴를 제안하려면 어떻게 하나요?",
      "전산학부 학생회칙은 어디서 확인하나요?",
    ]),
  },
] as const;

type FaqFilter = "all" | (typeof FAQ_SECTIONS)[number]["key"];

const FAQ_FILTERS: Array<{ value: FaqFilter; titleKo: string; titleEn: string }> = [
  { value: "all", titleKo: "전체", titleEn: "All" },
  { value: "account", titleKo: "계정·이용", titleEn: "Account & access" },
  { value: "fees", titleKo: "과비 납부", titleEn: "Student fees" },
  { value: "events-surveys", titleKo: "행사·설문", titleEn: "Events & surveys" },
  { value: "other", titleKo: "기타", titleEn: "Other" },
];

const faqCategoryForTitle = (titleKo: string): FaqFilter =>
  FAQ_SECTIONS.find((section) => section.titles.has(titleKo))?.key ?? "other";

export function FaqPage() {
  const { lang } = useLanguage();
  const [openItems, setOpenItems] = useState<Set<string>>(() => new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<FaqFilter>("all");
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
      if (activeFilter !== "all" && faqCategoryForTitle(item.titleKo) !== activeFilter) {
        return false;
      }
      if (!query) return true;
      return [item.titleKo, item.titleEn, item.snippetKo, item.snippetEn]
        .filter(Boolean)
        .some((value) => value!.toLocaleLowerCase().includes(query));
    });
  }, [activeFilter, deferredSearchQuery, items]);
  const faqSections = useMemo(() => {
    const assignedIds = new Set<string>();
    const sections = FAQ_SECTIONS.flatMap((section) => {
      const sectionItems = filteredItems.filter((item) => {
        if (!section.titles.has(item.titleKo)) return false;
        assignedIds.add(item.articleId);
        return true;
      });
      return sectionItems.length > 0 ? [{ ...section, items: sectionItems }] : [];
    });
    const ungroupedItems = filteredItems.filter((item) => !assignedIds.has(item.articleId));
    return ungroupedItems.length > 0
      ? [
          ...sections,
          {
            key: "other",
            titleKo: "기타",
            titleEn: "Other",
            titles: new Set<string>(),
            items: ungroupedItems,
          },
        ]
      : sections;
  }, [filteredItems]);

  return (
    <PageShell>
      <Header />
      <PageMain>
        <PageHeader
          className="mb-0"
          containerClassName="max-w-4xl"
          title={lang === "ko" ? "자주 묻는 질문 (FAQ)" : "Frequently asked questions (FAQ)"}
          titleId="faq-page-title"
        />

        <PageContainer className="faq-page-container max-w-4xl pb-12">
         <div className="faq-page-tools">
           <PageTabs
             aria-label={lang === "ko" ? "FAQ 분류" : "FAQ categories"}
              variant="segmented"
             className="faq-filter-tabs"
           >
             {FAQ_FILTERS.map((filter) => (
               <PageTabButton
                 key={filter.value}
                 active={activeFilter === filter.value}
                 onClick={() => setActiveFilter(filter.value)}
               >
                 {lang === "ko" ? filter.titleKo : filter.titleEn}
               </PageTabButton>
             ))}
           </PageTabs>
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
         </div>

          <span className="sr-only" aria-live="polite">
            {lang === "ko" ? `전체 ${filteredItems.length}건` : `${filteredItems.length} items`}
          </span>
         <DataViewCard aria-label={lang === "ko" ? "FAQ 목록" : "FAQ list"} className="faq-list-card">
           <DataViewBody>
              {faqQuery.isPending ? (
                <div className="min-h-48 divide-y divide-slate-100" aria-label="FAQ 불러오는 중">
                  {Array.from({ length: 5 }, (_, index) => (
                    <div key={index} className="h-14 bg-slate-50/70" />
                  ))}
                </div>
              ) : faqQuery.isError ? (
                <div className="flex min-h-48 flex-col items-center justify-center gap-3 px-5 py-8 text-center" role="alert">
                  <p className="text-sm font-normal text-red-600">
                    {lang === "ko"
                      ? "FAQ를 불러오지 못했습니다."
                      : "Failed to load FAQ."}
                  </p>
                  <UiButton
                    type="button"
                    variant="outline"
                    onClick={() => void faqQuery.refetch()}
                  >
                    {lang === "ko" ? "다시 시도" : "Retry"}
                  </UiButton>
                </div>
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
                        className="text-xs font-medium text-brand-primary hover:underline"
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
                <div className="min-h-48">
                  {faqSections.map((section, index) => (
                    <section
                      key={section.key}
                      aria-labelledby={`faq-section-${section.key}`}
                      className={index > 0 ? "border-t border-slate-100" : undefined}
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
                                className="flex min-h-14 w-full items-center justify-between gap-4 rounded-none border-0 px-4 py-3 text-left text-[length:var(--ui-text-section-size)] font-medium leading-6 text-slate-800 hover:bg-slate-50 sm:px-6"
                              >
                                <span className="flex min-w-0 flex-1 items-baseline whitespace-normal">
                                 <span>{title}</span>
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
                    </section>
                  ))}
                </div>
              )}
            </DataViewBody>
          </DataViewCard>
        </PageContainer>
      </PageMain>
    </PageShell>
  );
}
