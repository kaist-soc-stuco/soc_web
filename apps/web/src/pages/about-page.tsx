import {
  AboutTabContent,
  AboutTabs,
} from "@/features/about/about-page-sections";
import { useAboutPageController } from "@/features/about/use-about-page-controller";
import { Header } from "@/components/organisms/header";
import { PageHeader, PageShell } from "@/components/ui/page-layout";

export function AboutPage() {
  const {
    contacts,
    contactsLoading,
    currentTab,
    handleTabChange,
    lang,
  } = useAboutPageController();

  return (
    <PageShell>
      <Header />
      <PageHeader title={lang === "ko" ? "학생회 소개" : "Student Council"} />
      <AboutTabs
        currentTab={currentTab}
        lang={lang}
        onTabChange={handleTabChange}
      />
      <AboutTabContent
        contacts={contacts}
        contactsLoading={contactsLoading}
        currentTab={currentTab}
        lang={lang}
      />
    </PageShell>
  );
}
