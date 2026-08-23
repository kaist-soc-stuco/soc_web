import { useEffect, useState } from "react";

import { RichTextEditor } from "./rich-text-editor";
import { Button } from "@/components/ui/button";
import { AdminFormField } from "@/components/ui/admin-page";
import { UiInput } from "@/components/ui/form-control";
import { Modal } from "@/components/ui/modal";

export interface SectionFormState {
  titleKo: string;
  titleEn: string;
  descriptionKo: string;
  descriptionEn: string;
}

interface SectionEditorModalProps {
  initial: SectionFormState;
  isKoreanOnly?: boolean;
  isOngoing?: boolean;
  onSave: (section: SectionFormState) => void;
  onCancel: () => void;
}

export function SectionEditorModal({
  initial,
  isKoreanOnly = false,
  isOngoing = false,
  onSave,
  onCancel,
}: SectionEditorModalProps) {
  const [form, setForm] = useState<SectionFormState>(initial);
  const [activeTab, setActiveTab] = useState<"ko" | "en">("ko");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isKoreanOnly && activeTab === "en") setActiveTab("ko");
  }, [activeTab, isKoreanOnly]);

  const update = <K extends keyof SectionFormState>(
    key: K,
    value: SectionFormState[K],
  ) => setForm((current) => ({ ...current, [key]: value }));

  const handleSave = () => {
    if (!form.titleKo.trim()) {
      setError("국문 섹션 제목은 필수입니다.");
      setActiveTab("ko");
      return;
    }
    if (!isKoreanOnly && !form.titleEn.trim()) {
      setError("영문 섹션 제목은 필수입니다.");
      setActiveTab("en");
      return;
    }
    setError(null);
    onSave(form);
  };

  return (
    <Modal
      open
      onClose={onCancel}
      title="섹션 편집"
      className="max-w-2xl"
      bodyClassName="space-y-6 px-6 py-6 md:px-8"
      footer={
        <>
          <Button type="button" variant="outline" onClick={onCancel}>
            취소
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={isOngoing}
            className="bg-kaist-darkgreen text-white hover:bg-kaist-darkgreen/90"
          >
            저장
          </Button>
        </>
      }
    >
        <div className="flex rounded-xl border border-slate-200 bg-slate-50 p-1">
          <Button variant="ghost"
            type="button"
            onClick={() => setActiveTab("ko")}
            className={`flex-1 rounded-lg py-2 text-xs font-bold transition ${
              activeTab === "ko"
                ? "bg-white text-kaist-darkgreen shadow-sm"
                : "text-slate-500 hover:bg-white/70"
            }`}
          >
            국문 (Korean)
          </Button>
          <Button variant="ghost"
            type="button"
            onClick={() => setActiveTab("en")}
            disabled={isKoreanOnly}
            className={`flex-1 rounded-lg py-2 text-xs font-bold transition ${
              activeTab === "en"
                ? "bg-white text-kaist-darkgreen shadow-sm"
                : "text-slate-500 hover:bg-white/70"
            } ${isKoreanOnly ? "cursor-not-allowed opacity-40" : ""}`}
          >
            영문 (English)
          </Button>
        </div>

        {activeTab === "ko" ? (
          <div className="space-y-4">
            <AdminFormField label="섹션 제목 *">
              <UiInput
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-normal text-slate-900 outline-none transition hover:border-slate-300 focus-visible:border-kaist-darkgreen focus-visible:ring-2 focus-visible:ring-kaist-darkgreen/20"
                value={form.titleKo}
                onChange={(event) => update("titleKo", event.target.value)}
                disabled={isOngoing}
                placeholder="국문 섹션 제목"
              />
            </AdminFormField>
            <AdminFormField label="섹션 설명">
              <RichTextEditor
                compact
                disabled={isOngoing}
                content={form.descriptionKo}
                onChange={(value) => update("descriptionKo", value)}
                lang="ko"
              />
            </AdminFormField>
          </div>
        ) : (
          <div className="space-y-4">
            <AdminFormField label="Section title *">
              <UiInput
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-normal text-slate-900 outline-none transition hover:border-slate-300 focus-visible:border-kaist-darkgreen focus-visible:ring-2 focus-visible:ring-kaist-darkgreen/20"
                value={form.titleEn}
                onChange={(event) => update("titleEn", event.target.value)}
                disabled={isOngoing || isKoreanOnly}
                placeholder="English section title"
              />
            </AdminFormField>
            <AdminFormField label="Section description">
              <RichTextEditor
                compact
                disabled={isOngoing || isKoreanOnly}
                content={form.descriptionEn}
                onChange={(value) => update("descriptionEn", value)}
                lang="en"
              />
            </AdminFormField>
          </div>
        )}

        {error && (
          <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs font-semibold text-red-700">
            {error}
          </p>
        )}

    </Modal>
  );
}
