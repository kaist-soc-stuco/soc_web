import type { ContactRecord } from "@soc/contracts";
import { nowDate } from "@soc/shared";
import type { ReactNode } from "react";
import { ArrowRight, ExternalLink, Mail, Phone } from "lucide-react";
import { Link } from "react-router-dom";

import {
  useLocalizedSiteContent,
  usePublicContentBlocksByType,
} from "@/features/site-content/site-content";
import { resolveAssetUrl } from "@/lib/asset-url";
import { PledgesSection } from "./pledges-section";
import type { AboutSectionId } from "./use-about-page-controller";

const SECTIONS: Array<{
  id: AboutSectionId;
  labelKo: string;
  labelEn: string;
}> = [
  { id: "intro", labelKo: "학생회 소개", labelEn: "About" },
  { id: "history", labelKo: "당해 학생회", labelEn: "Current Council" },
  { id: "org", labelKo: "조직도", labelEn: "Organization" },
  { id: "pledges", labelKo: "공약 이행", labelEn: "Pledges" },
  { id: "members", labelKo: "구성원", labelEn: "Members" },
];

export function AboutLandingHero({ lang }: { lang: string }) {
  return (
    <section className="about-landing-hero" aria-labelledby="about-hero-title">
      <div className="about-landing-container about-landing-hero-inner">
        <div className="about-landing-hero-copy">
          <h1 id="about-hero-title">
            {lang === "ko" ? (
              <>
                <span>전산학부</span>
                <span>학생회 SOC</span>
              </>
            ) : (
              <>
                <span>Student Council</span>
                <span>of Computing</span>
              </>
            )}
          </h1>
          <p>
            {lang === "ko"
              ? "SOC는 KAIST 전산학부 학부생을 대표하는 학생자치기구입니다."
              : "SOC is the student council representing undergraduate students in the KAIST School of Computing."}
          </p>
        </div>
        <figure className="about-landing-hero-media">
          <img
            src="/hero_background2.jpeg"
            alt={lang === "ko" ? "전산학부 학생회 구성원 단체 사진" : "KAIST School of Computing Student Council members"}
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
              className={active ? "is-active" : undefined}
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
  contacts,
  contactsLoading,
  lang,
  onNavigate,
}: {
  contacts: ContactRecord[];
  contactsLoading: boolean;
  lang: string;
  onNavigate: (sectionId: AboutSectionId) => void;
}) {
  return (
    <div data-about-content>
      <IntroSection lang={lang} />
      <CurrentCouncilSection lang={lang} onNavigate={onNavigate} />
      <OrganizationSection lang={lang} />
      <PledgeLandingSection lang={lang} />
      <MembersSection contacts={contacts} contactsLoading={contactsLoading} lang={lang} />
    </div>
  );
}

function SectionHeading({
  children,
  description,
}: {
  children: ReactNode;
  description?: string;
}) {
  return (
    <header className="about-section-heading">
      <h2>{children}</h2>
      {description ? <p>{description}</p> : null}
    </header>
  );
}

function IntroSection({ lang }: { lang: string }) {
  const body = useLocalizedSiteContent("about.intro.body");
  const scopes = lang === "ko"
    ? ["학생 의견 수렴과 공식 답변", "학사·복지 사업", "학술·진로 교류", "행사와 설문 운영"]
    : ["Student feedback and official responses", "Academic affairs and welfare", "Academic and career exchange", "Events and surveys"];

  return (
    <section id="intro" className="about-anchor-section about-landing-section">
      <div className="about-landing-container about-intro-grid">
        <div>
          <SectionHeading>{lang === "ko" ? "우리가 하는 일" : "What we do"}</SectionHeading>
          <p className="about-section-lead">{body}</p>
          <div className="about-inline-links">
            <Link to="/about/roadmap">
              {lang === "ko" ? "전산학부 생활 로드맵" : "Student roadmap"}
              <ArrowRight aria-hidden="true" />
            </Link>
            <Link to="/about/faq">
              FAQ
              <ArrowRight aria-hidden="true" />
            </Link>
          </div>
        </div>
        <ol className="about-scope-list">
          {scopes.map((scope, index) => (
            <li key={scope}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <strong>{scope}</strong>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function CurrentCouncilSection({
  lang,
  onNavigate,
}: {
  lang: string;
  onNavigate: (sectionId: AboutSectionId) => void;
}) {
  const currentYear = nowDate().getFullYear();

  return (
    <section id="history" className="about-anchor-section about-landing-section about-landing-section-muted">
      <div className="about-landing-container about-current-grid">
        <figure className="about-current-media">
          <img
            src="/hero_background3.jpeg"
            alt={lang === "ko" ? "당해 전산학부 학생회 활동 사진" : "Current student council activity"}
            width={3000}
            height={2000}
            loading="lazy"
            decoding="async"
          />
        </figure>
        <div className="about-current-copy">
          <SectionHeading>
            {lang === "ko" ? "당해 학생회" : "Current Council"}
          </SectionHeading>
          <p className="about-current-name">
            {lang === "ko" ? `${currentYear} 전산학부 학생회 SOC` : `${currentYear} SOC Student Council`}
          </p>
          <div className="about-inline-links">
            <Link to="/events">
              {lang === "ko" ? "행사·일정 보기" : "View events"}
              <ArrowRight aria-hidden="true" />
            </Link>
            <a
              href="#pledges"
              onClick={(event) => {
                event.preventDefault();
                onNavigate("pledges");
              }}
            >
              {lang === "ko" ? "공약 이행 보기" : "View pledges"}
              <ArrowRight aria-hidden="true" />
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

function OrganizationSection({ lang }: { lang: string }) {
  const organizationChart = usePublicContentBlocksByType("ORGANIZATION_CHART")[0];
  const organizationImage = organizationChart
    ? lang === "en"
      ? organizationChart.imageUrlEn || organizationChart.imageUrl
      : organizationChart.imageUrl
    : null;

  return (
    <section id="org" className="about-anchor-section about-landing-section">
      <div className="about-landing-container">
        <SectionHeading>
          {lang === "ko" ? "조직도" : "Organization"}
        </SectionHeading>
        {organizationImage && organizationChart ? (
          <a
            className="about-org-image-link"
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
            <span>
              {lang === "ko" ? "원본 크기로 보기" : "Open full size"}
              <ExternalLink aria-hidden="true" />
            </span>
          </a>
        ) : (
          <p className="about-empty-state">
            {lang === "ko" ? "등록된 조직도가 없습니다." : "No organization chart has been published."}
          </p>
        )}
      </div>
    </section>
  );
}

function PledgeLandingSection({ lang }: { lang: string }) {
  return (
    <section id="pledges" className="about-anchor-section about-landing-section about-landing-section-muted">
      <div className="about-landing-container">
        <SectionHeading>
          {lang === "ko" ? "공약 이행 현황" : "Pledge Progress"}
        </SectionHeading>
        <PledgesSection lang={lang} />
      </div>
    </section>
  );
}

function MembersSection({
  contacts,
  contactsLoading,
  lang,
}: {
  contacts: ContactRecord[];
  contactsLoading: boolean;
  lang: string;
}) {
  const groups = Array.from(
    contacts.reduce((result, contact) => {
      const name = (lang === "ko" ? contact.departmentKo : contact.departmentEn)?.trim() || (lang === "ko" ? "집행위원회" : "Executive Committee");
      const members = result.get(name) ?? [];
      members.push(contact);
      result.set(name, members);
      return result;
    }, new Map<string, ContactRecord[]>()),
  ).sort(([, first], [, second]) => (first[0]?.sortOrder ?? 0) - (second[0]?.sortOrder ?? 0));

  return (
    <section id="members" className="about-anchor-section about-landing-section">
      <div className="about-landing-container">
        <SectionHeading>
          {lang === "ko" ? "구성원" : "Members"}
        </SectionHeading>
        {contactsLoading ? (
          <p className="about-empty-state">{lang === "ko" ? "구성원 정보를 불러오는 중입니다." : "Loading members."}</p>
        ) : groups.length === 0 ? (
          <p className="about-empty-state">{lang === "ko" ? "등록된 구성원이 없습니다." : "No members have been published."}</p>
        ) : (
          <div className={`about-member-groups ${groups.length === 1 ? "is-single" : ""}`}>
            {groups.map(([groupName, members]) => (
              <section className="about-member-group" key={groupName}>
                <h3>{groupName}</h3>
                <div>
                  {members.map((contact) => {
                    const name = lang === "ko" ? contact.nameKo : contact.nameEn;
                    const role = lang === "ko" ? contact.roleKo : contact.roleEn;
                    return (
                      <article className="about-member-row" key={contact.id}>
                        <div>
                          <strong>{name}</strong>
                          <span>{role}</span>
                        </div>
                        <div className="about-member-contact">
                          {contact.email ? (
                            <a href={`mailto:${contact.email}`}>
                              <Mail aria-hidden="true" />
                              {contact.email}
                            </a>
                          ) : null}
                          {contact.phoneNumber ? (
                            <a href={`tel:${contact.phoneNumber.replace(/\s/g, "")}`}>
                              <Phone aria-hidden="true" />
                              {contact.phoneNumber}
                            </a>
                          ) : null}
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
