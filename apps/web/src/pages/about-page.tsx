import {
  AboutLandingContent,
  AboutSectionNavigation,
} from "@/features/about/about-page-sections";
import { useAboutPageController } from "@/features/about/use-about-page-controller";
import { PageShell } from "@/components/ui/page-layout";
import { Footer } from "@/components/organisms/footer";
import "@/features/about/about-page.css";

export function AboutPage() {
  const {
    activeSection,
    lang,
    scrollToSection,
  } = useAboutPageController();

  return (
    <PageShell className="about-landing-page mobile-white-page about-tree-page">

      <main className="channel-talk-safe-area flex-1">
        <AboutLandingContent
          lang={lang}
          navigation={<AboutSectionNavigation activeSection={activeSection} lang={lang} onNavigate={scrollToSection} />}
        />
      </main>
      <Footer />
    </PageShell>
  );
}
