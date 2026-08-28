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
import { Search, X } from "lucide-react";
import { memo, useCallback, useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
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
  dimmed: boolean;
  duplicate: boolean;
  lang: RoadmapLanguage;
  relation: "current" | "previous" | "next" | null;
  selected: boolean;
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

function buildLayout(lang: RoadmapLanguage): LayoutResult {
  const canonicalNodeByCode = new Map<string, string>();
  const instancesByCode = new Map<string, string[]>();
  const nodes: GraphNode[] = [];
  let offsetY = 0;

  ROADMAP_LANES.forEach((lane) => {
    const rowCount = Math.ceil(lane.courses.length / COURSES_PER_ROW);
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

    lane.courses.forEach((code, index) => {
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
          dimmed: false,
          duplicate: false,
          lang,
          relation: null,
          selected: false,
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
      className="h-full w-full rounded-xl border border-slate-200/80 bg-white/70"
      style={{ borderTopColor: data.color, borderTopWidth: 3 }}
    >
      <div className="flex h-full w-[9.5rem] items-start px-5 pt-5">
        <span className="text-sm font-semibold tracking-tight text-slate-700">{data.label}</span>
      </div>
    </div>
  );
});

const CourseCard = memo(function CourseCard({ data }: NodeProps<CourseNode>) {
  const { course, dimmed, duplicate, lang, relation, selected } = data;

  return (
    <div
      className={cn(
        "group relative h-full w-full rounded-lg border bg-white px-3.5 py-3 text-left shadow-[0_1px_2px_rgba(15,23,42,0.05)] transition-[opacity,border-color,box-shadow,transform] duration-150",
        selected
          ? "border-kaist-darkgreen shadow-[0_0_0_2px_rgba(0,92,74,0.13)]"
          : relation === "previous"
            ? "border-amber-500 shadow-[0_0_0_1px_rgba(245,158,11,0.15)]"
            : relation === "next"
              ? "border-sky-500 shadow-[0_0_0_1px_rgba(14,165,233,0.15)]"
              : relation === "current"
                ? "border-kaist-darkgreen"
                : "border-slate-200 hover:-translate-y-0.5 hover:border-slate-400 hover:shadow-md",
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
  const layout = useMemo(() => buildLayout(lang), [lang]);
  const [hoveredCourseCode, setHoveredCourseCode] = useState<string | null>(null);
  const [selectedTrackIds, setSelectedTrackIds] = useState<Set<string>>(() => new Set());
  const [searchText, setSearchText] = useState("");
  const [flow, setFlow] = useState<ReactFlowInstance<GraphNode, Edge> | null>(null);
  const activeCourseCode = hoveredCourseCode ?? selectedCourseCode;

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
      layout.nodes.map((node) => {
        if (node.type !== "course") return node;
        const code = node.data.course.code;
        const relation =
          code === activeCourseCode
            ? "current"
            : previousCodes.has(code)
              ? "previous"
              : nextCodes.has(code)
                ? "next"
                : null;
        const relationDimmed = Boolean(activeCourseCode && !relation);
        const trackDimmed = Boolean(
          selectedTrackIds.size > 0 &&
            !node.data.course.tracks.some((trackId) => selectedTrackIds.has(trackId)) &&
            !relation,
        );

        return {
          ...node,
          data: {
            ...node.data,
            dimmed: relationDimmed || trackDimmed,
            duplicate: (layout.instancesByCode.get(code)?.length ?? 0) > 1,
            relation,
            selected: code === selectedCourseCode,
          },
        };
      }),
    [activeCourseCode, layout, nextCodes, previousCodes, selectedCourseCode, selectedTrackIds],
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
            markerEnd: {
              type: MarkerType.ArrowClosed,
              width: 13,
              height: 13,
              color: highlighted ? "#0f766e" : "#94a3b8",
            },
            style: {
              opacity: activeCourseCode && !highlighted ? 0.08 : highlighted ? 1 : 0.34,
              stroke: highlighted ? "#0f766e" : "#94a3b8",
              strokeWidth: highlighted ? 2 : 1.25,
            },
            zIndex: highlighted ? 4 : 0,
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
      `${item.code} ${item.name.ko} ${item.name.en}`.toLocaleLowerCase().includes(query),
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
      `${item.code} ${item.name.ko} ${item.name.en}`.toLocaleLowerCase().includes(query);
    const matchesTrack =
      selectedTrackIds.size === 0 || item.tracks.some((trackId) => selectedTrackIds.has(trackId));
    return matchesQuery && matchesTrack;
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
                {searchMatches.map((item) => (
                  <button
                    key={item.code}
                    type="button"
                    onClick={() => focusCourse(item.code)}
                    className="flex min-h-12 w-full items-center gap-3 border-b border-slate-100 px-3 text-left last:border-b-0 hover:bg-slate-50"
                  >
                    <span className="w-14 shrink-0 text-xs font-semibold text-slate-500">{item.code}</span>
                    <span className="truncate text-sm font-medium text-slate-900">{item.name[lang]}</span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden text-xs font-medium text-slate-500 sm:inline">
              {lang === "ko" ? "드래그 이동 · Ctrl/⌘ + 휠 확대" : "Drag to pan · Ctrl/⌘ + wheel to zoom"}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void flow?.fitView({ duration: 240, padding: 0.05 })}
            >
              {lang === "ko" ? "전체 보기" : "Fit view"}
            </Button>
          </div>
        </div>

        <div className="h-[calc(100svh-13rem)] min-h-[38rem] max-h-[54rem] overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
          <ReactFlow<GraphNode, Edge>
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onInit={setFlow}
            onNodeClick={(_, node) => {
              if (node.type === "course") focusCourse(node.data.course.code);
            }}
            onNodeMouseEnter={(_, node) => {
              if (node.type === "course") setHoveredCourseCode(node.data.course.code);
            }}
            onNodeMouseLeave={() => setHoveredCourseCode(null)}
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
              "controls.fitView.ariaLabel": lang === "ko" ? "전체 보기" : "Fit view",
              "controls.zoomIn.ariaLabel": lang === "ko" ? "확대" : "Zoom in",
              "controls.zoomOut.ariaLabel": lang === "ko" ? "축소" : "Zoom out",
            }}
          >
            <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="#cbd5e1" />
            <Controls showInteractive={false} position="bottom-left" />
          </ReactFlow>
        </div>
      </div>

      <aside className="min-w-0 xl:sticky xl:top-24 xl:self-start">
        <section aria-labelledby="roadmap-track-filter" className="border-b border-slate-200 pb-5">
          <div className="flex items-center justify-between gap-3">
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

        <CourseDetails
          courseCode={selectedCourseCode}
          lang={lang}
          onClose={() => onSelectedCourseChange(null)}
          onCourseClick={focusCourse}
        />
      </aside>
      </div>
    </>
  );
}

interface CourseDetailsProps {
  courseCode: string | null;
  lang: RoadmapLanguage;
  onClose: () => void;
  onCourseClick: (code: string) => void;
}

function CourseDetails({ courseCode, lang, onClose, onCourseClick }: CourseDetailsProps) {
  const item = courseCode ? ROADMAP_COURSE_BY_CODE.get(courseCode) : undefined;
  const previous = item
    ? ROADMAP_RELATIONS.filter((relation) => relation.target === item.code).map(
        (relation) => relation.source,
      )
    : [];
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
    </section>
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
  return (
    <div className="mt-5">
      <h3 className="text-xs font-semibold text-slate-500">{title}</h3>
      {codes.length > 0 ? (
        <div className="mt-2 space-y-1">
          {codes.map((code) => {
            const item = ROADMAP_COURSE_BY_CODE.get(code);
            return item ? (
              <button
                key={code}
                type="button"
                onClick={() => onCourseClick(code)}
                className="flex min-h-10 w-full items-center gap-2 rounded-md px-2 text-left hover:bg-slate-50"
              >
                <span className={cn("h-5 w-0.5 rounded-full", tone === "previous" ? "bg-amber-500" : "bg-sky-500")} />
                <span className="w-12 shrink-0 text-xs font-semibold text-slate-500">{code}</span>
                <span className="truncate text-xs font-medium text-slate-800">{item.name[lang]}</span>
              </button>
            ) : null;
          })}
        </div>
      ) : (
        <p className="mt-2 text-xs text-slate-400">{lang === "ko" ? "표시된 연결 없음" : "No mapped connection"}</p>
      )}
    </div>
  );
}
