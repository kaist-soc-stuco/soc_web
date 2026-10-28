import { OPERATIONAL_SURVEY_IDS, operationalSurveyPath } from "@soc/contracts";
import { Link } from "react-router-dom";
import { useEffect, useRef, type ReactNode } from "react";
import { ArrowUpRight } from "lucide-react";
import { useLocalizedSiteContent, usePublicContentBlocksByType } from "@/features/site-content/site-content";
import { resolveAssetUrl } from "@/lib/asset-url";
import { PledgesSection } from "./pledges-section";
import { AboutProgramsSection } from "./about-programs-section";
import { AboutPartnerMarquee } from "./about-partner-marquee";
import { AboutOrganizationChart } from "./about-organization-chart";
import { ABOUT_SECTION_IDS, type AboutSectionId } from "./use-about-page-controller";

export function AboutSectionNavigation({ activeSection, lang, onNavigate }: {
  activeSection: AboutSectionId; lang: string; onNavigate: (sectionId: AboutSectionId) => void;
}) {
  const labels: Record<AboutSectionId, string> = {
    intro: useLocalizedSiteContent("about.nav.intro"),
    programs: lang === "ko" ? "주요 사업" : "Programs",
    work: useLocalizedSiteContent("about.nav.work"),
    people: useLocalizedSiteContent("about.nav.organization"),
    partnership: useLocalizedSiteContent("about.nav.partnership"),
  };
  const short = lang === "ko" ? { intro: "소개", programs: "사업", work: "공약", people: "조직", partnership: "제휴" } : { intro: "About", programs: "Work", work: "Pledges", people: "Team", partnership: "Partners" };
  return <nav className="about-section-nav" aria-label={lang === "ko" ? "소개 페이지 목차" : "About page sections"}>
    <div className="tree-section-nav-inner">
      {ABOUT_SECTION_IDS.map(id => <a key={id} href={`#${id === "work" ? "pledges" : id}`} aria-current={activeSection === id ? "location" : undefined} className={activeSection === id ? "is-active" : undefined}
        onClick={event => { if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return; event.preventDefault(); onNavigate(id); }}>
        <span data-nav-label className="tree-nav-short">{short[id]}</span><span data-nav-label className="tree-nav-full">{labels[id]}</span>
      </a>)}
    </div>
  </nav>;
}

export function AboutLandingContent({ lang, navigation }: { lang: string; navigation: ReactNode }) {
  const pledgeTitle = useLocalizedSiteContent("about.pledges.title");
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.animate([{ opacity: .3, transform: "translateY(12px)" }, { opacity: 1, transform: "translateY(0)" }], { duration: 420, easing: "cubic-bezier(.2,.7,.2,1)" });
        observer.unobserve(entry.target);
      }
    }, { threshold: .08 });
    rootRef.current?.querySelectorAll("[data-tree-reveal]").forEach(target => observer.observe(target));
    return () => observer.disconnect();
  }, []);
  return <div ref={rootRef} data-about-content>
    <IntroHero lang={lang} />
    <div className="tree-body-layout">
      {navigation}
      <div className="tree-body-content">
        <IntroBody lang={lang} />
        <AboutProgramsSection lang={lang} />
        <section id="pledges" className="tree-section tree-pledges-section" aria-labelledby="tree-pledges-title">
          <div className="tree-container">
            <header className="tree-section-heading" data-tree-reveal><h2 id="tree-pledges-title">{pledgeTitle}</h2></header>
            <PledgesSection lang={lang} />
          </div>
        </section>
        <PeopleSection lang={lang} />
        <PartnershipSection lang={lang} />
      </div>
    </div>
  </div>;
}

function IntroHero({ lang }: { lang: string }) {
  const title = useLocalizedSiteContent("about.hero.title");
  const description = useLocalizedSiteContent("about.hero.description");
  const sloganLines = description.split(/(?<=,)\s+|\r?\n/).filter(Boolean);
  const korean = lang === "ko";
  return <section id="intro" className="tree-intro" aria-labelledby="about-page-title">
    <div className="tree-hero-band">
      <div className="tree-container">
        <div className="tree-hero">
          <div className="tree-hero-copy">
            <p className="tree-hero-eyebrow">{title.replace(/\r?\n/g, " ")}<span>TREE</span></p>
            <h1 id="about-page-title" className="tree-hero-lead" lang="en">{sloganLines.map(line => <span key={line}>{line}</span>)}</h1>
          </div>
          <figure className="tree-hero-photo" data-tree-reveal><img src="/hero_background2.jpeg" alt={korean ? "전산학부 집행위원회 구성원 단체 사진" : "KAIST SoC Student Council members"} width={3000} height={2000} fetchPriority="high" decoding="async" /></figure>
        </div>
      </div>
    </div>
  </section>;
}

function IntroBody({ lang }: { lang: string }) {
  const paragraphs = useLocalizedSiteContent("about.intro.body").split(/\n+/).filter(Boolean);
  return <section className="tree-intro-copy-section" aria-labelledby="tree-intro-title">
    <div className="tree-container">
      <div className="tree-intro-body" data-tree-reveal>
        <h2 id="tree-intro-title">{lang === "ko" ? "아이디어를 실제 사업으로" : "From ideas to action"}</h2>
        <div>{paragraphs.map(paragraph => <p key={paragraph}>{paragraph}</p>)}</div>
      </div>
    </div>
  </section>;
}

function PeopleSection({ lang }: { lang: string }) {
  const title = useLocalizedSiteContent("about.organization.title");
  const chart = usePublicContentBlocksByType("ORGANIZATION_CHART")[0];
  const image = chart ? lang === "en" ? chart.imageUrlEn || chart.imageUrl : chart.imageUrl : null;
  const isDefault = Boolean(image && /(?:^|\/)organization-chart\.(?:png|svg)(?:[?#].*)?$/.test(image));
  const korean = lang === "ko";
  return <section id="people" className="tree-section tree-people" aria-labelledby="tree-people-title">
    <div className="tree-container">
      <header className="tree-section-heading" data-tree-reveal><h2 id="tree-people-title">{title}</h2></header>
      {isDefault ? <AboutOrganizationChart lang={lang} /> : image ? <figure className="tree-org-image">
        <img src={resolveAssetUrl(image)} alt={korean ? "전산학부 집행위원회 조직도" : "SoC Student Council organization chart"} width={1600} height={900} loading="lazy" />
      </figure> : <p>{korean ? "조직도를 준비하고 있습니다." : "The organization chart will be available soon."}</p>}
    </div>
  </section>;
}

function PartnershipSection({ lang }: { lang: string }) {
  const title = useLocalizedSiteContent("about.partnership.title");
  const description = useLocalizedSiteContent("about.partnership.description");
  const cta = useLocalizedSiteContent("about.partnership.cta");
  return <section id="partnership" className="tree-section tree-partnership" aria-labelledby="tree-partnership-title">
    <div className="tree-container">
      <div className="tree-partnership-inner" data-tree-reveal>
        <div><h2 id="tree-partnership-title">{title}</h2><p>{lang === "ko" ? description.replace(/받습니다\.\s*제안/, "받습니다.\n제안") : description}</p></div>
        <Link className="tree-primary-link" to={operationalSurveyPath(OPERATIONAL_SURVEY_IDS.corporatePartnership)} target="_blank" rel="noopener noreferrer">{cta}<span className="sr-only">{lang === "ko" ? " (새 탭에서 열림)" : " (opens in a new tab)"}</span><ArrowUpRight aria-hidden="true" /></Link>
      </div>
      <AboutPartnerMarquee lang={lang} />
    </div>
  </section>;
}
