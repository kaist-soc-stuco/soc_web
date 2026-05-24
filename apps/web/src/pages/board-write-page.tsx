import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Header } from "@/components/organisms/header";
import { Image, FileText, Video, Globe, Check } from "lucide-react";
import { createApiClient } from "@soc/api-client";
import { resolveApiBaseUrl } from "@/lib/api-base-url";
import { useLanguage } from "@/hooks/use-language";

export function BoardWritePage() {
  const { category = "공지" } = useParams<{ category: string }>();
  const navigate = useNavigate();
  const { lang } = useLanguage();

  // 탭 상태 ("ko" | "en")
  const [activeTab, setActiveTab] = useState<"ko" | "en">("ko");

  // 메타데이터 상태
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [isKoreanOnly, setIsKoreanOnly] = useState(false);

  // 에디터 및 입력값 상태
  const [titleKo, setTitleKo] = useState("");
  const [titleEn, setTitleEn] = useState("");
  const [contentKo, setContentKo] = useState("");
  const [contentEn, setContentEn] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 임시저장 상태
  const [hasDraft, setHasDraft] = useState(false);
  const [draftTime, setDraftTime] = useState<number>(0);

  const apiClient = useMemo(() => createApiClient({ baseUrl: resolveApiBaseUrl() }), []);

  // Check for draft on mount or category change
  useEffect(() => {
    const key = `draft_${category}`;
    const raw = localStorage.getItem(key);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (parsed.titleKo || parsed.contentKo || parsed.titleEn || parsed.contentEn) {
          setHasDraft(true);
          setDraftTime(parsed.updatedAt || 0);
        }
      } catch (e) {
        console.error(e);
      }
    } else {
      setHasDraft(false);
    }
  }, [category]);

  const handleSaveDraft = (silent = false) => {
    const key = `draft_${category}`;
    const data = {
      titleKo,
      titleEn,
      contentKo,
      contentEn,
      isAnonymous,
      isKoreanOnly,
      updatedAt: Date.now(),
    };
    localStorage.setItem(key, JSON.stringify(data));
    if (!silent) {
      alert(lang === "ko" ? "임시 저장되었습니다." : "Draft saved successfully.");
    }
  };

  const handleRestoreDraft = () => {
    const key = `draft_${category}`;
    const raw = localStorage.getItem(key);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      setTitleKo(parsed.titleKo || "");
      setTitleEn(parsed.titleEn || "");
      setContentKo(parsed.contentKo || "");
      setContentEn(parsed.contentEn || "");
      setIsAnonymous(parsed.isAnonymous ?? false);
      setIsKoreanOnly(parsed.isKoreanOnly ?? false);
      setHasDraft(false);
      alert(lang === "ko" ? "임시 저장글이 복구되었습니다." : "Draft restored successfully.");
    } catch (e) {
      console.error(e);
    }
  };

  const handleDiscardDraft = () => {
    if (confirm(lang === "ko" ? "임시 저장글을 삭제하시겠습니까?" : "Are you sure you want to delete this draft?")) {
      const key = `draft_${category}`;
      localStorage.removeItem(key);
      setHasDraft(false);
    }
  };

  // Auto save draft every 10 seconds if any content has been entered
  useEffect(() => {
    if (!titleKo && !contentKo && !titleEn && !contentEn) return;
    const timer = setTimeout(() => {
      handleSaveDraft(true);
    }, 10000);
    return () => clearTimeout(timer);
  }, [titleKo, contentKo, titleEn, contentEn, isAnonymous, isKoreanOnly]);

  const handleSubmit = async () => {
    if (!titleKo.trim() || !contentKo.trim()) {
      alert(lang === "ko" ? "국문 제목과 내용은 필수입니다." : "Korean title and content are required.");
      setActiveTab("ko");
      return;
    }

    if (!isKoreanOnly && (!titleEn.trim() || !contentEn.trim())) {
      alert(lang === "ko" 
        ? "영문 제목과 내용을 입력하거나, 'Korean Speakers Only'를 체크해주세요." 
        : "Please enter English title and content, or check 'Korean Speakers Only'.");
      setActiveTab("en");
      return;
    }

    try {
      setIsSubmitting(true);
      const article = await apiClient.createArticle(category, {
        titleKo,
        titleEn: titleEn || undefined,
        contentKo,
        contentEn: contentEn || undefined,
        visibilityScope: isKoreanOnly ? "MEMBERS" : "PUBLIC",
        isAnonymous,
      });
      localStorage.removeItem(`draft_${category}`);
      alert(lang === "ko" ? "게시글이 작성되었습니다." : "Article published successfully.");
      navigate(`/board/${category}/${article.articleId}`);
    } catch (err) {
      console.error(err);
      alert(lang === "ko" ? "게시글 작성에 실패했습니다." : "Failed to publish article.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-kaist-white flex flex-col">
      <Header showLogo />

      <main className="flex-1 w-full mx-auto pb-20">
        {/* 1. 상단 배너 */}
        <div className="relative overflow-hidden bg-gradient-to-r from-kaist-darkgreen to-kaist-lightgreen2 py-10 px-4 md:px-8">
          <div className="max-w-5xl mx-auto relative z-10">
            <h1 className="text-3xl font-extrabold tracking-tight text-kaist-white mb-2">
              {category} &gt; {lang === "ko" ? "글 작성하기" : "Write Post"}
            </h1>
            <p className="text-kaist-white/80 text-sm font-medium">
              {lang === "ko" ? "새로운 소식을 국문과 영문으로 공유해보세요." : "Share news in Korean and English."}
            </p>
          </div>
          <div className="absolute -right-10 -top-10 opacity-20 pointer-events-none select-none">
            <span className="text-[180px] font-black text-kaist-white italic">KAIST</span>
          </div>
        </div>

        {/* 2. 글 작성 영역 */}
        <div className="max-w-5xl mx-auto px-4 -mt-6 relative z-20">
          
          {/* 임시저장 알림 배너 */}
          {hasDraft && (
            <div className="mb-4 bg-kaist-lightgreen/20 border border-kaist-darkgreen/30 px-6 py-4 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-in fade-in slide-in-from-top-2 duration-300">
              <span className="font-semibold text-kaist-darkgreen text-sm">
                {lang === "ko" 
                  ? `이전에 작성 중이던 임시 저장글이 있습니다. (저장 시각: ${new Date(draftTime).toLocaleTimeString()})`
                  : `You have a saved draft from a previous session. (Saved at: ${new Date(draftTime).toLocaleTimeString()})`}
              </span>
              <div className="flex gap-2 w-full sm:w-auto shrink-0 justify-end">
                <button
                  onClick={handleRestoreDraft}
                  className="px-4 py-2 bg-kaist-darkgreen text-white rounded-xl text-xs font-bold hover:bg-opacity-95 transition-all cursor-pointer border-0 shadow-md shadow-kaist-darkgreen/15"
                >
                  {lang === "ko" ? "불러오기" : "Restore"}
                </button>
                <button
                  onClick={handleDiscardDraft}
                  className="px-4 py-2 bg-gray-200 text-kaist-grey rounded-xl text-xs font-bold hover:bg-gray-300 transition-all cursor-pointer border-0"
                >
                  {lang === "ko" ? "삭제" : "Discard"}
                </button>
              </div>
            </div>
          )}

          {/* 언어 전환 탭 및 Korean Only 옵션 */}
          <div className="flex items-center justify-between flex-wrap gap-4 bg-white/80 backdrop-blur-md p-3 rounded-t-2xl border-x border-t border-kaist-grey/20">
            <div className="flex items-center gap-1 bg-gray-100 p-1.5 rounded-xl">
              <button
                type="button"
                onClick={() => setActiveTab("ko")}
                className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-bold transition-all ${
                  activeTab === "ko"
                    ? "bg-kaist-darkgreen text-white shadow-sm"
                    : "text-kaist-grey hover:bg-white/50 hover:text-kaist-darkgreen"
                }`}
              >
                <span>{lang === "ko" ? "국문 (Korean)" : "Korean"}</span>
                {activeTab === "ko" && <Check className="w-3.5 h-3.5" />}
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("en")}
                disabled={isKoreanOnly}
                className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-bold transition-all ${
                  isKoreanOnly ? "opacity-30 cursor-not-allowed text-kaist-grey/50" : "hover:bg-white/50 hover:text-kaist-darkgreen"
                } ${
                  activeTab === "en"
                    ? "bg-white text-kaist-darkgreen shadow-sm"
                    : "text-kaist-grey"
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
                <span>{lang === "ko" ? "영문 (English)" : "English"}</span>
                {activeTab === "en" && <Check className="w-3.5 h-3.5" />}
              </button>
            </div>

            <div className="flex items-center px-2">
              <label className="flex items-center gap-2.5 cursor-pointer group bg-gray-50 border border-gray-200 px-4 py-2 rounded-xl">
                <div
                  className={`w-4.5 h-4.5 rounded border-2 flex items-center justify-center transition-all ${
                    isKoreanOnly
                      ? "bg-red-500 border-red-500 shadow-sm shadow-red-500/15"
                      : "border-kaist-grey/30 group-hover:border-kaist-darkgreen"
                  }`}
                >
                  {isKoreanOnly && <Check className="w-3 h-3 text-white" strokeWidth={4} />}
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
                <span className={`text-xs font-bold ${isKoreanOnly ? "text-red-600" : "text-kaist-black"}`}>
                  Korean Speakers Only
                </span>
              </label>
            </div>
          </div>

          {/* 에디터 본체 */}
          <div className="bg-white border-x border-b border-kaist-grey/20 rounded-b-2xl shadow-xl overflow-hidden">

            {/* 툴바 */}
            <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-4 border-b border-kaist-grey/10 bg-gray-50/50">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1 bg-white border border-kaist-grey/20 rounded-lg p-1">
                  <button className="p-2 text-kaist-darkgreen hover:bg-kaist-darkgreen/10 rounded-md transition-colors border-0 bg-transparent" title={lang === "ko" ? "이미지 추가" : "Add Image"}>
                    <Image className="w-5 h-5" />
                  </button>
                  <button className="p-2 text-kaist-darkgreen hover:bg-kaist-darkgreen/10 rounded-md transition-colors border-0 bg-transparent" title={lang === "ko" ? "파일 첨부" : "Attach File"}>
                    <FileText className="w-5 h-5" />
                  </button>
                  <button className="p-2 text-kaist-darkgreen hover:bg-kaist-darkgreen/10 rounded-md transition-colors border-0 bg-transparent" title={lang === "ko" ? "비디오 링크" : "Add Video"}>
                    <Video className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => handleSaveDraft(false)}
                  disabled={isSubmitting}
                  className="px-4 py-1.5 rounded-lg border border-kaist-grey/30 text-kaist-grey text-xs font-bold hover:bg-gray-100 transition-colors cursor-pointer"
                >
                  {lang === "ko" ? "임시저장" : "Save Draft"}
                </button>
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  className="px-4 py-1.5 rounded-lg bg-kaist-darkgreen text-white text-xs font-bold hover:bg-kaist-darkgreen/90 transition-colors cursor-pointer border-0"
                >
                  {isSubmitting 
                    ? (lang === "ko" ? "게시 중..." : "Publishing...") 
                    : (lang === "ko" ? "글 게시하기" : "Publish Post")}
                </button>
              </div>
            </div>

            {/* 입력 영역 */}
            <div className="p-8 space-y-6 min-h-[500px]">
              {activeTab === "ko" ? (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <input
                    type="text"
                    placeholder={lang === "ko" ? "국문 제목을 입력하세요" : "Enter Korean title"}
                    value={titleKo}
                    onChange={(e) => setTitleKo(e.target.value)}
                    className="w-full text-3xl font-extrabold text-kaist-black bg-transparent focus:outline-none placeholder:text-kaist-grey/30"
                  />
                  <div className="h-px bg-kaist-grey/10" />
                  <textarea
                    placeholder={lang === "ko" ? "국문 내용을 입력하세요" : "Enter Korean content"}
                    value={contentKo}
                    onChange={(e) => setContentKo(e.target.value)}
                    className="w-full min-h-[400px] text-lg text-kaist-black bg-transparent focus:outline-none resize-none placeholder:text-kaist-grey/30 leading-relaxed"
                  />
                </div>
              ) : (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <input
                    type="text"
                    placeholder={lang === "ko" ? "영문 제목을 입력하세요" : "Enter English title"}
                    value={titleEn}
                    onChange={(e) => setTitleEn(e.target.value)}
                    className="w-full text-3xl font-extrabold text-kaist-black bg-transparent focus:outline-none placeholder:text-kaist-grey/30"
                  />
                  <div className="h-px bg-kaist-grey/10" />
                  <textarea
                    placeholder={lang === "ko" ? "영문 내용을 입력하세요" : "Enter English content"}
                    value={contentEn}
                    onChange={(e) => setContentEn(e.target.value)}
                    className="w-full min-h-[400px] text-lg text-kaist-black bg-transparent focus:outline-none resize-none placeholder:text-kaist-grey/30 leading-relaxed"
                  />
                </div>
              )}
            </div>
          </div>

          {/* 3. 하단 설정 영역 */}
          <div className="mt-8 bg-white rounded-2xl border border-kaist-grey/20 p-6 shadow-lg flex flex-wrap items-center justify-between gap-6">
            <div className="flex flex-wrap gap-10">



              {/* 익명 설정 */}
              <div className="flex flex-col gap-2">
                <label className="flex items-center gap-3 cursor-pointer group">
                  <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${isAnonymous ? 'bg-kaist-darkgreen border-kaist-darkgreen shadow-md shadow-kaist-darkgreen/15' : 'border-kaist-grey/30 group-hover:border-kaist-darkgreen'}`}>
                    {isAnonymous && <Check className="w-3.5 h-3.5 text-white" strokeWidth={4} />}
                  </div>
                  <input type="checkbox" className="hidden" checked={isAnonymous} onChange={(e) => setIsAnonymous(e.target.checked)} />
                  <span className="text-sm font-bold text-kaist-black">
                    {lang === "ko" ? "익명으로 작성" : "Write Anonymously"}
                  </span>
                </label>
              </div>
            </div>

          </div>
        </div>
      </main>
    </div>
  );
}