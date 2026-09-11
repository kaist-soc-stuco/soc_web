import { useEffect, useState } from "react";
import { nowDate } from "@soc/shared";
import { Search, Trash2, X } from "lucide-react";
import type {
  AdminUserRecord,
  ContactDepartmentRecord,
  ContactRecord,
  ContactActivity,
} from "@soc/contracts";

import { AdminFormField } from "@/components/ui/admin-page";
import { AdminDrawer } from "@/components/ui/admin-drawer";
import { AdminSelectDropdown } from "@/components/ui/admin-select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { UiInput } from "@/components/ui/form-control";
import { IconButton } from "@/components/ui/icon-button";

export interface ExecutiveMemberFormValues {
  portalUserId: string | null;
  activities: ContactActivity[];
  nameKo: string;
  nameEn: string;
  studentNumber: string;
  email: string;
  phoneNumber: string;
}

interface ExecutiveMemberModalProps {
  contact: ContactRecord | null;
  departments: ContactDepartmentRecord[];
  onClose: () => void;
  onDelete?: () => void | Promise<void>;
  onSave: (values: ExecutiveMemberFormValues) => Promise<void>;
  onSearchPortalMembers: (query: string) => Promise<AdminUserRecord[]>;
  open: boolean;
  saving?: boolean;
}

function formatActivityYear(value: number | null | undefined): number | null {
  if (!value) return null;
  return value < 100 ? 2000 + value : value;
}

function getInitialValues(contact: ContactRecord | null): ExecutiveMemberFormValues {
  return {
    portalUserId: contact?.portalUserId ?? null,
    activities: contact?.activities?.length ? contact.activities.map((activity) => ({ ...activity, year: formatActivityYear(activity.year) ?? 2026 })) : [{ year: contact ? (formatActivityYear(contact.cohort) ?? 0) : nowDate().getFullYear(), departmentKo: contact?.departmentKo ?? "", departmentEn: contact?.departmentEn ?? "", roleKo: contact?.roleKo ?? "", roleEn: contact?.roleEn ?? "" }],
    nameKo: contact?.nameKo ?? "",
    nameEn: contact?.nameEn ?? "",
    studentNumber: contact?.studentNumber ?? "",
    email: contact?.email ?? "",
    phoneNumber: contact?.phoneNumber ?? "",
  };
}

function formatPortalMemberSummary(member: AdminUserRecord) {
  const identity = member.stdNo ? `${member.nameKo} (${member.stdNo})` : member.nameKo;
  const department = member.departmentKo || member.departmentEn || "소속 미등록";
  return `${identity} | ${member.email} | ${department}`;
}

export function ExecutiveMemberModal({
  contact,
  departments,
  onClose,
  onDelete,
  onSave,
  onSearchPortalMembers,
  open,
  saving = false,
}: ExecutiveMemberModalProps) {
  const [formData, setFormData] = useState<ExecutiveMemberFormValues>(() => getInitialValues(contact));
  const [portalQuery, setPortalQuery] = useState("");
  const [portalMembers, setPortalMembers] = useState<AdminUserRecord[]>([]);
  const [selectedPortalMember, setSelectedPortalMember] = useState<AdminUserRecord | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const [portalError, setPortalError] = useState<string | null>(null);
  const formId = "executive-member-form";

  useEffect(() => {
    if (!open) return;
    setFormData(getInitialValues(contact));
    setPortalQuery("");
    setPortalMembers([]);
    setSelectedPortalMember(null);
    setPortalError(null);
  }, [contact, open]);

  useEffect(() => {
    const query = portalQuery.trim();
    if (!open || query.length < 2) {
      setPortalMembers((current) => (current.length === 0 ? current : []));
      setPortalLoading(false);
      setPortalError(null);
      return;
    }

    let cancelled = false;
    setPortalLoading(true);
    setPortalError(null);
    setPortalMembers((current) => (current.length === 0 ? current : []));
    const timer = window.setTimeout(() => {
      void onSearchPortalMembers(query)
        .then((members) => {
          if (!cancelled) {
            setPortalMembers((current) => {
              const isSameResult = current.length === members.length
                && current.every((member, index) => member.userId === members[index]?.userId);
              return isSameResult ? current : members;
            });
            setPortalError(null);
          }
        })
        .catch(() => {
          if (!cancelled) {
            setPortalMembers((current) => (current.length === 0 ? current : []));
            setPortalError("포털 회원을 검색하지 못했습니다.");
          }
        })
        .finally(() => {
          if (!cancelled) setPortalLoading(false);
        });
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [onSearchPortalMembers, open, portalQuery]);

  const updateField = <K extends keyof ExecutiveMemberFormValues>(
    field: K,
    value: ExecutiveMemberFormValues[K],
  ) => {
    setFormData((current) => ({ ...current, [field]: value }));
  };

  const selectPortalMember = (member: AdminUserRecord) => {
    setFormData((current) => ({
      ...current,
      portalUserId: member.userId,
      nameKo: member.nameKo,
      nameEn: member.nameEn ?? "",
      studentNumber: member.stdNo ?? "",
      email: member.email,
      phoneNumber: "",
    }));
    setSelectedPortalMember(member);
    setPortalQuery("");
    setPortalMembers([]);
    setPortalError(null);
  };

  const clearPortalMember = () => {
    updateField("portalUserId", null);
    setSelectedPortalMember(null);
    setPortalQuery("");
    setPortalMembers([]);
    setPortalError(null);
  };

  const departmentOptions = [
    { value: "", label: "부서 선택" },
    ...departments
      .filter((department) => department.isActive)
      .map((department) => ({
        value: department.nameKo,
        label: department.nameKo,
      })),
    ...[...new Set(formData.activities.map(activity => activity.departmentKo))]
      .filter(name => name && !departments.some(department => department.isActive && department.nameKo === name))
      .map(name => ({ value: name, label: `${name} (기존 이력)` })),
  ];

  return (
    <AdminDrawer
      open={open}
      onClose={onClose}
      title={contact ? "집행부원 정보 수정" : "새 집행부원 등록"}
      width="max-w-2xl"
      footer={
        <div className="flex items-center justify-between gap-3">
          {contact && onDelete ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => void onDelete()}
              disabled={saving}
              className="rounded-lg border-rose-200 text-rose-600 hover:bg-rose-50 hover:text-rose-700"
            >
              <Trash2 aria-hidden="true" className="size-4" />
              부원 삭제
            </Button>
          ) : <span />}
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>취소</Button>
            <Button type="submit" form={formId} disabled={saving}>{saving ? "저장 중..." : "저장"}</Button>
          </div>
        </div>
      }
    >
      <form
        id={formId}
        onSubmit={(event) => {
          event.preventDefault();
          void onSave(formData);
        }}
        className="space-y-7 pb-1"
      >
        <section className="space-y-3" aria-labelledby="portal-member-heading">
          <div className="flex items-baseline justify-between gap-3">
            <h3 id="portal-member-heading" className="text-sm font-semibold text-slate-900">포털 회원 정보 불러오기</h3>
            <span className="shrink-0 text-xs text-slate-400">선택 사항</span>
          </div>
          {selectedPortalMember ? (
            <div className="flex min-h-10 w-full items-center justify-between gap-2 rounded-lg bg-emerald-50/70 px-3 py-2">
              <Badge tone="success" className="h-auto min-h-7 min-w-0 max-w-full gap-1.5 rounded-md border-0 bg-transparent px-0 py-1 text-xs font-medium leading-4 text-emerald-800">
                <span className="min-w-0 truncate">{formatPortalMemberSummary(selectedPortalMember)}</span>
              </Badge>
              <button
                type="button"
                aria-label="연결된 포털 회원 해제"
                onClick={clearPortalMember}
                className="inline-flex size-6 shrink-0 items-center justify-center rounded-md text-emerald-700 transition-colors hover:bg-emerald-100 hover:text-emerald-900"
              >
                <X aria-hidden="true" className="size-3.5" />
              </button>
            </div>
          ) : (
            <div className="relative">
              <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 z-10 size-4 -translate-y-1/2 text-slate-400" />
              <UiInput
                value={portalQuery}
                onChange={(event) => setPortalQuery(event.currentTarget.value)}
                placeholder="학번, 이름, 이메일로 가입 회원 검색"
                aria-label="포털 회원 검색"
                autoComplete="off"
                aria-busy={portalLoading}
                className="box-border w-full pl-9 focus-visible:border-brand-primary focus-visible:ring-2 focus-visible:ring-brand-primary/20"
              />
              {portalQuery.trim().length >= 2 && !portalError ? (
                <div className="absolute inset-x-0 top-full z-10 mt-1 max-h-56 overflow-y-auto rounded-lg border border-slate-200 bg-white p-1 shadow-elevated" role="listbox" aria-label="포털 회원 검색 결과">
                  {portalMembers.length > 0 ? portalMembers.map((member) => (
                    <button
                      key={member.userId}
                      type="button"
                      role="option"
                      onClick={() => selectPortalMember(member)}
                      className="flex w-full min-w-0 items-center rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-slate-50"
                    >
                      <span className="min-w-0 truncate font-medium text-slate-800" title={formatPortalMemberSummary(member)}>
                        {formatPortalMemberSummary(member)}
                      </span>
                    </button>
                  )) : (
                    <p className="px-3 py-2 text-xs text-slate-500">검색 결과가 없습니다.</p>
                  )}
                </div>
              ) : null}
            </div>
          )}
          {portalError ? <span className="text-xs font-normal leading-4 text-rose-600">{portalError}</span> : null}
        </section>

        <section className="space-y-4" aria-labelledby="basic-member-info-heading">
          <h3 id="basic-member-info-heading" className="text-sm font-semibold text-slate-900">기본 개인정보</h3>
          <div className="grid gap-x-4 gap-y-4 sm:grid-cols-2">
          <AdminFormField label="이름">
            <UiInput required value={formData.nameKo} onChange={(event) => updateField("nameKo", event.currentTarget.value)} placeholder="예: 김성찬" className="box-border w-full" />
          </AdminFormField>
          <AdminFormField label="학번">
            <UiInput value={formData.studentNumber} onChange={(event) => updateField("studentNumber", event.currentTarget.value)} placeholder="포털 회원 선택 시 자동 입력" className="box-border w-full" />
          </AdminFormField>
          <AdminFormField label="이메일">
            <UiInput type="email" value={formData.email} onChange={(event) => updateField("email", event.currentTarget.value)} placeholder="name@kaist.ac.kr" className="box-border w-full" />
          </AdminFormField>
          <AdminFormField label="전화번호">
            <UiInput value={formData.phoneNumber} onChange={(event) => updateField("phoneNumber", event.currentTarget.value)} placeholder="010-0000-0000" className="box-border w-full" />
          </AdminFormField>

          </div>
        </section>

        <section className="space-y-4 border-t border-slate-200 pt-6" aria-labelledby="activity-history-heading">
          <div className="flex items-center justify-between gap-3">
            <h3 id="activity-history-heading" className="text-sm font-semibold text-slate-900">활동 이력</h3>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => updateField("activities", [...formData.activities, { year: nowDate().getFullYear(), departmentKo: "", departmentEn: "", roleKo: "", roleEn: "" }])}
              className="shrink-0 text-brand-primary hover:bg-emerald-50 hover:text-brand-primary"
            >
              + 이력 추가
            </Button>
          </div>
          <div className="space-y-3">
            {formData.activities.map((activity, index) => {
              const activitySummary = [
                activity.year ? `${activity.year}년도` : null,
                activity.departmentKo || null,
              ].filter(Boolean).join(" · ") || `이력 ${index + 1}`;

              return (
                <div key={index} className="grid grid-cols-[88px_minmax(0,1fr)_minmax(0,1fr)_28px] items-center gap-2">
                  <UiInput aria-label={`활동 연도 ${index + 1}`} type="number" min={1900} max={3000} required value={activity.year || ""} onChange={(event) => { const year = Number(event.currentTarget.value); updateField("activities", formData.activities.map((item, i) => i === index ? { ...item, year } : item)); }} />
                  <AdminSelectDropdown ariaLabel={`활동 부서 ${index + 1}`} value={activity.departmentKo} options={departmentOptions} onChange={(value) => { const dept = departments.find((item) => item.nameKo === value); updateField("activities", formData.activities.map((item, i) => i === index ? { ...item, departmentId: dept?.id ?? null, departmentKo: value, departmentEn: "" } : item)); }} />
                  <UiInput aria-label={`직책 ${index + 1}`} placeholder="직책" required value={activity.roleKo} onChange={(event) => { const roleKo = event.currentTarget.value; updateField("activities", formData.activities.map((item, i) => i === index ? { ...item, roleKo } : item)); }} />
                  <IconButton type="button" size="sm" aria-label={`${activitySummary} 삭제`} disabled={formData.activities.length === 1} onClick={() => updateField("activities", formData.activities.filter((_, i) => i !== index))} className="text-slate-400 hover:text-rose-600"><Trash2 className="size-4" /></IconButton>
                </div>
              );
            })}
          </div>
        </section>

      </form>
    </AdminDrawer>
  );
}
