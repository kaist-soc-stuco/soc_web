import { createApiClient } from "@soc/api-client";
import type { AdminUserListResponse, AdminUserRecord, UserPostingSuspensionResponse } from "@soc/contracts";
import { isoToDate, nowMs } from "@soc/shared";
import { Ban, UserRoundCheck, UserRoundX } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { AuthGuard } from "@/components/guards/auth-guard";
import { AdminDataTable, AdminSortableHead, AdminTableBody, AdminTableCell, AdminTableHead, AdminTableHeader } from "@/components/ui/admin-data-table";
import { AdminDrawer } from "@/components/ui/admin-drawer";
import { AdminSelectDropdown } from "@/components/ui/admin-select";
import { AdminCardHeader, AdminEmptyState, AdminPageHeader, AdminPageShell, AdminTableCard } from "@/components/ui/admin-page";
import { AdminStatusBadge } from "@/components/ui/admin-status-badge";
import { Button } from "@/components/ui/button";
import { useConfirmDialog } from "@/components/ui/confirm-dialog";
import { PageSizeSelect, Pagination } from "@/components/ui/pagination";
import { PageSearchField } from "@/components/ui/page-layout";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Modal } from "@/components/ui/modal";
import { UiTextarea } from "@/components/ui/form-control";
import { useToast } from "@/components/ui/toast";
import { useCurrentSession } from "@/hooks/use-current-session";
import { resolveApiBaseUrl } from "@/lib/api-base-url";
import { Permissions } from "@/lib/permissions";

type UserSortBy = "name" | "lastLoginAt";
type SortDirection = "asc" | "desc";
type UserStatusFilter = "all" | "active" | "inactive";
type MajorTypeFilter = "all" | "PRIMARY" | "DOUBLE" | "MINOR";
type FeeStatusFilter = "all" | "PAID" | "PARTIAL" | "UNPAID";
type AcademicStatusFilter = "all" | "재학" | "졸업";

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

const formatRelativeTime = (value?: string | null) => {
  if (!value) return "기록 없음";
  const date = isoToDate(value);
  if (Number.isNaN(date.getTime())) return "기록 없음";

  const elapsedSeconds = Math.max(0, Math.floor((nowMs() - date.getTime()) / 1000));
  if (elapsedSeconds < 60) return "방금 전";
  const minutes = Math.floor(elapsedSeconds / 60);
  if (minutes < 60) return `${minutes}분 전`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}일 전`;
  const weeks = Math.floor(days / 7);
  if (days < 30) return `${weeks}주 전`;
  const months = Math.floor(days / 30);
  if (days < 365) return `${months}개월 전`;
  return `${Math.floor(days / 365)}년 전`;
};

export function UserManagementPage() {
  const client = useMemo(
    () => createApiClient({ baseUrl: resolveApiBaseUrl() }),
    [],
  );
  const { confirm: requestConfirm, ConfirmDialog } = useConfirmDialog();
  const { toast } = useToast();
  const { data: session, isLoading: sessionLoading } = useCurrentSession();
  const [data, setData] = useState<AdminUserListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<UserStatusFilter>("all");
  const [majorTypeFilter, setMajorTypeFilter] = useState<MajorTypeFilter>("all");
  const [feeStatusFilter, setFeeStatusFilter] = useState<FeeStatusFilter>("all");
  const [academicStatusFilter, setAcademicStatusFilter] = useState<AcademicStatusFilter>("all");
  const [sortBy, setSortBy] = useState<UserSortBy>("name");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [selectedUser, setSelectedUser] = useState<AdminUserRecord | null>(null);
  const [deactivationTarget, setDeactivationTarget] = useState<AdminUserRecord | null>(null);
  const [deactivationReason, setDeactivationReason] = useState("");
  const [postingSuspension, setPostingSuspension] = useState<UserPostingSuspensionResponse | null>(null);
  const [postingSuspensionLoading, setPostingSuspensionLoading] = useState(false);
  const [postingSuspensionTarget, setPostingSuspensionTarget] = useState<AdminUserRecord | null>(null);
  const [postingSuspensionReason, setPostingSuspensionReason] = useState("");
  const [postingSuspensionSaving, setPostingSuspensionSaving] = useState(false);

  const canManageUsers = Permissions.has(
    session?.permission ?? 0,
    Permissions.MANAGE_USERS,
  );

  useEffect(() => {
    if (!selectedUser) {
      setPostingSuspension(null);
      return;
    }

    let cancelled = false;
    setPostingSuspensionLoading(true);
    client
      .getUserPostingSuspension(selectedUser.userId)
      .then((response) => {
        if (!cancelled) setPostingSuspension(response);
      })
      .catch(() => {
        if (!cancelled) setPostingSuspension(null);
      })
      .finally(() => {
        if (!cancelled) setPostingSuspensionLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [client, selectedUser]);

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
        majorType: majorTypeFilter === "all" ? undefined : majorTypeFilter,
        feeStatus: feeStatusFilter === "all" ? undefined : feeStatusFilter,
        academicStatus: academicStatusFilter === "all" ? undefined : academicStatusFilter,
      })
      .then((response) => {
        if (!cancelled) setData(response);
      })
      .catch(() => {
        if (!cancelled) {
          setError("사용자 목록을 불러오지 못했습니다.");
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
    majorTypeFilter,
    feeStatusFilter,
    academicStatusFilter,
    refreshVersion,
    sessionLoading,
    sortBy,
    sortDirection,
    statusFilter,
  ]);

  const totalCount = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const rangeStart = totalCount === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const rangeEnd = Math.min(totalCount, currentPage * pageSize);
  const showInitialLoading = loading && !data;

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

  const handleToggleActive = async (user: AdminUserRecord) => {
    const isDeactivation = user.isActive;
    if (isDeactivation) {
      setDeactivationTarget(user);
      setDeactivationReason("");
      return;
    }
    const confirmed = await requestConfirm({
      title: isDeactivation
        ? `${user.nameKo} 계정을 비활성화할까요?`
        : `${user.nameKo} 계정을 복구할까요?`,
      confirmLabel: isDeactivation ? "비활성화" : "복구",
      tone: isDeactivation ? "danger" : "default",
    });
    if (!confirmed) return;

    setUpdatingUserId(user.userId);
    setError(null);
    try {
      const result = await client.updateUserActiveStatus(user.userId, {
        isActive: !user.isActive,
      });
      setSelectedUser((current) => current?.userId === user.userId ? { ...current, isActive: result.isActive } : current);
      if (result.isActive !== user.isActive) setRefreshVersion((version) => version + 1);
    } catch {
      setError("유저 상태를 변경하지 못했습니다.");
    } finally {
      setUpdatingUserId(null);
    }
  };

  const confirmDeactivation = async () => {
    const user = deactivationTarget;
    if (!user || deactivationReason.trim().length < 2) return;
    setUpdatingUserId(user.userId);
    setError(null);
    try {
      const result = await client.updateUserActiveStatus(user.userId, {
        isActive: false,
        reason: deactivationReason.trim(),
      });
      setSelectedUser((current) => current?.userId === user.userId ? { ...current, isActive: result.isActive } : current);
      setRefreshVersion((version) => version + 1);
      setDeactivationTarget(null);
      setDeactivationReason("");
    } catch {
      setError("계정을 비활성화하지 못했습니다.");
    } finally {
      setUpdatingUserId(null);
    }
  };

  const handleTogglePostingSuspension = async (
    user: AdminUserRecord,
    suspended: boolean,
  ) => {
    if (!suspended) {
      setPostingSuspensionTarget(user);
      setPostingSuspensionReason("");
      return;
    }

    const confirmed = await requestConfirm({
      title: "게시 제한 해제",
      description: `${user.nameKo}님의 게시글·댓글 작성 제한을 해제할까요?`,
      confirmLabel: "제한 해제",
    });
    if (!confirmed) return;

    setPostingSuspensionSaving(true);
    try {
      const result = await client.updateUserPostingSuspension(user.userId, {
        suspended: false,
      });
      setPostingSuspension(result);
      toast({ type: "success", message: "게시 작성 제한을 해제했습니다." });
    } catch {
      setError("게시 작성 제한을 해제하지 못했습니다.");
      toast({ type: "error", message: "게시 작성 제한을 해제하지 못했습니다." });
    } finally {
      setPostingSuspensionSaving(false);
    }
  };

  const confirmPostingSuspension = async () => {
    const user = postingSuspensionTarget;
    if (!user || postingSuspensionReason.trim().length < 2) return;

    setPostingSuspensionSaving(true);
    try {
      const result = await client.updateUserPostingSuspension(user.userId, {
        suspended: true,
        reason: postingSuspensionReason.trim(),
      });
      setPostingSuspension(result);
      setPostingSuspensionTarget(null);
      setPostingSuspensionReason("");
      toast({ type: "success", message: "게시글·댓글 작성 제한을 적용했습니다." });
    } catch {
      setError("게시 작성 제한을 적용하지 못했습니다.");
      toast({ type: "error", message: "게시 작성 제한을 적용하지 못했습니다." });
    } finally {
      setPostingSuspensionSaving(false);
    }
  };

  return (
    <AuthGuard requirePermission={Permissions.MANAGE_USERS}>
      <AdminPageShell>
        <main className="admin-page__main mx-auto flex w-full max-w-[var(--ui-admin-page-max-width)] flex-col gap-6 px-5 py-7 md:px-8 xl:px-10">
          <AdminPageHeader title="유저 관리" />

          <AdminTableCard className="user-management-table" aria-busy={loading}>
            <AdminCardHeader className="items-center gap-4">
              <div className="flex flex-wrap items-center gap-2">
                <SegmentedControl<UserStatusFilter>
                  ariaLabel="사용자 상태"
                  role="tablist"
                  options={[
                    { value: "all", label: "전체" },
                    { value: "active", label: "활성" },
                    { value: "inactive", label: "비활성" },
                  ]}
                  value={statusFilter}
                  onChange={(value) => {
                    setStatusFilter(value);
                    setCurrentPage(1);
                  }}
                />
                <AdminSelectDropdown
                  ariaLabel="학적 상태"
                  className="w-32"
                  value={academicStatusFilter}
                  onChange={(value) => { setAcademicStatusFilter(value as AcademicStatusFilter); setCurrentPage(1); }}
                  options={[
                    { value: "all", label: "전체 학적" },
                    { value: "재학", label: "재학" },
                    { value: "졸업", label: "졸업" },
                  ]}
                />
                <AdminSelectDropdown
                  ariaLabel="전공 유형"
                  className="w-36"
                  value={majorTypeFilter}
                  onChange={(value) => { setMajorTypeFilter(value as MajorTypeFilter); setCurrentPage(1); }}
                  options={[
                    { value: "all", label: "전체 전공" },
                    { value: "PRIMARY", label: "주전공" },
                    { value: "DOUBLE", label: "복수전공" },
                    { value: "MINOR", label: "부전공" },
                  ]}
                />
                <AdminSelectDropdown
                  ariaLabel="과비 납부 상태"
                  className="w-36"
                  value={feeStatusFilter}
                  onChange={(value) => { setFeeStatusFilter(value as FeeStatusFilter); setCurrentPage(1); }}
                  options={[
                    { value: "all", label: "전체 과비" },
                    { value: "PAID", label: "완납" },
                    { value: "PARTIAL", label: "부분 납부" },
                    { value: "UNPAID", label: "미납" },
                  ]}
                />
              </div>
              <PageSearchField
                ariaLabel="사용자 검색"
                className="w-full md:w-72 lg:w-80"
                onChange={(value) => {
                  setQuery(value);
                  setCurrentPage(1);
                }}
                onClear={() => {
                  setQuery("");
                  setCurrentPage(1);
                }}
                placeholder="이름, 학번, 이메일, 소속 검색"
                value={query}
              />
            </AdminCardHeader>

            {error && data ? (
              <div className="border-b border-rose-100 bg-rose-50 px-5 py-3 text-sm font-medium text-rose-700">
                {error}
              </div>
            ) : null}

            {showInitialLoading ? null : error && !data ? (
              <div className="m-5 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
                {error}
              </div>
            ) : (data?.items ?? []).length === 0 ? (
              <AdminEmptyState message="조건에 맞는 사용자가 없습니다." />
            ) : (
              <AdminDataTable minWidth={1120}>
                <colgroup>
                  <col style={{ width: 240 }} />
                  <col style={{ width: 290 }} />
                  <col style={{ width: 230 }} />
                  <col style={{ width: 165 }} />
                  <col style={{ width: 150 }} />
                  <col style={{ width: 72 }} />
                </colgroup>
                <AdminTableHeader>
                  <tr>
                    <AdminSortableHead
                      active={sortBy === "name"}
                      ascending={sortBy === "name" && sortDirection === "asc"}
                      onClick={() => handleSortChange("name")}
                    >
                      이름
                    </AdminSortableHead>
                    <AdminTableHead>연락처</AdminTableHead>
                    <AdminTableHead>소속 · 전공</AdminTableHead>
                    <AdminTableHead>동의 시각</AdminTableHead>
                    <AdminSortableHead
                      active={sortBy === "lastLoginAt"}
                      ascending={sortBy === "lastLoginAt" && sortDirection === "asc"}
                      onClick={() => handleSortChange("lastLoginAt")}
                    >
                      최근 접속
                    </AdminSortableHead>
                    <AdminTableHead className="text-center">작업</AdminTableHead>
                  </tr>
                </AdminTableHeader>
                <AdminTableBody>
                  {(data?.items ?? []).map((user) => {
                    const major = [user.primaryMajor, user.doubleMajor, user.minor]
                      .filter(Boolean)
                      .join(" / ");

                    return (
                      <tr
                        key={user.userId}
                        tabIndex={0}
                        aria-label={`${user.nameKo} 사용자 상세 정보 열기`}
                        className={`cursor-pointer transition-colors hover:bg-slate-50/60 focus-visible:bg-slate-50 focus-visible:outline-none ${user.isActive ? "" : "bg-slate-50/80 opacity-60"}`}
                        onClick={() => setSelectedUser(user)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            setSelectedUser(user);
                          }
                        }}
                      >
                        <AdminTableCell className="py-3">
                          <div className="truncate text-[length:var(--ui-text-section-size)] font-medium leading-5 text-[var(--j-color-text-primary)]" title={user.nameKo}>
                            {user.nameKo}
                            {user.nameEn && user.nameEn.trim() !== user.nameKo.trim() ? <span className="font-normal text-slate-500">{" · "}{user.nameEn}</span> : null}
                          </div>
                          <div className="mt-0.5 truncate text-sm font-normal leading-5 text-[var(--j-color-text-secondary)]" title={displayStudentId(user)}>
                            {displayStudentId(user)}
                          </div>
                        </AdminTableCell>
                        <AdminTableCell className="py-3">
                          <div className="truncate text-sm font-normal leading-5 text-[var(--j-color-text-secondary)]" title={user.email}>{user.email}</div>
                          <div className="mt-0.5 truncate text-sm font-normal leading-5 text-[var(--j-color-text-secondary)]" title={user.phoneNumber ?? undefined}>{user.phoneNumber ?? ""}</div>
                        </AdminTableCell>
                        <AdminTableCell className="py-3">
                          <div className="truncate text-sm font-normal leading-5 text-[var(--j-color-text-secondary)]">{user.departmentKo ?? ""}</div>
                          {major ? <div className="mt-0.5 truncate text-sm font-normal leading-5 text-[var(--j-color-text-secondary)]">{major}</div> : null}
                        </AdminTableCell>
                        <AdminTableCell className="py-3 text-sm font-normal text-[var(--j-color-text-secondary)]">
                          {user.privacyConsentAt ? formatShortDateTime(user.privacyConsentAt) : ""}
                        </AdminTableCell>
                        <AdminTableCell className="py-3 text-sm font-normal text-[var(--j-color-text-secondary)]">
                          <time dateTime={user.lastLoginAt ?? undefined} title={formatShortDateTime(user.lastLoginAt)}>
                            {formatRelativeTime(user.lastLoginAt)}
                          </time>
                        </AdminTableCell>
                        <AdminTableCell className="py-3 text-center">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            aria-label={user.isActive ? "계정 비활성화" : "계정 복구"}
                            title={user.isActive ? "계정 비활성화" : "계정 복구"}
                            disabled={updatingUserId === user.userId}
                            onClick={(event) => {
                              event.stopPropagation();
                              void handleToggleActive(user);
                            }}
                            className="size-8 rounded-md border-0 bg-transparent text-slate-400 hover:border-0 hover:bg-slate-100 hover:text-slate-600"
                          >
                            {user.isActive ? <UserRoundX className="size-4" aria-hidden="true" /> : <UserRoundCheck className="size-4" aria-hidden="true" />}
                          </Button>
                        </AdminTableCell>
                      </tr>
                    );
                  })}
                </AdminTableBody>
              </AdminDataTable>
            )}

            {!showInitialLoading && totalCount > 0 ? (
              <div className="flex justify-center border-t border-slate-100 bg-slate-50/10 px-5 py-4">
                <Pagination
                  className="m-0 w-full"
                  currentPage={currentPage}
                  onPageChange={setCurrentPage}
                  pageSizeControl={
                    <PageSizeSelect
                      value={pageSize}
                      onChange={(value) => {
                        setPageSize(value);
                        setCurrentPage(1);
                      }}
                    />
                  }
                  range={<span className="whitespace-nowrap text-sm font-normal text-[var(--j-color-text-secondary)]">총 {totalCount}건 중 {rangeStart}-{rangeEnd}</span>}
                  totalPages={totalPages}
                />
              </div>
            ) : null}
          </AdminTableCard>
        </main>
        <UserDetailDrawer
          user={selectedUser}
          postingSuspension={postingSuspension}
          postingSuspensionLoading={postingSuspensionLoading}
          onClose={() => setSelectedUser(null)}
          onToggleActive={() => selectedUser ? void handleToggleActive(selectedUser) : undefined}
          onTogglePostingSuspension={() => selectedUser ? void handleTogglePostingSuspension(selectedUser, Boolean(postingSuspension?.suspended)) : undefined}
          updating={selectedUser ? updatingUserId === selectedUser.userId : false}
        />
        <Modal
          open={Boolean(deactivationTarget)}
          onClose={() => { setDeactivationTarget(null); setDeactivationReason(""); }}
          title="계정 비활성화"
          footer={(
            <>
              <Button type="button" variant="outline" onClick={() => { setDeactivationTarget(null); setDeactivationReason(""); }}>취소</Button>
              <Button type="button" variant="destructive" disabled={deactivationReason.trim().length < 2 || Boolean(updatingUserId)} onClick={() => void confirmDeactivation()}>비활성화</Button>
            </>
          )}
        >
          <p className="text-sm font-normal leading-6 text-app-text-secondary">
            {deactivationTarget?.nameKo}님은 즉시 로그인할 수 없게 되며, 로그인 시 비활성화 안내와 복구 문의 방법이 표시됩니다.
          </p>
          <UiTextarea
            className="mt-4 min-h-28"
            value={deactivationReason}
            onChange={(event) => setDeactivationReason(event.target.value)}
            placeholder="비활성화 사유를 입력해 주세요."
          />
        </Modal>
        <Modal
          open={Boolean(postingSuspensionTarget)}
          onClose={() => {
            if (!postingSuspensionSaving) {
              setPostingSuspensionTarget(null);
              setPostingSuspensionReason("");
            }
          }}
          title="게시 작성 제한"
          footer={(
            <>
              <Button
                type="button"
                variant="outline"
                disabled={postingSuspensionSaving}
                onClick={() => {
                  setPostingSuspensionTarget(null);
                  setPostingSuspensionReason("");
                }}
              >
                취소
              </Button>
              <Button
                type="button"
                variant="destructive"
                disabled={postingSuspensionSaving || postingSuspensionReason.trim().length < 2}
                onClick={() => void confirmPostingSuspension()}
              >
                제한 적용
              </Button>
            </>
          )}
        >
          <p className="text-sm font-normal leading-6 text-app-text-secondary">
            {postingSuspensionTarget?.nameKo}님의 새 게시글과 댓글 작성을 제한합니다. 운영 기록에 남길 사유를 입력해 주세요.
          </p>
          <UiTextarea
            className="mt-4 min-h-28"
            value={postingSuspensionReason}
            onChange={(event) => setPostingSuspensionReason(event.target.value)}
            placeholder="게시 제한 사유를 입력해 주세요."
          />
        </Modal>
        {ConfirmDialog}
      </AdminPageShell>
    </AuthGuard>
  );
}

function UserDetailDrawer({
  onClose,
  onToggleActive,
  onTogglePostingSuspension,
  postingSuspension,
  postingSuspensionLoading,
  updating,
  user,
}: {
  onClose: () => void;
  onToggleActive: () => void;
  onTogglePostingSuspension: () => void;
  postingSuspension: UserPostingSuspensionResponse | null;
  postingSuspensionLoading: boolean;
  updating: boolean;
  user: AdminUserRecord | null;
}) {
  return (
    <AdminDrawer
      open={Boolean(user)}
      onClose={onClose}
      title={user ? `${user.nameKo} 상세 정보` : "사용자 상세 정보"}
      width="max-w-xl"
      footer={user ? <div className="flex flex-wrap justify-end gap-2"><Button type="button" variant="outline" disabled={updating} onClick={onToggleActive}><span className="inline-flex items-center gap-2">{user.isActive ? <UserRoundX aria-hidden="true" className="size-4" /> : <UserRoundCheck aria-hidden="true" className="size-4" />}{updating ? "처리 중" : user.isActive ? "계정 비활성화" : "계정 복구"}</span></Button><Button type="button" variant={postingSuspension?.suspended ? "outline" : "destructive"} disabled={postingSuspensionLoading} onClick={onTogglePostingSuspension}><span className="inline-flex items-center gap-2"><Ban aria-hidden="true" className="size-4" />{postingSuspensionLoading ? "확인 중" : postingSuspension?.suspended ? "게시 제한 해제" : "게시 제한"}</span></Button></div> : undefined}
    >
      {user ? (
        <div className="space-y-6">
          <section className="rounded-xl bg-slate-50 px-4 py-4">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h3 className="truncate text-lg font-semibold text-slate-950">
                  {user.nameKo}
                  {user.nameEn ? <span className="font-normal text-slate-500">{" · "}{user.nameEn}</span> : null}
                </h3>
              </div>
              <AdminStatusBadge tone={user.isActive ? "positive" : "danger"}>{user.isActive ? "활성 계정" : "비활성 계정"}</AdminStatusBadge>
            </div>
            <dl className="mt-4 grid gap-x-5 gap-y-3 text-sm sm:grid-cols-2">
              <UserDetailItem label="학번" value={displayStudentId(user)} />
              <UserDetailItem label="KAIST UID" value={user.kaistUid} />
              <UserDetailItem label="이메일" value={user.email} />
              <UserDetailItem label="전화번호" value={user.phoneNumber ?? ""} />
              <UserDetailItem label="소속" value={user.departmentKo ?? "—"} />
              <UserDetailItem label="주전공" value={user.primaryMajor ?? "—"} />
              <UserDetailItem label="복수전공" value={user.doubleMajor ?? "—"} />
              <UserDetailItem label="부전공" value={user.minor ?? "—"} />
              <UserDetailItem label="학적 상태" value={user.academicStatus ?? "—"} />
            </dl>
          </section>

          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-900">계정 상세 메타데이터</h3>
            <dl className="divide-y divide-slate-100 rounded-xl border border-slate-200">
              <UserDetailRow label="가입 일시" value={formatShortDateTime(user.createdAt)} />
              <UserDetailRow label="최근 접속" value={formatShortDateTime(user.lastLoginAt)} />
              <UserDetailRow label="개인정보 동의 시각" value={user.privacyConsentAt ? formatShortDateTime(user.privacyConsentAt) : ""} />
              <UserDetailRow label="계정 식별 코드" value={user.identityCode ?? "—"} />
            </dl>
          </section>

          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-900">게시 권한</h3>
            <div className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
              <span className="text-sm font-normal text-slate-600">새 게시글·댓글 작성</span>
              <AdminStatusBadge tone={postingSuspension?.suspended ? "danger" : "positive"}>
                {postingSuspension?.suspended ? "제한됨" : "허용됨"}
              </AdminStatusBadge>
            </div>
            {postingSuspension?.sanction?.reason ? (
              <p className="text-xs font-normal leading-5 text-slate-500">사유: {postingSuspension.sanction.reason}</p>
            ) : null}
          </section>

          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-900">과비 납부</h3>
            <div className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3">
              <span className="text-sm text-slate-600">현재 상태</span>
              <AdminStatusBadge tone={user.feeStatus === "PAID" ? "positive" : "neutral"}>{user.feeStatus === "PAID" ? "완납" : user.feeStatus === "PARTIAL" ? "부분 납부" : user.feeStatus === "UNPAID" ? "미납" : "기록 없음"}</AdminStatusBadge>
            </div>
          </section>
        </div>
      ) : null}
    </AdminDrawer>
  );
}

function UserDetailItem({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0"><dt className="text-xs font-medium text-slate-500">{label}</dt><dd className="mt-1 break-words text-sm font-normal text-slate-900">{value}</dd></div>;
}

function UserDetailRow({ label, value }: { label: string; value: string }) {
  return <div className="grid gap-1 px-4 py-3 sm:grid-cols-[7rem_1fr]"><dt className="text-xs font-medium text-slate-500">{label}</dt><dd className="break-words text-sm font-normal text-slate-800">{value}</dd></div>;
}
