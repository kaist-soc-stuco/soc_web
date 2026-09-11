import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { AdminFormField } from "@/components/ui/admin-page";
import { UiInput } from "@/components/ui/form-control";
import { RichTextInput } from "@/components/ui/rich-text-input";
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

const DEFAULT_SECTION_DESCRIPTION_KO = "섹션 설명";
const DEFAULT_SECTION_DESCRIPTION_EN = "Section description";

export function SectionEditorModal({
  initial,
  isKoreanOnly = false,
  isOngoing = false,
  onSave,
  onCancel,
}: SectionEditorModalProps) {
  const [form, setForm] = useState<SectionFormState>(() => ({
    ...initial,
    descriptionKo: initial.descriptionKo.trim() || DEFAULT_SECTION_DESCRIPTION_KO,
    descriptionEn: initial.descriptionEn.trim() || DEFAULT_SECTION_DESCRIPTION_EN,
  }));
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
      mobileFullscreen
      className="max-w-4xl"
      bodyClassName="space-y-6 px-4 py-5 sm:px-6 md:px-8"
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
            className={`min-h-11 flex-1 rounded-lg py-2 text-xs font-bold transition ${
              activeTab === "ko"
                ? "bg-white text-kaist-darkgreen shadow-sm"
                : "text-slate-500 hover:bg-white/70"
            }`}
          >
            국문
          </Button>
          <Button variant="ghost"
            type="button"
            onClick={() => setActiveTab("en")}
            disabled={isKoreanOnly}
            className={`min-h-11 flex-1 rounded-lg py-2 text-xs font-bold transition ${
              activeTab === "en"
                ? "bg-white text-kaist-darkgreen shadow-sm"
                : "text-slate-500 hover:bg-white/70"
            } ${isKoreanOnly ? "cursor-not-allowed opacity-40" : ""}`}
          >
            영문
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
            <div className="grid min-w-0 gap-1.5">
              <span className="text-xs font-normal leading-4 text-[#344054]">섹션 설명</span>
              <RichTextInput
                value={form.descriptionKo}
                onChange={(value) => update("descriptionKo", value)}
                ariaLabel="국문 섹션 설명"
                disabled={isOngoing}
                placeholder={DEFAULT_SECTION_DESCRIPTION_KO}
              />
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <AdminFormField label="섹션 제목 *">
              <UiInput
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-normal text-slate-900 outline-none transition hover:border-slate-300 focus-visible:border-kaist-darkgreen focus-visible:ring-2 focus-visible:ring-kaist-darkgreen/20"
                value={form.titleEn}
                onChange={(event) => update("titleEn", event.target.value)}
                disabled={isOngoing || isKoreanOnly}
                placeholder="영문 섹션 제목"
              />
            </AdminFormField>
            <div className="grid min-w-0 gap-1.5">
              <span className="text-xs font-normal leading-4 text-[#344054]">섹션 설명</span>
              <RichTextInput
                value={form.descriptionEn}
                onChange={(value) => update("descriptionEn", value)}
                ariaLabel="영문 섹션 설명"
                disabled={isOngoing || isKoreanOnly}
                placeholder={DEFAULT_SECTION_DESCRIPTION_EN}
              />
            </div>
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

interface SectionInlineEditorProps {
  commitRef?: { current: (() => Promise<boolean>) | null };
  initial: SectionFormState;
  isKoreanOnly?: boolean;
  isOngoing?: boolean;
  onSave: (section: SectionFormState) => void | Promise<void>;
  onCancel: () => void;
}

export function SectionInlineEditor({ commitRef, initial, isKoreanOnly = false, isOngoing = false, onSave, onCancel }: SectionInlineEditorProps) {
  const [form, setForm] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const saveRef = useRef<() => Promise<void>>(async () => undefined);
  const savingRef = useRef<Promise<boolean> | null>(null);
  const save = (): Promise<boolean> => {
    if (savingRef.current) return savingRef.current;
    if (JSON.stringify(form) === JSON.stringify(initial)) { onCancel(); return Promise.resolve(true); }
    if (!form.titleKo.replace(/<[^>]*>/g, "").trim() || (!isKoreanOnly && !form.titleEn.replace(/<[^>]*>/g, "").trim())) { setError("섹션 제목을 입력해 주세요."); return Promise.resolve(false); }
    savingRef.current = Promise.resolve().then(() => onSave(form)).then(() => true).catch(() => { setError("저장하지 못했습니다. 다시 시도해 주세요."); return false; }).finally(() => { savingRef.current = null; });
    return savingRef.current;
  };
  saveRef.current = async () => { await save(); };
  if (commitRef) commitRef.current = save;
  useEffect(() => () => { if (commitRef) commitRef.current = null; }, [commitRef]);
  useEffect(() => {
    rootRef.current?.querySelector<HTMLElement>('[contenteditable="true"]')?.focus();
    const outside = (event: PointerEvent) => { if (!isOngoing && !rootRef.current?.contains(event.target as Node)) void saveRef.current(); };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [isOngoing]);
  return <div ref={rootRef} className="survey-expand rounded-b-xl rounded-tr-xl border-b border-slate-300 bg-white p-5" onBlurCapture={event => {
    if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget as Node) && !isOngoing) void save();
  }}>
    <div className={`grid gap-5 ${isKoreanOnly ? "" : "md:grid-cols-2"}`}>
      {(["ko", "en"] as const).filter(language => language === "ko" || !isKoreanOnly).map(language => <div key={language} className="space-y-4">

        <RichTextInput singleLine placeholder={language === "ko" ? "섹션 제목" : "Section title"} value={form[language === "ko" ? "titleKo" : "titleEn"]} onChange={value => setForm(current => ({ ...current, [language === "ko" ? "titleKo" : "titleEn"]: value }))} ariaLabel={language === "ko" ? "국문 섹션 제목" : "영문 섹션 제목"} disabled={isOngoing} />
        <RichTextInput placeholder={language === "ko" ? "섹션 설명" : "Section description"} value={form[language === "ko" ? "descriptionKo" : "descriptionEn"]} onChange={value => setForm(current => ({ ...current, [language === "ko" ? "descriptionKo" : "descriptionEn"]: value }))} ariaLabel={language === "ko" ? "국문 섹션 설명" : "영문 섹션 설명"} disabled={isOngoing} />
      </div>)}
    </div>
    {error ? <p role="alert" className="mt-3 text-sm text-red-600">{error}</p> : null}
  </div>;
}
