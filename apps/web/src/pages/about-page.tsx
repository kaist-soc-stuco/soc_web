import {
  AboutHero,
  AboutTabContent,
  AboutTabs,
} from "@/features/about/about-page-sections";
import { useAboutPageController } from "@/features/about/use-about-page-controller";
import { Footer } from "@/components/organisms/footer";
import { Header } from "@/components/organisms/header";

export function AboutPage() {
  const {
    contacts,
    contactsLoading,
    currentTab,
    handleTabChange,
    lang,
  } = useAboutPageController();

  return (
    <div className="flex min-h-screen flex-col bg-gray-50/50">
      <Header showLogo />
      <AboutHero />
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
      <Footer />
    </div>
  );
}
