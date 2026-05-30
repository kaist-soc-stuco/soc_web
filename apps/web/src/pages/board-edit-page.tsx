import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Header } from "@/components/organisms/header";
import { Footer } from "@/components/organisms/footer";
import { PageHero } from "@/components/organisms/page-hero";
import {
  Image,
  FileText,
  Video,
  Globe,
  Check,
  ArrowLeft,
  Loader2,
  X,
} from "lucide-react";
import { createApiClient } from "@soc/api-client";
import { resolveApiBaseUrl } from "@/lib/api-base-url";
import { useLanguage } from "@/hooks/use-language";
import { htmlDatetimeLocalToIso, isoToHtmlDatetimeLocal } from "@soc/shared";

type AttachedAsset = {
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

export function BoardEditPage() {
  const { category = "공지", articleId } = useParams<{
    category: string;
    articleId: string;
  }>();
  const navigate = useNavigate();
  const { lang } = useLanguage();

  const apiClient = useMemo(
    () => createApiClient({ baseUrl: resolveApiBaseUrl() }),
    [],
  );

  // 에디터 및 입력값 상태
  const [activeTab, setActiveTab] = useState<"ko" | "en">("ko");
  const [titleKo, setTitleKo] = useState("");
  const [titleEn, setTitleEn] = useState("");
  const [contentKo, setContentKo] = useState("");
  const [contentEn, setContentEn] = useState("");
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [isPinned, setIsPinned] = useState(false);
  const [isKoreanOnly, setIsKoreanOnly] = useState(false);
  const [assets, setAssets] = useState<AttachedAsset[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [eventStartDate, setEventStartDate] = useState("");
  const [eventEndDate, setEventEndDate] = useState("");
  const [eventDescription, setEventDescription] = useState("");

  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch article data on mount
  useEffect(() => {
    if (!articleId) return;

    setLoading(true);
    apiClient
      .getArticle(category, articleId)
      .then((res) => {
        setTitleKo(res.titleKo);
        setTitleEn(res.titleEn || "");
        setContentKo(res.contentKo);
        setContentEn(res.contentEn || "");
        setIsAnonymous(res.isAnonymous);
        setIsPinned(res.isPinned);
        setIsKoreanOnly(res.visibilityScope === "MEMBERS");
        setEventStartDate(
          res.eventStartDate ? isoToHtmlDatetimeLocal(res.eventStartDate) : "",
        );
        setEventEndDate(
          res.eventEndDate ? isoToHtmlDatetimeLocal(res.eventEndDate) : "",
        );
        setEventDescription(res.eventDescription || "");
        setAssets(
          res.assets.map((asset) => ({
            assetId: asset.assetId,
            mimeType: asset.mimeType,
            originalFilename: asset.originalFilename,
            sizeBytes: asset.sizeBytes,
            storageKey: asset.storageKey,
            usageType: asset.usageType,
          })),
        );
        setError(null);
      })
      .catch(() => {
        setError(
          lang === "ko"
            ? "게시글 정보를 불러오는 데 실패했습니다."
            : "Failed to load the article details.",
        );
      })
      .finally(() => {
        setLoading(false);
      });
  }, [category, articleId, apiClient, lang]);

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

  const handleSubmit = async () => {
    if (!articleId) return;

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

    if (category === "행사") {
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
      await apiClient.updateArticle(category, articleId, {
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
          category === "행사"
            ? htmlDatetimeLocalToIso(eventStartDate)
            : undefined,
        eventEndDate:
          category === "행사"
            ? htmlDatetimeLocalToIso(eventEndDate)
            : undefined,
        eventDescription:
          category === "행사" ? eventDescription.trim() : undefined,
      });
      alert(
        lang === "ko"
          ? "게시글이 수정되었습니다."
          : "Article updated successfully.",
      );
      navigate(`/board/${category}/${articleId}`);
    } catch (err) {
      console.error(err);
      alert(
        lang === "ko"
          ? "게시글 수정에 실패했습니다."
          : "Failed to update article.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#fafafa] flex flex-col text-slate-950">
      <Header showLogo />

      <PageHero
        title={
          lang === "ko"
            ? `${category} - 글 수정하기`
            : `${category} - Edit Post`
        }
        description={
          lang === "ko"
            ? "기존 게시글의 내용을 변경하고 다듬습니다."
            : "Modify and refine the content of the article."
        }
      />

      <main className="flex-1 w-full mx-auto pb-20">
        <div className="mx-auto max-w-[1040px] px-6 lg:px-8 pt-4 pb-16 flex flex-col gap-4 w-full">
          {/* Back Navigation Bar */}
          <div className="flex items-center select-none mb-1">
            <button
              onClick={() => navigate(`/board/${category}/${articleId}`)}
              className="flex items-center gap-1.5 text-slate-400 hover:text-slate-600 text-xs font-bold border-0 bg-transparent cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>{lang === "ko" ? "돌아가기" : "Back to post"}</span>
            </button>
          </div>

          {loading ? (
            <div className="bg-white border border-slate-200 rounded-xl p-16 shadow-[0_10px_35px_rgba(15,23,42,0.05)] flex flex-col items-center justify-center gap-4">
              <Loader2 className="w-10 h-10 text-kaist-darkgreen animate-spin" />
              <p className="text-xs font-semibold text-slate-400">
                {lang === "ko"
                  ? "게시글을 불러오는 중입니다..."
                  : "Loading article..."}
              </p>
            </div>
          ) : error ? (
            <div className="bg-white border border-slate-200 rounded-xl p-12 shadow-[0_10px_35px_rgba(15,23,42,0.05)] text-center space-y-4">
              <p className="text-red-500 text-sm font-bold">{error}</p>
              <button
                onClick={() => navigate(`/board/${category}/${articleId}`)}
                className="px-5 py-2 bg-kaist-darkgreen text-white font-bold rounded-lg text-xs border-0 cursor-pointer shadow-sm hover:opacity-90 transition-all"
              >
                {lang === "ko" ? "게시글로 돌아가기" : "Back to Article"}
              </button>
            </div>
          ) : (
            <>
              {/* Unified Editor Card */}
              <div className="rounded-xl border border-slate-200 bg-white shadow-[0_10px_35px_rgba(15,23,42,0.05)] overflow-hidden">
                {/* 언어 전환 탭 및 Korean Only 옵션 */}
                <div className="flex items-center justify-between flex-wrap gap-4 bg-slate-50/40 px-4 py-3 border-b border-slate-200 select-none">
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2">
                      <label
                        htmlFor="edit-board-category-select"
                        className="text-[11.5px] font-bold text-slate-500"
                      >
                        {lang === "ko" ? "게시판" : "Board"}
                      </label>
                      <select
                        id="edit-board-category-select"
                        value={category}
                        disabled
                        className="h-8 w-[80px] rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-xs font-bold text-slate-500 shadow-xs outline-none disabled:cursor-not-allowed"
                      >
                        <option value={category}>{category}</option>
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
                        {activeTab === "ko" && (
                          <Check className="w-3.5 h-3.5" />
                        )}
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
                        {activeTab === "en" && (
                          <Check className="w-3.5 h-3.5" />
                        )}
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
                    onChange={(event) =>
                      void handleUploadFiles(event.target.files)
                    }
                  />

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        navigate(`/board/${category}/${articleId}`)
                      }
                      className="px-3.5 py-1.5 rounded-lg border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-50 transition-colors cursor-pointer bg-white"
                    >
                      {lang === "ko" ? "취소" : "Cancel"}
                    </button>
                    <button
                      type="button"
                      onClick={handleSubmit}
                      disabled={isSubmitting}
                      className="px-3.5 py-1.5 rounded-lg bg-kaist-darkgreen text-white text-xs font-bold hover:opacity-90 transition-all cursor-pointer border-0 shadow-xs"
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

                  {category === "행사" && (
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
                                {asset.usageType === "IMAGE" ? "IMAGE" : "FILE"}{" "}
                                · {formatFileSize(asset.sizeBytes)}
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
                                lang === "ko"
                                  ? "첨부 제거"
                                  : "Remove attachment"
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
                      {lang === "ko" ? "익명으로 수정" : "Edit Anonymously"}
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
            </>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
