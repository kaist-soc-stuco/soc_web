import { ExternalLink } from "lucide-react";
import { useSearchParams } from "react-router-dom";

import { Header } from "@/components/organisms/header";
import { normalizeRoadmapCourseCode } from "@soc/contracts";
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
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedCourseParam = searchParams.get("course") ?? null;
  const selectedCourseCode =
    selectedCourseParam && ROADMAP_COURSE_BY_CODE.has(normalizeRoadmapCourseCode(selectedCourseParam))
      ? normalizeRoadmapCourseCode(selectedCourseParam)
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
          containerClassName="max-w-[100rem] flex-col items-start gap-2 sm:flex-row sm:items-end sm:gap-4"
          actions={
            <a
              href={ROADMAP_SOURCE.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-10 shrink-0 items-center gap-1.5 text-xs font-semibold text-kaist-darkgreen hover:underline"
            >
              {lang === "ko" ? "2025.04.22 원본 로드맵" : "Source roadmap · 2025.04.22"}
              <ExternalLink aria-hidden="true" className="size-3.5" />
            </a>
          }
        />

        <PageContainer className="max-w-[100rem] pb-16">
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
