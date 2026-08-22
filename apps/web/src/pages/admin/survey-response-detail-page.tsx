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
import { AdminPageShell } from "@/components/ui/admin-page";
import { Permissions } from "@/lib/permissions";
import { ChevronLeft, User, ClipboardCheck } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { AdminPageTitle } from "@/components/ui/page-layout";

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

  useEffect(() => {
    if (!surveyId || !responseId) return;
    (async () => {
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
  }, [surveyId, responseId, client]);

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
      <AdminPageShell>
        <main className="admin-page__main mx-auto flex w-full max-w-[1440px] flex-col gap-6 px-5 py-7 md:px-8 xl:px-10">
          
          {/* Compact Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-gray-200 pb-5 gap-4">
            <div>
              <Button variant="ghost"
                onClick={() => navigate(`/admin/surveys/${surveyId}/responses`)}
                className="text-xs font-semibold text-kaist-grey hover:text-kaist-darkgreen transition-colors mb-2 inline-flex items-center gap-1 bg-transparent border-0 cursor-pointer"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                응답 목록으로 돌아가기
              </Button>
              <AdminPageTitle>설문 응답 상세</AdminPageTitle>
            </div>
          </div>

          {loading && (
            <div className="space-y-6" aria-busy="true">
              <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-xs">
                <div className="border-b border-gray-100 pb-3">
                  <Skeleton className="h-5 w-44" />
                </div>
                <div className="mt-4 flex flex-wrap gap-x-6 gap-y-3">
                  {Array.from({ length: 4 }).map((_, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <Skeleton className="h-3 w-14" />
                      <Skeleton className="h-4 w-32" />
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-xs">
                <div className="border-b border-gray-100 pb-3">
                  <Skeleton className="h-5 w-36" />
                </div>
                <div className="mt-6 space-y-6">
                  {Array.from({ length: 4 }).map((_, index) => (
                    <div key={index} className="space-y-3 border-b border-gray-100 pb-6 last:border-0 last:pb-0">
                      <Skeleton className="h-5 w-2/3" />
                      <Skeleton className="h-16 w-full rounded-xl" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-6 py-4 rounded-xl text-sm font-medium">
              {error}
            </div>
          )}

          {response && (
            <div className="space-y-6">
              <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-xs space-y-4">
                <h2 className="text-base font-bold text-kaist-black flex items-center gap-2 border-b border-gray-100 pb-2">
                  <User className="w-5 h-5 text-kaist-darkgreen" />
                  응답자 및 제출 정보
                </h2>
                <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm font-medium text-kaist-black">
                  <div className="flex items-center gap-2">
                    <span className="text-kaist-grey text-xs uppercase tracking-wider">이름</span>
                    <span>{response.user?.nameKo ?? "—"}</span>
                  </div>
                  <span className="hidden md:inline text-kaist-grey/30">|</span>
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-kaist-grey text-xs uppercase tracking-wider">이메일</span>
                    <span className="break-all">{response.user?.email ?? "—"}</span>
                  </div>
                  <span className="hidden md:inline text-kaist-grey/30">|</span>
                  <div className="flex items-center gap-2">
                    <span className="text-kaist-grey text-xs uppercase tracking-wider">소속 / 학번</span>
                    <span>{response.user ? `${response.user.departmentKo ?? "—"}${response.user.stdNo ? ` / ${response.user.stdNo}` : ""}` : "—"}</span>
                  </div>
                  <span className="hidden md:inline text-kaist-grey/30">|</span>
                  <div className="flex items-center gap-2">
                    <span className="text-kaist-grey text-xs uppercase tracking-wider">제출 시각</span>
                    <span>{response.submittedAt ? formatKoreanDateTime(response.submittedAt) : "—"}</span>
                  </div>
                </div>
              </div>

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
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </main>
      </AdminPageShell>
    </AuthGuard>
  );
}
