import { useQuery } from "@tanstack/react-query";
import { createApiClient } from "@soc/api-client";
import { useCurrentSession } from "@/hooks/use-current-session";
import { resolveApiBaseUrl } from "@/lib/api";
import { showChannelTalk } from "@/features/channel-talk/channel-talk";
import { useEffect, useMemo, useRef, type ReactNode } from "react";
import { ArrowRight } from "lucide-react";

import { useLocalizedSiteContent, usePublicContentBlocksByType } from "@/features/site-content/site-content";
import { resolveAssetUrl } from "@/lib/asset-url";
import { PledgesSection } from "./pledges-section";
import type { AboutSectionId } from "./use-about-page-controller";

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

export function AboutPageHeader({ lang }: { lang: string }) {
  const title = useLocalizedSiteContent("about.hero.title");
  const description = useLocalizedSiteContent("about.hero.description");

  return (
    <header
      className="about-page-header"
      aria-labelledby="about-page-title"
      aria-label={lang === "ko" ? "전산학부 집행위원회" : "KAIST SoC Student Council"}
    >
      <div className="about-landing-container">
        <h1 id="about-page-title">{title.replace(/\r?\n/g, " ")}</h1>
        <p className="break-keep">{description}</p>
      </div>
    </header>
  );
}

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
      <div className="about-section-nav-mobile about-landing-container">
        <label className="sr-only" htmlFor="about-section-select">
          {lang === "ko" ? "소개 페이지 섹션 선택" : "Choose an about page section"}
        </label>
        <select
          id="about-section-select"
          value={activeSection}
          onChange={(event) => onNavigate(event.currentTarget.value as AboutSectionId)}
          className="w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-kaist-darkgreen focus:ring-2 focus:ring-kaist-darkgreen/15"
        >
          {SECTIONS.map((section) => (
            <option key={section.id} value={section.id}>
              {labels[section.id]}
            </option>
          ))}
        </select>
      </div>
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
              {labels[section.id]}
            </a>
          );
        })}
      </div>
    </nav>
  );
}

export function AboutLandingContent({
  lang,
}: {
  lang: string;
}) {
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = contentRef.current;
    if (!root) return;

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
  }, []);

  return (
    <div ref={contentRef} data-about-content>
      <IntroSection lang={lang} />
      <WorkSection lang={lang} />
      <PeopleSection lang={lang} />
      <PartnershipSection lang={lang} />
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
  const body = useLocalizedSiteContent("about.intro.body");

  return (
    <section id="intro" className="about-anchor-section about-landing-section">
      <div className="about-landing-container">
        <figure className="about-intro-feature" data-about-reveal>
          <img
            src="/hero_background2.jpeg"
            alt={lang === "ko" ? "전산학부 집행위원회 구성원 단체 사진" : "KAIST SoC Student Council members"}
            width={3000}
            height={2000}
            loading="lazy"
            decoding="async"
          />
        </figure>
        <div className="about-intro-summary" data-about-reveal>
          <p className="break-keep">{body}</p>
        </div>
      </div>
    </section>
  );
}

function WorkSection({ lang }: { lang: string }) {
  const workTitle = useLocalizedSiteContent("about.work.title");
  const pledgeTitle = useLocalizedSiteContent("about.pledges.title");
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
    <section id="work" className="about-anchor-section about-landing-section about-landing-section-muted">
      <div className="about-landing-container">
        <div data-about-reveal>
          <SectionHeading className="about-work-heading">{workTitle}</SectionHeading>
        </div>
        <div className="about-scope-grid about-reveal-delay-1" data-about-reveal>
          {scopes.map((scope) => {
            return (
              <article key={scope.title} className="about-scope-card select-none">
                <span className="about-scope-copy">
                  <strong>{scope.title}</strong>
                  <small className="whitespace-pre-line">{scope.description}</small>
                </span>
              </article>
            );
          })}
        </div>

        <div id="pledges" className="about-work-pledges about-reveal-delay-2" data-about-reveal>
          <SectionHeading>{pledgeTitle}</SectionHeading>
          <PledgesSection lang={lang} />
        </div>
      </div>
    </section>
  );
}

function PeopleSection({ lang }: { lang: string }) {
  const title = useLocalizedSiteContent("about.organization.title");
  const description = useLocalizedSiteContent("about.organization.description");
  const organizationChart = usePublicContentBlocksByType("ORGANIZATION_CHART")[0];
  const organizationImage = organizationChart
    ? lang === "en"
      ? organizationChart.imageUrlEn || organizationChart.imageUrl
      : organizationChart.imageUrl
    : null;
  return (
    <section id="people" className="about-anchor-section about-landing-section">
      <div className="about-landing-container">
        <div data-about-reveal>
          <SectionHeading>{title}</SectionHeading>
          <p className="about-section-lead whitespace-pre-line">{description}</p>
        </div>

        {organizationImage && organizationChart ? (
          <figure className="about-org-chart about-reveal-delay-2" data-about-reveal>
            <a className="about-org-chart-content block" href={resolveAssetUrl(organizationImage)} target="_blank" rel="noopener noreferrer" aria-label={lang === "ko" ? "조직도 확대 보기" : "Open full-size organization chart"}>
              <img
                src={resolveAssetUrl(organizationImage)}
                alt={lang === "ko" ? "전산학부 집행위원회 전체 조직도" : "Full SoC Student Council organization chart"}
                loading="lazy"
                decoding="async"
              />
            </a>
          </figure>
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
