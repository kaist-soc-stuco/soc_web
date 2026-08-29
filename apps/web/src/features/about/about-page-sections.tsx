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
  labelKo: string;
  labelEn: string;
}> = [
  { id: "intro", labelKo: "소개", labelEn: "About" },
  { id: "work", labelKo: "주요 사업", labelEn: "What we do" },
  { id: "people", labelKo: "조직도", labelEn: "Organization chart" },
  { id: "partnership", labelKo: "후원 및 제휴", labelEn: "Partnerships" },
];

const DEFAULT_DEPARTMENTS = [
  {
    id: "presidium",
    nameKo: "회장단",
    nameEn: "Presidium",
    descriptionKo: "학생회 주요 방향을 설정하고 학부생의 의견을 바탕으로 의사 결정합니다.",
    descriptionEn: "Set the council's direction and make decisions grounded in undergraduate feedback.",
  },
  {
    id: "secretariat",
    nameKo: "비서실",
    nameEn: "Secretariat",
    descriptionKo: "회의와 행정을 지원하고 공지·기록을 체계적으로 관리합니다.",
    descriptionEn: "Support meetings and administration while keeping notices and records organized.",
  },
  {
    id: "communications",
    nameKo: "대외소통부",
    nameEn: "External Communications",
    descriptionKo: "학부와 외부 커뮤니케이션을 담당하고 행사와 학생회 소식을 알립니다.",
    descriptionEn: "Lead communications with the department and external partners and share council news.",
  },
  {
    id: "planning",
    nameKo: "기획부",
    nameEn: "Planning Division",
    descriptionKo: "축제·간식 행사와 학부생을 위한 프로그램을 기획하고 운영합니다.",
    descriptionEn: "Plan and run festivals, snack events, and programs for School of Computing students.",
  },
  {
    id: "it-administration",
    nameKo: "전산관리부",
    nameEn: "IT Administration",
    descriptionKo: "포털 개발 및 인프라 운영, 시스템 관리를 담당합니다.",
    descriptionEn: "Develop and operate the portal, infrastructure, and council systems.",
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

  return (
    <section id="intro" className="about-anchor-section about-landing-hero" aria-labelledby="about-hero-title">
      <div className="about-landing-container about-landing-hero-inner">
        <div className="about-landing-hero-copy">
          <span className="about-hero-term">{currentYear} SoC StuCo</span>
          <h1 id="about-hero-title">
            {lang === "ko" ? (
              <>
                <span>전산학부</span>
                <span>집행위원회</span>
              </>
            ) : (
              <>
                <span>SoC Student</span>
                <span>Council</span>
              </>
            )}
          </h1>
          <p>
            {lang === "ko"
              ? "KAIST 전산학부 학부생을 대표하는 학생자치기구 집행위원회입니다."
              : "SoC Student Council representing KAIST School of Computing undergraduates"}
          </p>
          <div className="about-hero-links">
            <Link className="about-hero-cta about-hero-cta-primary select-none" to="/events">
              {lang === "ko" ? "행사·일정" : "Events & calendar"}
              <ArrowRight aria-hidden="true" />
            </Link>
            <Link className="about-hero-cta about-hero-cta-secondary select-none" to="/board/suggestions">
              {lang === "ko" ? "건의사항" : "Suggestions"}
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
  return (
    <nav className="about-section-nav" aria-label={lang === "ko" ? "학생회 소개 목차" : "About page sections"}>
      <div className="about-landing-container about-section-nav-inner">
        {SECTIONS.map((section) => {
          const active = activeSection === section.id;
          return (
            <a
              key={section.id}
              href={`#${section.id}`}
              aria-current={active ? "location" : undefined}
              className={active ? "is-active select-none" : "select-none"}
              onClick={(event) => {
                event.preventDefault();
                onNavigate(section.id);
              }}
            >
              {lang === "ko" ? section.labelKo : section.labelEn}
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
  const introTitle = useLocalizedSiteContent("about.intro.title");
  const introBody = useLocalizedSiteContent("about.intro.body");
  const scopes: ScopeItem[] = lang === "ko"
    ? [
        { title: "학생 의견", description: "학생 의견을 접수하고 공식 답변과 처리 현황을 공개", href: "/board/suggestions", icon: MessageCircle },
        { title: "학술·진로", description: "학술·진로 정보를 나누고 교류 프로그램을 운영", href: "/board/hoc", icon: BookOpen },
        { title: "행사·설문", description: "행사·설문을 운영하고 참여에 필요한 정보를 안내", href: "/events", icon: Calendar },
      ]
    : [
        { title: "Student feedback", description: "Collect feedback and publish official responses and progress", href: "/board/suggestions", icon: MessageCircle },
        { title: "Academics & careers", description: "Share academic and career information through exchange programs", href: "/board/hoc", icon: BookOpen },
        { title: "Events & surveys", description: "Run events and surveys with clear participation guidance", href: "/events", icon: Calendar },
      ];

  return (
    <section id="work" className="about-anchor-section about-landing-section about-landing-section-muted">
      <div className="about-landing-container">
        <div className="about-intro-summary" data-about-reveal>
          <span className="about-eyebrow">{lang === "ko" ? "집행위원회 소개" : "ABOUT STUDENT COUNCIL"}</span>
          <h2>{introTitle}</h2>
          <p>{introBody}</p>
        </div>
        <div data-about-reveal>
          <SectionHeading>{lang === "ko" ? "주요 사업" : "What we do"}</SectionHeading>
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
                  {lang === "ko" ? "자세히 보기" : "Explore"}
                  <ArrowRight aria-hidden="true" />
                </span>
              </Link>
            );
          })}
        </div>

        <div className="about-work-pledges about-reveal-delay-2" data-about-reveal>
          <h3>{lang === "ko" ? "공약 이행 현황" : "Pledge progress"}</h3>
          <PledgesSection lang={lang} />
        </div>
      </div>
    </section>
  );
}

function PeopleSection({ lang }: { lang: string }) {
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
          <SectionHeading>{lang === "ko" ? "조직도" : "Organization chart"}</SectionHeading>
          <p className="about-section-lead">
            {lang === "ko" ? "전산학부 집행위원회는 부서별 역할을 바탕으로 학부생을 지원합니다." : "The SoC Student Council supports students through focused departments."}
          </p>
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
                <small>{lang === "ko" ? "참고 자료" : "REFERENCE"}</small>
                <strong>{lang === "ko" ? "전체 조직 구조" : "Full organization structure"}</strong>
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
  const inquiryHref = operationalSurveyPath(OPERATIONAL_SURVEY_IDS.corporatePartnership);
  const areas = lang === "ko"
    ? ["행사 후원", "채용·기술 세션", "공동 프로그램"]
    : ["Event sponsorship", "Recruiting and technical sessions", "Joint programs"];

  return (
    <section
      id="partnership"
      className="about-anchor-section about-landing-section about-landing-section-muted"
    >
      <div className="about-landing-container">
        <div className="about-partnership-layout">
          <div data-about-reveal>
            <SectionHeading>{lang === "ko" ? "후원 및 제휴" : "Partnerships"}</SectionHeading>
            <p className="about-partnership-description">
              {lang === "ko"
                ? "전산학부 학생과 연결되는 행사, 세션과 공동 프로그램 제안을 받습니다. 담당자 연락처와 제안 내용을 남겨 주세요."
                : "We welcome proposals for events, sessions, and joint programs that connect with School of Computing students."}
            </p>
            <Link className="about-partnership-link select-none" to={inquiryHref}>
              {lang === "ko" ? "후원·제휴 문의하기" : "Submit an inquiry"}
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
