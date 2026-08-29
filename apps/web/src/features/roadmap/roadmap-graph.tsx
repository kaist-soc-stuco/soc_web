import {
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  MarkerType,
  Position,
  ReactFlow,
  type Edge,
  type Node,
  type NodeProps,
  type ReactFlowInstance,
} from "@xyflow/react";
import { Maximize2, Minimize2, Search, X } from "lucide-react";
import { createContext, memo, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

import { SelectDropdown } from "@/components/atoms/select-dropdown";
import { IconButton } from "@/components/ui/icon-button";
import { TextInput } from "@/components/ui/text-input";
import { cn } from "@/lib/utils";
import {
  CATEGORY_LABELS,
  ROADMAP_COURSE_BY_CODE,
  ROADMAP_COURSES,
  ROADMAP_LANES,
  ROADMAP_RELATIONS,
  ROADMAP_TRACKS,
  type RoadmapCourse,
  type RoadmapLanguage,
} from "./roadmap-data";
import {
  ROADMAP_OFFERINGS,
  ROADMAP_OFFERINGS_BY_COURSE,
  ROADMAP_TERM_LABELS,
  type RoadmapOffering,
  type RoadmapOfferingTerm,
} from "./roadmap-offerings";

import "@xyflow/react/dist/style.css";

const COURSE_WIDTH = 184;
const COURSE_HEIGHT = 108;
const COURSE_GAP_X = 20;
const COURSE_GAP_Y = 18;
const LANE_LABEL_WIDTH = 178;
const LANE_WIDTH = 1_430;
const COURSES_PER_ROW = 6;
const LANE_GAP = 22;

interface CourseNodeData extends Record<string, unknown> {
  course: RoadmapCourse;
  duplicate: boolean;
  lang: RoadmapLanguage;
  offeringCount: number;
}

interface LaneNodeData extends Record<string, unknown> {
  color: string;
  label: string;
}

type CourseNode = Node<CourseNodeData, "course">;
type LaneNode = Node<LaneNodeData, "lane">;
type GraphNode = CourseNode | LaneNode;

interface LayoutResult {
  canonicalNodeByCode: Map<string, string>;
  height: number;
  instancesByCode: Map<string, string[]>;
  nodes: GraphNode[];
}

function buildLayout(
  lang: RoadmapLanguage,
  visibleCourseCodes: ReadonlySet<string> | null,
  offeringCounts: ReadonlyMap<string, number>,
): LayoutResult {
  const canonicalNodeByCode = new Map<string, string>();
  const instancesByCode = new Map<string, string[]>();
  const nodes: GraphNode[] = [];
  let offsetY = 0;

  ROADMAP_LANES.forEach((lane) => {
    const courseCodes = lane.courses.filter(
      (code) => !visibleCourseCodes || visibleCourseCodes.has(code),
    );
    if (courseCodes.length === 0) return;

    const rowCount = Math.ceil(courseCodes.length / COURSES_PER_ROW);
    const laneHeight = 62 + rowCount * (COURSE_HEIGHT + COURSE_GAP_Y);
    const track = lane.trackId
      ? ROADMAP_TRACKS.find((item) => item.id === lane.trackId)
      : undefined;

    nodes.push({
      id: `lane:${lane.id}`,
      type: "lane",
      position: { x: 0, y: offsetY },
      data: {
        color: track?.color ?? "#64748b",
        label: lane.label[lang],
      },
      draggable: false,
      selectable: false,
      focusable: false,
      zIndex: -1,
      style: { height: laneHeight, width: LANE_WIDTH },
    });

    courseCodes.forEach((code, index) => {
      const item = ROADMAP_COURSE_BY_CODE.get(code);
      if (!item) return;

      const instanceId = `${lane.id}:${code}`;
      const previousInstances = instancesByCode.get(code) ?? [];
      instancesByCode.set(code, [...previousInstances, instanceId]);
      if (!canonicalNodeByCode.has(code)) canonicalNodeByCode.set(code, instanceId);

      nodes.push({
        id: instanceId,
        type: "course",
        position: {
          x: LANE_LABEL_WIDTH + (index % COURSES_PER_ROW) * (COURSE_WIDTH + COURSE_GAP_X),
          y: offsetY + 48 + Math.floor(index / COURSES_PER_ROW) * (COURSE_HEIGHT + COURSE_GAP_Y),
        },
        data: {
          course: item,
          duplicate: false,
          lang,
          offeringCount: offeringCounts.get(item.code) ?? 0,
        },
        draggable: false,
        selectable: true,
        focusable: true,
        ariaLabel: `${item.code} ${item.name[lang]}`,
        zIndex: 1,
        style: { height: COURSE_HEIGHT, width: COURSE_WIDTH },
      });
    });

    offsetY += laneHeight + LANE_GAP;
  });

  return { canonicalNodeByCode, height: offsetY, instancesByCode, nodes };
}

const LaneCard = memo(function LaneCard({ data }: NodeProps<LaneNode>) {
  return (
    <div
      className="select-none h-full w-full rounded-xl border border-slate-200/80 bg-white/70"
      style={{ borderTopColor: data.color, borderTopWidth: 3 }}
    >
      <div className="flex h-full w-[9.5rem] items-start px-5 pt-5">
        <span className="text-sm font-semibold tracking-tight text-slate-700">{data.label}</span>
      </div>
    </div>
  );
});

interface RoadmapInteractionContextValue {
  activeCourseCode: string | null;
  nextCodes: ReadonlySet<string>;
  previousCodes: ReadonlySet<string>;
  selectedCourseCode: string | null;
  selectedTrackIds: ReadonlySet<string>;
  setHoveredCourseCode: (courseCode: string | null) => void;
}

const RoadmapInteractionContext = createContext<RoadmapInteractionContextValue | null>(null);

const CourseCard = memo(function CourseCard({ data }: NodeProps<CourseNode>) {
  const { course, duplicate, lang, offeringCount } = data;
  const interaction = useContext(RoadmapInteractionContext);
  const relation =
    course.code === interaction?.activeCourseCode
      ? "current"
      : interaction?.previousCodes.has(course.code)
        ? "previous"
        : interaction?.nextCodes.has(course.code)
          ? "next"
          : null;
  const relationDimmed = Boolean(interaction?.activeCourseCode && !relation);
  const trackDimmed = Boolean(
    interaction &&
      interaction.selectedTrackIds.size > 0 &&
      !course.tracks.some((trackId) => interaction.selectedTrackIds.has(trackId)) &&
      !relation,
  );
  const dimmed = relationDimmed || trackDimmed;
  const selected = course.code === interaction?.selectedCourseCode;

  return (
    <div
      onMouseEnter={() => interaction?.setHoveredCourseCode(course.code)}
      onMouseLeave={() => interaction?.setHoveredCourseCode(null)}
      className={cn(
        "roadmap-course-card select-none group relative h-full w-full rounded-lg border bg-white px-3.5 py-3 text-left shadow-[0_1px_2px_rgba(15,23,42,0.05)] transition-[opacity,border-color,box-shadow] duration-150",
        selected
          ? "border-kaist-darkgreen shadow-[0_0_0_2px_rgba(0,92,74,0.13)]"
          : relation === "previous"
            ? "border-amber-500 shadow-[0_0_0_1px_rgba(245,158,11,0.15)]"
            : relation === "next"
              ? "border-sky-500 shadow-[0_0_0_1px_rgba(14,165,233,0.15)]"
              : relation === "current"
                ? "border-kaist-darkgreen"
                : "border-slate-200 hover:border-slate-400 hover:shadow-md",
        dimmed && "opacity-[0.14]",
      )}
    >
      <Handle className="!h-px !w-px !border-0 !bg-transparent !opacity-0" position={Position.Left} type="target" />
      <Handle className="!h-px !w-px !border-0 !bg-transparent !opacity-0" position={Position.Right} type="source" />

      <div className="flex items-start justify-between gap-2">
        <span className="text-xs font-semibold tabular-nums text-slate-500">{course.code}</span>
        <span className="flex min-h-2.5 items-center gap-1" aria-hidden="true">
          {course.tracks.map((trackId) => {
            const track = ROADMAP_TRACKS.find((item) => item.id === trackId);
            return track ? (
              <span key={trackId} className="size-2 rounded-full" style={{ backgroundColor: track.color }} />
            ) : null;
          })}
        </span>
      </div>
      <div className="mt-1.5 line-clamp-2 min-h-10 text-[length:var(--ui-text-body-sm-size)] font-semibold leading-5 text-slate-900">
        {course.name[lang]}
      </div>
      <div className="mt-1.5 flex items-center justify-between gap-2 text-[length:var(--ui-text-micro-size)] font-medium text-slate-400">
        <span>{course.semesters}</span>
        <span className="tabular-nums">{course.credits}</span>
      </div>
      {offeringCount > 0 ? (
        <span className="absolute bottom-2.5 left-3 rounded bg-emerald-50 px-1.5 py-0.5 text-[length:var(--ui-text-micro-size)] font-semibold text-emerald-700">
          {lang === "ko" ? `개설 ${offeringCount}` : `${offeringCount} offered`}
        </span>
      ) : null}
      {course.ai ? (
        <span className="absolute bottom-2.5 right-3 rounded bg-sky-50 px-1.5 py-0.5 text-[length:var(--ui-text-micro-size)] font-bold text-sky-700">
          AI
        </span>
      ) : null}
      {duplicate ? (
        <span className="sr-only">
          {lang === "ko" ? "여러 분야에 표시되는 과목" : "Course shown in multiple fields"}
        </span>
      ) : null}
    </div>
  );
});

const nodeTypes = { course: CourseCard, lane: LaneCard };

function getCourseSearchText(course: RoadmapCourse) {
  const offerings = ROADMAP_OFFERINGS_BY_COURSE.get(course.code) ?? [];
  return [
    course.code,
    course.name.ko,
    course.name.en,
    ...offerings.flatMap((offering) => [
      offering.currentCode,
      offering.nameKo,
      offering.instructor ?? "",
    ]),
  ].join(" ");
}

interface RoadmapGraphProps {
  lang: RoadmapLanguage;
  onSelectedCourseChange: (courseCode: string | null) => void;
  selectedCourseCode: string | null;
}

export function RoadmapGraph({
  lang,
  onSelectedCourseChange,
  selectedCourseCode,
}: RoadmapGraphProps) {
  const [hoveredCourseCode, setHoveredCourseCode] = useState<string | null>(null);
  const [selectedTrackIds, setSelectedTrackIds] = useState<Set<string>>(() => new Set());
  const [searchText, setSearchText] = useState("");
  const [selectedTerm, setSelectedTerm] = useState<RoadmapOfferingTerm>("2026-fall");
  const [offeredOnly, setOfferedOnly] = useState(false);
  const [flow, setFlow] = useState<ReactFlowInstance<GraphNode, Edge> | null>(null);
  const flowViewportRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const activeCourseCode = hoveredCourseCode ?? selectedCourseCode;

  const termOfferings = useMemo(
    () =>
      selectedTerm === "all"
        ? ROADMAP_OFFERINGS
        : ROADMAP_OFFERINGS.filter((offering) => offering.term === selectedTerm),
    [selectedTerm],
  );
  const offeringCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const offering of termOfferings) {
      counts.set(offering.courseCode, (counts.get(offering.courseCode) ?? 0) + 1);
    }
    return counts;
  }, [termOfferings]);
  const offeredCourseCodes = useMemo(
    () => new Set(termOfferings.map((offering) => offering.courseCode)),
    [termOfferings],
  );
  const visibleCourseCodes = offeredOnly ? offeredCourseCodes : null;
  const layout = useMemo(
    () => buildLayout(lang, visibleCourseCodes, offeringCounts),
    [lang, offeringCounts, visibleCourseCodes],
  );

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(document.fullscreenElement === flowViewportRef.current);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  const toggleFullscreen = useCallback(async () => {
    const flowViewport = flowViewportRef.current;
    if (!flowViewport) return;

    try {
      if (document.fullscreenElement === flowViewport) {
        await document.exitFullscreen();
      } else if (isFullscreen) {
        setIsFullscreen(false);
      } else {
        setIsFullscreen(true);
        await flowViewport.requestFullscreen();
      }
    } catch {
      // Keep the CSS fallback mode when the browser does not allow the
      // native Fullscreen API in an embedded preview.
    }
  }, [isFullscreen]);

  const previousCodes = useMemo(
    () =>
      new Set(
        activeCourseCode
          ? ROADMAP_RELATIONS.filter((item) => item.target === activeCourseCode).map(
              (item) => item.source,
            )
          : [],
      ),
    [activeCourseCode],
  );
  const nextCodes = useMemo(
    () =>
      new Set(
        activeCourseCode
          ? ROADMAP_RELATIONS.filter((item) => item.source === activeCourseCode).map(
              (item) => item.target,
            )
          : [],
      ),
    [activeCourseCode],
  );

  const nodes = useMemo<GraphNode[]>(
    () =>
      layout.nodes.map((node) =>
        node.type === "course"
          ? {
              ...node,
              data: {
                ...node.data,
                duplicate: (layout.instancesByCode.get(node.data.course.code)?.length ?? 0) > 1,
              },
            }
          : node,
      ),
    [layout],
  );

  const interactionValue = useMemo<RoadmapInteractionContextValue>(
    () => ({
      activeCourseCode,
      nextCodes,
      previousCodes,
      selectedCourseCode,
      selectedTrackIds,
      setHoveredCourseCode,
    }),
    [activeCourseCode, nextCodes, previousCodes, selectedCourseCode, selectedTrackIds],
  );

  const edges = useMemo<Edge[]>(
    () =>
      ROADMAP_RELATIONS.flatMap((relation) => {
        const source = layout.canonicalNodeByCode.get(relation.source);
        const target = layout.canonicalNodeByCode.get(relation.target);
        if (!source || !target) return [];
        const highlighted =
          relation.source === activeCourseCode || relation.target === activeCourseCode;

        return [
          {
            id: `${relation.source}-${relation.target}`,
            source,
            target,
            type: "smoothstep",
            focusable: false,
            interactionWidth: 0,
            markerEnd: {
              type: MarkerType.ArrowClosed,
              width: 13,
              height: 13,
              color: highlighted ? "#0f766e" : "#94a3b8",
            },
            style: {
              opacity: activeCourseCode && !highlighted ? 0.08 : highlighted ? 1 : 0.34,
              pointerEvents: "none",
              stroke: highlighted ? "#0f766e" : "#94a3b8",
              strokeWidth: highlighted ? 2 : 1.25,
            },
            selectable: false,
            zIndex: 0,
            ariaLabel:
              lang === "ko"
                ? `${relation.source}에서 ${relation.target}로 이어지는 권장 수강 순서`
                : `Recommended sequence from ${relation.source} to ${relation.target}`,
          },
        ];
      }),
    [activeCourseCode, lang, layout.canonicalNodeByCode],
  );

  const searchMatches = useMemo(() => {
    const query = searchText.trim().toLocaleLowerCase();
    if (!query) return [];
    return ROADMAP_COURSES.filter((item) =>
      getCourseSearchText(item).toLocaleLowerCase().includes(query),
    ).slice(0, 6);
  }, [searchText]);

  const focusCourse = useCallback(
    (code: string) => {
      onSelectedCourseChange(code);
      setSearchText("");
      const nodeId = layout.canonicalNodeByCode.get(code);
      if (nodeId && flow) {
        void flow.fitView({
          nodes: [{ id: nodeId }],
          duration: 240,
          padding: 0.85,
          maxZoom: 1.25,
        });
      }
    },
    [flow, layout.canonicalNodeByCode, onSelectedCourseChange],
  );

  useEffect(() => {
    if (!flow || !selectedCourseCode) return;
    const nodeId = layout.canonicalNodeByCode.get(selectedCourseCode);
    if (!nodeId) return;
    void flow.fitView({
      nodes: [{ id: nodeId }],
      duration: 0,
      padding: 0.85,
      maxZoom: 1.25,
    });
  }, [flow, layout.canonicalNodeByCode, selectedCourseCode]);

  const toggleTrack = (trackId: string) => {
    setSelectedTrackIds((current) => {
      const next = new Set(current);
      if (next.has(trackId)) next.delete(trackId);
      else next.add(trackId);
      return next;
    });
  };

  const mobileCourses = ROADMAP_COURSES.filter((item) => {
    const query = searchText.trim().toLocaleLowerCase();
    const matchesQuery =
      !query ||
      getCourseSearchText(item).toLocaleLowerCase().includes(query);
    const matchesTrack =
      selectedTrackIds.size === 0 || item.tracks.some((trackId) => selectedTrackIds.has(trackId));
    const matchesAvailability = !offeredOnly || offeredCourseCodes.has(item.code);
    return matchesQuery && matchesTrack && matchesAvailability;
  });

  return (
    <>
      <div className="lg:hidden">
        <TextInput
          value={searchText}
          onChange={(event) => setSearchText(event.target.value)}
          aria-label={lang === "ko" ? "과목 검색" : "Search courses"}
          placeholder={lang === "ko" ? "과목 코드 또는 과목명 검색" : "Search by code or title"}
          leading={<Search aria-hidden="true" className="size-4" />}
        />
        <RoadmapOfferingControls
          lang={lang}
          offeredOnly={offeredOnly}
          selectedTerm={selectedTerm}
          onOfferedOnlyChange={setOfferedOnly}
          onTermChange={setSelectedTerm}
        />
        <div className="mt-3 flex gap-2 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {ROADMAP_TRACKS.map((track) => {
            const selected = selectedTrackIds.has(track.id);
            return (
              <button
                key={track.id}
                type="button"
                aria-pressed={selected}
                onClick={() => toggleTrack(track.id)}
                className={cn(
                  "inline-flex min-h-9 shrink-0 items-center gap-2 rounded-full border px-3 text-xs font-semibold",
                  selected
                    ? "border-slate-400 bg-slate-100 text-slate-950"
                    : "border-slate-200 bg-white text-slate-600",
                )}
              >
                <span className="size-2 rounded-full" style={{ backgroundColor: track.color }} />
                {track.label[lang]}
              </button>
            );
          })}
        </div>

        {selectedCourseCode ? (
          <div className="mt-4 rounded-xl border border-slate-200 bg-white px-4 pb-5">
            <CourseDetails
              courseCode={selectedCourseCode}
              lang={lang}
              selectedTerm={selectedTerm}
              onClose={() => onSelectedCourseChange(null)}
              onCourseClick={onSelectedCourseChange}
            />
          </div>
        ) : null}

        <div className="mt-4 divide-y divide-slate-200 border-y border-slate-200">
          {mobileCourses.map((item) => (
            <button
              key={item.code}
              type="button"
              onClick={() => onSelectedCourseChange(item.code)}
              className="flex min-h-16 w-full items-center gap-3 py-3 text-left"
            >
              <span className="w-14 shrink-0 text-xs font-semibold text-slate-500">{item.code}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-slate-900">{item.name[lang]}</span>
                <span className="mt-1 block text-xs font-medium text-slate-400">
                  {CATEGORY_LABELS[item.category][lang]} · {item.semesters}
                </span>
              </span>
              <span className="flex shrink-0 gap-1" aria-hidden="true">
                {item.tracks.map((trackId) => {
                  const track = ROADMAP_TRACKS.find((candidate) => candidate.id === trackId);
                  return track ? (
                    <span key={trackId} className="size-2 rounded-full" style={{ backgroundColor: track.color }} />
                  ) : null;
                })}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="hidden min-w-0 gap-5 lg:grid xl:grid-cols-[minmax(0,1fr)_18rem]">
      <div className="min-w-0">
        <div className="relative z-20 mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-sm">
            <TextInput
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && searchMatches[0]) focusCourse(searchMatches[0].code);
              }}
              aria-label={lang === "ko" ? "과목 검색" : "Search courses"}
              placeholder={lang === "ko" ? "과목 코드 또는 과목명 검색" : "Search by code or title"}
              leading={<Search aria-hidden="true" className="size-4" />}
              trailing={
                searchText ? (
                  <IconButton
                    aria-label={lang === "ko" ? "검색어 지우기" : "Clear search"}
                    size="sm"
                    onClick={() => setSearchText("")}
                  >
                    <X aria-hidden="true" className="size-4" />
                  </IconButton>
                ) : null
              }
            />
            {searchMatches.length > 0 ? (
              <div className="absolute left-0 right-0 top-[calc(100%+0.375rem)] overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl">
                {searchMatches.map((item) => {
                  const offering = ROADMAP_OFFERINGS_BY_COURSE.get(item.code)?.[0];
                  return (
                    <button
                      key={item.code}
                      type="button"
                      onClick={() => focusCourse(item.code)}
                      className="flex min-h-12 w-full items-center gap-3 border-b border-slate-100 px-3 text-left last:border-b-0 hover:bg-slate-50"
                    >
                      <span className="w-14 shrink-0 text-xs font-semibold text-slate-500">{item.code}</span>
                      <span className="min-w-0 truncate text-sm font-medium text-slate-900">
                        <span className="block truncate">{item.name[lang]}</span>
                        {offering ? (
                          <span className="mt-0.5 block truncate text-[length:var(--ui-text-micro-size)] font-medium text-slate-400">
                            {offering.currentCode}
                            {offering.instructor ? ` · ${offering.instructor}` : ""}
                          </span>
                        ) : null}
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center justify-end gap-3">
            <RoadmapOfferingControls
              lang={lang}
              offeredOnly={offeredOnly}
              selectedTerm={selectedTerm}
              onOfferedOnlyChange={setOfferedOnly}
              onTermChange={setSelectedTerm}
            />
            <span className="hidden min-h-9 items-center text-xs font-medium text-slate-500 sm:inline-flex">
              {lang === "ko" ? "드래그 이동 · Ctrl/⌘ + 휠 확대" : "Drag to pan · Ctrl/⌘ + wheel to zoom"}
            </span>
          </div>
        </div>

        <div ref={flowViewportRef} className={cn("roadmap-flow-viewport relative h-[calc(100svh-13rem)] min-h-[38rem] max-h-[54rem] overflow-hidden rounded-xl border border-slate-200 bg-slate-50", isFullscreen && "roadmap-flow-viewport--fullscreen")}>
          <button
            type="button"
            onClick={() => void toggleFullscreen()}
            aria-label={isFullscreen ? (lang === "ko" ? "전체 화면 닫기" : "Exit full screen") : (lang === "ko" ? "전체 화면" : "Full screen")}
            title={isFullscreen ? (lang === "ko" ? "전체 화면 닫기" : "Exit full screen") : (lang === "ko" ? "전체 화면" : "Full screen")}
            className="absolute right-3 top-3 z-10 inline-flex size-9 items-center justify-center rounded-lg border border-slate-200 bg-white/90 text-slate-600 shadow-sm backdrop-blur transition-colors hover:border-slate-300 hover:bg-white hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/25"
          >
            {isFullscreen ? <Minimize2 aria-hidden="true" className="size-4" /> : <Maximize2 aria-hidden="true" className="size-4" />}
          </button>
          <RoadmapInteractionContext.Provider value={interactionValue}>
            <ReactFlow<GraphNode, Edge>
              nodes={nodes}
              edges={edges}
              nodeTypes={nodeTypes}
              onInit={setFlow}
              onNodeClick={(_, node) => {
                if (node.type === "course") focusCourse(node.data.course.code);
              }}
              onPaneClick={() => onSelectedCourseChange(null)}
              defaultViewport={{ x: 16, y: 16, zoom: 0.72 }}
              minZoom={0.28}
              maxZoom={1.7}
              nodesDraggable={false}
              nodesConnectable={false}
              elementsSelectable
              panOnDrag
              panOnScroll
              zoomOnScroll={false}
              zoomOnPinch
              deleteKeyCode={null}
              selectionKeyCode={null}
              multiSelectionKeyCode={null}
              ariaLabelConfig={{
                "controls.ariaLabel": lang === "ko" ? "지도 조작" : "Map controls",
                "controls.zoomIn.ariaLabel": lang === "ko" ? "확대" : "Zoom in",
                "controls.zoomOut.ariaLabel": lang === "ko" ? "축소" : "Zoom out",
              }}
            >
              <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="#cbd5e1" />
              <Controls showFitView={false} showInteractive={false} position="bottom-left" />
            </ReactFlow>
          </RoadmapInteractionContext.Provider>
        </div>
      </div>

      <aside className="min-w-0 xl:sticky xl:top-24 xl:self-start" aria-live="polite">
        {selectedCourseCode ? (
          <div key="course-details" className="roadmap-side-panel__view">
            <div className="mb-4 border-b border-slate-200 pb-3">
              <h2 className="text-sm font-semibold text-slate-900">
                {lang === "ko" ? "과목 상세 정보" : "Course details"}
              </h2>
            </div>
            <CourseDetails
              courseCode={selectedCourseCode}
              lang={lang}
              selectedTerm={selectedTerm}
              onClose={() => onSelectedCourseChange(null)}
              onCourseClick={focusCourse}
            />
          </div>
        ) : (
          <section key="track-legend" className="roadmap-side-panel__view border-b border-slate-200 pb-5" aria-labelledby="roadmap-track-filter">
            <div className="flex min-h-9 items-center justify-between gap-3">
              <h2 id="roadmap-track-filter" className="text-sm font-semibold text-slate-900">
                {lang === "ko" ? "교육 분야" : "Fields"}
              </h2>
              {selectedTrackIds.size > 0 ? (
                <button
                  type="button"
                  onClick={() => setSelectedTrackIds(new Set())}
                  className="text-xs font-semibold text-kaist-darkgreen hover:underline"
                >
                  {lang === "ko" ? "전체" : "All"}
                </button>
              ) : null}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-1.5 xl:grid-cols-1">
              {ROADMAP_TRACKS.map((track) => {
                const selected = selectedTrackIds.has(track.id);
                return (
                  <button
                    key={track.id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => toggleTrack(track.id)}
                    className={cn(
                      "flex min-h-9 items-center gap-2 rounded-md px-2.5 text-left text-xs font-medium transition-colors",
                      selected
                        ? "bg-slate-100 text-slate-950"
                        : "text-slate-600 hover:bg-slate-50 hover:text-slate-900",
                    )}
                  >
                    <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: track.color }} />
                    <span className="truncate">{track.label[lang]}</span>
                  </button>
                );
              })}
            </div>
          </section>
        )}
      </aside>
      </div>
    </>
  );
}

function RoadmapOfferingControls({
  lang,
  offeredOnly,
  selectedTerm,
  onOfferedOnlyChange,
  onTermChange,
}: {
  lang: RoadmapLanguage;
  offeredOnly: boolean;
  selectedTerm: RoadmapOfferingTerm;
  onOfferedOnlyChange: (value: boolean) => void;
  onTermChange: (value: RoadmapOfferingTerm) => void;
}) {
  const options: { value: RoadmapOfferingTerm; label: string }[] = ([
    "all",
    "2026-spring",
    "2026-fall",
  ] as RoadmapOfferingTerm[]).map((value) => ({ value, label: ROADMAP_TERM_LABELS[value][lang] }));

  return (
    <div className="flex flex-wrap items-center gap-2">
      <SelectDropdown
        ariaLabel={lang === "ko" ? "개설 학기" : "Offering semester"}
        value={selectedTerm}
        options={options}
        onChange={(value) => onTermChange(value as RoadmapOfferingTerm)}
        className="w-36 shrink-0"
        buttonClassName="h-9 !min-h-9 text-xs"
      />
      <label className="inline-flex min-h-9 shrink-0 cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 transition-colors hover:border-slate-300 hover:text-slate-900">
        <input
          type="checkbox"
          checked={offeredOnly}
          onChange={(event) => onOfferedOnlyChange(event.currentTarget.checked)}
          className="size-3.5 accent-emerald-700"
        />
        <span>{lang === "ko" ? "개설 과목만 보기" : "Show offered only"}</span>
      </label>
    </div>
  );
}

interface CourseDetailsProps {
  courseCode: string | null;
  lang: RoadmapLanguage;
  onClose: () => void;
  onCourseClick: (code: string) => void;
  selectedTerm: RoadmapOfferingTerm;
}

function CourseDetails({ courseCode, lang, onClose, onCourseClick, selectedTerm }: CourseDetailsProps) {
  const [activeTab, setActiveTab] = useState<"overview" | "offerings">("overview");
  const item = courseCode ? ROADMAP_COURSE_BY_CODE.get(courseCode) : undefined;
  const allOfferings = item ? ROADMAP_OFFERINGS_BY_COURSE.get(item.code) ?? [] : [];
  const offerings =
    selectedTerm === "all"
      ? allOfferings
      : allOfferings.filter((offering) => offering.term === selectedTerm);
  const previous = item
    ? ROADMAP_RELATIONS.filter((relation) => relation.target === item.code).map(
        (relation) => relation.source,
      )
    : [];

  useEffect(() => {
    setActiveTab("overview");
  }, [courseCode]);
  const next = item
    ? ROADMAP_RELATIONS.filter((relation) => relation.source === item.code).map(
        (relation) => relation.target,
      )
    : [];

  if (!item) {
    return (
      <section className="pt-5 text-sm leading-6 text-slate-500">
        <p className="font-semibold text-slate-800">
          {lang === "ko" ? "과목을 선택해 보세요" : "Select a course"}
        </p>
        <p className="mt-1">
          {lang === "ko"
            ? "권장 수강 순서와 여러 교육 분야에서의 연결을 확인할 수 있습니다."
            : "See its recommended sequence and connections across fields."}
        </p>
      </section>
    );
  }

  return (
    <section className="pt-5" aria-live="polite">
      <div className="flex items-start justify-between gap-3">
        <div>
          <span className="text-xs font-semibold text-kaist-darkgreen">{item.code}</span>
          <h2 className="mt-1 text-lg font-semibold tracking-tight text-slate-950">{item.name[lang]}</h2>
        </div>
        <IconButton aria-label={lang === "ko" ? "과목 상세 닫기" : "Close details"} onClick={onClose}>
          <X aria-hidden="true" className="size-4" />
        </IconButton>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1" role="tablist" aria-label={lang === "ko" ? "과목 상세 탭" : "Course detail tabs"}>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "overview"}
          onClick={() => setActiveTab("overview")}
          className={cn(
            "min-h-8 rounded-md px-2 text-xs font-semibold transition-colors",
            activeTab === "overview" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800",
          )}
        >
          {lang === "ko" ? "기본 정보" : "Overview"}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "offerings"}
          onClick={() => setActiveTab("offerings")}
          className={cn(
            "min-h-8 rounded-md px-2 text-xs font-semibold transition-colors",
            activeTab === "offerings" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800",
          )}
        >
          {lang === "ko" ? `개설 분반 (${offerings.length})` : `Offerings (${offerings.length})`}
        </button>
      </div>

      {activeTab === "offerings" ? (
        <OfferingList offerings={offerings} lang={lang} />
      ) : (
        <>
          <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-y border-slate-200 py-4 text-xs">
        <div>
          <dt className="font-medium text-slate-400">{lang === "ko" ? "구분" : "Category"}</dt>
          <dd className="mt-1 font-semibold text-slate-800">{CATEGORY_LABELS[item.category][lang]}</dd>
        </div>
        <div>
          <dt className="font-medium text-slate-400">{lang === "ko" ? "개설" : "Offered"}</dt>
          <dd className="mt-1 font-semibold text-slate-800">{item.semesters}</dd>
        </div>
        <div>
          <dt className="font-medium text-slate-400">{lang === "ko" ? "강·실·학" : "Lecture·Lab·Credit"}</dt>
          <dd className="mt-1 font-semibold tabular-nums text-slate-800">{item.credits}</dd>
        </div>
        <div>
          <dt className="font-medium text-slate-400">{lang === "ko" ? "AI 중점" : "AI focus"}</dt>
          <dd className="mt-1 font-semibold text-slate-800">{item.ai ? (lang === "ko" ? "해당" : "Yes") : "—"}</dd>
        </div>
          </dl>

          <div className="mt-4">
        <h3 className="text-xs font-semibold text-slate-500">{lang === "ko" ? "교육 분야" : "Fields"}</h3>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {item.tracks.map((trackId) => {
            const track = ROADMAP_TRACKS.find((candidate) => candidate.id === trackId);
            return track ? (
              <span key={track.id} className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                <span className="size-2 rounded-full" style={{ backgroundColor: track.color }} />
                {track.label[lang]}
              </span>
            ) : null;
          })}
        </div>
          </div>

          <RelationList
            title={lang === "ko" ? "먼저 들으면 좋은 과목" : "Recommended before"}
            codes={previous}
            lang={lang}
            tone="previous"
            onCourseClick={onCourseClick}
          />
          <RelationList
            title={lang === "ko" ? "다음에 이어지는 과목" : "Recommended next"}
            codes={next}
            lang={lang}
            tone="next"
            onCourseClick={onCourseClick}
          />
        </>
      )}
    </section>
  );
}

function OfferingList({
  offerings,
  lang,
}: {
  offerings: RoadmapOffering[];
  lang: RoadmapLanguage;
}) {
  if (offerings.length === 0) {
    return (
      <p className="mt-4 rounded-lg border border-dashed border-slate-200 px-3 py-5 text-center text-xs leading-5 text-slate-500">
        {lang === "ko" ? "선택한 학기에 개설된 정보가 없습니다." : "No offering is available for this semester."}
      </p>
    );
  }

  return (
    <div className="mt-4 space-y-2">
      {offerings.map((offering) => {
        const enrollment =
          offering.capacity !== null
            ? `${offering.enrolled ?? "—"} / ${offering.capacity}`
            : offering.enrolled !== null
              ? String(offering.enrolled)
              : null;

        return (
          <article
            key={`${offering.term}-${offering.currentCode}-${offering.nameKo}-${offering.section ?? "none"}`}
            className="rounded-lg border border-slate-200 bg-white p-3"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[length:var(--ui-text-micro-size)] font-semibold text-emerald-700">
                    {ROADMAP_TERM_LABELS[offering.term][lang]}
                  </span>
                  <span className="text-xs font-semibold tabular-nums text-slate-500">
                    {offering.currentCode}
                  </span>
                  {offering.inEnglish ? (
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[length:var(--ui-text-micro-size)] font-semibold text-slate-600">
                      {lang === "ko" ? "영어" : "English"}
                    </span>
                  ) : null}
                </div>
                <p className="mt-1.5 break-keep text-xs font-semibold leading-5 text-slate-900">
                  {offering.nameKo}
                </p>
              </div>
              <span className="shrink-0 rounded-full border border-slate-200 px-2 py-1 text-[length:var(--ui-text-micro-size)] font-semibold text-slate-600">
                {offering.section
                  ? lang === "ko"
                    ? `${offering.section}분반`
                    : `Section ${offering.section}`
                  : lang === "ko"
                    ? "분반 미정"
                    : "Section —"}
              </span>
            </div>

            <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 border-t border-slate-100 pt-3 text-[length:var(--ui-text-micro-size)]">
              <OfferingDetailField
                label={lang === "ko" ? "담당교수" : "Instructor"}
                value={offering.instructor}
              />
              <OfferingDetailField
                label={lang === "ko" ? "강의 방식" : "Format"}
                value={offering.delivery}
              />
              <OfferingDetailField
                label={lang === "ko" ? "강·실·학" : "L·Lab·Cr"}
                value={offering.credits}
              />
              <OfferingDetailField
                label={lang === "ko" ? "수강 / 정원" : "Enrolled / capacity"}
                value={enrollment}
              />
              <OfferingDetailField
                className="col-span-2"
                label={lang === "ko" ? "강의시간" : "Schedule"}
                value={offering.time}
                preserveWhitespace
              />
              <OfferingDetailField
                className="col-span-2"
                label={lang === "ko" ? "강의실" : "Room"}
                value={offering.room}
                preserveWhitespace
              />
            </dl>
          </article>
        );
      })}
    </div>
  );
}

function OfferingDetailField({
  className,
  label,
  preserveWhitespace = false,
  value,
}: {
  className?: string;
  label: string;
  preserveWhitespace?: boolean;
  value: string | null;
}) {
  if (!value) return null;

  return (
    <div className={className}>
      <dt className="font-medium text-slate-400">{label}</dt>
      <dd className={cn("mt-0.5 break-keep font-medium text-slate-700", preserveWhitespace && "whitespace-pre-line")}>{value}</dd>
    </div>
  );
}

function RelationList({
  codes,
  lang,
  onCourseClick,
  title,
  tone,
}: {
  codes: string[];
  lang: RoadmapLanguage;
  onCourseClick: (code: string) => void;
  title: string;
  tone: "previous" | "next";
}) {
  if (codes.length === 0) return null;

  return (
    <div className="mt-5">
      <h3 className="text-xs font-semibold text-slate-500">{title}</h3>
      <div className="mt-2 space-y-1">
        {codes.map((code) => {
          const item = ROADMAP_COURSE_BY_CODE.get(code);
          return item ? (
            <button
              key={code}
              type="button"
              onClick={() => onCourseClick(code)}
              className="flex min-h-10 w-full items-center gap-2 rounded-md px-2 text-left transition-colors hover:bg-slate-100"
            >
              <span className={cn("h-5 w-0.5 rounded-full", tone === "previous" ? "bg-amber-500" : "bg-sky-500")} />
              <span className="w-12 shrink-0 text-xs font-semibold text-slate-500">{code}</span>
              <span className="truncate text-xs font-medium text-slate-800">{item.name[lang]}</span>
            </button>
          ) : null;
        })}
      </div>
    </div>
  );
}
