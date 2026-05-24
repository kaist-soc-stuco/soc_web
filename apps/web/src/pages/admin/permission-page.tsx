import { useEffect, useMemo, useState } from "react";
import { createApiClient } from "@soc/api-client";
import type {
  AdminUserRecord,
  PermissionRecord,
  RoleGroupMemberRecord,
  RoleGroupRecord,
} from "@soc/contracts";
import { formatKoreanDateTime } from "@soc/shared";

import { AuthGuard } from "@/components/guards/auth-guard";
import { useCurrentSession } from "@/hooks/use-current-session";
import { resolveApiBaseUrl } from "@/lib/api-base-url";
import { maskUuid } from "@/lib/utils";
import {
  hasAdminPermission,
  Permissions,
} from "@/lib/permissions";

type RoleGroupFormState = {
  description: string;
  nameKo: string;
};

const createEmptyRoleGroupForm = (): RoleGroupFormState => ({
  description: "",
  nameKo: "",
});

export function PermissionPage() {
  const client = useMemo(() => createApiClient({ baseUrl: resolveApiBaseUrl() }), []);
  const [permission, setPermission] = useState<number>(0);
  const [userId, setUserId] = useState<string | null>(null);
  const [roleGroups, setRoleGroups] = useState<RoleGroupRecord[]>([]);
  const [permissions, setPermissions] = useState<PermissionRecord[]>([]);
  const [selectedRoleGroupId, setSelectedRoleGroupId] = useState<number | null>(null);
  const [roleGroupMembers, setRoleGroupMembers] = useState<RoleGroupMemberRecord[]>([]);
  const [memberQuery, setMemberQuery] = useState("");
  const [searchResults, setSearchResults] = useState<AdminUserRecord[]>([]);
  const [roleGroupForm, setRoleGroupForm] = useState<RoleGroupFormState>(
    createEmptyRoleGroupForm(),
  );
  const [selectedPermissionIds, setSelectedPermissionIds] = useState<number[]>([]);
  const [roleGroupLoading, setRoleGroupLoading] = useState(false);
  const [memberLoading, setMemberLoading] = useState(false);
  const [memberSavingUserId, setMemberSavingUserId] = useState<string | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [roleGroupSaving, setRoleGroupSaving] = useState(false);
  const [roleGroupError, setRoleGroupError] = useState<string | null>(null);
  const [memberError, setMemberError] = useState<string | null>(null);
  const { data: session, isLoading: sessionLoading } = useCurrentSession();

  const loadRoleGroupMembers = async (roleGroupId: number) => {
    setMemberLoading(true);
    setMemberError(null);

    try {
      const fetchedMembers = await client.listRoleGroupMembers(roleGroupId);
      setRoleGroupMembers(fetchedMembers);
    } catch {
      setMemberError("그룹 사용자 정보를 불러오지 못했습니다.");
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
        ? fetchedRoleGroups.find((roleGroup) => roleGroup.roleGroupId === selectedId)
        : fetchedRoleGroups[0];

    if (selected) {
      openRoleGroupEditor(selected);
      await loadRoleGroupMembers(selected.roleGroupId);
      return;
    }

    resetRoleGroupEditor();
    setRoleGroupMembers([]);
  };

  useEffect(() => {
    (async () => {
      if (sessionLoading || !session) {
        return;
      }

      setPermission(session.permission ?? 0);
      setUserId(session.userId ?? null);

      if (hasAdminPermission(session.permission)) {
        setRoleGroupLoading(true);
        try {
          await loadRoleGroups(null);
        } catch {
          setRoleGroupError("역할 그룹 데이터를 불러오지 못했습니다.");
        } finally {
          setRoleGroupLoading(false);
        }
      }
    })();
  }, [session, sessionLoading]);

  const canEditRoleGroups = hasAdminPermission(permission);

  const selectedRoleGroup = roleGroups.find(
    (roleGroup) => roleGroup.roleGroupId === selectedRoleGroupId,
  ) ?? null;

  const resetRoleGroupEditor = () => {
    setSelectedRoleGroupId(null);
    setRoleGroupForm(createEmptyRoleGroupForm());
    setSelectedPermissionIds([]);
  };

  const openRoleGroupEditor = (roleGroup: RoleGroupRecord) => {
    setSelectedRoleGroupId(roleGroup.roleGroupId);
    setRoleGroupForm({
      description: roleGroup.description ?? "",
      nameKo: roleGroup.nameKo,
    });
    setSelectedPermissionIds(roleGroup.permissionIds);
  };

  const refreshRoleGroups = async () => {
    await loadRoleGroups(selectedRoleGroupId);
  };

  const handleSelectRoleGroup = async (roleGroup: RoleGroupRecord) => {
    openRoleGroupEditor(roleGroup);
    await loadRoleGroupMembers(roleGroup.roleGroupId);
  };

  const handleSearchUsers = async () => {
    if (!canEditRoleGroups) {
      return;
    }

    setSearchLoading(true);
    setMemberError(null);

    try {
      const fetchedUsers = await client.searchUsers(memberQuery, 20);
      setSearchResults(fetchedUsers);
    } catch {
      setMemberError("사용자 검색에 실패했습니다.");
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  };

  const handleAddMember = async (user: AdminUserRecord) => {
    if (!canEditRoleGroups || selectedRoleGroupId === null) {
      return;
    }

    setMemberSavingUserId(user.userId);
    setMemberError(null);

    try {
      await client.addRoleGroupMember(selectedRoleGroupId, { userId: user.userId });
      await loadRoleGroupMembers(selectedRoleGroupId);
      if (memberQuery.trim()) {
        await handleSearchUsers();
      }
    } catch {
      setMemberError("사용자를 그룹에 추가하지 못했습니다.");
    } finally {
      setMemberSavingUserId(null);
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!canEditRoleGroups || selectedRoleGroupId === null) {
      return;
    }

    setMemberSavingUserId(userId);
    setMemberError(null);

    try {
      await client.removeRoleGroupMember(selectedRoleGroupId, userId);
      await loadRoleGroupMembers(selectedRoleGroupId);
      if (memberQuery.trim()) {
        await handleSearchUsers();
      }
    } catch {
      setMemberError("사용자를 그룹에서 제거하지 못했습니다.");
    } finally {
      setMemberSavingUserId(null);
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
    if (!canEditRoleGroups) {
      return;
    }

    if (!roleGroupForm.nameKo.trim()) {
      setRoleGroupError("역할 그룹 이름은 필수입니다.");
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

      if (savedRoleGroup) {
        await refreshRoleGroups();
        openRoleGroupEditor(savedRoleGroup);
      }
    } catch {
      setRoleGroupError("역할 그룹을 저장하지 못했습니다.");
    } finally {
      setRoleGroupSaving(false);
    }
  };

  const handleDeleteRoleGroup = async () => {
    if (!canEditRoleGroups || selectedRoleGroupId === null) {
      return;
    }

    const selected = roleGroups.find(
      (roleGroup) => roleGroup.roleGroupId === selectedRoleGroupId,
    );

    if (!selected) {
      return;
    }

    if (!confirm(`"${selected.nameKo}" 역할 그룹을 삭제하시겠습니까?`)) {
      return;
    }

    setRoleGroupSaving(true);
    setRoleGroupError(null);

    try {
      await client.deleteRoleGroup(selectedRoleGroupId);
      await refreshRoleGroups();
    } catch {
      setRoleGroupError("역할 그룹을 삭제하지 못했습니다.");
    } finally {
      setRoleGroupSaving(false);
    }
  };

  const permissionLabelById = new Map(
    permissions.map((item) => [item.permissionId, item]),
  );

  return (
    <AuthGuard requirePermission={Permissions.ADMIN}>
      <div className="min-h-screen bg-slate-50/50 text-kaist-black pb-20">
        <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-8 md:px-8">
          
          {/* Compact Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-200 pb-5 gap-4 select-none">
            <div>
              <h1 className="text-2xl font-black tracking-tight text-slate-800">권한 관리</h1>
              <p className="mt-1 text-[13px] font-semibold leading-relaxed text-slate-400">
                현재 세션의 권한을 확인하고, 역할 그룹, 그룹 내 사용자, 그리고 권한 매핑을 편집합니다.
              </p>
            </div>
          </div>

          {/* Compact User Info */}
          <div className="grid gap-4 sm:grid-cols-2 rounded-2xl border border-slate-100 bg-white p-5 shadow-[0_8px_30px_rgba(0,0,0,0.015)]">
            <div>
              <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-slate-400">Current User</p>
              <p className="mt-1 text-lg font-black text-slate-800">{maskUuid(userId) || "알 수 없음"}</p>
            </div>
            <div>
              <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-slate-400">Admin</p>
              <p className="mt-1 text-lg font-black text-slate-800">{hasAdminPermission(permission) ? "허용" : "불가"}</p>
            </div>
          </div>

          {!canEditRoleGroups ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
              역할 그룹 편집과 사용자 관리는 관리자 권한이 있는 계정에서만 가능합니다.
            </div>
          ) : (
            <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr] items-start">
              {/* Left Column: List of Groups and Members of selected group */}
              <div className="space-y-6">
                {/* 역할 그룹 목록 */}
                <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-[0_8px_30px_rgba(0,0,0,0.015)]">
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
                    <div>
                      <h2 className="text-lg font-black tracking-tight text-slate-800">역할 그룹 목록</h2>
                      <p className="mt-0.5 text-[12px] font-semibold text-slate-400">현재 등록된 역할 그룹 목록입니다.</p>
                    </div>
                    <div className="flex gap-2">

                      <button
                        type="button"
                        onClick={resetRoleGroupEditor}
                        disabled={roleGroupSaving}
                        className="rounded-xl border-0 bg-kaist-darkgreen px-3 py-1.5 text-xs font-extrabold text-white transition-all cursor-pointer shadow-sm hover:bg-[#0f5c29] disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        새 역할 그룹
                      </button>
                    </div>
                  </div>

                  <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
                    {roleGroupLoading ? (
                      <p className="text-sm text-kaist-grey">역할 그룹을 불러오는 중…</p>
                    ) : roleGroups.length === 0 ? (
                      <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50/40 p-4 text-sm font-semibold text-slate-400">
                        등록된 역할 그룹이 없습니다. 새 역할 그룹을 만들어 시작하세요.
                      </p>
                    ) : (
                      roleGroups.map((roleGroup) => {
                        const isSelected = roleGroup.roleGroupId === selectedRoleGroupId;

                        return (
                          <button
                            key={roleGroup.roleGroupId}
                            type="button"
                            onClick={() => void handleSelectRoleGroup(roleGroup)}
                            className={`w-full rounded-xl border p-4 text-left transition ${
                              isSelected
                                ? "border-kaist-darkgreen bg-kaist-darkgreen/5"
                                : "border-slate-200 bg-white hover:border-kaist-darkgreen/20 hover:bg-kaist-darkgreen/5"
                            }`}
                          >
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <div>
                                <p className="text-sm font-extrabold text-slate-800">
                                  {roleGroup.nameKo}
                                </p>
                              </div>
                              <div className="flex flex-wrap gap-2 text-xs font-semibold">
                                {roleGroup.isSystem && (
                                  <span className="rounded-full bg-amber-100 px-3 py-1 text-amber-800">
                                    system
                                  </span>
                                )}
                                <span className="rounded-full bg-kaist-darkgreen/10 px-3 py-1 text-kaist-darkgreen">
                                  사용자 {roleGroup.userCount}명
                                </span>
                              </div>
                            </div>
                            <p className="mt-2 text-sm leading-6 text-slate-400">
                              {roleGroup.description ?? "설명이 없습니다."}
                            </p>
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {roleGroup.permissionIds.length === 0 ? (
                                <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-400">
                                  권한 없음
                                </span>
                              ) : (
                                roleGroup.permissionIds.map((permissionId) => {
                                  const item = permissionLabelById.get(permissionId);
                                  return (
                                    <span
                                      key={permissionId}
                                      className="rounded-full bg-kaist-darkgreen/8 px-2.5 py-0.5 text-xs font-semibold text-kaist-darkgreen"
                                    >
                                      {item?.nameKo ?? item?.code ?? `#${permissionId}`}
                                    </span>
                                  );
                                })
                              )}
                            </div>
                            <p className="mt-2 text-xs text-slate-400">
                              수정 {formatKoreanDateTime(roleGroup.updatedAt)}
                            </p>
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* 그룹 내 사용자 관리 */}
                <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-[0_8px_30px_rgba(0,0,0,0.015)]">
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
                    <div>
                      <h2 className="text-lg font-black tracking-tight text-slate-800">그룹 내 사용자 관리</h2>
                      <p className="mt-0.5 text-[12px] font-semibold text-slate-400">
                        {selectedRoleGroup ? `"${selectedRoleGroup.nameKo}" 그룹 구성원 설정` : "역할 그룹을 선택해 주세요."}
                      </p>
                    </div>
                  </div>

                  {selectedRoleGroupId === null ? (
                    <p className="py-4 text-sm font-semibold text-slate-400">
                      위 목록에서 역할 그룹을 먼저 선택하시면 사용자 관리 기능이 활성화됩니다.
                    </p>
                  ) : (
                    <div className="space-y-4">
                      <div className="flex gap-2">
                        <input
                          value={memberQuery}
                          onChange={(event) => setMemberQuery(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              event.preventDefault();
                              void handleSearchUsers();
                            }
                          }}
                          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-800 outline-none transition focus:border-kaist-darkgreen focus:ring-2 focus:ring-kaist-darkgreen/10"
                          placeholder="이름 또는 학번으로 검색"
                        />
                        <button
                          type="button"
                          onClick={() => void handleSearchUsers()}
                          disabled={searchLoading}
                          className="rounded-xl border-0 bg-kaist-darkgreen px-4 py-2.5 text-sm font-extrabold text-white transition-all shadow-sm cursor-pointer hover:bg-[#0f5c29] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {searchLoading ? "검색 중" : "검색"}
                        </button>
                      </div>

                      {memberError && (
                        <p className="text-sm font-semibold text-red-600">{memberError}</p>
                      )}

                      <div className="grid gap-4 md:grid-cols-2">
                        {/* 현재 멤버 */}
                        <div className="rounded-xl border border-slate-100 bg-slate-50/40 p-4">
                          <div className="mb-3 flex items-center justify-between gap-3 border-b border-slate-100 pb-2">
                            <h3 className="text-xs font-extrabold text-slate-800">현재 멤버</h3>
                            <span className="text-xs font-semibold text-slate-400">
                              {memberLoading ? "로딩 중" : `${roleGroupMembers.length}명`}
                            </span>
                          </div>

                          {memberLoading ? (
                            <p className="py-2 text-xs font-semibold text-slate-400">멤버를 불러오는 중…</p>
                          ) : roleGroupMembers.length === 0 ? (
                            <p className="py-2 text-xs font-semibold text-slate-400">아직 멤버가 없습니다.</p>
                          ) : (
                            <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1">
                              {roleGroupMembers.map((member) => (
                                <div
                                  key={member.userRoleGroupId}
                                  className="rounded-xl border border-slate-100 bg-white p-3 shadow-[0_4px_18px_rgba(0,0,0,0.03)]"
                                >
                                  <div className="flex items-start justify-between gap-2">
                                    <div>
                                      <p className="text-xs font-extrabold text-slate-800">
                                        {member.nameKo}
                                      </p>
                                      <p className="mt-0.5 text-[10px] leading-relaxed text-slate-400">
                                        {member.stdNo ? `학번: ${member.stdNo}` : maskUuid(member.kaistUid)}<br />{member.email}
                                      </p>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => void handleRemoveMember(member.userId)}
                                      disabled={memberSavingUserId === member.userId}
                                      className="rounded-xl border border-red-100 bg-red-50 px-2 py-1 text-xs font-bold text-red-600 transition-all cursor-pointer hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                      {memberSavingUserId === member.userId ? "대기" : "제거"}
                                    </button>
                                  </div>
                                  <p className="mt-2 text-[10px] text-slate-400">
                                    부여 {formatKoreanDateTime(member.grantedAt)}
                                  </p>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* 검색 결과 */}
                        <div className="rounded-xl border border-slate-100 bg-slate-50/40 p-4">
                          <div className="mb-3 flex items-center justify-between gap-3 border-b border-slate-100 pb-2">
                            <h3 className="text-xs font-extrabold text-slate-800">검색 결과</h3>
                            <span className="text-xs font-semibold text-slate-400">
                              {searchResults.length}명
                            </span>
                          </div>

                          {searchResults.length === 0 ? (
                            <p className="py-2 text-xs font-semibold text-slate-400">
                              검색어를 입력하고 검색해 주세요.
                            </p>
                          ) : (
                            <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1">
                              {searchResults.map((user) => {
                                const alreadyMember = roleGroupMembers.some(
                                  (member) => member.userId === user.userId,
                                );

                                return (
                                  <div key={user.userId} className="rounded-xl border border-slate-100 bg-white p-3 shadow-[0_4px_18px_rgba(0,0,0,0.03)]">
                                    <div className="flex items-start justify-between gap-2">
                                      <div>
                                        <p className="text-xs font-extrabold text-slate-800">
                                          {user.nameKo}
                                        </p>
                                        <p className="mt-0.5 text-[10px] leading-relaxed text-slate-400">
                                          {user.stdNo ? `학번: ${user.stdNo}` : maskUuid(user.kaistUid)}<br />{user.email}
                                        </p>
                                        <p className="mt-1 text-[10px] text-slate-400">
                                          {user.departmentKo ?? "학과 미상"}
                                          {user.academicStatus ? ` · ${user.academicStatus}` : ""}
                                        </p>
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() => void handleAddMember(user)}
                                        disabled={alreadyMember || memberSavingUserId === user.userId}
                                        className="rounded-xl border-0 bg-kaist-darkgreen px-2 py-1 text-xs font-bold text-white transition-all hover:bg-[#0f5c29] disabled:cursor-not-allowed disabled:bg-slate-300"
                                      >
                                        {alreadyMember ? "참여됨" : memberSavingUserId === user.userId ? "대기" : "추가"}
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column: Role Group Form */}
              <div className="sticky top-4 rounded-2xl border border-slate-100 bg-white p-5 shadow-[0_8px_30px_rgba(0,0,0,0.015)]">
                <div className="mb-4 flex items-start justify-between gap-3 border-b border-slate-100 pb-4">
                  <div>
                    <h3 className="text-lg font-black tracking-tight text-slate-800">
                      {selectedRoleGroupId === null ? "새 역할 그룹 생성" : "역할 그룹 정보 수정"}
                    </h3>
                    <p className="mt-0.5 text-[12px] font-semibold text-slate-400">
                      이름을 수정하고, 부여할 권한들을 매핑해 주세요.
                    </p>
                  </div>
                </div>

                <div className="grid gap-4">
                  {/* Single column layout for Form Fields */}
                  <div className="flex flex-col gap-4">
                      <label className="space-y-1.5 text-xs font-semibold text-slate-400">
                      <span>국문 이름</span>
                      <input
                        value={roleGroupForm.nameKo}
                        onChange={(event) =>
                          setRoleGroupForm((prev) => ({
                            ...prev,
                            nameKo: event.target.value,
                          }))
                        }
                          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-800 outline-none transition focus:border-kaist-darkgreen focus:ring-2 focus:ring-kaist-darkgreen/10"
                        placeholder="운영진"
                      />
                    </label>
                      <label className="space-y-1.5 text-xs font-semibold text-slate-400">
                      <span>설명</span>
                      <input
                        value={roleGroupForm.description}
                        onChange={(event) =>
                          setRoleGroupForm((prev) => ({
                            ...prev,
                            description: event.target.value,
                          }))
                        }
                          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-800 outline-none transition focus:border-kaist-darkgreen focus:ring-2 focus:ring-kaist-darkgreen/10"
                        placeholder="설명은 선택 사항입니다."
                      />
                    </label>
                  </div>

                  <div>
                      <div className="mb-3 flex items-center justify-between gap-3 border-b border-slate-100 pb-2">
                        <h4 className="text-xs font-extrabold text-slate-800">
                        권한 목록
                      </h4>
                        <p className="text-xs text-slate-400">
                        선택됨 {selectedPermissionIds.length}개
                      </p>
                    </div>

                    <div className="grid gap-2 max-h-[300px] overflow-y-auto pr-1">
                      {permissions.map((item) => {
                        const active = selectedPermissionIds.includes(item.permissionId);

                        return (
                          <button
                            key={item.permissionId}
                            type="button"
                            onClick={() => togglePermissionId(item.permissionId)}
                            className={`relative rounded-xl border p-3 text-left transition ${
                              active
                                ? "border-kaist-darkgreen bg-kaist-darkgreen/5"
                                : "border-slate-200 bg-white hover:border-kaist-darkgreen/20"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="pr-6 text-xs font-bold text-slate-800">
                                  {item.nameKo}
                                </p>
                                <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                                  {item.code}
                                </p>
                              </div>
                              <input
                                type="checkbox"
                                checked={active}
                                readOnly
                                className="pointer-events-none mt-0.5 h-4 w-4 rounded border-gray-300 text-kaist-darkgreen focus:ring-kaist-darkgreen"
                              />
                            </div>
                            <p className="mt-2 text-[10px] leading-normal text-slate-400">
                              {item.description ?? "설명이 없습니다."}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {roleGroupError && (
                    <p className="text-sm font-semibold text-red-600">{roleGroupError}</p>
                  )}

                  {/* Redesigned delete / save buttons bottom layout */}
                  <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4">
                    <div>
                      {selectedRoleGroupId !== null && (
                        <button
                          type="button"
                          onClick={() => void handleDeleteRoleGroup()}
                          disabled={roleGroupSaving}
                          className="rounded-xl border border-red-100 bg-red-50 px-4 py-2 text-sm font-semibold text-red-600 transition-all cursor-pointer hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          삭제
                        </button>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleSaveRoleGroup()}
                      disabled={roleGroupSaving}
                      className={`rounded-xl border-0 bg-kaist-darkgreen px-6 py-2 text-sm font-extrabold text-white transition-all shadow-sm cursor-pointer hover:bg-[#0f5c29] disabled:cursor-not-allowed disabled:opacity-50 ${
                        selectedRoleGroupId === null ? "ml-auto" : ""
                      }`}
                    >
                      {roleGroupSaving ? "저장 중…" : "저장"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </AuthGuard>
  );
}
