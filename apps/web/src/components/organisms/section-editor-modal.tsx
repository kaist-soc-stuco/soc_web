import { useEffect, useRef, useState } from "react";

import { BuilderTextField as RichTextInput } from "@/components/ui/builder-field";

export interface SectionFormState {
  titleKo: string;
  titleEn: string;
  descriptionKo: string;
  descriptionEn: string;
}

interface SectionInlineEditorProps {
  commitRef?: { current: (() => Promise<boolean>) | null };
  initial: SectionFormState;
  isKoreanOnly?: boolean;
  isOngoing?: boolean;
  isSurveyHeader?: boolean;
  initialFocus?: keyof SectionFormState | null;
  onSave: (section: SectionFormState) => void | Promise<void>;
  onCancel: () => void;
}

export function SectionInlineEditor({ commitRef, initial, isKoreanOnly = false, isOngoing = false, isSurveyHeader = false, initialFocus = null, onSave, onCancel }: SectionInlineEditorProps) {
  const [form, setForm] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const savedRef = useRef(JSON.stringify(initial));
  const rootRef = useRef<HTMLDivElement>(null);
  const saveRef = useRef<() => Promise<void>>(async () => undefined);
  const savingRef = useRef<Promise<boolean> | null>(null);
  const latestForm = useRef(form);
  latestForm.current = form;
  const save = async (): Promise<boolean> => {
    if (savingRef.current && !(await savingRef.current)) return false;
    const snapshot = latestForm.current;
    if (JSON.stringify(snapshot) === savedRef.current) return true;
    const pending = Promise.resolve().then(() => onSave(snapshot)).then(() => {
      savedRef.current = JSON.stringify(snapshot);
      setError(null);
      return true;
    }).catch(() => { setError("저장하지 못했습니다. 다시 시도해 주세요."); return false; });
    savingRef.current = pending;
    const succeeded = await pending;
    if (savingRef.current === pending) savingRef.current = null;
    return succeeded && JSON.stringify(latestForm.current) !== savedRef.current ? save() : succeeded;
  };
  saveRef.current = async () => { await save(); };
  if (commitRef) commitRef.current = save;
  useEffect(() => () => { if (commitRef) commitRef.current = null; }, [commitRef]);
  useEffect(() => {
    if (initialFocus) rootRef.current?.querySelector<HTMLElement>(`[data-section-field="${initialFocus}"] [contenteditable="true"]`)?.focus();
    const outside = (event: PointerEvent) => { if (!(event.target as HTMLElement).closest("[data-section-menu]") && !isOngoing && !rootRef.current?.contains(event.target as Node)) void saveRef.current(); };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [isOngoing]);
  return <div ref={rootRef} className={`section-inline-editor ${isSurveyHeader ? "survey-section-header" : ""}`} onBlurCapture={event => {
    if (event.relatedTarget && !(event.relatedTarget as HTMLElement).closest("[data-section-menu]") && !event.currentTarget.contains(event.relatedTarget as Node) && !isOngoing) void save();
  }}>

    <div className={`grid gap-x-6 gap-y-5 ${isKoreanOnly ? "" : "md:grid-cols-2"}`}>
      {(["title", "description"] as const).flatMap(kind => (["ko", "en"] as const).filter(language => language === "ko" || !isKoreanOnly).map(language => {
        const field = `${kind}${language === "ko" ? "Ko" : "En"}` as keyof SectionFormState;
        return <div key={field} data-section-field={field}><RichTextInput
          singleLine={kind === "title"}
          placeholder={language === "ko" ? kind === "title" ? isSurveyHeader ? "제목 없는 설문지" : "섹션 제목(선택사항)" : isSurveyHeader ? "설문지 설명" : "설명(선택사항)" : kind === "title" ? isSurveyHeader ? "Untitled form" : "Section title (optional)" : "Description (optional)"}
          value={form[field]} onChange={value => setForm(current => ({...current, [field]: value}))}
          ariaLabel={`${language === "ko" ? "국문" : "영문"} 섹션 ${kind === "title" ? "제목" : "설명"}`} disabled={isOngoing}
          inputClassName={`!bg-transparent !px-0 !h-auto !py-0 !min-h-6 !font-normal ${isSurveyHeader && kind === "title" ? "!text-3xl !leading-tight !min-h-9" : "!text-base !leading-6"}`} /></div>;
      }))}
    </div>
    {error ? <p role="alert" className="mt-3 text-sm text-red-600">{error}</p> : null}
  </div>;
}
