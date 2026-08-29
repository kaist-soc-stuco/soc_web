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

const FAQ_SECTIONS = [
  {
    key: "account",
    titleKo: "계정 및 이용",
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
    titleKo: "과비",
    titleEn: "Student fees",
    titles: new Set([
      "과비는 어떻게 납부하나요?",
      "제 과비 납부 여부는 어디서 확인하나요?",
      "과비를 환급받을 수 있나요?",
    ]),
  },
  {
    key: "events-surveys",
    titleKo: "행사 및 설문",
    titleEn: "Events & surveys",
    titles: new Set([
      "행사·일정은 어디서 확인하나요?",
      "행사는 어떻게 신청하나요?",
      "행사 신청을 수정하거나 취소하려면 어떻게 하나요?",
      "설문이나 투표에 참여할 수 없다고 표시되는 이유는 무엇인가요?",
    ]),
  },
  {
    key: "board",
    titleKo: "게시판 및 건의",
    titleEn: "Boards & suggestions",
    titles: new Set([
      "학생회에 사업이나 정책을 건의하려면 어떻게 하나요?",
      "비밀 건의사항과 공식 답변은 누가 볼 수 있나요?",
      "댓글이나 공식 답변 알림은 어디서 확인하나요?",
      "사이트 오류는 어떻게 신고하나요?",
    ]),
  },
  {
    key: "council",
    titleKo: "학생회 및 학부 정보",
    titleEn: "Council & school information",
    titles: new Set([
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

export function FaqPage() {
  const { lang } = useLanguage();
  const [openItems, setOpenItems] = useState<Set<string>>(() => new Set());
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
                    <div key={index} className="h-14 bg-slate-50/70" />
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
                <div className="min-h-48 border-t-2 border-t-brand-primary">
                  {faqSections.map((section) => (
                    <section key={section.key} aria-labelledby={`faq-section-${section.key}`}>
                      <h3
                        id={`faq-section-${section.key}`}
                        className="border-b border-slate-100 bg-slate-50/60 px-4 py-2.5 text-xs font-semibold tracking-tight text-slate-500 sm:px-6"
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
                                <span className="min-w-0 flex-1 whitespace-normal">{title}</span>
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
