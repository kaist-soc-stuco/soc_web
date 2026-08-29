import { OPERATIONAL_SURVEY_IDS, operationalSurveyPath } from "@soc/contracts";
import { nowDate } from "@soc/shared";
import { useEffect, useRef, type ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

import { usePublicContentBlocksByType } from "@/features/site-content/site-content";
import { resolveAssetUrl } from "@/lib/asset-url";
import { PledgesSection } from "./pledges-section";
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

export function AboutLandingHero({ lang }: { lang: string }) {
  const currentYear = nowDate().getFullYear();

  return (
    <section id="intro" className="about-anchor-section about-landing-hero" aria-labelledby="about-hero-title">
      <div className="about-landing-container about-landing-hero-inner">
        <div className="about-landing-hero-copy">
          <span className="about-hero-term">{currentYear} SoC</span>
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
            <Link className="select-none" to="/events">
              {lang === "ko" ? "행사·일정" : "Events & calendar"}
              <ArrowRight aria-hidden="true" />
            </Link>
            <Link className="select-none" to="/board/건의사항">
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
  const scopes = lang === "ko"
    ? [
        { title: "학생 의견", description: "접수된 의견과 학생회의 답변을 게시판에 공개", href: "/board/건의사항" },
        { title: "학술·진로", description: "선배·연구·진로 교류 프로그램 운영", href: "/board/HoC" },
        { title: "행사·설문", description: "행사 신청, 설문 참여와 주요 일정 안내", href: "/events" },
      ]
    : [
        { title: "Student feedback", description: "Publish submitted feedback and the council's official responses", href: "/board/건의사항" },
        { title: "Academics & careers", description: "Connect students through academic and career programs", href: "/board/HoC" },
        { title: "Events & surveys", description: "Manage registrations, surveys, and important dates", href: "/events" },
      ];

  return (
    <section id="work" className="about-anchor-section about-landing-section about-landing-section-muted">
      <div className="about-landing-container">
        <div data-about-reveal>
          <SectionHeading>{lang === "ko" ? "주요 사업" : "What we do"}</SectionHeading>
        </div>
        <ol className="about-scope-list about-reveal-delay-1" data-about-reveal>
          {scopes.map((scope, index) => (
            <li key={scope.title}>
              <Link className="select-none" to={scope.href}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <span className="about-scope-copy">
                  <strong>{scope.title}</strong>
                  <small>{scope.description}</small>
                </span>
                <ArrowRight aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ol>

        <div className="about-work-pledges" data-about-reveal>
          <h3>{lang === "ko" ? "공약 이행 현황" : "Pledge progress"}</h3>
          <PledgesSection lang={lang} />
        </div>
      </div>
    </section>
  );
}

function PeopleSection({ lang }: { lang: string }) {
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
          <SectionHeading>{lang === "ko" ? "조직도" : "Organization chart"}</SectionHeading>
        </div>

        <div className="about-people-org about-reveal-delay-1" data-about-reveal>
          {organizationImage && organizationChart ? (
            <a
              className="about-org-image-link select-none"
              href={resolveAssetUrl(organizationImage)}
              target="_blank"
              rel="noreferrer"
            >
              <img
                src={resolveAssetUrl(organizationImage)}
                alt={lang === "ko" ? organizationChart.titleKo : organizationChart.titleEn || organizationChart.titleKo}
                loading="lazy"
                decoding="async"
              />
            </a>
          ) : (
            <p className="about-empty-state">
              {lang === "ko" ? "등록된 조직도가 없습니다." : "No organization chart has been published."}
            </p>
          )}
        </div>
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
            {areas.map((area, index) => (
              <li key={area}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <strong>{area}</strong>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
