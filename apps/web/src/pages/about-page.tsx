import {
  AboutLandingContent,
  AboutSectionNavigation,
} from "@/features/about/about-page-sections";
import { useAboutPageController } from "@/features/about/use-about-page-controller";
import { PageShell } from "@/components/ui/page-layout";

export function AboutPage() {
  const {
    activeSection,
    lang,
    isMobile,
    scrollToSection,
  } = useAboutPageController();

  return (
    <PageShell className="about-landing-page mobile-white-page">

      <main className="channel-talk-safe-area flex-1">
        <AboutSectionNavigation
          activeSection={activeSection}
          lang={lang}
          onNavigate={scrollToSection}
        />
        <AboutLandingContent
          lang={lang}
          mobileSection={isMobile ? activeSection : undefined}
        />
      </main>
    </PageShell>
  );
}
