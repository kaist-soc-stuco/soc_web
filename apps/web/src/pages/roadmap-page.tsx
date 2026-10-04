import { ExternalLink } from "lucide-react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Button } from "@/components/ui/button";
import { AdminActionMenuPanel } from "@/components/ui/admin-action-menu";
import { useSearchParams } from "react-router-dom";

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
    setSearchParams(next, { replace: true, state: { preserveScroll: window.matchMedia("(max-width: 767px)").matches } });
  };

  return (
    <PageShell className="mobile-white-page overflow-x-hidden">

      <PageMain>
        <PageHeader
          title={title}
          titleId="roadmap-page-title"
          containerClassName="mobile-roadmap-heading max-w-[100rem]"
          actions={
            <>
            <div className="md:hidden">
              <DropdownMenu.Root modal={false}>
                <DropdownMenu.Trigger asChild><Button variant="ghost" className="min-h-11">{lang === "ko" ? "참고 자료" : "Resources"}</Button></DropdownMenu.Trigger>
                <DropdownMenu.Portal><DropdownMenu.Content align="end" sideOffset={6} className="z-[var(--ui-layer-popover)] outline-none">
                  <AdminActionMenuPanel className="!w-52">
                    <DropdownMenu.Item asChild><a className="flex min-h-11 items-center justify-between gap-2 rounded-md px-3 text-sm text-slate-700 outline-none data-[highlighted]:bg-slate-50" href={ROADMAP_SOURCE.url} target="_blank" rel="noreferrer">{lang === "ko" ? "원본 로드맵" : "Source roadmap"}<ExternalLink className="size-4" /></a></DropdownMenu.Item>
                    <DropdownMenu.Item asChild><a className="flex min-h-11 items-center justify-between gap-2 rounded-md px-3 text-sm text-slate-700 outline-none data-[highlighted]:bg-slate-50" href="https://bulletin.kaist.ac.kr/" target="_blank" rel="noreferrer">{lang === "ko" ? "KAIST 학사요람" : "Academic Bulletin"}<ExternalLink className="size-4" /></a></DropdownMenu.Item>
                  </AdminActionMenuPanel>
                </DropdownMenu.Content></DropdownMenu.Portal>
              </DropdownMenu.Root>
            </div>
            <div className="hidden flex-wrap items-center gap-x-5 gap-y-1 md:flex">
            <a
              href={ROADMAP_SOURCE.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-10 shrink-0 items-center gap-1.5 text-[length:var(--ui-text-body-sm-size)] font-medium text-slate-500 transition-colors hover:text-kaist-darkgreen hover:underline"
            >
              {lang === "ko" ? "2025.04.22 원본 로드맵" : "Source roadmap · 2025.04.22"}
              <ExternalLink aria-hidden="true" className="size-3.5" />
            </a>
            <a href="https://bulletin.kaist.ac.kr/" target="_blank" rel="noopener noreferrer" className="inline-flex min-h-10 items-center gap-1.5 text-[length:var(--ui-text-body-sm-size)] font-medium text-slate-500 transition-colors hover:text-kaist-darkgreen hover:underline">
              {lang === "ko" ? "KAIST 학사요람" : "KAIST Academic Bulletin"}<ExternalLink aria-hidden="true" className="size-3.5" />
            </a>
            </div>
            </>
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
