import type { RefObject } from "react";
import type { SurveyRecord } from "@soc/contracts";
import { Check, FileText, Globe, Image, Loader2, Video, X } from "lucide-react";
import { msToDate } from "@soc/shared";

import {
  getBoardLabelFromMetadata,
  type BoardMetadata,
} from "@/lib/board-metadata";
import { SelectDropdown } from "@/components/atoms/select-dropdown";

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

interface DraftBannerProps {
  draftTime: number;
  lang: string;
  onDiscard: () => void;
  onRestore: () => void;
}

export function BoardWriteDraftBanner({
  draftTime,
  lang,
  onDiscard,
  onRestore,
}: DraftBannerProps) {
  return (
    <div className="bg-emerald-50/50 border border-kaist-darkgreen/20 px-6 py-4 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-in fade-in slide-in-from-top-2 duration-300">
      <span className="font-semibold text-kaist-darkgreen text-xs">
        {lang === "ko"
          ? `이전에 작성 중이던 임시 저장글이 있습니다. (저장 시각: ${msToDate(draftTime).toLocaleTimeString()})`
          : `You have a saved draft from a previous session. (Saved at: ${msToDate(draftTime).toLocaleTimeString()})`}
      </span>
      <div className="flex gap-2 w-full sm:w-auto shrink-0 justify-end">
        <button
          type="button"
          onClick={onRestore}
          className="px-4 py-2 bg-kaist-darkgreen text-white rounded-lg text-xs font-bold hover:opacity-90 transition-all cursor-pointer border-0 shadow-sm"
        >
          {lang === "ko" ? "불러오기" : "Restore"}
        </button>
        <button
          type="button"
          onClick={onDiscard}
          className="px-4 py-2 bg-slate-200/80 text-slate-600 rounded-lg text-xs font-bold hover:bg-slate-300/80 transition-all cursor-pointer border-0"
        >
          {lang === "ko" ? "삭제" : "Discard"}
        </button>
      </div>
    </div>
  );
}

interface HeaderControlsProps {
  activeTab: "ko" | "en";
  boardByCode: Map<string, BoardMetadata>;
  isKoreanOnly: boolean;
  lang: string;
  onActiveTabChange: (tab: "ko" | "en") => void;
  onCategoryChange: (category: string) => void;
  onKoreanOnlyChange: (checked: boolean) => void;
  selectedCategory: string;
  writableBoardCodes: string[];
}

export function BoardWriteHeaderControls({
  activeTab,
  boardByCode,
  isKoreanOnly,
  lang,
  onActiveTabChange,
  onCategoryChange,
  onKoreanOnlyChange,
  selectedCategory,
  writableBoardCodes,
}: HeaderControlsProps) {
  return (
    <div className="flex items-center justify-between flex-wrap gap-4 bg-slate-50/40 px-4 py-3 border-b border-slate-200 select-none">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <label
            htmlFor="board-category-select"
            className="text-[11.5px] font-bold text-slate-500"
          >
            {lang === "ko" ? "게시판" : "Board"}
          </label>
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
                      label:
                        lang === "ko"
                          ? "작성 가능한 게시판 없음"
                          : "No writable board",
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
        <div className="h-6 w-px bg-slate-200" aria-hidden="true" />
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
          <button
            type="button"
            onClick={() => onActiveTabChange("ko")}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-xs font-bold transition-all border-0 cursor-pointer ${
              activeTab === "ko"
                ? "bg-kaist-darkgreen text-white shadow-xs"
                : "text-slate-500 hover:text-kaist-darkgreen"
            }`}
          >
            <span>{lang === "ko" ? "국문" : "Korean"}</span>
            {activeTab === "ko" && <Check className="w-3.5 h-3.5" />}
          </button>
          <button
            type="button"
            onClick={() => onActiveTabChange("en")}
            disabled={isKoreanOnly}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-xs font-bold transition-all border-0 cursor-pointer ${
              isKoreanOnly
                ? "opacity-30 cursor-not-allowed text-slate-350"
                : "hover:text-kaist-darkgreen"
            } ${
              activeTab === "en"
                ? "bg-kaist-darkgreen text-white shadow-xs"
                : "text-slate-500"
            }`}
            title={
              isKoreanOnly
                ? lang === "ko"
                  ? "한국어 사용자 전용 게시글이므로 영문을 작성할 수 없습니다."
                  : "This is restricted to Korean speakers only."
                : ""
            }
          >
            <Globe className="w-3.5 h-3.5" />
            <span>{lang === "ko" ? "영문" : "English"}</span>
            {activeTab === "en" && <Check className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      <div className="flex items-center">
        <label className="flex items-center gap-2.5 cursor-pointer group bg-slate-100/50 border border-slate-200 px-3.5 py-1.5 rounded-lg">
          <div
            className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${
              isKoreanOnly
                ? "bg-red-500 border-red-500 text-white"
                : "border-slate-300 group-hover:border-kaist-darkgreen"
            }`}
          >
            {isKoreanOnly && (
              <Check className="w-2.5 h-2.5" strokeWidth={4} />
            )}
          </div>
          <input
            type="checkbox"
            className="hidden"
            checked={isKoreanOnly}
            onChange={(event) => onKoreanOnlyChange(event.target.checked)}
          />
          <span
            className={`text-[11.5px] font-bold ${
              isKoreanOnly ? "text-red-600" : "text-slate-600"
            }`}
          >
            Korean Speakers Only
          </span>
        </label>
      </div>
    </div>
  );
}

interface ToolbarProps {
  canWriteSelected: boolean;
  fileInputRef: RefObject<HTMLInputElement | null>;
  isSubmitting: boolean;
  lang: string;
  onSaveDraft: () => void;
  onSubmit: () => void;
  onUploadFiles: (files: FileList | null) => void;
  uploading: boolean;
}

export function BoardWriteToolbar({
  canWriteSelected,
  fileInputRef,
  isSubmitting,
  lang,
  onSaveDraft,
  onSubmit,
  onUploadFiles,
  uploading,
}: ToolbarProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-3 border-b border-slate-100 bg-white select-none">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-lg p-0.5">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="p-1.5 text-slate-500 hover:text-kaist-darkgreen hover:bg-slate-100 rounded-md transition-colors border-0 bg-transparent disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
            title={lang === "ko" ? "이미지 추가" : "Add Image"}
          >
            <Image className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="p-1.5 text-slate-500 hover:text-kaist-darkgreen hover:bg-slate-100 rounded-md transition-colors border-0 bg-transparent disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
            title={lang === "ko" ? "파일 첨부" : "Attach File"}
          >
            {uploading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <FileText className="w-4 h-4" />
            )}
          </button>
          <button
            type="button"
            className="p-1.5 text-slate-500 hover:text-kaist-darkgreen hover:bg-slate-100 rounded-md transition-colors border-0 bg-transparent cursor-pointer"
            title={lang === "ko" ? "비디오 링크" : "Add Video"}
          >
            <Video className="w-4 h-4" />
          </button>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(event) => onUploadFiles(event.target.files)}
      />

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onSaveDraft}
          disabled={isSubmitting}
          className="px-3.5 py-1.5 rounded-lg border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-50 transition-colors cursor-pointer bg-white"
        >
          {lang === "ko" ? "임시저장" : "Save Draft"}
        </button>
        <button
          type="button"
          onClick={onSubmit}
          disabled={isSubmitting || !canWriteSelected}
          className="px-3.5 py-1.5 rounded-lg bg-kaist-darkgreen text-white text-xs font-bold hover:opacity-90 transition-all cursor-pointer border-0 shadow-xs disabled:cursor-not-allowed disabled:opacity-45"
        >
          {isSubmitting
            ? lang === "ko"
              ? "게시 중..."
              : "Publishing..."
            : lang === "ko"
              ? "글 게시하기"
              : "Publish Post"}
        </button>
      </div>
    </div>
  );
}

interface EditHeaderControlsProps {
  activeTab: "ko" | "en";
  category: string;
  isKoreanOnly: boolean;
  lang: string;
  onActiveTabChange: (tab: "ko" | "en") => void;
  onKoreanOnlyChange: (checked: boolean) => void;
}

export function BoardEditHeaderControls({
  activeTab,
  category,
  isKoreanOnly,
  lang,
  onActiveTabChange,
  onKoreanOnlyChange,
}: EditHeaderControlsProps) {
  return (
    <div className="flex items-center justify-between flex-wrap gap-4 bg-slate-50/40 px-4 py-3 border-b border-slate-200 select-none">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <label
            htmlFor="edit-board-category-select"
            className="text-[11.5px] font-bold text-slate-500"
          >
            {lang === "ko" ? "게시판" : "Board"}
          </label>
          <SelectDropdown
            id="edit-board-category-select"
            value={category}
            onChange={() => undefined}
            disabled
            options={[{ value: category, label: category }]}
            className="w-36"
            buttonClassName="h-8 rounded-lg border-slate-200 px-2.5 py-0 text-xs font-bold shadow-xs"
          />
        </div>
        <div className="h-6 w-px bg-slate-200" aria-hidden="true" />
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
          <button
            type="button"
            onClick={() => onActiveTabChange("ko")}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-xs font-bold transition-all border-0 cursor-pointer ${
              activeTab === "ko"
                ? "bg-kaist-darkgreen text-white shadow-xs"
                : "text-slate-500 hover:text-kaist-darkgreen"
            }`}
          >
            <span>{lang === "ko" ? "국문" : "Korean"}</span>
            {activeTab === "ko" && <Check className="w-3.5 h-3.5" />}
          </button>
          <button
            type="button"
            onClick={() => onActiveTabChange("en")}
            disabled={isKoreanOnly}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-xs font-bold transition-all border-0 cursor-pointer ${
              isKoreanOnly
                ? "opacity-30 cursor-not-allowed text-slate-350"
                : "hover:text-kaist-darkgreen"
            } ${
              activeTab === "en"
                ? "bg-kaist-darkgreen text-white shadow-xs"
                : "text-slate-500"
            }`}
            title={
              isKoreanOnly
                ? lang === "ko"
                  ? "한국어 사용자 전용 게시글이므로 영문을 작성할 수 없습니다."
                  : "This is restricted to Korean speakers only."
                : ""
            }
          >
            <Globe className="w-3.5 h-3.5" />
            <span>{lang === "ko" ? "영문" : "English"}</span>
            {activeTab === "en" && <Check className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      <div className="flex items-center">
        <label className="flex items-center gap-2.5 cursor-pointer group bg-slate-100/50 border border-slate-200 px-3.5 py-1.5 rounded-lg">
          <div
            className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${
              isKoreanOnly
                ? "bg-red-500 border-red-500 text-white"
                : "border-slate-300 group-hover:border-kaist-darkgreen"
            }`}
          >
            {isKoreanOnly && (
              <Check className="w-2.5 h-2.5" strokeWidth={4} />
            )}
          </div>
          <input
            type="checkbox"
            className="hidden"
            checked={isKoreanOnly}
            onChange={(event) => onKoreanOnlyChange(event.target.checked)}
          />
          <span
            className={`text-[11.5px] font-bold ${
              isKoreanOnly ? "text-red-600" : "text-slate-600"
            }`}
          >
            Korean Speakers Only
          </span>
        </label>
      </div>
    </div>
  );
}

interface EditToolbarProps {
  fileInputRef: RefObject<HTMLInputElement | null>;
  isSubmitting: boolean;
  lang: string;
  onCancel: () => void;
  onSubmit: () => void;
  onUploadFiles: (files: FileList | null) => void;
  uploading: boolean;
}

export function BoardEditToolbar({
  fileInputRef,
  isSubmitting,
  lang,
  onCancel,
  onSubmit,
  onUploadFiles,
  uploading,
}: EditToolbarProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-3 border-b border-slate-100 bg-white select-none">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-lg p-0.5">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="p-1.5 text-slate-500 hover:text-kaist-darkgreen hover:bg-slate-100 rounded-md transition-colors border-0 bg-transparent disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
            title={lang === "ko" ? "이미지 추가" : "Add Image"}
          >
            <Image className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="p-1.5 text-slate-500 hover:text-kaist-darkgreen hover:bg-slate-100 rounded-md transition-colors border-0 bg-transparent disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
            title={lang === "ko" ? "파일 첨부" : "Attach File"}
          >
            {uploading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <FileText className="w-4 h-4" />
            )}
          </button>
          <button
            type="button"
            className="p-1.5 text-slate-500 hover:text-kaist-darkgreen hover:bg-slate-100 rounded-md transition-colors border-0 bg-transparent cursor-pointer"
            title={lang === "ko" ? "비디오 링크" : "Add Video"}
          >
            <Video className="w-4 h-4" />
          </button>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(event) => onUploadFiles(event.target.files)}
      />

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="px-3.5 py-1.5 rounded-lg border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-50 transition-colors cursor-pointer bg-white"
        >
          {lang === "ko" ? "취소" : "Cancel"}
        </button>
        <button
          type="button"
          onClick={onSubmit}
          disabled={isSubmitting}
          className="px-3.5 py-1.5 rounded-lg bg-kaist-darkgreen text-white text-xs font-bold hover:opacity-90 transition-all cursor-pointer border-0 shadow-xs disabled:cursor-not-allowed disabled:opacity-45"
        >
          {isSubmitting
            ? lang === "ko"
              ? "저장 중..."
              : "Saving..."
            : lang === "ko"
              ? "수정 완료"
              : "Save Changes"}
        </button>
      </div>
    </div>
  );
}

interface EditorFieldsProps {
  activeTab: "ko" | "en";
  contentEn: string;
  contentKo: string;
  lang: string;
  onContentEnChange: (value: string) => void;
  onContentKoChange: (value: string) => void;
  onTitleEnChange: (value: string) => void;
  onTitleKoChange: (value: string) => void;
  titleEn: string;
  titleKo: string;
}

export function BoardWriteEditorFields({
  activeTab,
  contentEn,
  contentKo,
  lang,
  onContentEnChange,
  onContentKoChange,
  onTitleEnChange,
  onTitleKoChange,
  titleEn,
  titleKo,
}: EditorFieldsProps) {
  if (activeTab === "ko") {
    return (
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
        <input
          type="text"
          placeholder={lang === "ko" ? "국문 제목을 입력하세요" : "Enter Korean title"}
          value={titleKo}
          onChange={(event) => onTitleKoChange(event.target.value)}
          className="w-full text-2xl font-bold text-slate-800 bg-transparent focus:outline-none placeholder:text-slate-350"
        />
        <div className="h-px bg-slate-100" />
        <textarea
          placeholder={lang === "ko" ? "국문 내용을 입력하세요" : "Enter Korean content"}
          value={contentKo}
          onChange={(event) => onContentKoChange(event.target.value)}
          className="w-full min-h-[350px] text-base text-slate-700 bg-transparent focus:outline-none resize-none placeholder:text-slate-355 leading-relaxed"
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <input
        type="text"
        placeholder={lang === "ko" ? "영문 제목을 입력하세요" : "Enter English title"}
        value={titleEn}
        onChange={(event) => onTitleEnChange(event.target.value)}
        className="w-full text-2xl font-bold text-slate-800 bg-transparent focus:outline-none placeholder:text-slate-350"
      />
      <div className="h-px bg-slate-100" />
      <textarea
        placeholder={lang === "ko" ? "영문 내용을 입력하세요" : "Enter English content"}
        value={contentEn}
        onChange={(event) => onContentEnChange(event.target.value)}
        className="w-full min-h-[350px] text-base text-slate-700 bg-transparent focus:outline-none resize-none placeholder:text-slate-355 leading-relaxed"
      />
    </div>
  );
}

interface EventFieldsProps {
  eventDescription: string;
  eventEndDate: string;
  eventStartDate: string;
  lang: string;
  onEventDescriptionChange: (value: string) => void;
  onEventEndDateChange: (value: string) => void;
  onEventStartDateChange: (value: string) => void;
}

export function BoardWriteEventFields({
  eventDescription,
  eventEndDate,
  eventStartDate,
  lang,
  onEventDescriptionChange,
  onEventEndDateChange,
  onEventStartDateChange,
}: EventFieldsProps) {
  return (
    <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-4 animate-in fade-in duration-300 select-none">
      <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
        {lang === "ko" ? "행사 일정 및 추가 정보" : "Event Schedule & Extra Info"}
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-bold text-slate-500 mb-1">
            {lang === "ko" ? "행사 시작 일시 *" : "Event Start Date *"}
          </label>
          <input
            type="datetime-local"
            className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-kaist-darkgreen transition-all"
            value={eventStartDate}
            onChange={(event) => onEventStartDateChange(event.target.value)}
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-500 mb-1">
            {lang === "ko" ? "행사 마감 일시 *" : "Event End Date *"}
          </label>
          <input
            type="datetime-local"
            className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-kaist-darkgreen transition-all"
            value={eventEndDate}
            onChange={(event) => onEventEndDateChange(event.target.value)}
          />
        </div>
      </div>
      <div>
        <label className="block text-xs font-bold text-slate-500 mb-1">
          {lang === "ko" ? "카드 노출용 간단한 설명 *" : "Card Description *"}
        </label>
        <input
          type="text"
          placeholder={
            lang === "ko"
              ? "피드에 표시될 짧은 행사 정보입니다"
              : "Short description for card display"
          }
          className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-kaist-darkgreen transition-all"
          value={eventDescription}
          onChange={(event) => onEventDescriptionChange(event.target.value)}
        />
      </div>
    </div>
  );
}

interface SurveyLinkProps {
  lang: string;
  onSelectedSurveyIdChange: (surveyId: string) => void;
  selectedSurveyId: string;
  surveys: SurveyRecord[];
}

export function BoardWriteSurveyLink({
  lang,
  onSelectedSurveyIdChange,
  selectedSurveyId,
  surveys,
}: SurveyLinkProps) {
  return (
    <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-3 select-none">
      <div>
        <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
          {lang === "ko" ? "설문조사 연동" : "Linked Survey"}
        </h3>
        <p className="mt-1 text-[11px] font-semibold text-slate-400">
          {lang === "ko"
            ? "게시글 저장 후 선택한 설문조사가 이 게시글에 연결됩니다."
            : "After publishing, the selected survey will be linked to this post."}
        </p>
      </div>
      <SelectDropdown
        value={selectedSurveyId}
        onChange={onSelectedSurveyIdChange}
        options={[
          {
            value: "",
            label: lang === "ko" ? "연동하지 않음" : "No linked survey",
          },
          ...surveys.map((survey) => ({
            value: survey.id,
            label: lang === "ko" ? survey.titleKo : survey.titleEn || survey.titleKo,
          })),
        ]}
        className="w-full"
        buttonClassName="rounded-lg border-slate-200 px-3.5 py-2 text-xs font-semibold text-slate-700 focus:ring-kaist-darkgreen"
        menuClassName="rounded-lg border-slate-200"
        optionClassName="text-[12px]"
        emptyLabel={lang === "ko" ? "선택지가 없습니다." : "No options."}
      />
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
            <button
              type="button"
              onClick={() => onRemoveAsset(asset.assetId)}
              className="rounded-lg p-1 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 border-0 bg-transparent cursor-pointer"
              title={lang === "ko" ? "첨부 제거" : "Remove attachment"}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

interface PostOptionsProps {
  anonymousLabel?: string;
  isAnonymous: boolean;
  isPinned: boolean;
  lang: string;
  onAnonymousChange: (checked: boolean) => void;
  onPinnedChange: (checked: boolean) => void;
  pinnedLabel?: string;
}

export function BoardWritePostOptions({
  anonymousLabel,
  isAnonymous,
  isPinned,
  lang,
  onAnonymousChange,
  onPinnedChange,
  pinnedLabel,
}: PostOptionsProps) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-[0_10px_35px_rgba(15,23,42,0.05)] flex flex-wrap items-center justify-between gap-6 select-none">
      <div className="flex flex-wrap gap-10">
        <label className="flex items-center gap-2.5 cursor-pointer group">
          <div
            className={`w-4.5 h-4.5 rounded border transition-all flex items-center justify-center ${
              isAnonymous
                ? "bg-kaist-darkgreen border-kaist-darkgreen text-white"
                : "border-slate-300 group-hover:border-kaist-darkgreen"
            }`}
          >
            {isAnonymous && (
              <Check className="w-3 h-3 text-white" strokeWidth={3} />
            )}
          </div>
          <input
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

        <label className="flex items-center gap-2.5 cursor-pointer group">
          <div
            className={`w-4.5 h-4.5 rounded border transition-all flex items-center justify-center ${
              isPinned
                ? "bg-kaist-darkgreen border-kaist-darkgreen text-white"
                : "border-slate-300 group-hover:border-kaist-darkgreen"
            }`}
          >
            {isPinned && (
              <Check className="w-3 h-3 text-white" strokeWidth={3} />
            )}
          </div>
          <input
            type="checkbox"
            className="hidden"
            checked={isPinned}
            onChange={(event) => onPinnedChange(event.target.checked)}
          />
          <span className="text-xs font-bold text-slate-700">
            {pinnedLabel ?? (lang === "ko" ? "게시글 상단 고정" : "Pin to Top")}
          </span>
        </label>
      </div>
    </div>
  );
}
