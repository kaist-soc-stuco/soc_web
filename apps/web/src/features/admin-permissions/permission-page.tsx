import { ApiClientHttpError, createApiClient } from "@soc/api-client";
import type { PermissionRecord, RoleGroupCandidateListResponse, RoleGroupMemberRecord, RoleGroupRecord } from "@soc/contracts";
import { isoToDate } from "@soc/shared";
import { Pencil, Plus, ShieldCheck, Trash2, UserPlus, Users } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { AuthGuard } from "@/components/guards/auth-guard";
import { AdminDataTable, AdminTableBody, AdminTableCell, AdminTableEmpty, AdminTableHead, AdminTableHeader } from "@/components/ui/admin-data-table";
import { AdminCard, AdminCardHeader, AdminFormField, AdminMetaText, AdminPageHeader, AdminPageMain, AdminPageShell, AdminSearchField, AdminSectionTitle, AdminToolbar, AdminToolbarGroup } from "@/components/ui/admin-page";
import { AdminStatusBadge } from "@/components/ui/admin-status-badge";
import { Button } from "@/components/ui/button";
import { useConfirmDialog } from "@/components/ui/confirm-dialog";
import { UiInput } from "@/components/ui/form-control";
import { Modal } from "@/components/ui/modal";
import { Pagination } from "@/components/ui/pagination";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Skeleton } from "@/components/ui/skeleton";
import { resolveApiBaseUrl } from "@/lib/api-base-url";
import { Permissions } from "@/lib/permissions";
import { cn } from "@/lib/utils";

type DetailTab = "permissions" | "members";

interface RoleDraft {
  description: string;
  nameKo: string;
  permissionIds: number[];
}

const CANDIDATE_PAGE_SIZE = 20;
const permissionDomains = [
  { id: "content", label: "콘텐츠", codes: ["WRITE_NOTICE", "WRITE_GENERAL", "WRITE_REPLY", "MANAGE_CONTENT"] },
  { id: "operations", label: "운영", codes: ["MANAGE_SURVEY", "MANAGE_FINANCE", "MANAGE_TOOL"] },
  { id: "system", label: "시스템", codes: ["MODERATOR", "ADMIN"] },
] as const;

const permissionLabels: Record<string, string> = {
  WRITE_NOTICE: "공지·행사 작성",
  WRITE_GENERAL: "일반 게시판 작성",
  WRITE_REPLY: "공식 답변 관리",
  MANAGE_SURVEY: "설문조사 관리",
  MANAGE_FINANCE: "학생회비 관리",
  MANAGE_CONTENT: "운영 콘텐츠 관리",
  MANAGE_TOOL: "운영 도구 관리",
  MODERATOR: "게시글·댓글 관리",
  ADMIN: "권한 및 관리자 설정",
};

const emptyRoleDraft = (): RoleDraft => ({ description: "", nameKo: "", permissionIds: [] });
const draftFromRole = (role: RoleGroupRecord): RoleDraft => ({ description: role.description ?? "", nameKo: role.nameKo, permissionIds: [...role.permissionIds] });
const sameIds = (left: number[], right: number[]) => left.length === right.length && left.every((id) => right.includes(id));

const formatDate = (value?: string | null) => {
  if (!value) return "—";
  const date = isoToDate(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit" }).format(date).replace(/\. /g, ".").replace(/\.$/, "");
};

const displayError = (error: unknown, fallback: string) => {
  if (error instanceof ApiClientHttpError) {
    if (error.status === 401) return "로그인이 만료되었습니다. 다시 로그인해 주세요.";
    if (error.status === 403) return "이 작업을 수행할 권한이 없습니다.";
  }
  return fallback;
};

export function PermissionPage() {
  const client = useMemo(() => createApiClient({ baseUrl: resolveApiBaseUrl() }), []);
  const [searchParams, setSearchParams] = useSearchParams();
  const { confirm, ConfirmDialog } = useConfirmDialog();
  const [roles, setRoles] = useState<RoleGroupRecord[]>([]);
  const [permissions, setPermissions] = useState<PermissionRecord[]>([]);
  const [members, setMembers] = useState<RoleGroupMemberRecord[]>([]);
  const [draft, setDraft] = useState<RoleDraft>(emptyRoleDraft());
  const [roleQuery, setRoleQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [membersLoading, setMembersLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [createDraft, setCreateDraft] = useState<RoleDraft>(emptyRoleDraft());
  const [memberEditorOpen, setMemberEditorOpen] = useState(false);
  const [candidateData, setCandidateData] = useState<RoleGroupCandidateListResponse | null>(null);
  const [candidateQuery, setCandidateQuery] = useState("");
  const [candidatePage, setCandidatePage] = useState(1);
  const [candidateLoading, setCandidateLoading] = useState(false);
  const [candidateSaving, setCandidateSaving] = useState(false);
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [editingField, setEditingField] = useState<"name" | "description" | null>(null);
  const candidateRequestIdRef = useRef(0);

  const selectedRoleId = Number(searchParams.get("role")) || roles[0]?.roleGroupId || null;
  const selectedRole = roles.find((role) => role.roleGroupId === selectedRoleId) ?? null;
  const selectedTab: DetailTab = searchParams.get("tab") === "members" ? "members" : "permissions";
  const isDirty = Boolean(selectedRole && (draft.nameKo !== selectedRole.nameKo || draft.description !== (selectedRole.description ?? "") || !sameIds(draft.permissionIds, selectedRole.permissionIds)));

  const filteredRoles = useMemo(() => {
    const query = roleQuery.trim().toLocaleLowerCase("ko-KR");
    if (!query) return roles;
    return roles.filter((role) => `${role.nameKo} ${role.description ?? ""}`.toLocaleLowerCase("ko-KR").includes(query));
  }, [roleQuery, roles]);

  const groupedPermissions = useMemo(() => {
    const claimed = new Set<string>(permissionDomains.flatMap((domain) => [...domain.codes]));
    const groups = permissionDomains.map((domain) => ({ ...domain, permissions: permissions.filter((permission) => domain.codes.some((code) => code === permission.code)) }));
    const other = permissions.filter((permission) => !claimed.has(permission.code));
    return other.length ? [...groups, { id: "other", label: "기타", codes: [] as string[], permissions: other }] : groups;
  }, [permissions]);

  const setSelection = useCallback((roleId: number, tab: DetailTab = selectedTab) => {
    setSearchParams({ role: String(roleId), tab }, { replace: true });
  }, [selectedTab, setSearchParams]);

  const loadBase = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [nextRoles, nextPermissions] = await Promise.all([client.listRoleGroups(), client.listPermissions()]);
      setRoles(nextRoles);
      setPermissions(nextPermissions.filter((permission) => permission.isActive));
      const requestedId = Number(searchParams.get("role"));
      const nextSelected = nextRoles.find((role) => role.roleGroupId === requestedId) ?? nextRoles[0] ?? null;
      if (nextSelected) {
        setDraft(draftFromRole(nextSelected));
        if (requestedId !== nextSelected.roleGroupId) setSelection(nextSelected.roleGroupId);
      }
    } catch (loadError) {
      setError(displayError(loadError, "역할과 권한 정보를 불러오지 못했습니다."));
    } finally {
      setLoading(false);
    }
  }, [client, searchParams, setSelection]);

  const loadMembers = useCallback(async (roleId: number) => {
    setMembersLoading(true);
    setError(null);
    try {
      setMembers(await client.listRoleGroupMembers(roleId));
    } catch (loadError) {
      setError(displayError(loadError, "구성원 정보를 불러오지 못했습니다."));
      setMembers([]);
    } finally {
      setMembersLoading(false);
    }
  }, [client]);

  useEffect(() => { void loadBase(); }, []);
  useEffect(() => {
    if (!selectedRole) return;
    setDraft(draftFromRole(selectedRole));
    setEditingField(null);
  }, [selectedRole?.roleGroupId]);
  useEffect(() => {
    if (!selectedRole || selectedTab !== "members") return;
    void loadMembers(selectedRole.roleGroupId);
  }, [selectedRole?.roleGroupId, selectedTab]);

  const selectRole = async (role: RoleGroupRecord) => {
    if (role.roleGroupId === selectedRoleId) return;
    if (isDirty) {
      const discard = await confirm({ title: "저장하지 않은 변경 사항을 버릴까요?", confirmLabel: "변경 사항 버리기", tone: "danger" });
      if (!discard) return;
    }
    setSelection(role.roleGroupId);
  };

  const saveRole = async () => {
    if (!selectedRole || !isDirty) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await client.updateRoleGroup(selectedRole.roleGroupId, { nameKo: draft.nameKo.trim(), description: draft.description.trim(), permissionIds: draft.permissionIds });
      setRoles((current) => current.map((role) => role.roleGroupId === updated.roleGroupId ? updated : role));
      setDraft(draftFromRole(updated));
    } catch (saveError) {
      setError(displayError(saveError, "역할 변경 사항을 저장하지 못했습니다."));
    } finally {
      setSaving(false);
    }
  };

  const createRole = async () => {
    if (!createDraft.nameKo.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const created = await client.createRoleGroup({ nameKo: createDraft.nameKo.trim(), description: createDraft.description.trim(), permissionIds: [] });
      setRoles((current) => [...current, created]);
      setCreateDraft(emptyRoleDraft());
      setCreateOpen(false);
      setSelection(created.roleGroupId);
    } catch (createError) {
      setError(displayError(createError, "역할을 만들지 못했습니다."));
    } finally {
      setSaving(false);
    }
  };

  const deleteRole = async () => {
    if (!selectedRole || selectedRole.isSystem) return;
    const approved = await confirm({ title: `‘${selectedRole.nameKo}’ 역할을 삭제할까요?`, confirmLabel: "역할 삭제", tone: "danger" });
    if (!approved) return;
    setSaving(true);
    try {
      await client.deleteRoleGroup(selectedRole.roleGroupId);
      const remaining = roles.filter((role) => role.roleGroupId !== selectedRole.roleGroupId);
      setRoles(remaining);
      if (remaining[0]) setSelection(remaining[0].roleGroupId);
    } catch (deleteError) {
      setError(displayError(deleteError, "역할을 삭제하지 못했습니다."));
    } finally {
      setSaving(false);
    }
  };

  const togglePermission = (permissionId: number) => setDraft((current) => ({ ...current, permissionIds: current.permissionIds.includes(permissionId) ? current.permissionIds.filter((id) => id !== permissionId) : [...current.permissionIds, permissionId] }));
  const togglePermissionGroup = (permissionIds: number[]) => {
    const allSelected = permissionIds.every((id) => draft.permissionIds.includes(id));
    setDraft((current) => ({ ...current, permissionIds: allSelected ? current.permissionIds.filter((id) => !permissionIds.includes(id)) : [...new Set([...current.permissionIds, ...permissionIds])] }));
  };

  const loadCandidates = useCallback(async (roleId: number, page = 1, query = candidateQuery) => {
    const requestId = ++candidateRequestIdRef.current;
    setCandidateLoading(true);
    setError(null);
    try {
      const data = await client.listRoleGroupCandidates(roleId, { q: query, page, pageSize: CANDIDATE_PAGE_SIZE });
      if (requestId !== candidateRequestIdRef.current) return;
      setCandidateData(data);
      setCandidatePage(page);
    } catch (candidateError) {
      if (requestId === candidateRequestIdRef.current) setError(displayError(candidateError, "구성원 후보를 불러오지 못했습니다."));
    } finally {
      if (requestId === candidateRequestIdRef.current) setCandidateLoading(false);
    }
  }, [candidateQuery, client]);

  useEffect(() => {
    if (!memberEditorOpen || !selectedRole) return;
    const timer = window.setTimeout(() => {
      void loadCandidates(selectedRole.roleGroupId, 1, candidateQuery);
    }, 220);
    return () => window.clearTimeout(timer);
  }, [candidateQuery, loadCandidates, memberEditorOpen, selectedRole?.roleGroupId]);

  const openMemberEditor = async () => {
    if (!selectedRole) return;
    try {
      const currentMembers = await client.listRoleGroupMembers(selectedRole.roleGroupId);
      setMembers(currentMembers);
      setSelectedMemberIds(currentMembers.map((member) => member.userId));
    } catch (memberError) {
      setError(displayError(memberError, "현재 구성원을 불러오지 못했습니다."));
      return;
    }
    setCandidateQuery("");
    setCandidateData(null);
    setCandidateLoading(true);
    setCandidatePage(1);
    setMemberEditorOpen(true);
  };

  const saveMembers = async () => {
    if (!selectedRole) return;
    setCandidateSaving(true);
    setError(null);
    try {
      const updatedMembers = await client.replaceRoleGroupMembers(selectedRole.roleGroupId, { userIds: selectedMemberIds });
      setMembers(updatedMembers);
      setRoles((current) => current.map((role) => role.roleGroupId === selectedRole.roleGroupId ? { ...role, userCount: updatedMembers.length } : role));
      setMemberEditorOpen(false);
    } catch (memberError) {
      setError(displayError(memberError, "구성원 변경 사항을 저장하지 못했습니다."));
    } finally {
      setCandidateSaving(false);
    }
  };

  return (
    <AuthGuard requirePermission={Permissions.ADMIN}>
      <AdminPageShell>
        {ConfirmDialog}
        <AdminPageMain>
          <AdminPageHeader title="권한 관리" actions={<Button type="button" onClick={() => setCreateOpen(true)}><Plus aria-hidden="true" /> 역할 추가</Button>} />
          {error ? <div role="alert" className="rounded-lg border border-rose-200 bg-white px-4 py-3 text-sm font-normal text-rose-700">{error}</div> : null}

          <div className="grid min-h-[640px] gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
            <AdminCard className="self-start lg:sticky lg:top-6">
              <AdminCardHeader>
                <div><AdminSectionTitle>역할</AdminSectionTitle><AdminMetaText>전체 {roles.length}개</AdminMetaText></div>
              </AdminCardHeader>
              <div className="border-b border-slate-100 p-3"><AdminSearchField aria-label="역할 검색" placeholder="역할 검색" value={roleQuery} onValueChange={setRoleQuery} /></div>
              <div className="scrollbar-hidden max-h-[560px] overflow-y-auto p-2">
                {loading ? <div className="grid gap-1 p-1">{Array.from({ length: 5 }).map((_, index) => <Skeleton key={index} className="h-14 w-full rounded-lg" />)}</div>
                  : filteredRoles.length === 0 ? <p className="px-3 py-10 text-center text-sm font-normal text-[#344054]">검색 결과가 없습니다.</p>
                  : <div className="grid gap-1" role="listbox" aria-label="역할 목록">{filteredRoles.map((role) => {
                      const selected = role.roleGroupId === selectedRoleId;
                      return <Button key={role.roleGroupId} type="button" variant="ghost" role="option" aria-selected={selected} onClick={() => void selectRole(role)} className={cn("relative h-auto min-h-14 w-full rounded-lg px-3 py-2 text-left", selected ? "bg-slate-100 text-[#172033]" : "text-[#344054] hover:bg-slate-50 hover:text-[#172033]")}>
                        <ShieldCheck aria-hidden="true" className="size-4 shrink-0" /><span className="min-w-0 flex-1"><span className="block truncate text-sm !font-semibold text-[#172033]">{role.nameKo}</span><span className="block truncate text-xs font-normal text-[#344054]">{role.description || "설명 없음"}</span></span><span className="shrink-0 text-xs font-normal text-[#344054]">{role.userCount}명</span>
                      </Button>;
                    })}</div>}
              </div>
            </AdminCard>

            {selectedRole ? <AdminCard className="min-w-0">
              <AdminCardHeader className="min-h-[84px] px-5 py-4">
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    {editingField === "name" ? (
                      <UiInput
                        autoFocus
                        value={draft.nameKo}
                        aria-label="역할 이름"
                        className="h-9 max-w-sm text-base !font-semibold text-[#172033]"
                        onChange={(event) => {
                          const value = event.currentTarget.value;
                          setDraft((current) => ({ ...current, nameKo: value }));
                        }}
                        onBlur={() => setEditingField(null)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") setEditingField(null);
                          if (event.key === "Escape") {
                            setDraft((current) => ({ ...current, nameKo: selectedRole.nameKo }));
                            setEditingField(null);
                          }
                        }}
                      />
                    ) : (
                      <button type="button" disabled={selectedRole.isSystem} onClick={() => setEditingField("name")} className="group inline-flex min-w-0 items-center gap-1.5 rounded-md text-left disabled:cursor-default">
                        <AdminSectionTitle className="truncate !font-semibold text-[#172033]">{draft.nameKo}</AdminSectionTitle>
                        {!selectedRole.isSystem ? <Pencil aria-hidden="true" className="size-3.5 text-slate-400 opacity-0 transition-opacity group-hover:opacity-100" /> : null}
                      </button>
                    )}
                    {selectedRole.isSystem ? <AdminStatusBadge>시스템 역할</AdminStatusBadge> : null}
                  </div>
                  {editingField === "description" ? (
                    <UiInput
                      autoFocus
                      value={draft.description}
                      aria-label="역할 설명"
                      className="mt-1 h-9 max-w-xl text-sm font-normal text-[#344054]"
                      placeholder="역할 설명"
                      onChange={(event) => {
                        const value = event.currentTarget.value;
                        setDraft((current) => ({ ...current, description: value }));
                      }}
                      onBlur={() => setEditingField(null)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") setEditingField(null);
                        if (event.key === "Escape") {
                          setDraft((current) => ({ ...current, description: selectedRole.description ?? "" }));
                          setEditingField(null);
                        }
                      }}
                    />
                  ) : (
                    <button type="button" disabled={selectedRole.isSystem} onClick={() => setEditingField("description")} className="group mt-1 inline-flex max-w-full items-center gap-1.5 rounded-md text-left text-xs font-normal text-[#344054] disabled:cursor-default">
                      <span className="truncate">{draft.description || "설명 추가"}</span>
                      {!selectedRole.isSystem ? <Pencil aria-hidden="true" className="size-3 text-slate-400 opacity-0 transition-opacity group-hover:opacity-100" /> : null}
                    </button>
                  )}
                  <AdminMetaText className="mt-1 block text-[#344054]">{selectedRole.userCount}명의 구성원 · {draft.permissionIds.length}개 권한</AdminMetaText>
                  {selectedRole.isSystem ? <AdminMetaText className="mt-1 block text-[#344054]">기본 시스템 역할의 이름과 권한은 변경할 수 없습니다.</AdminMetaText> : null}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {!selectedRole.isSystem ? <Button type="button" size="sm" variant="ghost" className="text-rose-600 hover:bg-rose-50 hover:text-rose-700" onClick={() => void deleteRole()}><Trash2 aria-hidden="true" /> 삭제</Button> : null}
                  <Button type="button" size="sm" variant={isDirty ? "default" : "outline"} onClick={() => void saveRole()} disabled={selectedRole.isSystem || !isDirty || saving || !draft.nameKo.trim()}>{saving ? "저장 중" : "저장"}</Button>
                </div>
              </AdminCardHeader>
              <div className="border-b border-slate-100 px-5 pt-3"><SegmentedControl ariaLabel="역할 상세 탭" role="tablist" value={selectedTab} onChange={(tab) => setSelection(selectedRole.roleGroupId, tab)} className="clean-segmented-control mb-3 w-fit" options={[{ value: "permissions", label: "권한" }, { value: "members", label: `구성원 ${selectedRole.userCount}` }]} /></div>

              {selectedTab === "permissions" ? <div className="p-5">
                <div className="grid items-start gap-4 xl:grid-cols-2">{groupedPermissions.map((group) => {
                  const ids = group.permissions.map((permission) => permission.permissionId);
                  const allSelected = ids.length > 0 && ids.every((id) => draft.permissionIds.includes(id));
                  return <section key={group.id} className="overflow-hidden rounded-lg border border-slate-200 bg-white">
                    <label className="flex min-h-12 cursor-pointer items-center gap-2.5 border-b border-slate-200 px-4">
                      <UiInput type="checkbox" checked={allSelected} disabled={selectedRole.isSystem} onChange={() => togglePermissionGroup(ids)} className="size-4 accent-brand-primary" aria-label={`${group.label} 권한 전체 선택`} />
                      <span className="text-sm font-normal text-[#172033]">{group.label}</span>
                      <span className="ml-auto text-xs font-normal text-[#344054]">{group.permissions.length}개</span>
                    </label>
                    <div className="divide-y divide-slate-100">{group.permissions.map((permission) => {
                      const checked = draft.permissionIds.includes(permission.permissionId);
                      return <label key={permission.permissionId} className="flex cursor-pointer items-start gap-3 px-4 py-3.5 hover:bg-slate-50/70"><UiInput type="checkbox" checked={checked} disabled={selectedRole.isSystem} onChange={() => togglePermission(permission.permissionId)} className="mt-0.5 size-4 accent-brand-primary" /><span className="min-w-0"><span className="block text-sm font-normal text-[#172033]">{permissionLabels[permission.code] ?? permission.nameKo}</span><span className="mt-0.5 block text-xs font-normal leading-5 text-[#344054]">{permission.description || "이 권한이 허용하는 작업을 관리합니다."}</span></span></label>;
                    })}</div>
                  </section>;
                })}</div>
              </div> : <div className="min-w-0">
                <AdminToolbar className="m-5 border-slate-200"><AdminToolbarGroup><Users aria-hidden="true" className="size-4 text-[#344054]" /><span className="text-sm font-normal text-[#344054]">구성원 {members.length}명</span></AdminToolbarGroup><Button type="button" onClick={() => void openMemberEditor()}><UserPlus aria-hidden="true" /> 구성원 편집</Button></AdminToolbar>
                <AdminDataTable minWidth={740}><colgroup><col style={{ width: 220 }} /><col style={{ width: 140 }} /><col style={{ width: 240 }} /><col style={{ width: 140 }} /></colgroup><AdminTableHeader><tr><AdminTableHead>이름</AdminTableHead><AdminTableHead>학번</AdminTableHead><AdminTableHead>이메일</AdminTableHead><AdminTableHead>부여일</AdminTableHead></tr></AdminTableHeader><AdminTableBody>
                  {membersLoading ? Array.from({ length: 4 }).map((_, index) => <tr key={index}>{Array.from({ length: 4 }).map((__, cell) => <AdminTableCell key={cell}><Skeleton className="h-4 w-24" /></AdminTableCell>)}</tr>)
                    : members.length === 0 ? <AdminTableEmpty colSpan={4}>이 역할에 지정된 구성원이 없습니다.</AdminTableEmpty>
                    : members.map((member) => <tr key={member.userId}><AdminTableCell truncate className="admin-table-text-emphasis">{member.nameKo}</AdminTableCell><AdminTableCell truncate>{member.stdNo ?? member.kaistUid}</AdminTableCell><AdminTableCell truncate>{member.email}</AdminTableCell><AdminTableCell truncate>{formatDate(member.grantedAt)}</AdminTableCell></tr>)}
                </AdminTableBody></AdminDataTable>
              </div>}
            </AdminCard> : <AdminCard className="grid min-h-[360px] place-items-center p-8 text-center"><div><ShieldCheck aria-hidden="true" className="mx-auto mb-3 size-8 text-slate-300" /><p className="text-sm font-normal text-[#344054]">선택할 역할이 없습니다.</p></div></AdminCard>}
          </div>
        </AdminPageMain>

        <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="새 역할 만들기" footer={<><Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>취소</Button><Button type="button" onClick={() => void createRole()} disabled={saving || !createDraft.nameKo.trim()}>{saving ? "만드는 중" : "역할 만들기"}</Button></>}>
          <div className="grid gap-4"><AdminFormField label="역할 이름"><UiInput autoFocus value={createDraft.nameKo} onChange={(event) => { const value = event.currentTarget.value; setCreateDraft((current) => ({ ...current, nameKo: value })); }} placeholder="예: 콘텐츠 관리자" /></AdminFormField><AdminFormField label="설명" hint="권한은 역할을 만든 뒤 상세 화면에서 지정합니다."><UiInput value={createDraft.description} onChange={(event) => { const value = event.currentTarget.value; setCreateDraft((current) => ({ ...current, description: value })); }} placeholder="이 역할이 담당하는 업무" /></AdminFormField></div>
        </Modal>

        <Modal open={memberEditorOpen} onClose={() => setMemberEditorOpen(false)} title={selectedRole ? `${selectedRole.nameKo} 구성원 편집` : "구성원 편집"} className="h-[min(720px,calc(100dvh-3rem))] max-w-4xl" bodyClassName="!overflow-hidden flex min-h-0 flex-1 flex-col" footer={<><span className="mr-auto self-center text-sm font-normal text-[#344054]">선택 {selectedMemberIds.length}명</span><Button type="button" variant="outline" onClick={() => setMemberEditorOpen(false)}>취소</Button><Button type="button" onClick={() => void saveMembers()} disabled={candidateSaving}>{candidateSaving ? "적용 중" : "적용"}</Button></>}>
          <div className="flex min-h-0 flex-1 flex-col gap-4">
            <div className="grid shrink-0 gap-1.5"><span className="text-xs font-normal leading-4 text-[#344054]">구성원 검색</span><AdminSearchField aria-label="구성원 검색" value={candidateQuery} onValueChange={setCandidateQuery} placeholder="이름, 학번, 이메일, 소속 검색" /></div>
            <div className={cn("scrollbar-hidden min-h-0 flex-1 overflow-auto rounded-xl border border-slate-200 transition-opacity duration-150", candidateLoading && candidateData ? "opacity-60" : "opacity-100")} aria-busy={candidateLoading}>
              <AdminDataTable minWidth={688}><colgroup><col style={{ width: 48 }} /><col style={{ width: 240 }} /><col style={{ width: 150 }} /><col style={{ width: 250 }} /></colgroup><AdminTableHeader><tr><AdminTableHead className="text-center"><UiInput type="checkbox" aria-label="현재 페이지 전체 선택" checked={Boolean(candidateData?.items.length && candidateData.items.every((item) => selectedMemberIds.includes(item.userId)))} onChange={(event) => { const pageIds = candidateData?.items.map((item) => item.userId) ?? []; const checked = event.currentTarget.checked; setSelectedMemberIds((current) => checked ? [...new Set([...current, ...pageIds])] : current.filter((id) => !pageIds.includes(id))); }} /></AdminTableHead><AdminTableHead>이름</AdminTableHead><AdminTableHead>학번</AdminTableHead><AdminTableHead>이메일</AdminTableHead></tr></AdminTableHeader><AdminTableBody>
              {!candidateData && candidateLoading ? Array.from({ length: 5 }).map((_, index) => <tr key={index}>{Array.from({ length: 4 }).map((__, cell) => <AdminTableCell key={cell}><Skeleton className="h-4 w-20" /></AdminTableCell>)}</tr>)
                : (candidateData?.items.length ?? 0) === 0 ? <AdminTableEmpty colSpan={4}>조건에 맞는 사용자가 없습니다.</AdminTableEmpty>
                : candidateData?.items.map((candidate) => { const checked = selectedMemberIds.includes(candidate.userId); return <tr key={candidate.userId}><AdminTableCell className="text-center"><UiInput type="checkbox" checked={checked} onChange={() => setSelectedMemberIds((current) => checked ? current.filter((id) => id !== candidate.userId) : [...current, candidate.userId])} aria-label={`${candidate.nameKo} 선택`} /></AdminTableCell><AdminTableCell truncate className="admin-table-text-emphasis">{candidate.nameKo}</AdminTableCell><AdminTableCell truncate>{candidate.stdNo ?? candidate.kaistUid}</AdminTableCell><AdminTableCell truncate>{candidate.email}</AdminTableCell></tr>; })}
            </AdminTableBody></AdminDataTable></div>
            <Pagination className="m-0" currentPage={candidatePage} onPageChange={(page) => selectedRole && void loadCandidates(selectedRole.roleGroupId, page)} range={`전체 ${candidateData?.total ?? 0}명`} totalPages={Math.max(1, Math.ceil((candidateData?.total ?? 0) / CANDIDATE_PAGE_SIZE))} />
          </div>
        </Modal>
      </AdminPageShell>
    </AuthGuard>
  );
}
