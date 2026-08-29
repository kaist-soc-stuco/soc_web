import { useEffect, useState } from "react";
import { X } from "lucide-react";
import type {
  AdminUserRecord,
  ContactDepartmentRecord,
  ContactRecord,
} from "@soc/contracts";

import { AdminFormField } from "@/components/ui/admin-page";
import { AdminDrawer } from "@/components/ui/admin-drawer";
import { AdminSelectDropdown } from "@/components/ui/admin-select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { UiInput } from "@/components/ui/form-control";

export interface ExecutiveMemberFormValues {
  nameKo: string;
  nameEn: string;
  studentNumber: string;
  departmentKo: string;
  departmentEn: string;
  roleKo: string;
  roleEn: string;
  cohort: number | null;
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
    nameKo: contact?.nameKo ?? "",
    nameEn: contact?.nameEn ?? "",
    studentNumber: contact?.studentNumber ?? "",
    departmentKo: contact?.departmentKo ?? "",
    departmentEn: contact?.departmentEn ?? "",
    roleKo: contact?.roleKo ?? "",
    roleEn: contact?.roleEn ?? "",
    cohort: formatActivityYear(contact?.cohort),
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
    const department = departments.find(
      (item) => item.nameKo === member.departmentKo || (item.nameEn && item.nameEn === member.departmentEn),
    );
    setFormData((current) => ({
      ...current,
      nameKo: member.nameKo,
      nameEn: member.nameEn ?? "",
      studentNumber: member.stdNo ?? "",
      departmentKo: department?.nameKo ?? "",
      departmentEn: department?.nameEn ?? "",
      email: member.email,
      phoneNumber: member.phoneNumber ?? "",
    }));
    setSelectedPortalMember(member);
    setPortalQuery("");
    setPortalMembers([]);
    setPortalError(
      member.departmentKo && !department
        ? "회원의 소속이 등록된 부서 목록에 없습니다. 부서를 먼저 등록한 뒤 선택해 주세요."
        : null,
    );
  };

  const clearPortalMember = () => {
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
        label: department.nameEn ? `${department.nameKo} · ${department.nameEn}` : department.nameKo,
      })),
    ...(formData.departmentKo && !departments.some((department) => department.nameKo === formData.departmentKo)
      ? [{ value: formData.departmentKo, label: `${formData.departmentKo} (현재 값)` }]
      : []),
  ];

  return (
    <AdminDrawer
      open={open}
      onClose={onClose}
      title={contact ? "집행부원 정보 수정" : "새 집행부원 등록"}
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
              삭제
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
        className="space-y-5 pb-1"
      >
        <AdminFormField label="포털 가입 회원 검색" hint="이름, 학번, 이메일로 검색한 뒤 회원을 선택하세요.">
          {selectedPortalMember ? (
            <div className="flex min-h-10 w-full items-center rounded-lg border border-emerald-200 bg-emerald-50/45 px-2 py-1.5">
              <Badge tone="success" className="h-auto min-h-7 w-full min-w-0 max-w-full justify-between gap-1.5 rounded-md px-2 py-1 text-xs font-medium leading-4">
                <span className="min-w-0 truncate">{formatPortalMemberSummary(selectedPortalMember)}</span>
                <button
                  type="button"
                  aria-label="연결된 포털 회원 해제"
                  onClick={clearPortalMember}
                  className="inline-flex size-5 shrink-0 items-center justify-center rounded text-emerald-700 transition-colors hover:bg-emerald-100 hover:text-emerald-900"
                >
                  <X aria-hidden="true" className="size-3.5" />
                </button>
              </Badge>
            </div>
          ) : (
            <div className="relative">
              <UiInput
                value={portalQuery}
                onChange={(event) => setPortalQuery(event.currentTarget.value)}
                placeholder="포털 가입 회원 검색"
                autoComplete="off"
                aria-busy={portalLoading}
                className="box-border w-full focus-visible:border-brand-primary focus-visible:ring-2 focus-visible:ring-brand-primary/20"
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
        </AdminFormField>

        <div className="grid gap-4 sm:grid-cols-2">
          <AdminFormField label="이름 (한글) *">
            <UiInput required value={formData.nameKo} onChange={(event) => updateField("nameKo", event.currentTarget.value)} placeholder="예: 김성찬" className="box-border w-full" />
          </AdminFormField>
          <AdminFormField label="이름 (영문) *">
            <UiInput required value={formData.nameEn} onChange={(event) => updateField("nameEn", event.currentTarget.value)} placeholder="예: Seongchan Kim" className="box-border w-full" />
          </AdminFormField>
          <AdminFormField label="학번">
            <UiInput value={formData.studentNumber} onChange={(event) => updateField("studentNumber", event.currentTarget.value)} placeholder="포털 회원 선택 시 자동 입력" className="box-border w-full" />
          </AdminFormField>
          <AdminFormField label="활동 연도">
            <UiInput type="number" min="1900" max="3000" value={formData.cohort ?? ""} onChange={(event) => updateField("cohort", event.currentTarget.value ? Number(event.currentTarget.value) : null)} placeholder="예: 2026" className="box-border w-full" />
          </AdminFormField>
          <AdminFormField label="부서">
            <AdminSelectDropdown
              value={formData.departmentKo}
              onChange={(value) => {
                const department = departments.find((item) => item.nameKo === value);
                updateField("departmentKo", department?.nameKo ?? value);
                updateField("departmentEn", department?.nameEn ?? "");
              }}
              ariaLabel="부서 선택"
              options={departmentOptions}
              className="w-full"
            />
          </AdminFormField>
          <AdminFormField label="이메일">
            <UiInput type="email" value={formData.email} onChange={(event) => updateField("email", event.currentTarget.value)} placeholder="name@kaist.ac.kr" className="box-border w-full" />
          </AdminFormField>
          <AdminFormField label="직책 (한글) *">
            <UiInput required value={formData.roleKo} onChange={(event) => updateField("roleKo", event.currentTarget.value)} placeholder="예: 회장" className="box-border w-full" />
          </AdminFormField>
          <AdminFormField label="직책 (영문) *">
            <UiInput required value={formData.roleEn} onChange={(event) => updateField("roleEn", event.currentTarget.value)} placeholder="예: President" className="box-border w-full" />
          </AdminFormField>
          <AdminFormField label="전화번호" className="sm:col-span-2">
            <UiInput value={formData.phoneNumber} onChange={(event) => updateField("phoneNumber", event.currentTarget.value)} placeholder="010-0000-0000" className="box-border w-full" />
          </AdminFormField>
        </div>

        <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-500">
          개인정보 제공에 동의한 집행부원만 등록해 주세요. 등록된 연락처는 권한이 있는 관리자에게만 표시됩니다.
        </p>
      </form>
    </AdminDrawer>
  );
}
