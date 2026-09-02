import { useEffect, useMemo, useRef, useState } from "react";
import { useFormContext, Controller } from "react-hook-form";
import { createApiClient } from "@soc/api-client";
import { Check, ChevronDown, Search, X } from "lucide-react";
import type { ArticleListItem } from "@soc/contracts";
import { RichTextEditor } from "./rich-text-editor";
import { AdminFormField } from "@/components/ui/admin-page";
import { AdminSelectDropdown } from "@/components/ui/admin-select";
import { UiInput } from "@/components/ui/form-control";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { resolveApiBaseUrl } from "@/lib/api-base-url";
import { resolveAssetUrl } from "@/lib/asset-url";

export const SURVEY_KINDS = [
  { value: "SURVEY", label: "일반 설문" },
  { value: "APPLICATION", label: "행사 신청" },
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
  descriptionImageUrlKo?: string | null;
  descriptionImageUrlEn?: string | null;
  kind: "SURVEY" | "APPLICATION";
  resultVisibility: "PRIVATE" | "PUBLIC";
  feePayersOnly?: boolean;
  eligibleSocAffiliations: Array<"PRIMARY">;
  academicEligibility: "ANY" | "ENROLLED_ONLY";
  allowAnonymous?: boolean;
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
  onFetchArticles: (query?: string) => Promise<void>;
  onSelectArticle: (articleId: string, title: string) => void;
  onSubmit: (values: SurveySettingsFormValues) => void;
}

const escapeHtmlAttribute = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");

const appendInlineImage = (content: string, src: string) =>
  `${content.trim() ? `${content}<p><br /></p>` : ""}<p><img src="${escapeHtmlAttribute(src)}" alt="" /></p>`;

function SettingCheckbox({
  checked,
  className,
  disabled = false,
  hint,
  label,
  onChange,
}: {
  checked: boolean;
  className?: string;
  disabled?: boolean;
  hint?: string;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label
      className={`flex min-w-0 items-start gap-2.5 rounded-lg px-2 py-2 transition-colors ${className ?? ""} ${
        disabled
          ? "cursor-not-allowed opacity-50"
          : "cursor-pointer hover:bg-slate-50"
      }`}
    >
      <UiInput
        type="checkbox"
        className="mt-0.5 size-4 shrink-0 rounded border-slate-300 accent-brand-primary"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span className="min-w-0">
        <span className="block text-sm font-medium leading-5 text-[#172033]">
          {label}
        </span>
        {hint ? (
          <span className="mt-0.5 block text-xs font-normal leading-4 text-slate-400">
            {hint}
          </span>
        ) : null}
      </span>
    </label>
  );
}

function ArticleCombobox({
  articles,
  connectedArticleId,
  onFetchArticles,
  onSelectArticle,
  selectedArticleTitle,
}: {
  articles: ArticleListItem[];
  connectedArticleId: string;
  onFetchArticles: (query?: string) => Promise<void>;
  onSelectArticle: (articleId: string, title: string) => void;
  selectedArticleTitle: string | null;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selectedLabel = connectedArticleId
    ? `#${connectedArticleId} · ${selectedArticleTitle || "연결된 게시글"}`
    : "";

  useEffect(() => {
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
        setQuery("");
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setIsOpen(false);
      setQuery("");
    };

    document.addEventListener("pointerdown", closeOnOutsidePointer);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePointer);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [isOpen]);

  const open = () => {
    setIsOpen(true);
    if (articles.length === 0) void onFetchArticles("");
  };

  const queueSearch = (nextQuery: string) => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      void onFetchArticles(nextQuery);
    }, 250);
  };

  const selectArticle = (articleId: string, title: string) => {
    onSelectArticle(articleId, title);
    setIsOpen(false);
    setQuery("");
  };

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute left-3 top-1/2 z-10 size-4 -translate-y-1/2 text-slate-400"
        />
        <UiInput
          type="search"
          role="combobox"
          aria-label="연결 게시글"
          aria-expanded={isOpen}
          aria-autocomplete="list"
          placeholder="게시글 제목 또는 번호 검색"
          value={isOpen ? query : selectedLabel}
          onFocus={() => {
            if (!isOpen) setQuery("");
            open();
          }}
          onChange={(event) => {
            const nextQuery = event.target.value;
            setQuery(nextQuery);
            if (!isOpen) setIsOpen(true);
            if (nextQuery.trim()) queueSearch(nextQuery);
          }}
          className="h-[var(--ui-control-height)] w-full border-[var(--ui-border-subtle)] pl-9 pr-20 text-[length:var(--ui-control-font-size)] font-normal"
        />
        <div className="absolute right-1 top-1/2 flex -translate-y-1/2 items-center gap-0.5">
          {connectedArticleId ? (
            <button
              type="button"
              aria-label="연결 게시글 선택 해제"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => selectArticle("", "")}
              className="inline-flex size-8 items-center justify-center rounded-md border-0 bg-transparent text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            >
              <X className="size-4" />
            </button>
          ) : null}
          <button
            type="button"
            aria-label={isOpen ? "연결 게시글 목록 닫기" : "연결 게시글 목록 열기"}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              if (isOpen) {
                setIsOpen(false);
                setQuery("");
              } else {
                open();
              }
            }}
            className="inline-flex size-8 items-center justify-center rounded-md border-0 bg-transparent text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <ChevronDown className={`size-4 transition-transform ${isOpen ? "rotate-180" : ""}`} />
          </button>
        </div>
      </div>

      {isOpen ? (
        <div
          role="listbox"
          className="scrollbar-hidden absolute inset-x-0 bottom-full z-30 mb-2 max-h-60 overflow-y-auto rounded-lg border border-slate-200 bg-white p-1.5 shadow-[0_8px_24px_rgb(15_23_42_/_0.10)]"
        >
          <button
            type="button"
            role="option"
            aria-selected={!connectedArticleId}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => selectArticle("", "")}
            className={`flex h-9 w-full items-center rounded-md px-2.5 text-left text-sm font-normal hover:bg-slate-50 ${
              connectedArticleId ? "text-slate-600" : "bg-brand-primary-light font-medium text-brand-primary"
            }`}
          >
            <span className="truncate">연결 게시글 없음</span>
            {!connectedArticleId ? <Check className="ml-auto size-3.5 shrink-0" /> : null}
          </button>
          {articles.length > 0 ? (
            articles.map((article) => {
              const articleId = String(article.articleId);
              const title = article.titleKo;
              const selected = articleId === connectedArticleId;
              return (
                <button
                  key={articleId}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => selectArticle(articleId, title)}
                  className={`flex h-9 w-full items-center rounded-md px-2.5 text-left text-sm font-normal hover:bg-slate-50 ${
                    selected ? "bg-brand-primary-light font-medium text-brand-primary" : "text-[#172033]"
                  }`}
                >
                  <span className="truncate">#{articleId} · {title}</span>
                  {selected ? <Check className="ml-auto size-3.5 shrink-0" /> : null}
                </button>
              );
            })
          ) : (
            <p className="px-2.5 py-2 text-sm font-normal text-slate-400">
              불러온 게시글이 없습니다.
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
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
  const apiClient = useMemo(() => createApiClient({ baseUrl: resolveApiBaseUrl() }), []);
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    getValues,
    control,
    formState: { errors },
  } = useFormContext<SurveySettingsFormValues>();

  const feePayersOnly = Boolean(watch("feePayersOnly"));
  const eligibleSocAffiliations = watch("eligibleSocAffiliations") ?? [];
  const academicEligibility = watch("academicEligibility") ?? "ANY";
  const allowAnonymous = Boolean(watch("allowAnonymous"));
  const isKoreanOnly = Boolean(watch("isKoreanOnly"));
  const allowMultipleResponses = Boolean(watch("allowMultipleResponses"));
  const allowResponseEdit = Boolean(watch("allowResponseEdit"));
  const showOnCalendar = Boolean(watch("showOnCalendar"));
  const isAlwaysOpen = Boolean(watch("isAlwaysOpen"));
  const isAllDay = Boolean(watch("isAllDay"));
  const connectedArticleId = watch("connectedArticleId") ?? "";
  const openAt = watch("openAt") ?? "";
  const closeAt = watch("closeAt") ?? "";

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

  const toggleSocAffiliation = (value: "PRIMARY") => {
    const isAdding = !eligibleSocAffiliations.includes(value);
    const next = eligibleSocAffiliations.includes(value)
      ? eligibleSocAffiliations.filter((item) => item !== value)
      : [...eligibleSocAffiliations, value];
    setValue("eligibleSocAffiliations", next, { shouldDirty: true, shouldValidate: true });
    if (isAdding) {
      setValue("allowAnonymous", false, { shouldDirty: true, shouldValidate: true });
    }
  };

  const handleDescriptionImageUpload = async (file: File) => {
    if (!file.type.startsWith("image/")) return null;

    const asset = await apiClient.uploadAsset(file);
    const src = resolveAssetUrl(asset.storageKey);
    const otherDescription = activeTab === "ko" ? "descriptionEn" : "descriptionKo";
    const currentOtherDescription = getValues(otherDescription) ?? "";
    setValue(otherDescription, appendInlineImage(currentOtherDescription, src), {
      shouldDirty: true,
      shouldValidate: true,
    });
    return src;
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
                  한국어 전용
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
                      onImageUpload={handleDescriptionImageUpload}
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
                      onImageUpload={handleDescriptionImageUpload}
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
          <div className="space-y-6">
            <section className="space-y-3" aria-labelledby="survey-basic-settings">
              <div>
                <h3 id="survey-basic-settings" className="text-sm font-semibold text-[#172033]">기본 설정</h3>
              </div>
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
            </section>

            <section className="space-y-3 border-t border-slate-100 pt-5" aria-labelledby="survey-schedule-settings">
              <div>
                <h3 id="survey-schedule-settings" className="text-sm font-semibold text-[#172033]">일정 및 기간</h3>
              </div>
              <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                <SettingCheckbox
                  checked={isAlwaysOpen}
                  disabled={isOngoing}
                  label="상시 진행"
                  onChange={(checked) => setValue("isAlwaysOpen", checked, { shouldDirty: true })}
                />
                <SettingCheckbox
                  checked={isAllDay}
                  disabled={isOngoing || isAlwaysOpen}
                  label="종일"
                  onChange={handleAllDayChange}
                />
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
                  {errors.openAt ? <p className="mt-1 text-xs font-normal text-red-500">{errors.openAt.message as string}</p> : null}
                </AdminFormField>
                <AdminFormField label={isAllDay ? "종료 날짜 (선택)" : "종료 시각 (선택)"}>
                  <UiInput
                    type={isAllDay ? "date" : "datetime-local"}
                    className={inputCls}
                    disabled={isOngoing || isAlwaysOpen}
                    {...register("closeAt")}
                    value={isAllDay ? toDateOnly(closeAt) : toDateTime(closeAt, "18:00")}
                  />
                  {errors.closeAt ? <p className="mt-1 text-xs font-normal text-red-500">{errors.closeAt.message as string}</p> : null}
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
                {errors.maxResponseCount ? <p className="mt-1 text-xs font-normal text-red-500">{errors.maxResponseCount.message as string}</p> : null}
              </AdminFormField>
            </section>

            <section className="space-y-3 border-t border-slate-100 pt-5" aria-labelledby="survey-audience-settings">
              <div>
                <h3 id="survey-audience-settings" className="text-sm font-semibold text-[#172033]">참여 대상 및 접근</h3>
              </div>
              <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                <SettingCheckbox
                  checked={allowAnonymous}
                  disabled={isOngoing}
                  label="로그인 없이 응답 허용"
                  onChange={(checked) => {
                    if (isOngoing) return;
                    setValue("allowAnonymous", checked, { shouldDirty: true, shouldValidate: true });
                    if (checked) {
                      setValue("feePayersOnly", false, { shouldDirty: true, shouldValidate: true });
                      setValue("eligibleSocAffiliations", [], { shouldDirty: true, shouldValidate: true });
                      setValue("academicEligibility", "ANY", { shouldDirty: true, shouldValidate: true });
                    }
                  }}
                />
                <SettingCheckbox
                  checked={feePayersOnly}
                  disabled={isOngoing}
                  label="과비 납부자만 응답 가능"
                  onChange={(checked) => {
                    if (isOngoing) return;
                    setValue("feePayersOnly", checked, { shouldDirty: true, shouldValidate: true });
                    if (checked) setValue("allowAnonymous", false, { shouldDirty: true, shouldValidate: true });
                  }}
                />
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <SettingCheckbox
                  checked={eligibleSocAffiliations.includes("PRIMARY")}
                  className="sm:self-end"
                  disabled={isOngoing}
                  label="전산학부 주전공"
                  onChange={() => toggleSocAffiliation("PRIMARY")}
                />
                <AdminFormField label="학적 조건">
                  <Controller
                    name="academicEligibility"
                    control={control}
                    render={({ field }) => (
                      <AdminSelectDropdown
                        value={field.value}
                        options={[
                          { value: "ANY", label: "제한 없음" },
                          { value: "ENROLLED_ONLY", label: "재학생만" },
                        ]}
                        onChange={(value) => {
                          field.onChange(value);
                          if (value !== "ANY") setValue("allowAnonymous", false, { shouldDirty: true, shouldValidate: true });
                        }}
                        disabled={isOngoing}
                      />
                    )}
                  />
                </AdminFormField>
              </div>
            </section>

            <section className="space-y-3 border-t border-slate-100 pt-5" aria-labelledby="survey-response-settings">
              <div>
                <h3 id="survey-response-settings" className="text-sm font-semibold text-[#172033]">응답 규칙</h3>
              </div>
              <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                <SettingCheckbox
                  checked={allowMultipleResponses}
                  disabled={isOngoing}
                  label="복수 응답 허용"
                  onChange={(checked) => {
                    if (isOngoing) return;
                    setValue("allowMultipleResponses", checked, { shouldDirty: true, shouldValidate: true });
                    if (checked) setValue("allowResponseEdit", false, { shouldDirty: true, shouldValidate: true });
                  }}
                />
                <SettingCheckbox
                  checked={allowResponseEdit}
                  disabled={isOngoing}
                  label="응답 제출 후 수정 허용"
                  onChange={(checked) => {
                    if (isOngoing) return;
                    setValue("allowResponseEdit", checked, { shouldDirty: true, shouldValidate: true });
                    if (checked) setValue("allowMultipleResponses", false, { shouldDirty: true, shouldValidate: true });
                  }}
                />
              </div>
            </section>

            <section className="space-y-3 border-t border-slate-100 pt-5" aria-labelledby="survey-display-settings">
              <div>
                <h3 id="survey-display-settings" className="text-sm font-semibold text-[#172033]">노출 및 연결</h3>
              </div>
              <SettingCheckbox
                checked={showOnCalendar}
                label="캘린더에 표시"
                onChange={(checked) => setValue("showOnCalendar", checked, { shouldDirty: true })}
              />
              <AdminFormField label="연결 게시글 (선택)">
                <ArticleCombobox
                  articles={articleSearchResults}
                  connectedArticleId={connectedArticleId}
                  onFetchArticles={onFetchArticles}
                  onSelectArticle={(articleId, title) => {
                    const article = articleSearchResults.find((item) => String(item.articleId) === articleId);
                    onSelectArticle(articleId, article?.titleKo ?? title);
                  }}
                  selectedArticleTitle={selectedArticleTitle}
                />
              </AdminFormField>
            </section>
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
