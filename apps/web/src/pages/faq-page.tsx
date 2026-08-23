import { useState } from "react";
import { useMemo } from "react";
import { ChevronDown, CircleHelp } from "lucide-react";
import { createApiClient } from "@soc/api-client";
import { useQuery } from "@tanstack/react-query";

import { Header } from "@/components/organisms/header";
import { PageHeader, PageShell } from "@/components/ui/page-layout";
import { useLanguage } from "@/hooks/use-language";
import { Button } from "@/components/ui/button";
import { RichTextContent } from "@/components/ui/rich-text-content";
import { resolveApiBaseUrl } from "@/lib/api-base-url";

export function FaqPage() {
  const { lang } = useLanguage();
  const [openIndex, setOpenIndex] = useState<number | null>(0);
  const apiClient = useMemo(() => createApiClient({ baseUrl: resolveApiBaseUrl() }), []);
  const faqQuery = useQuery({
    queryKey: ["faq-articles"],
    queryFn: () => apiClient.getArticles("FAQ", { page: 1, limit: 100 }),
  });
  const items = faqQuery.data?.items ?? [];

  return (
    <PageShell>
      <Header />
      <PageHeader
        breadcrumbs={[{ label: lang === "ko" ? "학생회 소개" : "Student Council", to: "/about" }]}
        title={lang === "ko" ? "자주 묻는 질문" : "Frequently asked questions"}
      />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 md:px-8 md:py-12">
        <div className="mb-6 flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-brand-primary-light text-brand-primary">
            <CircleHelp className="h-5 w-5" aria-hidden="true" />
          </div>
          <p className="pt-1 text-sm font-medium leading-6 text-slate-600">
            {lang === "ko"
              ? "SOC Web과 학생회 서비스 이용에 관한 기본 안내입니다."
              : "Basic guidance for SOC Web and student council services."}
          </p>
        </div>

        <div className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
          {items.map((item, index) => {
            const isOpen = openIndex === index;
            return (
              <div key={item.articleId}>
                <Button variant="ghost"
                  type="button"
                  aria-expanded={isOpen}
                  onClick={() => setOpenIndex(isOpen ? null : index)}
                  className="interaction-button flex min-h-14 w-full items-center justify-between gap-4 px-5 py-4 text-left text-sm font-bold text-slate-800 hover:bg-slate-50"
                >
                  <span>{lang === "ko" ? item.titleKo : item.titleEn || item.titleKo}</span>
                  <ChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${isOpen ? "rotate-180 text-brand-primary" : ""}`} aria-hidden="true" />
                </Button>
                {isOpen && (
                  <div className="border-t border-slate-100 bg-slate-50/70 px-5 py-4 text-sm font-medium leading-6 text-slate-600">
                    <RichTextContent content={(lang === "ko" ? item.snippetKo : item.snippetEn || item.snippetKo) ?? ""} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </main>
    </PageShell>
  );
}
