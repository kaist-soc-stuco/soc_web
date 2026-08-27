import {
  AboutLandingContent,
  AboutLandingHero,
  AboutSectionNavigation,
} from "@/features/about/about-page-sections";
import { useAboutPageController } from "@/features/about/use-about-page-controller";
import { Header } from "@/components/organisms/header";
import { PageShell } from "@/components/ui/page-layout";

export function AboutPage() {
  const {
    activeSection,
    lang,
    scrollToSection,
  } = useAboutPageController();

  return (
    <PageShell className="about-landing-page">
      <Header />
      <main className="channel-talk-safe-area flex-1">
        <AboutLandingHero lang={lang} />
        <AboutSectionNavigation
          activeSection={activeSection}
          lang={lang}
          onNavigate={scrollToSection}
        />
        <AboutLandingContent
          lang={lang}
        />
      </main>
    </PageShell>
  );
}
