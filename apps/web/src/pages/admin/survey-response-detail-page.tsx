import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { createApiClient } from "@soc/api-client";
import type {
  ResponseDetailResponse,
  SurveyDetailResponse,
} from "@soc/contracts";
import { formatKoreanDateTime } from "@soc/shared";
import { resolveApiBaseUrl } from "@/lib/api-base-url";
import { AuthGuard } from "@/components/guards/auth-guard";
import { useCurrentSession } from "@/hooks/use-current-session";
import { hasSurveyManagePermission, Permissions } from "@/lib/permissions";
import { maskUuid } from "@/lib/utils";
import { ChevronLeft, User, Calendar, Award, ClipboardCheck, Edit3, Loader2 } from "lucide-react";

type ReviewStatus = "approved" | "rejected" | "waitlisted";

const STATUS_BADGE: Record<string, React.ReactNode> = {
  draft: (
    <span className="inline-flex items-center rounded-full bg-slate-50 px-3 py-1 text-xs font-bold text-slate-600 border border-slate-200">
      임시저장
    </span>
  ),
  submitted: (
    <span className="inline-flex items-center rounded-full bg-gray-50 px-3 py-1 text-xs font-bold text-gray-700 border border-gray-200">
      제출됨
    </span>
  ),
  approved: (
    <span className="inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700 border border-emerald-200">
      승인
    </span>
  ),
  rejected: (
    <span className="inline-flex items-center rounded-full bg-rose-50 px-3 py-1 text-xs font-bold text-rose-700 border border-rose-200">
      반려
    </span>
  ),
  waitlisted: (
    <span className="inline-flex items-center rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700 border border-amber-200">
      대기
    </span>
  ),
};

const REVIEW_OPTIONS: { value: ReviewStatus; label: string }[] = [
  { value: "approved", label: "승인" },
  { value: "rejected", label: "반려" },
  { value: "waitlisted", label: "대기" },
];

function renderAnswerContent(content: Record<string, unknown>): string {
  if ("text" in content) return String(content.text);
  if ("value" in content) return String(content.value);
  if ("values" in content && Array.isArray(content.values))
    return content.values.join(", ");
  if ("date" in content) return String(content.date);
  if ("time" in content) return String(content.time);
  if ("datetime" in content) {
    try {
      return formatKoreanDateTime(content.datetime as string);
    } catch {
      return String(content.datetime);
    }
  }
  return JSON.stringify(content);
}

export function SurveyResponseDetailPage() {
  const navigate = useNavigate();
  const { id: surveyId, responseId } = useParams<{
    id: string;
    responseId: string;
  }>();

  const client = useMemo(
    () => createApiClient({ baseUrl: resolveApiBaseUrl() }),
    [],
  );

  const [response, setResponse] = useState<ResponseDetailResponse | null>(null);
  const [survey, setSurvey] = useState<SurveyDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [reviewStatus, setReviewStatus] = useState<ReviewStatus>("approved");
  const [reviewReason, setReviewReason] = useState("");
  const [reviewing, setReviewing] = useState(false);
  const { data: session, isLoading: sessionLoading } = useCurrentSession();

  useEffect(() => {
    if (!surveyId || !responseId) return;
    (async () => {
      if (sessionLoading || !hasSurveyManagePermission(session?.permission)) {
        return;
      }
      try {
        const [detail, surveyDetail] = await Promise.all([
          client.getResponseDetail(surveyId, responseId),
          client.getSurveyDetail(surveyId),
        ]);
        setResponse(detail);
        setSurvey(surveyDetail);
        if (detail && detail.status !== "draft" && detail.status !== "submitted") {
          setReviewStatus(detail.status as ReviewStatus);
        }
        if (detail?.reviewReason) {
          setReviewReason(detail.reviewReason);
        }
      } catch {
        setError("데이터를 불러오지 못했습니다.");
      } finally {
        setLoading(false);
      }
    })();
  }, [surveyId, responseId, client, session, sessionLoading]);

  const handleReview = async () => {
    if (!surveyId || !responseId) return;
    if (reviewStatus === "rejected" && !reviewReason.trim()) {
      alert("반려 사유를 입력해 주세요.");
      return;
    }
    setReviewing(true);
    try {
      const updated = await client.reviewResponse(surveyId, responseId, {
        status: reviewStatus,
        reason: reviewReason.trim() || undefined,
      });
      setResponse((prev) => (prev ? { ...prev, ...updated } : prev));
      alert("검토 처리가 저장되었습니다.");
    } catch {
      alert("검토 처리에 실패했습니다.");
    } finally {
      setReviewing(false);
    }
  };

  // 질문 ID로 제목 찾기
  const findQuestionTitle = (questionId: string): string => {
    if (!survey) return questionId;
    for (const section of survey.sections) {
      const q = section.questions.find((q) => q.id === questionId);
      if (q) return `[${section.titleKo}] ${q.titleKo}`;
    }
    return questionId;
  };

  const inputCls =
    "w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-kaist-darkgreen transition-all placeholder:text-kaist-grey/40 text-kaist-black font-medium hover:border-gray-300";

  return (
    <AuthGuard requirePermission={Permissions.MANAGE_SURVEY}>
      <div className="min-h-screen bg-slate-50/50 text-kaist-black pb-20">
        <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-8 md:px-8">
          
          {/* Compact Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-gray-200 pb-5 gap-4">
            <div>
              <button
                onClick={() => navigate(`/admin/surveys/${surveyId}/responses`)}
                className="text-xs font-semibold text-kaist-grey hover:text-kaist-darkgreen transition-colors mb-2 inline-flex items-center gap-1 bg-transparent border-0 cursor-pointer"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                응답 목록으로 돌아가기
              </button>
              <h1 className="text-2xl font-bold tracking-tight text-gray-900">설문 응답 상세 검토</h1>
              <p className="mt-1 text-sm text-gray-500">
                제출자의 답변을 상세히 확인하고 승인/반려/대기 심사를 수행합니다.
              </p>
            </div>
          </div>

          {loading && (
            <div className="flex flex-col items-center justify-center py-20 gap-3 bg-white rounded-2xl border border-gray-200 shadow-xs">
              <Loader2 className="w-10 h-10 text-kaist-darkgreen animate-spin" />
              <p className="text-sm font-semibold text-kaist-grey">데이터를 불러오는 중입니다...</p>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-6 py-4 rounded-xl text-sm font-medium">
              {error}
            </div>
          )}

          {response && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
              
              {/* Left Column - User Details and Answers */}
              <div className={`${survey?.kind === "APPLICATION" ? "lg:col-span-2" : "lg:col-span-3"} space-y-6`}>
                
                {/* 응답 메타 정보 카드 */}
                <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-xs space-y-4">
                  <h2 className="text-base font-bold text-kaist-black flex items-center gap-2 border-b border-gray-100 pb-2">
                    <User className="w-5 h-5 text-kaist-darkgreen" />
                    응답자 및 제출 정보
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm font-medium">
                    <div className="flex items-center gap-4 bg-gray-50/70 px-4 py-3 rounded-xl">
                      <span className="text-kaist-grey text-xs uppercase tracking-wider w-20 flex-shrink-0">제출자</span>
                      <span className="font-mono text-kaist-black">{response.userId ? maskUuid(response.userId) : (response.externalPhone ?? "—")}</span>
                    </div>
                    <div className="flex items-center gap-4 bg-gray-50/70 px-4 py-3 rounded-xl">
                      <span className="text-kaist-grey text-xs uppercase tracking-wider w-20 flex-shrink-0">제출 시각</span>
                      <span className="text-kaist-black">
                        {response.submittedAt ? formatKoreanDateTime(response.submittedAt) : "—"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 답변 상세 목록 */}
                <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-xs space-y-6">
                  <h2 className="text-base font-bold text-kaist-black flex items-center gap-2 border-b border-gray-100 pb-2">
                    <ClipboardCheck className="w-5 h-5 text-kaist-darkgreen" />
                    작성된 답변 목록
                  </h2>
                  {response.answers.length === 0 && (
                    <p className="text-kaist-grey/50 text-sm text-center py-10 font-bold">작성된 답변이 존재하지 않습니다.</p>
                  )}
                  <div className="space-y-6">
                    {response.answers.map((a, idx) => (
                      <div key={a.id} className="space-y-2 border-b border-gray-100 pb-6 last:border-0 last:pb-0">
                        <div className="flex items-start gap-2">
                          <span className="inline-flex items-center justify-center bg-kaist-darkgreen/10 text-kaist-darkgreen text-xs font-bold rounded-lg w-5 h-5 flex-shrink-0 mt-0.5">
                            {idx + 1}
                          </span>
                          <p className="text-sm font-bold text-kaist-black">
                            {findQuestionTitle(a.questionId)}
                          </p>
                        </div>
                        <div className="bg-gray-50/70 rounded-xl px-4 py-3 text-sm font-semibold text-kaist-black whitespace-pre-wrap">
                          {renderAnswerContent(a.content)}
                        </div>
                        <p className="text-[10px] text-kaist-grey/60 font-medium">
                          답변 저장일시: {formatKoreanDateTime(a.submittedAt)}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

              </div>

              {/* Right Column - Sticky Moderation Panel */}
              {survey?.kind === "APPLICATION" && (
                <div className="lg:col-span-1 lg:sticky lg:top-6 space-y-6">
                  
                  {/* Moderation Status Banner */}
                  <div className={`rounded-2xl border p-4 font-bold text-sm shadow-xs ${
                    response.status === 'approved' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' :
                    response.status === 'rejected' ? 'bg-rose-50 border-rose-200 text-rose-800' :
                    response.status === 'waitlisted' ? 'bg-amber-50 border-amber-200 text-amber-800' :
                    'bg-gray-50 border-gray-200 text-gray-800'
                  }`}>
                    <span className="block text-xs font-semibold uppercase tracking-wider opacity-75 mb-1">현재 검토 상태</span>
                    <div className="flex items-center justify-between">
                      <span className="text-base font-extrabold">
                        {response.status === 'approved' ? '승인 완료' :
                         response.status === 'rejected' ? '반려 처리됨' :
                         response.status === 'waitlisted' ? '대기 목록 등록됨' :
                         '검토 대기 중'}
                      </span>
                      {STATUS_BADGE[response.status]}
                    </div>
                    {response.status === 'rejected' && response.reviewReason && (
                      <div className="mt-3 border-t border-rose-200/50 pt-2 font-medium text-xs text-rose-700 whitespace-pre-wrap">
                        <strong className="block text-rose-900 mb-0.5">반려 사유:</strong>
                        {response.reviewReason}
                      </div>
                    )}
                  </div>

                  {/* 검토 및 관리자 처분 패널 */}
                  <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-xs space-y-4">
                    <h2 className="text-base font-bold text-gray-900 border-b border-gray-100 pb-2">
                      심사 처분 선택
                    </h2>
                    <div className="flex flex-col gap-2">
                      {([
                        { value: "approved", label: "승인", colorClass: "border-emerald-600 bg-emerald-50/50 text-emerald-700", defaultClass: "border-gray-200 hover:bg-gray-50" },
                        { value: "rejected", label: "반려", colorClass: "border-rose-600 bg-rose-50/50 text-rose-700", defaultClass: "border-gray-200 hover:bg-gray-50" },
                        { value: "waitlisted", label: "대기", colorClass: "border-amber-600 bg-amber-50/50 text-amber-700", defaultClass: "border-gray-200 hover:bg-gray-50" }
                      ] as const).map((opt) => {
                        const isSelected = reviewStatus === opt.value;
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => setReviewStatus(opt.value)}
                            className={`w-full px-4 py-3 rounded-xl border text-left text-sm font-bold transition flex items-center justify-between cursor-pointer ${
                              isSelected ? opt.colorClass : opt.defaultClass
                            }`}
                          >
                            <span>{opt.label}</span>
                            {isSelected && <span className="w-2.5 h-2.5 rounded-full bg-current" />}
                          </button>
                        );
                      })}
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block">
                        처분 사유 {reviewStatus === "rejected" && <span className="text-rose-500 font-extrabold">*필수</span>}
                      </label>
                      <textarea
                        className={`${inputCls} min-h-[100px] text-xs`}
                        value={reviewReason}
                        onChange={(e) => setReviewReason(e.target.value)}
                        placeholder={
                          reviewStatus === "rejected"
                            ? "반려 처리 사유를 상세하게 작성해야 합니다."
                            : "검토 사유 또는 비고를 입력하세요 (선택사항)"
                        }
                      />
                    </div>

                    <button
                      onClick={handleReview}
                      disabled={reviewing}
                      className="w-full py-2.5 bg-kaist-darkgreen hover:bg-kaist-darkgreen/90 text-white font-bold text-sm rounded-xl disabled:opacity-50 transition-all flex items-center justify-center gap-1.5 cursor-pointer border-0 shadow-md shadow-kaist-darkgreen/15"
                    >
                      {reviewing ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          저장 중...
                        </>
                      ) : (
                        <>
                          <Edit3 className="w-4 h-4" />
                          심사 처분 저장
                        </>
                      )}
                    </button>
                  </div>

                </div>
              )}

            </div>
          )}
        </main>
      </div>
    </AuthGuard>
  );
}
