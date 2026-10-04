import { useQuery } from "@tanstack/react-query";
import { createApiClient } from "@soc/api-client";
import { useCurrentSession } from "@/hooks/use-current-session";
import { resolveApiBaseUrl } from "@/lib/api";
import { showChannelTalk } from "@/features/channel-talk/channel-talk";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ArrowRight, Maximize2 } from "lucide-react";
import { ImageViewer } from "@/components/ui/image-viewer";
import { Button } from "@/components/ui/button";

import { useLocalizedSiteContent, usePublicContentBlocksByType } from "@/features/site-content/site-content";
import { resolveAssetUrl } from "@/lib/asset-url";
import { PledgesSection } from "./pledges-section";
import type { AboutSectionId } from "./use-about-page-controller";

// The supplied default bitmap has large blank margins around the diagram.
const DEFAULT_ORG_CHART_BOUNDS = { x: .055, y: .295, width: .865, height: .365 };

const SECTIONS: Array<{
  id: AboutSectionId;
}> = [
  { id: "intro" },
  { id: "work" },
  { id: "people" },
  { id: "partnership" },
];

type ScopeItem = {
  description: string;
  title: string;
};

export function AboutSectionNavigation({
  activeSection,
  lang,
  onNavigate,
}: {
  activeSection: AboutSectionId;
  lang: string;
  onNavigate: (sectionId: AboutSectionId) => void;
}) {
  const labels: Record<AboutSectionId, string> = {
    intro: useLocalizedSiteContent("about.nav.intro"),
    work: useLocalizedSiteContent("about.nav.work"),
    people: useLocalizedSiteContent("about.nav.organization"),
    partnership: useLocalizedSiteContent("about.nav.partnership"),
  };

  return (
    <nav className="about-section-nav" aria-label={lang === "ko" ? "소개 페이지 목차" : "About page sections"}>
      <div className="about-landing-container about-section-nav-inner">
        {SECTIONS.map((section) => {
          const active = activeSection === section.id;
          return (
            <a
              key={section.id}
              href={`#${section.id === "work" ? "pledges" : section.id}`}
              aria-current={active ? "location" : undefined}
              className={active ? "is-active select-none" : "select-none"}
              onClick={(event) => {
                event.preventDefault();
                onNavigate(section.id);
              }}
            >
              <span className="sm:hidden">{lang === "ko" ? ({ intro: "소개", work: "공약", people: "조직도", partnership: "제휴" })[section.id] : ({ intro: "Intro", work: "Pledges", people: "Team", partnership: "Partners" })[section.id]}</span>
              <span className="hidden sm:inline">{labels[section.id]}</span>
            </a>
          );
        })}
      </div>
    </nav>
  );
}

export function AboutLandingContent({
  lang,
  mobileSection,
}: {
  lang: string;
  mobileSection?: AboutSectionId;
}) {
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = contentRef.current;
    if (!root) return;

    if (mobileSection) return;

    const targets = Array.from(root.querySelectorAll<HTMLElement>("[data-about-reveal]"));
    root.classList.add("about-motion-ready");

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      targets.forEach((target) => target.classList.add("is-visible"));
      return () => root.classList.remove("about-motion-ready");
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        });
      },
      { rootMargin: "0px 0px -12%", threshold: 0.08 },
    );
    targets.forEach((target) => observer.observe(target));

    return () => {
      observer.disconnect();
      root.classList.remove("about-motion-ready");
    };
  }, [mobileSection]);

  return (
    <div ref={contentRef} data-about-content data-mobile-section={mobileSection}>
      {(!mobileSection || mobileSection === "intro") && <IntroSection lang={lang} />}
      {(!mobileSection || mobileSection === "work") && <WorkSection lang={lang} />}
      {(!mobileSection || mobileSection === "people") && <PeopleSection lang={lang} />}
      {(!mobileSection || mobileSection === "partnership") && <PartnershipSection lang={lang} />}
    </div>
  );
}

function SectionHeading({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <header className={`about-section-heading${className ? ` ${className}` : ""}`}>
      <h2>{children}</h2>
    </header>
  );
}

function IntroSection({ lang }: { lang: string }) {
  const title = useLocalizedSiteContent("about.hero.title");
  const description = useLocalizedSiteContent("about.hero.description");
  const workTitle = useLocalizedSiteContent("about.work.title");
  const scopes: ScopeItem[] = [
    {
      title: useLocalizedSiteContent("about.work.card.1.title"),
      description: useLocalizedSiteContent("about.work.card.1.description"),
    },
    {
      title: useLocalizedSiteContent("about.work.card.2.title"),
      description: useLocalizedSiteContent("about.work.card.2.description"),
    },
    {
      title: useLocalizedSiteContent("about.work.card.3.title"),
      description: useLocalizedSiteContent("about.work.card.3.description"),
    },
  ];

  return (
    <section id="intro" className="about-anchor-section about-landing-section">
      <div className="about-landing-container">
        <div className="about-intro-heading" data-about-reveal>
          <h1 id="about-page-title">{title.replace(/\r?\n/g, " ")}</h1>
        </div>
        <div className="about-intro-summary" data-about-reveal>
          <p className="break-keep">{description}</p>
        </div>
       <figure className="about-intro-feature about-reveal-delay-1" data-about-reveal>
          <img
            src="/hero_background2.jpeg"
            alt={lang === "ko" ? "전산학부 집행위원회 구성원 단체 사진" : "KAIST SoC Student Council members"}
            width={3000}
            height={2000}
            loading="eager"
            decoding="async"
          />
        </figure>
        <div className="about-intro-work about-reveal-delay-2" data-about-reveal>
         <SectionHeading className="about-work-heading">{workTitle}</SectionHeading>
          <div className="about-scope-grid about-reveal-delay-1" data-about-reveal>
            {scopes.map((scope) => (
              <article key={scope.title} className="about-scope-card select-none">
                <span className="about-scope-copy">
                  <strong>{scope.title}</strong>
                  <small className="whitespace-pre-line">{scope.description}</small>
                </span>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function WorkSection({ lang }: { lang: string }) {
  const pledgeTitle = useLocalizedSiteContent("about.pledges.title");

  return (
    <section id="work" className="about-anchor-section about-landing-section about-landing-section-muted">
      <div className="about-landing-container">
        <div id="pledges" className="about-work-pledges" data-about-reveal>
          <SectionHeading>{pledgeTitle}</SectionHeading>
          <PledgesSection lang={lang} />
        </div>
      </div>
    </section>
  );
}

function PeopleSection({ lang }: { lang: string }) {
  const [viewerOpen, setViewerOpen] = useState(false);
  const title = useLocalizedSiteContent("about.organization.title");
  const description = useLocalizedSiteContent("about.organization.description");
  const organizationChart = usePublicContentBlocksByType("ORGANIZATION_CHART")[0];
  const organizationImage = organizationChart
    ? lang === "en"
      ? organizationChart.imageUrlEn || organizationChart.imageUrl
      : organizationChart.imageUrl
    : null;
  const isDefaultChart = organizationImage?.endsWith("/organization-chart.png") || organizationImage === "organization-chart.png";
  return (
    <section id="people" className="about-anchor-section about-landing-section">
      <div className="about-landing-container">
        <div data-about-reveal>
          <SectionHeading>{title}</SectionHeading>
          <p className="about-section-lead whitespace-pre-line">{description}</p>
        </div>

        {organizationImage && organizationChart ? (
          <>
          {isDefaultChart && <div className="mobile-organization-list md:hidden">
            <h3>{lang === "ko" ? "회장단" : "Council leadership"}</h3>
            <p>{lang === "ko" ? "학생회장 · 부학생회장" : "President · Vice president"}</p>
            <ul aria-label={lang === "ko" ? "집행위원회 부서" : "Council departments"}>
              {[
                ["비서실", "Secretariat", "실장 · 실원", "Head · Members"],
                ["대외소통부", "External Communications", "부장 · 부원", "Head · Members"],
                ["기획부", "Planning", "부장 · 부원", "Head · Members"],
                ["전산관리부", "IT Management", "부장 · 부원", "Head · Members"],
                ["TF", "Task Force", "TF장 · TF원", "Lead · Members"],
              ].map(([ko, en, rolesKo, rolesEn]) => <li key={ko}><strong>{lang === "ko" ? ko : en}</strong><span>{lang === "ko" ? rolesKo : rolesEn}</span></li>)}
            </ul>
            <Button variant="outline" onClick={() => setViewerOpen(true)}><Maximize2 className="size-4" aria-hidden="true" />{lang === "ko" ? "전체 조직도 보기" : "View full organization chart"}</Button>
          </div>}
          <figure className={`about-org-chart about-reveal-delay-2${isDefaultChart ? " mobile-default-org-image" : ""}`} data-about-reveal>
            <button type="button" className="about-org-chart-content block w-full" data-default-chart={organizationImage.endsWith("/organization-chart.png") || organizationImage === "organization-chart.png"} onClick={() => setViewerOpen(true)} aria-label={lang === "ko" ? "조직도 확대 보기" : "View full-size organization chart"}>
              <img
                src={resolveAssetUrl(organizationImage)}
                alt={lang === "ko" ? "전산학부 집행위원회 전체 조직도" : "Full SoC Student Council organization chart"}
                loading="lazy"
                decoding="async"
              />
            </button>
            <figcaption className="flex justify-end px-3 pb-3">
              <Button variant="ghost" size="sm" onClick={() => setViewerOpen(true)}><Maximize2 className="size-4" aria-hidden="true" />{lang === "ko" ? "확대 보기" : "Expand"}</Button>
            </figcaption>
            <ImageViewer open={viewerOpen} onClose={() => setViewerOpen(false)} src={resolveAssetUrl(organizationImage)} title={lang === "ko" ? "조직도" : "Organization chart"} lang={lang} mobileContentBounds={isDefaultChart ? DEFAULT_ORG_CHART_BOUNDS : undefined} />
          </figure>
          </>
        ) : null}
      </div>
    </section>
  );
}

function PartnershipSection({ lang }: { lang: string }) {
  const title = useLocalizedSiteContent("about.partnership.title");
  const description = useLocalizedSiteContent("about.partnership.description");
  const cta = useLocalizedSiteContent("about.partnership.cta");
  const client = useMemo(() => createApiClient({ baseUrl: resolveApiBaseUrl() }), []);
  const { data: session, isPending } = useCurrentSession();
  const { data: channel } = useQuery({ queryKey: ["channel-talk", "config", session?.authenticated && session.userId ? session.userId : "anonymous"], queryFn: () => client.getChannelTalkConfig(), enabled: !isPending, retry: false });

  return (
    <section
      id="partnership"
      className="about-anchor-section about-landing-section about-landing-section-muted"
    >
      <div className="about-landing-container">
        <div className="about-partnership-layout">
          <div data-about-reveal>
            <SectionHeading>{title}</SectionHeading>
            <p className="about-partnership-description whitespace-pre-line">{description}</p>
            {channel?.enabled && channel.pluginKey ? <button type="button" className="about-partnership-link select-none" onClick={showChannelTalk}>{cta}<ArrowRight aria-hidden="true" /></button> : null}
          </div>

        </div>
      </div>
    </section>
  );
}
