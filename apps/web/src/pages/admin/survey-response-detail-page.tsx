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
import { AdminCard, AdminCardHeader, AdminPageHeader, AdminPageMain, AdminPageShell, AdminSectionTitle } from "@/components/ui/admin-page";
import { Permissions } from "@/lib/permissions";
import { ChevronLeft, User, ClipboardCheck } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { formatSurveyAnswer } from "@/lib/survey-answer-display";

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

  const findQuestion = (questionId: string) => {
    if (!survey) return null;
    for (const section of survey.sections) {
      const q = section.questions.find((q) => q.id === questionId);
      if (q) return { question: q, sectionTitle: section.titleKo };
    }
    return null;
  };

  return (
    <AuthGuard requirePermission={Permissions.MANAGE_SURVEY}>
      <AdminPageShell>
        <AdminPageMain>
          <AdminPageHeader
            title="설문 응답 상세"
            actions={
              <Button variant="outline"
                onClick={() => navigate(`/admin/surveys/${surveyId}/responses`)}
              >
                <ChevronLeft aria-hidden="true" /> 응답 목록
              </Button>
            }
          />

          {loading && (
            <div className="space-y-6" aria-busy="true">
              <AdminCard className="p-5">
                <div className="border-b border-slate-100 pb-3">
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
              </AdminCard>
              <AdminCard className="p-5">
                <div className="border-b border-slate-100 pb-3">
                  <Skeleton className="h-5 w-36" />
                </div>
                <div className="mt-6 space-y-6">
                  {Array.from({ length: 4 }).map((_, index) => (
                    <div key={index} className="space-y-3 border-b border-slate-100 pb-6 last:border-0 last:pb-0">
                      <Skeleton className="h-5 w-2/3" />
                      <Skeleton className="h-16 w-full rounded-xl" />
                    </div>
                  ))}
                </div>
              </AdminCard>
            </div>
          )}

          {error && (
            <div className="rounded-lg border border-rose-200 bg-white px-4 py-3 text-sm font-normal text-rose-700">
              {error}
            </div>
          )}

          {response && (
            <div className="space-y-6">
              <AdminCard>
                <AdminCardHeader><AdminSectionTitle className="flex items-center gap-2"><User className="size-4 text-brand-primary" />응답자 및 제출 정보</AdminSectionTitle></AdminCardHeader>
                <div className="flex flex-wrap items-center gap-x-6 gap-y-3 px-5 py-4 text-sm font-normal text-[#172033]">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-normal text-[#344054]">이름</span>
                    <span>{response.user?.nameKo ?? "—"}</span>
                  </div>
                  <span className="hidden text-slate-200 md:inline">|</span>
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs font-normal text-[#344054]">이메일</span>
                    <span className="break-all">{response.user?.email ?? "—"}</span>
                  </div>
                  <span className="hidden text-slate-200 md:inline">|</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-normal text-[#344054]">소속 / 학번</span>
                    <span>{response.user ? `${response.user.departmentKo ?? "—"}${response.user.stdNo ? ` / ${response.user.stdNo}` : ""}` : "—"}</span>
                  </div>
                  <span className="hidden text-slate-200 md:inline">|</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-normal text-[#344054]">제출 시각</span>
                    <span>{response.submittedAt ? formatKoreanDateTime(response.submittedAt) : "—"}</span>
                  </div>
                </div>
              </AdminCard>

              <AdminCard>
                <AdminCardHeader><AdminSectionTitle className="flex items-center gap-2"><ClipboardCheck className="size-4 text-brand-primary" />작성된 답변</AdminSectionTitle></AdminCardHeader>
                {response.answers.length === 0 && (
                  <p className="py-12 text-center text-sm font-normal text-[#344054]">작성된 답변이 없습니다.</p>
                )}
                <div className="divide-y divide-slate-100 px-5">
                  {response.answers.map((a, idx) => {
                    const match = findQuestion(a.questionId);
                    return (
                    <div key={a.id} className="space-y-2 py-5">
                      <div className="flex items-start gap-2">
                        <span className="mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-md bg-slate-100 text-xs font-normal text-[#344054]">
                          {idx + 1}
                        </span>
                        <p className="text-sm font-normal text-[#172033]">
                          {match ? `[${match.sectionTitle}] ${match.question.titleKo}` : a.questionId}
                        </p>
                      </div>
                      <div className="whitespace-pre-wrap rounded-lg border border-slate-100 bg-slate-50/70 px-4 py-3 text-sm font-normal text-[#172033]">
                        {match ? formatSurveyAnswer(a, match.question) || "—" : "—"}
                      </div>
                    </div>
                  );})}
                </div>
              </AdminCard>
            </div>
          )}
        </AdminPageMain>
      </AdminPageShell>
    </AuthGuard>
  );
}
