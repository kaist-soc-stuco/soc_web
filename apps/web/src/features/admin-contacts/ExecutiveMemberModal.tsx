import { useEffect, useState } from "react";
import type { ContactRecord } from "@soc/contracts";

import { AdminFormField } from "@/components/ui/admin-page";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { UiInput } from "@/components/ui/form-control";

export interface ExecutiveMemberFormValues {
  nameKo: string;
  nameEn: string;
  roleKo: string;
  roleEn: string;
  gender: string;
  cohort: number | null;
  email: string;
  phoneNumber: string;
}

interface ExecutiveMemberModalProps {
  contact: ContactRecord | null;
  onClose: () => void;
  onSave: (values: ExecutiveMemberFormValues) => Promise<void>;
  open: boolean;
  saving?: boolean;
}

function getInitialValues(contact: ContactRecord | null): ExecutiveMemberFormValues {
  return {
    nameKo: contact?.nameKo ?? "",
    nameEn: contact?.nameEn ?? "",
    roleKo: contact?.roleKo ?? "",
    roleEn: contact?.roleEn ?? "",
    gender: contact?.gender ?? "",
    cohort: contact?.cohort ?? null,
    email: contact?.email ?? "",
    phoneNumber: contact?.phoneNumber ?? "",
  };
}

export function ExecutiveMemberModal({
  contact,
  onClose,
  onSave,
  open,
  saving = false,
}: ExecutiveMemberModalProps) {
  const [formData, setFormData] = useState<ExecutiveMemberFormValues>(() => getInitialValues(contact));
  const formId = "executive-member-form";

  useEffect(() => {
    if (open) setFormData(getInitialValues(contact));
  }, [contact, open]);

  const updateField = <K extends keyof ExecutiveMemberFormValues>(
    field: K,
    value: ExecutiveMemberFormValues[K],
  ) => {
    setFormData((current) => ({ ...current, [field]: value }));
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={contact ? "집행부원 정보 수정" : "새 집행부원 등록"}
      className="max-w-2xl"
      footer={
        <>
          <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
            취소
          </Button>
          <Button type="submit" form={formId} disabled={saving}>
            {saving ? "저장 중..." : "저장"}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={(event) => { event.preventDefault(); void onSave(formData); }} className="max-h-[70vh] space-y-5 overflow-y-auto">
        <div className="grid gap-4 sm:grid-cols-2">
          <AdminFormField label="이름 (한글) *">
            <UiInput
              required
              value={formData.nameKo}
              onChange={(event) => updateField("nameKo", event.currentTarget.value)}
              placeholder="홍길동"
            />
          </AdminFormField>
          <AdminFormField label="이름 (영문) *">
            <UiInput
              required
              value={formData.nameEn}
              onChange={(event) => updateField("nameEn", event.currentTarget.value)}
              placeholder="Gildong Hong"
            />
          </AdminFormField>
          <AdminFormField label="직책 (한글) *">
            <UiInput
              required
              value={formData.roleKo}
              onChange={(event) => updateField("roleKo", event.currentTarget.value)}
              placeholder="회장, 기획부장 등"
            />
          </AdminFormField>
          <AdminFormField label="직책 (영문) *">
            <UiInput
              required
              value={formData.roleEn}
              onChange={(event) => updateField("roleEn", event.currentTarget.value)}
              placeholder="President, Head of Planning"
            />
          </AdminFormField>
        </div>

        <div className="grid gap-4 border-t border-slate-100 pt-5 sm:grid-cols-2">
          <AdminFormField label="이메일">
            <UiInput
              type="email"
              value={formData.email}
              onChange={(event) => updateField("email", event.currentTarget.value)}
              placeholder="email@kaist.ac.kr"
            />
          </AdminFormField>
          <AdminFormField label="전화번호">
            <UiInput
              value={formData.phoneNumber}
              onChange={(event) => updateField("phoneNumber", event.currentTarget.value)}
              placeholder="010-XXXX-XXXX"
            />
          </AdminFormField>
          <AdminFormField label="성별">
            <UiInput
              value={formData.gender}
              onChange={(event) => updateField("gender", event.currentTarget.value)}
              placeholder="선택 입력"
            />
          </AdminFormField>
          <AdminFormField label="기수">
            <UiInput
              type="number"
              min="1"
              value={formData.cohort ?? ""}
              onChange={(event) => updateField("cohort", event.currentTarget.value ? Number(event.currentTarget.value) : null)}
              placeholder="예: 26"
            />
          </AdminFormField>
        </div>

        <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-500">
          개인정보 제공에 동의한 집행부원만 등록해 주세요. 등록된 연락처는 권한이 있는 관리자에게만 표시됩니다.
        </p>
      </form>
    </Modal>
  );
}
