import { useEffect, useState } from "react";
import { X } from "lucide-react";

import { RichTextEditor } from "./rich-text-editor";
import { Button } from "@/components/ui/button";
import { AdminFormField } from "@/components/ui/admin-page";
import { UiInput } from "@/components/ui/form-control";

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col gap-6 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl md:p-8">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div>
            <h3 className="text-xl font-bold text-slate-950">섹션 편집</h3>
          </div>
          <Button variant="ghost"
            type="button"
            onClick={onCancel}
            className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kaist-darkgreen/35"
            aria-label="섹션 편집 닫기"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

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

        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
          <Button variant="ghost"
            type="button"
            onClick={onCancel}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-600 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kaist-darkgreen/25"
          >
            취소
          </Button>
          <Button variant="ghost"
            type="button"
            onClick={handleSave}
            disabled={isOngoing}
            className="rounded-xl bg-kaist-darkgreen px-5 py-2.5 text-sm font-bold text-white transition hover:bg-kaist-darkgreen/90 disabled:cursor-not-allowed disabled:opacity-45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kaist-darkgreen/35"
          >
            저장
          </Button>
        </div>
      </div>
    </div>
  );
}
