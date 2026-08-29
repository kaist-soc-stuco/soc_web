import { ApiClientHttpError, createApiClient } from "@soc/api-client";
import type {
  AdminRoadmapOfferingListResponse,
  CreateRoadmapCourseRequest,
  CreateRoadmapOfferingRequest,
  RoadmapCourseCategory,
  RoadmapCourseRecord,
  RoadmapImportCommitRequest,
  RoadmapImportPreviewResponse,
  RoadmapOfferingRecord,
  UpdateRoadmapCourseRequest,
} from "@soc/contracts";
import { FileSpreadsheet, Plus, Save, Trash2, Upload } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { AuthGuard } from "@/components/guards/auth-guard";
import {
  AdminDataTable,
  AdminTableBody,
  AdminTableCell,
  AdminTableEmpty,
  AdminTableHead,
  AdminTableHeader,
} from "@/components/ui/admin-data-table";
import { AdminSelectDropdown } from "@/components/ui/admin-select";
import {
  AdminCard,
  AdminCardHeader,
  AdminFormField,
  AdminMetaText,
  AdminPageHeader,
  AdminPageMain,
  AdminPageShell,
  AdminSearchField,
  AdminTableCard,
  AdminToolbar,
  AdminToolbarGroup,
} from "@/components/ui/admin-page";
import { Button } from "@/components/ui/button";
import { UiInput, UiTextarea } from "@/components/ui/form-control";
import { IconButton } from "@/components/ui/icon-button";
import { Modal } from "@/components/ui/modal";
import { PageSizeSelect, Pagination } from "@/components/ui/pagination";
import { useToast } from "@/components/ui/toast";
import { resolveApiBaseUrl } from "@/lib/api-base-url";
import { Permissions } from "@/lib/permissions";
import { cn } from "@/lib/utils";

const EXCEL_ACCEPT =
  ".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel";
const PAGE_SIZE = 20;
const TRACKS = [
  ["data", "데이터 과학"],
  ["systems", "시스템·네트워크"],
  ["theory", "전산이론"],
  ["software", "소프트웨어 디자인"],
  ["secure", "시큐어 컴퓨팅"],
  ["visual", "비주얼 컴퓨팅"],
  ["ai", "인공지능·정보서비스"],
  ["social", "소셜 컴퓨팅"],
  ["interactive", "인터랙티브 컴퓨팅"],
] as const;
const CATEGORY_OPTIONS: Array<{ value: RoadmapCourseCategory; label: string }> = [
  { value: "basic-required", label: "기초필수" },
  { value: "basic-elective", label: "기초선택" },
  { value: "major-required", label: "전공필수" },
  { value: "major-elective", label: "전공선택" },
];

type ActiveTab = "courses" | "offerings";
type EditorTab = "master" | "offerings";
type ImportDecision = RoadmapImportCommitRequest["decisions"][string];

const emptyCourseForm = (): CourseForm => ({
  courseCode: "",
  legacyCourseCode: "",
  nameKo: "",
  nameEn: "",
  category: "major-elective",
  credits: "",
  semesters: "S/F",
  trackIds: [],
  ai: false,
  positionX: 0,
  positionY: 0,
  isVisible: true,
  prerequisiteCourseCodes: "",
});

interface CourseForm {
  courseCode: string;
  legacyCourseCode: string;
  nameKo: string;
  nameEn: string;
  category: RoadmapCourseCategory;
  credits: string;
  semesters: string;
  trackIds: string[];
  ai: boolean;
  positionX: number;
  positionY: number;
  isVisible: boolean;
  prerequisiteCourseCodes: string;
}

interface OfferingForm {
  term: string;
  courseCode: string;
  currentCode: string;
  nameKo: string;
  section: string;
  instructor: string;
  credits: string;
  time: string;
  room: string;
  capacity: string;
  enrolled: string;
  delivery: string;
  inEnglish: boolean;
}

export function RoadmapManagementPage() {
  return (
    <AuthGuard requirePermission={Permissions.MANAGE_SITE_CONTENT}>
      <RoadmapManagementPageContent />
    </AuthGuard>
  );
}

function RoadmapManagementPageContent() {
  const apiClient = useMemo(() => createApiClient({ baseUrl: resolveApiBaseUrl() }), []);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [data, setData] = useState<AdminRoadmapOfferingListResponse>({
    courses: [],
    items: [],
    relations: [],
    terms: [],
  });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<ActiveTab>("courses");
  const [search, setSearch] = useState("");
  const [selectedTerm, setSelectedTerm] = useState("2026-fall");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);
  const [editorCourse, setEditorCourse] = useState<RoadmapCourseRecord | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorIsNew, setEditorIsNew] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importPreview, setImportPreview] = useState<RoadmapImportPreviewResponse | null>(null);
  const [importing, setImporting] = useState(false);

  const loadRoadmap = useCallback(async () => {
    try {
      const response = await apiClient.getAdminRoadmapOfferings();
      setData(response);
      setSelectedTerm((current) =>
        response.terms.some((term) => term.term === current)
          ? current
          : response.terms[0]?.term ?? current,
      );
    } catch {
      toast({ type: "error", message: "로드맵 정보를 불러오지 못했습니다." });
    } finally {
      setLoading(false);
    }
  }, [apiClient, toast]);

  useEffect(() => {
    void loadRoadmap();
  }, [loadRoadmap]);

  useEffect(() => {
    setPage(1);
  }, [activeTab, search, selectedTerm, pageSize]);

  const courseByCode = useMemo(
    () => new Map(data.courses.map((course) => [course.courseCode, course])),
    [data.courses],
  );
  const filteredCourses = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return data.courses.filter((course) => {
      if (!query) return true;
      return [
        course.courseCode,
        course.legacyCourseCode ?? "",
        course.nameKo,
        course.nameEn,
        course.category,
        course.trackIds.join(" "),
      ].join(" ").toLocaleLowerCase().includes(query);
    });
  }, [data.courses, search]);
  const filteredOfferings = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return data.items.filter((offering) => {
      if (offering.term !== selectedTerm) return false;
      if (!query) return true;
      return [
        offering.courseCode,
        offering.currentCode,
        offering.nameKo,
        offering.section ?? "",
        offering.instructor ?? "",
        offering.room ?? "",
      ].join(" ").toLocaleLowerCase().includes(query);
    });
  }, [data.items, search, selectedTerm]);
  const rows = activeTab === "courses" ? filteredCourses : filteredOfferings;
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const visibleRows = rows.slice((safePage - 1) * pageSize, safePage * pageSize);
  const rangeStart = visibleRows.length > 0 ? (safePage - 1) * pageSize + 1 : 0;
  const rangeEnd = visibleRows.length > 0 ? rangeStart + visibleRows.length - 1 : 0;
  const termOptions = data.terms.map((term) => ({ value: term.term, label: formatTerm(term.term) }));

  const openNewCourse = () => {
    setEditorCourse(null);
    setEditorIsNew(true);
    setEditorOpen(true);
  };

  const openCourse = (course: RoadmapCourseRecord, asNew = false) => {
    setEditorCourse(course);
    setEditorIsNew(asNew);
    setEditorOpen(true);
  };

  const handleImportFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;
    try {
      const preview = await apiClient.previewRoadmapImport(file);
      setImportFile(file);
      setImportPreview(preview);
    } catch (error) {
      const code = error instanceof ApiClientHttpError ? error.code : undefined;
      toast({
        type: "error",
        message:
          code === "roadmap_import_no_eligible_rows"
            ? "가져올 수 있는 전산학부 학사과정 과목이 없습니다."
            : "엑셀을 분석하지 못했습니다. 파일 형식과 내용을 확인해 주세요.",
      });
    }
  };

  const handleImport = async (decisions: RoadmapImportCommitRequest["decisions"]) => {
    if (!importFile) return;
    setImporting(true);
    try {
      const result = await apiClient.importRoadmapOfferings(importFile, decisions);
      setImportPreview(null);
      setImportFile(null);
      await loadRoadmap();
      await queryClient.invalidateQueries({ queryKey: ["roadmap", "offerings"] });
      toast({
        type: "success",
        message: `${result.importedCount}개 개설 정보를 Import했습니다.${result.skippedCount > 0 ? ` ${result.skippedCount}개 행은 제외되었습니다.` : ""}`,
      });
    } catch {
      toast({ type: "error", message: "엑셀 Import에 실패했습니다." });
    } finally {
      setImporting(false);
    }
  };

  return (
    <AdminPageShell>
      <AdminPageMain>
        <AdminPageHeader
          title="로드맵 관리"
          actions={
            <>
              <input ref={inputRef} type="file" accept={EXCEL_ACCEPT} className="sr-only" onChange={(event) => void handleImportFile(event)} />
              <Button type="button" variant="outline" onClick={() => inputRef.current?.click()}>
                <Upload aria-hidden="true" /> 엑셀 Import
              </Button>
            </>
          }
        />

        <AdminCard>
          <AdminCardHeader className="items-start">
            <div className="flex min-w-0 items-start gap-3">
              <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
                <FileSpreadsheet aria-hidden="true" className="size-4" />
              </span>
              <div className="min-w-0">
                <h2 className="text-sm font-semibold text-slate-900">개설 과목 Import</h2>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  모든 시트를 읽어 전산학부·학사과정 과목만 반영하고, 졸업연구·개별연구·논문연구 등 연구 과목은 제외합니다.
                </p>
              </div>
            </div>
            <div className="flex shrink-0 gap-5 text-right">
              <div><AdminMetaText>전체 교과목</AdminMetaText><p className="mt-1 font-semibold tabular-nums">{data.courses.length}</p></div>
              <div><AdminMetaText>개설 학기</AdminMetaText><p className="mt-1 font-semibold tabular-nums">{data.terms.length}</p></div>
              <div><AdminMetaText>개설 분반</AdminMetaText><p className="mt-1 font-semibold tabular-nums">{data.items.length}</p></div>
            </div>
          </AdminCardHeader>
        </AdminCard>

        <AdminTableCard
          toolbar={
            <AdminToolbar className="rounded-none border-0">
              <AdminToolbarGroup className="w-full sm:w-auto">
                <div className="flex rounded-lg bg-slate-100 p-1" role="tablist" aria-label="로드맵 관리 탭">
                  <button type="button" role="tab" aria-selected={activeTab === "courses"} onClick={() => setActiveTab("courses")} className={cn("rounded-md px-3 py-2 text-sm font-medium", activeTab === "courses" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-900")}>전체 교과목</button>
                  <button type="button" role="tab" aria-selected={activeTab === "offerings"} onClick={() => setActiveTab("offerings")} className={cn("rounded-md px-3 py-2 text-sm font-medium", activeTab === "offerings" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-900")}>학기별 개설 관리</button>
                </div>
                <AdminSearchField className="w-full sm:w-72" value={search} onValueChange={setSearch} placeholder="과목코드·과목명·교수 검색" aria-label="로드맵 검색" />
                {activeTab === "offerings" ? <AdminSelectDropdown ariaLabel="개설 학기" value={selectedTerm} options={termOptions} onChange={setSelectedTerm} className="w-36" /> : null}
              </AdminToolbarGroup>
              <AdminToolbarGroup>
                {activeTab === "courses" ? <Button type="button" size="sm" onClick={openNewCourse}><Plus aria-hidden="true" /> 과목 추가</Button> : null}
              </AdminToolbarGroup>
            </AdminToolbar>
          }
          pagination={
            <Pagination
              className="m-0 w-full"
              currentPage={safePage}
              onPageChange={setPage}
              pageSizeControl={<PageSizeSelect value={pageSize} onChange={setPageSize} />}
              range={<span className="text-sm font-normal text-[#344054]">총 {rows.length}건 중 {rangeStart}-{rangeEnd}</span>}
              totalPages={totalPages}
            />
          }
        >
          {activeTab === "courses" ? (
            <CourseTable courses={visibleRows as RoadmapCourseRecord[]} loading={loading} onOpen={openCourse} />
          ) : (
            <OfferingTable offerings={visibleRows as RoadmapOfferingRecord[]} loading={loading} onOpen={(offering) => { const existingCourse = courseByCode.get(offering.courseCode); openCourse(existingCourse ?? makeCourseFromOffering(offering), !existingCourse); }} />
          )}
        </AdminTableCard>
      </AdminPageMain>

      <CourseEditorModal
        apiClient={apiClient}
        course={editorCourse}
        data={data}
        isNew={editorIsNew}
        onClose={() => setEditorOpen(false)}
        onSaved={async () => { setEditorOpen(false); await loadRoadmap(); await queryClient.invalidateQueries({ queryKey: ["roadmap", "offerings"] }); }}
        open={editorOpen}
        selectedTerm={selectedTerm}
        toast={toast}
      />
      <ImportPreviewModal
        importing={importing}
        onClose={() => { if (!importing) { setImportPreview(null); setImportFile(null); } }}
        onCommit={(decisions) => void handleImport(decisions)}
        preview={importPreview}
      />
    </AdminPageShell>
  );
}

function CourseTable({ courses, loading, onOpen }: { courses: RoadmapCourseRecord[]; loading: boolean; onOpen: (course: RoadmapCourseRecord) => void }) {
  return (
    <AdminDataTable minWidth="68rem">
      <colgroup><col style={{ width: 130 }} /><col style={{ width: 230 }} /><col style={{ width: 150 }} /><col style={{ width: 100 }} /><col style={{ width: 190 }} /><col style={{ width: 190 }} /><col style={{ width: 100 }} /></colgroup>
      <AdminTableHeader><tr><AdminTableHead>과목코드</AdminTableHead><AdminTableHead>과목명</AdminTableHead><AdminTableHead>교육 분야</AdminTableHead><AdminTableHead>학점</AdminTableHead><AdminTableHead>선수 과목</AdminTableHead><AdminTableHead>후수 과목</AdminTableHead><AdminTableHead>위치</AdminTableHead></tr></AdminTableHeader>
      <AdminTableBody>
        {loading && courses.length === 0 ? <AdminTableEmpty colSpan={7}>불러오는 중...</AdminTableEmpty> : courses.length === 0 ? <AdminTableEmpty colSpan={7}>등록된 전체 교과목이 없습니다.</AdminTableEmpty> : courses.map((course) => (
          <tr key={course.courseId} tabIndex={0} role="button" onClick={() => onOpen(course)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onOpen(course); } }} className="cursor-pointer border-b border-slate-100 transition-colors hover:bg-slate-50/70 focus:bg-slate-50/70 focus:outline-none">
            <AdminTableCell className="font-semibold tabular-nums text-slate-900">{course.courseCode}{course.legacyCourseCode ? <span className="mt-1 block text-xs font-normal text-slate-400">구 {course.legacyCourseCode}</span> : null}</AdminTableCell>
            <AdminTableCell truncate><span className="font-medium text-slate-900">{course.nameKo}</span>{course.nameEn ? <span className="mt-1 block truncate text-xs text-slate-400">{course.nameEn}</span> : null}</AdminTableCell>
            <AdminTableCell truncate>{course.trackIds.length > 0 ? course.trackIds.map((id) => TRACKS.find(([trackId]) => trackId === id)?.[1] ?? id).join(", ") : "—"}</AdminTableCell>
            <AdminTableCell className="tabular-nums">{course.credits || "—"}</AdminTableCell>
            <AdminTableCell truncate>{course.prerequisiteCourseCodes.join(", ") || "—"}</AdminTableCell>
            <AdminTableCell truncate>{course.postrequisiteCourseCodes.join(", ") || "—"}</AdminTableCell>
            <AdminTableCell className="tabular-nums text-xs text-slate-500">{course.positionX}, {course.positionY}</AdminTableCell>
          </tr>
        ))}
      </AdminTableBody>
    </AdminDataTable>
  );
}

function OfferingTable({ offerings, loading, onOpen }: { offerings: RoadmapOfferingRecord[]; loading: boolean; onOpen: (offering: RoadmapOfferingRecord) => void }) {
  return (
    <AdminDataTable minWidth="76rem">
      <colgroup><col style={{ width: 130 }} /><col style={{ width: 240 }} /><col style={{ width: 80 }} /><col style={{ width: 150 }} /><col style={{ width: 190 }} /><col style={{ width: 190 }} /><col style={{ width: 110 }} /><col style={{ width: 100 }} /></colgroup>
      <AdminTableHeader><tr><AdminTableHead>과목코드</AdminTableHead><AdminTableHead>과목명</AdminTableHead><AdminTableHead>분반</AdminTableHead><AdminTableHead>담당교수</AdminTableHead><AdminTableHead>강의시간</AdminTableHead><AdminTableHead>강의실</AdminTableHead><AdminTableHead>수강 / 정원</AdminTableHead><AdminTableHead>강의 방식</AdminTableHead></tr></AdminTableHeader>
      <AdminTableBody>
        {loading && offerings.length === 0 ? <AdminTableEmpty colSpan={8}>불러오는 중...</AdminTableEmpty> : offerings.length === 0 ? <AdminTableEmpty colSpan={8}>선택한 학기의 개설 정보가 없습니다.</AdminTableEmpty> : offerings.map((offering) => (
          <tr key={offering.offeringId} tabIndex={0} role="button" onClick={() => onOpen(offering)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onOpen(offering); } }} className="cursor-pointer border-b border-slate-100 transition-colors hover:bg-slate-50/70 focus:bg-slate-50/70 focus:outline-none">
            <AdminTableCell className="font-semibold tabular-nums text-slate-900">{offering.courseCode}<span className="mt-1 block text-xs font-normal text-slate-400">{offering.currentCode}</span></AdminTableCell>
            <AdminTableCell truncate className="font-medium text-slate-900">{offering.nameKo}</AdminTableCell>
            <AdminTableCell>{offering.section || "—"}</AdminTableCell>
            <AdminTableCell truncate>{offering.instructor || "—"}</AdminTableCell>
            <AdminTableCell truncate className="whitespace-pre-line text-xs">{offering.time || "—"}</AdminTableCell>
            <AdminTableCell truncate className="whitespace-pre-line text-xs">{offering.room || "—"}</AdminTableCell>
            <AdminTableCell className="tabular-nums">{offering.enrolled ?? "—"} / {offering.capacity ?? "—"}</AdminTableCell>
            <AdminTableCell truncate>{offering.delivery || "—"}</AdminTableCell>
          </tr>
        ))}
      </AdminTableBody>
    </AdminDataTable>
  );
}

function CourseEditorModal({ apiClient, course, data, isNew, onClose, onSaved, open, selectedTerm, toast }: { apiClient: ReturnType<typeof createApiClient>; course: RoadmapCourseRecord | null; data: AdminRoadmapOfferingListResponse; isNew: boolean; onClose: () => void; onSaved: () => Promise<void>; open: boolean; selectedTerm: string; toast: (options: { type?: "success" | "error" | "warning" | "info"; message: string }) => string }) {
  const [tab, setTab] = useState<EditorTab>("master");
  const [form, setForm] = useState<CourseForm>(emptyCourseForm());
  const [saving, setSaving] = useState(false);
  const [offeringDraft, setOfferingDraft] = useState<OfferingForm | null>(null);
  const [selectedOfferingId, setSelectedOfferingId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setTab("master");
    setForm(course ? courseToForm(course) : emptyCourseForm());
    setOfferingDraft(null);
    setSelectedOfferingId(null);
  }, [course, open]);

  const offerings = useMemo(() => data.items.filter((offering) => offering.courseCode === course?.courseCode), [course?.courseCode, data.items]);

  const saveCourse = async () => {
    if (!form.courseCode.trim() || !form.nameKo.trim()) {
      toast({ type: "error", message: "과목코드와 과목명을 입력해 주세요." });
      return;
    }
    setSaving(true);
    const base = {
      courseCode: form.courseCode.trim(),
      legacyCourseCode: form.legacyCourseCode.trim() || null,
      nameKo: form.nameKo.trim(),
      nameEn: form.nameEn.trim(),
      category: form.category,
      credits: form.credits.trim(),
      semesters: form.semesters.trim(),
      trackIds: form.trackIds,
      ai: form.ai,
      positionX: Number(form.positionX) || 0,
      positionY: Number(form.positionY) || 0,
      isVisible: form.isVisible,
      prerequisiteCourseCodes: splitCodes(form.prerequisiteCourseCodes),
    } satisfies CreateRoadmapCourseRequest;
    try {
      if (isNew) await apiClient.createRoadmapCourse(base);
      else if (course) await apiClient.updateRoadmapCourse(course.courseCode, base satisfies UpdateRoadmapCourseRequest);
      toast({ type: "success", message: "과목 정보를 저장했습니다." });
      await onSaved();
    } catch {
      toast({ type: "error", message: "과목 정보를 저장하지 못했습니다." });
    } finally {
      setSaving(false);
    }
  };

  const saveOffering = async () => {
    if (!offeringDraft || !offeringDraft.term || !offeringDraft.currentCode || !offeringDraft.nameKo) {
      toast({ type: "error", message: "학기·현재 코드·과목명을 입력해 주세요." });
      return;
    }
    setSaving(true);
    try {
      const payload = offeringToRequest(offeringDraft);
      if (selectedOfferingId) await apiClient.updateRoadmapOffering(selectedOfferingId, payload);
      else await apiClient.createRoadmapOffering(payload);
      toast({ type: "success", message: "개설 정보를 저장했습니다." });
      setOfferingDraft(null);
      setSelectedOfferingId(null);
      await onSaved();
    } catch {
      toast({ type: "error", message: "개설 정보를 저장하지 못했습니다." });
    } finally {
      setSaving(false);
    }
  };

  const removeOffering = async () => {
    if (!selectedOfferingId) return;
    setSaving(true);
    try {
      await apiClient.deleteRoadmapOffering(selectedOfferingId);
      toast({ type: "success", message: "개설 정보를 삭제했습니다." });
      setOfferingDraft(null);
      setSelectedOfferingId(null);
      await onSaved();
    } catch {
      toast({ type: "error", message: "개설 정보를 삭제하지 못했습니다." });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={isNew ? "새 과목 등록" : `${course?.courseCode ?? "과목"} 통합 편집`} className="max-w-4xl" bodyClassName="space-y-5" footer={tab === "master" ? <><Button type="button" variant="outline" onClick={onClose}>취소</Button><Button type="button" disabled={saving} onClick={() => void saveCourse()}><Save aria-hidden="true" />{saving ? "저장 중..." : "저장하기"}</Button></> : null}>
      <div className="flex gap-1 rounded-lg bg-slate-100 p-1" role="tablist" aria-label="과목 편집 탭">
        <button type="button" role="tab" aria-selected={tab === "master"} onClick={() => setTab("master")} className={cn("flex-1 rounded-md px-3 py-2 text-sm font-medium", tab === "master" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500")}>기본 정보 (마스터)</button>
        <button type="button" role="tab" aria-selected={tab === "offerings"} onClick={() => setTab("offerings")} className={cn("flex-1 rounded-md px-3 py-2 text-sm font-medium", tab === "offerings" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500")}>학기별 개설 ({offerings.length})</button>
      </div>
      {tab === "master" ? <MasterCourseForm form={form} onChange={setForm} courseCodeEditable={isNew} /> : <OfferingEditor defaultTerm={selectedTerm} draft={offeringDraft} onDraftChange={setOfferingDraft} onNew={() => { setSelectedOfferingId(null); setOfferingDraft(blankOffering(course?.courseCode ?? form.courseCode, selectedTerm)); }} offerings={offerings} onSelect={(offering) => { setSelectedOfferingId(offering.offeringId); setOfferingDraft(offeringToForm(offering)); }} onSave={() => void saveOffering()} onDelete={() => void removeOffering()} saving={saving} />}
    </Modal>
  );
}

function MasterCourseForm({ form, onChange, courseCodeEditable }: { form: CourseForm; onChange: (next: CourseForm) => void; courseCodeEditable: boolean }) {
  const set = <K extends keyof CourseForm>(key: K, value: CourseForm[K]) => onChange({ ...form, [key]: value });
  return (
      <div className="grid gap-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <AdminFormField label="과목코드 *"><UiInput value={form.courseCode} onChange={(event) => set("courseCode", event.currentTarget.value)} disabled={!courseCodeEditable} placeholder="예: CS20300" /></AdminFormField>
        <AdminFormField label="구 코드"><UiInput value={form.legacyCourseCode} onChange={(event) => set("legacyCourseCode", event.currentTarget.value)} placeholder="예: CS230" /></AdminFormField>
        <AdminFormField label="국문 과목명 *"><UiInput value={form.nameKo} onChange={(event) => set("nameKo", event.currentTarget.value)} /></AdminFormField>
        <AdminFormField label="영문 과목명"><UiInput value={form.nameEn} onChange={(event) => set("nameEn", event.currentTarget.value)} /></AdminFormField>
        <AdminFormField label="교육 분야"><AdminSelectDropdown value={form.category} options={CATEGORY_OPTIONS} onChange={(value) => set("category", value as RoadmapCourseCategory)} ariaLabel="교육 분야" /></AdminFormField>
        <AdminFormField label="강·실·학"><UiInput value={form.credits} onChange={(event) => set("credits", event.currentTarget.value)} placeholder="3:0:3(0)" /></AdminFormField>
        <AdminFormField label="개설 학기"><UiInput value={form.semesters} onChange={(event) => set("semesters", event.currentTarget.value)} placeholder="S/F" /></AdminFormField>
        <div className="grid grid-cols-2 gap-3"><AdminFormField label="React Flow X"><UiInput type="number" value={form.positionX} onChange={(event) => set("positionX", Number(event.currentTarget.value))} /></AdminFormField><AdminFormField label="React Flow Y"><UiInput type="number" value={form.positionY} onChange={(event) => set("positionY", Number(event.currentTarget.value))} /></AdminFormField></div>
      </div>
      <AdminFormField label="선수 과목" hint="과목코드를 쉼표로 구분해 입력하면 연결 관계가 저장됩니다."><UiInput value={form.prerequisiteCourseCodes} onChange={(event) => set("prerequisiteCourseCodes", event.currentTarget.value)} placeholder="CS10001, CS20004" /></AdminFormField>
      <div><p className="mb-2 text-xs font-normal text-[#344054]">교육 분야(트랙)</p><div className="grid gap-2 sm:grid-cols-3">{TRACKS.map(([id, label]) => <label key={id} className="inline-flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={form.trackIds.includes(id)} onChange={(event) => set("trackIds", event.currentTarget.checked ? [...form.trackIds, id] : form.trackIds.filter((current) => current !== id))} className="size-4 accent-emerald-700" />{label}</label>)}</div></div>
      <div className="flex flex-wrap gap-4"><label className="inline-flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={form.ai} onChange={(event) => set("ai", event.currentTarget.checked)} className="size-4 accent-emerald-700" />AI 중점 과목</label><label className="inline-flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={form.isVisible} onChange={(event) => set("isVisible", event.currentTarget.checked)} className="size-4 accent-emerald-700" />로드맵에 표시</label></div>
    </div>
  );
}

function OfferingEditor({ defaultTerm, draft, onDraftChange, onNew, offerings, onSelect, onSave, onDelete, saving }: { defaultTerm: string; draft: OfferingForm | null; onDraftChange: (draft: OfferingForm | null) => void; onNew: () => void; offerings: RoadmapOfferingRecord[]; onSelect: (offering: RoadmapOfferingRecord) => void; onSave: () => void; onDelete: () => void; saving: boolean }) {
  const set = <K extends keyof OfferingForm>(key: K, value: OfferingForm[K]) => { if (draft) onDraftChange({ ...draft, [key]: value }); };
  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between gap-3"><p className="text-sm font-medium text-slate-900">개설 분반 및 강의 정보</p><Button type="button" size="sm" variant="outline" onClick={onNew}><Plus aria-hidden="true" /> 분반 추가</Button></div>
      <div className="divide-y divide-slate-100 rounded-lg border border-slate-200">{offerings.length === 0 ? <p className="px-3 py-6 text-center text-sm text-slate-500">등록된 개설 정보가 없습니다.</p> : offerings.map((offering) => <button type="button" key={offering.offeringId} onClick={() => onSelect(offering)} className={cn("grid w-full grid-cols-[7rem_minmax(0,1fr)_4rem] gap-3 px-3 py-3 text-left text-sm hover:bg-slate-50", draft && offering.offeringId === (draft as OfferingForm & { offeringId?: string }).offeringId && "bg-emerald-50")}><span className="font-medium text-slate-700">{formatTerm(offering.term)}</span><span className="min-w-0 truncate text-slate-900">{offering.nameKo}<span className="ml-2 text-xs text-slate-400">{offering.currentCode}</span></span><span className="text-center text-slate-500">{offering.section || "—"}</span></button>)}</div>
      {draft ? <div className="grid gap-4 rounded-lg border border-slate-200 bg-slate-50/60 p-4"><div className="grid gap-4 sm:grid-cols-3"><AdminFormField label="학기 *"><UiInput value={draft.term} onChange={(event) => set("term", event.currentTarget.value)} placeholder="2026-fall" /></AdminFormField><AdminFormField label="신 코드 *"><UiInput value={draft.currentCode} onChange={(event) => set("currentCode", event.currentTarget.value)} /></AdminFormField><AdminFormField label="분반"><UiInput value={draft.section} onChange={(event) => set("section", event.currentTarget.value)} /></AdminFormField><AdminFormField label="과목명 *" className="sm:col-span-2"><UiInput value={draft.nameKo} onChange={(event) => set("nameKo", event.currentTarget.value)} /></AdminFormField><AdminFormField label="담당교수"><UiInput value={draft.instructor} onChange={(event) => set("instructor", event.currentTarget.value)} /></AdminFormField><AdminFormField label="강의시간"><UiTextarea className="min-h-20" value={draft.time} onChange={(event) => set("time", event.currentTarget.value)} /></AdminFormField><AdminFormField label="강의실"><UiTextarea className="min-h-20" value={draft.room} onChange={(event) => set("room", event.currentTarget.value)} /></AdminFormField><AdminFormField label="강의 방식"><UiInput value={draft.delivery} onChange={(event) => set("delivery", event.currentTarget.value)} /></AdminFormField><AdminFormField label="강·실·학"><UiInput value={draft.credits} onChange={(event) => set("credits", event.currentTarget.value)} /></AdminFormField><AdminFormField label="정원"><UiInput type="number" value={draft.capacity} onChange={(event) => set("capacity", event.currentTarget.value)} /></AdminFormField><AdminFormField label="수강인원"><UiInput type="number" value={draft.enrolled} onChange={(event) => set("enrolled", event.currentTarget.value)} /></AdminFormField></div><label className="inline-flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={draft.inEnglish} onChange={(event) => set("inEnglish", event.currentTarget.checked)} className="size-4 accent-emerald-700" />영어 강의</label><div className="flex justify-end gap-2"><Button type="button" variant="outline" disabled={saving} onClick={onDelete}><Trash2 aria-hidden="true" /> 삭제</Button><Button type="button" disabled={saving} onClick={onSave}><Save aria-hidden="true" /> 저장</Button></div></div> : <p className="text-xs text-slate-500">분반을 선택하거나 추가하면 한 곳에서 개설 정보를 편집할 수 있습니다.</p>}
    </div>
  );
}

function ImportPreviewModal({ importing, onClose, onCommit, preview }: { importing: boolean; onClose: () => void; onCommit: (decisions: RoadmapImportCommitRequest["decisions"]) => void; preview: RoadmapImportPreviewResponse | null }) {
  const [decisions, setDecisions] = useState<Record<string, ImportDecision>>({});
  useEffect(() => {
    if (!preview) return;
    setDecisions(Object.fromEntries(preview.newCourses.map((course) => [course.courseCode, { action: "ADD_TO_ROADMAP", category: "major-elective", trackIds: [] }])));
  }, [preview]);
  return (
    <Modal open={Boolean(preview)} onClose={onClose} title="엑셀 Import 검토" className="max-w-3xl" bodyClassName="space-y-5" footer={preview ? <><Button type="button" variant="outline" onClick={onClose} disabled={importing}>취소</Button><Button type="button" onClick={() => onCommit(decisions)} disabled={importing}>{importing ? "반영 중..." : "이번 학기 반영"}</Button></> : null}>
      {preview ? <><div className="grid grid-cols-3 gap-3"><Stat label="학기" value={preview.terms.map(formatTerm).join(", ")} /><Stat label="개설 정보" value={`${preview.importedCount}건`} /><Stat label="신규 과목" value={`${preview.newCourses.length}개`} /></div><p className="text-sm leading-6 text-slate-600">새 학기는 자동으로 추가되고, 신규 과목은 로드맵 표시 여부와 교육 분야를 확인한 뒤 반영합니다. 연구 과목은 자동 제외됩니다.</p>{preview.newCourses.length === 0 ? <div className="rounded-lg border border-emerald-100 bg-emerald-50 px-4 py-4 text-sm text-emerald-800">새로 추가되는 전체 교과목이 없습니다. 기존 마스터와 개설 정보만 갱신합니다.</div> : <div className="overflow-hidden rounded-lg border border-slate-200"><div className="grid grid-cols-[minmax(0,1fr)_10rem_6rem] gap-3 border-b border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-500"><span>신규 과목</span><span>교육 분야</span><span>로드맵</span></div>{preview.newCourses.map((course) => { const decision = decisions[course.courseCode]; return <div key={course.courseCode} className="grid grid-cols-[minmax(0,1fr)_10rem_6rem] items-center gap-3 border-b border-slate-100 px-3 py-3 last:border-0"><div className="min-w-0"><p className="truncate text-sm font-medium text-slate-900">{course.nameKo}</p><p className="mt-1 text-xs tabular-nums text-slate-500">{course.courseCode} · {course.currentCode} · {course.term}</p></div><AdminSelectDropdown value={decision?.category ?? "major-elective"} options={CATEGORY_OPTIONS} onChange={(value) => setDecisions((current) => ({ ...current, [course.courseCode]: { ...current[course.courseCode], category: value as RoadmapCourseCategory } }))} ariaLabel={`${course.nameKo} 교육 분야`} /><label className="inline-flex items-center justify-center gap-1.5 text-xs text-slate-600"><input type="checkbox" checked={decision?.action === "ADD_TO_ROADMAP"} onChange={(event) => setDecisions((current) => ({ ...current, [course.courseCode]: { ...current[course.courseCode], action: event.currentTarget.checked ? "ADD_TO_ROADMAP" : "SKIP" } }))} className="size-4 accent-emerald-700" />표시</label></div>; })}</div>}{preview.warnings.length > 0 ? <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-800">{preview.warnings.join(" · ")}</div> : null}</> : null}
    </Modal>
  );
}

function Stat({ label, value }: { label: string; value: string }) { return <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-3"><AdminMetaText>{label}</AdminMetaText><p className="mt-1 truncate text-sm font-semibold text-slate-900">{value}</p></div>; }

function courseToForm(course: RoadmapCourseRecord): CourseForm { return { courseCode: course.courseCode, legacyCourseCode: course.legacyCourseCode ?? "", nameKo: course.nameKo, nameEn: course.nameEn, category: course.category, credits: course.credits, semesters: course.semesters, trackIds: course.trackIds, ai: course.ai, positionX: course.positionX, positionY: course.positionY, isVisible: course.isVisible, prerequisiteCourseCodes: course.prerequisiteCourseCodes.join(", ") }; }
function splitCodes(value: string): string[] { return [...new Set(value.split(",").map((item) => item.trim()).filter(Boolean))]; }
function blankOffering(courseCode: string, term: string): OfferingForm { return { term, courseCode, currentCode: "", nameKo: "", section: "", instructor: "", credits: "", time: "", room: "", capacity: "", enrolled: "", delivery: "", inEnglish: false }; }
function offeringToForm(offering: RoadmapOfferingRecord): OfferingForm & { offeringId?: string } { return { offeringId: offering.offeringId, term: offering.term, courseCode: offering.courseCode, currentCode: offering.currentCode, nameKo: offering.nameKo, section: offering.section ?? "", instructor: offering.instructor ?? "", credits: offering.credits ?? "", time: offering.time ?? "", room: offering.room ?? "", capacity: offering.capacity === null ? "" : String(offering.capacity), enrolled: offering.enrolled === null ? "" : String(offering.enrolled), delivery: offering.delivery ?? "", inEnglish: offering.inEnglish }; }
function offeringToRequest(form: OfferingForm): CreateRoadmapOfferingRequest { return { term: form.term.trim(), courseCode: form.courseCode.trim(), currentCode: form.currentCode.trim(), nameKo: form.nameKo.trim(), section: form.section.trim() || null, instructor: form.instructor.trim() || null, credits: form.credits.trim() || null, time: form.time.trim() || null, room: form.room.trim() || null, capacity: form.capacity.trim() ? Number(form.capacity) : null, enrolled: form.enrolled.trim() ? Number(form.enrolled) : null, delivery: form.delivery.trim() || null, inEnglish: form.inEnglish }; }
function makeCourseFromOffering(offering: RoadmapOfferingRecord): RoadmapCourseRecord { return { courseId: `offering-${offering.courseCode}`, courseCode: offering.courseCode, legacyCourseCode: null, nameKo: offering.nameKo, nameEn: "", category: "major-elective", credits: offering.credits ?? "", semesters: offering.term.endsWith("-spring") ? "S" : "F", trackIds: [], ai: false, positionX: 0, positionY: 0, isVisible: true, source: "IMPORT", prerequisiteCourseCodes: [], postrequisiteCourseCodes: [], createdAt: offering.importedAt, updatedAt: offering.importedAt }; }
function formatTerm(term: string): string { const match = term.match(/^(20\d{2})-(spring|fall)$/i); return match ? `${match[1]} ${match[2].toLocaleLowerCase() === "spring" ? "봄학기" : "가을학기"}` : term; }
