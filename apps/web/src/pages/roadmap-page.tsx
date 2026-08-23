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
import { useState } from "react";

import { Header } from "@/components/organisms/header";
import { PageHeader, PageShell } from "@/components/ui/page-layout";
import { useLanguage, type Language } from "@/hooks/use-language";
import { useLocalizedSiteContent } from "@/features/site-content/site-content";
import { Button } from "@/components/ui/button";

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

interface RoadmapTrack {
  id: string;
  title: LocalizedCopy;
  description: LocalizedCopy;
  color: string;
  softColor: string;
  courses: Array<{
    code: string;
    name: LocalizedCopy;
    note: LocalizedCopy;
  }>;
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

const ROADMAP_TRACKS: RoadmapTrack[] = [
  {
    id: "data",
    title: { ko: "데이터 과학", en: "Data Science" },
    description: { ko: "데이터를 수집·해석하고 의미 있는 결론으로 연결하는 트랙", en: "Turn data into reliable interpretations and decisions." },
    color: "#ef4444",
    softColor: "#fff1f2",
    courses: [
      { code: "CS101", name: { ko: "프로그래밍 기초", en: "Programming Basics" }, note: { ko: "첫 프로그래밍 언어와 문제 해결", en: "First language and problem solving" } },
      { code: "CS300", name: { ko: "알고리즘 개론", en: "Intro to Algorithms" }, note: { ko: "자료구조와 효율적인 사고", en: "Data structures and efficient thinking" } },
      { code: "CS361", name: { ko: "데이터 사이언스 개론", en: "Intro to Data Science" }, note: { ko: "통계·분석·모델링의 연결", en: "Statistics, analysis, and modeling" } },
      { code: "CS360", name: { ko: "데이터베이스 개론", en: "Intro to Databases" }, note: { ko: "데이터를 안전하게 저장하고 질의하기", en: "Store and query data reliably" } },
    ],
  },
  {
    id: "software",
    title: { ko: "소프트웨어디자인", en: "Software Design" },
    description: { ko: "사용자 문제를 견고한 소프트웨어 구조와 제품으로 구현하는 트랙", en: "Build robust software products around real user problems." },
    color: "#84cc16",
    softColor: "#f7fee7",
    courses: [
      { code: "CS350", name: { ko: "소프트웨어 공학개론", en: "Software Engineering" }, note: { ko: "협업·테스트·유지보수", en: "Collaboration, testing, and maintenance" } },
      { code: "CS453", name: { ko: "소프트웨어 테스팅", en: "Software Testing" }, note: { ko: "자동화된 품질 검증", en: "Automated quality checks" } },
      { code: "CS457", name: { ko: "소프트웨어 요구공학", en: "Software Requirements" }, note: { ko: "문제를 요구사항으로 번역하기", en: "Translate problems into requirements" } },
    ],
  },
  {
    id: "systems",
    title: { ko: "시스템·네트워크", en: "Systems & Networks" },
    description: { ko: "컴퓨터가 실제 환경에서 동작하는 원리와 규모 확장을 탐구하는 트랙", en: "Understand how computers work in real environments and at scale." },
    color: "#f97316",
    softColor: "#fff7ed",
    courses: [
      { code: "CS211", name: { ko: "디지털시스템 및 실험", en: "Digital Systems" }, note: { ko: "논리회로와 하드웨어 기초", en: "Logic circuits and hardware" } },
      { code: "CS310", name: { ko: "대칭 컴퓨터 시스템", en: "Computer Systems" }, note: { ko: "운영체제와 시스템 구조", en: "Operating systems and architecture" } },
      { code: "CS422", name: { ko: "계산이론", en: "Theory of Computation" }, note: { ko: "계산 가능성과 한계", en: "Computability and limits" } },
    ],
  },
  {
    id: "ai",
    title: { ko: "인공지능·정보서비스", en: "AI & Information Services" },
    description: { ko: "학습하는 시스템과 지능형 서비스를 설계하는 트랙", en: "Design learning systems and intelligent information services." },
    color: "#0284c7",
    softColor: "#f0f9ff",
    courses: [
      { code: "CS270", name: { ko: "지능 로봇 프로그래밍", en: "Intelligent Robot Programming" }, note: { ko: "센서·행동·제어", en: "Sensing, behavior, and control" } },
      { code: "CS371", name: { ko: "딥러닝 개론", en: "Introduction to Deep Learning" }, note: { ko: "표현 학습과 신경망", en: "Representation learning and neural networks" } },
      { code: "CS474", name: { ko: "텍스트마이닝", en: "Text Mining" }, note: { ko: "언어 데이터에서 패턴 찾기", en: "Find patterns in language data" } },
    ],
  },
  {
    id: "interactive",
    title: { ko: "인터랙티브컴퓨팅", en: "Interactive Computing" },
    description: { ko: "사람과 컴퓨터가 만나는 경험을 연구하고 구현하는 트랙", en: "Research and build experiences where people meet computers." },
    color: "#7e22ce",
    softColor: "#faf5ff",
    courses: [
      { code: "CS380", name: { ko: "컴퓨터그래픽스 개론", en: "Computer Graphics" }, note: { ko: "이미지·공간·시각화", en: "Images, space, and visualization" } },
      { code: "CS486", name: { ko: "웨어러블 사용자 인터페이스", en: "Wearable User Interfaces" }, note: { ko: "몸과 환경을 고려한 인터랙션", en: "Interaction with body and environment" } },
      { code: "CS473", name: { ko: "소셜컴퓨팅 개론", en: "Social Computing" }, note: { ko: "사람과 커뮤니티를 위한 시스템", en: "Systems for people and communities" } },
    ],
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
  const [selectedTrackId, setSelectedTrackId] = useState(ROADMAP_TRACKS[0].id);
  const title = useLocalizedSiteContent("about.roadmap.title");
  const selectedTrack = ROADMAP_TRACKS.find((track) => track.id === selectedTrackId) ?? ROADMAP_TRACKS[0];

  return (
    <PageShell>
      <Header />

      <PageHeader title={title} />

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 md:px-8 md:py-14">
        <Link
          to="/about"
          className="inline-flex min-h-11 items-center gap-2 text-sm font-bold text-kaist-grey transition-colors hover:text-kaist-darkgreen"
        >
          <ArrowLeft aria-hidden="true" className="h-4 w-4" />
          {lang === "ko" ? "SOC 소개로 돌아가기" : "Back to About SOC"}
        </Link>

        <section className="mt-5 grid gap-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:grid-cols-[1fr_18rem] md:p-8">
          <div>
            <div className="flex items-center gap-2 text-kaist-darkgreen">
              <Compass aria-hidden="true" className="h-5 w-5" />
              <p className="text-xs font-bold uppercase tracking-[0.14em]">
                {lang === "ko" ? "로드맵 활용법" : "How to use this roadmap"}
              </p>
            </div>
            <h2 className="mt-3 text-2xl font-bold tracking-tight text-kaist-black">
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
              <h3 className="text-sm font-bold">
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

        <section className="mt-12" aria-labelledby="roadmap-track-title">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div className="max-w-3xl">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-kaist-darkgreen">
                {lang === "ko" ? "전공 트랙 탐색" : "Explore the tracks"}
              </p>
              <h2 id="roadmap-track-title" className="mt-2 text-2xl font-bold tracking-tight text-kaist-black md:text-3xl">
                {lang === "ko" ? "관심 있는 색을 눌러 과목 흐름을 살펴보세요" : "Select a color to explore a course direction"}
              </h2>
              <p className="mt-3 text-sm font-medium leading-7 text-slate-600">
                {lang === "ko"
                  ? "이미지형 학사 로드맵의 분야 구분을 웹에서 다시 탐색할 수 있도록 구성했습니다. 트랙은 고정된 진로가 아니라 과목을 고르는 관점입니다."
                  : "This interactive view adapts the field map into the web. A track is a lens for choosing courses, not a fixed career path."}
              </p>
            </div>
            <span className="w-fit rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-500">
              {ROADMAP_TRACKS.length}{lang === "ko" ? "개 분야" : " fields"}
            </span>
          </div>

          <div className="mt-7 grid gap-5 lg:grid-cols-[15rem_1fr]">
            <div className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible" role="tablist" aria-label={lang === "ko" ? "전공 분야" : "Computing fields"}>
              {ROADMAP_TRACKS.map((track) => {
                const isSelected = selectedTrack.id === track.id;
                return (
                  <Button variant="ghost"
                    key={track.id}
                    type="button"
                    role="tab"
                    aria-selected={isSelected}
                    onClick={() => setSelectedTrackId(track.id)}
                    className={`flex min-w-[11rem] items-center gap-3 rounded-2xl border px-4 py-3 text-left transition lg:min-w-0 ${
                      isSelected ? "border-slate-300 bg-white shadow-sm" : "border-transparent bg-slate-100/70 hover:border-slate-200 hover:bg-white"
                    }`}
                  >
                    <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: track.color }} aria-hidden="true" />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-bold text-slate-800">{copy(track.title, lang)}</span>
                      <span className="mt-0.5 block text-[11px] font-semibold text-slate-400">{track.courses.length}{lang === "ko" ? "개 대표 과목" : " sample courses"}</span>
                    </span>
                  </Button>
                );
              })}
            </div>

            <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm" role="tabpanel" style={{ background: `linear-gradient(135deg, ${selectedTrack.softColor}, #ffffff 62%)` }}>
              <div className="border-b border-white/80 px-6 py-6 md:px-8">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="h-3 w-3 rounded-full" style={{ backgroundColor: selectedTrack.color }} aria-hidden="true" />
                      <span className="text-xs font-bold uppercase tracking-[0.14em]" style={{ color: selectedTrack.color }}>
                        {lang === "ko" ? "관심 분야" : "Focus area"}
                      </span>
                    </div>
                    <h3 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">{copy(selectedTrack.title, lang)}</h3>
                    <p className="mt-2 max-w-2xl text-sm font-medium leading-6 text-slate-600">{copy(selectedTrack.description, lang)}</p>
                  </div>
                  <div className="hidden rounded-2xl bg-white/80 px-3 py-2 text-right shadow-sm sm:block">
                    <span className="block text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">{lang === "ko" ? "탐색 순서" : "Flow"}</span>
                    <span className="mt-1 block text-sm font-bold text-slate-700">기초 → 핵심 → 응용</span>
                  </div>
                </div>
              </div>
              <ol className="grid gap-3 p-5 md:grid-cols-2 md:p-8">
                {selectedTrack.courses.map((course, index) => (
                  <li key={course.code} className="relative rounded-2xl border border-white/90 bg-white/90 p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                    <div className="flex items-start justify-between gap-3">
                      <span className="rounded-lg px-2.5 py-1 text-xs font-bold text-white" style={{ backgroundColor: selectedTrack.color }}>
                        {course.code}
                      </span>
                      <span className="text-xs font-bold text-slate-400">{String(index + 1).padStart(2, "0")}</span>
                    </div>
                    <h4 className="mt-4 text-base font-bold text-slate-800">{copy(course.name, lang)}</h4>
                    <p className="mt-2 text-xs font-semibold leading-5 text-slate-500">{copy(course.note, lang)}</p>
                    {index < selectedTrack.courses.length - 1 && (
                      <span className="absolute -bottom-3 left-1/2 z-10 hidden h-6 w-px bg-slate-200 md:block" aria-hidden="true" />
                    )}
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>

        <section className="mt-12" aria-labelledby="roadmap-stages-title">
          <div className="max-w-3xl">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-kaist-darkgreen">
              {lang === "ko" ? "4단계 흐름" : "Four-stage journey"}
            </p>
            <h2 id="roadmap-stages-title" className="mt-2 text-2xl font-bold tracking-tight text-kaist-black md:text-3xl">
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
                      <span className="text-xs font-bold uppercase tracking-[0.14em] text-kaist-darkgreen">
                        {lang === "ko" ? `${index + 1}단계` : `Stage ${index + 1}`}
                      </span>
                      <p className="mt-1 text-xs font-bold leading-5 text-slate-500">
                        {copy(stage.period, lang)}
                      </p>
                    </div>
                  </div>

                  <div className="p-5 md:p-7">
                    <h3 className="text-xl font-bold tracking-tight text-kaist-black">
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
              <h2 className="text-xl font-bold text-kaist-black">
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
              <h2 className="text-xl font-bold">
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
                className="inline-flex min-h-11 items-center justify-between rounded-xl bg-white px-4 text-sm font-bold text-kaist-darkgreen transition-colors hover:bg-white/90"
              >
                {lang === "ko" ? "게시판 둘러보기" : "Browse boards"}
                <ArrowRight aria-hidden="true" className="h-4 w-4" />
              </Link>
              <Link
                to="/events"
                className="inline-flex min-h-11 items-center justify-between rounded-xl border border-white/25 px-4 text-sm font-bold text-white transition-colors hover:bg-white/10"
              >
                {lang === "ko" ? "행사·설문 보기" : "Events & surveys"}
                <ArrowRight aria-hidden="true" className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </section>
      </main>

    </PageShell>
  );
}
