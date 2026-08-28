import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { createApiClient } from "@soc/api-client";
import type {
  BulkProcessStudentFeePaymentsRequest,
  BulkUpdateStudentFeeStatusRequest,
  FeePaymentMethod,
  FeePaymentType,
  FeeStatus,
  StudentFeeDetailResponse,
  StudentFeeListOptions,
  StudentFeeListResponse,
  StudentFeeStatsResponse,
} from "@soc/contracts";
import { isoToDate, nowIso } from "@soc/shared";
import { ChevronDown, CreditCard, Download, FileUp } from "lucide-react";

import { AuthGuard } from "@/components/guards/auth-guard";
import { AdminSelectDropdown } from "@/components/ui/admin-select";
import {
  AdminDataTable,
  AdminSortableHead,
  AdminTableBody,
  AdminTableCell,
  AdminTableHead,
  AdminTableHeader,
} from "@/components/ui/admin-data-table";
import {
  AdminFormField,
  AdminPageHeader,
  AdminPageMain,
  AdminPageShell,
  AdminTableCard,
} from "@/components/ui/admin-page";
import { AdminDrawer } from "@/components/ui/admin-drawer";
import { AdminStatusBadge } from "@/components/ui/admin-status-badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/data-state";
import { UiInput } from "@/components/ui/form-control";
import { Modal } from "@/components/ui/modal";
import { PageSearchField } from "@/components/ui/page-layout";
import { PageSizeSelect, Pagination } from "@/components/ui/pagination";
import { PopoverPanel } from "@/components/ui/popover-panel";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Skeleton } from "@/components/ui/skeleton";
import { useCurrentSession } from "@/hooks/use-current-session";
import { resolveApiBaseUrl } from "@/lib/api";
import { downloadBlob } from "@/lib/download-blob";
import { Permissions } from "@/lib/permissions";
import { FeeStatisticsPanel, type PeriodPreset } from "./fee-statistics-panel";

type FeeSortBy = "name" | "studentId" | "status" | "paidAt";
type SortDirection = "asc" | "desc";
type StatusFilter = "ALL" | "PAID" | "PARTIAL" | "UNPAID";
type StudentFeeRow = StudentFeeListResponse["students"][number];

const DEFAULT_FEE_AMOUNT = 45_000;
const DEFAULT_COVERAGE_SEMESTERS = 6;

const toDateInput = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const periodRange = (preset: Exclude<PeriodPreset, "custom">) => {
  const end = isoToDate(nowIso());
  const start = isoToDate(end.toISOString());
  if (preset === "30d") start.setDate(start.getDate() - 29);
  if (preset === "90d") start.setDate(start.getDate() - 89);
  if (preset === "year") start.setMonth(0, 1);
  return { dateFrom: toDateInput(start), dateTo: toDateInput(end) };
};

const formatCurrency = (value: number) => `${value.toLocaleString("ko-KR")}원`;

const formatDate = (value: string | null | undefined) => {
  if (!value) return "—";
  const date = isoToDate(value);
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, "0")}.${String(date.getDate()).padStart(2, "0")}`;
};

const formatDateTime = (value: string | null | undefined) => {
  if (!value) return "—";
  const date = isoToDate(value);
  return `${formatDate(value)} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
};

const FEE_MANAGEMENT_START_SEMESTER = "2026-1";

const semesterOrdinal = (value: string) => {
  const [year, term] = value.split("-").map(Number);
  return year * 2 + term - 1;
};

const currentSemester = () => {
  const date = isoToDate(nowIso());
  return `${date.getFullYear()}-${date.getMonth() < 6 ? 1 : 2}`;
};

const buildSemesterOptions = () => {
  const currentOrdinal = Math.max(
    semesterOrdinal(currentSemester()),
    semesterOrdinal(FEE_MANAGEMENT_START_SEMESTER),
  );
  const startOrdinal = semesterOrdinal(FEE_MANAGEMENT_START_SEMESTER);
  return Array.from({ length: currentOrdinal - startOrdinal + 1 }, (_, index) => {
    const ordinal = currentOrdinal - index;
    const year = Math.floor(ordinal / 2);
    const term = (ordinal % 2) + 1;
    return { value: `${year}-${term}`, label: `${year}학년도 ${term}학기` };
  });
};

export function FeeManagementPage() {
  const apiClient = useMemo(() => createApiClient({ baseUrl: resolveApiBaseUrl() }), []);
  const { data: session, isLoading: sessionLoading } = useCurrentSession();
  const [feeData, setFeeData] = useState<StudentFeeListResponse | null>(null);
  const [studentCache, setStudentCache] = useState<Record<string, StudentFeeRow>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [operationError, setOperationError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [referenceSemester, setReferenceSemester] = useState(() => {
    const current = currentSemester();
    return semesterOrdinal(current) >= semesterOrdinal(FEE_MANAGEMENT_START_SEMESTER)
      ? current
      : FEE_MANAGEMENT_START_SEMESTER;
  });
  const [majorCategory, setMajorCategory] = useState<StudentFeeListOptions["majorCategory"]>();
  const [query, setQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [sortBy, setSortBy] = useState<FeeSortBy>("name");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
  const [lastSelectedUserId, setLastSelectedUserId] = useState<string | null>(null);
  const [selectingAllFiltered, setSelectingAllFiltered] = useState(false);
  const [selectionPopoverOpen, setSelectionPopoverOpen] = useState(false);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [paymentAmounts, setPaymentAmounts] = useState<Record<string, string>>({});
  const [paymentType, setPaymentType] = useState<FeePaymentType>("SIX_SEMESTER_LUMP_SUM");
  const [paymentMethod, setPaymentMethod] = useState<FeePaymentMethod>("BANK_TRANSFER");
  const [paymentCoverage, setPaymentCoverage] = useState(String(DEFAULT_COVERAGE_SEMESTERS));
  const [paymentDate, setPaymentDate] = useState(nowIso().slice(0, 10));
  const [paymentNote, setPaymentNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [spreadsheetInfoOpen, setSpreadsheetInfoOpen] = useState(false);
  const [openFilterDropdown, setOpenFilterDropdown] = useState<"semester" | "major" | null>(null);
  const [spreadsheetInputKey, setSpreadsheetInputKey] = useState(0);
  const spreadsheetInputRef = useRef<HTMLInputElement | null>(null);
  const [detailStudentId, setDetailStudentId] = useState<string | null>(null);
  const [detail, setDetail] = useState<StudentFeeDetailResponse | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailStatus, setDetailStatus] = useState<FeeStatus>("UNPAID");
  const [detailAmount, setDetailAmount] = useState("");
  const [detailNote, setDetailNote] = useState("");
  const initialStatsRange = useMemo(() => periodRange("30d"), []);
  const [activeSection, setActiveSection] = useState<"ledger" | "stats">("ledger");
  const [statsPreset, setStatsPreset] = useState<PeriodPreset>("30d");
  const [statsDateFrom, setStatsDateFrom] = useState(initialStatsRange.dateFrom);
  const [statsDateTo, setStatsDateTo] = useState(initialStatsRange.dateTo);
  const [stats, setStats] = useState<StudentFeeStatsResponse | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);

  useEffect(() => {
    if (!selectionPopoverOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setSelectionPopoverOpen(false);
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [selectionPopoverOpen]);

  const semesterOptions = useMemo(buildSemesterOptions, []);
  const students = feeData?.students ?? [];
  const selectedStudents = useMemo(
    () => Array.from(selectedUserIds).map((id) => studentCache[id]).filter(Boolean),
    [selectedUserIds, studentCache],
  );
  const totalCount = feeData?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const rangeStart = totalCount === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const rangeEnd = Math.min(totalCount, currentPage * pageSize);
  const initialLoading = feeData === null && (loading || sessionLoading);
  const currentVisibleSelected = students.filter((student) => selectedUserIds.has(student.userId)).length;
  const allVisibleSelected = students.length > 0 && currentVisibleSelected === students.length;

  const loadData = useCallback(async () => {
    if (sessionLoading || !Permissions.has(session?.permission ?? 0, Permissions.MANAGE_FINANCE)) return;
    setLoading(true);
    try {
      const data = await apiClient.listStudentsByFeeStatus({
        status: statusFilter === "ALL" ? undefined : statusFilter,
        page: currentPage,
        pageSize,
        sortBy,
        sortDirection,
        query,
        referenceSemester,
        majorCategory,
      });
      setFeeData(data);
      setStudentCache((current) => {
        const next = { ...current };
        data.students.forEach((student) => { next[student.userId] = student; });
        return next;
      });
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "과비 데이터를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [apiClient, currentPage, majorCategory, pageSize, query, referenceSemester, session, sessionLoading, sortBy, sortDirection, statusFilter]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const loadStats = useCallback(async () => {
    if (sessionLoading || !Permissions.has(session?.permission ?? 0, Permissions.MANAGE_FINANCE)) return;
    setStatsLoading(true);
    try {
      const spanDays = Math.max(1, Math.ceil((isoToDate(`${statsDateTo}T00:00:00.000+09:00`).getTime() - isoToDate(`${statsDateFrom}T00:00:00.000+09:00`).getTime()) / 86_400_000));
      const response = await apiClient.getStudentFeeStats({
        dateFrom: statsDateFrom,
        dateTo: statsDateTo,
        bucket: spanDays <= 45 ? "day" : spanDays <= 180 ? "week" : "month",
      });
      setStats(response);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "납부 통계를 불러오지 못했습니다.");
    } finally {
      setStatsLoading(false);
    }
  }, [apiClient, session, sessionLoading, statsDateFrom, statsDateTo]);

  useEffect(() => {
    void loadStats();
  }, [loadStats]);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  const updateFilter = <T,>(setter: (value: T) => void, value: T) => {
    setter(value);
    setCurrentPage(1);
  };

  const changeStatsPreset = (preset: PeriodPreset) => {
    setStatsPreset(preset);
    if (preset === "custom") return;
    const range = periodRange(preset);
    setStatsDateFrom(range.dateFrom);
    setStatsDateTo(range.dateTo);
  };

  const handleSortChange = (nextSortBy: FeeSortBy) => {
    if (sortBy === nextSortBy) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(nextSortBy);
      setSortDirection("asc");
    }
    setCurrentPage(1);
  };

  const toggleSelectedUser = (userId: string, extendSelection = false) => {
    setSelectedUserIds((current) => {
      const next = new Set(current);
      if (extendSelection && lastSelectedUserId) {
        const start = students.findIndex((student) => student.userId === lastSelectedUserId);
        const end = students.findIndex((student) => student.userId === userId);
        if (start >= 0 && end >= 0) {
          const rangeStart = Math.min(start, end);
          const rangeEnd = Math.max(start, end);
          students.slice(rangeStart, rangeEnd + 1).forEach((student) => next.add(student.userId));
          return next;
        }
      }
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
    setLastSelectedUserId(userId);
  };

  const selectAllFiltered = async () => {
    if (selectingAllFiltered || totalCount === 0) return;
    setSelectingAllFiltered(true);
    try {
      const allStudents: StudentFeeRow[] = [];
      const batchSize = 1_000;
      const pages = Math.max(1, Math.ceil(totalCount / batchSize));
      for (let page = 1; page <= pages; page += 1) {
        const data = await apiClient.listStudentsByFeeStatus({
          status: statusFilter === "ALL" ? undefined : statusFilter,
          page,
          pageSize: batchSize,
          sortBy,
          sortDirection,
          query,
          referenceSemester,
          majorCategory,
        });
        allStudents.push(...data.students);
        if (data.students.length < batchSize) break;
      }
      setStudentCache((current) => {
        const next = { ...current };
        allStudents.forEach((student) => { next[student.userId] = student; });
        return next;
      });
      setSelectedUserIds((current) => new Set([...current, ...allStudents.map((student) => student.userId)]));
    } catch (err) {
      setOperationError(err instanceof Error ? err.message : "현재 필터의 학생을 모두 선택하지 못했습니다.");
    } finally {
      setSelectingAllFiltered(false);
    }
  };

  const toggleVisibleUsers = () => {
    setSelectedUserIds((current) => {
      const next = new Set(current);
      if (allVisibleSelected) students.forEach((student) => next.delete(student.userId));
      else students.forEach((student) => next.add(student.userId));
      return next;
    });
  };

  const openPaymentModal = () => {
    setPaymentAmounts(Object.fromEntries(selectedStudents.map((student) => [student.userId, String(DEFAULT_FEE_AMOUNT)])));
    setPaymentType("SIX_SEMESTER_LUMP_SUM");
    setPaymentMethod("BANK_TRANSFER");
    setPaymentCoverage(String(DEFAULT_COVERAGE_SEMESTERS));
    setPaymentDate(nowIso().slice(0, 10));
    setPaymentNote("");
    setOperationError(null);
    setPaymentModalOpen(true);
  };

  const submitPayments = async () => {
    if (selectedStudents.length === 0) return;
    const coverageSemesters = Number(paymentCoverage);
    if (!Number.isInteger(coverageSemesters) || coverageSemesters < 1 || coverageSemesters > 6) {
      setOperationError("적용 학기 수는 1～6 사이에서 선택해 주세요.");
      return;
    }
    const payments: BulkProcessStudentFeePaymentsRequest["payments"] = [];
    for (const student of selectedStudents) {
      const amount = Number(paymentAmounts[student.userId] ?? DEFAULT_FEE_AMOUNT);
      if (!Number.isInteger(amount) || amount < 0) {
        setOperationError(`${student.nameKo}의 수납 금액을 확인해 주세요.`);
        return;
      }
      payments.push({
        userId: student.userId,
        amount,
        paymentType,
        paymentMethod,
        effectiveStartSemester: referenceSemester,
        coverageSemesters,
        paidAt: isoToDate(`${paymentDate}T00:00:00.000+09:00`).toISOString(),
        note: paymentNote.trim() || null,
      });
    }

    try {
      setSaving(true);
      setOperationError(null);
      await apiClient.processStudentFeePayments({ payments });
      setSelectedUserIds(new Set());
      setLastSelectedUserId(null);
      setSelectionPopoverOpen(false);
      setPaymentModalOpen(false);
      setSuccessMessage(`${payments.length}명의 납부 내역을 원장에 반영했습니다.`);
      await loadData();
    } catch (err) {
      setOperationError(err instanceof Error ? err.message : "납부 처리에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  };

  const handleExport = async () => {
    try {
      setOperationError(null);
      const spreadsheet = await apiClient.downloadStudentFeeXlsx({
        status: statusFilter === "ALL" ? undefined : statusFilter,
        query,
        referenceSemester,
        majorCategory,
        sortBy,
        sortDirection,
        userIds: selectedUserIds.size > 0 ? Array.from(selectedUserIds) : undefined,
      });
      downloadBlob(spreadsheet, `student-fee-${referenceSemester}.xlsx`);
      setSuccessMessage(selectedUserIds.size > 0 ? `${selectedUserIds.size}명의 과비 정보를 내보냈습니다.` : "현재 필터의 과비 정보를 내보냈습니다.");
    } catch (err) {
      setOperationError(err instanceof Error ? err.message : "내보내기에 실패했습니다.");
    }
  };

  const handleSpreadsheetUpload = async (file: File | undefined) => {
    if (!file) return;
    try {
      setOperationError(null);
      const parsed = parseFeeSpreadsheet(await file.arrayBuffer());
      if (parsed.errors.length > 0) {
        setOperationError(parsed.errors.join(" "));
        return;
      }
      await apiClient.bulkUpdateStudentFeeStatuses({ updates: parsed.updates });
      setSuccessMessage(`${parsed.updates.length}명의 과비 상태를 불러와 반영했습니다.`);
      await loadData();
    } catch (err) {
      setOperationError(err instanceof Error ? err.message : "불러오기에 실패했습니다.");
    } finally {
      setSpreadsheetInputKey((value) => value + 1);
    }
  };

  const openDetail = async (student: StudentFeeRow) => {
    setDetailStudentId(student.userId);
    setDetail(null);
    setDetailStatus(student.status);
    setDetailAmount(String(student.paidAmount ?? 0));
    setDetailNote(student.note ?? "");
    setDetailLoading(true);
    try {
      const response = await apiClient.getStudentFeeDetail(student.userId);
      setDetail(response);
      setDetailStatus(response.status.status);
      setDetailAmount(String(response.status.paidAmount));
      setDetailNote(response.status.note ?? "");
    } catch (err) {
      setOperationError(err instanceof Error ? err.message : "납부 상세를 불러오지 못했습니다.");
    } finally {
      setDetailLoading(false);
    }
  };

  const saveDetail = async () => {
    if (!detail?.user.userId) return;
    const amount = Number(detailAmount);
    if (!Number.isInteger(amount) || amount < 0) {
      setOperationError("납부 금액은 0 이상의 정수여야 합니다.");
      return;
    }
    try {
      setSaving(true);
      await apiClient.updateStudentFeeStatus(detail.user.userId, {
        status: detailStatus,
        paidAmount: amount,
        note: detailNote.trim() || null,
      });
      setSuccessMessage(`${detail.user.nameKo}의 요약 납부 상태를 저장했습니다.`);
      await loadData();
      const refreshed = await apiClient.getStudentFeeDetail(detail.user.userId);
      setDetail(refreshed);
    } catch (err) {
      setOperationError(err instanceof Error ? err.message : "납부 상세 저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AuthGuard requirePermission={Permissions.MANAGE_FINANCE}>
      <AdminPageShell>
        <AdminPageMain className="gap-5">
          <AdminPageHeader title="과비 관리" />

          <SegmentedControl
            ariaLabel="과비 관리 보기"
            role="tablist"
            value={activeSection}
            onChange={setActiveSection}
            className="w-fit"
            options={[{ value: "ledger", label: "납부 원장" }, { value: "stats", label: "통계" }]}
          />

          {successMessage ? <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-normal text-emerald-800">{successMessage}</div> : null}
          {operationError ? <div className="rounded-lg border border-rose-200 bg-white px-4 py-3 text-sm font-normal text-rose-700">{operationError}</div> : null}
          {error ? <div className="rounded-lg border border-rose-200 bg-white px-4 py-3 text-sm font-normal text-rose-700">{error}</div> : null}

          {activeSection === "stats" ? (
            <FeeStatisticsPanel
              dateFrom={statsDateFrom}
              dateTo={statsDateTo}
              loading={statsLoading}
              onDateFromChange={(value) => { setStatsPreset("custom"); setStatsDateFrom(value); }}
              onDateToChange={(value) => { setStatsPreset("custom"); setStatsDateTo(value); }}
              onPresetChange={changeStatsPreset}
              preset={statsPreset}
              stats={stats}
            />
          ) : <AdminTableCard className="overflow-visible">
            <div className="flex flex-col gap-3 border-b border-slate-100 px-4 py-3 xl:flex-row xl:items-center xl:justify-between">
              <SegmentedControl
                ariaLabel="납부 상태"
                value={statusFilter}
                onChange={setStatusFilter}
                className="w-fit"
                options={[
                  { value: "ALL", label: "전체" },
                  { value: "PAID", label: "완납" },
                  { value: "PARTIAL", label: "부분 납부" },
                  { value: "UNPAID", label: "미납" },
                ]}
              />
              <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
                <AdminSelectDropdown ariaLabel="기준 학기" value={referenceSemester} options={semesterOptions} onChange={(value) => updateFilter(setReferenceSemester, value)} className="w-56 shrink-0" open={openFilterDropdown === "semester"} onOpenChange={(open) => setOpenFilterDropdown(open ? "semester" : null)} />
                <AdminSelectDropdown
                  ariaLabel="전공 구분"
                  value={majorCategory ?? "ALL"}
                  options={[{ value: "ALL", label: "전공 전체" }, { value: "PRIMARY", label: "주전공 보유" }]}
                  onChange={(value) => updateFilter(setMajorCategory, value === "ALL" ? undefined : value as StudentFeeListOptions["majorCategory"])}
                  className="w-32 shrink-0"
                  open={openFilterDropdown === "major"}
                  onOpenChange={(open) => setOpenFilterDropdown(open ? "major" : null)}
                />
                <PageSearchField ariaLabel="학생 검색" className="w-full min-w-[220px] sm:w-64" onChange={(value) => updateFilter(setQuery, value)} onClear={() => updateFilter(setQuery, "")} placeholder="이름·학번·전공·이메일 검색" value={query} />
                <Button type="button" variant="outline" onClick={() => void handleExport()}><Download aria-hidden="true" className="size-4" /> 내보내기{selectedUserIds.size > 0 ? ` (${selectedUserIds.size})` : ""}</Button>
                <Button type="button" variant="outline" onClick={() => setSpreadsheetInfoOpen(true)}><FileUp aria-hidden="true" className="size-4" /> 불러오기</Button>
              </div>
            </div>

            <div className="min-w-0">
              <div className={loading && !initialLoading ? "opacity-60 transition-opacity duration-150" : "transition-opacity duration-150"}>
                {initialLoading ? null : students.length === 0 ? <EmptyState message="등록된 학생이 없습니다." className="border-0 py-20" /> : (
                  <AdminDataTable minWidth={980}>
                    <colgroup><col className="w-12" /><col className="w-44" /><col className="w-28" /><col className="w-56" /><col /><col className="w-24" /><col className="w-32" /></colgroup>
                    <AdminTableHeader>
                      <tr className="h-12">
                        <AdminTableHead className="h-12 w-12 px-4 py-0 align-middle">
                          <input type="checkbox" aria-label="현재 페이지 전체 선택" checked={allVisibleSelected} onChange={toggleVisibleUsers} className="block size-4 accent-emerald-700" />
                        </AdminTableHead>
                        {selectedUserIds.size > 0 ? (
                          <AdminTableHead colSpan={6} className="h-[var(--ui-table-head-height)] min-h-[var(--ui-table-head-height)] px-4 py-0 align-middle">
                            <div className="flex h-full items-center justify-between gap-3">
                              <div className="relative">
                          <Button type="button" variant="ghost" size="sm" className="h-8 !font-medium" onClick={() => setSelectionPopoverOpen((value) => !value)}>{selectedUserIds.size}명 선택됨 <ChevronDown aria-hidden="true" className="size-4" /></Button>
                          {selectionPopoverOpen ? <><button type="button" aria-label="선택 목록 닫기" className="fixed inset-0 z-40 cursor-default" onClick={() => setSelectionPopoverOpen(false)} /><PopoverPanel className="left-0 top-full z-50 mt-2 w-80 p-3"><Button type="button" variant="ghost" size="sm" className="mb-2 w-full justify-start !font-medium" onClick={() => void selectAllFiltered()} disabled={selectingAllFiltered}>{selectingAllFiltered ? "현재 필터를 불러오는 중" : `현재 필터 전체 선택 (${totalCount.toLocaleString("ko-KR")})`}</Button><p className="mb-2 text-xs font-medium text-slate-500">선택한 학생</p><div className="scrollbar-hidden flex max-h-52 flex-wrap gap-1.5 overflow-y-auto">{selectedStudents.map((student) => <button key={student.userId} type="button" className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1 text-xs font-normal text-slate-700 hover:bg-slate-200" onClick={() => toggleSelectedUser(student.userId)}>{student.nameKo} <span aria-hidden="true">×</span></button>)}</div></PopoverPanel></> : null}
                              </div>
                              <Button type="button" size="sm" className="h-8" onClick={openPaymentModal} disabled={saving}><CreditCard aria-hidden="true" className="size-4" /> 일괄 납부 처리</Button>
                            </div>
                          </AdminTableHead>
                        ) : (
                          <>
                            <AdminSortableHead active={sortBy === "name"} ascending={sortDirection === "asc"} onClick={() => handleSortChange("name")}>이름(영문명)</AdminSortableHead><AdminSortableHead active={sortBy === "studentId"} ascending={sortDirection === "asc"} onClick={() => handleSortChange("studentId")}>학번</AdminSortableHead><AdminTableHead>이메일</AdminTableHead><AdminTableHead>전공</AdminTableHead><AdminSortableHead active={sortBy === "status"} ascending={sortDirection === "asc"} onClick={() => handleSortChange("status")}>상태</AdminSortableHead><AdminSortableHead className="text-right" active={sortBy === "paidAt"} ascending={sortDirection === "asc"} onClick={() => handleSortChange("paidAt")}>수납액</AdminSortableHead>
                          </>
                        )}
                      </tr>
                    </AdminTableHeader>
                    <AdminTableBody>{students.map((student) => <tr key={student.userId} className="cursor-pointer border-b border-slate-100 last:border-b-0 hover:bg-slate-50/70" onClick={() => void openDetail(student)}>
                      <AdminTableCell className="px-4 py-2.5" onClick={(event) => event.stopPropagation()}><input type="checkbox" aria-label={`${student.nameKo} 선택`} checked={selectedUserIds.has(student.userId)} onChange={(event) => toggleSelectedUser(student.userId, "shiftKey" in event.nativeEvent && Boolean(event.nativeEvent.shiftKey))} className="size-4 accent-emerald-700" /></AdminTableCell>
                      <AdminTableCell className="py-2.5"><div className="font-medium text-slate-900">{student.nameKo}</div>{student.nameEn ? <div className="mt-0.5 text-xs font-normal text-slate-500">{student.nameEn}</div> : null}</AdminTableCell>
                      <AdminTableCell className="py-2.5 tabular-nums text-slate-700">{student.stdNo || null}</AdminTableCell>
                      <AdminTableCell className="max-w-56 truncate py-2.5 text-slate-700" title={student.email}>{student.email}</AdminTableCell>
                      <AdminTableCell className="py-2.5 text-slate-700">{student.primaryMajor || null}</AdminTableCell>
                      <AdminTableCell className="py-2.5"><AdminStatusBadge tone={student.status === "PAID" ? "positive" : student.status === "PARTIAL" ? "warning" : "neutral"}>{student.status === "PAID" ? "완납" : student.status === "PARTIAL" ? "부분 납부" : "미납"}</AdminStatusBadge></AdminTableCell>
                      <AdminTableCell className="py-2.5 text-right font-medium tabular-nums text-slate-900">{formatCurrency(student.paidAmount)}</AdminTableCell>
                    </tr>)}</AdminTableBody>
                  </AdminDataTable>
                )}
              </div>
            </div>

            {!initialLoading ? <div className="border-t border-slate-100 px-4 py-3"><Pagination className="m-0 w-full" currentPage={currentPage} onPageChange={setCurrentPage} pageSizeControl={<PageSizeSelect value={pageSize} options={[20, 50, 100]} onChange={(value) => { setPageSize(value); setCurrentPage(1); }} />} range={<span>총 {totalCount.toLocaleString("ko-KR")}건 중 {rangeStart}-{rangeEnd}</span>} totalPages={totalPages} /></div> : null}
          </AdminTableCard>}
        </AdminPageMain>

        <input key={spreadsheetInputKey} ref={spreadsheetInputRef} type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="hidden" onChange={(event) => void handleSpreadsheetUpload(event.target.files?.[0])} />

        <Modal open={spreadsheetInfoOpen} onClose={() => setSpreadsheetInfoOpen(false)} title="과비 데이터 불러오기" footer={<><Button type="button" variant="outline" onClick={() => setSpreadsheetInfoOpen(false)}>취소</Button><Button type="button" onClick={() => { setSpreadsheetInfoOpen(false); spreadsheetInputRef.current?.click(); }}><FileUp aria-hidden="true" /> 파일 선택</Button></>}>
          <div className="space-y-3 text-sm font-normal leading-6 text-slate-600"><p>XLSX 형식을 확인한 뒤 기존 납부 상태를 반영합니다. 새 납부 원장 기록은 화면의 납부 처리에서 남겨 주세요.</p><ul className="list-disc space-y-1 pl-5"><li><code>userId</code> 또는 <code>stdNo</code> 열이 필요합니다.</li><li><code>status</code>, <code>paidAmount</code>, <code>coverageSemesters</code>, <code>note</code> 열을 지원합니다.</li><li>오류가 있는 행은 저장하지 않고 오류 내용을 보여줍니다.</li></ul></div>
        </Modal>

        <Modal open={paymentModalOpen} onClose={() => !saving && setPaymentModalOpen(false)} title="과비 납부 처리" className="max-w-4xl" footer={<><Button type="button" variant="outline" disabled={saving} onClick={() => setPaymentModalOpen(false)}>취소</Button><Button type="button" disabled={saving} onClick={() => void submitPayments()}>{saving ? "반영 중" : "납부 확정"}</Button></>}>
          <div className="space-y-5"><div className="grid gap-3 md:grid-cols-3"><AdminFormField label="납부 유형"><AdminSelectDropdown ariaLabel="납부 유형" value={paymentType} options={[{ value: "SIX_SEMESTER_LUMP_SUM", label: "6학기 일시납" }, { value: "PRIOR_PAYMENT_BALANCE", label: "기납부 차액 납부" }]} onChange={(value) => setPaymentType(value as FeePaymentType)} className="w-full" /></AdminFormField><AdminFormField label="적용 학기 수"><AdminSelectDropdown ariaLabel="적용 학기 수" value={paymentCoverage} onChange={setPaymentCoverage} className="w-full min-w-[190px]" options={[{ value: "1", label: "1학기" }, { value: "2", label: "2학기" }, { value: "4", label: "4학기" }, { value: "6", label: "6학기" }]} /></AdminFormField><AdminFormField label="결제 수단"><AdminSelectDropdown ariaLabel="결제 수단" value={paymentMethod} onChange={(value) => setPaymentMethod(value as FeePaymentMethod)} className="w-full" options={[{ value: "BANK_TRANSFER", label: "계좌이체" }, { value: "CASH", label: "현금" }, { value: "OTHER", label: "기타" }]} /></AdminFormField></div><div className="grid gap-3 md:grid-cols-2"><AdminFormField label="납부 일자"><UiInput type="date" value={paymentDate} onChange={(event) => setPaymentDate(event.currentTarget.value)} className="w-full" /></AdminFormField><AdminFormField label="비고"><UiInput value={paymentNote} onChange={(event) => setPaymentNote(event.currentTarget.value)} placeholder="입금자명 상이, 차액 사유 등" className="w-full" /></AdminFormField></div><div className="overflow-x-auto rounded-lg border border-slate-200"><table className="w-full min-w-[620px] table-fixed text-left text-sm"><colgroup><col className="w-[32%]" /><col className="w-[18%]" /><col className="w-[24%]" /><col className="w-[26%]" /></colgroup><thead className="bg-slate-50 text-xs font-medium text-slate-600"><tr><th className="px-3 py-2.5">대상</th><th className="px-3 py-2.5">학번</th><th className="px-3 py-2.5 text-right">수납액</th><th className="px-3 py-2.5">현재 상태</th></tr></thead><tbody className="divide-y divide-slate-100">{selectedStudents.map((student) => <tr key={student.userId}><td className="px-3 py-2.5 font-medium text-slate-900">{student.nameKo}</td><td className="px-3 py-2.5 tabular-nums text-slate-600">{student.stdNo || null}</td><td className="px-3 py-2.5"><UiInput aria-label={`${student.nameKo} 수납액`} type="number" min="0" step="1000" value={paymentAmounts[student.userId] ?? String(DEFAULT_FEE_AMOUNT)} onChange={(event) => setPaymentAmounts((current) => ({ ...current, [student.userId]: event.currentTarget.value }))} className="ml-auto w-36 text-right" /></td><td className="px-3 py-2.5 text-xs text-slate-500">{student.status === "PAID" ? "완납" : "미납"}</td></tr>)}</tbody></table></div><p className="text-xs leading-5 text-slate-500">기본 금액은 45,000원입니다. 2025년 이전 기납부자의 차액 납부는 학생별 수납액을 행 단위로 수정해 반영하세요.</p></div>
        </Modal>

        <AdminDrawer open={Boolean(detailStudentId)} onClose={() => setDetailStudentId(null)} title={detail?.user ? `${detail.user.nameKo} 납부 상세` : "납부 상세"} width="max-w-2xl" footer={detail ? <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setDetailStudentId(null)}>닫기</Button><Button type="button" disabled={saving} onClick={() => void saveDetail()}>{saving ? "저장 중" : "요약 정보 저장"}</Button></div> : undefined}>
          {detailLoading ? <div className="space-y-3"><Skeleton className="h-20 w-full" /><Skeleton className="h-28 w-full" /></div> : detail ? <div className="space-y-6"><div className="rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-700"><p className="font-medium text-slate-900">{detail.user.nameKo}{detail.user.nameEn ? ` · ${detail.user.nameEn}` : ""}</p><p className="mt-1">{detail.user.stdNo || "학번 없음"} · {detail.user.email}</p><p className="mt-1 text-xs text-slate-500">{detail.user.primaryMajor || "전공 정보 없음"}</p></div><section className="space-y-3"><h3 className="text-sm font-semibold text-slate-900">현재 요약</h3><div className="grid gap-3 md:grid-cols-2"><AdminFormField label="상태"><AdminSelectDropdown ariaLabel="상태" value={detailStatus} onChange={(value) => setDetailStatus(value as FeeStatus)} className="w-full" options={[{ value: "PAID", label: "완납" }, { value: "UNPAID", label: "미납" }]} /></AdminFormField><AdminFormField label="수납액"><UiInput type="number" min="0" step="1000" value={detailAmount} onChange={(event) => setDetailAmount(event.currentTarget.value)} className="w-full" /></AdminFormField></div><AdminFormField label="관리자 메모"><UiInput value={detailNote} onChange={(event) => setDetailNote(event.currentTarget.value)} placeholder="차액 사유, 입금자명 상이 등" className="w-full" /></AdminFormField></section><section><div className="mb-3 flex items-center justify-between"><h3 className="text-sm font-semibold text-slate-900">학기별 납부 이력</h3><span className="text-xs text-slate-500">{detail.history.length}건</span></div>{detail.history.length === 0 ? <p className="rounded-lg border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">등록된 납부 이력이 없습니다.</p> : <div className="divide-y divide-slate-100 rounded-lg border border-slate-200">{detail.history.map((payment) => <div key={payment.paymentId} className="grid gap-2 px-4 py-3 text-sm md:grid-cols-[1fr_auto]"><div><p className="font-medium text-slate-900">{formatCurrency(payment.amount)} · {payment.effectiveStartSemester}부터 {payment.coverageSemesters}학기</p><p className="mt-1 text-xs text-slate-500">{payment.paymentType === "PRIOR_PAYMENT_BALANCE" ? "기납부 차액" : "6학기 일시납"} · {payment.paymentMethod === "BANK_TRANSFER" ? "계좌이체" : payment.paymentMethod === "CASH" ? "현금" : "기타"}{payment.note ? ` · ${payment.note}` : ""}</p></div><time className="text-xs tabular-nums text-slate-500">{formatDateTime(payment.paidAt)}</time></div>)}</div>}<p className="mt-2 text-xs leading-5 text-slate-500">납부 원장 이력은 회계 추적을 위해 보존됩니다. 정정이 필요한 경우 새 납부 내역과 사유를 추가해 기록하세요.</p></section></div> : <p className="text-sm text-slate-500">납부 상세를 불러오지 못했습니다.</p>}
        </AdminDrawer>
      </AdminPageShell>
    </AuthGuard>
  );
}

function normalizeFeeSpreadsheetHeader(value: unknown) {
  return String(value ?? "").replace(/^\uFEFF/, "").trim().toLowerCase().replace(/\s+/g, "");
}

function parseFeeSpreadsheet(input: ArrayBuffer): { updates: BulkUpdateStudentFeeStatusRequest["updates"]; errors: string[] } {
  let rows: unknown[][];
  try {
    const workbook = XLSX.read(input, { type: "array", cellDates: false, raw: false });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) return { updates: [], errors: ["과비 납부 시트가 없습니다."] };
    rows = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[sheetName], { header: 1, defval: "", raw: false });
  } catch {
    return { updates: [], errors: ["XLSX 파일을 읽지 못했습니다."] };
  }
  if (rows.length < 2) return { updates: [], errors: ["헤더와 한 개 이상의 데이터 행이 필요합니다."] };
  const headers = rows[0].map(normalizeFeeSpreadsheetHeader);
  const indexOf = (...aliases: string[]) => headers.findIndex((header) => aliases.includes(header));
  const indexes = { userId: indexOf("userid", "사용자id"), stdNo: indexOf("stdno", "학번"), status: indexOf("status", "상태", "납부여부"), paidAmount: indexOf("paidamount", "납부금액", "실납부액", "수납액", "금액"), coverageSemesters: indexOf("coveragesemesters", "적용학기", "적용학기수"), note: indexOf("note", "비고", "메모") };
  if (indexes.userId < 0 && indexes.stdNo < 0) return { updates: [], errors: ["userId 또는 학번 열이 필요합니다."] };
  const errors: string[] = [];
  const updates: BulkUpdateStudentFeeStatusRequest["updates"] = [];
  rows.slice(1).forEach((row, lineIndex) => {
    const value = (index: number) => index >= 0 ? String(row[index] ?? "").trim() : "";
    const rawStatus = value(indexes.status).toUpperCase();
    const status: FeeStatus | undefined = rawStatus === "PAID" || rawStatus === "완납" || rawStatus === "납부완료" ? "PAID" : rawStatus === "PARTIAL" || rawStatus === "부분" || rawStatus === "부분납부" ? "PARTIAL" : rawStatus === "UNPAID" || rawStatus === "미납" || rawStatus === "미납부" ? "UNPAID" : undefined;
    const amountText = value(indexes.paidAmount).replace(/,/g, "");
    const amount = amountText ? Number(amountText) : undefined;
    const coverageText = value(indexes.coverageSemesters);
    const coverageSemesters = coverageText ? Number(coverageText) : undefined;
    const rowLabel = `${lineIndex + 2}행`;
    if (!value(indexes.userId) && !value(indexes.stdNo)) errors.push(`${rowLabel}: userId 또는 학번이 없습니다.`);
    if (rawStatus && !status) errors.push(`${rowLabel}: 상태 값이 올바르지 않습니다.`);
    if (amount !== undefined && (!Number.isInteger(amount) || amount < 0)) errors.push(`${rowLabel}: 납부 금액은 0 이상의 정수여야 합니다.`);
    if (coverageSemesters !== undefined && (!Number.isInteger(coverageSemesters) || coverageSemesters < 1 || coverageSemesters > 6)) errors.push(`${rowLabel}: 적용 학기 수는 1～6 사이여야 합니다.`);
    if (!status && amount === undefined && coverageSemesters === undefined && indexes.note < 0) errors.push(`${rowLabel}: 변경할 값이 없습니다.`);
    if (errors.some((error) => error.startsWith(`${rowLabel}:`))) return;
    updates.push({ ...(value(indexes.userId) ? { userId: value(indexes.userId) } : {}), ...(value(indexes.stdNo) ? { stdNo: value(indexes.stdNo) } : {}), ...(status ? { status } : {}), ...(amount !== undefined ? { paidAmount: amount } : {}), ...(coverageSemesters !== undefined ? { coverageSemesters } : {}), ...(indexes.note >= 0 ? { note: value(indexes.note) || null } : {}) });
  });
  return { updates, errors };
}
