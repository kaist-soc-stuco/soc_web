import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Header } from "@/components/organisms/header";
import { Footer } from "@/components/organisms/footer";
import { PageHero } from "@/components/organisms/page-hero";
import { useConfirmDialog } from "@/components/ui/confirm-dialog";
import { Image, FileText, Video, Globe, Check, Loader2, X } from "lucide-react";
import { createApiClient } from "@soc/api-client";
import { resolveApiBaseUrl } from "@/lib/api-base-url";
import { useLanguage } from "@/hooks/use-language";
import { useCurrentSession } from "@/hooks/use-current-session";
import { hasPersistedProfile } from "@/lib/require-persisted-profile";
import {
  getBoardLabelFromMetadata,
  getBoardTitleFromMetadata,
  getBoardWritePermissionBitFromMetadata,
} from "@/lib/board-metadata";
import {
  hasPermission,
  htmlDatetimeLocalToIso,
  msToDate,
  nowMs,
} from "@soc/shared";
import { useBoardCatalog } from "@/hooks/use-board-catalog";

type AttachedAsset = {
  assetId: string;
  mimeType: string;
  originalFilename: string;
  sizeBytes: number;
  storageKey: string;
  usageType: "IMAGE" | "ATTACHMENT" | "THUMBNAIL";
};

type BoardWriteLocationState = {
  initialCategory?: string;
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

export function BoardWritePage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { lang } = useLanguage();
  const { data: session } = useCurrentSession();
  const { confirm: requestConfirm, ConfirmDialog } = useConfirmDialog();
  const routeInitialCategory =
    (location.state as BoardWriteLocationState | null)?.initialCategory;
  const [selectedCategory, setSelectedCategory] = useState<string>(
    routeInitialCategory ?? "공지",
  );

  // 탭 상태 ("ko" | "en")
  const [activeTab, setActiveTab] = useState<"ko" | "en">("ko");

  // 메타데이터 상태
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [isPinned, setIsPinned] = useState(false);
  const [isKoreanOnly, setIsKoreanOnly] = useState(false);

  // 에디터 및 입력값 상태
  const [titleKo, setTitleKo] = useState("");
  const [titleEn, setTitleEn] = useState("");
  const [contentKo, setContentKo] = useState("");
  const [contentEn, setContentEn] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [assets, setAssets] = useState<AttachedAsset[]>([]);
  const [uploading, setUploading] = useState(false);

  // 행사 일정 및 카드 노출용 간단한 설명 상태
  const [eventStartDate, setEventStartDate] = useState("");
  const [eventEndDate, setEventEndDate] = useState("");
  const [eventDescription, setEventDescription] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 임시저장 상태
  const [hasDraft, setHasDraft] = useState(false);
  const [draftTime, setDraftTime] = useState<number>(0);

  const apiClient = useMemo(
    () => createApiClient({ baseUrl: resolveApiBaseUrl() }),
    [],
  );
  const { boards, boardByCode } = useBoardCatalog(apiClient);
  const userPermission = session?.permission ?? 0;
  const canUseWriteFeatures = hasPersistedProfile(session ?? null);
  const writableBoardCodes = useMemo(() => {
    if (!canUseWriteFeatures) return [];

    return boards
      .filter((board) => {
        const requiredPermission = getBoardWritePermissionBitFromMetadata(
          board,
          board.code,
        );
        return (
          requiredPermission === 0 ||
          hasPermission(userPermission, requiredPermission)
        );
      })
      .map((board) => board.code);
  }, [boards, canUseWriteFeatures, userPermission]);
  const canWriteSelected =
    canUseWriteFeatures && writableBoardCodes.includes(selectedCategory);

  useEffect(() => {
    if (!canUseWriteFeatures || writableBoardCodes.length === 0) return;
    if (writableBoardCodes.includes(selectedCategory)) return;

    const preferredCategory =
      routeInitialCategory && writableBoardCodes.includes(routeInitialCategory)
        ? routeInitialCategory
        : writableBoardCodes[0];

    if (preferredCategory && selectedCategory !== preferredCategory) {
      setSelectedCategory(preferredCategory);
    }
  }, [
    routeInitialCategory,
    selectedCategory,
    canUseWriteFeatures,
    writableBoardCodes,
  ]);

  const selectedBoard = boardByCode.get(selectedCategory);

  const handleCategoryChange = (nextCategory: string) => {
    setSelectedCategory(nextCategory);
  };

  const handleUploadFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    setUploading(true);
    try {
      const uploaded = await Promise.all(
        Array.from(files).map(async (file) => {
          const asset = await apiClient.uploadAsset(file);
          return {
            assetId: asset.assetId,
            mimeType: asset.mimeType,
            originalFilename: asset.originalFilename,
            sizeBytes: asset.sizeBytes,
            storageKey: asset.storageKey,
            usageType: asset.mimeType.startsWith("image/")
              ? "IMAGE"
              : "ATTACHMENT",
          } satisfies AttachedAsset;
        }),
      );
      setAssets((prev) => [...prev, ...uploaded]);
    } catch (err) {
      console.error(err);
      alert(
        lang === "ko"
          ? "파일 업로드에 실패했습니다."
          : "Failed to upload files.",
      );
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  // Check for draft on mount or category change
  useEffect(() => {
    const key = `draft_${selectedCategory}`;
    const raw = localStorage.getItem(key);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (
          parsed.titleKo ||
          parsed.contentKo ||
          parsed.titleEn ||
          parsed.contentEn
        ) {
          setHasDraft(true);
          setDraftTime(parsed.updatedAt || 0);
        }
      } catch (e) {
        console.error(e);
      }
    } else {
      setHasDraft(false);
    }
  }, [selectedCategory]);

  const handleSaveDraft = (silent = false) => {
    const key = `draft_${selectedCategory}`;
    const data = {
      titleKo,
      titleEn,
      contentKo,
      contentEn,
      isAnonymous,
      isPinned,
      isKoreanOnly,
      eventStartDate,
      eventEndDate,
      eventDescription,
      updatedAt: nowMs(),
    };
    localStorage.setItem(key, JSON.stringify(data));
    if (!silent) {
      alert(
        lang === "ko" ? "임시 저장되었습니다." : "Draft saved successfully.",
      );
    }
  };

  const handleRestoreDraft = () => {
    const key = `draft_${selectedCategory}`;
    const raw = localStorage.getItem(key);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      setTitleKo(parsed.titleKo || "");
      setTitleEn(parsed.titleEn || "");
      setContentKo(parsed.contentKo || "");
      setContentEn(parsed.contentEn || "");
      setIsAnonymous(parsed.isAnonymous ?? false);
      setIsPinned(parsed.isPinned ?? false);
      setIsKoreanOnly(parsed.isKoreanOnly ?? false);
      setEventStartDate(parsed.eventStartDate || "");
      setEventEndDate(parsed.eventEndDate || "");
      setEventDescription(parsed.eventDescription || "");
      setHasDraft(false);
      alert(
        lang === "ko"
          ? "임시 저장글이 복구되었습니다."
          : "Draft restored successfully.",
      );
    } catch (e) {
      console.error(e);
    }
  };

  const handleDiscardDraft = async () => {
    const confirmed = await requestConfirm({
      confirmLabel: lang === "ko" ? "삭제" : "Delete",
      description:
        lang === "ko"
          ? "브라우저에 저장된 임시 작성 내용이 삭제됩니다."
          : "The draft saved in this browser will be removed.",
      title:
        lang === "ko"
          ? "임시 저장글을 삭제하시겠습니까?"
          : "Delete this draft?",
      tone: "danger",
    });
    if (!confirmed) return;

    const key = `draft_${selectedCategory}`;
    localStorage.removeItem(key);
    setEventStartDate("");
    setEventEndDate("");
    setEventDescription("");
    setHasDraft(false);
  };

  // Auto save draft every 10 seconds after content has been entered.
  useEffect(() => {
    if (
      !titleKo &&
      !contentKo &&
      !titleEn &&
      !contentEn &&
      !eventStartDate &&
      !eventEndDate &&
      !eventDescription
    )
      return;
    const timer = setTimeout(() => {
      handleSaveDraft(true);
    }, 10000);
    return () => clearTimeout(timer);
  }, [
    titleKo,
    contentKo,
    titleEn,
    contentEn,
    isAnonymous,
    isPinned,
    isKoreanOnly,
    eventStartDate,
    eventEndDate,
    eventDescription,
    selectedCategory,
  ]);

  const handleSubmit = async () => {
    if (!canWriteSelected) {
      alert(
        lang === "ko"
          ? "이 게시판에 글을 작성할 권한이 없습니다."
          : "You do not have permission to write to this board.",
      );
      return;
    }

    if (!titleKo.trim() || !contentKo.trim()) {
      alert(
        lang === "ko"
          ? "국문 제목과 내용은 필수입니다."
          : "Korean title and content are required.",
      );
      setActiveTab("ko");
      return;
    }

    if (!isKoreanOnly && (!titleEn.trim() || !contentEn.trim())) {
      alert(
        lang === "ko"
          ? "영문 제목과 내용을 입력하거나, 'Korean Speakers Only'를 체크해주세요."
          : "Please enter English title and content, or check 'Korean Speakers Only'.",
      );
      setActiveTab("en");
      return;
    }

    if (selectedCategory === "행사") {
      if (!eventStartDate || !eventEndDate || !eventDescription.trim()) {
        alert(
          lang === "ko"
            ? "행사 일정(시작/마감) 및 간단한 설명은 필수입니다."
            : "Event schedule (start/end) and card description are required.",
        );
        return;
      }
    }

    try {
      setIsSubmitting(true);
      const article = await apiClient.createArticle(selectedCategory, {
        titleKo,
        titleEn: titleEn || undefined,
        contentKo,
        contentEn: contentEn || undefined,
        visibilityScope: isKoreanOnly ? "MEMBERS" : "PUBLIC",
        isAnonymous,
        isPinned,
        assets: assets.map((asset, index) => ({
          assetId: asset.assetId,
          usageType: asset.usageType,
          sortOrder: index,
        })),
        eventStartDate:
          selectedCategory === "행사"
            ? htmlDatetimeLocalToIso(eventStartDate)
            : undefined,
        eventEndDate:
          selectedCategory === "행사"
            ? htmlDatetimeLocalToIso(eventEndDate)
            : undefined,
        eventDescription:
          selectedCategory === "행사" ? eventDescription.trim() : undefined,
      });
      localStorage.removeItem(`draft_${selectedCategory}`);
      alert(
        lang === "ko"
          ? "게시글이 작성되었습니다."
          : "Article published successfully.",
      );
      navigate(`/board/${selectedCategory}/${article.articleId}`);
    } catch (err) {
      console.error(err);
      alert(
        lang === "ko"
          ? "게시글 작성에 실패했습니다."
          : "Failed to publish article.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#fafafa] flex flex-col text-slate-950">
      {ConfirmDialog}
      <Header showLogo />

      <PageHero
        title={
          lang === "ko"
            ? `${getBoardTitleFromMetadata(
                selectedBoard,
                selectedCategory,
                lang,
              )} 글 작성`
            : `${getBoardLabelFromMetadata(
                selectedBoard,
                selectedCategory,
                lang,
              )} - Write Post`
        }
        description={
          lang === "ko"
            ? "새로운 소식을 국문과 영문으로 공유해보세요."
            : "Share news in Korean and English."
        }
      />

      <main className="flex-1 w-full mx-auto pb-20">
        <div className="mx-auto max-w-[1040px] px-6 lg:px-8 pt-4 pb-16 flex flex-col gap-4 w-full">
          {/* 임시저장 알림 배너 */}
          {hasDraft && (
            <div className="bg-emerald-50/50 border border-kaist-darkgreen/20 px-6 py-4 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-in fade-in slide-in-from-top-2 duration-300">
              <span className="font-semibold text-kaist-darkgreen text-xs">
                {lang === "ko"
                  ? `이전에 작성 중이던 임시 저장글이 있습니다. (저장 시각: ${msToDate(draftTime).toLocaleTimeString()})`
                  : `You have a saved draft from a previous session. (Saved at: ${msToDate(draftTime).toLocaleTimeString()})`}
              </span>
              <div className="flex gap-2 w-full sm:w-auto shrink-0 justify-end">
                <button
                  onClick={handleRestoreDraft}
                  className="px-4 py-2 bg-kaist-darkgreen text-white rounded-lg text-xs font-bold hover:opacity-90 transition-all cursor-pointer border-0 shadow-sm"
                >
                  {lang === "ko" ? "불러오기" : "Restore"}
                </button>
                <button
                  onClick={() => void handleDiscardDraft()}
                  className="px-4 py-2 bg-slate-200/80 text-slate-600 rounded-lg text-xs font-bold hover:bg-slate-300/80 transition-all cursor-pointer border-0"
                >
                  {lang === "ko" ? "삭제" : "Discard"}
                </button>
              </div>
            </div>
          )}

          {/* Unified Editor Card */}
          <div className="rounded-xl border border-slate-200 bg-white shadow-[0_10px_35px_rgba(15,23,42,0.05)] overflow-hidden">
            {/* 언어 전환 탭 및 Korean Only 옵션 */}
            <div className="flex items-center justify-between flex-wrap gap-4 bg-slate-50/40 px-4 py-3 border-b border-slate-200 select-none">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <label
                    htmlFor="board-category-select"
                    className="text-[11.5px] font-bold text-slate-500"
                  >
                    {lang === "ko" ? "게시판" : "Board"}
                  </label>
                  <select
                    id="board-category-select"
                    value={selectedCategory}
                    onChange={(event) =>
                      handleCategoryChange(event.target.value)
                    }
                    disabled={writableBoardCodes.length === 0}
                    className="h-8 w-[80px] rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-bold text-slate-800 shadow-xs outline-none transition focus:border-kaist-darkgreen focus:ring-2 focus:ring-kaist-darkgreen/10 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
                  >
                    {writableBoardCodes.length > 0 ? (
                      writableBoardCodes.map((code) => (
                        <option key={code} value={code}>
                          {getBoardLabelFromMetadata(
                            boardByCode.get(code),
                            code,
                            lang,
                          )}
                        </option>
                      ))
                    ) : (
                      <option value={selectedCategory}>
                        {lang === "ko"
                          ? "작성 가능한 게시판 없음"
                          : "No writable board"}
                      </option>
                    )}
                  </select>
                </div>
                <div className="h-6 w-px bg-slate-200" aria-hidden="true" />
                <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
                  <button
                    type="button"
                    onClick={() => setActiveTab("ko")}
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
                    onClick={() => setActiveTab("en")}
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
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setIsKoreanOnly(checked);
                      if (checked) setActiveTab("ko");
                    }}
                  />
                  <span
                    className={`text-[11.5px] font-bold ${isKoreanOnly ? "text-red-600" : "text-slate-600"}`}
                  >
                    Korean Speakers Only
                  </span>
                </label>
              </div>
            </div>

            {/* 툴바 */}
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
                onChange={(event) => void handleUploadFiles(event.target.files)}
              />

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => handleSaveDraft(false)}
                  disabled={isSubmitting}
                  className="px-3.5 py-1.5 rounded-lg border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-50 transition-colors cursor-pointer bg-white"
                >
                  {lang === "ko" ? "임시저장" : "Save Draft"}
                </button>
                <button
                  type="button"
                  onClick={handleSubmit}
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

            {/* 입력 영역 */}
            <div className="p-6 md:p-8 space-y-6 min-h-[450px]">
              {activeTab === "ko" ? (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <input
                    type="text"
                    placeholder={
                      lang === "ko"
                        ? "국문 제목을 입력하세요"
                        : "Enter Korean title"
                    }
                    value={titleKo}
                    onChange={(e) => setTitleKo(e.target.value)}
                    className="w-full text-2xl font-bold text-slate-800 bg-transparent focus:outline-none placeholder:text-slate-350"
                  />
                  <div className="h-px bg-slate-100" />
                  <textarea
                    placeholder={
                      lang === "ko"
                        ? "국문 내용을 입력하세요"
                        : "Enter Korean content"
                    }
                    value={contentKo}
                    onChange={(e) => setContentKo(e.target.value)}
                    className="w-full min-h-[350px] text-base text-slate-700 bg-transparent focus:outline-none resize-none placeholder:text-slate-355 leading-relaxed"
                  />
                </div>
              ) : (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <input
                    type="text"
                    placeholder={
                      lang === "ko"
                        ? "영문 제목을 입력하세요"
                        : "Enter English title"
                    }
                    value={titleEn}
                    onChange={(e) => setTitleEn(e.target.value)}
                    className="w-full text-2xl font-bold text-slate-800 bg-transparent focus:outline-none placeholder:text-slate-350"
                  />
                  <div className="h-px bg-slate-100" />
                  <textarea
                    placeholder={
                      lang === "ko"
                        ? "영문 내용을 입력하세요"
                        : "Enter English content"
                    }
                    value={contentEn}
                    onChange={(e) => setContentEn(e.target.value)}
                    className="w-full min-h-[350px] text-base text-slate-700 bg-transparent focus:outline-none resize-none placeholder:text-slate-355 leading-relaxed"
                  />
                </div>
              )}

              {selectedCategory === "행사" && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-4 animate-in fade-in duration-300 select-none">
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    {lang === "ko"
                      ? "행사 일정 및 추가 정보"
                      : "Event Schedule & Extra Info"}
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1">
                        {lang === "ko"
                          ? "행사 시작 일시 *"
                          : "Event Start Date *"}
                      </label>
                      <input
                        type="datetime-local"
                        className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-kaist-darkgreen transition-all"
                        value={eventStartDate}
                        onChange={(e) => setEventStartDate(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1">
                        {lang === "ko"
                          ? "행사 마감 일시 *"
                          : "Event End Date *"}
                      </label>
                      <input
                        type="datetime-local"
                        className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-kaist-darkgreen transition-all"
                        value={eventEndDate}
                        onChange={(e) => setEventEndDate(e.target.value)}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">
                      {lang === "ko"
                        ? "카드 노출용 간단한 설명 *"
                        : "Card Description *"}
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
                      onChange={(e) => setEventDescription(e.target.value)}
                    />
                  </div>
                </div>
              )}

              {assets.length > 0 && (
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
                          onClick={() =>
                            setAssets((prev) =>
                              prev.filter(
                                (item) => item.assetId !== asset.assetId,
                              ),
                            )
                          }
                          className="rounded-lg p-1 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 border-0 bg-transparent cursor-pointer"
                          title={
                            lang === "ko" ? "첨부 제거" : "Remove attachment"
                          }
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 하단 설정 영역 */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-[0_10px_35px_rgba(15,23,42,0.05)] flex flex-wrap items-center justify-between gap-6 select-none">
            <div className="flex flex-wrap gap-10">
              {/* 익명 설정 */}
              <label className="flex items-center gap-2.5 cursor-pointer group">
                <div
                  className={`w-4.5 h-4.5 rounded border transition-all flex items-center justify-center ${isAnonymous ? "bg-kaist-darkgreen border-kaist-darkgreen text-white" : "border-slate-300 group-hover:border-kaist-darkgreen"}`}
                >
                  {isAnonymous && (
                    <Check className="w-3 h-3 text-white" strokeWidth={3} />
                  )}
                </div>
                <input
                  type="checkbox"
                  className="hidden"
                  checked={isAnonymous}
                  onChange={(e) => setIsAnonymous(e.target.checked)}
                />
                <span className="text-xs font-bold text-slate-700">
                  {lang === "ko" ? "익명으로 작성" : "Write Anonymously"}
                </span>
              </label>

              {/* 고정 여부 설정 (Pin notice) */}
              <label className="flex items-center gap-2.5 cursor-pointer group">
                <div
                  className={`w-4.5 h-4.5 rounded border transition-all flex items-center justify-center ${isPinned ? "bg-kaist-darkgreen border-kaist-darkgreen text-white" : "border-slate-300 group-hover:border-kaist-darkgreen"}`}
                >
                  {isPinned && (
                    <Check className="w-3 h-3 text-white" strokeWidth={3} />
                  )}
                </div>
                <input
                  type="checkbox"
                  className="hidden"
                  checked={isPinned}
                  onChange={(e) => setIsPinned(e.target.checked)}
                />
                <span className="text-xs font-bold text-slate-700">
                  {lang === "ko" ? "게시글 상단 고정" : "Pin to Top"}
                </span>
              </label>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
