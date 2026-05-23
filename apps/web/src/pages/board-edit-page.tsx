import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Header } from "@/components/organisms/header";
import { Image, FileText, Video, Globe, Check, ArrowLeft, Loader2 } from "lucide-react";
import { createApiClient } from "@soc/api-client";
import { resolveApiBaseUrl } from "@/lib/api-base-url";
import { useLanguage } from "@/hooks/use-language";

export function BoardEditPage() {
  const { category = "공지", articleId } = useParams<{ category: string; articleId: string }>();
  const navigate = useNavigate();
  const { lang } = useLanguage();

  const apiClient = useMemo(() => createApiClient({ baseUrl: resolveApiBaseUrl() }), []);

  // 에디터 및 입력값 상태
  const [activeTab, setActiveTab] = useState<"ko" | "en">("ko");
  const [titleKo, setTitleKo] = useState("");
  const [titleEn, setTitleEn] = useState("");
  const [contentKo, setContentKo] = useState("");
  const [contentEn, setContentEn] = useState("");
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [isKoreanOnly, setIsKoreanOnly] = useState(false);

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
        setIsKoreanOnly(res.visibilityScope === "MEMBERS");
        setError(null);
      })
      .catch(() => {
        setError(lang === "ko" ? "게시글 정보를 불러오는 데 실패했습니다." : "Failed to load the article details.");
      })
      .finally(() => {
        setLoading(false);
      });
  }, [category, articleId, apiClient, lang]);

  const handleSubmit = async () => {
    if (!articleId) return;

    if (!titleKo.trim() || !contentKo.trim()) {
      alert(lang === "ko" ? "국문 제목과 내용은 필수입니다." : "Korean title and content are required.");
      setActiveTab("ko");
      return;
    }

    if (!isKoreanOnly && (!titleEn.trim() || !contentEn.trim())) {
      alert(lang === "ko" 
        ? "영문 제목과 내용을 입력하거나, 'Korean Only'를 체크해주세요." 
        : "Please enter English title and content, or check 'Korean Only'.");
      setActiveTab("en");
      return;
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
      });
      alert(lang === "ko" ? "게시글이 수정되었습니다." : "Article updated successfully.");
      navigate(`/board/${category}/${articleId}`);
    } catch (err) {
      console.error(err);
      alert(lang === "ko" ? "게시글 수정에 실패했습니다." : "Failed to update article.");
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
            <button
              onClick={() => navigate(`/board/${category}/${articleId}`)}
              className="flex items-center gap-1.5 text-kaist-white/80 hover:text-kaist-white text-xs font-bold mb-3 border-0 bg-transparent cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>{lang === "ko" ? "돌아가기" : "Back to post"}</span>
            </button>
            <h1 className="text-3xl font-extrabold tracking-tight text-kaist-white mb-2">
              {category} &gt; {lang === "ko" ? "글 수정하기" : "Edit Post"}
            </h1>
            <p className="text-kaist-white/80 text-sm font-medium">
              {lang === "ko" ? "기존 게시글의 내용을 변경하고 다듬습니다." : "Modify and refine the content of the article."}
            </p>
          </div>
          <div className="absolute -right-10 -top-10 opacity-20 pointer-events-none select-none">
            <span className="text-[180px] font-black text-kaist-white italic">KAIST</span>
          </div>
        </div>

        {/* 2. 글 수정 영역 */}
        <div className="max-w-5xl mx-auto px-4 -mt-6 relative z-20">
          {loading ? (
            <div className="bg-white border border-kaist-grey/20 rounded-3xl p-16 shadow-xl flex flex-col items-center justify-center gap-4">
              <Loader2 className="w-10 h-10 text-kaist-darkgreen animate-spin" />
              <p className="text-sm font-semibold text-kaist-grey">
                {lang === "ko" ? "게시글을 불러오는 중입니다..." : "Loading article..."}
              </p>
            </div>
          ) : error ? (
            <div className="bg-white border border-kaist-grey/20 rounded-3xl p-12 shadow-xl text-center space-y-4">
              <p className="text-red-500 font-bold">{error}</p>
              <button
                onClick={() => navigate(`/board/${category}/${articleId}`)}
                className="px-5 py-2 bg-kaist-darkgreen text-white font-bold rounded-xl text-sm border-0 cursor-pointer"
              >
                {lang === "ko" ? "게시글로 돌아가기" : "Back to Article"}
              </button>
            </div>
          ) : (
            <>
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
                      Korean Only
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
                      <button type="button" className="p-2 text-kaist-darkgreen hover:bg-kaist-darkgreen/10 rounded-md transition-colors border-0 bg-transparent" title={lang === "ko" ? "이미지 추가" : "Add Image"}>
                        <Image className="w-5 h-5" />
                      </button>
                      <button type="button" className="p-2 text-kaist-darkgreen hover:bg-kaist-darkgreen/10 rounded-md transition-colors border-0 bg-transparent" title={lang === "ko" ? "파일 첨부" : "Attach File"}>
                        <FileText className="w-5 h-5" />
                      </button>
                      <button type="button" className="p-2 text-kaist-darkgreen hover:bg-kaist-darkgreen/10 rounded-md transition-colors border-0 bg-transparent" title={lang === "ko" ? "비디오 링크" : "Add Video"}>
                        <Video className="w-5 h-5" />
                      </button>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => navigate(`/board/${category}/${articleId}`)}
                      className="px-4 py-1.5 rounded-lg border border-kaist-grey/30 text-kaist-grey text-xs font-bold hover:bg-gray-100 transition-colors cursor-pointer bg-white"
                    >
                      {lang === "ko" ? "취소" : "Cancel"}
                    </button>
                    <button
                      type="button"
                      onClick={handleSubmit}
                      disabled={isSubmitting}
                      className="px-4 py-1.5 rounded-lg bg-kaist-darkgreen text-white text-xs font-bold hover:bg-kaist-darkgreen/90 transition-colors cursor-pointer border-0"
                    >
                      {isSubmitting 
                        ? (lang === "ko" ? "저장 중..." : "Saving...") 
                        : (lang === "ko" ? "수정 완료" : "Save Changes")}
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

              {/* 하단 설정 영역 */}
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
                        {lang === "ko" ? "익명으로 수정" : "Edit Anonymously"}
                      </span>
                    </label>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
