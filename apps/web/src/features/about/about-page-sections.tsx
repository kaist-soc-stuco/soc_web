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

import { useLocalizedSiteContent } from "@/features/site-content/site-content";

const TABS = [
  { id: "intro", labelKo: "소개", labelEn: "Intro", icon: Info },
  { id: "history", labelKo: "연혁", labelEn: "History", icon: Calendar },
  { id: "org", labelKo: "조직도", labelEn: "Org Chart", icon: Network },
  { id: "members", labelKo: "구성원", labelEn: "Members", icon: User },
];

export function AboutHero() {
  const description = useLocalizedSiteContent("about.hero.description");

  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-kaist-darkgreen to-[#002613] px-4 py-16 text-center text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(113,185,141,0.15),transparent)]" />
      <div className="relative z-10 mx-auto max-w-4xl animate-in space-y-4 fade-in slide-in-from-bottom-6 duration-500">
        <h1 className="font-outfit text-4xl font-black tracking-tight md:text-5xl">
          KAIST SOC
        </h1>
        <p className="text-lg font-medium tracking-wide text-white/80 md:text-xl">
          {description}
        </p>
      </div>
    </section>
  );
}

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
    <div className="sticky top-0 z-30 border-b border-gray-200 bg-white shadow-xs">
      <div className="mx-auto max-w-4xl px-4">
        <div className="flex justify-between gap-1 overflow-x-auto py-3 md:justify-start md:gap-8">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = currentTab === tab.id;

            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={`flex shrink-0 cursor-pointer items-center gap-2 rounded-xl border-0 px-4 py-2.5 text-sm font-bold transition-all ${
                  isActive
                    ? "bg-kaist-darkgreen text-white shadow-md shadow-kaist-darkgreen/10"
                    : "bg-transparent text-kaist-grey hover:bg-gray-50 hover:text-kaist-darkgreen"
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{lang === "ko" ? tab.labelKo : tab.labelEn}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
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
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-12">
      <div className="min-h-[400px] rounded-3xl border border-gray-200 bg-white p-6 shadow-xs md:p-12">
        {currentTab === "intro" && <IntroSection lang={lang} />}
        {currentTab === "history" && <HistorySection lang={lang} />}
        {currentTab === "org" && <OrgSection lang={lang} />}
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
        <h2 className="text-2xl font-black text-kaist-black">{title}</h2>
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
          title={lang === "ko" ? "신속한 소통" : "Fast Communication"}
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
          title={lang === "ko" ? "즐거운 문화 행사" : "Enriching Culture Events"}
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
          className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-kaist-darkgreen px-5 text-sm font-bold text-white transition-colors hover:bg-kaist-darkgreen/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kaist-darkgreen"
        >
          {lang === "ko" ? "로드맵 보기" : "View roadmap"}
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
      <h2 className="mb-8 text-2xl font-black text-kaist-black">
        {lang === "ko" ? "연혁 및 주요 활동" : "Milestones & Major Activities"}
      </h2>
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
      <span className="font-outfit text-lg font-black text-kaist-darkgreen">
        {year}
      </span>
      <h3 className="mt-1 font-bold text-kaist-black">{title}</h3>
      <p className="mt-1 text-xs text-kaist-grey">{description}</p>
    </div>
  );
}

function OrgSection({ lang }: { lang: string }) {
  return (
    <div className="animate-in space-y-8 fade-in duration-300">
      <h2 className="mb-8 text-2xl font-black text-kaist-black">
        {lang === "ko" ? "조직도" : "Organization Chart"}
      </h2>
      <div className="flex flex-col items-center space-y-8 pt-4">
        <div className="max-w-xs rounded-2xl border border-kaist-darkgreen/20 bg-gradient-to-r from-kaist-darkgreen to-kaist-darkgreen/80 px-8 py-3 text-center text-white shadow-md">
          <div className="text-xs font-semibold opacity-75">
            {lang === "ko" ? "학생 대표단" : "Representatives"}
          </div>
          <div className="mt-0.5 font-bold">
            {lang === "ko"
              ? "집행위원회장 & 부집행위원회장"
              : "President & Vice President"}
          </div>
        </div>
        <div className="h-8 w-0.5 bg-gray-200" />
        <div className="grid w-full grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-4">
          <DepartmentCard
            description={
              lang === "ko"
                ? "간담회, 세미나, 친목 행사 등 주요 이벤트를 총괄 및 기획합니다."
                : "Plans major events such as townhalls, seminars, and socials."
            }
            title={lang === "ko" ? "기획국" : "Planning"}
          />
          <DepartmentCard
            description={
              lang === "ko"
                ? "집행위원회비 정산, 예결산 공고 등 투명한 재정을 담당합니다."
                : "Manages student fees, budget announcements, and finances."
            }
            title={lang === "ko" ? "사무/재정국" : "Finance"}
          />
          <DepartmentCard
            description={
              lang === "ko"
                ? "집행위원회 디자인 자산 제작 및 SNS 홍보 채널을 운영합니다."
                : "Produces student council graphics and manages social media channels."
            }
            title={lang === "ko" ? "홍보/디자인국" : "Content & Design"}
          />
          <DepartmentCard
            description={
              lang === "ko"
                ? "학생 커뮤니티, 챗봇, 자동화 도구 등 시스템 인프라를 운영합니다."
                : "Maintains computing system infrastructures, community apps, and bots."
            }
            title={lang === "ko" ? "기술지원국" : "Technical Support"}
          />
        </div>
      </div>
    </div>
  );
}

function DepartmentCard({
  description,
  title,
}: {
  description: string;
  title: string;
}) {
  return (
    <div className="space-y-2 rounded-2xl border border-gray-100 bg-slate-50 p-5 text-center">
      <h3 className="text-sm font-bold text-kaist-black">{title}</h3>
      <p className="text-xs leading-relaxed text-gray-500">{description}</p>
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
      <h2 className="text-2xl font-black text-kaist-black">
        {lang === "ko" ? "집행위원회 구성원" : "Executive Committee Members"}
      </h2>
      <p className="-mt-4 text-sm text-kaist-grey">
        {lang === "ko"
          ? "이번 학기 KAIST 전산학부 발전을 위해 활동하고 있는 집행위원회 집행위원회 명단입니다."
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
        <div className="grid grid-cols-1 gap-6 pt-4 md:grid-cols-2">
          {contacts.map((contact) => (
            <MemberCard contact={contact} key={contact.id} lang={lang} />
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
    <div className="flex items-start gap-4 rounded-2xl border border-gray-100 bg-slate-50/50 p-6 transition-all hover:bg-slate-50 hover:shadow-xs">
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-kaist-lightgreen/20 text-kaist-darkgreen">
        <User className="h-6 w-6" />
      </div>
      <div className="min-w-0 space-y-1.5">
        <div className="truncate text-base font-black text-kaist-black">
          {name}
        </div>
        <div className="text-xs font-bold text-kaist-darkgreen">{role}</div>
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
