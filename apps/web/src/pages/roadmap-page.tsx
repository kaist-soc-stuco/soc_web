import { ExternalLink, Info } from "lucide-react";
import { useSearchParams } from "react-router-dom";

import { Header } from "@/components/organisms/header";
import { PageContainer, PageHeader, PageMain, PageShell } from "@/components/ui/page-layout";
import { RoadmapGraph } from "@/features/roadmap/roadmap-graph";
import {
  ROADMAP_COURSE_BY_CODE,
  ROADMAP_SOURCE,
} from "@/features/roadmap/roadmap-data";
import { useLocalizedSiteContent } from "@/features/site-content/site-content";
import { useLanguage } from "@/hooks/use-language";

export function RoadmapPage() {
  const { lang } = useLanguage();
  const title = useLocalizedSiteContent("about.roadmap.title");
  const description = useLocalizedSiteContent("about.roadmap.description");
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedCourseParam = searchParams.get("course")?.toUpperCase() ?? null;
  const selectedCourseCode =
    selectedCourseParam && ROADMAP_COURSE_BY_CODE.has(selectedCourseParam)
      ? selectedCourseParam
      : null;

  const updateSelectedCourse = (courseCode: string | null) => {
    const next = new URLSearchParams(searchParams);
    if (courseCode) next.set("course", courseCode);
    else next.delete("course");
    setSearchParams(next, { replace: true });
  };

  return (
    <PageShell className="overflow-x-hidden">
      <Header />
      <PageMain>
        <PageHeader
          title={title}
          titleId="roadmap-page-title"
          className="mb-0"
          containerClassName="max-w-[100rem]"
        />

        <PageContainer className="max-w-[100rem] pb-16">
          <div className="mb-6 flex flex-col gap-4 border-b border-slate-200 pb-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <p className="text-sm font-normal leading-6 text-kaist-grey">{description}</p>
              <p className="mt-2 flex items-start gap-2 text-xs font-medium leading-5 text-slate-500">
                <Info aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
                {lang === "ko"
                  ? "연결선은 필수 선수조건이 아닌 권장 수강 순서입니다. 실제 개설 여부와 이수요건은 최신 학사 안내를 확인하세요."
                  : "Connections show recommended sequences, not mandatory prerequisites. Confirm current offerings and degree requirements in the latest academic guide."}
              </p>
            </div>
            <a
              href={ROADMAP_SOURCE.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-10 shrink-0 items-center gap-1.5 text-xs font-semibold text-kaist-darkgreen hover:underline"
            >
              {lang === "ko" ? "2025.04.22 원본 로드맵" : "Source roadmap · 2025.04.22"}
              <ExternalLink aria-hidden="true" className="size-3.5" />
            </a>
          </div>

          <RoadmapGraph
            lang={lang}
            selectedCourseCode={selectedCourseCode}
            onSelectedCourseChange={updateSelectedCourse}
          />
        </PageContainer>
      </PageMain>
    </PageShell>
  );
}
