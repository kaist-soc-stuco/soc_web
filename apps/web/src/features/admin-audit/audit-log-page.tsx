import { createApiClient } from "@soc/api-client";
import type { AuditLogListResponse, AuditLogRecord } from "@soc/contracts";
import { isoToDate } from "@soc/shared";
import { ArrowDown, ChevronDown, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { AuthGuard } from "@/components/guards/auth-guard";
import { Pagination } from "@/components/ui/pagination";
import { TableSkeleton } from "@/components/ui/skeleton";
import { useCurrentSession } from "@/hooks/use-current-session";
import { resolveApiBaseUrl } from "@/lib/api-base-url";
import { Permissions } from "@/lib/permissions";

type SortDirection = "asc" | "desc";
type AuditSortBy = "createdAt" | "actor" | "action";

const formatShortDateTime = (value?: string | null) => {
  if (!value) return "-";
  const date = isoToDate(value);
  if (Number.isNaN(date.getTime())) return "-";

  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  return `${yyyy}.${mm}.${dd} ${hh}:${min}`;
};

const formatPayload = (payload: string | null) => {
  if (!payload) return "-";

  try {
    return JSON.stringify(JSON.parse(payload), null, 2);
  } catch {
    return payload;
  }
};

export function AuditLogPage() {
  const client = useMemo(
    () => createApiClient({ baseUrl: resolveApiBaseUrl() }),
    [],
  );
  const { data: session, isLoading: sessionLoading } = useCurrentSession();
  const [data, setData] = useState<AuditLogListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState<AuditSortBy>("createdAt");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [isPageSizeDropdownOpen, setIsPageSizeDropdownOpen] = useState(false);
  const [selectedLog, setSelectedLog] = useState<AuditLogRecord | null>(null);
  const canViewAuditLogs = Permissions.has(
    session?.permission ?? 0,
    Permissions.ADMIN,
  );

  useEffect(() => {
    if (sessionLoading || !canViewAuditLogs) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    client
      .listAuditLogs({
        page: currentPage,
        pageSize,
        q: query,
        sortBy,
        sortDirection,
      })
      .then((response) => {
        if (!cancelled) setData(response);
      })
      .catch(() => {
        if (!cancelled) {
          setData(null);
          setError("운영 로그를 불러오지 못했습니다.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [
    canViewAuditLogs,
    client,
    currentPage,
    pageSize,
    query,
    sessionLoading,
    sortBy,
    sortDirection,
  ]);

  const totalCount = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  const handleSortChange = (nextSortBy: AuditSortBy) => {
    if (sortBy === nextSortBy) {
      setSortDirection((direction) => (direction === "desc" ? "asc" : "desc"));
    } else {
      setSortBy(nextSortBy);
      setSortDirection(nextSortBy === "createdAt" ? "desc" : "asc");
    }
    setCurrentPage(1);
  };

  return (
    <AuthGuard requirePermission={Permissions.ADMIN}>
      <div className="min-h-screen bg-slate-50/50 pb-20 text-slate-950">
        <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-8 md:px-8">
          <header className="flex flex-col justify-between gap-4 border-b border-slate-200 pb-5 md:flex-row md:items-center">
            <div>
              <h1 className="text-2xl font-black tracking-tight text-slate-800">
                운영 로그
              </h1>
              <p className="mt-1 text-[13px] font-semibold leading-relaxed text-slate-400">
                권한, 역할, 과비 등 관리자 작업 이력을 조회합니다.
              </p>
            </div>
            <span className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700">
              전체 {totalCount}건
            </span>
          </header>

          <section className="rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_8px_30px_rgba(0,0,0,0.015)]">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value);
                    setCurrentPage(1);
                  }}
                  className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-[13px] font-semibold text-slate-800 outline-none transition focus:border-kaist-darkgreen focus:ring-2 focus:ring-kaist-darkgreen/10"
                  placeholder="액션, 대상, 담당자, 이메일 검색"
                />
              </div>
              <PageSizeSelect
                isOpen={isPageSizeDropdownOpen}
                onOpenChange={setIsPageSizeDropdownOpen}
                onPageSizeChange={(size) => {
                  setPageSize(size);
                  setCurrentPage(1);
                }}
                pageSize={pageSize}
              />
            </div>
          </section>

          <section className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-[0_8px_30px_rgba(0,0,0,0.015)]">
            {loading ? (
              <TableSkeleton columns={5} rows={8} />
            ) : error ? (
              <div className="m-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
                {error}
              </div>
            ) : (data?.items ?? []).length === 0 ? (
              <div className="px-6 py-16 text-center text-sm font-bold text-slate-400">
                조건에 맞는 운영 로그가 없습니다.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full border-collapse text-[13px]">
                  <thead className="bg-slate-50/50 text-xs font-extrabold text-slate-500">
                    <tr>
                      <th className="w-36 px-4 py-3 text-left">
                        <SortableHeader
                          active={sortBy === "createdAt"}
                          ascending={
                            sortBy === "createdAt" && sortDirection === "asc"
                          }
                          label="발생 시각"
                          onClick={() => handleSortChange("createdAt")}
                        />
                      </th>
                      <th className="w-32 px-4 py-3 text-left">
                        <SortableHeader
                          active={sortBy === "actor"}
                          ascending={
                            sortBy === "actor" && sortDirection === "asc"
                          }
                          label="담당자"
                          onClick={() => handleSortChange("actor")}
                        />
                      </th>
                      <th className="w-56 px-4 py-3 text-left">
                        <SortableHeader
                          active={sortBy === "action"}
                          ascending={
                            sortBy === "action" && sortDirection === "asc"
                          }
                          label="액션"
                          onClick={() => handleSortChange("action")}
                        />
                      </th>
                      <th className="px-4 py-3 text-left">대상</th>
                      <th className="w-24 px-4 py-3 text-center">상세</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-600">
                    {(data?.items ?? []).map((log) => (
                      <tr
                        key={log.auditLogId}
                        className="transition hover:bg-slate-50/60"
                      >
                        <td className="whitespace-nowrap px-4 py-3 text-xs font-semibold text-slate-500">
                          {formatShortDateTime(log.createdAt)}
                        </td>
                        <td className="px-4 py-3 text-sm font-semibold text-slate-800">
                          {log.actorNameKo ?? log.actorUserId ?? "system"}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 font-mono text-xs font-semibold text-slate-700">
                          {log.action}
                        </td>
                        <td className="max-w-[26rem] px-4 py-3 text-xs font-semibold text-slate-500">
                          <span
                            className="block truncate"
                            title={`${log.targetType}${log.targetId ? ` / ${log.targetId}` : ""}`}
                          >
                            {log.targetType}
                            {log.targetId ? ` / ${log.targetId}` : ""}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button
                            type="button"
                            onClick={() => setSelectedLog(log)}
                            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-bold text-slate-600 transition hover:bg-slate-50 hover:text-slate-900"
                          >
                            보기
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex justify-center border-t border-slate-100 bg-slate-50/10 px-6 py-4">
              <Pagination
                currentPage={currentPage}
                onPageChange={setCurrentPage}
                totalPages={totalPages}
              />
            </div>
          </section>
        </main>

        {selectedLog && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/35 px-4">
            <div className="w-full max-w-3xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                <div>
                  <h2 className="text-base font-black text-slate-900">
                    로그 상세
                  </h2>
                  <p className="mt-0.5 text-xs font-semibold text-slate-400">
                    {selectedLog.action} ·{" "}
                    {formatShortDateTime(selectedLog.createdAt)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedLog(null)}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-black text-slate-600 hover:bg-slate-50"
                >
                  닫기
                </button>
              </div>
              <div className="space-y-4 p-5">
                <div className="grid gap-3 text-xs font-semibold text-slate-500 md:grid-cols-2">
                  <div>
                    <span className="block text-[11px] font-black uppercase text-slate-400">
                      IP
                    </span>
                    <span className="mt-1 block text-sm font-bold text-slate-700">
                      {selectedLog.ipAddress ?? "-"}
                    </span>
                  </div>
                  <div>
                    <span className="block text-[11px] font-black uppercase text-slate-400">
                      대상
                    </span>
                    <span className="mt-1 block break-all text-sm font-bold text-slate-700">
                      {selectedLog.targetType}
                      {selectedLog.targetId ? ` / ${selectedLog.targetId}` : ""}
                    </span>
                  </div>
                </div>
                <pre className="max-h-[26rem] overflow-auto rounded-xl bg-slate-950 p-4 text-xs leading-5 text-slate-100">
                  {formatPayload(selectedLog.payload)}
                </pre>
              </div>
            </div>
          </div>
        )}
      </div>
    </AuthGuard>
  );
}

function PageSizeSelect({
  isOpen,
  onOpenChange,
  onPageSizeChange,
  pageSize,
}: {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onPageSizeChange: (pageSize: number) => void;
  pageSize: number;
}) {
  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={() => onOpenChange(!isOpen)}
        className="flex h-10 items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 text-[12px] font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
      >
        <span>{pageSize}건</span>
        <ChevronDown
          className={`h-3.5 w-3.5 text-slate-400 transition-transform ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => onOpenChange(false)}
          />
          <div className="absolute right-0 top-full z-50 mt-1.5 w-28 rounded-xl border border-slate-200 bg-white py-1.5 shadow-[0_4px_20px_rgba(0,0,0,0.06)]">
            {[10, 20, 50].map((size) => (
              <button
                key={size}
                type="button"
                onClick={() => {
                  onPageSizeChange(size);
                  onOpenChange(false);
                }}
                className={`w-full px-3.5 py-2 text-left text-[12px] font-semibold transition ${
                  size === pageSize
                    ? "bg-[#e6f4ea]/40 text-kaist-darkgreen"
                    : "text-slate-700 hover:bg-slate-50"
                }`}
              >
                {size}건
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function SortableHeader({
  active,
  ascending,
  label,
  onClick,
}: {
  active: boolean;
  ascending: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 transition-colors ${
        active ? "text-kaist-darkgreen" : "text-slate-500 hover:text-slate-700"
      }`}
    >
      <span>{label}</span>
      <ArrowDown
        className={`h-3 w-3 transition-transform ${
          ascending ? "rotate-180" : ""
        }`}
      />
    </button>
  );
}
