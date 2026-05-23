import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { createApiClient } from "@soc/api-client";
import { resolveApiBaseUrl } from "@/lib/api-base-url";
import { useLanguage } from "@/hooks/use-language";
import { Header } from "@/components/organisms/header";
import { Footer } from "@/components/organisms/footer";
import { BarChart3, ChevronLeft, Users, AlertCircle, Lock } from "lucide-react";

export function SurveyResultsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { lang } = useLanguage();
  const apiClient = useMemo(() => createApiClient({ baseUrl: resolveApiBaseUrl() }), []);

  const [analytics, setAnalytics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    apiClient
      .getSurveyAnalytics(id)
      .then((data) => {
        setAnalytics(data);
      })
      .catch((err: any) => {
        if (err.status === 403) {
          setError("forbidden");
        } else {
          setError("failed");
        }
      })
      .finally(() => {
        setLoading(false);
      });
  }, [id, apiClient]);

  const renderContent = () => {
    if (loading) {
      return (
        <div className="bg-white border border-gray-200 rounded-3xl p-12 text-center text-kaist-grey/60 font-medium shadow-xl">
          {lang === "ko" ? "결과를 불러오는 중..." : "Loading results..."}
        </div>
      );
    }

    if (error === "forbidden") {
      return (
        <div className="bg-white rounded-3xl border border-kaist-grey/15 p-12 shadow-xl text-center flex flex-col items-center max-w-md mx-auto my-12 animate-in fade-in zoom-in-95 duration-300">
          <div className="w-16 h-16 rounded-2xl bg-rose-50 flex items-center justify-center text-rose-500 mb-6 border border-rose-100">
            <Lock className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold text-kaist-black mb-3">
            {lang === "ko" ? "결과 비공개 설문" : "Private Survey Results"}
          </h2>
          <p className="text-sm text-kaist-grey/80 leading-relaxed mb-6">
            {lang === "ko"
              ? "이 설문의 결과는 비공개로 설정되어 있습니다. 관리자 권한을 가진 사용자만 조회할 수 있습니다."
              : "This survey's results are private. Only administrators are allowed to view the analytics."}
          </p>
          <button
            onClick={() => navigate("/")}
            className="w-full py-3 bg-kaist-darkgreen hover:bg-kaist-darkgreen/90 text-white font-bold rounded-xl transition-all shadow-md shadow-kaist-darkgreen/15 text-center text-sm cursor-pointer border-0"
          >
            {lang === "ko" ? "홈으로 돌아가기" : "Back to Home"}
          </button>
        </div>
      );
    }

    if (error || !analytics) {
      return (
        <div className="bg-white border border-gray-200 rounded-3xl p-12 text-center text-red-500 font-bold shadow-xl flex flex-col items-center gap-3">
          <AlertCircle className="w-10 h-10" />
          <span>{lang === "ko" ? "결과 데이터를 조회하지 못했습니다." : "Failed to load survey results."}</span>
        </div>
      );
    }

    return (
      <div className="space-y-8">
        {/* Survey Summary Header */}
        <div className="bg-white border border-gray-200 rounded-3xl p-8 lg:p-12 shadow-xl">
          <div className="flex items-center gap-2 mb-4">
            <span className="bg-kaist-lightgreen/20 text-kaist-darkgreen text-xs font-bold px-3 py-1.5 rounded-lg border border-kaist-darkgreen/15 flex items-center gap-1">
              <BarChart3 className="w-3.5 h-3.5" />
              {lang === "ko" ? "통계 및 결과" : "Results & Analytics"}
            </span>
            <span className="bg-slate-100 text-slate-700 text-xs font-bold px-3 py-1.5 rounded-lg border border-slate-200 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5" />
              {lang === "ko"
                ? `총 응답 수: ${analytics.totalResponses}개`
                : `Total Responses: ${analytics.totalResponses}`}
            </span>
          </div>

          <h1 className="text-3xl font-black text-kaist-black tracking-tight leading-tight">
            {lang === "ko" ? analytics.titleKo : (analytics.titleEn || analytics.titleKo)}
          </h1>
          <p className="mt-4 text-sm text-kaist-grey leading-relaxed border-t border-gray-100 pt-4">
            {lang === "ko"
              ? "응답자들이 제출한 누적 통계 데이터입니다. 주관식 답변은 개별 텍스트로 표시됩니다."
              : "This shows the accumulated statistical data of responses. Subjective questions are shown as text lists."}
          </p>
        </div>

        {/* Questions Analytics */}
        <div className="space-y-6">
          {analytics.questions.map((question: any, idx: number) => {
            const isChoice = !!question.choices;
            const title = lang === "ko" ? question.titleKo : (question.titleEn || question.titleKo);

            // Precompute slices for the SVG donut chart if choice question
            let slices: any[] = [];
            if (isChoice) {
              const COLORS = [
                "#073B24", // Dark Green
                "#10B981", // Emerald
                "#3B82F6", // Blue
                "#F59E0B", // Amber
                "#EC4899", // Pink
                "#8B5CF6", // Violet
                "#EF4444", // Red
                "#6B7280"  // Gray
              ];
              let tempAccum = 0;
              slices = question.choices.map((choice: any, cIdx: number) => {
                const percent = choice.percentage;
                const dashOffset = 100 - tempAccum + 25; // 25 unit shift to rotate start to 12 o'clock
                tempAccum += percent;
                return {
                  ...choice,
                  color: COLORS[cIdx % COLORS.length],
                  dashArray: `${percent} ${100 - percent}`,
                  dashOffset,
                  percent
                };
              });
            }

            return (
              <div key={question.questionId} className="bg-white border border-gray-200 rounded-3xl p-6 lg:p-8 shadow-md space-y-6">
                
                {/* Question Header with visual hierarchy */}
                <div className="border-b border-gray-100 pb-3.5 flex items-center justify-between gap-4">
                  <h3 className="text-base sm:text-lg font-extrabold text-gray-900 flex items-start gap-2 min-w-0">
                    <span className="text-kaist-darkgreen shrink-0 select-none">{idx + 1}.</span>
                    <span className="leading-snug break-all">{title}</span>
                  </h3>
                  <span className="text-xs font-bold text-kaist-grey bg-kaist-lightgreen/10 px-2.5 py-1.5 rounded-lg shrink-0">
                    {lang === "ko" ? `응답 ${question.totalAnswers}개` : `${question.totalAnswers} answers`}
                  </span>
                </div>

                {isChoice ? (
                  <div className="flex flex-col md:flex-row items-center justify-between gap-8 pt-2">
                    {/* SVG Donut Chart */}
                    <div className="flex-shrink-0 flex items-center justify-center bg-gray-50/50 p-5 rounded-2xl border border-gray-100">
                      <svg viewBox="0 0 42 42" className="w-48 h-48 flex-shrink-0">
                        <circle
                          cx="21"
                          cy="21"
                          r="15.91549430918954"
                          fill="transparent"
                          stroke="#f3f4f6"
                          strokeWidth="5"
                        />
                        {slices.map((slice: any) => (
                          <circle
                            key={slice.value}
                            cx="21"
                            cy="21"
                            r="15.91549430918954"
                            fill="transparent"
                            stroke={slice.color}
                            strokeWidth="5"
                            strokeDasharray={slice.dashArray}
                            strokeDashoffset={slice.dashOffset}
                            className="transition-all duration-500"
                          />
                        ))}
                        <text x="21" y="20.5" textAnchor="middle" className="font-extrabold fill-gray-800 text-[4px]">
                          {question.totalAnswers}
                        </text>
                        <text x="21" y="24.5" textAnchor="middle" className="font-bold fill-gray-400 text-[2.2px]">
                          {lang === "ko" ? "응답 수" : "Answers"}
                        </text>
                      </svg>
                    </div>

                    {/* Donut Legend */}
                    <div className="flex-1 w-full space-y-2.5">
                      {slices.map((slice: any) => {
                        const choiceLabel = lang === "ko" ? slice.labelKo : (slice.labelEn || slice.labelKo);
                        return (
                          <div key={slice.value} className="flex items-center justify-between text-xs sm:text-sm font-semibold text-gray-700 hover:bg-gray-50/50 px-3 py-2 rounded-xl transition-all">
                            <div className="flex items-center gap-2.5 min-w-0 pr-2">
                              <span
                                className="w-3 h-3 rounded-md flex-shrink-0 border border-black/5"
                                style={{ backgroundColor: slice.color }}
                              />
                              <span className="truncate text-gray-800 leading-none">{choiceLabel}</span>
                            </div>
                            <span className="text-gray-500 font-bold flex-shrink-0 shrink-0">
                              {slice.count}{lang === "ko" ? "명" : ""} ({slice.percent}%)
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  /* Open-ended text answers inside structured table */
                  <div className="border border-gray-100 rounded-2xl overflow-hidden shadow-xs">
                    <table className="w-full text-left border-collapse text-xs sm:text-sm">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-100">
                          <th className="py-2.5 px-4 font-bold text-gray-500 w-12 text-center">#</th>
                          <th className="py-2.5 px-4 font-bold text-gray-500">{lang === "ko" ? "답변 내용" : "Response Content"}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 bg-white font-medium text-gray-800">
                        {question.texts && question.texts.length > 0 ? (
                          question.texts.map((text: string, tIdx: number) => (
                            <tr key={tIdx} className="hover:bg-gray-50/30 transition-colors">
                              <td className="py-2.5 px-4 text-center font-bold text-gray-400">{tIdx + 1}</td>
                              <td className="py-2.5 px-4 whitespace-pre-wrap break-all leading-relaxed">
                                {text || (
                                  <span className="text-gray-300 italic">
                                    {lang === "ko" ? "(빈 응답)" : "(Empty response)"}
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={2} className="py-8 px-4 text-center text-gray-400 font-bold italic">
                              {lang === "ko" ? "제출된 답변이 없습니다." : "No responses submitted."}
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="flex min-h-screen flex-col bg-gray-50/50">
      <Header showLogo />
      <main className="flex-1 px-4 py-12 lg:px-0 bg-gradient-to-br from-kaist-lightgreen/5 via-white to-gray-50/50">
        <div className="mx-auto max-w-4xl">
          <div className="mb-4">
            <button
              onClick={() => navigate(-1)}
              className="text-xs font-semibold text-kaist-grey hover:text-kaist-darkgreen transition-colors inline-flex items-center gap-1 bg-transparent border-0 cursor-pointer"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              {lang === "ko" ? "이전 페이지로" : "Go Back"}
            </button>
          </div>
          {renderContent()}
        </div>
      </main>
      <Footer />
    </div>
  );
}
