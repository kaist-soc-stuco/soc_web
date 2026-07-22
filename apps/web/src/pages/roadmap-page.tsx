import type { LucideIcon } from "lucide-react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  BriefcaseBusiness,
  CircleCheck,
  Code2,
  Compass,
  FlaskConical,
  Info,
  Users,
} from "lucide-react";
import { Link } from "react-router-dom";

import { Footer } from "@/components/organisms/footer";
import { Header } from "@/components/organisms/header";
import { PageHero } from "@/components/organisms/page-hero";
import { useLanguage, type Language } from "@/hooks/use-language";
import { useLocalizedSiteContent } from "@/features/site-content/site-content";

interface LocalizedCopy {
  ko: string;
  en: string;
}

interface RoadmapStage {
  description: LocalizedCopy;
  focus: LocalizedCopy[];
  icon: LucideIcon;
  period: LocalizedCopy;
  title: LocalizedCopy;
}

const ROADMAP_STAGES: RoadmapStage[] = [
  {
    period: { ko: "기초 단계 · 주로 1학년", en: "Foundation · typically Year 1" },
    title: { ko: "전산학의 언어 익히기", en: "Learn the language of computing" },
    description: {
      ko: "프로그래밍과 수리 기초를 다지고, 작은 과제를 끝까지 완성하는 습관을 만듭니다.",
      en: "Build programming and mathematical foundations while learning to complete small assignments with confidence.",
    },
    focus: [
      { ko: "기초 프로그래밍", en: "Programming fundamentals" },
      { ko: "수학·논리 기초", en: "Mathematics and logic" },
      { ko: "학습 도구와 협업 방식", en: "Learning tools and collaboration" },
    ],
    icon: BookOpen,
  },
  {
    period: { ko: "핵심 단계 · 주로 2학년", en: "Core · typically Year 2" },
    title: { ko: "핵심 원리와 구현 연결하기", en: "Connect core concepts to implementation" },
    description: {
      ko: "자료구조, 알고리즘, 시스템과 컴퓨터구조를 배우며 팀 프로젝트 경험을 넓힙니다.",
      en: "Study data structures, algorithms, systems, and computer architecture while expanding team project experience.",
    },
    focus: [
      { ko: "자료구조·알고리즘", en: "Data structures and algorithms" },
      { ko: "시스템·컴퓨터구조", en: "Systems and architecture" },
      { ko: "팀 단위 프로젝트", en: "Team-based projects" },
    ],
    icon: Code2,
  },
  {
    period: { ko: "탐색 단계 · 주로 3학년", en: "Exploration · typically Year 3" },
    title: { ko: "관심 분야를 실제 경험으로 검증하기", en: "Test your interests through real experience" },
    description: {
      ko: "심화 전공을 선택하고 연구실, 인턴십, 학회와 프로젝트를 통해 자신에게 맞는 방향을 탐색합니다.",
      en: "Choose advanced topics and explore possible paths through labs, internships, student groups, and projects.",
    },
    focus: [
      { ko: "심화 전공 탐색", en: "Advanced topic exploration" },
      { ko: "연구실·인턴십 경험", en: "Lab and internship experience" },
      { ko: "학회·대회·학생 활동", en: "Clubs, competitions, and community" },
    ],
    icon: FlaskConical,
  },
  {
    period: { ko: "전환 단계 · 주로 4학년", en: "Transition · typically Year 4" },
    title: { ko: "배운 것을 정리하고 다음 단계 설계하기", en: "Consolidate your work and plan what comes next" },
    description: {
      ko: "졸업 연구와 프로젝트를 마무리하고, 기록해 둔 경험을 바탕으로 진학이나 취업을 준비합니다.",
      en: "Complete graduation research or projects, then use your documented experience to prepare for graduate study or employment.",
    },
    focus: [
      { ko: "졸업 연구·프로젝트", en: "Graduation research and projects" },
      { ko: "포트폴리오 정리", en: "Portfolio development" },
      { ko: "진학·취업 계획", en: "Graduate study or career planning" },
    ],
    icon: BriefcaseBusiness,
  },
];

const SEMESTER_CHECKLIST: LocalizedCopy[] = [
  {
    ko: "선수과목과 해당 학기 개설 여부를 공식 학사 안내에서 확인하기",
    en: "Check prerequisites and semester availability in the official academic guide.",
  },
  {
    ko: "수업 외에 한 가지 프로젝트나 커뮤니티 경험을 선택하기",
    en: "Choose one project or community experience beyond coursework.",
  },
  {
    ko: "관심 분야, 만든 결과물과 배운 점을 짧게 기록하기",
    en: "Keep a short record of interests, outcomes, and lessons learned.",
  },
  {
    ko: "지도교수, 선배 또는 동료와 다음 학기 계획을 점검하기",
    en: "Review the next semester plan with an advisor, senior, or peer.",
  },
];

function copy(value: LocalizedCopy, lang: Language) {
  return value[lang];
}

export function RoadmapPage() {
  const { lang } = useLanguage();
  const title = useLocalizedSiteContent("about.roadmap.title");
  const description = useLocalizedSiteContent("about.roadmap.description");

  return (
    <div className="flex min-h-screen flex-col bg-slate-50/60">
      <Header showLogo />

      <PageHero
        title={title}
        description={description}
        variant="large"
      />

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 md:px-8 md:py-14">
        <Link
          to="/about"
          className="inline-flex min-h-11 items-center gap-2 text-sm font-bold text-kaist-grey transition-colors hover:text-kaist-darkgreen focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kaist-darkgreen"
        >
          <ArrowLeft aria-hidden="true" className="h-4 w-4" />
          {lang === "ko" ? "SOC 소개로 돌아가기" : "Back to About SOC"}
        </Link>

        <section className="mt-5 grid gap-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:grid-cols-[1fr_18rem] md:p-8">
          <div>
            <div className="flex items-center gap-2 text-kaist-darkgreen">
              <Compass aria-hidden="true" className="h-5 w-5" />
              <p className="text-xs font-black uppercase tracking-[0.14em]">
                {lang === "ko" ? "로드맵 활용법" : "How to use this roadmap"}
              </p>
            </div>
            <h2 className="mt-3 text-2xl font-black tracking-tight text-kaist-black">
              {lang === "ko"
                ? "학년보다 현재의 준비 상태를 기준으로 보세요"
                : "Focus on your current readiness, not just your year"}
            </h2>
            <p className="mt-3 max-w-3xl text-sm font-medium leading-7 text-slate-600">
              {lang === "ko"
                ? "아래 단계는 전형적인 흐름을 보여 주지만 정답이나 필수 순서는 아닙니다. 복수전공, 교환학생, 휴학, 연구 참여 등 각자의 상황에 맞춰 앞뒤 단계를 자유롭게 오가도 좋습니다."
                : "The stages below show a common progression, not a required sequence. Move between them as needed for double majors, exchange programs, leaves of absence, research, or your own circumstances."}
            </p>
          </div>

          <aside className="rounded-2xl border border-amber-200 bg-amber-50 p-5" aria-label={lang === "ko" ? "안내" : "Notice"}>
            <div className="flex items-center gap-2 text-amber-900">
              <Info aria-hidden="true" className="h-4 w-4" />
              <h3 className="text-sm font-black">
                {lang === "ko" ? "공식 이수 기준이 아닙니다" : "Not an official degree plan"}
              </h3>
            </div>
            <p className="mt-2 text-xs font-medium leading-5 text-amber-900/80">
              {lang === "ko"
                ? "졸업 요건, 선수과목과 개설 학기는 반드시 최신 학사 안내와 담당 부서에서 확인하세요."
                : "Always confirm graduation requirements, prerequisites, and course availability with the latest academic guide and responsible office."}
            </p>
          </aside>
        </section>

        <section className="mt-12" aria-labelledby="roadmap-stages-title">
          <div className="max-w-3xl">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-kaist-darkgreen">
              {lang === "ko" ? "4단계 흐름" : "Four-stage journey"}
            </p>
            <h2 id="roadmap-stages-title" className="mt-2 text-2xl font-black tracking-tight text-kaist-black md:text-3xl">
              {lang === "ko" ? "학부 생활의 밀도를 높이는 과정" : "Build a richer undergraduate journey"}
            </h2>
            <p className="mt-3 text-sm font-medium leading-7 text-slate-600">
              {lang === "ko"
                ? "수업에서 얻은 지식을 프로젝트와 사람, 실제 문제에 연결할수록 다음 선택이 선명해집니다."
                : "Your next choices become clearer as you connect classroom knowledge with projects, people, and real problems."}
            </p>
          </div>

          <ol className="mt-7 space-y-4">
            {ROADMAP_STAGES.map((stage, index) => {
              const Icon = stage.icon;

              return (
                <li key={stage.title.en} className="grid overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm md:grid-cols-[11rem_1fr]">
                  <div className="flex items-center gap-4 border-b border-slate-100 bg-slate-50 px-5 py-5 md:flex-col md:items-start md:justify-between md:border-b-0 md:border-r md:px-6 md:py-7">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-kaist-darkgreen text-white">
                      <Icon aria-hidden="true" className="h-5 w-5" />
                    </div>
                    <div>
                      <span className="font-outfit text-xs font-black uppercase tracking-[0.14em] text-kaist-darkgreen">
                        {lang === "ko" ? `${index + 1}단계` : `Stage ${index + 1}`}
                      </span>
                      <p className="mt-1 text-xs font-bold leading-5 text-slate-500">
                        {copy(stage.period, lang)}
                      </p>
                    </div>
                  </div>

                  <div className="p-5 md:p-7">
                    <h3 className="text-xl font-black tracking-tight text-kaist-black">
                      {copy(stage.title, lang)}
                    </h3>
                    <p className="mt-2 text-sm font-medium leading-7 text-slate-600">
                      {copy(stage.description, lang)}
                    </p>
                    <ul className="mt-5 flex flex-wrap gap-2">
                      {stage.focus.map((item) => (
                        <li key={item.en} className="rounded-full border border-kaist-darkgreen/15 bg-kaist-lightgreen/10 px-3 py-1.5 text-xs font-bold text-kaist-darkgreen">
                          {copy(item, lang)}
                        </li>
                      ))}
                    </ul>
                  </div>
                </li>
              );
            })}
          </ol>
        </section>

        <section className="mt-12 grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-kaist-lightgreen/15 text-kaist-darkgreen">
                <CircleCheck aria-hidden="true" className="h-5 w-5" />
              </div>
              <h2 className="text-xl font-black text-kaist-black">
                {lang === "ko" ? "학기마다 점검할 것" : "Semester check-in"}
              </h2>
            </div>
            <ul className="mt-6 space-y-4">
              {SEMESTER_CHECKLIST.map((item) => (
                <li key={item.en} className="flex gap-3 text-sm font-medium leading-6 text-slate-600">
                  <span aria-hidden="true" className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-kaist-darkgreen" />
                  {copy(item, lang)}
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-3xl bg-kaist-darkgreen p-6 text-white shadow-sm md:p-8">
            <div className="flex items-center gap-3">
              <Users aria-hidden="true" className="h-5 w-5 text-kaist-lightgreen" />
              <h2 className="text-xl font-black">
                {lang === "ko" ? "SOC에서 다음 정보 찾기" : "Find your next step on SOC"}
              </h2>
            </div>
            <p className="mt-3 text-sm font-medium leading-6 text-white/75">
              {lang === "ko"
                ? "공지와 학생들의 경험을 살펴보고, 행사·설문에 참여하며 학부 생활의 다음 기회를 찾아보세요."
                : "Browse announcements and student experiences, then join events and surveys to find your next opportunity."}
            </p>
            <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              <Link
                to="/board"
                className="inline-flex min-h-11 items-center justify-between rounded-xl bg-white px-4 text-sm font-bold text-kaist-darkgreen transition-colors hover:bg-white/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                {lang === "ko" ? "게시판 둘러보기" : "Browse boards"}
                <ArrowRight aria-hidden="true" className="h-4 w-4" />
              </Link>
              <Link
                to="/events-surveys"
                className="inline-flex min-h-11 items-center justify-between rounded-xl border border-white/25 px-4 text-sm font-bold text-white transition-colors hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                {lang === "ko" ? "행사·설문 보기" : "Events & surveys"}
                <ArrowRight aria-hidden="true" className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
