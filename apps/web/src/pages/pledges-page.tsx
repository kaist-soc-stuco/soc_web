import { useNavigate } from "react-router-dom";

import { AboutTabs } from "@/features/about/about-page-sections";
import { PledgesSection } from "@/features/about/pledges-section";
import { Header } from "@/components/organisms/header";
import { PageHeader, PageShell } from "@/components/ui/page-layout";
import { useLanguage } from "@/hooks/use-language";

export function PledgesPage() {
  const { lang } = useLanguage();
  const navigate = useNavigate();

  return (
    <PageShell>
      <Header />
      <PageHeader
        containerClassName="!max-w-3xl"
        breadcrumbs={[{ label: lang === "ko" ? "학생회 소개" : "About", to: "/about" }]}
        title={lang === "ko" ? "공약 이행 현황" : "Pledge Progress"}
      />
      <AboutTabs
        currentTab="pledges"
        lang={lang}
        onTabChange={(tab) => {
          navigate(tab === "pledges" ? "/about/pledges" : `/about?tab=${tab}`);
        }}
      />
      <main className="mx-auto w-full max-w-3xl flex-1 px-[var(--ui-space-page-x)] pb-20 pt-8 md:px-[var(--ui-space-page-x-wide)]">
        <PledgesSection lang={lang} />
      </main>
    </PageShell>
  );
}
