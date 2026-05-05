import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { createApiClient } from "@soc/api-client";
import type {
  ResponseDetailResponse,
  SurveyDetailResponse,
} from "@soc/contracts";
import { formatKoreanDateTime } from "@soc/shared";
import { Header } from "@/components/organisms/header";
import { Button } from "@/components/ui/button";
import { resolveApiBaseUrl } from "@/lib/api";
import { getAuthSessionSummary } from "@/lib/auth-session";
import { hasPersistedProfile } from "@/lib/require-persisted-profile";

type ReviewStatus = "approved" | "rejected" | "waitlisted";

const STATUS_LABEL: Record<string, string> = {
  draft: "임시",
  submitted: "제출됨",
  approved: "승인",
  rejected: "반려",
  waitlisted: "대기",
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

  const client = createApiClient({ baseUrl: resolveApiBaseUrl() });

  const [response, setResponse] = useState<ResponseDetailResponse | null>(null);
  const [survey, setSurvey] = useState<SurveyDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [reviewStatus, setReviewStatus] = useState<ReviewStatus>("approved");
  const [reviewReason, setReviewReason] = useState("");
  const [reviewing, setReviewing] = useState(false);

  useEffect(() => {
    if (!surveyId || !responseId) return;
    (async () => {
      const session = await getAuthSessionSummary(client);
      if (!hasPersistedProfile(session)) {
        navigate("/login");
        return;
      }
      try {
        const [detail, surveyDetail] = await Promise.all([
          client.getResponseDetail(surveyId, responseId),
          client.getSurveyDetail(surveyId),
        ]);
        setResponse(detail);
        setSurvey(surveyDetail);
      } catch {
        setError("데이터를 불러오지 못했습니다.");
      } finally {
        setLoading(false);
      }
    })();
  }, [surveyId, responseId]);

  const handleReview = async () => {
    if (!surveyId || !responseId) return;
    setReviewing(true);
    try {
      const updated = await client.reviewResponse(surveyId, responseId, {
        status: reviewStatus,
        reason: reviewReason.trim() || undefined,
      });
      setResponse((prev) => (prev ? { ...prev, ...updated } : prev));
      alert("검토가 완료되었습니다.");
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
    "w-full rounded border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400";

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header />
      <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-8">
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => navigate(`/admin/surveys/${surveyId}/responses`)}
            className="text-sm text-gray-400 hover:text-gray-600"
          >
            ← 응답 목록
          </button>
          <h1 className="text-xl font-bold text-gray-900">응답 상세</h1>
        </div>

        {loading && <p className="text-gray-500">불러오는 중…</p>}
        {error && <p className="text-red-500">{error}</p>}

        {response && (
          <div className="space-y-6">
            {/* 응답 메타 */}
            <div className="bg-white rounded-xl border border-gray-200 p-5 text-sm space-y-2">
              <div className="flex gap-4">
                <span className="text-gray-500">제출자</span>
                <span className="font-mono">
                  {response.userId ?? response.externalPhone ?? "—"}
                </span>
              </div>
              <div className="flex gap-4">
                <span className="text-gray-500">제출 시각</span>
                <span>
                  {response.submittedAt
                    ? formatKoreanDateTime(response.submittedAt)
                    : "—"}
                </span>
              </div>
              <div className="flex gap-4">
                <span className="text-gray-500">상태</span>
                <span className="font-medium">
                  {STATUS_LABEL[response.status] ?? response.status}
                </span>
              </div>
              {response.reviewedAt && (
                <div className="flex gap-4">
                  <span className="text-gray-500">검토 시각</span>
                  <span>{formatKoreanDateTime(response.reviewedAt)}</span>
                </div>
              )}
              {response.reviewReason && (
                <div className="flex gap-4">
                  <span className="text-gray-500">검토 사유</span>
                  <span>{response.reviewReason}</span>
                </div>
              )}
            </div>

            {/* 답변 목록 */}
            <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
              <h2 className="font-semibold text-gray-800">답변</h2>
              {response.answers.length === 0 && (
                <p className="text-gray-400 text-sm">답변이 없습니다.</p>
              )}
              {response.answers.map((a) => (
                <div key={a.id} className="space-y-1">
                  <p className="text-xs font-medium text-gray-500">
                    {findQuestionTitle(a.questionId)}
                  </p>
                  <p className="text-sm text-gray-800 bg-gray-50 rounded px-3 py-2">
                    {renderAnswerContent(a.content)}
                  </p>
                  <p className="text-xs text-gray-400">
                    제출: {formatKoreanDateTime(a.submittedAt)}
                  </p>
                </div>
              ))}
            </div>

            {/* 검토 패널 */}
            <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
              <h2 className="font-semibold text-gray-800">검토</h2>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">
                  결과
                </label>
                <select
                  className={inputCls}
                  value={reviewStatus}
                  onChange={(e) =>
                    setReviewStatus(e.target.value as ReviewStatus)
                  }
                >
                  {REVIEW_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">
                  사유 (선택)
                </label>
                <textarea
                  className={`${inputCls} min-h-[80px] resize-y`}
                  value={reviewReason}
                  onChange={(e) => setReviewReason(e.target.value)}
                  placeholder="승인/반려 사유를 입력하세요"
                />
              </div>
              <div className="flex justify-end">
                <Button onClick={handleReview} disabled={reviewing}>
                  {reviewing ? "처리 중…" : "검토 완료"}
                </Button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
