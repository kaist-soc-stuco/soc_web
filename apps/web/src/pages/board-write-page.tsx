import { useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Header } from "@/components/organisms/header";
import { Image, FileText, Video } from "lucide-react"; // 에디터 툴바용 아이콘
import { createApiClient } from "@soc/api-client";
import { resolveApiBaseUrl } from "@/lib/api";

const CATEGORY_OPTIONS = ["공지", "이벤트", "안내", "긴급"];

export function BoardWritePage() {
  const { category = "공지" } = useParams<{ category: string }>();
  const navigate = useNavigate();

  // 메타데이터 상태 (시안 하단의 선택 영역)
  const [isAnonymous, setIsAnonymous] = useState(false);

  // 에디터 및 입력값 상태 (API 연동시 사용)
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [content, setContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const apiClient = useMemo(() => createApiClient({ baseUrl: resolveApiBaseUrl() }), []);

  const handleSubmit = async () => {
    if (!title.trim() || !content.trim()) {
      alert("제목과 내용을 입력해주세요.");
      return;
    }
    
    try {
      setIsSubmitting(true);
      const article = await apiClient.createArticle(category, {
        titleKo: title,
        titleEn: subtitle, // 임시로 subtitle을 titleEn에 넣거나 무시
        contentKo: content,
        visibilityScope: "PUBLIC",
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

      <main className="flex-1 w-full mx-auto">
        {/* 1. 상단 배너 (공지 게시판 등과 동일한 스타일) */}
        <div className="relative overflow-hidden bg-gradient-to-r from-kaist-darkgreen to-kaist-lightgreen2 py-7 px-4 md:px-8">
          <div className="max-w-6xl mx-auto relative z-10">
            <h1 className="text-3xl font-extrabold tracking-tight text-kaist-white mb-2">
              {category} &gt; 글 작성하기
            </h1>
          </div>
          {/* 우측 KAIST 워터마크 로고 */}
          <div className="absolute -right-10 -top-10 opacity-20 pointer-events-none select-none">
            <span className="text-[150px] font-black text-kaist-white italic">KAIST</span>
          </div>
        </div>

        {/* 2. 글 작성 영역 */}
        <div className="max-w-6xl mx-auto px-4 py-8 md:px-8 space-y-6">
          <div className="grid gap-6">
            <div className="space-y-6">
              {/* 제목 영역 및 버튼 */}
              <div className="flex items-center justify-between border-b border-kaist-grey/30 pb-4">
                <input
                  type="text"
                  placeholder="제목"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="flex-1 text-2xl font-extrabold text-kaist-black bg-transparent focus:outline-none placeholder:text-kaist-grey"
                />
                <div className="flex gap-2 ml-4">
                  <button 
                    disabled={isSubmitting}
                    className="px-5 py-2 rounded-md bg-kaist-darkgreen/80 hover:bg-kaist-darkgreen text-white text-sm font-semibold transition-colors disabled:opacity-50"
                  >
                    임시저장
                  </button>
                  <button 
                    onClick={handleSubmit}
                    disabled={isSubmitting}
                    className="px-5 py-2 rounded-md bg-kaist-darkgreen text-white text-sm font-semibold transition-colors disabled:opacity-50"
                  >
                    게시
                  </button>
                </div>
              </div>

              {/* 에디터 영역 */}
              <div className="border border-kaist-grey/30 rounded-xl bg-white overflow-hidden shadow-sm">
                {/* 툴바 (아이콘) */}
                <div className="flex flex-wrap items-center gap-3 px-4 py-3 border-b border-kaist-grey/30 bg-gray-50/50">
                  <div className="flex items-center gap-2 rounded-full border border-kaist-grey/30 bg-white px-2 py-1">
                    <button className="p-1.5 text-kaist-darkgreen hover:bg-kaist-darkgreen/10 rounded-md transition-colors">
                      <Image className="w-5 h-5" />
                    </button>
                    <button className="p-1.5 text-kaist-darkgreen hover:bg-kaist-darkgreen/10 rounded-md transition-colors">
                      <FileText className="w-5 h-5" />
                    </button>
                  </div>
                  <div className="flex items-center gap-2 rounded-full border border-kaist-grey/30 bg-white px-2 py-1">
                    <button className="p-1.5 text-kaist-darkgreen hover:bg-kaist-darkgreen/10 rounded-md transition-colors">
                      <Video className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                {/* 입력 창 */}
                <div className="p-6 space-y-4">
                  <input
                    type="text"
                    placeholder="소제목을 입력하세요"
                    value={subtitle}
                    onChange={(e) => setSubtitle(e.target.value)}
                    className="w-full text-lg font-bold text-kaist-black bg-transparent focus:outline-none placeholder:text-kaist-grey/60"
                  />
                  <textarea
                    placeholder="내용을 입력하세요"
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    className="w-full min-h-[300px] text-base text-kaist-black bg-transparent focus:outline-none resize-y placeholder:text-kaist-grey/50"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* 3. 하단 설정 영역 (카테고리/작성자) */}
          <div className="bg-white rounded-xl border border-kaist-grey/30 px-6 py-4 space-y-4 shadow-sm text-sm">

            <div className="flex items-center py-2 border-b border-kaist-grey/10">
              <span className="w-24 font-bold text-kaist-black">분류</span>
              <div className="flex-1 text-kaist-black font-semibold">
                {category}
              </div>
            </div>

            {/* 작성자 선택 */}
            <div className="flex items-center py-2">
              <span className="w-24 font-bold text-kaist-black">작성자</span>
              <div className="flex flex-wrap gap-4 flex-1">
                <label className="flex items-center gap-2 cursor-pointer group">
                  <div className={`w-4 h-4 rounded-[4px] border flex items-center justify-center transition-colors ${isAnonymous ? 'bg-kaist-darkgreen border-kaist-darkgreen' : 'border-kaist-grey/40 group-hover:border-kaist-darkgreen'}`}>
                    {isAnonymous && (
                      <div className="w-2 h-2 rounded-sm bg-kaist-white" />
                    )}
                  </div>
                  <input
                    type="checkbox"
                    className="hidden"
                    checked={isAnonymous}
                    onChange={(e) => setIsAnonymous(e.target.checked)}
                  />
                  <span className="text-kaist-black">익명으로 작성</span>
                </label>
              </div>
            </div>

          </div>

        </div>
      </main>
    </div>
  );
}