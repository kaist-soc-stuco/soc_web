import { useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Header } from "@/components/organisms/header";
import { Image, FileText, Video, Globe, Check } from "lucide-react";
import { createApiClient } from "@soc/api-client";
import { resolveApiBaseUrl } from "@/lib/api-base-url";

export function BoardWritePage() {
  const { category = "공지" } = useParams<{ category: string }>();
  const navigate = useNavigate();

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

  const apiClient = useMemo(() => createApiClient({ baseUrl: resolveApiBaseUrl() }), []);

  const handleSubmit = async () => {
    if (!titleKo.trim() || !contentKo.trim()) {
      alert("국문 제목과 내용은 필수입니다.");
      setActiveTab("ko");
      return;
    }

    if (!isKoreanOnly && (!titleEn.trim() || !contentEn.trim())) {
      alert("영문 제목과 내용을 입력하거나, 'Only for Korean Speaker'를 체크해주세요.");
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
      alert("게시글이 작성되었습니다.");
      navigate(`/board/${category}/${article.articleId}`);
    } catch (err) {
      console.error(err);
      alert("게시글 작성에 실패했습니다.");
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
              {category} &gt; 글 작성하기
            </h1>
            <p className="text-kaist-white/80 text-sm font-medium">새로운 소식을 국문과 영문으로 공유해보세요.</p>
          </div>
          <div className="absolute -right-10 -top-10 opacity-20 pointer-events-none select-none">
            <span className="text-[180px] font-black text-kaist-white italic">KAIST</span>
          </div>
        </div>

        {/* 2. 글 작성 영역 */}
        <div className="max-w-5xl mx-auto px-4 -mt-6 relative z-20">

          {/* 언어 전환 탭 (AWS/Vercel Style) */}
          <div className="flex items-center gap-1 bg-white/80 backdrop-blur-md p-1.5 rounded-t-2xl border-x border-t border-kaist-grey/20 w-fit">
            <button
              onClick={() => setActiveTab("ko")}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === "ko"
                ? "bg-kaist-darkgreen text-white shadow-lg shadow-kaist-darkgreen/20"
                : "text-kaist-grey hover:bg-kaist-lightgreen/40 text-kaist-darkgreen"
                }`}
            >
              <span>국문 (Korean)</span>
              {activeTab === "ko" && <Check className="w-3.5 h-3.5" />}
            </button>
            <button
              onClick={() => setActiveTab("en")}
              disabled={isKoreanOnly}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${
                isKoreanOnly ? "opacity-30 cursor-not-allowed" : "hover:bg-kaist-lightgreen/40 text-kaist-darkgreen"
              } ${activeTab === "en"
                ? "bg-kaist-darkgreen text-white shadow-lg shadow-kaist-darkgreen/20"
                : "text-kaist-grey"
                }`}
              title={isKoreanOnly ? "한국인 전용 게시글이므로 영문을 작성할 수 없습니다." : ""}
            >
              <Globe className="w-3.5 h-3.5" />
              <span>영문 (English)</span>
              {activeTab === "en" && <Check className="w-3.5 h-3.5" />}
            </button>
          </div>

          {/* 에디터 본체 */}
          <div className="bg-white border border-kaist-grey/20 rounded-b-2xl rounded-tr-2xl shadow-xl overflow-hidden">

            {/* 툴바 (이전 기능 복구) */}
            <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-4 border-b border-kaist-grey/10 bg-gray-50/50">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1 bg-white border border-kaist-grey/20 rounded-lg p-1">
                  <button className="p-2 text-kaist-darkgreen hover:bg-kaist-darkgreen/10 rounded-md transition-colors" title="이미지 추가">
                    <Image className="w-5 h-5" />
                  </button>
                  <button className="p-2 text-kaist-darkgreen hover:bg-kaist-darkgreen/10 rounded-md transition-colors" title="파일 첨부">
                    <FileText className="w-5 h-5" />
                  </button>
                  <button className="p-2 text-kaist-darkgreen hover:bg-kaist-darkgreen/10 rounded-md transition-colors" title="비디오 링크">
                    <Video className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  disabled={isSubmitting}
                  className="px-4 py-1.5 rounded-lg border border-kaist-grey/30 text-kaist-grey text-xs font-bold hover:bg-gray-100 transition-colors"
                >
                  임시저장
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  className="px-4 py-1.5 rounded-lg bg-kaist-darkgreen text-white text-xs font-bold hover:bg-kaist-darkgreen/90 transition-colors"
                >
                  {isSubmitting ? "게시 중..." : "글 게시하기"}
                </button>
              </div>
            </div>

            {/* 입력 영역 */}
            <div className="p-8 space-y-6 min-h-[500px]">
              {activeTab === "ko" ? (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <input
                    type="text"
                    placeholder="국문 제목을 입력하세요"
                    value={titleKo}
                    onChange={(e) => setTitleKo(e.target.value)}
                    className="w-full text-3xl font-extrabold text-kaist-black bg-transparent focus:outline-none placeholder:text-kaist-grey/30"
                  />
                  <div className="h-px bg-kaist-grey/10" />
                  <textarea
                    placeholder="국문 내용을 입력하세요"
                    value={contentKo}
                    onChange={(e) => setContentKo(e.target.value)}
                    className="w-full min-h-[400px] text-lg text-kaist-black bg-transparent focus:outline-none resize-none placeholder:text-kaist-grey/30 leading-relaxed"
                  />
                </div>
              ) : (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <input
                    type="text"
                    placeholder="Enter English title"
                    value={titleEn}
                    onChange={(e) => setTitleEn(e.target.value)}
                    className="w-full text-3xl font-extrabold text-kaist-black bg-transparent focus:outline-none placeholder:text-kaist-grey/30"
                  />
                  <div className="h-px bg-kaist-grey/10" />
                  <textarea
                    placeholder="Enter English content"
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


              {/* 대상 설정 */}
              <div className="flex flex-col gap-2">
                <label className="flex items-center gap-3 cursor-pointer group">
                  <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${isKoreanOnly ? 'bg-red-500 border-red-500' : 'border-kaist-grey/30 group-hover:border-kaist-darkgreen'}`}>
                    {isKoreanOnly && <Check className="w-3.5 h-3.5 text-white" strokeWidth={4} />}
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
                  <span className={`text-sm font-bold ${isKoreanOnly ? 'text-red-600' : 'text-kaist-black'}`}>Only for Korean Speaker</span>
                </label>
              </div>

              {/* 익명 설정 */}
              <div className="flex flex-col gap-2">
                <label className="flex items-center gap-3 cursor-pointer group">
                  <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${isAnonymous ? 'bg-kaist-darkgreen border-kaist-darkgreen' : 'border-kaist-grey/30 group-hover:border-kaist-darkgreen'}`}>
                    {isAnonymous && <Check className="w-3.5 h-3.5 text-white" strokeWidth={4} />}
                  </div>
                  <input type="checkbox" className="hidden" checked={isAnonymous} onChange={(e) => setIsAnonymous(e.target.checked)} />
                  <span className="text-sm font-bold text-kaist-black">익명으로 작성</span>
                </label>
              </div>
            </div>


          </div>
        </div>
      </main>
    </div>
  );
}