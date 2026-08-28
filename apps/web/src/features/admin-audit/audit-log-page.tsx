import { createApiClient } from "@soc/api-client";
import type { AuditLogEventKind, AuditLogRecord } from "@soc/contracts";
import { isoToDate, nowIso } from "@soc/shared";
import { Activity, ArrowDown, Download, FileJson } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { AuthGuard } from "@/components/guards/auth-guard";
import { AdminDataTable, AdminTableBody, AdminTableCell, AdminTableHead, AdminTableHeader } from "@/components/ui/admin-data-table";
import { AdminDrawer } from "@/components/ui/admin-drawer";
import { AdminPageHeader, AdminPageMain, AdminPageShell, AdminTableCard } from "@/components/ui/admin-page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/data-state";
import { UiInput } from "@/components/ui/form-control";
import { PageSizeSelect, Pagination } from "@/components/ui/pagination";
import { PageSearchField } from "@/components/ui/page-layout";
import { AdminSelectDropdown } from "@/components/ui/admin-select";
import { Skeleton, TableSkeleton } from "@/components/ui/skeleton";
import { useCurrentSession } from "@/hooks/use-current-session";
import { resolveApiBaseUrl } from "@/lib/api-base-url";
import { downloadBlob } from "@/lib/download-blob";
import { Permissions } from "@/lib/permissions";

type SortBy = "createdAt" | "actor" | "action";
type SortDirection = "asc" | "desc";
type AuditPayload = Record<string, unknown>;

const domainOptions = [
  { value: "", label: "전체 도메인" },
  { value: "student_fee_status", label: "과비" },
  { value: "student_fee_payment", label: "과비 수납" },
  { value: "user", label: "유저" },
  { value: "role_group", label: "권한" },
  { value: "role_group_member", label: "권한 구성원" },
  { value: "content_block", label: "콘텐츠" },
  { value: "site_content", label: "사이트" },
  { value: "executive_contact", label: "집행위 연락망" },
];

const fieldLabels: Record<string, string> = {
  amount: "수납 금액",
  coverageSemesters: "적용 학기 수",
  effectiveStartSemester: "적용 시작 학기",
  isActive: "활성 상태",
  note: "관리자 메모",
  paidAmount: "실납부액",
  paymentMethod: "결제 수단",
  paymentType: "납부 유형",
  status: "납부 상태",
};

const formatDateTime = (value: string | null | undefined) => {
  if (!value) return "—";
  const date = isoToDate(value);
  if (Number.isNaN(date.getTime())) return "—";
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, "0")}.${String(date.getDate()).padStart(2, "0")} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
};

const parsePayload = (value: string | null): AuditPayload => {
  if (!value) return {};
  try {
    const parsed: unknown = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as AuditPayload : {};
  } catch {
    return {};
  }
};

const asRecord = (value: unknown): AuditPayload | undefined =>
  value && typeof value === "object" && !Array.isArray(value) ? value as AuditPayload : undefined;

const formatValue = (value: unknown): string => {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "예" : "아니오";
  if (typeof value === "number") return value.toLocaleString("ko-KR");
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
};

const getDiffRecords = (log: AuditLogRecord) => {
  const payload = parsePayload(log.payload);
  const before = asRecord(payload.before) ?? asRecord(payload.previous_data);
  const after = asRecord(payload.after) ?? asRecord(payload.current_data) ?? asRecord(payload.record);
  if (!before || !after) return [];
  const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])].filter((key) => key !== "updatedAt");
  return keys
    .filter((key) => JSON.stringify(before[key]) !== JSON.stringify(after[key]))
    .map((key) => ({ key, before: before[key], after: after[key] }));
};

const summaryEntries = (log: AuditLogRecord) => {
  const payload = parsePayload(log.payload);
  const entries: Array<[string, unknown]> = [];
  const preferredKeys = ["recipientType", "recipientCount", "subject", "successCount", "failureCount", "count", "reason"];
  for (const key of preferredKeys) {
    if (payload[key] !== undefined) entries.push([key, payload[key]]);
  }
  return entries;
};

const snapshotEntries = (log: AuditLogRecord) => {
  const payload = parsePayload(log.payload);
  const snapshot = asRecord(payload.after) ?? asRecord(payload.created) ?? asRecord(payload.deleted);
  return snapshot ? Object.entries(snapshot).filter(([key]) => !["createdAt", "updatedAt", "id"].includes(key)) : [];
};

const getEventLabel = (kind: AuditLogEventKind) => ({
  BATCH: "일괄 실행",
  CREATE: "생성",
  DELETE: "삭제",
  EXECUTE: "실행",
  OTHER: "실행",
  UPDATE: "수정",
}[kind]);

const dateInputToday = () => {
  const date = isoToDate(nowIso());
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};

export function AuditLogPage() {
  const client = useMemo(() => createApiClient({ baseUrl: resolveApiBaseUrl() }), []);
  const { data: session, isLoading: sessionLoading } = useCurrentSession();
  const canViewAuditLogs = Permissions.has(session?.permission ?? 0, Permissions.VIEW_AUDIT_LOG);
  const [data, setData] = useState<{ items: AuditLogRecord[]; page: number; pageSize: number; total: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [operationError, setOperationError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [targetType, setTargetType] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sortBy, setSortBy] = useState<SortBy>("createdAt");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [selectedLog, setSelectedLog] = useState<AuditLogRecord | null>(null);

  const loadLogs = useCallback(async () => {
    if (sessionLoading || !canViewAuditLogs) return;
    setLoading(true);
    try {
      const response = await client.listAuditLogs({
        page: currentPage,
        pageSize,
        q: query,
        sortBy,
        sortDirection,
        targetType: targetType || undefined,
        dateFrom,
        dateTo,
      });
      setData(response);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "운영 로그를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [canViewAuditLogs, client, currentPage, dateFrom, dateTo, pageSize, query, sessionLoading, sortBy, sortDirection, targetType]);

  useEffect(() => {
    void loadLogs();
  }, [loadLogs]);

  const totalCount = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const rangeStart = totalCount === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const rangeEnd = Math.min(totalCount, currentPage * pageSize);
  const refreshing = loading && data !== null;

  const updatePageFilter = (setter: (value: string) => void, value: string) => {
    setter(value);
    setCurrentPage(1);
  };

  const changeSort = (next: SortBy) => {
    if (next === sortBy) setSortDirection((current) => current === "desc" ? "asc" : "desc");
    else {
      setSortBy(next);
      setSortDirection(next === "createdAt" ? "desc" : "asc");
    }
    setCurrentPage(1);
  };

  const handleExport = async () => {
    setOperationError(null);
    try {
      const blob = await client.downloadAuditLogsXlsx({
        q: query,
        sortBy,
        sortDirection,
        targetType: targetType || undefined,
        dateFrom,
        dateTo,
      });
      downloadBlob(blob, `audit-logs-${dateFrom || "all"}-${dateTo || dateInputToday()}.xlsx`);
    } catch (err) {
      setOperationError(err instanceof Error ? err.message : "엑셀 파일을 만들지 못했습니다.");
    }
  };

  return (
    <AuthGuard requirePermission={Permissions.VIEW_AUDIT_LOG}>
      <AdminPageShell>
        <AdminPageMain>
          <AdminPageHeader
            title="운영 로그"
            actions={<Button type="button" onClick={() => void handleExport()}><Download aria-hidden="true" className="size-4" />내보내기</Button>}
          />

          <AdminTableCard className="overflow-visible">
            <div className="flex flex-col gap-3 border-b border-slate-100 p-4 xl:flex-row xl:items-end xl:justify-between">
              <div className="flex flex-wrap items-end gap-2">
                <AdminSelectDropdown ariaLabel="로그 도메인" value={targetType} options={domainOptions} onChange={(value) => updatePageFilter(setTargetType, value)} className="w-36 shrink-0" buttonClassName="h-[var(--ui-control-height)]" />
                <div aria-label="기간" className="flex w-full items-center gap-2 sm:w-[19rem]">
                  <UiInput aria-label="시작일" type="date" value={dateFrom} onChange={(event) => updatePageFilter(setDateFrom, event.currentTarget.value)} className="min-w-0 flex-1 text-sm font-normal" />
                  <span className="text-sm text-slate-400">~</span>
                  <UiInput aria-label="종료일" type="date" value={dateTo} onChange={(event) => updatePageFilter(setDateTo, event.currentTarget.value)} className="min-w-0 flex-1 text-sm font-normal" />
                </div>
              </div>
              <PageSearchField
                ariaLabel="운영 로그 검색"
                className="order-first ml-auto w-full xl:order-last xl:w-[25rem]"
                onChange={(value) => updatePageFilter(setQuery, value)}
                onClear={() => updatePageFilter(setQuery, "")}
                placeholder="담당자, 대상, 액션 검색"
                value={query}
              />
            </div>

            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
              <span className="text-sm font-normal tracking-[-0.02em] text-[#666]">총 {totalCount}건</span>
              {operationError ? <span role="alert" className="text-xs font-medium text-rose-600">{operationError}</span> : null}
            </div>

            <div className={refreshing ? "opacity-60 transition-opacity duration-150" : "transition-opacity duration-150"}>
              {data === null && loading ? <TableSkeleton columns={5} rows={8} /> : error && data === null ? <div className="p-6"><EmptyState message={error} /></div> : data && data.items.length > 0 ? (
                <AdminDataTable minWidth={900}>
                  <colgroup><col style={{ width: 150 }} /><col style={{ width: 112 }} /><col style={{ width: 230 }} /><col /><col style={{ width: 150 }} /></colgroup>
                  <AdminTableHeader>
                    <tr>
                      <SortableHead label="발생 시각" active={sortBy === "createdAt"} ascending={sortDirection === "asc"} onClick={() => changeSort("createdAt")} />
                      <AdminTableHead>구분</AdminTableHead>
                      <SortableHead label="액션" active={sortBy === "action"} ascending={sortDirection === "asc"} onClick={() => changeSort("action")} />
                      <AdminTableHead>대상 (식별 정보)</AdminTableHead>
                      <SortableHead label="담당자" active={sortBy === "actor"} ascending={sortDirection === "asc"} onClick={() => changeSort("actor")} />
                    </tr>
                  </AdminTableHeader>
                  <AdminTableBody>
                    {data.items.map((log) => (
                      <tr
                        key={log.auditLogId}
                        tabIndex={0}
                        className="cursor-pointer border-b border-slate-100 transition-colors hover:bg-slate-50 focus-visible:bg-slate-50 focus-visible:outline-none"
                        onClick={() => setSelectedLog(log)}
                        onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setSelectedLog(log); } }}
                      >
                        <AdminTableCell className="whitespace-nowrap text-sm tabular-nums text-slate-600">{formatDateTime(log.createdAt)}</AdminTableCell>
                        <AdminTableCell><Badge className="border-0 bg-slate-100 text-slate-700">{log.domainLabel}</Badge></AdminTableCell>
                        <AdminTableCell className="admin-table-text-emphasis">{log.actionLabel}</AdminTableCell>
                        <AdminTableCell className="max-w-0"><span className="block truncate text-sm font-normal text-slate-700" title={log.targetLabel}>{log.targetLabel}</span></AdminTableCell>
                        <AdminTableCell className="text-sm font-normal text-slate-600">{log.actorNameKo ?? "시스템"}</AdminTableCell>
                      </tr>
                    ))}
                  </AdminTableBody>
                </AdminDataTable>
              ) : data ? <EmptyState message="등록된 운영 로그가 없습니다." className="m-5" /> : <Skeleton className="m-5 h-52" />}
            </div>

            <div className="border-t border-slate-100 px-5 py-3">
              <Pagination
                className="m-0 w-full"
                currentPage={currentPage}
                onPageChange={setCurrentPage}
                pageSizeControl={<PageSizeSelect value={pageSize} onChange={(size) => { setPageSize(size); setCurrentPage(1); }} />}
                range={`총 ${totalCount}건 중 ${rangeStart}-${rangeEnd}`}
                totalPages={totalPages}
              />
            </div>
          </AdminTableCard>
        </AdminPageMain>

        <AuditLogDetailDrawer log={selectedLog} onClose={() => setSelectedLog(null)} />
      </AdminPageShell>
    </AuthGuard>
  );
}

function SortableHead({ label, active, ascending, onClick }: { label: string; active: boolean; ascending: boolean; onClick: () => void }) {
  return (
    <AdminTableHead>
      <button type="button" onClick={onClick} className="inline-flex h-8 items-center gap-1 text-sm font-medium text-slate-600 transition-colors hover:text-slate-900">
        {label}
        <ArrowDown aria-hidden="true" className={`size-3 ${active ? "text-brand-primary" : "opacity-40"} ${active && ascending ? "rotate-180" : ""}`} />
      </button>
    </AdminTableHead>
  );
}

function AuditLogDetailDrawer({ log, onClose }: { log: AuditLogRecord | null; onClose: () => void }) {
  const payload = log ? parsePayload(log.payload) : {};
  const diffs = log ? getDiffRecords(log) : [];
  const summaries = log ? summaryEntries(log) : [];
  const snapshots = log ? snapshotEntries(log) : [];

  return (
    <AdminDrawer open={Boolean(log)} onClose={onClose} title="로그 상세" width="max-w-2xl">
      {log ? (
        <div className="space-y-6">
          <header className="space-y-3">
            <div className="flex flex-wrap items-center gap-2"><Badge className="border-0 bg-slate-100 text-slate-700">{log.domainLabel}</Badge><span className="text-base font-semibold text-slate-950">{log.actionLabel}</span></div>
            <p className="text-sm font-normal text-slate-500">{formatDateTime(log.createdAt)} · 실행자: {log.actorNameKo ?? "시스템"}{log.actorUserId ? ` (${log.actorUserId})` : ""}</p>
          </header>

          <dl className="grid gap-4 rounded-xl bg-slate-50 px-4 py-4 sm:grid-cols-2">
            <div><dt className="text-xs font-medium text-slate-500">대상 엔티티</dt><dd className="mt-1 text-sm font-medium text-slate-900">{log.targetLabel}</dd></div>
            <div><dt className="text-xs font-medium text-slate-500">이벤트 유형</dt><dd className="mt-1 text-sm font-medium text-slate-900">{getEventLabel(log.eventKind)}</dd></div>
          </dl>

          {log.eventKind === "UPDATE" && diffs.length > 0 ? <section className="space-y-3"><SectionHeading>변경 전·후</SectionHeading><div className="divide-y divide-slate-100 rounded-xl border border-slate-200">{diffs.map((diff) => <div key={diff.key} className="grid gap-2 px-4 py-3 sm:grid-cols-[7rem_1fr] sm:items-center"><span className="text-xs font-medium text-slate-500">{fieldLabels[diff.key] ?? diff.key}</span><div className="flex flex-wrap items-center gap-2 text-sm"><span className="rounded-md bg-slate-100 px-2 py-1 text-slate-600">{formatValue(diff.before)}</span><span className="text-slate-400">→</span><span className="rounded-md bg-emerald-50 px-2 py-1 font-medium text-emerald-700">{formatValue(diff.after)}</span></div></div>)}</div></section> : null}

          {(log.eventKind === "EXECUTE" || log.eventKind === "BATCH") && summaries.length > 0 ? <section className="space-y-3"><SectionHeading>실행 요약</SectionHeading><dl className="divide-y divide-slate-100 rounded-xl border border-slate-200">{summaries.map(([key, value]) => <div key={key} className="grid gap-1 px-4 py-3 sm:grid-cols-[8rem_1fr]"><dt className="text-xs font-medium text-slate-500">{fieldLabels[key] ?? key}</dt><dd className="break-words text-sm text-slate-800">{formatValue(value)}</dd></div>)}</dl></section> : null}

          {(log.eventKind === "CREATE" || log.eventKind === "DELETE") && snapshots.length > 0 ? <section className="space-y-3"><SectionHeading>{log.eventKind === "CREATE" ? "생성된 대상" : "삭제된 대상 스냅샷"}</SectionHeading><dl className="divide-y divide-slate-100 rounded-xl border border-slate-200">{snapshots.map(([key, value]) => <div key={key} className="grid gap-1 px-4 py-3 sm:grid-cols-[8rem_1fr]"><dt className="text-xs font-medium text-slate-500">{fieldLabels[key] ?? key}</dt><dd className="break-words text-sm text-slate-800">{formatValue(value)}</dd></div>)}</dl></section> : null}

          {log.eventKind !== "UPDATE" && log.eventKind !== "CREATE" && log.eventKind !== "DELETE" && summaries.length === 0 ? <EmptyState message="표시할 실행 요약이 없습니다." minHeightClassName="min-h-24" /> : null}

          <details className="overflow-hidden rounded-xl border border-slate-200">
            <summary className="flex cursor-pointer items-center gap-2 px-4 py-3 text-sm font-medium text-slate-700"><FileJson aria-hidden="true" className="size-4 text-slate-400" /> 기술 메타데이터 (JSON)</summary>
            <dl className="grid gap-3 border-t border-slate-200 bg-slate-50 px-4 py-4 text-xs sm:grid-cols-2"><div><dt className="text-slate-500">이벤트 번호</dt><dd className="mt-1 font-mono text-slate-800">{log.auditLogId}</dd></div><div><dt className="text-slate-500">접속 IP</dt><dd className="mt-1 font-mono text-slate-800">{log.ipAddress ?? "—"}</dd></div><div><dt className="text-slate-500">액션 코드</dt><dd className="mt-1 break-all font-mono text-slate-800">{log.action}</dd></div><div><dt className="text-slate-500">대상 타입/ID</dt><dd className="mt-1 break-all font-mono text-slate-800">{log.targetType} / {log.targetId ?? "—"}</dd></div></dl>
            <pre className="scrollbar-hidden max-h-[28rem] overflow-auto border-t border-slate-200 bg-slate-950 p-4 text-xs leading-5 text-slate-100">{JSON.stringify(payload, null, 2)}</pre>
          </details>
        </div>
      ) : null}
    </AdminDrawer>
  );
}

function SectionHeading({ children }: { children: string }) {
  return <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900"><Activity aria-hidden="true" className="size-4 text-brand-primary" />{children}</h3>;
}
