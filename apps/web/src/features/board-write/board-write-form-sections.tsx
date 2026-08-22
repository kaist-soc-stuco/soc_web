import { useEffect, useRef, useState, type RefObject } from "react";
import type { ArticleDraftRecord, SurveyRecord } from "@soc/contracts";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  FileText,
  Image,
  Loader2,
  Video,
  X,
} from "lucide-react";
import { isoToMs, msToDate } from "@soc/shared";

import {
  getBoardLabelFromMetadata,
  type BoardMetadata,
} from "@/lib/board-metadata";
import { SelectDropdown } from "@/components/atoms/select-dropdown";
import { BilingualRichTextEditor } from "@/components/organisms/rich-text-editor";
import { Button } from "@/components/ui/button";
import { UiInput } from "@/components/ui/form-control";

export type AttachedAsset = {
  assetId: string;
  mimeType: string;
  originalFilename: string;
  sizeBytes: number;
  storageKey: string;
  usageType: "IMAGE" | "ATTACHMENT" | "THUMBNAIL";
};

function formatFileSize(sizeBytes: number) {
  if (sizeBytes >= 1024 * 1024) {
    return `${(sizeBytes / (1024 * 1024)).toFixed(1)}MB`;
  }
  if (sizeBytes >= 1024) {
    return `${Math.round(sizeBytes / 1024)}KB`;
  }
  return `${sizeBytes}B`;
}

interface DraftControlProps {
  count: number;
  drafts: ArticleDraftRecord[];
  lang: string;
  onDelete: (draftId: string) => void | Promise<void>;
  onRestore: (draftId: string) => void | Promise<void>;
  onSave: () => void | Promise<void>;
  saving?: boolean;
}

export function BoardWriteDraftControl({
  count,
  drafts,
  lang,
  onDelete,
  onRestore,
  onSave,
  saving = false,
}: DraftControlProps) {
  const [open, setOpen] = useState(false);
  const [toastVisible, setToastVisible] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [open]);

  const saveDraft = async () => {
    await onSave();
    setToastVisible(true);
    window.setTimeout(() => setToastVisible(false), 2200);
  };

  return (
    <div ref={containerRef} className="relative inline-flex h-[var(--ui-control-height)]">
      <button
        type="button"
        className="inline-flex items-center rounded-l-[var(--ui-control-radius)] border border-r-0 border-[var(--ui-border-subtle)] bg-white px-3 text-[length:var(--ui-control-font-size)] font-semibold text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
        disabled={saving}
        onClick={() => void saveDraft()}
      >
        {saving ? (lang === "ko" ? "저장 중..." : "Saving...") : lang === "ko" ? "임시저장" : "Save draft"}
      </button>
      <button
        type="button"
        aria-label={lang === "ko" ? "임시저장 목록" : "Saved draft list"}
        aria-expanded={open}
        className="inline-flex min-w-12 items-center justify-center gap-1 rounded-r-[var(--ui-control-radius)] border border-[var(--ui-border-subtle)] bg-white px-2 text-[length:var(--ui-control-font-size)] font-semibold tabular-nums text-slate-600 transition-colors hover:bg-slate-50"
        onClick={() => setOpen((current) => !current)}
      >
        {count}
        <ChevronDown className="size-3.5" aria-hidden="true" />
      </button>

      {open ? (
        <div className="absolute right-0 top-full z-50 mt-2 w-80 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_18px_48px_rgba(15,23,42,0.16)]">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <span className="text-xs font-semibold text-slate-800">
              {lang === "ko" ? "저장된 초안" : "Saved drafts"}
            </span>
            <span className="text-[11px] font-normal tabular-nums text-slate-400">{count}</span>
          </div>
          <div className="max-h-72 overflow-y-auto">
            {drafts.length === 0 ? (
              <p className="px-4 py-8 text-center text-xs font-normal text-slate-400">
                {lang === "ko" ? "저장된 초안이 없습니다." : "No saved drafts."}
              </p>
            ) : (
              drafts.map((draft) => (
                <div key={draft.draftId} className="flex items-center gap-3 border-b border-slate-100 px-4 py-3 last:border-b-0">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium text-slate-800">
                      {draft.titleKo || (lang === "ko" ? "제목 없는 글" : "Untitled post")}
                    </p>
                    <p className="mt-1 truncate text-[11px] font-normal text-slate-400">
                      {draft.boardCode} · {msToDate(isoToMs(draft.updatedAt)).toLocaleString(lang === "ko" ? "ko-KR" : "en-US")}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => {
                        setOpen(false);
                        void onRestore(draft.draftId);
                      }}
                      className="h-7 rounded-md bg-brand-primary px-2 text-[11px] text-white"
                    >
                      {lang === "ko" ? "불러오기" : "Load"}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => void onDelete(draft.draftId)}
                      className="h-7 rounded-md px-2 text-[11px] text-slate-500 hover:text-rose-600"
                    >
                      {lang === "ko" ? "삭제" : "Delete"}
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      ) : null}

      {toastVisible ? (
        <div className="fixed bottom-6 right-6 z-[80] rounded-lg bg-slate-900 px-3.5 py-2.5 text-xs font-medium text-white shadow-lg" role="status">
          {lang === "ko" ? "임시저장되었습니다." : "Draft saved."}
        </div>
      ) : null}
    </div>
  );
}

interface HeaderControlsProps {
  boardByCode: Map<string, BoardMetadata>;
  isKoreanOnly: boolean;
  lang: string;
  onCategoryChange: (category: string) => void;
  onKoreanOnlyChange: (checked: boolean) => void;
  selectedCategory: string;
  writableBoardCodes: string[];
}

export function BoardWriteHeaderControls({
  boardByCode,
  isKoreanOnly,
  lang,
  onCategoryChange,
  onKoreanOnlyChange,
  selectedCategory,
  writableBoardCodes,
}: HeaderControlsProps) {
  return (
    <div className="flex items-center justify-between flex-wrap gap-4 bg-slate-50/40 px-4 py-3 border-b border-slate-200 rounded-t-xl">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <SelectDropdown
            id="board-category-select"
            value={selectedCategory}
            onChange={onCategoryChange}
            disabled={writableBoardCodes.length === 0}
            options={
              writableBoardCodes.length > 0
                ? writableBoardCodes.map((code) => ({
                    value: code,
                    label: getBoardLabelFromMetadata(
                      boardByCode.get(code),
                      code,
                      lang,
                    ),
                  }))
                : [
                    {
                      value: selectedCategory,
                      label: "",
                    },
                  ]
            }
            className="w-36"
            buttonClassName="h-8 rounded-lg border-slate-200 px-2.5 py-0 text-xs font-bold text-slate-800 shadow-xs focus:ring-kaist-darkgreen/10"
            menuClassName="rounded-lg border-slate-200"
            optionClassName="text-[12px]"
            emptyLabel={lang === "ko" ? "선택지가 없습니다." : "No options."}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2.5 cursor-pointer group bg-slate-100/50 border border-slate-200 px-3.5 py-1.5 rounded-lg">
          <div
            className={`flex h-4 w-4 items-center justify-center rounded border transition-colors ${
              isKoreanOnly
                ? "border-kaist-darkgreen bg-kaist-darkgreen text-white"
                : "border-slate-300 bg-white group-hover:border-kaist-darkgreen"
            }`}
          >
            {isKoreanOnly && <Check className="w-2.5 h-2.5" strokeWidth={4} />}
          </div>
          <UiInput
            type="checkbox"
            className="hidden"
            checked={isKoreanOnly}
            onChange={(event) => onKoreanOnlyChange(event.target.checked)}
          />
          <span
            className="text-xs font-medium text-slate-600"
          >
            {lang === "ko" ? "한국어 콘텐츠만" : "Korean content only"}
          </span>
        </label>
      </div>
    </div>
  );
}

interface EditHeaderControlsProps {
  category: string;
  isKoreanOnly: boolean;
  lang: string;
  onKoreanOnlyChange: (checked: boolean) => void;
}

export function BoardEditHeaderControls({
  category,
  isKoreanOnly,
  lang,
  onKoreanOnlyChange,
}: EditHeaderControlsProps) {
  return (
    <div className="flex items-center justify-between flex-wrap gap-4 bg-slate-50/40 px-4 py-3 border-b border-slate-200 rounded-t-xl">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <SelectDropdown
            id="edit-board-category-select"
            value={category}
            onChange={() => undefined}
            disabled
            options={[
              {
                value: category,
                label: getBoardLabelFromMetadata(undefined, category, lang),
              },
            ]}
            className="w-36"
            buttonClassName="h-8 rounded-lg border-slate-200 px-2.5 py-0 text-xs font-bold shadow-xs"
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2.5 cursor-pointer group bg-slate-100/50 border border-slate-200 px-3.5 py-1.5 rounded-lg">
          <div
            className={`flex h-4 w-4 items-center justify-center rounded border transition-colors ${
              isKoreanOnly
                ? "border-kaist-darkgreen bg-kaist-darkgreen text-white"
                : "border-slate-300 bg-white group-hover:border-kaist-darkgreen"
            }`}
          >
            {isKoreanOnly && <Check className="w-2.5 h-2.5" strokeWidth={4} />}
          </div>
          <UiInput
            type="checkbox"
            className="hidden"
            checked={isKoreanOnly}
            onChange={(event) => onKoreanOnlyChange(event.target.checked)}
          />
          <span
            className="text-xs font-medium text-slate-600"
          >
            {lang === "ko" ? "한국어 콘텐츠만" : "Korean content only"}
          </span>
        </label>
      </div>
    </div>
  );
}

interface EditorFieldsProps {
  contentEn: string;
  contentKo: string;
  isKoreanOnly: boolean;
  lang: string;
  onContentEnChange: (value: string) => void;
  onContentKoChange: (value: string) => void;
  onTitleEnChange: (value: string) => void;
  onTitleKoChange: (value: string) => void;
  titleEn: string;
  titleKo: string;
  fileInputRef?: RefObject<HTMLInputElement | null>;
  uploading?: boolean;
}

export function BoardWriteEditorFields({
  contentEn,
  contentKo,
  isKoreanOnly,
  lang,
  onContentEnChange,
  onContentKoChange,
  onTitleEnChange,
  onTitleKoChange,
  titleEn,
  titleKo,
  fileInputRef,
  uploading,
}: EditorFieldsProps) {
  return (
    <BilingualRichTextEditor
      contentEn={contentEn}
      contentKo={contentKo}
      fileInputRef={fileInputRef}
      isKoreanOnly={isKoreanOnly}
      lang={lang}
      onContentEnChange={onContentEnChange}
      onContentKoChange={onContentKoChange}
      onTitleEnChange={onTitleEnChange}
      onTitleKoChange={onTitleKoChange}
      titleEn={titleEn}
      titleKo={titleKo}
      uploading={uploading}
    />
  );
}

interface EventFieldsProps {
  eventDescriptionKo: string;
  eventDescriptionEn: string;
  eventEndDate: string;
  eventStartDate: string;
  isEventAlwaysOpen: boolean;
  isKoreanOnly: boolean;
  lang: string;
  onEventDescriptionKoChange: (value: string) => void;
  onEventDescriptionEnChange: (value: string) => void;
  onEventEndDateChange: (value: string) => void;
  onEventStartDateChange: (value: string) => void;
  onEventAlwaysOpenChange: (checked: boolean) => void;
}

export function BoardWriteEventFields({
  eventDescriptionKo,
  eventDescriptionEn,
  eventEndDate,
  eventStartDate,
  isEventAlwaysOpen,
  isKoreanOnly,
  lang,
  onEventAlwaysOpenChange,
  onEventDescriptionKoChange,
  onEventDescriptionEnChange,
  onEventEndDateChange,
  onEventStartDateChange,
}: EventFieldsProps) {
  return (
    <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-4 animate-in fade-in duration-300">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
          {lang === "ko"
            ? "행사 일정 및 추가 정보"
            : "Event Schedule & Extra Info"}
        </h3>
        <label className="flex items-center gap-2.5 cursor-pointer group rounded-lg border border-slate-200 bg-white px-3 py-1.5">
          <div
            className={`w-4 h-4 rounded border transition-all flex items-center justify-center ${
              isEventAlwaysOpen
                ? "bg-kaist-darkgreen border-kaist-darkgreen text-white"
                : "border-slate-300 group-hover:border-kaist-darkgreen"
            }`}
          >
            {isEventAlwaysOpen && (
              <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />
            )}
          </div>
          <UiInput
            type="checkbox"
            className="hidden"
            checked={isEventAlwaysOpen}
            onChange={(event) => onEventAlwaysOpenChange(event.target.checked)}
          />
          <span className="text-[11px] font-bold text-slate-700">
            {lang === "ko" ? "일정 상시" : "Always open"}
          </span>
        </label>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-bold text-slate-500 mb-1">
            {lang === "ko" ? "행사 시작 일시" : "Event Start Date"}
          </label>
          <UiInput
            type="datetime-local"
            disabled={isEventAlwaysOpen}
            className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-kaist-darkgreen disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
            value={eventStartDate}
            onChange={(event) => onEventStartDateChange(event.target.value)}
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-500 mb-1">
            {lang === "ko" ? "행사 마감 일시" : "Event End Date"}
          </label>
          <UiInput
            type="datetime-local"
            disabled={isEventAlwaysOpen}
            className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-kaist-darkgreen disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
            value={eventEndDate}
            onChange={(event) => onEventEndDateChange(event.target.value)}
          />
        </div>
      </div>
      {isEventAlwaysOpen && (
        <p className="rounded-lg bg-brand-primary-light px-3 py-2 text-[11px] font-semibold text-brand-primary">
          {lang === "ko"
            ? "상시 일정으로 저장하면 캘린더에는 특정 날짜 점으로 표시되지 않습니다."
            : "Always-open events are saved without fixed calendar dots."}
        </p>
      )}
      <div className="space-y-3">
        <label className="block text-xs font-bold text-slate-500">
          {lang === "ko" ? "카드 노출용 간단한 설명 *" : "Card Description *"}
        </label>
        <UiInput
          type="text"
          aria-label={lang === "ko" ? "국문 카드 설명" : "Korean card description"}
          placeholder={
            lang === "ko"
              ? "피드에 표시될 짧은 국문 행사 정보입니다"
              : "Short Korean description for card display"
          }
          className="w-full"
          value={eventDescriptionKo}
          onChange={(event) => onEventDescriptionKoChange(event.target.value)}
        />
        {!isKoreanOnly ? (
          <>
            <div className="h-px bg-slate-200" aria-hidden="true" />
            <UiInput
              type="text"
              aria-label={lang === "ko" ? "영문 카드 설명" : "English card description"}
              placeholder={
                lang === "ko"
                  ? "피드에 표시될 짧은 영문 행사 정보입니다"
                  : "Short English description for card display"
              }
              className="w-full"
              value={eventDescriptionEn}
              onChange={(event) => onEventDescriptionEnChange(event.target.value)}
            />
          </>
        ) : null}
      </div>
    </div>
  );
}

interface AttachmentListProps {
  assets: AttachedAsset[];
  lang: string;
  onRemoveAsset: (assetId: string) => void;
  uploading: boolean;
}

export function BoardWriteAttachmentList({
  assets,
  lang,
  onRemoveAsset,
  uploading,
}: AttachmentListProps) {
  if (assets.length === 0) {
    return null;
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/40 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-xs font-bold text-slate-800">
          {lang === "ko"
            ? `첨부파일 ${assets.length}`
            : `${assets.length} attachments`}
        </h3>
        {uploading && (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-kaist-darkgreen">
            <Loader2 className="h-3 w-3 animate-spin" />
            {lang === "ko" ? "업로드 중" : "Uploading"}
          </span>
        )}
      </div>
      <div className="divide-y divide-slate-100 overflow-hidden rounded-lg border border-slate-200 bg-white">
        {assets.map((asset) => (
          <div
            key={asset.assetId}
            className="flex items-center justify-between gap-3 px-4 py-2.5"
          >
            <div className="min-w-0">
              <p className="truncate text-xs font-bold text-slate-700">
                {asset.originalFilename}
              </p>
              <p className="mt-0.5 text-[10px] font-semibold text-slate-400">
                {asset.usageType === "IMAGE" ? "IMAGE" : "FILE"} ·{" "}
                {formatFileSize(asset.sizeBytes)}
              </p>
            </div>
            <Button variant="ghost"
              type="button"
              onClick={() => onRemoveAsset(asset.assetId)}
              className="rounded-lg p-1 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 border-0 bg-transparent cursor-pointer"
              title={lang === "ko" ? "첨부 제거" : "Remove attachment"}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}

interface BoardWriteSettingsProps {
  allowComment: boolean;
  canConfigurePostSettings: boolean;
  lang: string;
  onAllowCommentChange: (checked: boolean) => void;
  onSelectedSurveyIdChange: (surveyId: string) => void;
  selectedSurveyId: string;
  surveys: SurveyRecord[];
  isAnonymous: boolean;
  isPinned: boolean;
  isSecret: boolean;
  allowSecret: boolean;
  onAnonymousChange: (checked: boolean) => void;
  onPinnedChange: (checked: boolean) => void;
  onSecretChange: (checked: boolean) => void;
  anonymousLabel?: string;
  pinnedLabel?: string;
}

export function BoardWriteSettings({
  allowComment,
  canConfigurePostSettings,
  lang,
  onAllowCommentChange,
  onSelectedSurveyIdChange,
  selectedSurveyId,
  surveys,
  isAnonymous,
  isPinned,
  isSecret,
  allowSecret,
  onAnonymousChange,
  onPinnedChange,
  onSecretChange,
  anonymousLabel,
  pinnedLabel,
}: BoardWriteSettingsProps) {
  return (
    <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-[0_10px_35px_rgba(15,23,42,0.05)]">
      <div className="grid grid-cols-1 items-start gap-x-8 gap-y-4 md:grid-cols-2">
        {/* Survey Selection */}
        {canConfigurePostSettings && (
          <div className="space-y-1.5 w-full">
            <label
              htmlFor="settings-survey-select"
              className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider"
            >
              {lang === "ko" ? "설문조사 연동" : "Linked Survey"}
            </label>
            <SelectDropdown
              id="settings-survey-select"
              value={selectedSurveyId}
              onChange={onSelectedSurveyIdChange}
              options={[
                {
                  value: "",
                  label: lang === "ko" ? "연동하지 않음" : "No linked survey",
                },
                ...surveys.map((survey) => ({
                  value: survey.id,
                  label:
                    lang === "ko"
                      ? survey.titleKo
                      : survey.titleEn || survey.titleKo,
                })),
              ]}
              className="w-full"
              buttonClassName="h-[var(--ui-control-height)] rounded-[var(--ui-control-radius)] border-slate-200 bg-white px-3.5 py-0 text-xs font-normal text-slate-700 shadow-none focus:ring-kaist-darkgreen/10 focus:ring-2"
              menuClassName="rounded-[var(--ui-control-radius)] border-slate-200 shadow-elevated"
              optionClassName="text-[12px] !font-normal"
              emptyLabel={lang === "ko" ? "선택지가 없습니다." : "No options."}
            />
          </div>
        )}

        {/* Visibility Options */}
        <div className={`space-y-3 w-full ${canConfigurePostSettings ? "md:pt-[24px]" : ""}`}>
          <div className="flex flex-wrap gap-x-10 gap-y-4">
            {canConfigurePostSettings && (
              <label className="flex items-center gap-2.5 cursor-pointer group">
                <div
                  className={`w-4.5 h-4.5 rounded border transition-all flex items-center justify-center ${
                    isAnonymous
                      ? "bg-kaist-darkgreen border-kaist-darkgreen text-white"
                      : "border-slate-300 bg-white group-hover:border-kaist-darkgreen"
                  }`}
                >
                  {isAnonymous && (
                    <Check className="w-3 h-3 text-white" strokeWidth={3} />
                  )}
                </div>
                <UiInput
                  type="checkbox"
                  className="hidden"
                  checked={isAnonymous}
                  onChange={(event) => onAnonymousChange(event.target.checked)}
                />
                <span className="text-xs font-bold text-slate-700">
                  {anonymousLabel ??
                    (lang === "ko" ? "익명으로 작성" : "Write Anonymously")}
                </span>
              </label>
            )}

            {canConfigurePostSettings && (
              <label className="flex items-center gap-2.5 cursor-pointer group">
                <div
                  className={`w-4.5 h-4.5 rounded border transition-all flex items-center justify-center ${
                    isPinned
                      ? "bg-kaist-darkgreen border-kaist-darkgreen text-white"
                      : "border-slate-300 bg-white group-hover:border-kaist-darkgreen"
                  }`}
                >
                  {isPinned && (
                    <Check className="w-3 h-3 text-white" strokeWidth={3} />
                  )}
                </div>
                <UiInput
                  type="checkbox"
                  className="hidden"
                  checked={isPinned}
                  onChange={(event) => onPinnedChange(event.target.checked)}
                />
                <span className="text-xs font-bold text-slate-700">
                  {pinnedLabel ??
                    (lang === "ko" ? "게시글 상단 고정" : "Pin to Top")}
                </span>
              </label>
            )}

            {allowSecret && (
              <label className="flex items-center gap-2.5 cursor-pointer group">
                <div
                  className={`w-4.5 h-4.5 rounded border transition-all flex items-center justify-center ${
                    isSecret
                      ? "bg-amber-600 border-amber-600 text-white"
                      : "border-slate-300 bg-white group-hover:border-amber-600"
                  }`}
                >
                  {isSecret && (
                    <Check className="w-3 h-3 text-white" strokeWidth={3} />
                  )}
                </div>
                <UiInput
                  type="checkbox"
                  className="hidden"
                  checked={isSecret}
                  onChange={(event) => onSecretChange(event.target.checked)}
                />
                <span className="text-xs font-bold text-slate-700">
                  {lang === "ko" ? "비밀글로 작성" : "Write as secret"}
                </span>
              </label>
            )}

            <label className="flex items-center gap-2.5 cursor-pointer group">
              <div
                className={`w-4.5 h-4.5 rounded border transition-all flex items-center justify-center ${
                  allowComment
                    ? "bg-kaist-darkgreen border-kaist-darkgreen text-white"
                    : "border-slate-300 bg-white group-hover:border-kaist-darkgreen"
                }`}
              >
                {allowComment && (
                  <Check className="w-3 h-3 text-white" strokeWidth={3} />
                )}
              </div>
              <UiInput
                type="checkbox"
                className="hidden"
                checked={allowComment}
                onChange={(event) => onAllowCommentChange(event.target.checked)}
              />
              <span className="text-xs font-bold text-slate-700">
                {lang === "ko" ? "댓글 작성 허용" : "Allow Comments"}
              </span>
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}

interface BoardWriteFooterProps {
  draftCount?: number;
  drafts?: ArticleDraftRecord[];
  lang: string;
  isSubmitting: boolean;
  canWriteSelected?: boolean;
  compact?: boolean;
  onCancel: () => void;
  onDeleteDraft?: (draftId: string) => void | Promise<void>;
  onRestoreDraft?: (draftId: string) => void | Promise<void>;
  onSaveDraft?: () => void | Promise<void>;
  onSubmit: () => void;
  submitLabel?: string;
  submittingLabel?: string;
}

export function BoardWriteFooter({
  draftCount = 0,
  drafts = [],
  lang,
  isSubmitting,
  canWriteSelected = true,
  compact = false,
  onCancel,
  onDeleteDraft,
  onRestoreDraft,
  onSaveDraft,
  onSubmit,
  submitLabel,
  submittingLabel,
}: BoardWriteFooterProps) {
  const defaultSubmitLabel = lang === "ko" ? "글 게시하기" : "Publish Post";
  const defaultSubmittingLabel = lang === "ko" ? "게시 중..." : "Publishing...";

  return (
    <div className={`flex items-center gap-2 ${compact ? "justify-end" : "justify-between"}`}>
      <Button
        variant="outline"
        type="button"
        onClick={onCancel}
        disabled={isSubmitting}
        className="text-slate-600"
      >
        <ArrowLeft aria-hidden="true" />
        {lang === "ko" ? "취소" : "Cancel"}
      </Button>
      <div className="flex items-center gap-2">
        {onSaveDraft && onRestoreDraft && onDeleteDraft ? (
          <BoardWriteDraftControl
            count={draftCount}
            drafts={drafts}
            lang={lang}
            onDelete={onDeleteDraft}
            onRestore={onRestoreDraft}
            onSave={onSaveDraft}
            saving={isSubmitting}
          />
        ) : onSaveDraft ? (
          <Button
            variant="outline"
            type="button"
            onClick={() => void onSaveDraft()}
            disabled={isSubmitting}
            className="text-slate-600"
          >
            {lang === "ko" ? "임시저장" : "Save Draft"}
          </Button>
        ) : null}
        <Button
          type="button"
          onClick={onSubmit}
          disabled={isSubmitting || !canWriteSelected}
          className="bg-kaist-darkgreen text-white hover:bg-kaist-darkgreen/90"
        >
          {isSubmitting ? (
            <span className="flex items-center gap-1.5">
              <Loader2 className="size-4 animate-spin" />
              <span>{submittingLabel ?? defaultSubmittingLabel}</span>
            </span>
          ) : (
            <span>{submitLabel ?? defaultSubmitLabel}</span>
          )}
        </Button>
      </div>
    </div>
  );
}
