import type { ContactRecord } from "@soc/contracts";
import type { ReactNode } from "react";
import {
  ArrowRight,
  Award,
  Calendar,
  Compass,
  Info,
  Mail,
  Network,
  Phone,
  Target,
  User,
} from "lucide-react";
import { Link } from "react-router-dom";

import { useLocalizedSiteContent, usePublicContentBlocksByType } from "@/features/site-content/site-content";
import { resolveAssetUrl } from "@/lib/asset-url";
import { Button } from "@/components/ui/button";
import { PageTabButton, PageTabs, PageToolbar } from "@/components/ui/page-layout";
import { PledgesSection } from "./pledges-section";

const TABS = [
  { id: "intro", labelKo: "학생회 소개", labelEn: "About", icon: Info },
  { id: "history", labelKo: "당해 학생회 소개", labelEn: "Current Council", icon: Calendar },
  { id: "org", labelKo: "조직도", labelEn: "Organization Chart", icon: Network },
  { id: "pledges", labelKo: "공약 이행 현황", labelEn: "Pledge Progress", icon: Target },
  { id: "members", labelKo: "구성원", labelEn: "Members", icon: User },
];

export function AboutTabs({
  currentTab,
  lang,
  onTabChange,
}: {
  currentTab: string;
  lang: string;
  onTabChange: (tab: string) => void;
}) {
  return (
    <PageToolbar containerClassName="!max-w-[var(--ui-about-max-width)]">
      <PageTabs aria-label={lang === "ko" ? "학생회 소개 분류" : "Student council sections"}>
        {TABS.map((tab) => {
          const isActive = currentTab === tab.id;
          return (
            <PageTabButton
              key={tab.id}
              active={isActive}
              onClick={() => onTabChange(tab.id)}
            >
              {lang === "ko" ? tab.labelKo : tab.labelEn}
            </PageTabButton>
          );
        })}
      </PageTabs>
    </PageToolbar>
  );
}

export function AboutTabContent({
  contacts,
  contactsLoading,
  currentTab,
  lang,
}: {
  contacts: ContactRecord[];
  contactsLoading: boolean;
  currentTab: string;
  lang: string;
}) {
  return (
    <main className="mx-auto w-full max-w-[var(--ui-about-max-width)] flex-1 px-[var(--ui-space-page-x)] py-12 md:px-[var(--ui-space-page-x-wide)]">
      <div className="w-full min-h-[400px] rounded-3xl border border-gray-200 bg-white p-6 shadow-xs md:p-12">
        {currentTab === "intro" && <IntroSection lang={lang} />}
        {currentTab === "history" && <HistorySection lang={lang} />}
        {currentTab === "org" && <OrgSection lang={lang} />}
        {currentTab === "pledges" && <PledgesSection lang={lang} />}
        {currentTab === "members" && (
          <MembersSection
            contacts={contacts}
            contactsLoading={contactsLoading}
            lang={lang}
          />
        )}
      </div>
    </main>
  );
}

function IntroSection({ lang }: { lang: string }) {
  const title = useLocalizedSiteContent("about.intro.title");
  const body = useLocalizedSiteContent("about.intro.body");

  return (
    <div className="animate-in space-y-12 fade-in duration-300">
      <div className="space-y-4">
        <h2 className="text-2xl font-bold text-kaist-black">{title}</h2>
        <p className="text-base font-medium leading-relaxed text-gray-700">
          {body}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 border-t border-gray-100 pt-6 md:grid-cols-3">
        <ValueCard
          description={
            lang === "ko"
              ? "학생들의 요구와 건의사항에 귀 기울이고 신속하게 피드백을 전달하여 원활한 소통 창구 역할을 수행합니다."
              : "We listen to students' needs and feedback rapidly, serving as a reliable communication channel."
          }
          icon={<Target className="h-5 w-5" />}
          title={lang === "ko" ? "신속한 소통" : "Responsive Communication"}
        />
        <ValueCard
          description={
            lang === "ko"
              ? "연구실 탐방, 멘토링 프로그램, 전산 세미나 개최 등을 통해 전산학도로서의 학술적 성장을 돕습니다."
              : "We foster academic growth through lab tours, mentoring, and hosting computing seminars."
          }
          icon={<Award className="h-5 w-5" />}
          title={lang === "ko" ? "학업 및 진로 지원" : "Academic & Career Support"}
        />
        <ValueCard
          description={
            lang === "ko"
              ? "바비큐 파티, 야식 이벤트, 전산인의 밤 등 다채로운 친목 및 교류 행사를 마련하여 소속감을 높입니다."
              : "We build a strong community through social events such as BBQ gatherings, late-night snack events, and SOC Night."
          }
          icon={<User className="h-5 w-5" />}
          title={lang === "ko" ? "즐거운 문화 행사" : "Community Events"}
        />
      </div>

      <div className="flex flex-col gap-5 rounded-2xl border border-kaist-darkgreen/15 bg-kaist-lightgreen/10 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-kaist-darkgreen shadow-sm">
            <Compass aria-hidden="true" className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-bold text-kaist-black">
              {lang === "ko"
                ? "전산학부 생활 로드맵"
                : "School of Computing Journey Roadmap"}
            </h3>
            <p className="mt-1 text-sm leading-6 text-gray-600">
              {lang === "ko"
                ? "수업, 프로젝트, 연구와 진로 탐색을 단계별로 살펴보세요."
                : "Explore coursework, projects, research, and career planning by stage."}
            </p>
          </div>
        </div>
        <Link
          to="/about/roadmap"
          className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-kaist-darkgreen px-5 text-sm font-bold text-white transition-colors hover:bg-kaist-darkgreen/90"
        >
          {lang === "ko" ? "로드맵 보기" : "View roadmap"}
          <ArrowRight aria-hidden="true" className="h-4 w-4" />
        </Link>
      </div>

      <div className="flex flex-col gap-4 border-t border-gray-100 pt-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="font-bold text-kaist-black">
            FAQ
          </h3>
          <p className="mt-1 text-sm leading-6 text-gray-600">
            {lang === "ko"
              ? "로그인, 비밀글, 행사·일정 이용 방법을 확인하세요."
              : "Find guidance on login, secret posts, events, and the calendar."}
          </p>
        </div>
        <Link
          to="/about/faq"
          className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-md border border-kaist-darkgreen/20 bg-white px-4 text-sm font-bold text-kaist-darkgreen transition-colors hover:bg-kaist-lightgreen/10"
        >
          {lang === "ko" ? "FAQ 보기" : "View FAQ"}
          <ArrowRight aria-hidden="true" className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}

function ValueCard({
  description,
  icon,
  title,
}: {
  description: string;
  icon: ReactNode;
  title: string;
}) {
  return (
    <div className="space-y-3 rounded-2xl bg-slate-50 p-6">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-kaist-lightgreen/20 text-kaist-darkgreen">
        {icon}
      </div>
      <h3 className="font-bold text-kaist-black">{title}</h3>
      <p className="text-xs leading-relaxed text-gray-600">{description}</p>
    </div>
  );
}

function HistorySection({ lang }: { lang: string }) {
  return (
    <div className="animate-in space-y-8 fade-in duration-300">
      <h2 className="mb-8 text-2xl font-bold text-kaist-black">
        {lang === "ko" ? "당해 학생회 소개" : "Current Council"}
      </h2>
      <p className="max-w-2xl text-sm font-medium leading-6 text-gray-600">
        {lang === "ko"
          ? "현재 집행위원회가 이번 학기에 집중하고 있는 방향과 주요 활동을 소개합니다. 세부 일정과 진행 상황은 행사·일정 및 공약 이행 현황에서 계속 업데이트합니다."
          : "This section introduces the current executive committee’s focus and activities for the term. Events and pledge progress are updated in their respective sections."}
      </p>
      <div className="relative ml-2 space-y-10 border-l-2 border-kaist-lightgreen pl-6">
        <TimelineItem
          description={
            lang === "ko"
              ? "학생 회비 관리, 설문 조사 및 학생 소통이 결합된 통합 플랫폼 'SOC Web' 개발 및 정식 출시"
              : "Development and official launch of 'SOC Web' platform combining fee management, survey, and student interactions."
          }
          title={
            lang === "ko"
              ? "통합 학생 커뮤니티 및 정보 시스템 오픈"
              : "Integrated Student Community & Info System Launch"
          }
          year="2026"
        />
        <TimelineItem
          description={
            lang === "ko"
              ? "전산학부 연구실 오픈하우스 확대 운영 및 1:1 선배 학업 멘토링 프로그램 신설"
              : "Expanded the School of Computing Research Lab Open House and established 1:1 academic mentoring."
          }
          title={
            lang === "ko"
              ? "연구/학술 멘토링 및 세미나 확대"
              : "Expanding Research/Academic Mentoring & Seminars"
          }
          year="2025"
        />
        <TimelineItem
          description={
            lang === "ko"
              ? "대규모 바비큐 파티 및 전산인의 밤 행사 재개, 타 학과와의 융합 세미나 추진"
              : "Resumed large-scale BBQ parties and School of Computing Night, and promoted joint seminars with other departments."
          }
          title={
            lang === "ko"
              ? "전산학부 창립 행사 및 교류회 활성화"
              : "SOC Community Events & Student Exchange"
          }
          year="2024"
        />
      </div>
    </div>
  );
}

function TimelineItem({
  description,
  title,
  year,
}: {
  description: string;
  title: string;
  year: string;
}) {
  return (
    <div className="relative">
      <div className="absolute -left-[31px] top-1.5 h-4 w-4 rounded-full border-4 border-white bg-kaist-darkgreen shadow-sm" />
      <span className="text-lg font-bold text-kaist-darkgreen">
        {year}
      </span>
      <h3 className="mt-1 font-bold text-kaist-black">{title}</h3>
      <p className="mt-1 text-xs text-kaist-grey">{description}</p>
    </div>
  );
}

function OrgSection({ lang }: { lang: string }) {
  const organizationChart = usePublicContentBlocksByType("ORGANIZATION_CHART")[0];

  if (organizationChart?.imageUrl) {
    return (
      <div className="animate-in space-y-6 fade-in duration-300">
        <h2 className="text-2xl font-bold text-kaist-black">
          {lang === "ko" ? "조직도" : "Organization Chart"}
        </h2>
        <figure className="overflow-hidden rounded-xl bg-white">
          <img
            src={resolveAssetUrl(organizationChart.imageUrl)}
            alt={lang === "ko" ? organizationChart.titleKo : organizationChart.titleEn || organizationChart.titleKo}
            className="block h-auto max-h-[70vh] w-full object-contain"
          />
        </figure>
      </div>
    );
  }

  return (
    <div className="animate-in space-y-6 fade-in duration-300">
      <h2 className="text-2xl font-bold text-kaist-black">
        {lang === "ko" ? "조직도" : "Organization Chart"}
      </h2>
      <p className="rounded-xl border border-[#e5e9ec] bg-white px-5 py-12 text-center text-sm font-normal text-[#344054]">
        {lang === "ko" ? "등록된 조직도가 없습니다." : "No organization chart has been published."}
      </p>
    </div>
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
  return (
    <div className="animate-in space-y-8 fade-in duration-300">
      <h2 className="text-2xl font-bold text-kaist-black">
        {lang === "ko" ? "집행위원회 구성원" : "Executive Committee Members"}
      </h2>
      <p className="-mt-4 text-sm text-kaist-grey">
        {lang === "ko"
          ? "이번 학기 KAIST 전산학부 발전을 위해 활동하고 있는 집행위원회 명단입니다."
          : "Members of the student council executive committee working for School of Computing."}
      </p>

      {contactsLoading ? (
        <MembersStatus>
          {lang === "ko" ? "구성원 정보를 불러오는 중..." : "Loading members..."}
        </MembersStatus>
      ) : contacts.length === 0 ? (
        <MembersStatus>
          {lang === "ko" ? "등록된 구성원이 없습니다." : "No members registered."}
        </MembersStatus>
      ) : (
        <div className="space-y-10 pt-4">
          {Array.from(
            contacts.reduce((groups, contact) => {
              const groupName = (lang === "ko" ? contact.departmentKo : contact.departmentEn)?.trim() ?? "";
              const group = groups.get(groupName) ?? [];
              group.push(contact);
              groups.set(groupName, group);
              return groups;
            }, new Map<string, ContactRecord[]>()),
          )
            .sort(([, firstMembers], [, secondMembers]) => (firstMembers[0]?.sortOrder ?? 0) - (secondMembers[0]?.sortOrder ?? 0))
            .map(([groupName, groupMembers]) => (
              <section key={groupName || "ungrouped"} className="space-y-4">
                {groupName ? <h3 className="text-base font-semibold text-slate-800">{groupName}</h3> : null}
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
                  {groupMembers.map((contact) => <MemberCard contact={contact} key={contact.id} lang={lang} />)}
                </div>
              </section>
            ))}
        </div>
      )}
    </div>
  );
}

function MembersStatus({ children }: { children: ReactNode }) {
  return (
    <div className="py-12 text-center font-medium text-kaist-grey/60">
      {children}
    </div>
  );
}

function MemberCard({
  contact,
  lang,
}: {
  contact: ContactRecord;
  lang: string;
}) {
  const name = lang === "ko" ? contact.nameKo : contact.nameEn;
  const role = lang === "ko" ? contact.roleKo : contact.roleEn;

  return (
    <div className="flex min-h-56 flex-col rounded-2xl border border-slate-200 bg-white p-5 transition-[background-color,box-shadow,transform] duration-150 hover:-translate-y-0.5 hover:bg-slate-50/60 hover:shadow-xs">
      <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-kaist-lightgreen/20 text-lg font-semibold text-kaist-darkgreen">
        {contact.avatarStorageKey ? (
          <img src={resolveAssetUrl(contact.avatarStorageKey)} alt="" className="size-full object-cover" />
        ) : name.slice(0, 1) || <User className="h-6 w-6" />}
      </div>
      <div className="mt-4 min-w-0 space-y-1.5">
        <div className="truncate text-base font-semibold text-kaist-black">
          {name}
        </div>
        <div className="text-sm font-medium text-slate-600">{role}</div>
        <div className="space-y-1 pt-2">
          {contact.email && (
            <div className="flex items-center gap-2 text-xs text-gray-600">
              <Mail className="h-3.5 w-3.5 shrink-0 text-kaist-greygreen" />
              <span className="truncate">{contact.email}</span>
            </div>
          )}
          {contact.phoneNumber && (
            <div className="flex items-center gap-2 text-xs text-gray-600">
              <Phone className="h-3.5 w-3.5 shrink-0 text-kaist-greygreen" />
              <span>{contact.phoneNumber}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
