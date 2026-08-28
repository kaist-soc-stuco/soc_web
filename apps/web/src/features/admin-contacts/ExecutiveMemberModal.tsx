import { useEffect, useRef, useState } from "react";
import type { ContactRecord } from "@soc/contracts";
import { Image } from "lucide-react";

import { AdminFormField } from "@/components/ui/admin-page";
import { AdminDrawer } from "@/components/ui/admin-drawer";
import { Button } from "@/components/ui/button";
import { UiInput } from "@/components/ui/form-control";
import { resolveAssetUrl } from "@/lib/asset-url";

export interface ExecutiveMemberFormValues {
  nameKo: string;
  nameEn: string;
  departmentKo: string;
  departmentEn: string;
  roleKo: string;
  roleEn: string;
  avatarStorageKey: string | null;
  gender: string;
  cohort: number | null;
  email: string;
  phoneNumber: string;
}

interface ExecutiveMemberModalProps {
  contact: ContactRecord | null;
  onClose: () => void;
  onDelete?: () => void | Promise<void>;
  onUploadAvatar?: (file: File) => Promise<string>;
  onSave: (values: ExecutiveMemberFormValues) => Promise<void>;
  open: boolean;
  saving?: boolean;
}

function getInitialValues(contact: ContactRecord | null): ExecutiveMemberFormValues {
  return {
    nameKo: contact?.nameKo ?? "",
    nameEn: contact?.nameEn ?? "",
    departmentKo: contact?.departmentKo ?? "",
    departmentEn: contact?.departmentEn ?? "",
    roleKo: contact?.roleKo ?? "",
    roleEn: contact?.roleEn ?? "",
    avatarStorageKey: contact?.avatarStorageKey ?? null,
    gender: contact?.gender ?? "",
    cohort: contact?.cohort ?? null,
    email: contact?.email ?? "",
    phoneNumber: contact?.phoneNumber ?? "",
  };
}

export function ExecutiveMemberModal({
  contact,
  onClose,
  onDelete,
  onUploadAvatar,
  onSave,
  open,
  saving = false,
}: ExecutiveMemberModalProps) {
  const [formData, setFormData] = useState<ExecutiveMemberFormValues>(() => getInitialValues(contact));
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const formId = "executive-member-form";

  useEffect(() => {
    if (open) {
      setFormData(getInitialValues(contact));
      setAvatarError(null);
    }
  }, [contact, open]);

  const updateField = <K extends keyof ExecutiveMemberFormValues>(
    field: K,
    value: ExecutiveMemberFormValues[K],
  ) => {
    setFormData((current) => ({ ...current, [field]: value }));
  };

  const handleAvatarChange = async (file: File | undefined) => {
    if (!file || !onUploadAvatar) return;
    setAvatarError(null);
    setAvatarUploading(true);
    try {
      updateField("avatarStorageKey", await onUploadAvatar(file));
    } catch {
      setAvatarError("프로필 이미지를 업로드하지 못했습니다.");
    } finally {
      setAvatarUploading(false);
    }
  };

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
              disabled={saving || avatarUploading}
              className="border-rose-200 text-rose-600 hover:bg-rose-50 hover:text-rose-700"
            >
              삭제
            </Button>
          ) : <span />}
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={saving || avatarUploading}>취소</Button>
            <Button type="submit" form={formId} disabled={saving || avatarUploading}>{saving ? "저장 중..." : "저장"}</Button>
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
        className="scrollbar-hidden max-h-[70vh] space-y-5 overflow-y-auto"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <AdminFormField label="이름 (한글) *">
            <UiInput required value={formData.nameKo} onChange={(event) => updateField("nameKo", event.currentTarget.value)} placeholder="예: 김성찬" />
          </AdminFormField>
          <AdminFormField label="이름 (영문) *">
            <UiInput required value={formData.nameEn} onChange={(event) => updateField("nameEn", event.currentTarget.value)} placeholder="예: Seongchan Kim" />
          </AdminFormField>
          <AdminFormField label="부서 (한글)">
            <UiInput value={formData.departmentKo} onChange={(event) => updateField("departmentKo", event.currentTarget.value)} placeholder="예: 회장단" />
          </AdminFormField>
          <AdminFormField label="부서 (영문)">
            <UiInput value={formData.departmentEn} onChange={(event) => updateField("departmentEn", event.currentTarget.value)} placeholder="예: Presidium" />
          </AdminFormField>
          <AdminFormField label="직책 (한글) *">
            <UiInput required value={formData.roleKo} onChange={(event) => updateField("roleKo", event.currentTarget.value)} placeholder="예: 회장" />
          </AdminFormField>
          <AdminFormField label="직책 (영문) *">
            <UiInput required value={formData.roleEn} onChange={(event) => updateField("roleEn", event.currentTarget.value)} placeholder="예: President" />
          </AdminFormField>
        </div>

        <div className="flex items-center gap-3 border-t border-slate-100 pt-5">
          <div className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-100 text-slate-400">
            {formData.avatarStorageKey ? (
              <img src={resolveAssetUrl(formData.avatarStorageKey)} alt="" className="size-full object-cover" />
            ) : <Image aria-hidden="true" className="size-5" />}
          </div>
          <div className="min-w-0 space-y-1">
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" onClick={() => avatarInputRef.current?.click()} disabled={!onUploadAvatar || avatarUploading}>
                {avatarUploading ? "업로드 중..." : "프로필 이미지 선택"}
              </Button>
              <UiInput
                ref={avatarInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="hidden"
                onChange={(event) => {
                  void handleAvatarChange(event.currentTarget.files?.[0]);
                  event.currentTarget.value = "";
                }}
              />
            </div>
            {avatarError ? <p className="text-xs font-medium text-rose-600">{avatarError}</p> : null}
          </div>
        </div>

        <div className="grid gap-4 border-t border-slate-100 pt-5 sm:grid-cols-2">
          <AdminFormField label="이메일">
            <UiInput type="email" value={formData.email} onChange={(event) => updateField("email", event.currentTarget.value)} placeholder="name@kaist.ac.kr" />
          </AdminFormField>
          <AdminFormField label="전화번호">
            <UiInput value={formData.phoneNumber} onChange={(event) => updateField("phoneNumber", event.currentTarget.value)} placeholder="010-0000-0000" />
          </AdminFormField>
          <AdminFormField label="성별">
            <UiInput value={formData.gender} onChange={(event) => updateField("gender", event.currentTarget.value)} placeholder="예: 여성" />
          </AdminFormField>
          <AdminFormField label="기수">
            <UiInput type="number" min="1" value={formData.cohort ?? ""} onChange={(event) => updateField("cohort", event.currentTarget.value ? Number(event.currentTarget.value) : null)} placeholder="예: 26" />
          </AdminFormField>
        </div>

        <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-500">
          개인정보 제공에 동의한 집행부원만 등록해 주세요. 등록된 연락처는 권한이 있는 관리자에게만 표시됩니다.
        </p>
      </form>
    </AdminDrawer>
  );
}
