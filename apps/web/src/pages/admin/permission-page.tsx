import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createApiClient } from "@soc/api-client";
import type { PermissionRecord, RoleGroupRecord } from "@soc/contracts";
import { formatKoreanDateTime, hasPermission } from "@soc/shared";

import { Header } from "@/components/organisms/header";
import { resolveApiBaseUrl } from "@/lib/api";
import { getAuthSessionSummary } from "@/lib/auth-session";
import {
  PERMISSION_DEFINITIONS,
  SURVEY_MANAGE_PERMISSION_BIT,
  getGrantedPermissions,
  hasSurveyManagePermission,
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
  const client = createApiClient({ baseUrl: resolveApiBaseUrl() });
  const [permission, setPermission] = useState<number>(0);
  const [userId, setUserId] = useState<string | null>(null);
  const [storageMode, setStorageMode] = useState<"temporary" | "persisted" | null>(null);
  const [loading, setLoading] = useState(true);
  const [roleGroups, setRoleGroups] = useState<RoleGroupRecord[]>([]);
  const [permissions, setPermissions] = useState<PermissionRecord[]>([]);
  const [selectedRoleGroupId, setSelectedRoleGroupId] = useState<number | null>(null);
  const [roleGroupForm, setRoleGroupForm] = useState<RoleGroupFormState>(
    createEmptyRoleGroupForm(),
  );
  const [selectedPermissionIds, setSelectedPermissionIds] = useState<number[]>([]);
  const [roleGroupLoading, setRoleGroupLoading] = useState(false);
  const [roleGroupSaving, setRoleGroupSaving] = useState(false);
  const [roleGroupError, setRoleGroupError] = useState<string | null>(null);

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

      if (hasSurveyManagePermission(session.permission)) {
        setRoleGroupLoading(true);
        try {
          const [fetchedRoleGroups, fetchedPermissions] = await Promise.all([
            client.listRoleGroups(),
            client.listPermissions(),
          ]);

          setRoleGroups(fetchedRoleGroups);
          setPermissions(fetchedPermissions);

          if (fetchedRoleGroups.length > 0) {
            const first = fetchedRoleGroups[0];
            setSelectedRoleGroupId(first.roleGroupId);
            setRoleGroupForm({
              code: first.code,
              description: first.description ?? "",
              nameEn: first.nameEn ?? "",
              nameKo: first.nameKo,
            });
            setSelectedPermissionIds(first.permissionIds);
          }
        } catch {
          setRoleGroupError("역할 그룹 데이터를 불러오지 못했습니다.");
        } finally {
          setRoleGroupLoading(false);
        }
      }

      setLoading(false);
    })();
  }, []);

  const canEditRoleGroups = hasSurveyManagePermission(permission);

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
    const [fetchedRoleGroups, fetchedPermissions] = await Promise.all([
      client.listRoleGroups(),
      client.listPermissions(),
    ]);

    setRoleGroups(fetchedRoleGroups);
    setPermissions(fetchedPermissions);

    if (selectedRoleGroupId !== null) {
      const selected = fetchedRoleGroups.find(
        (roleGroup) => roleGroup.roleGroupId === selectedRoleGroupId,
      );

      if (selected) {
        openRoleGroupEditor(selected);
        return;
      }
    }

    if (fetchedRoleGroups.length > 0) {
      openRoleGroupEditor(fetchedRoleGroups[0]);
      return;
    }

    resetRoleGroupEditor();
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
    <div className="min-h-screen bg-gradient-to-br from-kaist-white via-[#f4f7f1] to-[#edf4ef] text-kaist-black">
      <Header showLogo />
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
                현재 세션이 가진 권한 비트를 확인하고, 설문 관리 권한이 있는 계정에서는
                역할 그룹과 권한 매핑을 바로 편집할 수 있습니다.
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
                    Survey Manage
                  </p>
                  <p className="mt-2 text-base font-bold">
                    {hasSurveyManagePermission(permission) ? "허용" : "불가"}
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
                역할 그룹 편집
              </h2>
              <p className="mt-1 text-sm text-kaist-grey">
                설문조사 관리 권한이 있는 계정에서 역할 그룹 이름과 권한 매핑을 수정할 수 있습니다.
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
              역할 그룹 편집은 설문조사 관리 권한이 있는 계정에서만 가능합니다.
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
                        onClick={() => openRoleGroupEditor(roleGroup)}
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
                  key={item.key}
                  className="rounded-full border border-kaist-darkgreen/20 bg-kaist-darkgreen/5 px-4 py-2 text-sm font-semibold text-kaist-darkgreen"
                >
                  {item.label}
                </span>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
