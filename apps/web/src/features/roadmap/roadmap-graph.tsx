import {
  BaseEdge,
  type EdgeProps,
  Background,
  BackgroundVariant,
  Handle,
  MarkerType,
  Position,
  ReactFlow,
  type Edge,
  type Node,
  type NodeProps,
  type NodeMouseHandler,
  type OnMove,
  type ReactFlowInstance,
} from "@xyflow/react";
import { ChevronDown, Clock3, ExternalLink, MapPin, Maximize2, Minimize2, Minus, Plus, RotateCcw, Search, X } from "lucide-react";
import { createContext, memo, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import {
  normalizeRoadmapCourseCode,
  type PublicRoadmapCourseRecord,
  type PublicRoadmapOfferingRecord,
  type RoadmapCourseRelationRecord,
} from "@soc/contracts";
import { createApiClient } from "@soc/api-client";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "react-router-dom";

import { SelectDropdown } from "@/components/atoms/select-dropdown";
import { IconButton } from "@/components/ui/icon-button";
import { Button } from "@/components/ui/button";
import { TextInput } from "@/components/ui/text-input";
import { PageSearchField } from "@/components/ui/page-layout";
import { Switch } from "@/components/ui/switch";
import { UiSelect } from "@/components/ui/form-control";
import { FilterSheet } from "@/components/ui/filter-sheet";
import { MobileFilterActions, MobileFilterButton } from "@/components/ui/mobile-filter-controls";
import { useMediaQuery } from "@/hooks/use-media-query";
import { resolveApiBaseUrl } from "@/lib/api-base-url";
import { cn } from "@/lib/utils";
import {
  CATEGORY_LABELS,
  ROADMAP_COURSES,
  ROADMAP_LANES,
  ROADMAP_RELATIONS,
  ROADMAP_TRACKS,
  type RoadmapCourse,
  type RoadmapLane,
  type RoadmapLanguage,
} from "./roadmap-data";
import {
  ROADMAP_OFFERINGS,
  getRoadmapTermLabel,
  groupRoadmapOfferings,
  type RoadmapOffering,
  type RoadmapOfferingTerm,
} from "./roadmap-offerings";

import "@xyflow/react/dist/style.css";
import { createRoadmapRouter, roundedPath, uniqueRoutePaths, type Point } from "./roadmap-routing";
import { easeRoadmapCamera, getCourseFocusViewport, isCourseComfortablyVisible, type RoadmapViewport } from "./roadmap-camera";
import { readRoadmapViewState, restoreRoadmapViewport, saveRoadmapViewState } from "./roadmap-view-state";
import { getRoadmapOtlUrl } from "./roadmap-otl";

const RoutedEdge = memo(function RoutedEdge(props: EdgeProps) {
  const paths = useMemo(() => {
    const points = props.data?.points as Point[] | undefined;
    if (!points) return [];
    const junctions = new Set((props.data?.junctions as string[] | undefined) ?? []);
    const end = points[points.length - 1];
    return ((props.data?.paths as Point[][] | undefined) ?? [points]).map(path => {
      const last = path[path.length - 1];
      return { path: roundedPath(path, junctions), marker: last.x === end.x && last.y === end.y };
    });
  }, [props.data]);
  return <>{paths.map(({ path, marker }, index) =>
    <BaseEdge key={index} id={`${props.id}-${index}`} path={path} markerEnd={marker ? props.markerEnd : undefined} style={props.style} interactionWidth={0} />
  )}</>;
});
const edgeTypes = { smoothstep: RoutedEdge };
const FLOW_PRO_OPTIONS = { hideAttribution: true };
const FLOW_FIT_OPTIONS = { padding: 0.12, maxZoom: 0.85, minZoom: 0.1 };

const COURSE_WIDTH = 184;
const COURSE_HEIGHT = 108;
const COURSE_GAP_X = 32;
const COURSE_GAP_Y = 28;
const GROUP_PADDING = 20;
const GROUP_HEADER = 52;
const LANE_GAP = 28;
const BASE_WIDTH = COURSE_WIDTH * 2 + COURSE_GAP_X + GROUP_PADDING * 2;
const TRACK_WIDTH = COURSE_WIDTH * 3 + COURSE_GAP_X * 2 + GROUP_PADDING * 2;
const LANE_WIDTH = BASE_WIDTH + TRACK_WIDTH * 2 + LANE_GAP * 2;

interface CourseNodeData extends Record<string, unknown> {
  course: RoadmapCourse;
  duplicate: boolean;
  displayCode: string;
  lang: RoadmapLanguage;
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
  courses: readonly RoadmapCourse[],
  lanes: readonly RoadmapLane[],
  visibleCourseCodes: ReadonlySet<string> | null,
  displayCodeByCourse: ReadonlyMap<string, string>,
): LayoutResult {
  const canonicalNodeByCode = new Map<string, string>();
  const instancesByCode = new Map<string, string[]>();
  const nodes: GraphNode[] = [];
  const courseByCode = new Map(courses.map((item) => [item.code, item]));
  let baseY = 0;
  let trackY = 0;
  const prepared = lanes.map((lane) => ({
    ...lane,
    courses: lane.courses.filter((code) => courseByCode.has(code) && (!visibleCourseCodes || visibleCourseCodes.has(code))),
  })).filter((lane) => lane.courses.length);
  const addGroup = (lane: RoadmapLane, x: number, y: number, columns: number, width: number) => {
    const height = GROUP_HEADER + Math.ceil(lane.courses.length / columns) * (COURSE_HEIGHT + COURSE_GAP_Y) + 4;
    const track = ROADMAP_TRACKS.find((item) => item.id === lane.trackId);
    nodes.push({
      id: `lane:${lane.id}`, type: "lane", position: { x, y },
      data: { color: track?.color ?? "#64748b", label: lane.label[lang] },
      draggable: false, selectable: false, focusable: false, zIndex: -1,
      style: { width, height },
    });
    lane.courses.forEach((code, index) => {
      const item = courseByCode.get(code)!;
      const instanceId = `${lane.id}:${code}`;
      instancesByCode.set(code, [...(instancesByCode.get(code) ?? []), instanceId]);
      if (!canonicalNodeByCode.has(code)) canonicalNodeByCode.set(code, instanceId);
      nodes.push({
        id: instanceId, type: "course",
        position: { x: x + GROUP_PADDING + (index % columns) * (COURSE_WIDTH + COURSE_GAP_X), y: y + GROUP_HEADER + Math.floor(index / columns) * (COURSE_HEIGHT + COURSE_GAP_Y) },
        data: { course: item, duplicate: false, displayCode: displayCodeByCourse.get(code) ?? code, lang },
        draggable: false, selectable: true, focusable: true,
        ariaLabel: [displayCodeByCourse.get(code) ?? code, item.name[lang]].join(" "),
        zIndex: 1, style: { width: COURSE_WIDTH, height: COURSE_HEIGHT },
      });
    });
    return height;
  };
  // A stable base column, then paired track cards; broad tracks span both columns.
  for (const lane of prepared.filter((item) => !item.trackId)) {
    baseY += addGroup(lane, 0, baseY, 2, BASE_WIDTH) + LANE_GAP;
  }
  let pending: RoadmapLane | undefined;
  const flush = () => {
    if (!pending) return;
    trackY += addGroup(pending, BASE_WIDTH + LANE_GAP, trackY, 3, TRACK_WIDTH) + LANE_GAP;
    pending = undefined;
  };
  for (const lane of prepared.filter((item) => item.trackId)) {
    if (["theory", "ai", "interactive"].includes(lane.trackId!)) {
      flush();
      trackY += addGroup(lane, BASE_WIDTH + LANE_GAP, trackY, 6, TRACK_WIDTH * 2 + LANE_GAP) + LANE_GAP;
    } else if (pending) {
      const leftHeight = addGroup(pending, BASE_WIDTH + LANE_GAP, trackY, 3, TRACK_WIDTH);
      const rightHeight = addGroup(lane, BASE_WIDTH + TRACK_WIDTH + LANE_GAP * 2, trackY, 3, TRACK_WIDTH);
      trackY += Math.max(leftHeight, rightHeight) + LANE_GAP;
      pending = undefined;
    } else pending = lane;
  }
  flush();
  return { canonicalNodeByCode, height: Math.max(baseY, trackY), instancesByCode, nodes };
}

const LaneCard = memo(function LaneCard({ data }: NodeProps<LaneNode>) {
  return (
    <div
      className="roadmap-track-group select-none h-full w-full rounded-2xl border"
      style={{ backgroundColor: `color-mix(in srgb, ${data.color} 11%, white)`, borderColor: `color-mix(in srgb, ${data.color} 18%, white)` }}
    >
      <div className="flex items-center gap-2 px-5 pt-4">
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
}

const RoadmapInteractionContext = createContext<RoadmapInteractionContextValue | null>(null);
type CourseRelation = "current" | "previous" | "next" | null;

const CoursePorts = memo(function CoursePorts() {
  // The read-only routed edges supply their own absolute geometry. React Flow
  // only needs one endpoint of each type to mount them, not eight per card.
  return <>
    <Handle type="source" position={Position.Right} className="!h-px !w-px !border-0 !bg-transparent !opacity-0" />
    <Handle type="target" position={Position.Left} className="!h-px !w-px !border-0 !bg-transparent !opacity-0" />
  </>;
});

const CourseCard = memo(function CourseCard({ data }: NodeProps<CourseNode>) {
  const { course } = data;
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

  return <CourseCardView data={data} relation={relation} dimmed={dimmed} selected={selected} />;
});

const CourseCardView = memo(function CourseCardView({ data, relation, dimmed, selected }: {
  data: CourseNodeData;
  relation: CourseRelation;
  dimmed: boolean;
  selected: boolean;
}) {
  return (
    <div
      className={cn(
        "roadmap-course-card select-none group relative h-full w-full rounded-lg border bg-white px-3.5 py-3 text-left shadow-[0_1px_2px_rgba(15,23,42,0.05)] transition-[opacity,border-color] duration-200 motion-reduce:transition-none",
        selected
          ? "border-kaist-darkgreen shadow-[0_0_0_2px_rgba(0,92,74,0.13)]"
          : relation === "previous"
            ? "border-amber-500 shadow-[0_0_0_1px_rgba(245,158,11,0.15)]"
            : relation === "next"
              ? "border-sky-500 shadow-[0_0_0_1px_rgba(14,165,233,0.15)]"
              : relation === "current"
                ? "border-kaist-darkgreen"
                : "border-slate-200 hover:border-slate-400 hover:shadow-md",
        dimmed && "opacity-40",
      )}
    >
      <CoursePorts />
      <CourseCardBody data={data} />
    </div>
  );
});

const CourseCardBody = memo(function CourseCardBody({ data }: { data: CourseNodeData }) {
  const { course, displayCode, duplicate, lang } = data;
  return <>
      <div className="flex items-start justify-between gap-2">
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="truncate text-xs font-semibold tabular-nums text-slate-500">{displayCode}</span>
          {course.ai ? (
            <span className="shrink-0 rounded bg-sky-50 px-1.5 py-0.5 text-[length:var(--ui-text-micro-size)] font-bold leading-none text-sky-700">
              AI
            </span>
          ) : null}
        </span>
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
      {duplicate ? (
        <span className="sr-only">
          {lang === "ko" ? "여러 분야에 표시되는 과목" : "Course shown in multiple fields"}
        </span>
      ) : null}
  </>;
});

const nodeTypes = { course: CourseCard, lane: LaneCard };

function getCourseSearchText(
  course: RoadmapCourse,
  offeringsByCourse: ReadonlyMap<string, RoadmapOffering[]>,
  displayCode?: string,
) {
  const offerings = offeringsByCourse.get(course.code) ?? [];
  return [
    course.code,
    course.legacyCode ?? "",
    displayCode ?? "",
    course.name.ko,
    course.name.en,
    ...offerings.flatMap((offering) => [
      offering.currentCode,
      offering.nameKo,
      offering.instructor ?? "",
    ]),
  ].join(" ");
}

function toRoadmapOffering(record: PublicRoadmapOfferingRecord): RoadmapOffering {
  return {
    capacity: record.capacity,
    courseCode: normalizeRoadmapCourseCode(record.courseCode),
    credits: record.credits,
    currentCode: record.currentCode,
    delivery: record.delivery,
    enrolled: record.enrolled,
    inEnglish: record.inEnglish,
    instructor: record.instructor,
    nameKo: record.nameKo,
    room: record.room,
    section: record.section,
    term: record.term,
    time: record.time,
  };
}

function toRoadmapCourse(record: PublicRoadmapCourseRecord): RoadmapCourse {
  return {
    ai: record.ai,
    category: record.category,
    code: normalizeRoadmapCourseCode(record.courseCode),
    credits: record.credits,
    legacyCode: record.legacyCourseCode ?? undefined,
    name: { en: record.nameEn || record.nameKo, ko: record.nameKo },
    semesters: record.semesters,
    tracks: record.trackIds,
  };
}

function toRoadmapRelation(record: RoadmapCourseRelationRecord) {
  return {
    source: normalizeRoadmapCourseCode(record.prerequisiteCourseCode),
    target: normalizeRoadmapCourseCode(record.postrequisiteCourseCode),
  };
}

function roadmapTermSortValue(term: string): number {
  const match = term.match(/^(20\d{2})-(spring|fall)$/i);
  if (!match) return 0;
  return Number(match[1]) * 10 + (match[2].toLocaleLowerCase() === "fall" ? 2 : 1);
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
  const { pathname } = useLocation();
  const [savedView] = useState(readRoadmapViewState);
  const viewportMemoryRef = useRef(selectedCourseCode ? savedView?.viewport ?? null : null);
  const [canvasViewport, setCanvasViewport] = useState(selectedCourseCode ? savedView?.viewport ?? null : null);
  const apiClient = useMemo(
    () => createApiClient({ baseUrl: resolveApiBaseUrl() }),
    [],
  );
  const { data: importedOfferingsResponse } = useQuery({
    queryKey: ["roadmap", "offerings"],
    queryFn: () => apiClient.getRoadmapOfferings(),
    retry: false,
    staleTime: 60_000,
  });
  const [selectedInstanceId, setSelectedInstanceId] = useState<string | null>(savedView?.selectedCourseCode === selectedCourseCode ? savedView?.selectedInstanceId ?? null : null);
  const [selectedTrackIds, setSelectedTrackIds] = useState<Set<string>>(() => new Set(savedView?.selectedTrackIds.filter(id => ROADMAP_TRACKS.some(track => track.id === id))));
  const [searchText, setSearchText] = useState(savedView?.searchText ?? "");
  const [searchOpen, setSearchOpen] = useState(false);
  const [selectedTerm, setSelectedTerm] = useState<RoadmapOfferingTerm>(savedView?.selectedTerm ?? "2026-fall");
  const [offeredOnly, setOfferedOnly] = useState(savedView?.offeredOnly ?? false);
  const isMobile = useMediaQuery("(max-width: 767px)");
  const [lastSelectedCourseCode, setLastSelectedCourseCode] = useState(selectedCourseCode);
  if (selectedCourseCode && selectedCourseCode !== lastSelectedCourseCode) {
    setLastSelectedCourseCode(selectedCourseCode);
  }
  // Keep the exiting sheet's content when a URL update clears the selection.
  const sheetCourseCode = selectedCourseCode ?? lastSelectedCourseCode;
  const showGraph = useMediaQuery("(min-width: 1024px)");
  const [filterOpen, setFilterOpen] = useState(false);
  const [draftFilters, setDraftFilters] = useState({ term: selectedTerm, offeredOnly, tracks: new Set<string>() });
  const [flow, setFlow] = useState<ReactFlowInstance<GraphNode, Edge> | null>(null);
  const flowViewportRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const activeCourseCode = selectedCourseCode;

  useEffect(() => {
    if (!showGraph) {
      setFlow(null);
      setCanvasViewport(viewportMemoryRef.current);
    }
  }, [showGraph]);

  const remoteCourses = useMemo(
    () => (importedOfferingsResponse?.courses ?? []).map(toRoadmapCourse),
    [importedOfferingsResponse?.courses],
  );
  const hasRemoteCatalog = remoteCourses.length > 0;
  const roadmapRelations = useMemo(
    () =>
      importedOfferingsResponse?.relations
        ? importedOfferingsResponse.relations.map(toRoadmapRelation)
        : ROADMAP_RELATIONS,
    [importedOfferingsResponse?.relations],
  );

  const effectiveOfferings = useMemo(() => {
    const importedOfferings =
      importedOfferingsResponse?.items.map(toRoadmapOffering) ?? [];
    if (importedOfferings.length === 0) return ROADMAP_OFFERINGS;

    const importedTerms = new Set(importedOfferings.map((offering) => offering.term));
    return [
      ...ROADMAP_OFFERINGS.filter((offering) => !importedTerms.has(offering.term)),
      ...importedOfferings,
    ];
  }, [importedOfferingsResponse]);
  const offeringsByCourse = useMemo(
    () => groupRoadmapOfferings(effectiveOfferings),
    [effectiveOfferings],
  );
  const termOptions = useMemo(
    () =>
      [...new Set(effectiveOfferings.map((offering) => offering.term))]
        .sort((left, right) => roadmapTermSortValue(right) - roadmapTermSortValue(left))
        .map((term) => ({ value: term, label: getRoadmapTermLabel(term, lang) })),
    [effectiveOfferings, lang],
  );
  const importedCourseCodes = useMemo(
    () =>
      [...offeringsByCourse.keys()].filter(
        (courseCode) =>
          !(hasRemoteCatalog ? remoteCourses : ROADMAP_COURSES).some(
            (course) => course.code === courseCode,
          ),
      ),
    [hasRemoteCatalog, offeringsByCourse, remoteCourses],
  );
  const roadmapCourses = useMemo<RoadmapCourse[]>(
    () => (hasRemoteCatalog ? remoteCourses : [
      ...ROADMAP_COURSES,
      ...importedCourseCodes.map((courseCode) => {
        const offering = offeringsByCourse.get(courseCode)?.[0];
        const semesters = [
          ...new Set(
            (offeringsByCourse.get(courseCode) ?? []).map((item) =>
              item.term.endsWith("-spring") ? "S" : item.term.endsWith("-fall") ? "F" : item.term,
            ),
          ),
        ].join("/");
        return {
          category: "major-elective" as const,
          code: courseCode,
          credits: offering?.credits ?? "—",
          name: { en: offering?.nameKo ?? courseCode, ko: offering?.nameKo ?? courseCode },
          semesters: semesters || "—",
          tracks: [],
        };
      }),
    ]),
    [hasRemoteCatalog, importedCourseCodes, offeringsByCourse, remoteCourses],
  );
  const roadmapCourseByCode = useMemo(
    () => new Map(roadmapCourses.map((course) => [course.code, course])),
    [roadmapCourses],
  );
  const roadmapLanes = useMemo(() => {
    const assignedCodes = new Set(ROADMAP_LANES.flatMap((lane) => lane.courses));
    const unassignedCourseCodes = roadmapCourses
      .map((course) => course.code)
      .filter((code) => !assignedCodes.has(code));
    if (unassignedCourseCodes.length === 0) return ROADMAP_LANES;
    return [
      ...ROADMAP_LANES,
      {
        id: "imported",
        label: { en: "Imported offerings", ko: "Import 개설 과목" },
        courses: unassignedCourseCodes,
      },
    ];
  }, [roadmapCourses]);
  const displayCodeByCourse = useMemo(() => {
    const displayCodes = new Map<string, string>();
    for (const course of roadmapCourses) {
      // The course master is the source of truth for the card code. An
      // offering's section or historical ERP code must not leak into the
      // roadmap card label (for example, "CS10001 (A)" must stay "CS10001").
      displayCodes.set(course.code, course.code);
    }
    return displayCodes;
  }, [roadmapCourses]);
  const termOfferings = useMemo(
    () => effectiveOfferings.filter((offering) => offering.term === selectedTerm),
    [effectiveOfferings, selectedTerm],
  );
  const offeredCourseCodes = useMemo(
    () => new Set(termOfferings.map((offering) => offering.courseCode)),
    [termOfferings],
  );
  const visibleCourseCodes = offeredOnly ? offeredCourseCodes : null;
  const layout = useMemo(
    () => buildLayout(lang, roadmapCourses, roadmapLanes, visibleCourseCodes, displayCodeByCourse),
    [displayCodeByCourse, lang, roadmapCourses, roadmapLanes, visibleCourseCodes],
  );

  useEffect(() => {
    if (termOptions.some((option) => option.value === selectedTerm)) return;
    const nextTerm = termOptions[0]?.value;
    if (nextTerm) setSelectedTerm(nextTerm);
  }, [selectedTerm, termOptions]);

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
          ? roadmapRelations.filter((item) => item.target === activeCourseCode).map(
              (item) => item.source,
            )
          : [],
      ),
    [activeCourseCode, roadmapRelations],
  );
  const nextCodes = useMemo(
    () =>
      new Set(
        activeCourseCode
          ? roadmapRelations.filter((item) => item.source === activeCourseCode).map(
              (item) => item.target,
            )
          : [],
      ),
    [activeCourseCode, roadmapRelations],
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

  const panBounds = useMemo<[[number, number], [number, number]]>(() => {
    if (!nodes.length) return [[-LANE_WIDTH, -LANE_WIDTH], [LANE_WIDTH, LANE_WIDTH]];
    const minX = Math.min(...nodes.map((node) => node.position.x));
    const minY = Math.min(...nodes.map((node) => node.position.y));
    const maxX = Math.max(...nodes.map((node) => node.position.x + Number(node.style?.width ?? COURSE_WIDTH)));
    const maxY = Math.max(...nodes.map((node) => node.position.y + Number(node.style?.height ?? COURSE_HEIGHT)));
    const margin = Math.max(LANE_WIDTH / 2, (maxX - minX) / 2);
    return [[minX - margin, minY - margin], [maxX + margin, maxY + margin]];
  }, [nodes]);

  const interactionValue = useMemo<RoadmapInteractionContextValue>(
    () => ({
      activeCourseCode,
      nextCodes,
      previousCodes,
      selectedCourseCode,
      selectedTrackIds,
    }),
    [activeCourseCode, nextCodes, previousCodes, selectedCourseCode, selectedTrackIds],
  );

  const routing = useMemo(() => ({
    nodeById: new Map(layout.nodes.map(node => [node.id, node])),
    getRoute: createRoadmapRouter(layout.nodes.filter(node => node.type === "course").map(node => ({ id: node.id, ...node.position }))),
  }), [layout]);

  const edges = useMemo<Edge[]>(
    () => {
      if (!activeCourseCode || !showGraph) return [];
      const selectedInstance = routing.nodeById.get(selectedInstanceId ?? "");
      const anchor = selectedInstance?.type === "course" && selectedInstance.data.course.code === activeCourseCode ? selectedInstance : undefined;
      const resolvedNodes = new Map<string, string | undefined>();
      const nodeFor = (code: string) => {
        if (resolvedNodes.has(code)) return resolvedNodes.get(code);
        const canonical = layout.canonicalNodeByCode.get(code);
        let closest = canonical;
        if (code === activeCourseCode && anchor) closest = anchor.id;
        else if (anchor && !canonical?.startsWith("core:") && !canonical?.startsWith("foundation:")) {
          let distance = Infinity;
          for (const id of layout.instancesByCode.get(code) ?? []) {
            const node = routing.nodeById.get(id)!;
            const candidateDistance = (node.position.x - anchor.position.x) ** 2 + (node.position.y - anchor.position.y) ** 2;
            if (candidateDistance < distance) { distance = candidateDistance; closest = id; }
          }
        }
        resolvedNodes.set(code, closest);
        return closest;
      };
      const result: Edge[] = roadmapRelations.flatMap((relation) => {
        if (relation.source !== activeCourseCode && relation.target !== activeCourseCode) return [];
        const source = nodeFor(relation.source);
        const target = nodeFor(relation.target);
        if (!source || !target) return [];
        const route = routing.getRoute(source, target);
        if (!route) return [];
        const color = relation.target === activeCourseCode ? "#d97706" : "#0284c7";
        return [
          {
            id: `${relation.source}-${relation.target}`,
            source,
            target,
            type: "smoothstep",
            data: { points: route.points },
            className: "roadmap-edge-flow",
            focusable: false,
            interactionWidth: 0,
            markerEnd: {
              type: MarkerType.ArrowClosed,
              width: 13,
              height: 13,
              color: color,
            },
            style: {
              opacity: 0.95,
              pointerEvents: "none",
              stroke: color,
              strokeWidth: 1.5,
              vectorEffect: "non-scaling-stroke",
            },
            selectable: false,
            zIndex: 2,
            ariaLabel:
              lang === "ko"
                ? `${relation.source}에서 ${relation.target}로 이어지는 권장 수강 순서`
                : `Recommended sequence from ${relation.source} to ${relation.target}`,
          },
        ];
      });
      for (const color of ["#d97706", "#0284c7"]) {
        const group = result.filter((edge) => edge.style?.stroke === color);
        const paths = uniqueRoutePaths(group.map((edge) => edge.data!.points as Point[]));
        const pointCounts = new Map<string, number>();
        paths.flat(2).forEach(point => {
          const key = `${point.x},${point.y}`;
          pointCounts.set(key, (pointCounts.get(key) ?? 0) + 1);
        });
        const junctions = [...pointCounts].filter(([, count]) => count > 1).map(([key]) => key);
        group.forEach((edge, index) => { edge.data = { ...edge.data, paths: paths[index], junctions }; });
      }
      return result;
    },
    [activeCourseCode, lang, layout, roadmapRelations, routing, selectedInstanceId, showGraph],
  );

  const searchMatches = useMemo(() => {
    const query = searchText.trim().toLocaleLowerCase();
    if (!query) return [];
    return roadmapCourses.filter((item) =>
      getCourseSearchText(item, offeringsByCourse, displayCodeByCourse.get(item.code))
        .toLocaleLowerCase()
        .includes(query),
    ).slice(0, 6);
  }, [displayCodeByCourse, offeringsByCourse, roadmapCourses, searchText]);

  const focusedCourseRef = useRef<string | null>(null);
  const requestedCourseRef = useRef<{ code: string; instanceId?: string } | null>(null);
  const persistView = useCallback((viewport?: RoadmapViewport) => {
    // Suspense can keep this tree mounted while another route is loading.
    // Its new URL must not overwrite the last actual roadmap selection.
    if (pathname !== "/life/roadmap") return;
    const element = flowViewportRef.current;
    const width = element?.clientWidth || viewportMemoryRef.current?.width;
    const height = element?.clientHeight || viewportMemoryRef.current?.height;
    if (viewport && width && height) {
      viewportMemoryRef.current = { ...viewport, width, height, courseCode: selectedCourseCode };
    }
    saveRoadmapViewState({ selectedTerm, offeredOnly, selectedTrackIds: [...selectedTrackIds], searchText, selectedCourseCode, selectedInstanceId, viewport: viewportMemoryRef.current });
  }, [offeredOnly, pathname, searchText, selectedCourseCode, selectedInstanceId, selectedTerm, selectedTrackIds]);

  useEffect(() => { persistView(); }, [persistView]);
  useLayoutEffect(() => () => {
    // Capture the actual camera even if navigation interrupts an animation.
    if (flow) persistView(flow.getViewport());
  }, [flow, persistView]);

  const handleMoveEnd = useCallback<OnMove>((_, viewport) => persistView(viewport), [persistView]);
  const handleFlowInit = useCallback((instance: ReactFlowInstance<GraphNode, Edge>) => {
    const element = flowViewportRef.current;
    if (canvasViewport && element) {
      void instance.setViewport(restoreRoadmapViewport(canvasViewport, { width: element.clientWidth, height: element.clientHeight }));
      // Returning to the same selection must preserve a manually panned view.
      if (canvasViewport.courseCode === selectedCourseCode) focusedCourseRef.current = selectedCourseCode;
    }
    persistView(instance.getViewport());
    setFlow(instance);
  }, [canvasViewport, persistView, selectedCourseCode]);

  const moveToCourse = useCallback((code: string, instanceId?: string) => {
    const nodeId = instanceId ?? layout.canonicalNodeByCode.get(code);
    const node = routing.nodeById.get(nodeId ?? "");
    const viewportElement = flowViewportRef.current;
    if (!flow || !node || !viewportElement || !showGraph) return;
    focusedCourseRef.current = code;
    const current = flow.getViewport();
    const size = {
      width: viewportElement.clientWidth, height: viewportElement.clientHeight,
    };
    if (isCourseComfortablyVisible(current, size, { ...node.position, width: COURSE_WIDTH, height: COURSE_HEIGHT })) {
      // Stop an older flight if a newly selected card is already readable here.
      void flow.setViewport(current);
      return;
    }
    const { viewport, duration } = getCourseFocusViewport(current, size, {
      x: node.position.x + COURSE_WIDTH / 2, y: node.position.y + COURSE_HEIGHT / 2,
    }, window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    // Each request starts from the current camera; D3 replaces an in-flight
    // transition instead of queuing a second trip behind it.
    void flow.setViewport(viewport, {
      duration,
      ease: easeRoadmapCamera,
      interpolate: "linear",
    });
  }, [flow, layout.canonicalNodeByCode, routing, showGraph]);

  const focusCourse = useCallback((code: string, instanceId?: string) => {
    requestedCourseRef.current = { code, instanceId };
    if (code === selectedCourseCode && (instanceId ?? null) === selectedInstanceId) {
      moveToCourse(code, instanceId);
      requestedCourseRef.current = null;
    }
    onSelectedCourseChange(code);
    setSearchOpen(false);
    setSelectedInstanceId(instanceId ?? null);
  }, [moveToCourse, onSelectedCourseChange, selectedCourseCode, selectedInstanceId]);

  const handleNodeClick = useCallback<NodeMouseHandler<GraphNode>>((_, node) => {
    if (node.type === "course") focusCourse(node.data.course.code, node.id);
  }, [focusCourse]);
  const handlePaneClick = useCallback(() => onSelectedCourseChange(null), [onSelectedCourseChange]);
  const ariaLabelConfig = useMemo(() => ({
    "controls.ariaLabel": lang === "ko" ? "지도 조작" : "Map controls",
    "controls.zoomIn.ariaLabel": lang === "ko" ? "확대" : "Zoom in",
    "controls.zoomOut.ariaLabel": lang === "ko" ? "축소" : "Zoom out",
  }), [lang]);

  useEffect(() => {
    if (pathname !== "/life/roadmap") return;
    if (!selectedCourseCode || !showGraph) {
      focusedCourseRef.current = null;
      return;
    }
    const requested = requestedCourseRef.current;
    // A URL transition can briefly render the old selection. Wait for its target.
    if (requested && requested.code !== selectedCourseCode) return;
    if (!requested && focusedCourseRef.current === selectedCourseCode) return;
    // Start after selection rendering, so expensive node updates cannot consume
    // the animation duration before the camera's first visible frame.
    const frame = requestAnimationFrame(() => {
      moveToCourse(selectedCourseCode, requested?.instanceId ?? selectedInstanceId ?? undefined);
      requestedCourseRef.current = null;
    });
    return () => cancelAnimationFrame(frame);
  }, [moveToCourse, pathname, selectedCourseCode, selectedInstanceId, showGraph]);

  const toggleTrack = (trackId: string) => {
    setSelectedTrackIds((current) => {
      const next = new Set(current);
      if (next.has(trackId)) next.delete(trackId);
      else next.add(trackId);
      return next;
    });
  };

  const mobileCourses = roadmapCourses.filter((item) => {
    const query = searchText.trim().toLocaleLowerCase();
    const matchesQuery =
      !query ||
      getCourseSearchText(item, offeringsByCourse, displayCodeByCourse.get(item.code))
        .toLocaleLowerCase()
        .includes(query);
    const matchesTrack =
      selectedTrackIds.size === 0 || item.tracks.some((trackId) => selectedTrackIds.has(trackId));
    const matchesAvailability = !offeredOnly || offeredCourseCodes.has(item.code);
    return matchesQuery && matchesTrack && matchesAvailability;
  });

  return (
    <>
      {!showGraph && <div className="lg:hidden">
        {isMobile ? <>
          <div className="mobile-filter-toolbar">
            <TextInput type="search" value={searchText} onChange={event => setSearchText(event.target.value)} aria-label={lang === "ko" ? "과목 검색" : "Search courses"} placeholder={lang === "ko" ? "과목 코드, 과목명 검색" : "Search courses"} leading={<Search className="size-4" aria-hidden="true" />} />
            <MobileFilterButton label={lang === "ko" ? "필터" : "Filters"} open={filterOpen} active={offeredOnly || selectedTrackIds.size > 0 || selectedTerm !== "2026-fall"} onClick={() => { setDraftFilters({ term: selectedTerm, offeredOnly, tracks: new Set(selectedTrackIds) }); setFilterOpen(true); }} />
          </div>
          <FilterSheet className="mobile-filter-sheet" open={filterOpen} onClose={() => setFilterOpen(false)} title={lang === "ko" ? "과목 필터" : "Course filters"} closeLabel={lang === "ko" ? "필터 닫기" : "Close filters"} footer={<MobileFilterActions lang={lang} onReset={() => setDraftFilters({ term: termOptions.find(option => option.value === "2026-fall")?.value ?? termOptions[0]?.value ?? selectedTerm, offeredOnly: false, tracks: new Set() })} onApply={() => { setSelectedTerm(draftFilters.term); setOfferedOnly(draftFilters.offeredOnly); setSelectedTrackIds(draftFilters.tracks); setFilterOpen(false); }} />}>
            <fieldset className="mobile-filter-fieldset"><legend>{lang === "ko" ? "학기" : "Semester"}</legend>
              <UiSelect className="w-full" aria-label={lang === "ko" ? "학기" : "Semester"} value={draftFilters.term} onChange={event => setDraftFilters(previous => ({ ...previous, term: event.target.value as RoadmapOfferingTerm }))}>{termOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</UiSelect>
              <label className="mobile-filter-option"><Switch checked={draftFilters.offeredOnly} onCheckedChange={value => setDraftFilters(previous => ({ ...previous, offeredOnly: value }))} aria-label={lang === "ko" ? "선택한 학기 개설 과목만" : "Offered this semester only"} /><span>{lang === "ko" ? "선택한 학기 개설 과목만" : "Offered this semester only"}</span></label>
            </fieldset>
            <fieldset className="mobile-filter-fieldset"><legend>{lang === "ko" ? "교육 분야" : "Fields"}</legend>{ROADMAP_TRACKS.map(track => <label key={track.id} className="mobile-filter-option"><input type="checkbox" checked={draftFilters.tracks.has(track.id)} onChange={() => setDraftFilters(previous => { const tracks = new Set(previous.tracks); if (tracks.has(track.id)) tracks.delete(track.id); else tracks.add(track.id); return { ...previous, tracks }; })} /><span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: track.color }} /><span>{track.label[lang]}</span></label>)}</fieldset>
          </FilterSheet>
        </> : <>
        <TextInput
          className="!font-normal"
              type="search"
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
          termOptions={termOptions}
          onOfferedOnlyChange={setOfferedOnly}
          onTermChange={setSelectedTerm}
        />
        <details className="roadmap-mobile-fields mt-3 rounded-xl border border-slate-200 bg-white">
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 px-3 text-sm font-medium text-slate-700">
            <span>{lang === "ko" ? "교육 분야" : "Fields"} · {selectedTrackIds.size === 0 ? (lang === "ko" ? "전체" : "All") : (lang === "ko" ? `${selectedTrackIds.size}개 선택` : `${selectedTrackIds.size} selected`)}</span>
            <ChevronDown aria-hidden="true" className="size-4 shrink-0 transition-transform" />
          </summary>
          <div className="grid gap-1 border-t border-slate-100 p-2 sm:grid-cols-2">
            {ROADMAP_TRACKS.map(track => <label key={track.id} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-2 text-sm text-slate-700 hover:bg-slate-50"><input type="checkbox" checked={selectedTrackIds.has(track.id)} onChange={() => toggleTrack(track.id)} className="size-4 shrink-0 accent-emerald-700" /><span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: track.color }} />{track.label[lang]}</label>)}
          </div>
        </details>
        </>}

        {isMobile ? <FilterSheet className="mobile-filter-sheet mobile-course-sheet" bodyClassName="mobile-course-sheet-body" open={Boolean(selectedCourseCode)} onClose={() => onSelectedCourseChange(null)} title={<span className="flex min-w-0 items-center gap-2"><span className="min-w-0">{sheetCourseCode ? roadmapCourseByCode.get(sheetCourseCode)?.name[lang] ?? (lang === "ko" ? "과목 상세" : "Course details") : ""}</span>{sheetCourseCode && <span className="roadmap-course-code">{displayCodeByCourse.get(sheetCourseCode) ?? sheetCourseCode}</span>}</span>} closeLabel={lang === "ko" ? "과목 상세 닫기" : "Close course details"}>
          <CourseDetails courseCode={sheetCourseCode} courseByCode={roadmapCourseByCode} displayCodeByCourse={displayCodeByCourse} lang={lang} relations={roadmapRelations} offeringsByCourse={offeringsByCourse} selectedTerm={selectedTerm} onClose={() => onSelectedCourseChange(null)} onCourseClick={onSelectedCourseChange} sheet />
        </FilterSheet> : selectedCourseCode ? (
          <div className="mt-4 rounded-xl border border-slate-200 bg-white px-4 pb-5">
            <CourseDetails
              courseCode={selectedCourseCode}
              courseByCode={roadmapCourseByCode}
              displayCodeByCourse={displayCodeByCourse}
              lang={lang}
              relations={roadmapRelations}
              offeringsByCourse={offeringsByCourse}
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
              aria-haspopup={isMobile ? "dialog" : undefined}
              onClick={() => onSelectedCourseChange(item.code)}
              className="mobile-roadmap-course-row flex min-h-16 w-full items-center gap-3 py-3 text-left"
            >
              <span className="hidden w-14 shrink-0 text-xs font-semibold text-slate-500 md:block">
                {displayCodeByCourse.get(item.code) ?? item.code}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block line-clamp-2 break-words text-sm font-semibold leading-5 text-slate-900">{item.name[lang]}</span>
                <span className="mt-1 block text-xs font-medium text-slate-400">
                  <span className="md:hidden">{displayCodeByCourse.get(item.code) ?? item.code} · </span>
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
      </div>}

      {showGraph && <div className="roadmap-desktop-layout hidden min-w-0 gap-5 lg:grid lg:grid-cols-[minmax(0,1fr)_18rem]">
      <div className="min-w-0">

        <div ref={flowViewportRef} className={cn("roadmap-flow-viewport relative h-[calc(100svh-13rem)] min-h-[24rem] md:min-h-[38rem] max-h-[54rem] overflow-hidden rounded-xl border border-slate-200 bg-slate-50", isFullscreen && "roadmap-flow-viewport--fullscreen")}>
          <RoadmapInteractionContext.Provider value={interactionValue}>
            <ReactFlow<GraphNode, Edge>
              proOptions={FLOW_PRO_OPTIONS}
              nodes={nodes}
              edges={edges}
              nodeTypes={nodeTypes}
              edgeTypes={edgeTypes}
              onInit={handleFlowInit}
              onMoveEnd={handleMoveEnd}
              onNodeClick={handleNodeClick}
              onPaneClick={handlePaneClick}
              defaultViewport={canvasViewport ?? undefined}
              fitView={!canvasViewport}
              fitViewOptions={FLOW_FIT_OPTIONS}
              translateExtent={panBounds}
              minZoom={0.1}
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
              ariaLabelConfig={ariaLabelConfig}
            >
              <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="#cbd5e1" />
            </ReactFlow>
          </RoadmapInteractionContext.Provider>
          <div className="roadmap-flow-viewport__controls roadmap-flow-viewport__controls--bottom" role="toolbar" aria-label={lang === "ko" ? "로드맵 보기 도구" : "Roadmap view tools"}>
            <IconButton
              type="button"
              onClick={() => void toggleFullscreen()}
              aria-label={isFullscreen ? (lang === "ko" ? "전체 화면 닫기" : "Exit full screen") : (lang === "ko" ? "전체 화면" : "Full screen")}
              data-tooltip={isFullscreen ? (lang === "ko" ? "전체 화면 닫기" : "Exit full screen") : (lang === "ko" ? "전체 화면" : "Full screen")}
              className="size-10 rounded-full border-0 bg-transparent text-slate-600 shadow-none hover:border-0 hover:bg-slate-100 hover:text-slate-900"
            >
              {isFullscreen ? <Minimize2 aria-hidden="true" className="size-4" /> : <Maximize2 aria-hidden="true" className="size-4" />}
            </IconButton>
            <IconButton
              type="button"
              aria-label={lang === "ko" ? "로드맵 전체 보기" : "Fit roadmap to view"}
              data-tooltip={lang === "ko" ? "로드맵 전체 보기" : "Fit roadmap to view"}
              onClick={() => void flow?.fitView({ padding: 0.15, duration: 300 })}
              className="size-10 rounded-full border-0 bg-transparent text-slate-600 shadow-none hover:border-0 hover:bg-slate-100 hover:text-slate-900"
            >
              <RotateCcw aria-hidden="true" className="size-4" />
            </IconButton>
            <IconButton
              type="button"
              aria-label={lang === "ko" ? "확대" : "Zoom in"}
              data-tooltip={lang === "ko" ? "확대" : "Zoom in"}
              onClick={() => void flow?.zoomIn({ duration: 200 })}
              className="size-10 rounded-full border-0 bg-transparent text-slate-600 shadow-none hover:border-0 hover:bg-slate-100 hover:text-slate-900"
            >
              <Plus aria-hidden="true" className="size-4" />
            </IconButton>
            <IconButton
              type="button"
              aria-label={lang === "ko" ? "축소" : "Zoom out"}
              data-tooltip={lang === "ko" ? "축소" : "Zoom out"}
              onClick={() => void flow?.zoomOut({ duration: 200 })}
              className="size-10 rounded-full border-0 bg-transparent text-slate-600 shadow-none hover:border-0 hover:bg-slate-100 hover:text-slate-900"
            >
              <Minus aria-hidden="true" className="size-4" />
            </IconButton>
          </div>
        </div>
      </div>

      <aside className="roadmap-filters min-w-0 space-y-5 lg:sticky lg:top-24 lg:self-start">
        {!selectedCourseCode && <>
          <div className="relative z-20 w-full"
            onFocusCapture={() => setSearchOpen(true)}
            onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget)) setSearchOpen(false); }}
            onKeyDown={event => { if (event.key === "Escape") setSearchOpen(false); }}
          >
            <div onKeyDown={(event) => {
              if (event.key === "Enter" && searchMatches[0]) focusCourse(searchMatches[0].code);
            }}>
              <PageSearchField
                className="!w-full"
                value={searchText}
                onChange={setSearchText}
                onClear={() => setSearchText("")}
                ariaLabel={lang === "ko" ? "과목 검색" : "Search courses"}
                placeholder={lang === "ko" ? "과목 코드, 과목명 검색" : "Search by code or title"}
              />
            </div>
            {searchOpen && searchMatches.length > 0 ? (
              <div className="absolute left-0 right-0 top-[calc(100%+0.375rem)] overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl">
                {searchMatches.map((item) => {
                  const offering = offeringsByCourse.get(item.code)?.[0];
                  return (
                    <button
                      key={item.code}
                      type="button"
                      onClick={() => focusCourse(item.code)}
                      className="flex min-h-12 w-full items-center gap-3 border-b border-slate-100 px-3 text-left last:border-b-0 hover:bg-slate-50"
                    >
                      <span className="w-14 shrink-0 text-xs font-semibold text-slate-500">
                        {displayCodeByCourse.get(item.code) ?? item.code}
                      </span>
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
        <RoadmapOfferingControls
          lang={lang}
          offeredOnly={offeredOnly}
          selectedTerm={selectedTerm}
          termOptions={termOptions}
          onOfferedOnlyChange={setOfferedOnly}
          onTermChange={setSelectedTerm}
        />
        <details open={!selectedCourseCode} className="roadmap-mobile-fields group border-b border-slate-200 pb-3">
            <summary className="flex min-h-[var(--ui-control-height)] cursor-pointer list-none items-center justify-between gap-3">
              <h2 id="roadmap-track-filter" className="text-sm font-semibold text-slate-900">
                {lang === "ko" ? "교육 분야" : "Fields"}
              </h2>
              {selectedTrackIds.size > 0 ? (
                <button
                  type="button"
                  onClick={(event) => { event.preventDefault(); setSelectedTrackIds(new Set()); }}
                  className="text-[length:var(--ui-control-font-size)] font-semibold text-kaist-darkgreen hover:underline"
                >
                  {lang === "ko" ? "전체" : "All"}
                </button>
              ) : null}
              <ChevronDown aria-hidden="true" className="ml-auto size-4 text-slate-400" />
            </summary>
            <div className="mt-2 grid grid-cols-2 gap-1.5 lg:grid-cols-1">
              {ROADMAP_TRACKS.map((track) => {
                const selected = selectedTrackIds.has(track.id);
                return (
                  <button
                    key={track.id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => toggleTrack(track.id)}
                    className={cn(
                      "flex min-h-[var(--ui-control-height)] items-center gap-2 rounded-md px-3 text-left text-[length:var(--ui-control-font-size)] font-medium transition-colors",
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
        </details>
        </>}
        {selectedCourseCode ? (
          <div key="course-details" className="roadmap-side-panel__view roadmap-details-panel">
            <CourseDetails
              courseCode={selectedCourseCode}
              courseByCode={roadmapCourseByCode}
              displayCodeByCourse={displayCodeByCourse}
              lang={lang}
              relations={roadmapRelations}
              offeringsByCourse={offeringsByCourse}
              selectedTerm={selectedTerm}
              onClose={() => onSelectedCourseChange(null)}
              onCourseClick={focusCourse}
            />
          </div>
        ) : null}
      </aside>
      </div>}
    </>
  );
}

function RoadmapOfferingControls({
  lang,
  offeredOnly,
  selectedTerm,
  termOptions,
  onOfferedOnlyChange,
  onTermChange,
}: {
  lang: RoadmapLanguage;
  offeredOnly: boolean;
  selectedTerm: RoadmapOfferingTerm;
  termOptions: { value: RoadmapOfferingTerm; label: string }[];
  onOfferedOnlyChange: (value: boolean) => void;
  onTermChange: (value: RoadmapOfferingTerm) => void;
}) {
  return (
    <div className="roadmap-offering-controls flex flex-col items-stretch gap-3">
      <SelectDropdown
        ariaLabel={lang === "ko" ? "개설 학기" : "Offering semester"}
        value={selectedTerm}
        options={termOptions}
        onChange={(value) => onTermChange(value as RoadmapOfferingTerm)}
        className="w-full"
        buttonClassName="h-[var(--ui-control-height)] min-h-[var(--ui-control-height)] text-[length:var(--ui-control-font-size)] font-normal"
        optionClassName="text-[length:var(--ui-control-font-size)] !font-normal"
      />
      <label className="roadmap-offered-only flex min-h-[var(--ui-control-height)] cursor-pointer items-center justify-between gap-3 text-[length:var(--ui-control-font-size)] font-normal text-slate-600">
        <span>{lang === "ko" ? "이번 학기 개설 과목만 보기" : "Offered this semester only"}</span>
        <Switch checked={offeredOnly} onCheckedChange={onOfferedOnlyChange} aria-label={lang === "ko" ? "이번 학기 개설 과목만 보기" : "Offered this semester only"} />
      </label>
    </div>
  );
}

interface CourseDetailsProps {
  courseCode: string | null;
  courseByCode: ReadonlyMap<string, RoadmapCourse>;
  displayCodeByCourse: ReadonlyMap<string, string>;
  lang: RoadmapLanguage;
  onClose: () => void;
  onCourseClick: (code: string) => void;
  offeringsByCourse: ReadonlyMap<string, RoadmapOffering[]>;
  relations: ReadonlyArray<{ source: string; target: string }>;
  selectedTerm: RoadmapOfferingTerm;
  sheet?: boolean;
}

function CourseDetails({
  courseCode,
  courseByCode,
  displayCodeByCourse,
  lang,
  onClose,
  onCourseClick,
  offeringsByCourse,
  relations,
  selectedTerm,
  sheet = false,
}: CourseDetailsProps) {
  const [activeTab, setActiveTab] = useState<"overview" | "offerings">("overview");
  const item = courseCode ? courseByCode.get(courseCode) : undefined;
  const otlUrl = item ? getRoadmapOtlUrl(item.code) : null;
  const allOfferings = item ? offeringsByCourse.get(item.code) ?? [] : [];
  const offerings = allOfferings.filter((offering) => offering.term === selectedTerm);
  const previous = item
    ? relations.filter((relation) => relation.target === item.code).map(
        (relation) => relation.source,
      )
    : [];

  useEffect(() => {
    setActiveTab("overview");
  }, [courseCode]);
  const next = item
    ? relations.filter((relation) => relation.source === item.code).map(
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
    <section className="roadmap-course-details pt-5" aria-live="polite">
      {!sheet && <div className="flex items-center justify-between gap-3">
        <div className="roadmap-course-heading flex min-w-0 items-center gap-2">
          <h2 className="min-w-0 text-lg font-semibold leading-6 tracking-tight text-slate-950">{item.name[lang]}</h2>
          <span className="roadmap-course-code self-center">{displayCodeByCourse.get(item.code) ?? item.code}</span>
        </div>
        {!sheet && <IconButton aria-label={lang === "ko" ? "과목 상세 닫기" : "Close details"} onClick={onClose}>
          <X aria-hidden="true" className="size-4" />
        </IconButton>}
      </div>}

      <div className={cn("grid shrink-0 grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1", !sheet && "mt-4")} role="tablist" aria-label={lang === "ko" ? "과목 상세 탭" : "Course detail tabs"}>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "overview"}
          onClick={() => setActiveTab("overview")}
          className={cn(
            "min-h-11 rounded-md px-2 text-xs font-semibold transition-colors lg:min-h-9",
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
            "min-h-11 rounded-md px-2 text-xs font-semibold transition-colors lg:min-h-9",
            activeTab === "offerings" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800",
          )}
        >
          {lang === "ko" ? `개설 분반 (${offerings.length})` : `Offerings (${offerings.length})`}
        </button>
      </div>

      <div className="roadmap-details-scroll" key={`${courseCode}-${activeTab}`} role="tabpanel" tabIndex={0}>
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
        <div className={!item.ai ? "mobile-empty-course-field" : undefined}>
          <dt className="font-medium text-slate-400">{lang === "ko" ? "AI 중점" : "AI focus"}</dt>
          <dd className="mt-1 font-semibold text-slate-800">{item.ai ? (lang === "ko" ? "해당" : "Yes") : "—"}</dd>
        </div>
          </dl>

          <div className={`mt-4${item.tracks.length === 0 ? " mobile-empty-course-field" : ""}`}>
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
            title={lang === "ko" ? "권장 선수 과목" : "Recommended prerequisites"}
            codes={previous}
            courseByCode={courseByCode}
            displayCodeByCourse={displayCodeByCourse}
            lang={lang}
            tone="previous"
            onCourseClick={onCourseClick}
          />
          <RelationList
            title={lang === "ko" ? "후속 과목" : "Follow-up courses"}
            codes={next}
            courseByCode={courseByCode}
            displayCodeByCourse={displayCodeByCourse}
            lang={lang}
            tone="next"
            onCourseClick={onCourseClick}
          />
        </>
      )}
      </div>
      {otlUrl && <div className="roadmap-course-footer shrink-0 pt-4">
        <Button asChild variant="outline" className="min-h-11 w-full !border-slate-200 !bg-white hover:!border-slate-300 hover:!bg-slate-50">
          <a href={otlUrl} target="_blank" rel="noopener noreferrer">
            {lang === "ko" ? "OTL 강의평 확인하기" : "View course reviews on OTL"}
            <ExternalLink aria-hidden="true" className="size-4" />
          </a>
        </Button>
      </div>}
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
    <div className="roadmap-offering-list mt-4 space-y-2">
      {offerings.map((offering) => {
        const enrollment =
          offering.capacity !== null
            ? `${offering.enrolled ?? "—"} / ${offering.capacity}`
            : offering.enrolled !== null
              ? String(offering.enrolled)
              : null;
        const sectionInfo = offering.section
          ? `${offering.currentCode} (${offering.section})`
          : offering.currentCode;
        const courseMeta = [sectionInfo, offering.instructor]
          .filter((value): value is string => Boolean(value))
          .join(" · ");

        return (
          <article
            key={`${offering.term}-${offering.currentCode}-${offering.nameKo}-${offering.section ?? "none"}`}
            className="roadmap-offering-row rounded-lg border border-slate-200 bg-white p-3"
          >
            <div className="space-y-1 text-[length:var(--ui-text-micro-size)]">
              <div className="flex min-w-0 items-baseline justify-between gap-3">
                <p className="min-w-0 flex-1 break-words font-semibold text-slate-800">
                  <span className="hidden md:inline">{courseMeta}</span>
                  <span className="md:hidden">{[offering.section ? lang === "ko" ? `${offering.section}분반` : `Section ${offering.section}` : offering.currentCode, offering.instructor].filter(Boolean).join(" · ")}</span>
                </p>
                {enrollment ? (
                  <p className="shrink-0 whitespace-nowrap font-semibold tabular-nums text-slate-700">
                    {enrollment}
                  </p>
                ) : null}
              </div>
              {offering.time ? (
                <p className="flex items-start gap-1.5 break-keep leading-4 text-slate-600">
                  <Clock3 aria-hidden="true" className="relative top-0.5 size-3 shrink-0 text-slate-400" />
                  <span className="whitespace-pre-line">{offering.time}</span>
                </p>
              ) : null}
              {offering.room ? (
                <p className="flex items-start gap-1.5 break-keep leading-4 text-slate-600">
                  <MapPin aria-hidden="true" className="relative top-0.5 size-3 shrink-0 text-slate-400" />
                  <span className="whitespace-pre-line">{offering.room}</span>
                </p>
              ) : null}
            </div>
          </article>
        );
      })}
    </div>
  );
}

function RelationList({
  codes,
  courseByCode,
  displayCodeByCourse,
  lang,
  onCourseClick,
  title,
  tone,
}: {
  codes: string[];
  courseByCode: ReadonlyMap<string, RoadmapCourse>;
  displayCodeByCourse: ReadonlyMap<string, string>;
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
          const item = courseByCode.get(code);
          return item ? (
            <button
              key={code}
              type="button"
              onClick={() => onCourseClick(code)}
              className="flex min-h-11 w-full items-center gap-2 rounded-md px-2 text-left transition-colors hover:bg-slate-100"
            >
              <span className={cn("h-5 w-0.5 rounded-full", tone === "previous" ? "bg-amber-500" : "bg-sky-500")} />
              <span className="w-12 shrink-0 text-xs font-semibold text-slate-500">
                {displayCodeByCourse.get(code) ?? code}
              </span>
              <span className="min-w-0 flex-1 break-words text-xs font-medium text-slate-800">{item.name[lang]}</span>
            </button>
          ) : null;
        })}
      </div>
    </div>
  );
}
