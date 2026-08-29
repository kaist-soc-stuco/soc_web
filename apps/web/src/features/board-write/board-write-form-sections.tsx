import type { ReactNode, RefObject } from "react";
import { useState } from "react";
import type { SurveyRecord } from "@soc/contracts";
import {
  ArrowLeft,
  Check,
  FileText,
  Image,
  Loader2,
  Music2,
  Video,
  X,
} from "lucide-react";

import {
  getBoardLabelFromMetadata,
  type BoardMetadata,
} from "@/lib/board-metadata";
import { SelectDropdown } from "@/components/atoms/select-dropdown";
import { BilingualRichTextEditor } from "@/components/organisms/rich-text-editor";
import { Button } from "@/components/ui/button";
import { UiFormField, UiInput } from "@/components/ui/form-control";
import { ImageUploadField } from "@/components/ui/image-upload-field";
import { resolveAssetUrl } from "@/lib/asset-url";
import {
  switchEventDateInputMode,
  switchEventEndDateInputMode,
} from "./event-date-utils";

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

function getAttachmentIcon(mimeType: string) {
  if (mimeType.startsWith("image/")) return Image;
  if (mimeType.startsWith("video/")) return Video;
  if (mimeType.startsWith("audio/")) return Music2;
  return FileText;
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
            buttonClassName="h-8 rounded-lg border-slate-200 px-2.5 py-0 text-xs font-bold text-slate-800 shadow-xs"
            menuClassName="rounded-lg border-slate-200"
            optionClassName="text-xs"
            emptyLabel={lang === "ko" ? "선택지가 없습니다." : "No options."}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2.5 cursor-pointer group bg-slate-100/50 border border-slate-200 px-3.5 py-1.5 rounded-lg">
          <div
            className={`flex h-4 w-4 items-center justify-center rounded border ${
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
            {lang === "ko" ? "한국어 전용" : "Korean only"}
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
            className={`flex h-4 w-4 items-center justify-center rounded border ${
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
            {lang === "ko" ? "한국어 전용" : "Korean only"}
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
  onImageUpload?: (file: File) => Promise<string | null>;
  onTitleEnChange: (value: string) => void;
  onTitleKoChange: (value: string) => void;
  titleEn: string;
  titleKo: string;
  fileInputRef?: RefObject<HTMLInputElement | null>;
  uploading?: boolean;
  onSave?: () => void | Promise<void>;
  onSubmit?: () => void | Promise<void>;
}

export function BoardWriteEditorFields({
  contentEn,
  contentKo,
  isKoreanOnly,
  lang,
  onContentEnChange,
  onContentKoChange,
  onImageUpload,
  onTitleEnChange,
  onTitleKoChange,
  titleEn,
  titleKo,
  fileInputRef,
  uploading,
  onSave,
  onSubmit,
}: EditorFieldsProps) {
  return (
    <BilingualRichTextEditor
      contentEn={contentEn}
      contentKo={contentKo}
      fileInputRef={fileInputRef}
      isKoreanOnly={isKoreanOnly}
      lang={lang}
      onImageUpload={onImageUpload}
      onContentEnChange={onContentEnChange}
      onContentKoChange={onContentKoChange}
      onTitleEnChange={onTitleEnChange}
      onTitleKoChange={onTitleKoChange}
      titleEn={titleEn}
      titleKo={titleKo}
      uploading={uploading}
      onSave={onSave}
      onSubmit={onSubmit}
    />
  );
}

interface EventFieldsProps {
  eventDescriptionKo: string;
  eventDescriptionEn: string;
  eventEndDate: string;
  eventLocation: string;
  eventStartDate: string;
  isAllDay: boolean;
  isEventAlwaysOpen: boolean;
  isKoreanOnly: boolean;
  lang: string;
  onEventDescriptionKoChange: (value: string) => void;
  onEventDescriptionEnChange: (value: string) => void;
  onEventEndDateChange: (value: string) => void;
  onEventLocationChange: (value: string) => void;
  onEventStartDateChange: (value: string) => void;
  onAllDayChange: (checked: boolean) => void;
  onEventAlwaysOpenChange: (checked: boolean) => void;
  onThumbnailRemove: () => void;
  onThumbnailSelect: (file: File) => void | Promise<void>;
  thumbnail?: AttachedAsset;
  uploading: boolean;
}

export function BoardWriteEventFields({
  eventDescriptionKo,
  eventDescriptionEn,
  eventEndDate,
  eventLocation,
  eventStartDate,
  isAllDay,
  isEventAlwaysOpen,
  isKoreanOnly,
  onAllDayChange,
  lang,
  onEventAlwaysOpenChange,
  onEventDescriptionKoChange,
  onEventDescriptionEnChange,
  onEventEndDateChange,
  onEventLocationChange,
  onEventStartDateChange,
  onThumbnailRemove,
  onThumbnailSelect,
  thumbnail,
  uploading,
}: EventFieldsProps) {
  const [descriptionLanguage, setDescriptionLanguage] = useState<"ko" | "en">("ko");
  const activeDescriptionLanguage = isKoreanOnly ? "ko" : descriptionLanguage;
  const eventStartInputValue = isAllDay
    ? switchEventDateInputMode(eventStartDate, true)
    : switchEventDateInputMode(eventStartDate, false);
  const eventEndInputValue = isAllDay
    ? switchEventEndDateInputMode(eventEndDate, true)
    : switchEventEndDateInputMode(eventEndDate, false);

  return (
    <div className="space-y-4 p-5 animate-in fade-in duration-300">
      <div className="flex items-center gap-6">
        <label className="inline-flex shrink-0 cursor-pointer items-center gap-2.5 group">
          <div
            className={`w-4 h-4 rounded border transition-all flex items-center justify-center ${
              isAllDay
                ? "bg-kaist-darkgreen border-kaist-darkgreen text-white"
                : "border-slate-300 group-hover:border-kaist-darkgreen"
            }`}
          >
            {isAllDay && (
              <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />
            )}
          </div>
          <UiInput
            type="checkbox"
            className="hidden"
            checked={isAllDay}
            onChange={(event) => onAllDayChange(event.target.checked)}
          />
          <span className="text-[length:var(--ui-text-caption-size)] font-bold text-slate-700">
            {lang === "ko" ? "종일" : "All day"}
          </span>
        </label>
        <label className="inline-flex shrink-0 cursor-pointer items-center gap-2.5 group">
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
          <span className="text-[length:var(--ui-text-caption-size)] font-bold text-slate-700">
            {lang === "ko" ? "상시 진행" : "Always open"}
          </span>
        </label>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <UiFormField
          className="min-w-0"
          htmlFor="event-start-date"
          label={lang === "ko" ? "시작" : "Start"}
        >
          <UiInput
            id="event-start-date"
            type={isAllDay ? "date" : "datetime-local"}
            disabled={isEventAlwaysOpen}
            className="w-full min-w-0 text-[length:var(--ui-text-body-sm-size)]"
            value={eventStartInputValue}
            onChange={(event) => onEventStartDateChange(event.target.value)}
          />
        </UiFormField>
        <UiFormField
          className="min-w-0"
          htmlFor="event-end-date"
          label={lang === "ko" ? "종료" : "End"}
        >
          <UiInput
            id="event-end-date"
            type={isAllDay ? "date" : "datetime-local"}
            disabled={isEventAlwaysOpen}
            className="w-full min-w-0 text-[length:var(--ui-text-body-sm-size)]"
            value={eventEndInputValue}
            onChange={(event) => onEventEndDateChange(event.target.value)}
          />
        </UiFormField>
      </div>
      <UiFormField
        label={
          lang === "ko"
            ? "대표 썸네일 (16:9 권장)"
            : "Representative thumbnail (16:9 recommended)"
        }
      >
        <ImageUploadField
          alt={lang === "ko" ? "대표 썸네일 미리보기" : "Representative thumbnail preview"}
          compact
          disabled={uploading}
          fileName={thumbnail?.originalFilename}
          imageUrl={thumbnail ? resolveAssetUrl(thumbnail.storageKey) : undefined}
          onRemove={onThumbnailRemove}
          onSelect={onThumbnailSelect}
          removeLabel={lang === "ko" ? "제거" : "Remove"}
          selectLabel={
            lang === "ko"
              ? thumbnail
                ? "이미지 변경"
                : "썸네일 선택"
              : thumbnail
                ? "Change image"
                : "Choose thumbnail"
          }
        />
      </UiFormField>
      <div className="min-w-0">
        <UiInput
          id="event-location"
          type="text"
          maxLength={255}
          aria-label={lang === "ko" ? "행사 장소" : "Event location"}
          placeholder={lang === "ko" ? "행사 장소를 입력하세요" : "Enter event location"}
          className="w-full"
          value={eventLocation}
          onChange={(event) => onEventLocationChange(event.target.value)}
        />
      </div>
      <div className="grid gap-1.5">
        <div className="flex items-center justify-between gap-3">
          <label
            htmlFor="event-description"
            className="min-w-0 text-xs font-normal leading-4 text-[#344054]"
          >
            {lang === "ko" ? "카드 요약 설명 (피드 노출용)" : "Card summary (shown in feeds)"}
          </label>
          <div
            aria-label={lang === "ko" ? "설명 언어" : "Description language"}
            className="inline-flex shrink-0 rounded-md border border-slate-200 bg-slate-50 p-0.5"
            role="tablist"
          >
            {(["ko", "en"] as const).map((language) => {
              const isActive = activeDescriptionLanguage === language;
              const isDisabled = language === "en" && isKoreanOnly;
              return (
                <button
                  key={language}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  aria-disabled={isDisabled}
                  disabled={isDisabled}
                  onClick={() => setDescriptionLanguage(language)}
                  className={`select-none rounded px-2 py-0.5 text-[length:var(--ui-text-micro-size)] font-semibold uppercase leading-4 transition-colors ${
                    isActive
                      ? "bg-white text-brand-primary shadow-sm"
                      : "text-slate-400 hover:text-slate-700"
                  } disabled:cursor-not-allowed disabled:opacity-45`}
                >
                  {language.toUpperCase()}
                </button>
              );
            })}
          </div>
        </div>
        <UiInput
          id="event-description"
          type="text"
          aria-label={lang === "ko" ? "카드 요약 설명" : "Card summary"}
          placeholder="설명을 입력하세요"
          className="w-full"
          value={activeDescriptionLanguage === "ko" ? eventDescriptionKo : eventDescriptionEn}
          onChange={(event) => {
            if (activeDescriptionLanguage === "ko") {
              onEventDescriptionKoChange(event.target.value);
            } else {
              onEventDescriptionEnChange(event.target.value);
            }
          }}
        />
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
  const attachmentAssets = assets.filter((asset) => asset.usageType === "ATTACHMENT");

  if (attachmentAssets.length === 0 && !uploading) {
    return null;
  }

  return (
    <div className="border-t border-slate-200 pt-4">
      <div className="mb-2 flex min-h-5 items-center justify-end">
        {uploading && (
          <span className="inline-flex items-center gap-1 text-[length:var(--ui-text-caption-size)] font-bold text-kaist-darkgreen">
            <Loader2 className="h-3 w-3 animate-spin" />
            {lang === "ko" ? "업로드 중" : "Uploading"}
          </span>
        )}
      </div>
      <div className="space-y-1.5">
        {attachmentAssets.map((asset) => {
          const AttachmentIcon = getAttachmentIcon(asset.mimeType);

          return (
            <div
              key={asset.assetId}
              className="flex items-center justify-between gap-3 rounded-md bg-slate-50 px-3 py-2"
            >
              <div className="flex min-w-0 items-center gap-2">
                <AttachmentIcon
                  aria-hidden="true"
                  className="size-4 shrink-0 text-slate-500"
                />
                <span className="truncate text-xs font-medium text-slate-700">
                  {asset.originalFilename}
                </span>
                <span className="shrink-0 text-[length:var(--ui-text-caption-size)] font-normal text-slate-500">
                  ({formatFileSize(asset.sizeBytes)})
                </span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                type="button"
                onClick={() => onRemoveAsset(asset.assetId)}
                className="size-7 shrink-0 rounded-md p-0 text-slate-400 transition hover:bg-slate-200 hover:text-slate-700"
                title={lang === "ko" ? "첨부 제거" : "Remove attachment"}
              >
                <X className="size-3.5" />
              </Button>
            </div>
          );
        })}
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
  boardCode?: string;
  pinnedLabel?: string;
  isEvent?: boolean;
  homeVisible?: boolean;
  onHomeVisibleChange?: (checked: boolean) => void;
  stacked?: boolean;
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
  boardCode,
  pinnedLabel,
  isEvent = false,
  homeVisible = true,
  onHomeVisibleChange,
  stacked = false,
}: BoardWriteSettingsProps) {
  return (
    <div className="space-y-4 border-t border-slate-200 px-6 py-5 md:px-8">
      <div
        className={`grid grid-cols-1 items-center gap-x-8 gap-y-4 ${
          stacked ? "" : "md:grid-cols-2"
        }`}
      >
        {canConfigurePostSettings && (
          <div className="w-full space-y-1.5">
            <SelectDropdown
              id="settings-survey-select"
              aria-label={lang === "ko" ? "연결된 설문조사" : "Linked survey"}
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
              buttonClassName="h-[var(--ui-control-height)] rounded-[var(--ui-control-radius)] border-slate-200 bg-white px-3.5 py-0 text-xs font-normal text-slate-700 shadow-none"
              menuClassName="rounded-[var(--ui-control-radius)] border-slate-200 shadow-elevated"
              optionClassName="text-xs !font-normal"
              emptyLabel={lang === "ko" ? "선택지가 없습니다." : "No options."}
            />
          </div>
        )}

        <div className="w-full self-center space-y-3">
          {isEvent ? (
            <p className="text-xs font-semibold text-slate-700">
              {lang === "ko" ? "공개 및 게시 옵션" : "Visibility and publishing options"}
            </p>
          ) : null}
          <div className={isEvent ? "grid grid-cols-2 gap-x-4 gap-y-3" : stacked ? "grid grid-cols-1 gap-y-3" : "flex flex-wrap gap-x-10 gap-y-4"}>
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

            {boardCode !== "건의사항" ? (
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
            ) : null}

            {isEvent && canConfigurePostSettings && onHomeVisibleChange ? (
              <label className="flex cursor-pointer items-center gap-2.5 group">
                <div
                  className={`flex h-4.5 w-4.5 items-center justify-center rounded border transition-all ${
                    homeVisible
                      ? "border-kaist-darkgreen bg-kaist-darkgreen text-white"
                      : "border-slate-300 bg-white group-hover:border-kaist-darkgreen"
                  }`}
                >
                  {homeVisible && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
                </div>
                <UiInput
                  type="checkbox"
                  className="hidden"
                  checked={homeVisible}
                  onChange={(event) => onHomeVisibleChange(event.target.checked)}
                />
                <span className="text-xs font-bold text-slate-700">
                  {lang === "ko" ? "홈 화면에 표시" : "Show on home"}
                </span>
              </label>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

interface BoardWriteFooterProps {
  lang: string;
  isSubmitting: boolean;
  canWriteSelected?: boolean;
  compact?: boolean;
  leadingActions?: ReactNode;
  onCancel?: () => void;
  onSubmit: () => void;
  submitLabel?: string;
  submittingLabel?: string;
}

export function BoardWriteFooter({
  lang,
  isSubmitting,
  canWriteSelected = true,
  compact = false,
  leadingActions,
  onCancel,
  onSubmit,
  submitLabel,
  submittingLabel,
}: BoardWriteFooterProps) {
  const defaultSubmitLabel = lang === "ko" ? "등록" : "Publish Post";
  const defaultSubmittingLabel = lang === "ko" ? "등록 중..." : "Publishing...";

  return (
    <div className={`flex items-center gap-2 ${compact ? "justify-end" : "justify-between"}`}>
      {onCancel ? (
        <Button
          variant="outline"
          type="button"
          onClick={onCancel}
          disabled={isSubmitting}
          className="h-[var(--ui-control-height)] !font-medium text-slate-600"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          {lang === "ko" ? "취소" : "Cancel"}
        </Button>
      ) : null}
      <div className="flex items-center gap-2">
        {leadingActions}
        <Button
          type="button"
          onClick={onSubmit}
          disabled={isSubmitting || !canWriteSelected}
          className="h-[var(--ui-control-height)] !font-medium bg-kaist-darkgreen text-white hover:bg-kaist-darkgreen/90"
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
