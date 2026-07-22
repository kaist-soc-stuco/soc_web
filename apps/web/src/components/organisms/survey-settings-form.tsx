import { useState, useEffect } from "react";
import { useFormContext, Controller } from "react-hook-form";
import { Check, Search, X } from "lucide-react";
import type { ArticleListItem } from "@soc/contracts";
import { SelectDropdown } from "../atoms/select-dropdown";

export const SURVEY_KINDS = [
  { value: "SURVEY", label: "일반 설문" },
  { value: "VOTE", label: "투표" },
  { value: "APPLICATION", label: "신청서/행사 접수" },
  { value: "EVENT", label: "행사" },
];

export const SURVEY_VISIBILITIES = [
  { value: "PUBLIC", label: "공개 (전체 공개)" },
  { value: "PRIVATE", label: "비공개 (결과 숨김)" },
];

export interface SurveySettingsFormValues {
  titleKo: string;
  titleEn?: string;
  descriptionKo?: string;
  descriptionEn?: string;
  kind: string;
  resultVisibility: "PRIVATE" | "PUBLIC";
  feePayersOnly?: boolean;
  isKoreanOnly?: boolean;
  allowMultipleResponses?: boolean;
  allowResponseEdit?: boolean;
  isPublished?: boolean;
  showOnCalendar?: boolean;
  isAlwaysOpen?: boolean;
  maxResponseCount?: string;
  openAt: string;
  closeAt: string;
  connectedArticleId?: string;
}

interface SurveySettingsFormProps {
  saving: boolean;
  isEdit: boolean;
  isOngoing?: boolean;
  isArchived?: boolean;
  showArticleSearch: boolean;
  articleSearchResults: ArticleListItem[];
  selectedArticleTitle: string | null;
  onToggleArticleSearch: () => void;
  onFetchArticles: () => Promise<void>;
  onSelectArticle: (articleId: string, title: string) => void;
  onConnectedArticleChange: () => void;
  onSubmit: (values: SurveySettingsFormValues) => void;
}

export function SurveySettingsForm({
  saving,
  isEdit,
  isOngoing = false,
  isArchived = false,
  showArticleSearch,
  articleSearchResults,
  selectedArticleTitle,
  onToggleArticleSearch,
  onFetchArticles,
  onSelectArticle,
  onConnectedArticleChange,
  onSubmit,
}: SurveySettingsFormProps) {
  const [activeTab, setActiveTab] = useState<"ko" | "en">("ko");
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    control,
    formState: { errors },
  } = useFormContext<SurveySettingsFormValues>();

  const feePayersOnly = Boolean(watch("feePayersOnly"));
  const isKoreanOnly = Boolean(watch("isKoreanOnly"));
  const allowMultipleResponses = Boolean(watch("allowMultipleResponses"));
  const allowResponseEdit = Boolean(watch("allowResponseEdit"));
  const isPublished = Boolean(watch("isPublished"));
  const showOnCalendar = Boolean(watch("showOnCalendar"));
  const isAlwaysOpen = Boolean(watch("isAlwaysOpen"));
  const connectedArticleId = watch("connectedArticleId") ?? "";

  useEffect(() => {
    if (isKoreanOnly && activeTab === "en") {
      setActiveTab("ko");
    }
  }, [isKoreanOnly, activeTab]);

  useEffect(() => {
    if (!isAlwaysOpen) return;
    setValue("openAt", "");
    setValue("closeAt", "");
  }, [isAlwaysOpen, setValue]);

  const inputCls =
    "w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-kaist-darkgreen transition-all placeholder:text-kaist-grey/40 text-kaist-black font-medium hover:border-gray-300 disabled:opacity-50 disabled:bg-gray-50 disabled:cursor-not-allowed";

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <fieldset
        className="m-0 min-w-0 space-y-8 border-0 p-0"
        disabled={isArchived}
      >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-stretch">
        {/* 좌측 메인 영역 */}
        <div className="lg:col-span-2 h-full space-y-6 bg-white rounded-3xl border border-kaist-darkgreen/10 p-6 md:p-8 shadow-[0_20px_60px_rgba(11,31,18,0.08)]">
          {/* 탭 및 Korean Only 옵션 */}
          <div className="flex items-center justify-between flex-wrap gap-4 border-b border-kaist-grey/10 pb-4">
            <div className="flex bg-gray-100 p-1.5 rounded-xl w-full max-w-xs border border-kaist-grey/10">
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
                  isKoreanOnly
                    ? "opacity-30 cursor-not-allowed text-kaist-grey/50"
                    : "hover:bg-white/50 text-kaist-darkgreen"
                } ${
                  activeTab === "en"
                    ? "bg-white text-kaist-darkgreen shadow-md shadow-kaist-grey/10"
                    : "text-kaist-grey"
                }`}
                title={
                  isKoreanOnly
                    ? "한국어 사용자 전용 설문이므로 영문을 작성할 수 없습니다."
                    : ""
                }
              >
                영문 (English)
              </button>
            </div>

            <div className="flex items-center gap-4 flex-wrap">
              <label
                className={`flex items-center gap-3 group bg-gray-50 border border-gray-200 px-4 py-2 rounded-xl ${
                  isOngoing ? "opacity-50 cursor-not-allowed" : "cursor-pointer"
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${
                    isKoreanOnly
                      ? "bg-red-500 border-red-500 shadow-md shadow-red-500/15"
                      : "border-kaist-grey/30 group-hover:border-kaist-darkgreen"
                  }`}
                >
                  {isKoreanOnly && (
                    <Check className="w-3.5 h-3.5 text-white" strokeWidth={4} />
                  )}
                </div>
                <input
                  type="checkbox"
                  className="hidden"
                  checked={isKoreanOnly}
                  disabled={isOngoing}
                  onChange={(e) => {
                    if (isOngoing) return;
                    const checked = e.target.checked;
                    setValue("isKoreanOnly", checked);
                    if (checked) setActiveTab("ko");
                  }}
                />
                <span
                  className={`text-sm font-bold ${isKoreanOnly ? "text-red-600" : "text-kaist-black"}`}
                >
                  Korean Speakers Only
                </span>
              </label>
            </div>
          </div>

          <div className="space-y-6">
            <div>
              <label className="block text-sm font-bold text-kaist-black mb-2">
                설문 제목 *
              </label>
              {activeTab === "ko" ? (
                <input
                  key="titleKo"
                  className={inputCls}
                  placeholder="국문 제목을 입력하세요"
                  {...register("titleKo")}
                />
              ) : (
                <input
                  key="titleEn"
                  className={inputCls}
                  placeholder="Enter the title in English"
                  {...register("titleEn")}
                />
              )}
              {activeTab === "ko" && errors.titleKo && (
                <p className="mt-1 text-xs text-red-500 font-semibold">
                  {errors.titleKo.message as string}
                </p>
              )}
              {activeTab === "en" && errors.titleEn && (
                <p className="mt-1 text-xs text-red-500 font-semibold">
                  {errors.titleEn.message as string}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-bold text-kaist-black mb-2">
                설명
              </label>
              {activeTab === "ko" ? (
                <textarea
                  key="descriptionKo"
                  className={`${inputCls} min-h-[220px] resize-y`}
                  placeholder="설문에 대한 국문 설명을 입력하세요"
                  {...register("descriptionKo")}
                />
              ) : (
                <textarea
                  key="descriptionEn"
                  className={`${inputCls} min-h-[220px] resize-y`}
                  placeholder="Enter the description in English"
                  {...register("descriptionEn")}
                />
              )}
            </div>
          </div>
        </div>

        {/* 우측 메타데이터 영역 */}
        <div className="lg:col-span-1 h-full space-y-6 bg-white rounded-3xl border border-kaist-darkgreen/10 p-6 md:p-8 shadow-[0_20px_60px_rgba(11,31,18,0.08)]">
          <div className="flex items-center justify-between border-b border-kaist-grey/10 pb-4">
            <span className="text-sm font-bold text-kaist-black">
              메타데이터 설정
            </span>
            <div className="flex items-center gap-2">
              {isArchived ? (
                <span className="inline-flex items-center rounded-full bg-violet-50 px-3 py-1 text-xs font-extrabold text-violet-700 border border-violet-200">
                  보관됨
                </span>
              ) : isPublished ? (
                <span className="inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-xs font-extrabold text-emerald-700 border border-emerald-200">
                  게시됨
                </span>
              ) : (
                <span className="inline-flex items-center rounded-full bg-slate-50 px-3 py-1 text-xs font-extrabold text-slate-600 border border-slate-200">
                  임시저장
                </span>
              )}
            </div>
          </div>

          <div className="space-y-5">
            <div>
              <label className="block text-xs font-bold text-kaist-grey mb-1.5 uppercase tracking-wider">
                유형 *
              </label>
              <Controller
                name="kind"
                control={control}
                render={({ field }) => (
                  <SelectDropdown
                    value={field.value}
                    options={SURVEY_KINDS}
                    onChange={field.onChange}
                    disabled={isOngoing}
                  />
                )}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-kaist-grey mb-1.5 uppercase tracking-wider">
                결과 공개 범위 *
              </label>
              <Controller
                name="resultVisibility"
                control={control}
                render={({ field }) => (
                  <SelectDropdown
                    value={field.value}
                    options={SURVEY_VISIBILITIES}
                    onChange={field.onChange}
                    disabled={isOngoing}
                  />
                )}
              />
            </div>

            <label
              className={`flex items-start gap-3 group ${
                isOngoing ? "opacity-50 cursor-not-allowed" : "cursor-pointer"
              }`}
            >
              <div
                className={`mt-0.5 w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all shrink-0 ${
                  isAlwaysOpen
                    ? "bg-kaist-darkgreen border-kaist-darkgreen shadow-md shadow-kaist-darkgreen/15"
                    : "border-kaist-grey/30 group-hover:border-kaist-darkgreen"
                }`}
              >
                {isAlwaysOpen && (
                  <Check className="w-3.5 h-3.5 text-white" strokeWidth={4} />
                )}
              </div>
              <input
                type="checkbox"
                className="hidden"
                checked={isAlwaysOpen}
                disabled={isOngoing}
                onChange={(e) =>
                  !isOngoing && setValue("isAlwaysOpen", e.target.checked)
                }
              />
              <span className="text-sm font-bold text-kaist-black">
                상시 진행
                <span className="mt-0.5 block text-[11px] font-semibold leading-relaxed text-kaist-grey">
                  시작/마감 시각 없이 항상 참여 가능한 설문으로 게시합니다.
                </span>
              </span>
            </label>

            <div>
              <label className="block text-xs font-bold text-kaist-grey mb-1.5 uppercase tracking-wider">
                시작 시각 (Asia/Seoul) *
              </label>
              <input
                type="datetime-local"
                className={inputCls}
                disabled={isOngoing || isAlwaysOpen}
                {...register("openAt")}
              />
              {errors.openAt && (
                <p className="mt-1 text-xs text-red-500 font-semibold">
                  {errors.openAt.message as string}
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-kaist-grey mb-1.5 uppercase tracking-wider">
                마감 시각 (Asia/Seoul) *
              </label>
              <input
                type="datetime-local"
                className={inputCls}
                disabled={isOngoing || isAlwaysOpen}
                {...register("closeAt")}
              />
              {errors.closeAt && (
                <p className="mt-1 text-xs text-red-500 font-semibold">
                  {errors.closeAt.message as string}
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-kaist-grey mb-1.5 uppercase tracking-wider">
                최대 응답 수 (선택)
              </label>
              <input
                type="number"
                className={inputCls}
                placeholder="제한 없음"
                disabled={isOngoing}
                {...register("maxResponseCount")}
              />
              {errors.maxResponseCount && (
                <p className="mt-1 text-xs text-red-500 font-semibold">
                  {errors.maxResponseCount.message as string}
                </p>
              )}
            </div>

            <div className="pt-2 border-t border-kaist-grey/10" />

            <div className="flex flex-col gap-3 py-1">
              <label
                className={`flex items-center gap-3 group ${
                  isOngoing ? "opacity-50 cursor-not-allowed" : "cursor-pointer"
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${
                    feePayersOnly
                      ? "bg-kaist-darkgreen border-kaist-darkgreen shadow-md shadow-kaist-darkgreen/15"
                      : "border-kaist-grey/30 group-hover:border-kaist-darkgreen"
                  }`}
                >
                  {feePayersOnly && (
                    <Check className="w-3.5 h-3.5 text-white" strokeWidth={4} />
                  )}
                </div>
                <input
                  type="checkbox"
                  className="hidden"
                  checked={feePayersOnly}
                  disabled={isOngoing}
                  onChange={(e) =>
                    !isOngoing && setValue("feePayersOnly", e.target.checked)
                  }
                />
                <span className="text-sm font-bold text-kaist-black">
                  과비 납부자만 응답 가능
                </span>
              </label>

              <label className="flex items-center gap-3 group cursor-pointer">
                <div
                  className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${
                    showOnCalendar
                      ? "bg-kaist-darkgreen border-kaist-darkgreen shadow-md shadow-kaist-darkgreen/15"
                      : "border-kaist-grey/30 group-hover:border-kaist-darkgreen"
                  }`}
                >
                  {showOnCalendar && (
                    <Check className="w-3.5 h-3.5 text-white" strokeWidth={4} />
                  )}
                </div>
                <input
                  type="checkbox"
                  className="hidden"
                  checked={showOnCalendar}
                  onChange={(e) => setValue("showOnCalendar", e.target.checked)}
                />
                <span className="text-sm font-bold text-kaist-black">
                  캘린더에 표시
                </span>
              </label>

              <label
                className={`flex items-start gap-3 group ${
                  isOngoing ? "opacity-50 cursor-not-allowed" : "cursor-pointer"
                }`}
              >
                <div
                  className={`mt-0.5 w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all shrink-0 ${
                    allowMultipleResponses
                      ? "bg-kaist-darkgreen border-kaist-darkgreen shadow-md shadow-kaist-darkgreen/15"
                      : "border-kaist-grey/30 group-hover:border-kaist-darkgreen"
                  }`}
                >
                  {allowMultipleResponses && (
                    <Check className="w-3.5 h-3.5 text-white" strokeWidth={4} />
                  )}
                </div>
                <input
                  type="checkbox"
                  className="hidden"
                  checked={allowMultipleResponses}
                  disabled={isOngoing}
                  onChange={(e) => {
                    if (isOngoing) return;
                    const checked = e.target.checked;
                    setValue("allowMultipleResponses", checked);
                    if (checked) setValue("allowResponseEdit", false);
                  }}
                />
                <span className="text-sm font-bold text-kaist-black">
                  복수 응답 허용
                  <span className="mt-0.5 block text-[11px] font-semibold leading-relaxed text-kaist-grey">
                    체크하지 않으면 사용자별 1회만 응답할 수 있습니다.
                  </span>
                </span>
              </label>

              <label
                className={`flex items-start gap-3 group ${
                  isOngoing || allowMultipleResponses
                    ? "opacity-50 cursor-not-allowed"
                    : "cursor-pointer"
                }`}
              >
                <div
                  className={`mt-0.5 w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all shrink-0 ${
                    allowResponseEdit
                      ? "bg-kaist-darkgreen border-kaist-darkgreen shadow-md shadow-kaist-darkgreen/15"
                      : "border-kaist-grey/30 group-hover:border-kaist-darkgreen"
                  }`}
                >
                  {allowResponseEdit && (
                    <Check className="w-3.5 h-3.5 text-white" strokeWidth={4} />
                  )}
                </div>
                <input
                  type="checkbox"
                  className="hidden"
                  checked={allowResponseEdit}
                  disabled={isOngoing || allowMultipleResponses}
                  onChange={(e) =>
                    !isOngoing &&
                    !allowMultipleResponses &&
                    setValue("allowResponseEdit", e.target.checked)
                  }
                />
                <span className="text-sm font-bold text-kaist-black">
                  응답 제출 후 수정 허용
                  <span className="mt-0.5 block text-[11px] font-semibold leading-relaxed text-kaist-grey">
                    1회 응답 설문에서만 마감 전까지 본인 응답을 수정할 수 있습니다.
                  </span>
                </span>
              </label>
            </div>

            <div className="pt-2 border-t border-kaist-grey/10" />

            <div className="space-y-2">
              <label className="block text-xs font-bold text-kaist-grey uppercase tracking-wider">
                연결 게시글 (선택)
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    className={inputCls}
                    placeholder="ID 또는 제목 검색"
                    value={connectedArticleId}
                    onChange={(event) => {
                      setValue("connectedArticleId", event.target.value);
                      onConnectedArticleChange();
                    }}
                  />
                  {selectedArticleTitle && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-kaist-darkgreen font-bold bg-kaist-lightgreen/20 px-2.5 py-1 rounded-lg truncate max-w-[100px]">
                      {selectedArticleTitle}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    await onFetchArticles();
                    onToggleArticleSearch();
                  }}
                  className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-kaist-black text-xs font-bold rounded-xl border border-gray-200 transition-colors shrink-0 flex items-center gap-1"
                >
                  <Search className="w-3.5 h-3.5 text-kaist-grey" />
                  {showArticleSearch ? "닫기" : "찾기"}
                </button>
              </div>
              <div className="relative z-20">
                {showArticleSearch && (
                  <div className="mt-2 border border-gray-200 rounded-xl bg-white shadow-xl max-h-60 overflow-y-auto absolute w-full top-0">
                    <div className="p-2 border-b border-gray-100 bg-gray-50 flex justify-between items-center sticky top-0">
                      <span className="text-[10px] font-bold text-kaist-grey/70 uppercase tracking-wider">
                        최근 게시글 (최대 30개)
                      </span>
                      <button
                        type="button"
                        onClick={onToggleArticleSearch}
                        className="text-kaist-grey hover:text-kaist-black transition-colors"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    {articleSearchResults.length === 0 && (
                      <div className="p-4 text-xs text-kaist-grey/60 text-center font-medium">
                        불러온 게시글이 없습니다.
                      </div>
                    )}
                    {articleSearchResults.map((art) => (
                      <button
                        key={art.articleId}
                        type="button"
                        onClick={() =>
                          onSelectArticle(String(art.articleId), art.titleKo)
                        }
                        className="w-full text-left px-3 py-2 text-xs hover:bg-kaist-lightgreen/10 border-b border-gray-100 last:border-0 transition-colors group flex items-center gap-2"
                      >
                        <span className="font-bold text-kaist-grey group-hover:text-kaist-darkgreen transition-colors shrink-0">
                          #{art.articleId}
                        </span>
                        <span className="text-kaist-black font-semibold truncate">
                          {art.titleKo}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 에러 요약 박스 */}
      {Object.keys(errors).length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-5 mt-6 animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="flex items-start gap-3">
            <div className="text-red-500 mt-0.5">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>
            <div>
              <h4 className="text-sm font-bold text-red-800 mb-1">
                입력 내용을 확인해주세요
              </h4>
              <ul className="text-xs text-red-600 font-medium space-y-1">
                {Object.entries(errors).map(([key, error]) => (
                  <li key={key}>• {error?.message as string}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* 고정 하단 바 스타일 버튼 */}
      <div className="bg-white rounded-3xl border border-kaist-darkgreen/10 p-6 shadow-[0_20px_60px_rgba(11,31,18,0.08)] flex justify-end gap-3">
        {isArchived ? (
          <p className="text-sm font-semibold text-violet-700">
            보관된 설문은 읽기 전용입니다. 새 변경본은 설문 목록에서 복제하세요.
          </p>
        ) : isOngoing ? (
          <button
            type="submit"
            disabled={saving}
            className="px-8 py-3 bg-kaist-darkgreen hover:bg-kaist-darkgreen/90 text-white font-bold rounded-xl shadow-lg shadow-kaist-darkgreen/15 disabled:opacity-50 transition-all flex items-center gap-2 cursor-pointer text-sm border-0"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
              <polyline points="17 21 17 13 7 13 7 21" />
              <polyline points="7 3 7 8 15 8" />
            </svg>
            {saving ? "저장 중..." : "변경사항 저장"}
          </button>
        ) : (
          <>
            <button
              type="button"
              disabled={saving}
              onClick={() => {
                setValue("isPublished", false);
                handleSubmit(onSubmit)();
              }}
              className="px-6 py-3 bg-white text-kaist-darkgreen border border-kaist-darkgreen/30 font-bold rounded-xl shadow-sm hover:bg-kaist-darkgreen/5 hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:hover:translate-y-0 transition-all flex items-center gap-2 cursor-pointer text-sm"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                <polyline points="17 21 17 13 7 13 7 21" />
                <polyline points="7 3 7 8 15 8" />
              </svg>
              {saving ? "저장 중..." : "임시저장"}
            </button>

            <button
              type="button"
              disabled={saving}
              onClick={() => {
                setValue("isPublished", true);
                handleSubmit(onSubmit)();
              }}
              className="px-8 py-3 bg-kaist-darkgreen text-white font-bold rounded-xl shadow-lg shadow-kaist-darkgreen/15 hover:bg-kaist-darkgreen/90 hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:hover:translate-y-0 transition-all flex items-center gap-2 cursor-pointer text-sm border-0"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
              {saving ? "게시 중..." : "설문 게시하기"}
            </button>
          </>
        )}
      </div>
      </fieldset>
    </form>
  );
}
