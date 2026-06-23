import { createApiClient } from "@soc/api-client";
import type { AdminUserListResponse, AdminUserRecord } from "@soc/contracts";
import { isoToDate } from "@soc/shared";
import { ArrowDown, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { AuthGuard } from "@/components/guards/auth-guard";
import { Pagination } from "@/components/ui/pagination";
import { TableSkeleton } from "@/components/ui/skeleton";
import { useCurrentSession } from "@/hooks/use-current-session";
import { resolveApiBaseUrl } from "@/lib/api-base-url";
import { Permissions } from "@/lib/permissions";

type UserSortBy = "name" | "studentId" | "status" | "lastLoginAt" | "createdAt";
type SortDirection = "asc" | "desc";
type UserStatusFilter = "all" | "active" | "inactive";

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

const displayStudentId = (user: AdminUserRecord) => user.stdNo ?? user.kaistUid;

export function UserManagementPage() {
  const client = useMemo(
    () => createApiClient({ baseUrl: resolveApiBaseUrl() }),
    [],
  );
  const { data: session, isLoading: sessionLoading } = useCurrentSession();
  const [data, setData] = useState<AdminUserListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<UserStatusFilter>("all");
  const [sortBy, setSortBy] = useState<UserSortBy>("name");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(20);

  const canManageUsers = Permissions.has(
    session?.permission ?? 0,
    Permissions.ADMIN,
  );

  useEffect(() => {
    if (sessionLoading || !canManageUsers) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    client
      .listAdminUsers({
        page: currentPage,
        pageSize,
        q: query,
        sortBy,
        sortDirection,
        status: statusFilter === "all" ? undefined : statusFilter,
      })
      .then((response) => {
        if (!cancelled) setData(response);
      })
      .catch(() => {
        if (!cancelled) {
          setData(null);
          setError("유저 목록을 불러오지 못했습니다.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [
    canManageUsers,
    client,
    currentPage,
    pageSize,
    query,
    sessionLoading,
    sortBy,
    sortDirection,
    statusFilter,
  ]);

  const totalCount = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  const handleSortChange = (nextSortBy: UserSortBy) => {
    if (sortBy === nextSortBy) {
      setSortDirection((currentDirection) =>
        currentDirection === "asc" ? "desc" : "asc",
      );
    } else {
      setSortBy(nextSortBy);
      setSortDirection("asc");
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
                유저 관리
              </h1>
              <p className="mt-1 text-[13px] font-semibold leading-relaxed text-slate-400">
                저장된 회원 프로필과 활동 가능 상태를 확인합니다.
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs font-bold">
              <span className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-slate-700">
                전체 {totalCount}명
              </span>
            </div>
          </header>

          <section className="rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_8px_30px_rgba(0,0,0,0.015)]">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="relative min-w-0 flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value);
                    setCurrentPage(1);
                  }}
                  className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-[13px] font-semibold text-slate-800 outline-none transition focus:border-kaist-darkgreen focus:ring-2 focus:ring-kaist-darkgreen/10"
                  placeholder="이름, 학번, 이메일, 소속 검색"
                />
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {[
                  { key: "all", label: "전체" },
                  { key: "active", label: "활성" },
                  { key: "inactive", label: "비활성" },
                ].map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => {
                      setStatusFilter(item.key as UserStatusFilter);
                      setCurrentPage(1);
                    }}
                    className={`rounded-lg border px-3 py-2 text-xs font-black transition ${
                      statusFilter === item.key
                        ? "border-kaist-darkgreen bg-kaist-darkgreen text-white"
                        : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          </section>

          <section className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-[0_8px_30px_rgba(0,0,0,0.015)]">
            {loading ? (
              <TableSkeleton columns={7} rows={8} />
            ) : error ? (
              <div className="m-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
                {error}
              </div>
            ) : (data?.items ?? []).length === 0 ? (
              <div className="px-6 py-16 text-center text-sm font-bold text-slate-400">
                조건에 맞는 유저가 없습니다.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full border-collapse text-[13px]">
                  <thead className="bg-slate-50/50 text-xs font-extrabold text-slate-500">
                    <tr>
                      <th className="px-4 py-3 text-left">
                        <SortableHeader
                          active={sortBy === "name"}
                          ascending={sortBy === "name" && sortDirection === "asc"}
                          label="이름"
                          onClick={() => handleSortChange("name")}
                        />
                      </th>
                      <th className="px-4 py-3 text-left">
                        <SortableHeader
                          active={sortBy === "studentId"}
                          ascending={
                            sortBy === "studentId" && sortDirection === "asc"
                          }
                          label="학번"
                          onClick={() => handleSortChange("studentId")}
                        />
                      </th>
                      <th className="px-4 py-3 text-left">이메일</th>
                      <th className="px-4 py-3 text-left">소속</th>
                      <th className="px-4 py-3 text-left">
                        <SortableHeader
                          active={sortBy === "status"}
                          ascending={
                            sortBy === "status" && sortDirection === "asc"
                          }
                          label="상태"
                          onClick={() => handleSortChange("status")}
                        />
                      </th>
                      <th className="px-4 py-3 text-left">
                        <SortableHeader
                          active={sortBy === "lastLoginAt"}
                          ascending={
                            sortBy === "lastLoginAt" &&
                            sortDirection === "asc"
                          }
                          label="최근 로그인"
                          onClick={() => handleSortChange("lastLoginAt")}
                        />
                      </th>
                      <th className="px-4 py-3 text-left">
                        <SortableHeader
                          active={sortBy === "createdAt"}
                          ascending={
                            sortBy === "createdAt" && sortDirection === "asc"
                          }
                          label="가입일"
                          onClick={() => handleSortChange("createdAt")}
                        />
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-600">
                    {(data?.items ?? []).map((user) => (
                      <tr key={user.userId} className="transition hover:bg-slate-50/60">
                        <td className="px-4 py-3">
                          <div className="truncate text-sm font-bold text-slate-900">
                            {user.nameKo}
                          </div>
                          {user.nameEn && (
                            <div className="mt-0.5 truncate text-xs font-medium text-slate-400">
                              {user.nameEn}
                            </div>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-xs font-semibold text-slate-500">
                          {displayStudentId(user)}
                        </td>
                        <td className="px-4 py-3 text-xs font-semibold text-slate-500">
                          {user.email}
                        </td>
                        <td className="px-4 py-3 text-xs font-semibold text-slate-500">
                          {user.departmentKo ?? "-"}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${
                              user.isActive
                                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                : "border-rose-200 bg-rose-50 text-rose-700"
                            }`}
                          >
                            {user.isActive ? "활성" : "비활성"}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-xs font-semibold text-slate-500">
                          {formatShortDateTime(user.lastLoginAt)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-xs font-semibold text-slate-500">
                          {formatShortDateTime(user.createdAt)}
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
      </div>
    </AuthGuard>
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
