import { useState, useEffect } from "react";
import { X, Plus, Trash2, Check } from "lucide-react";
import type { QuestionType } from "@soc/contracts";
import { SelectDropdown } from "../atoms/select-dropdown";

const QUESTION_TYPES: { value: QuestionType; label: string }[] = [
  { value: "short_text", label: "단답형" },
  { value: "long_text", label: "장문형" },
  { value: "single_choice", label: "단일 선택" },
  { value: "multiple_choice", label: "복수 선택" },
  { value: "dropdown", label: "드롭다운" },
  { value: "date", label: "날짜" },
  { value: "time", label: "시간" },
  { value: "datetime", label: "날짜+시간" },
];

export interface QuestionFormState {
  titleKo: string;
  titleEn: string;
  descriptionKo: string;
  descriptionEn: string;
  questionType: QuestionType;
  options: { value: string; labelKo: string; labelEn: string }[];
  answerRegex: string;
  isRequired: boolean;
  editDeadlineAt: string;
}

interface QuestionEditorModalProps {
  initial: QuestionFormState;
  isKoreanOnly?: boolean;
  isOngoing?: boolean;
  onSave: (q: QuestionFormState) => void;
  onCancel: () => void;
}

export function QuestionEditorModal({
  initial,
  isKoreanOnly = false,
  isOngoing = false,
  onSave,
  onCancel,
}: QuestionEditorModalProps) {
  const [form, setForm] = useState<QuestionFormState>(initial);
  const [activeTab, setActiveTab] = useState<"ko" | "en">("ko");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isKoreanOnly && activeTab === "en") {
      setActiveTab("ko");
    }
  }, [isKoreanOnly, activeTab]);

  const set = <K extends keyof QuestionFormState>(key: K, val: QuestionFormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: val }));

  const needsOptions = ["single_choice", "multiple_choice", "dropdown"].includes(form.questionType);

  const addOption = () => {
    set("options", [...form.options, { value: "", labelKo: "", labelEn: "" }]);
  };

  const removeOption = (i: number) => {
    set("options", form.options.filter((_, idx) => idx !== i));
  };

  const updateOption = (i: number, field: "value" | "labelKo" | "labelEn", val: string) => {
    const next = [...form.options];
    next[i] = { ...next[i], [field]: val };
    set("options", next);
  };

  const handleSave = () => {
    if (!form.titleKo.trim()) {
      setError("국문 제목은 필수입니다.");
      setActiveTab("ko");
      return;
    }
    if (!isKoreanOnly && !form.titleEn.trim()) {
      setError("영문 제목은 필수입니다.");
      setActiveTab("en");
      return;
    }

    if (needsOptions) {
      if (form.options.length === 0) {
        setError("최소 하나의 선택지가 필요합니다.");
        return;
      }
      for (let i = 0; i < form.options.length; i++) {
        const opt = form.options[i];
        if (!opt.value.trim() || !opt.labelKo.trim()) {
          setError(`선택지 ${i + 1}의 값과 국문 라벨은 필수입니다.`);
          return;
        }
        if (!isKoreanOnly && !opt.labelEn.trim()) {
          setError(`선택지 ${i + 1}의 영문 라벨은 필수입니다.`);
          return;
        }
      }
    }

    setError(null);
    onSave(form);
  };

  const inputCls =
    "w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-kaist-darkgreen transition-all placeholder:text-kaist-grey/40 text-kaist-black font-medium hover:border-gray-300 disabled:opacity-50 disabled:bg-gray-50 disabled:cursor-not-allowed";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto p-8 space-y-6 border border-kaist-grey/10">
        <div className="flex justify-between items-center border-b border-gray-100 pb-4">
          <h3 className="text-xl font-bold text-kaist-black">질문 편집</h3>
          <button
            onClick={onCancel}
            className="text-kaist-grey hover:text-kaist-black transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* 언어 탭 */}
        <div className="flex bg-gray-100 p-1.5 rounded-xl w-full border border-kaist-grey/10">
          <button
            type="button"
            onClick={() => setActiveTab("ko")}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
              activeTab === "ko"
                ? "bg-white text-kaist-darkgreen shadow-md shadow-kaist-grey/10"
                : "text-kaist-grey hover:bg-white/50"
            }`}
          >
            국문 (Korean)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("en")}
            disabled={isKoreanOnly}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
              isKoreanOnly ? "opacity-35 cursor-not-allowed text-kaist-grey/50" : "hover:bg-white/50 text-kaist-darkgreen"
            } ${
              activeTab === "en"
                ? "bg-white text-kaist-darkgreen shadow-md shadow-kaist-grey/10"
                : "text-kaist-grey"
            }`}
            title={isKoreanOnly ? "한국어 사용자 전용 설문이므로 영문을 작성할 수 없습니다." : ""}
          >
            영문 (English)
          </button>
        </div>

        <div className="space-y-6">
          <div>
            <label className="block text-sm font-bold text-kaist-black mb-2">제목 *</label>
            {activeTab === "ko" ? (
              <input
                key="qTitleKo"
                className={inputCls}
                placeholder="질문을 입력하세요"
                value={form.titleKo}
                onChange={(e) => set("titleKo", e.target.value)}
              />
            ) : (
              <input
                key="qTitleEn"
                className={inputCls}
                placeholder="Enter your question in English"
                value={form.titleEn}
                onChange={(e) => set("titleEn", e.target.value)}
              />
            )}
          </div>

          <div>
            <label className="block text-sm font-bold text-kaist-black mb-2">설명</label>
            {activeTab === "ko" ? (
              <textarea
                key="qDescKo"
                className={`${inputCls} min-h-[80px] resize-y`}
                placeholder="질문에 대한 추가 설명을 입력하세요"
                value={form.descriptionKo}
                onChange={(e) => set("descriptionKo", e.target.value)}
              />
            ) : (
              <textarea
                key="qDescEn"
                className={`${inputCls} min-h-[80px] resize-y`}
                placeholder="Enter additional description in English"
                value={form.descriptionEn}
                onChange={(e) => set("descriptionEn", e.target.value)}
              />
            )}
          </div>
        </div>

        <div className="space-y-6 pt-4 border-t border-gray-100">
          <div>
            <label className="block text-sm font-bold text-kaist-black mb-2">질문 유형 *</label>
            <SelectDropdown
              value={form.questionType}
              options={QUESTION_TYPES}
              onChange={(val) => set("questionType", val as QuestionType)}
              disabled={isOngoing}
            />
          </div>

          {needsOptions && (
            <div>
              <label className="block text-sm font-bold text-kaist-black mb-3">선택지</label>
              <div className="space-y-3 mb-4 max-h-60 overflow-y-auto pr-1">
                {form.options.map((opt, i) => (
                  <div key={i} className="flex gap-3 items-center group">
                    <input
                      className={`${inputCls} flex-[0.5] font-mono text-xs`}
                      placeholder="값 (ID)"
                      value={opt.value}
                      disabled={isOngoing}
                      onChange={(e) => updateOption(i, "value", e.target.value)}
                    />
                    {activeTab === "ko" ? (
                      <input
                        key={`labelKo-${i}`}
                        className={`${inputCls} flex-1`}
                        placeholder="선택지 라벨 (국문)"
                        value={opt.labelKo}
                        onChange={(e) => updateOption(i, "labelKo", e.target.value)}
                      />
                    ) : (
                      <input
                        key={`labelEn-${i}`}
                        className={`${inputCls} flex-1`}
                        placeholder="Option label (English)"
                        value={opt.labelEn}
                        onChange={(e) => updateOption(i, "labelEn", e.target.value)}
                      />
                    )}
                    {!isOngoing && (
                      <button
                        onClick={() => removeOption(i)}
                        className="p-2 text-kaist-grey hover:text-red-500 transition-colors rounded-full hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              {!isOngoing && (
                <button
                  onClick={addOption}
                  className="inline-flex items-center gap-1.5 text-kaist-darkgreen text-xs font-bold hover:bg-kaist-lightgreen/20 px-3 py-2 rounded-xl transition-all border border-kaist-darkgreen/20"
                >
                  <Plus className="w-4 h-4" />
                  선택지 추가
                </button>
              )}
            </div>
          )}

          <div className="flex items-center justify-between bg-gray-50 p-4 rounded-xl border border-kaist-grey/5">
            <span className="text-sm font-bold text-kaist-black">필수 응답</span>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={form.isRequired}
                onChange={(e) => set("isRequired", e.target.checked)}
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-kaist-darkgreen/30 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-kaist-darkgreen"></div>
            </label>
          </div>

          {form.questionType === "short_text" && (
            <div>
              <label className="block text-sm font-bold text-kaist-black mb-2">
                응답 정규식 (선택)
              </label>
              <input
                className={inputCls}
                placeholder="예: ^[0-9]+$"
                value={form.answerRegex}
                onChange={(e) => set("answerRegex", e.target.value)}
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-bold text-kaist-black mb-2">
              단일 응답 마감 시각 (선택)
            </label>
            <input
              type="datetime-local"
              className={inputCls}
              value={form.editDeadlineAt}
              onChange={(e) => set("editDeadlineAt", e.target.value)}
            />
          </div>
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-2.5 rounded-xl text-xs font-semibold animate-in fade-in slide-in-from-top-1">
              {error}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
          <button
            onClick={onCancel}
            className="px-5 py-2.5 text-sm font-bold text-kaist-grey bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
          >
            취소
          </button>
          <button
            onClick={handleSave}
            className="px-5 py-2.5 text-sm font-bold text-white bg-kaist-darkgreen hover:bg-kaist-darkgreen/90 rounded-xl shadow-lg shadow-kaist-darkgreen/15 transition-all active:scale-95 flex items-center gap-1.5"
          >
            <Check className="w-4 h-4" />
            완료
          </button>
        </div>
      </div>
    </div>
  );
}
