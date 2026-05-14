import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createApiClient } from "@soc/api-client";
import type {
  AdminUserRecord,
  PermissionRecord,
  RoleGroupMemberRecord,
  RoleGroupRecord,
} from "@soc/contracts";
import { formatKoreanDateTime, hasPermission } from "@soc/shared";

import { resolveApiBaseUrl } from "@/lib/api";
import { getAuthSessionSummary } from "@/lib/auth-session";
import {
  PERMISSION_DEFINITIONS,
  getGrantedPermissions,
  hasAdminPermission,
} from "@/lib/permissions";
import { hasPersistedProfile } from "@/lib/require-persisted-profile";

type RoleGroupFormState = {
  code: string;
  description: string;
  nameEn: string;
  nameKo: string;
};

const createEmptyRoleGroupForm = (): RoleGroupFormState => ({
  code: "",
  description: "",
  nameEn: "",
  nameKo: "",
});

export function PermissionPage() {
  const navigate = useNavigate();
  const client = useMemo(() => createApiClient({ baseUrl: resolveApiBaseUrl() }), []);
  const [permission, setPermission] = useState<number>(0);
  const [userId, setUserId] = useState<string | null>(null);
  const [storageMode, setStorageMode] = useState<"temporary" | "persisted" | null>(null);
  const [loading, setLoading] = useState(true);
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
      const session = await getAuthSessionSummary(client);
      if (!hasPersistedProfile(session)) {
        navigate("/login", { replace: true });
        return;
      }

      setPermission(session.permission ?? 0);
      setUserId(session.userId ?? null);
      setStorageMode(session.storageMode);

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

      setLoading(false);
    })();
  }, []);

  const canEditRoleGroups = hasAdminPermission(permission);

  const selectedRoleGroup = roleGroups.find(
    (roleGroup) => roleGroup.roleGroupId === selectedRoleGroupId,
  ) ?? null;

  const grantedPermissions = getGrantedPermissions(permission);

  const resetRoleGroupEditor = () => {
    setSelectedRoleGroupId(null);
    setRoleGroupForm(createEmptyRoleGroupForm());
    setSelectedPermissionIds([]);
  };

  const openRoleGroupEditor = (roleGroup: RoleGroupRecord) => {
    setSelectedRoleGroupId(roleGroup.roleGroupId);
    setRoleGroupForm({
      code: roleGroup.code,
      description: roleGroup.description ?? "",
      nameEn: roleGroup.nameEn ?? "",
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

    if (!roleGroupForm.code.trim() || !roleGroupForm.nameKo.trim()) {
      setRoleGroupError("역할 그룹 코드와 국문 이름은 필수입니다.");
      return;
    }

    setRoleGroupSaving(true);
    setRoleGroupError(null);

    try {
      const payload = {
        code: roleGroupForm.code.trim(),
        description: roleGroupForm.description.trim() || undefined,
        nameEn: roleGroupForm.nameEn.trim() || undefined,
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
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-10 md:px-8">
        <section className="overflow-hidden rounded-3xl border border-kaist-darkgreen/10 bg-white shadow-[0_20px_60px_rgba(11,31,18,0.08)]">
          <div className="grid gap-6 p-6 md:grid-cols-[1.35fr_0.9fr] md:p-8">
            <div className="space-y-4">
              <p className="text-xs font-extrabold uppercase tracking-[0.28em] text-kaist-greygreen">
                Permission Console
              </p>
              <h1 className="text-3xl font-black tracking-tight md:text-4xl">
                권한 관리
              </h1>
              <p className="max-w-2xl text-sm leading-7 text-kaist-grey md:text-base">
                현재 세션의 권한 비트를 확인하고, 관리자 계정에서는 역할 그룹,
                그룹 내 사용자, 그리고 권한 매핑을 함께 편집할 수 있습니다.
              </p>

              <div className="flex flex-wrap gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => navigate("/")}
                  className="rounded-full border border-kaist-darkgreen/30 px-5 py-3 text-sm font-extrabold text-kaist-darkgreen transition hover:bg-kaist-darkgreen/6"
                >
                  홈으로 돌아가기
                </button>
              </div>
            </div>

            <div className="grid gap-3 rounded-2xl bg-kaist-darkgreen/5 p-5 md:p-6">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-kaist-greygreen">
                  Current User
                </p>
                <p className="mt-2 text-lg font-extrabold">
                  {userId ?? "알 수 없음"}
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl bg-white p-4 shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-kaist-greygreen">
                    Storage
                  </p>
                  <p className="mt-2 text-base font-bold">
                    {storageMode ?? "미확인"}
                  </p>
                </div>
                <div className="rounded-2xl bg-white p-4 shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-kaist-greygreen">
                    Admin
                  </p>
                  <p className="mt-2 text-base font-bold">
                    {hasAdminPermission(permission) ? "허용" : "불가"}
                  </p>
                </div>
              </div>
              <div className="rounded-2xl bg-white p-4 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-kaist-greygreen">
                  Permission Mask
                </p>
                <p className="mt-2 text-2xl font-black tracking-tight">
                  {permission}
                </p>
                <p className="mt-1 text-xs text-kaist-grey">
                  binary: {permission.toString(2).padStart(8, "0")}
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {PERMISSION_DEFINITIONS.map((item) => {
            const granted = hasPermission(permission, item.bit);
            return (
              <article
                key={item.key}
                className={`rounded-2xl border p-5 shadow-sm transition ${
                  granted
                    ? "border-kaist-darkgreen/20 bg-kaist-darkgreen/5"
                    : "border-kaist-grey/20 bg-white"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-extrabold text-kaist-darkgreen">
                      {item.label}
                    </p>
                    <p className="mt-1 text-xs font-semibold uppercase tracking-[0.18em] text-kaist-greygreen">
                      {item.key}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-extrabold ${
                      granted
                        ? "bg-kaist-darkgreen text-kaist-white"
                        : "bg-kaist-grey/10 text-kaist-grey"
                    }`}
                  >
                    bit {item.bit}
                  </span>
                </div>
                <p className="mt-4 text-sm leading-6 text-kaist-grey">
                  {item.description}
                </p>
              </article>
            );
          })}
        </section>

        <section className="rounded-2xl border border-kaist-grey/20 bg-white p-5 shadow-sm md:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-extrabold tracking-tight">
                역할 그룹 관리
              </h2>
              <p className="mt-1 text-sm text-kaist-grey">
                관리자 권한이 있는 계정에서 역할 그룹 이름, 권한 매핑, 그룹 내 사용자를 관리할 수 있습니다.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void refreshRoleGroups()}
                disabled={!canEditRoleGroups || roleGroupLoading || roleGroupSaving}
                className="rounded-full border border-kaist-darkgreen/20 px-4 py-2 text-sm font-semibold text-kaist-darkgreen transition hover:bg-kaist-darkgreen/6 disabled:cursor-not-allowed disabled:opacity-50"
              >
                새로고침
              </button>
              <button
                type="button"
                onClick={resetRoleGroupEditor}
                disabled={!canEditRoleGroups || roleGroupSaving}
                className="rounded-full bg-kaist-darkgreen px-4 py-2 text-sm font-semibold text-kaist-white transition hover:bg-kaist-darkgreen2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                새 역할 그룹
              </button>
            </div>
          </div>

          {!canEditRoleGroups ? (
            <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
              역할 그룹 편집과 사용자 관리는 관리자 권한이 있는 계정에서만 가능합니다.
            </div>
          ) : (
            <div className="mt-6 grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
              <div className="space-y-3">
                {roleGroupLoading ? (
                  <p className="text-sm text-kaist-grey">역할 그룹을 불러오는 중…</p>
                ) : roleGroups.length === 0 ? (
                  <p className="rounded-2xl border border-dashed border-kaist-grey/30 bg-kaist-grey/5 p-4 text-sm text-kaist-grey">
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
                        className={`w-full rounded-2xl border p-4 text-left transition ${
                          isSelected
                            ? "border-kaist-darkgreen bg-kaist-darkgreen/5"
                            : "border-kaist-grey/20 bg-white hover:border-kaist-darkgreen/20 hover:bg-kaist-darkgreen/4"
                        }`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-extrabold text-kaist-darkgreen">
                              {roleGroup.nameKo}
                            </p>
                            <p className="mt-1 text-xs font-semibold uppercase tracking-[0.18em] text-kaist-greygreen">
                              {roleGroup.code}
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
                        <p className="mt-3 text-sm leading-6 text-kaist-grey">
                          {roleGroup.description ?? "설명이 없습니다."}
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {roleGroup.permissionIds.length === 0 ? (
                            <span className="rounded-full bg-kaist-grey/10 px-3 py-1 text-xs font-semibold text-kaist-grey">
                              권한 없음
                            </span>
                          ) : (
                            roleGroup.permissionIds.map((permissionId) => {
                              const item = permissionLabelById.get(permissionId);
                              return (
                                <span
                                  key={permissionId}
                                  className="rounded-full bg-kaist-darkgreen/8 px-3 py-1 text-xs font-semibold text-kaist-darkgreen"
                                >
                                  {item?.nameKo ?? item?.code ?? `#${permissionId}`}
                                </span>
                              );
                            })
                          )}
                        </div>
                        <p className="mt-3 text-xs text-kaist-greygreen">
                          수정 {formatKoreanDateTime(roleGroup.updatedAt)}
                        </p>
                      </button>
                    );
                  })
                )}
              </div>

              <div className="rounded-2xl border border-kaist-grey/20 bg-kaist-grey/5 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-extrabold tracking-tight">
                      {selectedRoleGroupId === null ? "새 역할 그룹" : "역할 그룹 수정"}
                    </h3>
                    <p className="mt-1 text-sm text-kaist-grey">
                      코드와 이름을 수정하고, 아래 권한 목록에서 매핑을 선택하세요.
                    </p>
                  </div>
                  {selectedRoleGroupId !== null && (
                    <button
                      type="button"
                      onClick={resetRoleGroupEditor}
                      className="rounded-full border border-kaist-darkgreen/20 px-3 py-1.5 text-xs font-semibold text-kaist-darkgreen transition hover:bg-kaist-darkgreen/6"
                    >
                      새로 작성
                    </button>
                  )}
                </div>

                <div className="mt-5 grid gap-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="space-y-2 text-sm font-semibold text-kaist-darkgreen">
                      <span>코드</span>
                      <input
                        value={roleGroupForm.code}
                        onChange={(event) =>
                          setRoleGroupForm((prev) => ({
                            ...prev,
                            code: event.target.value,
                          }))
                        }
                        className="w-full rounded-2xl border border-kaist-grey/20 bg-white px-4 py-3 text-sm outline-none transition focus:border-kaist-darkgreen"
                        placeholder="staff"
                      />
                    </label>
                    <label className="space-y-2 text-sm font-semibold text-kaist-darkgreen">
                      <span>국문 이름</span>
                      <input
                        value={roleGroupForm.nameKo}
                        onChange={(event) =>
                          setRoleGroupForm((prev) => ({
                            ...prev,
                            nameKo: event.target.value,
                          }))
                        }
                        className="w-full rounded-2xl border border-kaist-grey/20 bg-white px-4 py-3 text-sm outline-none transition focus:border-kaist-darkgreen"
                        placeholder="운영진"
                      />
                    </label>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="space-y-2 text-sm font-semibold text-kaist-darkgreen">
                      <span>영문 이름</span>
                      <input
                        value={roleGroupForm.nameEn}
                        onChange={(event) =>
                          setRoleGroupForm((prev) => ({
                            ...prev,
                            nameEn: event.target.value,
                          }))
                        }
                        className="w-full rounded-2xl border border-kaist-grey/20 bg-white px-4 py-3 text-sm outline-none transition focus:border-kaist-darkgreen"
                        placeholder="Operating Team"
                      />
                    </label>
                    <label className="space-y-2 text-sm font-semibold text-kaist-darkgreen">
                      <span>설명</span>
                      <input
                        value={roleGroupForm.description}
                        onChange={(event) =>
                          setRoleGroupForm((prev) => ({
                            ...prev,
                            description: event.target.value,
                          }))
                        }
                        className="w-full rounded-2xl border border-kaist-grey/20 bg-white px-4 py-3 text-sm outline-none transition focus:border-kaist-darkgreen"
                        placeholder="설명은 선택 사항입니다."
                      />
                    </label>
                  </div>

                  <div>
                    <div className="flex items-center justify-between gap-3">
                      <h4 className="text-sm font-extrabold text-kaist-darkgreen">
                        권한 목록
                      </h4>
                      <p className="text-xs text-kaist-greygreen">
                        선택된 권한 {selectedPermissionIds.length}개
                      </p>
                    </div>

                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                      {permissions.map((item) => {
                        const active = selectedPermissionIds.includes(item.permissionId);

                        return (
                          <button
                            key={item.permissionId}
                            type="button"
                            onClick={() => togglePermissionId(item.permissionId)}
                            className={`rounded-2xl border p-4 text-left transition ${
                              active
                                ? "border-kaist-darkgreen bg-kaist-darkgreen/6"
                                : "border-kaist-grey/20 bg-white hover:border-kaist-darkgreen/20"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="text-sm font-bold text-kaist-darkgreen">
                                  {item.nameKo}
                                </p>
                                <p className="mt-1 text-xs font-semibold uppercase tracking-[0.18em] text-kaist-greygreen">
                                  {item.code}
                                </p>
                              </div>
                              <span className="rounded-full bg-kaist-grey/10 px-2 py-1 text-xs font-semibold text-kaist-grey">
                                bit {item.bitValue}
                              </span>
                            </div>
                            <p className="mt-3 text-xs leading-5 text-kaist-grey">
                              {item.description ?? "설명이 없습니다."}
                            </p>
                            <p className="mt-3 text-xs font-semibold text-kaist-darkgreen">
                              {active ? "선택됨" : "미선택"}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
                    {selectedRoleGroupId !== null && (
                      <button
                        type="button"
                        onClick={() => void handleDeleteRoleGroup()}
                        disabled={roleGroupSaving}
                        className="rounded-full border border-red-200 px-5 py-3 text-sm font-extrabold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        삭제
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => void handleSaveRoleGroup()}
                      disabled={roleGroupSaving}
                      className="rounded-full bg-kaist-darkgreen px-5 py-3 text-sm font-extrabold text-kaist-white transition hover:bg-kaist-darkgreen2 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {roleGroupSaving ? "저장 중…" : "저장"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {roleGroupError && (
            <p className="mt-4 text-sm font-semibold text-red-600">{roleGroupError}</p>
          )}
        </section>

        <section className="rounded-2xl border border-kaist-grey/20 bg-white p-5 shadow-sm md:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-extrabold tracking-tight">
                그룹 내 사용자 관리
              </h2>
              <p className="mt-1 text-sm text-kaist-grey">
                선택한 역할 그룹에 사용자를 추가하거나 제거할 수 있습니다.
              </p>
            </div>
            <div className="rounded-full bg-kaist-darkgreen/6 px-4 py-2 text-sm font-semibold text-kaist-darkgreen">
              {selectedRoleGroup ? selectedRoleGroup.nameKo : "그룹 미선택"}
            </div>
          </div>

          {selectedRoleGroupId === null ? (
            <p className="mt-6 text-sm text-kaist-grey">
              먼저 왼쪽에서 역할 그룹을 선택하세요.
            </p>
          ) : (
            <div className="mt-6 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
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
                    className="w-full rounded-2xl border border-kaist-grey/20 bg-white px-4 py-3 text-sm outline-none transition focus:border-kaist-darkgreen"
                    placeholder="이름, KAIST UID, 이메일로 검색"
                  />
                  <button
                    type="button"
                    onClick={() => void handleSearchUsers()}
                    disabled={searchLoading}
                    className="rounded-2xl bg-kaist-darkgreen px-4 py-3 text-sm font-semibold text-kaist-white transition hover:bg-kaist-darkgreen2 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {searchLoading ? "검색 중" : "검색"}
                  </button>
                </div>

                {memberError && (
                  <p className="text-sm font-semibold text-red-600">{memberError}</p>
                )}

                <div className="rounded-2xl border border-kaist-grey/20 bg-kaist-grey/5 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-sm font-extrabold text-kaist-darkgreen">현재 멤버</h3>
                    <span className="text-xs font-semibold text-kaist-greygreen">
                      {memberLoading ? "불러오는 중" : `${roleGroupMembers.length}명`}
                    </span>
                  </div>

                  {memberLoading ? (
                    <p className="mt-4 text-sm text-kaist-grey">멤버를 불러오는 중…</p>
                  ) : roleGroupMembers.length === 0 ? (
                    <p className="mt-4 text-sm text-kaist-grey">아직 멤버가 없습니다.</p>
                  ) : (
                    <div className="mt-4 space-y-3">
                      {roleGroupMembers.map((member) => (
                        <div
                          key={member.userRoleGroupId}
                          className="rounded-2xl border border-kaist-grey/20 bg-white p-4"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-extrabold text-kaist-darkgreen">
                                {member.nameKo}
                              </p>
                              <p className="mt-1 text-xs text-kaist-greygreen">
                                {member.kaistUid} · {member.email}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => void handleRemoveMember(member.userId)}
                              disabled={memberSavingUserId === member.userId}
                              className="rounded-full border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {memberSavingUserId === member.userId ? "처리 중" : "제거"}
                            </button>
                          </div>
                          <p className="mt-3 text-xs text-kaist-grey">
                            부여 {formatKoreanDateTime(member.grantedAt)}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-kaist-grey/20 bg-kaist-grey/5 p-4">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-sm font-extrabold text-kaist-darkgreen">검색 결과</h3>
                  <span className="text-xs font-semibold text-kaist-greygreen">
                    {searchResults.length}명
                  </span>
                </div>

                {searchResults.length === 0 ? (
                  <p className="mt-4 text-sm text-kaist-grey">
                    검색어를 입력하고 검색 버튼을 누르면 사용자를 찾을 수 있습니다.
                  </p>
                ) : (
                  <div className="mt-4 grid gap-3">
                    {searchResults.map((user) => {
                      const alreadyMember = roleGroupMembers.some(
                        (member) => member.userId === user.userId,
                      );

                      return (
                        <div key={user.userId} className="rounded-2xl border border-white bg-white p-4 shadow-sm">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-extrabold text-kaist-darkgreen">
                                {user.nameKo}
                              </p>
                              <p className="mt-1 text-xs text-kaist-greygreen">
                                {user.kaistUid} · {user.email}
                              </p>
                              <p className="mt-2 text-xs text-kaist-grey">
                                {user.departmentKo ?? "학과 미상"}
                                {user.academicStatus ? ` · ${user.academicStatus}` : ""}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => void handleAddMember(user)}
                              disabled={alreadyMember || memberSavingUserId === user.userId}
                              className="rounded-full bg-kaist-darkgreen px-3 py-1.5 text-xs font-semibold text-kaist-white transition hover:bg-kaist-darkgreen2 disabled:cursor-not-allowed disabled:bg-kaist-grey"
                            >
                              {alreadyMember ? "이미 멤버" : memberSavingUserId === user.userId ? "추가 중" : "추가"}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-kaist-grey/20 bg-white p-5 shadow-sm md:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-extrabold tracking-tight">
                현재 활성 권한
              </h2>
              <p className="mt-1 text-sm text-kaist-grey">
                세션에 부여된 권한만 표시합니다.
              </p>
            </div>
            <div className="rounded-full bg-kaist-darkgreen/6 px-4 py-2 text-sm font-semibold text-kaist-darkgreen">
              {grantedPermissions.length}개 활성
            </div>
          </div>

          {loading ? (
            <p className="mt-6 text-sm text-kaist-grey">불러오는 중…</p>
          ) : grantedPermissions.length === 0 ? (
            <p className="mt-6 text-sm text-kaist-grey">
              현재 세션에는 활성화된 권한이 없습니다.
            </p>
          ) : (
            <div className="mt-6 flex flex-wrap gap-3">
              {grantedPermissions.map((item) => (
                <span
                  key={item.code}
                  className="rounded-full border border-kaist-darkgreen/20 bg-kaist-darkgreen/5 px-4 py-2 text-sm font-semibold text-kaist-darkgreen"
                >
                  {item.labelKo}
                </span>
              ))}
            </div>
          )}
        </section>
      </main>
  );
}
