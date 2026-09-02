import { OPERATIONAL_SURVEY_IDS, operationalSurveyPath } from "@soc/contracts";
import { nowDate } from "@soc/shared";
import { useEffect, useRef, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { ArrowRight, BookOpen, Building2, Calendar, ChevronDown, MessageCircle } from "lucide-react";
import { Link } from "react-router-dom";

import { useLocalizedSiteContent, usePublicContentBlocksByType } from "@/features/site-content/site-content";
import { resolveAssetUrl } from "@/lib/asset-url";
import { PledgesSection } from "./pledges-section";
import { usePublicContactDepartments } from "./use-public-contact-departments";
import type { AboutSectionId } from "./use-about-page-controller";

const SECTIONS: Array<{
  id: AboutSectionId;
}> = [
  { id: "intro" },
  { id: "work" },
  { id: "people" },
  { id: "partnership" },
];

const DEFAULT_DEPARTMENTS = [
  {
    id: "presidium",
    nameKo: "회장단",
    nameEn: "Presidium",
    descriptionKo: "집행위원회 총괄 및 학생회 주요 정책 결정, 학과 및 총학생회 협의 총괄",
    descriptionEn: "Oversee the executive committee, set major council policies, and lead coordination with the department and university student council.",
  },
  {
    id: "secretariat",
    nameKo: "비서실",
    nameEn: "Secretariat",
    descriptionKo: "정기 회의 운영, 학생회비 예·결산 및 회계 관리, 공식 회의록 아카이빙",
    descriptionEn: "Run regular meetings, manage the council budget and accounts, and archive official minutes.",
  },
  {
    id: "communications",
    nameKo: "대외소통부",
    nameEn: "External Communications",
    descriptionKo: "타 학과 및 외부 단체 교류 협력, 공식 SNS 및 공지 채널 통합 관리",
    descriptionEn: "Coordinate exchanges with other departments and external groups, and manage official social and notice channels.",
  },
  {
    id: "planning",
    nameKo: "기획부",
    nameEn: "Planning Division",
    descriptionKo: "간식 행사, 문화 교류 이벤트, e-스포츠 대회 등 학부 행사 총괄 기획",
    descriptionEn: "Plan and lead department events such as snack programs, cultural exchanges, and e-sports tournaments.",
  },
  {
    id: "it-administration",
    nameKo: "전산관리부",
    nameEn: "IT Administration",
    descriptionKo: "전산학부 학생회 공식 웹 포털 개발, 서비스 운영 및 서버 인프라 관리",
    descriptionEn: "Develop the official SoC Student Council web portal and manage its service and server infrastructure.",
  },
] as const;

type ScopeItem = {
  description: string;
  href: string;
  icon: LucideIcon;
  title: string;
};

export function AboutLandingHero({ lang }: { lang: string }) {
  const currentYear = nowDate().getFullYear();
  const title = useLocalizedSiteContent("about.hero.title");
  const description = useLocalizedSiteContent("about.hero.description");
  const eventsCta = useLocalizedSiteContent("about.hero.cta.events");
  const suggestionsCta = useLocalizedSiteContent("about.hero.cta.suggestions");

  return (
    <section id="intro" className="about-anchor-section about-landing-hero" aria-labelledby="about-hero-title">
      <div className="about-landing-container about-landing-hero-inner">
        <div className="about-landing-hero-copy">
          <span className="about-hero-term">{currentYear} SoC StuCo</span>
          <h1 id="about-hero-title">
            {title.split(/\r?\n/).map((line, index) => <span key={`${line}-${index}`}>{line}</span>)}
          </h1>
          <p className="whitespace-pre-line">{description}</p>
          <div className="about-hero-links">
            <Link className="about-hero-cta about-hero-cta-primary select-none" to="/events">
              {eventsCta}
              <ArrowRight aria-hidden="true" />
            </Link>
            <Link className="about-hero-cta about-hero-cta-secondary select-none" to="/board/suggestions">
              {suggestionsCta}
              <ArrowRight aria-hidden="true" />
            </Link>
          </div>
        </div>
        <figure className="about-landing-hero-media">
          <img
            src="/hero_background2.jpeg"
            alt={lang === "ko" ? "전산학부 집행위원회 구성원 단체 사진" : "KAIST SoC Student Council members"}
            width={3000}
            height={2000}
            decoding="async"
            fetchPriority="high"
          />
        </figure>
      </div>
    </section>
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
    <nav className="about-section-nav" aria-label={lang === "ko" ? "집행위원회 소개 목차" : "About page sections"}>
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
      <WorkSection lang={lang} />
      <PeopleSection lang={lang} />
      <PartnershipSection lang={lang} />
    </div>
  );
}

function SectionHeading({ children }: { children: ReactNode }) {
  return (
    <header className="about-section-heading">
      <h2>{children}</h2>
    </header>
  );
}

function WorkSection({ lang }: { lang: string }) {
  const introEyebrow = useLocalizedSiteContent("about.intro.eyebrow");
  const introTitle = useLocalizedSiteContent("about.intro.title");
  const introBody = useLocalizedSiteContent("about.intro.body");
  const workTitle = useLocalizedSiteContent("about.work.title");
  const pledgeTitle = useLocalizedSiteContent("about.pledges.title");
  const cardCta = useLocalizedSiteContent("about.work.card.cta");
  const scopes: ScopeItem[] = [
    {
      title: useLocalizedSiteContent("about.work.card.1.title"),
      description: useLocalizedSiteContent("about.work.card.1.description"),
      href: "/board/suggestions",
      icon: MessageCircle,
    },
    {
      title: useLocalizedSiteContent("about.work.card.2.title"),
      description: useLocalizedSiteContent("about.work.card.2.description"),
      href: "/board/hoc",
      icon: BookOpen,
    },
    {
      title: useLocalizedSiteContent("about.work.card.3.title"),
      description: useLocalizedSiteContent("about.work.card.3.description"),
      href: "/events",
      icon: Calendar,
    },
  ];

  return (
    <section id="work" className="about-anchor-section about-landing-section about-landing-section-muted">
      <div className="about-landing-container">
        <div className="about-intro-summary" data-about-reveal>
          <span className="about-eyebrow">{introEyebrow}</span>
          <h2>{introTitle}</h2>
          <p className="whitespace-pre-line">{introBody}</p>
        </div>
        <div data-about-reveal>
          <SectionHeading>{workTitle}</SectionHeading>
        </div>
        <div className="about-scope-grid about-reveal-delay-1" data-about-reveal>
          {scopes.map((scope, index) => {
            const ScopeIcon = scope.icon;
            return (
              <Link key={scope.title} className="about-scope-card select-none" to={scope.href}>
                <div className="about-scope-card-top">
                  <span className="about-scope-icon"><ScopeIcon aria-hidden="true" /></span>
                  <span className="about-scope-index">{String(index + 1).padStart(2, "0")}</span>
                </div>
                <span className="about-scope-copy">
                  <strong>{scope.title}</strong>
                  <small>{scope.description}</small>
                </span>
                <span className="about-scope-card-link">
                  {cardCta}
                  <ArrowRight aria-hidden="true" />
                </span>
              </Link>
            );
          })}
        </div>

        <div id="pledges" className="about-work-pledges about-reveal-delay-2" data-about-reveal>
          <h3>{pledgeTitle}</h3>
          <PledgesSection lang={lang} />
        </div>
      </div>
    </section>
  );
}

function PeopleSection({ lang }: { lang: string }) {
  const title = useLocalizedSiteContent("about.organization.title");
  const description = useLocalizedSiteContent("about.organization.description");
  const referenceEyebrow = useLocalizedSiteContent("about.organization.reference.eyebrow");
  const referenceTitle = useLocalizedSiteContent("about.organization.reference.title");
  const organizationChart = usePublicContentBlocksByType("ORGANIZATION_CHART")[0];
  const { departments } = usePublicContactDepartments();
  const departmentItems = departments.length > 0 ? departments : DEFAULT_DEPARTMENTS;
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

        <div className="about-department-grid about-reveal-delay-1" data-about-reveal>
          {departmentItems.map((department, index) => {
            const defaultDepartment = DEFAULT_DEPARTMENTS.find(
              (item) => item.nameKo === department.nameKo,
            );
            const name = lang === "ko"
              ? department.nameKo
              : department.nameEn || defaultDepartment?.nameEn || department.nameKo;
            const description = lang === "ko"
              ? department.descriptionKo || defaultDepartment?.descriptionKo || "이 부서의 주요 역할을 소개합니다."
              : department.descriptionEn || defaultDepartment?.descriptionEn || department.descriptionKo || "Learn about this department's main responsibilities.";
            return (
              <article key={department.id} className="about-department-card">
                <div className="about-department-card-top">
                  <span className="about-department-icon"><Building2 aria-hidden="true" /></span>
                  <span className="about-department-index">{String(index + 1).padStart(2, "0")}</span>
                </div>
                <h3>{name}</h3>
                <p className="about-department-description">{description}</p>
              </article>
            );
          })}
        </div>

        {organizationImage && organizationChart ? (
          <details className="about-org-chart about-reveal-delay-2" data-about-reveal>
            <summary className="about-org-chart-summary select-none">
              <span>
                <small>{referenceEyebrow}</small>
                <strong>{referenceTitle}</strong>
              </span>
              <ChevronDown aria-hidden="true" />
            </summary>
            <div className="about-org-chart-content">
              <img
                src={resolveAssetUrl(organizationImage)}
                alt={lang === "ko" ? "전산학부 집행위원회 전체 조직도" : "Full SoC Student Council organization chart"}
                loading="lazy"
                decoding="async"
              />
            </div>
          </details>
        ) : null}
      </div>
    </section>
  );
}

function PartnershipSection({ lang }: { lang: string }) {
  const title = useLocalizedSiteContent("about.partnership.title");
  const description = useLocalizedSiteContent("about.partnership.description");
  const cta = useLocalizedSiteContent("about.partnership.cta");
  const areas = [
    useLocalizedSiteContent("about.partnership.area.1"),
    useLocalizedSiteContent("about.partnership.area.2"),
    useLocalizedSiteContent("about.partnership.area.3"),
  ];
  const inquiryHref = operationalSurveyPath(OPERATIONAL_SURVEY_IDS.corporatePartnership);

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
            <Link className="about-partnership-link select-none" to={inquiryHref}>
              {cta}
              <ArrowRight aria-hidden="true" />
            </Link>
          </div>
          <ol className="about-partnership-areas about-reveal-delay-1" data-about-reveal>
            {areas.map((area) => (
              <li key={area}>
                <span className="about-partnership-area-icon"><ArrowRight aria-hidden="true" /></span>
                <strong>{area}</strong>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
