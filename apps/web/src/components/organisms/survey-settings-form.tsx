import { useEffect, useMemo, useState } from "react";
import { useFormContext, Controller } from "react-hook-form";
import { Check } from "lucide-react";
import type { ArticleListItem } from "@soc/contracts";
import { RichTextEditor } from "./rich-text-editor";
import { AdminFormField } from "@/components/ui/admin-page";
import { AdminSelectDropdown } from "@/components/ui/admin-select";
import { UiInput } from "@/components/ui/form-control";
import { SegmentedControl } from "@/components/ui/segmented-control";

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
  kind: "GENERAL" | "SURVEY" | "VOTE" | "APPLICATION" | "EVENT";
  resultVisibility: "PRIVATE" | "PUBLIC";
  feePayersOnly?: boolean;
  isKoreanOnly?: boolean;
  allowMultipleResponses?: boolean;
  allowResponseEdit?: boolean;
  isPublished?: boolean;
  showOnCalendar?: boolean;
  isAlwaysOpen?: boolean;
  isAllDay?: boolean;
  maxResponseCount?: string;
  openAt: string;
  closeAt: string;
  connectedArticleId?: string;
}

interface SurveySettingsFormProps {
  mode?: "all" | "basic" | "delivery";
  isOngoing?: boolean;
  articleSearchResults: ArticleListItem[];
  selectedArticleTitle: string | null;
  onFetchArticles: () => Promise<void>;
  onSelectArticle: (articleId: string, title: string) => void;
  onSubmit: (values: SurveySettingsFormValues) => void;
}

export function SurveySettingsForm({
  mode = "all",
  isOngoing = false,
  articleSearchResults,
  selectedArticleTitle,
  onFetchArticles,
  onSelectArticle,
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
  const isAllDay = Boolean(watch("isAllDay"));
  const connectedArticleId = watch("connectedArticleId") ?? "";
  const openAt = watch("openAt") ?? "";
  const closeAt = watch("closeAt") ?? "";

  const articleOptions = useMemo(() => {
    const options = articleSearchResults.map((article) => ({
      value: String(article.articleId),
      label: `#${article.articleId} · ${article.titleKo}`,
    }));
    if (
      connectedArticleId &&
      selectedArticleTitle &&
      !options.some((option) => option.value === connectedArticleId)
    ) {
      options.unshift({
        value: connectedArticleId,
        label: `#${connectedArticleId} · ${selectedArticleTitle}`,
      });
    }
    return [{ value: "", label: "연결 게시글 없음" }, ...options];
  }, [articleSearchResults, connectedArticleId, selectedArticleTitle]);

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

  const toDateOnly = (value: string) =>
    /^\d{4}-\d{2}-\d{2}/.test(value) ? value.slice(0, 10) : "";
  const toDateTime = (value: string, time: string) => {
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value)) {
      return value.slice(0, 16);
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return `${value}T${time}`;
    }
    return "";
  };

  const handleAllDayChange = (checked: boolean) => {
    setValue("isAllDay", checked);
    if (checked) {
      setValue("openAt", toDateOnly(watch("openAt") ?? ""));
      setValue("closeAt", toDateOnly(watch("closeAt") ?? ""));
    } else {
      setValue("openAt", toDateTime(watch("openAt") ?? "", "09:00"));
      setValue("closeAt", toDateTime(watch("closeAt") ?? "", "18:00"));
    }
  };

  const inputCls =
    "h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-normal text-[#172033] outline-none transition-colors placeholder:text-slate-400 hover:border-slate-300 focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/10 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:opacity-60";

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <fieldset
        className="m-0 min-w-0 space-y-8 border-0 p-0"
      >
      <div className={mode === "all" ? "grid grid-cols-1 items-stretch gap-6 lg:grid-cols-3" : "grid grid-cols-1"}>
        {/* 좌측 메인 영역 */}
        {mode !== "delivery" ? <div className={`${mode === "all" ? "lg:col-span-2" : ""} h-full space-y-5 rounded-xl border border-slate-200 bg-white p-5 shadow-sm md:p-6`}>
          {/* 탭 및 Korean Only 옵션 */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <SegmentedControl
              ariaLabel="설문 언어"
              role="tablist"
              value={activeTab}
              onChange={setActiveTab}
              options={[
                { value: "ko", label: "국문" },
                { value: "en", label: "영문", disabled: isKoreanOnly },
              ]}
            />

            <div className="flex items-center gap-4 flex-wrap">
              <label
                className={`flex items-center gap-2.5 ${
                  isOngoing ? "opacity-50 cursor-not-allowed" : "cursor-pointer"
                }`}
              >
                <UiInput
                  type="checkbox"
                  className="size-4 rounded border-slate-300 accent-brand-primary"
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
                  className="text-sm font-normal text-[#344054]"
                >
                  국문 전용
                </span>
              </label>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              {activeTab === "ko" ? (
                <UiInput
                  key="titleKo"
                  aria-label="설문 제목"
                  className={inputCls}
                  placeholder="설문 제목"
                  {...register("titleKo")}
                />
              ) : (
                <UiInput
                  key="titleEn"
                  aria-label="Survey title"
                  className={inputCls}
                  placeholder="Survey title"
                  {...register("titleEn")}
                />
              )}
              {activeTab === "ko" && errors.titleKo && (
                <p className="mt-1 text-xs font-normal text-red-500">
                  {errors.titleKo.message as string}
                </p>
              )}
              {activeTab === "en" && errors.titleEn && (
                <p className="mt-1 text-xs font-normal text-red-500">
                  {errors.titleEn.message as string}
                </p>
              )}
            </div>

            <div>
              {activeTab === "ko" ? (
                <Controller
                  name="descriptionKo"
                  control={control}
                  render={({ field }) => (
                    <RichTextEditor
                      className="!mx-0 !max-w-none"
                      compact
                      content={field.value ?? ""}
                      onChange={field.onChange}
                      lang="ko"
                      placeholder="설문 설명을 입력하세요"
                    />
                  )}
                />
              ) : (
                <Controller
                  name="descriptionEn"
                  control={control}
                  render={({ field }) => (
                    <RichTextEditor
                      className="!mx-0 !max-w-none"
                      compact
                      content={field.value ?? ""}
                      onChange={field.onChange}
                      lang="en"
                      placeholder="Enter a survey description"
                    />
                  )}
                />
              )}
            </div>
          </div>
        </div> : null}

        {/* 우측 메타데이터 영역 */}
        {mode !== "basic" ? <div className={`${mode === "all" ? "lg:col-span-1" : ""} h-full space-y-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm md:p-6`}>
            <div className="flex items-center justify-between border-b border-kaist-grey/10 pb-4">
              <span className="text-sm font-normal text-[#172033]">
                메타데이터 설정
              </span>
              <div className="flex items-center gap-2">
              {isPublished ? (
                <span className="inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-xs font-normal text-emerald-700 border border-emerald-200">
                  게시됨
                </span>
              ) : (
                <span className="inline-flex items-center rounded-full bg-slate-50 px-3 py-1 text-xs font-normal text-[#344054] border border-slate-200">
                  임시저장
                </span>
              )}
            </div>
          </div>

          <div className="space-y-5">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <AdminFormField label="유형 *">
                <Controller
                  name="kind"
                  control={control}
                  render={({ field }) => (
                    <AdminSelectDropdown
                      value={field.value}
                      options={SURVEY_KINDS}
                      onChange={field.onChange}
                      disabled={isOngoing}
                    />
                  )}
                />
              </AdminFormField>

              <AdminFormField label="결과 공개 범위 *">
                <Controller
                  name="resultVisibility"
                  control={control}
                  render={({ field }) => (
                    <AdminSelectDropdown
                      value={field.value}
                      options={SURVEY_VISIBILITIES}
                      onChange={field.onChange}
                      disabled={isOngoing}
                    />
                  )}
                />
              </AdminFormField>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label
                className={`flex items-center gap-3 group ${
                  isOngoing ? "opacity-50 cursor-not-allowed" : "cursor-pointer"
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all shrink-0 ${
                    isAlwaysOpen
                      ? "bg-kaist-darkgreen border-kaist-darkgreen shadow-sm shadow-kaist-darkgreen/10"
                      : "border-kaist-grey/30 group-hover:border-kaist-darkgreen"
                  }`}
                >
                  {isAlwaysOpen && (
                    <Check className="w-3.5 h-3.5 text-white" strokeWidth={4} />
                  )}
                </div>
                <UiInput
                  type="checkbox"
                  className="hidden"
                  checked={isAlwaysOpen}
                  disabled={isOngoing}
                  onChange={(e) =>
                    !isOngoing && setValue("isAlwaysOpen", e.target.checked)
                  }
                />
                <span className="text-sm font-normal text-[#172033]">
                  상시 진행
                </span>
              </label>

              <label
                className={`flex items-center gap-3 group ${
                  isOngoing || isAlwaysOpen
                    ? "opacity-50 cursor-not-allowed"
                    : "cursor-pointer"
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all shrink-0 ${
                    isAllDay
                      ? "bg-kaist-darkgreen border-kaist-darkgreen shadow-sm shadow-kaist-darkgreen/10"
                      : "border-kaist-grey/30 group-hover:border-kaist-darkgreen"
                  }`}
                >
                  {isAllDay && (
                    <Check className="w-3.5 h-3.5 text-white" strokeWidth={4} />
                  )}
                </div>
                <UiInput
                  type="checkbox"
                  className="hidden"
                  checked={isAllDay}
                  disabled={isOngoing || isAlwaysOpen}
                  onChange={(e) =>
                    !isOngoing && !isAlwaysOpen && handleAllDayChange(e.target.checked)
                  }
                />
                <span className="text-sm font-normal text-[#172033]">종일</span>
              </label>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <AdminFormField label={isAllDay ? "시작 날짜 *" : "시작 시각 (Asia/Seoul) *"}>
                <UiInput
                  type={isAllDay ? "date" : "datetime-local"}
                  className={inputCls}
                  disabled={isOngoing || isAlwaysOpen}
                  {...register("openAt")}
                  value={isAllDay ? toDateOnly(openAt) : toDateTime(openAt, "09:00")}
                />
                {errors.openAt && (
                  <p className="mt-1 text-xs font-normal text-red-500">
                    {errors.openAt.message as string}
                  </p>
                )}
              </AdminFormField>

              <AdminFormField label={isAllDay ? "종료 날짜 (선택)" : "종료 시각 (선택)"}>
                <UiInput
                  type={isAllDay ? "date" : "datetime-local"}
                  className={inputCls}
                  disabled={isOngoing || isAlwaysOpen}
                  {...register("closeAt")}
                  value={isAllDay ? toDateOnly(closeAt) : toDateTime(closeAt, "18:00")}
                />
                {errors.closeAt && (
                  <p className="mt-1 text-xs font-normal text-red-500">
                    {errors.closeAt.message as string}
                  </p>
                )}
              </AdminFormField>
            </div>

            <AdminFormField label="최대 응답 수 (선택)">
              <UiInput
                type="number"
                className={`${inputCls} w-1/2 min-w-[160px]`}
                placeholder="제한 없음"
                disabled={isOngoing}
                {...register("maxResponseCount")}
              />
              {errors.maxResponseCount && (
                <p className="mt-1 text-xs font-normal text-red-500">
                  {errors.maxResponseCount.message as string}
                </p>
              )}
            </AdminFormField>

            <div className="pt-2 border-t border-kaist-grey/10" />

            <div className="grid grid-cols-1 gap-3 py-1 sm:grid-cols-2">
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
                <UiInput
                  type="checkbox"
                  className="hidden"
                  checked={feePayersOnly}
                  disabled={isOngoing}
                  onChange={(e) =>
                    !isOngoing && setValue("feePayersOnly", e.target.checked)
                  }
                />
                <span className="text-sm font-normal text-[#172033]">
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
                <UiInput
                  type="checkbox"
                  className="hidden"
                  checked={showOnCalendar}
                  onChange={(e) => setValue("showOnCalendar", e.target.checked)}
                />
                <span className="text-sm font-normal text-[#172033]">
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
                <UiInput
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
                <span className="text-sm font-normal text-[#172033]">
                  복수 응답 허용
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
                <UiInput
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
                <span className="text-sm font-normal text-[#172033]">
                  응답 제출 후 수정 허용
                </span>
              </label>
            </div>

            <div className="pt-2 border-t border-kaist-grey/10" />

            <AdminFormField label="연결 게시글 (선택)">
              <AdminSelectDropdown
                ariaLabel="연결 게시글"
                value={connectedArticleId}
                options={articleOptions}
                onChange={(articleId) => {
                  const option = articleOptions.find((item) => item.value === articleId);
                  const article = articleSearchResults.find(
                    (item) => String(item.articleId) === articleId,
                  );
                  onSelectArticle(
                    articleId,
                    article?.titleKo ??
                      (articleId === connectedArticleId
                        ? selectedArticleTitle ?? ""
                        : option?.label ?? ""),
                  );
                }}
                onOpenChange={(open) => {
                  if (open && articleSearchResults.length === 0) void onFetchArticles();
                }}
                emptyLabel="불러온 게시글이 없습니다."
                className="w-full"
              />
            </AdminFormField>
          </div>
        </div> : null}
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

      </fieldset>
    </form>
  );
}
