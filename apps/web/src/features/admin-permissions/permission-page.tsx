import { ApiClientHttpError, createApiClient } from "@soc/api-client";
import type {
  AdminUserRecord,
  PermissionRecord,
  RoleGroupMemberRecord,
  RoleGroupRecord,
} from "@soc/contracts";
import { isoToDate } from "@soc/shared";
import {
  ArrowDown,
  Check,
  ChevronLeft,
  ChevronRight,
  Pencil,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { AuthGuard } from "@/components/guards/auth-guard";
import { useConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/data-state";
import { Skeleton } from "@/components/ui/skeleton";
import { useCurrentSession } from "@/hooks/use-current-session";
import { resolveApiBaseUrl } from "@/lib/api-base-url";
import { hasAdminPermission, Permissions } from "@/lib/permissions";

type RoleGroupFormState = {
  description: string;
  nameKo: string;
};

type MemberSortBy = "name" | "studentId" | "grantedAt";
type SortDirection = "asc" | "desc";

const emptyRoleGroupForm = (): RoleGroupFormState => ({
  description: "",
  nameKo: "",
});

const formatShortDate = (value?: string | null) => {
  if (!value) return "-";
  const date = isoToDate(value);
  if (Number.isNaN(date.getTime())) return "-";

  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}.${mm}.${dd}`;
};

const displayStudentId = (user: Pick<AdminUserRecord, "stdNo" | "kaistUid">) =>
  user.stdNo ?? user.kaistUid;

const compareText = (left?: string | null, right?: string | null) =>
  (left ?? "").localeCompare(right ?? "", "ko-KR", {
    numeric: true,
    sensitivity: "base",
  });

const operationErrorMessage = (error: unknown, fallback: string) => {
  if (error instanceof ApiClientHttpError) {
    if (error.status === 401) {
      return "로그인이 만료되었습니다. 다시 로그인한 뒤 시도해 주세요.";
    }
    if (error.status === 403) {
      return "이 작업을 수행할 권한이 없습니다.";
    }
  }

  return fallback;
};

const permissionDisplay: Record<
  string,
  { description: string; label: string }
> = {
  WRITE_NOTICE: {
    description: "공지, 행사 게시판에 공식 게시글을 작성할 수 있습니다.",
    label: "공지/행사 작성",
  },
  WRITE_GENERAL: {
    description: "HoC, 홍보글, 연구실 게시판에 글을 작성할 수 있습니다.",
    label: "일반 게시판 작성",
  },
  WRITE_REPLY: {
    description: "건의사항, QnA 게시판에 공식 답변을 작성하고 상태를 변경할 수 있습니다.",
    label: "공식 답변 관리",
  },
  MANAGE_SURVEY: {
    description: "행사, 설문·투표, 신청폼을 만들고 응답/결과를 확인할 수 있습니다.",
    label: "설문조사 관리",
  },
  MANAGE_FINANCE: {
    description: "학생회비 납부 상태를 확인·수정하고 독촉 메일을 발송할 수 있습니다.",
    label: "학생회비 관리",
  },
  MANAGE_CONTENT: {
    description: "홈 화면, 배너, 소개/로드맵, 캘린더 콘텐츠를 수정할 수 있습니다.",
    label: "사이트 콘텐츠 관리",
  },
  MANAGE_TOOL: {
    description: "POM 채점기, 챗봇 등 운영 도구 데이터와 설정을 관리할 수 있습니다.",
    label: "운영 도구 관리",
  },
  MODERATOR: {
    description: "전체 게시판의 게시글·댓글을 숨김/삭제하고 사용자 제재를 처리할 수 있습니다.",
    label: "게시글/댓글 관리",
  },
  ADMIN: {
    description: "운영 역할을 만들고 권한을 부여하며 구성원을 관리할 수 있습니다.",
    label: "권한 관리",
  },
};

const getPermissionDisplay = (permission: PermissionRecord) =>
  permissionDisplay[permission.code] ?? {
    description: permission.description ?? "운영 권한입니다.",
    label: permission.nameKo || "운영 권한",
  };

const arePermissionIdsEqual = (left: number[], right: number[]) => {
  if (left.length !== right.length) return false;

  const leftSorted = [...left].sort((a, b) => a - b);
  const rightSorted = [...right].sort((a, b) => a - b);
  return leftSorted.every((id, index) => id === rightSorted[index]);
};

export function PermissionPage() {
  const client = useMemo(
    () => createApiClient({ baseUrl: resolveApiBaseUrl() }),
    [],
  );
  const { data: session, isLoading: sessionLoading } = useCurrentSession();
  const { confirm: requestConfirm, ConfirmDialog } = useConfirmDialog();

  const [roleGroups, setRoleGroups] = useState<RoleGroupRecord[]>([]);
  const [permissions, setPermissions] = useState<PermissionRecord[]>([]);
  const [selectedRoleGroupId, setSelectedRoleGroupId] = useState<number | null>(
    null,
  );
  const [roleGroupMembers, setRoleGroupMembers] = useState<
    RoleGroupMemberRecord[]
  >([]);
  const [roleGroupForm, setRoleGroupForm] =
    useState<RoleGroupFormState>(emptyRoleGroupForm());
  const [selectedPermissionIds, setSelectedPermissionIds] = useState<number[]>(
    [],
  );
  const [memberQuery, setMemberQuery] = useState("");
  const [searchResults, setSearchResults] = useState<AdminUserRecord[]>([]);
  const [roleGroupLoading, setRoleGroupLoading] = useState(false);
  const [memberLoading, setMemberLoading] = useState(false);
  const [roleGroupSaving, setRoleGroupSaving] = useState(false);
  const [memberSavingUserId, setMemberSavingUserId] = useState<string | null>(
    null,
  );
  const [searchLoading, setSearchLoading] = useState(false);
  const [roleGroupError, setRoleGroupError] = useState<string | null>(null);
  const [memberError, setMemberError] = useState<string | null>(null);
  const [memberSortBy, setMemberSortBy] = useState<MemberSortBy>("name");
  const [memberSortDirection, setMemberSortDirection] =
    useState<SortDirection>("asc");
  const [roleGroupSaveStatus, setRoleGroupSaveStatus] = useState<
    "saved" | null
  >(null);

  const permissionMask = session?.permission ?? 0;
  const canEditRoleGroups = hasAdminPermission(permissionMask);

  const selectedRoleGroup =
    roleGroups.find(
      (roleGroup) => roleGroup.roleGroupId === selectedRoleGroupId,
    ) ?? null;
  const hasRoleGroupChanges = selectedRoleGroup
    ? roleGroupForm.nameKo !== selectedRoleGroup.nameKo ||
      roleGroupForm.description !== (selectedRoleGroup.description ?? "") ||
      !arePermissionIdsEqual(
        selectedPermissionIds,
        selectedRoleGroup.permissionIds,
      )
    : false;
  const sortedRoleGroupMembers = useMemo(() => {
    const direction = memberSortDirection === "asc" ? 1 : -1;

    return [...roleGroupMembers].sort((left, right) => {
      if (memberSortBy === "studentId") {
        return (
          compareText(displayStudentId(left), displayStudentId(right)) *
          direction
        );
      }

      if (memberSortBy === "grantedAt") {
        const leftTime = left.grantedAt ? isoToDate(left.grantedAt).getTime() : 0;
        const rightTime = right.grantedAt
          ? isoToDate(right.grantedAt).getTime()
          : 0;
        return (leftTime - rightTime) * direction;
      }

      return compareText(left.nameKo, right.nameKo) * direction;
    });
  }, [memberSortBy, memberSortDirection, roleGroupMembers]);

  const handleMemberSortChange = (nextSortBy: MemberSortBy) => {
    if (memberSortBy === nextSortBy) {
      setMemberSortDirection((currentDirection) =>
        currentDirection === "asc" ? "desc" : "asc",
      );
      return;
    }

    setMemberSortBy(nextSortBy);
    setMemberSortDirection("asc");
  };

  const openRoleGroupEditor = (roleGroup: RoleGroupRecord) => {
    setSelectedRoleGroupId(roleGroup.roleGroupId);
    setRoleGroupForm({
      description: roleGroup.description ?? "",
      nameKo: roleGroup.nameKo,
    });
    setSelectedPermissionIds(roleGroup.permissionIds);
    setSearchResults([]);
    setMemberQuery("");
    setRoleGroupSaveStatus(null);
  };

  const resetRoleGroupEditor = () => {
    setSelectedRoleGroupId(null);
    setRoleGroupForm(emptyRoleGroupForm());
    setSelectedPermissionIds([]);
    setRoleGroupMembers([]);
    setSearchResults([]);
    setMemberQuery("");
    setRoleGroupSaveStatus(null);
  };

  const loadRoleGroupMembers = async (roleGroupId: number) => {
    setMemberLoading(true);
    setMemberError(null);

    try {
      const fetchedMembers = await client.listRoleGroupMembers(roleGroupId);
      setRoleGroupMembers(fetchedMembers);
    } catch (error) {
      setMemberError(
        operationErrorMessage(error, "구성원 정보를 불러오지 못했습니다."),
      );
      setRoleGroupMembers([]);
    } finally {
      setMemberLoading(false);
    }
  };

  const loadRoleGroups = async (preferSelectedId?: number | null) => {
    const [fetchedRoleGroups, fetchedPermissions] = await Promise.all([
      client.listRoleGroups(),
      client.listPermissions(),
    ]);

    setRoleGroups(fetchedRoleGroups);
    setPermissions(fetchedPermissions);

    const selectedId = preferSelectedId ?? selectedRoleGroupId;
    const selected =
      selectedId !== null
        ? fetchedRoleGroups.find(
            (roleGroup) => roleGroup.roleGroupId === selectedId,
          )
        : fetchedRoleGroups[0];

    if (selected) {
      openRoleGroupEditor(selected);
      await loadRoleGroupMembers(selected.roleGroupId);
      return;
    }

    resetRoleGroupEditor();
  };

  useEffect(() => {
    if (sessionLoading || !session || !canEditRoleGroups) return;

    let cancelled = false;
    setRoleGroupLoading(true);
    setRoleGroupError(null);

    Promise.all([client.listRoleGroups(), client.listPermissions()])
      .then(async ([fetchedRoleGroups, fetchedPermissions]) => {
        if (cancelled) return;

        setRoleGroups(fetchedRoleGroups);
        setPermissions(fetchedPermissions);

        const first = fetchedRoleGroups[0];
        if (first) {
          openRoleGroupEditor(first);
          await loadRoleGroupMembers(first.roleGroupId);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setRoleGroupError(
            operationErrorMessage(
              error,
              "역할 그룹 데이터를 불러오지 못했습니다.",
            ),
          );
        }
      })
      .finally(() => {
        if (!cancelled) setRoleGroupLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [canEditRoleGroups, client, session, sessionLoading]);

  const handleSelectRoleGroup = async (roleGroup: RoleGroupRecord) => {
    openRoleGroupEditor(roleGroup);
    await loadRoleGroupMembers(roleGroup.roleGroupId);
  };

  const handleCreateRoleGroup = async () => {
    if (!canEditRoleGroups || roleGroupSaving) return;

    setRoleGroupSaving(true);
    setRoleGroupError(null);
    setMemberError(null);

    try {
      const nextIndex = roleGroups.length + 1;
      const createdRoleGroup = await client.createRoleGroup({
        description: "역할 설명을 입력하세요.",
        nameKo: `새 역할 ${nextIndex}`,
        permissionIds: [],
      });
      await loadRoleGroups(createdRoleGroup.roleGroupId);
    } catch (error) {
      setRoleGroupError(
        operationErrorMessage(error, "역할 그룹을 추가하지 못했습니다."),
      );
    } finally {
      setRoleGroupSaving(false);
    }
  };

  const togglePermissionId = (permissionId: number) => {
    setSelectedPermissionIds((prev) =>
      prev.includes(permissionId)
        ? prev.filter((id) => id !== permissionId)
        : [...prev, permissionId],
    );
  };

  const handleSaveRoleGroup = async () => {
    if (!canEditRoleGroups) return;

    if (!roleGroupForm.nameKo.trim()) {
      setRoleGroupError("역할 이름은 필수입니다.");
      return;
    }

    setRoleGroupSaving(true);
    setRoleGroupError(null);

    try {
      const payload = {
        description: roleGroupForm.description.trim() || undefined,
        nameKo: roleGroupForm.nameKo.trim(),
        permissionIds: selectedPermissionIds,
      };

      const savedRoleGroup =
        selectedRoleGroupId === null
          ? await client.createRoleGroup(payload)
          : await client.updateRoleGroup(selectedRoleGroupId, payload);

      await loadRoleGroups(savedRoleGroup.roleGroupId);
      setRoleGroupSaveStatus("saved");
    } catch (error) {
      setRoleGroupError(
        operationErrorMessage(error, "역할 그룹을 저장하지 못했습니다."),
      );
    } finally {
      setRoleGroupSaving(false);
    }
  };

  const handleCancelRoleGroupChanges = () => {
    if (!selectedRoleGroup) return;
    openRoleGroupEditor(selectedRoleGroup);
  };

  const handleDeleteRoleGroup = async () => {
    if (!canEditRoleGroups || !selectedRoleGroup) return;

    if (selectedRoleGroup.isSystem) {
      setRoleGroupError("시스템 역할 그룹은 삭제할 수 없습니다.");
      return;
    }

    const confirmed = await requestConfirm({
      confirmLabel: "삭제",
      description: "역할에 연결된 구성원 권한도 함께 해제됩니다.",
      title: `"${selectedRoleGroup.nameKo}" 역할을 삭제하시겠습니까?`,
      tone: "danger",
    });
    if (!confirmed) return;

    setRoleGroupSaving(true);
    setRoleGroupError(null);

    try {
      await client.deleteRoleGroup(selectedRoleGroup.roleGroupId);
      await loadRoleGroups(null);
    } catch (error) {
      setRoleGroupError(
        operationErrorMessage(error, "역할 그룹을 삭제하지 못했습니다."),
      );
    } finally {
      setRoleGroupSaving(false);
    }
  };

  const handleSearchUsers = async () => {
    if (!canEditRoleGroups || selectedRoleGroupId === null) return;

    if (memberQuery.trim().length < 2) {
      setMemberError("이름, 학번, 이메일 중 두 글자 이상 입력해 주세요.");
      setSearchResults([]);
      return;
    }

    setSearchLoading(true);
    setMemberError(null);

    try {
      const fetchedUsers = await client.searchUsers(memberQuery, 20);
      setSearchResults(fetchedUsers);
    } catch (error) {
      setMemberError(
        operationErrorMessage(error, "사용자 검색에 실패했습니다."),
      );
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  };

  const handleAddMember = async (user: AdminUserRecord) => {
    if (!canEditRoleGroups || selectedRoleGroupId === null) return;

    setMemberSavingUserId(user.userId);
    setMemberError(null);

    try {
      await client.addRoleGroupMember(selectedRoleGroupId, {
        userId: user.userId,
      });
      await loadRoleGroupMembers(selectedRoleGroupId);
      if (memberQuery.trim().length >= 2) {
        await handleSearchUsers();
      }
    } catch (error) {
      setMemberError(
        operationErrorMessage(error, "구성원 변경사항을 저장하지 못했습니다."),
      );
    } finally {
      setMemberSavingUserId(null);
    }
  };

  const handleRemoveMember = async (member: RoleGroupMemberRecord) => {
    if (!canEditRoleGroups || selectedRoleGroupId === null) return;

    const confirmed = await requestConfirm({
      confirmLabel: "제거",
      description: "이 사용자는 해당 역할로 부여받던 권한을 잃게 됩니다.",
      title: `"${member.nameKo}" 사용자를 역할에서 제거하시겠습니까?`,
      tone: "danger",
    });
    if (!confirmed) return;

    const userId = member.userId;
    setMemberSavingUserId(userId);
    setMemberError(null);

    try {
      await client.removeRoleGroupMember(selectedRoleGroupId, userId);
      await loadRoleGroupMembers(selectedRoleGroupId);
    } catch (error) {
      setMemberError(
        operationErrorMessage(error, "구성원 변경사항을 저장하지 못했습니다."),
      );
    } finally {
      setMemberSavingUserId(null);
    }
  };

  return (
    <AuthGuard requirePermission={Permissions.ADMIN}>
      <div className="min-h-screen bg-slate-50/50 text-slate-950">
        {ConfirmDialog}
        <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-8 md:px-8">
          <header className="border-b border-slate-200 pb-5">
            <div>
              <h1 className="text-2xl font-black tracking-tight text-slate-800">
                권한 관리
              </h1>
              <p className="mt-1 text-[13px] font-semibold leading-relaxed text-slate-400">
                운영 역할과 구성원을 관리합니다.
              </p>
            </div>
          </header>

          {!canEditRoleGroups ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm font-semibold text-amber-900">
              관리자 권한이 있는 계정에서만 역할과 구성원을 관리할 수 있습니다.
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <section className="rounded-2xl border border-slate-100 bg-white shadow-[0_8px_30px_rgba(0,0,0,0.015)]">
                <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
                  <div>
                    <h2 className="text-base font-extrabold tracking-tight text-slate-800">
                      운영 역할
                    </h2>
                    <p className="mt-0.5 text-xs font-bold text-slate-400">
                      전체 {roleGroups.length}개
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleCreateRoleGroup()}
                    disabled={roleGroupSaving}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-kaist-darkgreen px-3 py-1.5 text-xs font-black text-white shadow-sm hover:bg-[#0f5c29] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    역할 추가
                  </button>
                </div>

                <div className="p-4">
                  {roleGroupLoading ? (
                    <div className="flex flex-wrap gap-2" aria-busy="true">
                      {Array.from({ length: 5 }).map((_, index) => (
                        <div
                          key={index}
                          className="flex min-h-[3rem] min-w-44 items-center gap-3 rounded-full border border-slate-200 bg-white px-4 py-2"
                        >
                          <span className="min-w-0 flex-1 space-y-2">
                            <Skeleton className="h-3.5 w-24" />
                            <Skeleton className="h-3 w-32" />
                          </span>
                          <Skeleton className="h-5 w-8 rounded-full" />
                        </div>
                      ))}
                    </div>
                  ) : roleGroups.length === 0 ? (
                    <div className="space-y-3">
                      <EmptyState
                        message="등록된 역할이 없습니다."
                        minHeightClassName="min-h-20"
                      />
                      <button
                        type="button"
                        onClick={() => void handleCreateRoleGroup()}
                        disabled={roleGroupSaving}
                        className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-kaist-darkgreen px-3 py-2 text-xs font-black text-white hover:bg-[#0f5c29] disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <Plus className="h-3.5 w-3.5" />첫 역할 추가
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {roleGroups.map((roleGroup) => {
                        const selected =
                          roleGroup.roleGroupId === selectedRoleGroupId;

                        return (
                          <button
                            key={roleGroup.roleGroupId}
                            type="button"
                            onClick={() =>
                              void handleSelectRoleGroup(roleGroup)
                            }
                            className={`inline-flex min-h-[3rem] max-w-full items-center gap-3 rounded-full border px-4 py-2 text-left transition ${
                              selected
                                ? "border-kaist-darkgreen bg-kaist-darkgreen text-white shadow-sm"
                                : "border-slate-200 bg-white text-slate-700 hover:border-kaist-darkgreen/30 hover:bg-emerald-50/45"
                            }`}
                          >
                            <span className="min-w-0">
                              <span
                                className={`block truncate text-[13px] font-extrabold ${selected ? "text-white" : "text-slate-900"}`}
                              >
                                {roleGroup.nameKo}
                              </span>
                              <span
                                className={`mt-0.5 block max-w-[16rem] truncate text-[11px] font-semibold ${selected ? "text-white/75" : "text-slate-500"}`}
                              >
                                {roleGroup.description ?? "설명 없음"}
                              </span>
                            </span>
                            <span
                              className={`rounded-full px-2 py-0.5 text-[11px] font-black ${selected ? "bg-white/15 text-white" : "bg-slate-100 text-slate-600"}`}
                            >
                              {roleGroup.userCount}명
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                  {roleGroupError && !selectedRoleGroup && (
                    <p className="mx-3 mb-3 rounded-lg bg-rose-50 px-3 py-2 text-xs font-bold text-rose-600">
                      {roleGroupError}
                    </p>
                  )}
                </div>
              </section>

              {selectedRoleGroup ? (
                  <section className="rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_8px_30px_rgba(0,0,0,0.015)]">
                    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="text-base font-extrabold tracking-tight text-slate-800">
                            역할 정보
                          </h2>
                          {selectedRoleGroup.isSystem && (
                            <span className="inline-flex rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-black text-slate-500">
                              시스템 역할
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        {hasRoleGroupChanges && (
                          <button
                            type="button"
                            onClick={handleCancelRoleGroupChanges}
                            disabled={roleGroupSaving}
                            className="inline-flex items-center rounded-lg border border-slate-200 px-3 py-2 text-xs font-black text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            취소
                          </button>
                        )}
                        {!selectedRoleGroup?.isSystem &&
                        selectedRoleGroupId !== null ? (
                          <button
                            type="button"
                            onClick={() => void handleDeleteRoleGroup()}
                            disabled={roleGroupSaving}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 px-3 py-2 text-xs font-black text-rose-600 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            삭제
                          </button>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => void handleSaveRoleGroup()}
                          disabled={roleGroupSaving || !hasRoleGroupChanges}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-kaist-darkgreen px-3 py-2 text-xs font-black text-white hover:bg-[#0f5c29] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          {roleGroupSaving ? "저장 중" : "역할 저장"}
                        </button>
                      </div>
                    </div>

                    <div className="grid gap-3 md:grid-cols-[0.7fr_1.35fr]">
                      <label className="space-y-1.5 text-xs font-bold text-slate-500">
                        <span>역할 이름</span>
                        <input
                          value={roleGroupForm.nameKo}
                          onChange={(event) =>
                            setRoleGroupForm((prev) => ({
                              ...prev,
                              nameKo: event.target.value,
                            }))
                          }
                          readOnly={selectedRoleGroup.isSystem}
                          className="h-9 w-full rounded-lg border border-slate-200 px-3 text-xs font-bold text-slate-950 outline-none transition focus:border-kaist-darkgreen focus:ring-2 focus:ring-kaist-darkgreen/10 read-only:bg-slate-50 read-only:text-slate-500"
                          placeholder="예: 게시판 관리자"
                        />
                      </label>
                      <label className="space-y-1.5 text-xs font-bold text-slate-500">
                        <span>역할 설명</span>
                        <input
                          value={roleGroupForm.description}
                          onChange={(event) =>
                            setRoleGroupForm((prev) => ({
                              ...prev,
                              description: event.target.value,
                            }))
                          }
                          readOnly={selectedRoleGroup.isSystem}
                          className="h-9 w-full rounded-lg border border-slate-200 px-3 text-xs font-bold text-slate-950 outline-none transition focus:border-kaist-darkgreen focus:ring-2 focus:ring-kaist-darkgreen/10 read-only:bg-slate-50 read-only:text-slate-500"
                          placeholder="역할의 관리 범위를 입력하세요."
                        />
                      </label>
                    </div>

                    <div className="mt-5">
                      <p className="mb-2.5 text-sm font-extrabold tracking-tight text-slate-800">
                        권한 목록 · 선택됨 {selectedPermissionIds.length} / 전체{" "}
                        {permissions.length}
                      </p>
                      <div className="grid gap-1.5 md:grid-cols-2 xl:grid-cols-3">
                        {permissions.map((permission) => {
                          const selected = selectedPermissionIds.includes(
                            permission.permissionId,
                          );
                          const permissionInfo =
                            getPermissionDisplay(permission);

                          return (
                            <button
                              key={permission.permissionId}
                              type="button"
                              onClick={() =>
                                togglePermissionId(permission.permissionId)
                              }
                              className={`flex min-h-[3.75rem] items-start gap-2 rounded-lg border px-2.5 py-2 text-left transition ${
                                selected
                                  ? "border-emerald-200 bg-emerald-50/40 text-kaist-darkgreen"
                                  : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
                              }`}
                            >
                              <span
                                className={`mt-0.5 flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border ${
                                  selected
                                    ? "border-kaist-darkgreen bg-kaist-darkgreen text-white"
                                    : "border-slate-300 bg-white"
                                }`}
                              >
                                {selected && (
                                  <Check
                                    className="h-2.5 w-2.5"
                                    strokeWidth={4}
                                  />
                                )}
                              </span>
                              <span className="min-w-0">
                                <span className="block text-[11.5px] font-extrabold">
                                  {permissionInfo.label}
                                </span>
                                <span className="mt-0.5 line-clamp-2 block text-[10.5px] font-semibold leading-4 text-slate-500">
                                  {permissionInfo.description}
                                </span>
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {roleGroupError && (
                      <p className="mt-4 rounded-lg bg-rose-50 px-3 py-2 text-xs font-bold text-rose-600">
                        {roleGroupError}
                      </p>
                    )}
                  </section>
                ) : (
                  <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-[0_8px_30px_rgba(0,0,0,0.015)]">
                    <EmptyState
                      message="상단에서 역할을 추가하거나 선택해 주세요."
                      minHeightClassName="min-h-24"
                    />
                  </section>
                )}

                <section className="rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_8px_30px_rgba(0,0,0,0.015)]">
                  <div className="mb-4 flex flex-col gap-3">
                    <div>
                      <h2 className="text-base font-extrabold tracking-tight text-slate-800">
                        {selectedRoleGroup
                          ? `‘${selectedRoleGroup.nameKo}’ 구성원`
                          : "구성원 관리"}
                      </h2>
                      <p className="mt-0.5 text-xs font-semibold text-slate-500">
                        이 역할에 속한 사용자를 관리합니다.
                      </p>
                    </div>
                    <div className="flex min-w-0 items-center gap-2 overflow-x-auto">
                      <select
                        className="h-9 shrink-0 rounded-lg border border-slate-200 px-3 text-xs font-bold text-slate-600 outline-none"
                        defaultValue="10"
                      >
                        <option value="10">10명</option>
                      </select>
                      <div className="flex h-9 min-w-[18rem] flex-1 items-center gap-2 rounded-lg border border-slate-200 px-3">
                        <Search className="h-3.5 w-3.5 text-slate-400" />
                        <input
                          value={memberQuery}
                          onChange={(event) =>
                            setMemberQuery(event.target.value)
                          }
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              event.preventDefault();
                              void handleSearchUsers();
                            }
                          }}
                          className="w-full bg-transparent text-xs font-semibold outline-none placeholder:text-slate-400"
                          placeholder="이름, 학번, 이메일 검색"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => void handleSearchUsers()}
                        disabled={searchLoading || selectedRoleGroupId === null}
                        className="h-9 shrink-0 rounded-lg bg-kaist-darkgreen px-3 text-xs font-black text-white hover:bg-[#0f5c29] disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {searchLoading ? "검색 중" : "사용자 추가"}
                      </button>
                    </div>
                  </div>

                  {memberError && (
                    <p className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-xs font-bold text-rose-600">
                      {memberError}
                    </p>
                  )}

                  {searchResults.length > 0 && (
                    <div className="mb-4 rounded-xl border border-kaist-darkgreen/20 bg-kaist-darkgreen/5 p-3">
                      <p className="mb-2 text-xs font-black text-kaist-darkgreen">
                        검색 결과
                      </p>
                      <div className="grid gap-2 md:grid-cols-2">
                        {searchResults.map((user) => {
                          const alreadyMember = roleGroupMembers.some(
                            (member) => member.userId === user.userId,
                          );

                          return (
                            <div
                              key={user.userId}
                              className="flex items-center justify-between gap-3 rounded-lg bg-white px-3 py-2"
                            >
                              <div className="min-w-0">
                                <p className="truncate text-xs font-black">
                                  {user.nameKo}
                                </p>
                                <p className="truncate text-xs font-semibold text-slate-500">
                                  {displayStudentId(user)} · {user.email}
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={() => void handleAddMember(user)}
                                disabled={
                                  alreadyMember ||
                                  memberSavingUserId === user.userId
                                }
                                className="rounded-lg bg-kaist-darkgreen px-3 py-1.5 text-xs font-black text-white disabled:cursor-not-allowed disabled:bg-slate-300"
                              >
                                {alreadyMember
                                  ? "추가됨"
                                  : memberSavingUserId === user.userId
                                    ? "처리 중"
                                    : "추가"}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <div className="overflow-hidden rounded-lg border border-slate-200">
                    <table className="w-full min-w-[44rem] text-left text-sm">
                      <thead className="bg-slate-50 text-xs font-black text-slate-500">
                        <tr>
                          <th className="px-4 py-3">
                            <SortableHeader
                              active={memberSortBy === "name"}
                              ascending={
                                memberSortBy === "name" &&
                                memberSortDirection === "asc"
                              }
                              label="이름"
                              onClick={() => handleMemberSortChange("name")}
                            />
                          </th>
                          <th className="px-4 py-3">
                            <SortableHeader
                              active={memberSortBy === "studentId"}
                              ascending={
                                memberSortBy === "studentId" &&
                                memberSortDirection === "asc"
                              }
                              label="학번"
                              onClick={() =>
                                handleMemberSortChange("studentId")
                              }
                            />
                          </th>
                          <th className="px-4 py-3">이메일</th>
                          <th className="px-4 py-3">
                            <SortableHeader
                              active={memberSortBy === "grantedAt"}
                              ascending={
                                memberSortBy === "grantedAt" &&
                                memberSortDirection === "asc"
                              }
                              label="추가일"
                              onClick={() =>
                                handleMemberSortChange("grantedAt")
                              }
                            />
                          </th>
                          <th className="px-4 py-3 text-center">작업</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {memberLoading ? (
                          Array.from({ length: 5 }).map((_, index) => (
                            <tr key={index}>
                              {Array.from({ length: 5 }).map((__, columnIndex) => (
                                <td key={columnIndex} className="px-4 py-3">
                                  <Skeleton className="h-4 w-full max-w-28" />
                                </td>
                              ))}
                            </tr>
                          ))
                        ) : roleGroupMembers.length === 0 ? (
                          <tr>
                            <td
                              colSpan={5}
                              className="px-4 py-8 text-center text-sm font-bold text-slate-400"
                            >
                              아직 구성원이 없습니다.
                            </td>
                          </tr>
                        ) : (
                          sortedRoleGroupMembers.map((member) => (
                            <tr
                              key={member.userRoleGroupId}
                              className="text-sm text-slate-700"
                            >
                              <td className="px-4 py-3 font-black text-slate-950">
                                {member.nameKo}
                              </td>
                              <td className="px-4 py-3 font-semibold">
                                {displayStudentId(member)}
                              </td>
                              <td className="px-4 py-3 font-semibold">
                                {member.email}
                              </td>
                              <td className="px-4 py-3 font-semibold">
                                {formatShortDate(member.grantedAt)}
                              </td>
                              <td className="px-4 py-3 text-center">
                                <button
                                  type="button"
                                  onClick={() =>
                                    void handleRemoveMember(member)
                                  }
                                  disabled={
                                    memberSavingUserId === member.userId
                                  }
                                  className="inline-flex rounded-lg p-1.5 text-slate-500 hover:bg-rose-50 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-50"
                                  title="역할에서 제거"
                                  aria-label={`${member.nameKo} 역할에서 제거`}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                  <div className="mt-4 flex items-center justify-between text-xs font-bold text-slate-500">
                    <span>총 {roleGroupMembers.length}명</span>
                    <div className="flex items-center gap-4">
                      <ChevronLeft className="h-4 w-4" />
                      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-kaist-darkgreen text-white">
                        1
                      </span>
                      <ChevronRight className="h-4 w-4" />
                    </div>
                  </div>
                </section>
            </div>
          )}
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
