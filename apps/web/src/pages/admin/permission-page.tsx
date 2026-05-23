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
        <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 md:px-8">
          
          {/* Compact Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-gray-200 pb-5 gap-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-gray-900">권한 관리</h1>
              <p className="mt-1 text-sm text-gray-500">
                현재 세션의 권한을 확인하고, 역할 그룹, 그룹 내 사용자, 그리고 권한 매핑을 편집합니다.
              </p>
            </div>
          </div>

          {/* Compact User Info */}
          <div className="grid gap-4 sm:grid-cols-2 rounded-2xl bg-white border border-gray-200 p-5 shadow-xs">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Current User</p>
              <p className="mt-1 text-lg font-bold text-gray-900">{maskUuid(userId) || "알 수 없음"}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Admin</p>
              <p className="mt-1 text-lg font-bold text-gray-900">{hasAdminPermission(permission) ? "허용" : "불가"}</p>
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
                <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-xs">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 pb-4 mb-4">
                    <div>
                      <h2 className="text-lg font-extrabold tracking-tight">역할 그룹 목록</h2>
                      <p className="mt-0.5 text-xs text-kaist-grey">현재 등록된 역할 그룹 목록입니다.</p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => void refreshRoleGroups()}
                        disabled={roleGroupLoading || roleGroupSaving}
                        className="bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-200 font-bold px-3 py-1.5 text-xs rounded-xl transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        새로고침
                      </button>
                      <button
                        type="button"
                        onClick={resetRoleGroupEditor}
                        disabled={roleGroupSaving}
                        className="bg-kaist-darkgreen hover:bg-kaist-darkgreen/90 text-white font-bold px-3 py-1.5 text-xs rounded-xl transition-all shadow-md shadow-kaist-darkgreen/15 cursor-pointer border-0 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        새 역할 그룹
                      </button>
                    </div>
                  </div>

                  <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
                    {roleGroupLoading ? (
                      <p className="text-sm text-kaist-grey">역할 그룹을 불러오는 중…</p>
                    ) : roleGroups.length === 0 ? (
                      <p className="rounded-xl border border-dashed border-kaist-grey/30 bg-kaist-grey/5 p-4 text-sm text-kaist-grey">
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
                                : "border-gray-200 bg-white hover:border-kaist-darkgreen/20 hover:bg-kaist-darkgreen/5"
                            }`}
                          >
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <div>
                                <p className="text-sm font-extrabold text-kaist-darkgreen">
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
                            <p className="mt-2 text-sm leading-6 text-kaist-grey">
                              {roleGroup.description ?? "설명이 없습니다."}
                            </p>
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {roleGroup.permissionIds.length === 0 ? (
                                <span className="rounded-full bg-kaist-grey/10 px-2.5 py-0.5 text-xs font-semibold text-kaist-grey">
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
                            <p className="mt-2 text-xs text-kaist-greygreen">
                              수정 {formatKoreanDateTime(roleGroup.updatedAt)}
                            </p>
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* 그룹 내 사용자 관리 */}
                <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-xs">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 pb-4 mb-4">
                    <div>
                      <h2 className="text-lg font-extrabold tracking-tight">그룹 내 사용자 관리</h2>
                      <p className="mt-0.5 text-xs text-kaist-grey">
                        {selectedRoleGroup ? `"${selectedRoleGroup.nameKo}" 그룹 구성원 설정` : "역할 그룹을 선택해 주세요."}
                      </p>
                    </div>
                  </div>

                  {selectedRoleGroupId === null ? (
                    <p className="text-sm text-kaist-grey py-4">
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
                          className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-kaist-darkgreen"
                          placeholder="이름 또는 학번으로 검색"
                        />
                        <button
                          type="button"
                          onClick={() => void handleSearchUsers()}
                          disabled={searchLoading}
                          className="bg-kaist-darkgreen hover:bg-kaist-darkgreen/90 text-white font-bold px-4 py-2.5 rounded-xl transition-all shadow-md shadow-kaist-darkgreen/15 cursor-pointer border-0 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {searchLoading ? "검색 중" : "검색"}
                        </button>
                      </div>

                      {memberError && (
                        <p className="text-sm font-semibold text-red-600">{memberError}</p>
                      )}

                      <div className="grid gap-4 md:grid-cols-2">
                        {/* 현재 멤버 */}
                        <div className="rounded-xl bg-gray-50 border border-gray-100 p-4">
                          <div className="flex items-center justify-between gap-3 border-b border-gray-200/60 pb-2 mb-3">
                            <h3 className="text-xs font-bold text-kaist-darkgreen">현재 멤버</h3>
                            <span className="text-xs font-semibold text-kaist-greygreen">
                              {memberLoading ? "로딩 중" : `${roleGroupMembers.length}명`}
                            </span>
                          </div>

                          {memberLoading ? (
                            <p className="text-xs text-kaist-grey py-2">멤버를 불러오는 중…</p>
                          ) : roleGroupMembers.length === 0 ? (
                            <p className="text-xs text-kaist-grey py-2">아직 멤버가 없습니다.</p>
                          ) : (
                            <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1">
                              {roleGroupMembers.map((member) => (
                                <div
                                  key={member.userRoleGroupId}
                                  className="rounded-xl border border-gray-200 bg-white p-3 shadow-xs"
                                >
                                  <div className="flex items-start justify-between gap-2">
                                    <div>
                                      <p className="text-xs font-extrabold text-kaist-darkgreen">
                                        {member.nameKo}
                                      </p>
                                      <p className="mt-0.5 text-[10px] leading-relaxed text-kaist-greygreen">
                                        {member.stdNo ? `학번: ${member.stdNo}` : maskUuid(member.kaistUid)}<br />{member.email}
                                      </p>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => void handleRemoveMember(member.userId)}
                                      disabled={memberSavingUserId === member.userId}
                                      className="bg-red-50 hover:bg-red-100 text-red-600 border border-red-100 font-bold px-2 py-1 text-xs rounded-xl transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                      {memberSavingUserId === member.userId ? "대기" : "제거"}
                                    </button>
                                  </div>
                                  <p className="mt-2 text-[10px] text-kaist-grey">
                                    부여 {formatKoreanDateTime(member.grantedAt)}
                                  </p>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* 검색 결과 */}
                        <div className="rounded-xl bg-gray-50 border border-gray-100 p-4">
                          <div className="flex items-center justify-between gap-3 border-b border-gray-200/60 pb-2 mb-3">
                            <h3 className="text-xs font-bold text-kaist-darkgreen">검색 결과</h3>
                            <span className="text-xs font-semibold text-kaist-greygreen">
                              {searchResults.length}명
                            </span>
                          </div>

                          {searchResults.length === 0 ? (
                            <p className="text-xs text-kaist-grey py-2">
                              검색어를 입력하고 검색해 주세요.
                            </p>
                          ) : (
                            <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1">
                              {searchResults.map((user) => {
                                const alreadyMember = roleGroupMembers.some(
                                  (member) => member.userId === user.userId,
                                );

                                return (
                                  <div key={user.userId} className="rounded-xl border border-gray-200 bg-white p-3 shadow-xs">
                                    <div className="flex items-start justify-between gap-2">
                                      <div>
                                        <p className="text-xs font-extrabold text-kaist-darkgreen">
                                          {user.nameKo}
                                        </p>
                                        <p className="mt-0.5 text-[10px] leading-relaxed text-kaist-greygreen">
                                          {user.stdNo ? `학번: ${user.stdNo}` : maskUuid(user.kaistUid)}<br />{user.email}
                                        </p>
                                        <p className="mt-1 text-[10px] text-kaist-grey">
                                          {user.departmentKo ?? "학과 미상"}
                                          {user.academicStatus ? ` · ${user.academicStatus}` : ""}
                                        </p>
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() => void handleAddMember(user)}
                                        disabled={alreadyMember || memberSavingUserId === user.userId}
                                        className="bg-kaist-darkgreen hover:bg-kaist-darkgreen/90 text-white font-bold px-2 py-1 text-xs rounded-xl transition-all disabled:cursor-not-allowed disabled:bg-kaist-grey"
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
              <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-xs sticky top-4">
                <div className="flex items-start justify-between gap-3 border-b border-gray-100 pb-4 mb-4">
                  <div>
                    <h3 className="text-lg font-extrabold tracking-tight">
                      {selectedRoleGroupId === null ? "새 역할 그룹 생성" : "역할 그룹 정보 수정"}
                    </h3>
                    <p className="mt-0.5 text-xs text-kaist-grey">
                      이름을 수정하고, 부여할 권한들을 매핑해 주세요.
                    </p>
                  </div>
                </div>

                <div className="grid gap-4">
                  {/* Single column layout for Form Fields */}
                  <div className="flex flex-col gap-4">
                    <label className="space-y-1.5 text-xs font-semibold text-kaist-darkgreen">
                      <span>국문 이름</span>
                      <input
                        value={roleGroupForm.nameKo}
                        onChange={(event) =>
                          setRoleGroupForm((prev) => ({
                            ...prev,
                            nameKo: event.target.value,
                          }))
                        }
                        className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-kaist-darkgreen"
                        placeholder="운영진"
                      />
                    </label>
                    <label className="space-y-1.5 text-xs font-semibold text-kaist-darkgreen">
                      <span>설명</span>
                      <input
                        value={roleGroupForm.description}
                        onChange={(event) =>
                          setRoleGroupForm((prev) => ({
                            ...prev,
                            description: event.target.value,
                          }))
                        }
                        className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-kaist-darkgreen"
                        placeholder="설명은 선택 사항입니다."
                      />
                    </label>
                  </div>

                  <div>
                    <div className="flex items-center justify-between gap-3 border-b border-gray-100 pb-2 mb-3">
                      <h4 className="text-xs font-extrabold text-kaist-darkgreen">
                        권한 목록
                      </h4>
                      <p className="text-xs text-kaist-greygreen">
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
                                : "border-gray-200 bg-white hover:border-kaist-darkgreen/20"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="text-xs font-bold text-kaist-darkgreen pr-6">
                                  {item.nameKo}
                                </p>
                                <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-kaist-greygreen">
                                  {item.code}
                                </p>
                              </div>
                              <input
                                type="checkbox"
                                checked={active}
                                readOnly
                                className="w-4 h-4 rounded border-gray-300 text-kaist-darkgreen focus:ring-kaist-darkgreen pointer-events-none mt-0.5"
                              />
                            </div>
                            <p className="mt-2 text-[10px] leading-normal text-kaist-grey">
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
                  <div className="flex items-center justify-between pt-4 border-t border-gray-100 mt-4">
                    <div>
                      {selectedRoleGroupId !== null && (
                        <button
                          type="button"
                          onClick={() => void handleDeleteRoleGroup()}
                          disabled={roleGroupSaving}
                          className="bg-red-50 hover:bg-red-100 text-red-600 border border-red-100 font-semibold px-4 py-2 text-sm rounded-xl transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          삭제
                        </button>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleSaveRoleGroup()}
                      disabled={roleGroupSaving}
                      className={`bg-kaist-darkgreen hover:bg-kaist-darkgreen/90 text-white font-bold px-6 py-2 text-sm rounded-xl transition-all shadow-md shadow-kaist-darkgreen/15 cursor-pointer border-0 disabled:opacity-50 disabled:cursor-not-allowed ${
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
