import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { createApiClient } from "@soc/api-client";
import type { SurveyResponseRecord } from "@soc/contracts";
import { formatKoreanDateTime } from "@soc/shared";
import { resolveApiBaseUrl } from "@/lib/api-base-url";
import { AuthGuard } from "@/components/guards/auth-guard";
import { useCurrentSession } from "@/hooks/use-current-session";
import { hasSurveyManagePermission, Permissions } from "@/lib/permissions";
import { ClipboardList, ChevronLeft, Eye, Loader2 } from "lucide-react";
import { maskUuid } from "@/lib/utils";

const STATUS_BADGE: Record<string, React.ReactNode> = {
  draft: (
    <span className="inline-flex items-center rounded-full bg-slate-50 px-2.5 py-1 text-xs font-bold text-slate-600 border border-slate-200">
      임시저장
    </span>
  ),
  submitted: (
    <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-1 text-xs font-bold text-gray-700 border border-gray-200">
      제출됨
    </span>
  ),
  approved: (
    <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700 border border-emerald-200">
      승인
    </span>
  ),
  rejected: (
    <span className="inline-flex items-center rounded-full bg-rose-50 px-2.5 py-1 text-xs font-bold text-rose-700 border border-rose-200">
      반려
    </span>
  ),
  waitlisted: (
    <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-700 border border-amber-200">
      대기
    </span>
  ),
};

export function SurveyResponseListPage() {
  const navigate = useNavigate();
  const { id: surveyId } = useParams<{ id: string }>();
  const [responses, setResponses] = useState<SurveyResponseRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const client = useMemo(
    () => createApiClient({ baseUrl: resolveApiBaseUrl() }),
    [],
  );
  const { data: session, isLoading: sessionLoading } = useCurrentSession();
  const [exporting, setExporting] = useState(false);

  const handleExportCSV = async () => {
    if (!surveyId) return;
    setExporting(true);
    try {
      const survey = await client.getSurveyDetail(surveyId);
      const allQuestions = survey.sections.flatMap((s) => s.questions);
      const data = await client.listResponsesWithAnswers(surveyId);

      const csvCell = (val: any) => {
        if (val === null || val === undefined) return '""';
        const str = String(val);
        return `"${str.replace(/"/g, '""')}"`;
      };

      const headers = [
        "응답 ID",
        "제출자",
        "제출 시각",
        "상태",
        "검토 시각",
        "반려 사유",
        ...allQuestions.map((q) => q.titleKo),
      ];

      const rows = data.map((r) => {
        const answerCols = allQuestions.map((q) => {
          const ans = r.answers.find((a) => a.questionId === q.id);
          if (!ans || !ans.content) return "";
          const content = ans.content as Record<string, any>;
          if (q.questionType === "multiple_choice") {
            return (content.values as string[])?.join(" | ") || "";
          }
          if ("text" in content) return String(content.text);
          if ("value" in content) return String(content.value);
          if ("date" in content) return String(content.date);
          if ("time" in content) return String(content.time);
          if ("datetime" in content) return String(content.datetime);
          return JSON.stringify(content);
        });

        return [
          r.id,
          r.userId ?? r.externalPhone ?? "—",
          r.submittedAt ? formatKoreanDateTime(r.submittedAt) : "—",
          r.status,
          r.reviewedAt ? formatKoreanDateTime(r.reviewedAt) : "—",
          r.reviewReason ?? "",
          ...answerCols,
        ];
      });

      const csvContent = [
        headers.map(csvCell).join(","),
        ...rows.map((row) => row.map(csvCell).join(",")),
      ].join("\n");

      const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `survey_responses_${surveyId}.csv`);
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error(err);
      alert("CSV 내보내기에 실패했습니다.");
    } finally {
      setExporting(false);
    }
  };

  useEffect(() => {
    if (!surveyId) return;
    (async () => {
      if (sessionLoading || !hasSurveyManagePermission(session?.permission)) {
        return;
      }
      try {
        const data = await client.listResponses(surveyId);
        setResponses(data);
      } catch {
        setError("응답 목록을 불러오지 못했습니다.");
      } finally {
        setLoading(false);
      }
    })();
  }, [surveyId, client, session, sessionLoading]);

  return (
    <AuthGuard requirePermission={Permissions.MANAGE_SURVEY}>
      <div className="min-h-screen bg-slate-50/50 text-kaist-black pb-20">
        <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 md:px-8">
          
          {/* Compact Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-gray-200 pb-5 gap-4">
            <div>
              <button
                onClick={() => navigate("/admin/surveys")}
                className="text-xs font-semibold text-kaist-grey hover:text-kaist-darkgreen transition-colors mb-2 inline-flex items-center gap-1 bg-transparent border-0 cursor-pointer"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                설문 목록으로 돌아가기
              </button>
              <h1 className="text-2xl font-bold tracking-tight text-gray-900">설문 응답 목록</h1>
              <p className="mt-1 text-sm text-gray-500">
                제출된 개별 설문 응답 건들을 확인하고 승인/반려 처리를 진행합니다.
              </p>
            </div>
            <button
              onClick={handleExportCSV}
              disabled={exporting}
              className="px-4 py-2.5 bg-kaist-darkgreen hover:bg-kaist-darkgreen/90 text-white font-bold text-sm rounded-xl transition-all shadow-md shadow-kaist-darkgreen/15 cursor-pointer border-0 flex items-center gap-1.5 disabled:opacity-50"
            >
              {exporting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  내보내는 중...
                </>
              ) : (
                "CSV 내보내기"
              )}
            </button>
          </div>

          {/* Response List Card */}
          <div className="rounded-2xl border border-gray-200 bg-white shadow-xs p-6">
            <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
              <div>
                <h2 className="text-lg font-bold text-kaist-black flex items-center gap-2">
                  <ClipboardList className="w-5 h-5 text-kaist-darkgreen" />
                  응답 내역
                </h2>
                <p className="text-xs text-kaist-grey mt-1">총 {responses.length}개의 제출 건이 존재합니다.</p>
              </div>
            </div>

            {loading && (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <Loader2 className="w-10 h-10 text-kaist-darkgreen animate-spin" />
                <p className="text-sm font-semibold text-kaist-grey">응답 목록을 불러오는 중입니다...</p>
              </div>
            )}

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-6 py-4 rounded-2xl text-sm font-medium mb-6 animate-in fade-in slide-in-from-top-2 duration-300">
                {error}
              </div>
            )}

            {!loading && !error && responses.length === 0 && (
              <div className="text-center py-20 text-kaist-grey font-medium border border-dashed border-kaist-darkgreen/10 rounded-2xl bg-gray-50">
                제출된 설문 응답이 없습니다.
              </div>
            )}

            {!loading && responses.length > 0 && (
              <div className="overflow-hidden rounded-2xl border border-kaist-darkgreen/10 bg-white">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm divide-y divide-kaist-darkgreen/10 border-collapse">
                    <thead className="bg-kaist-darkgreen/5 text-kaist-grey uppercase tracking-[0.16em]">
                      <tr>
                        <th className="px-5 py-4 text-left text-xs font-bold">제출자</th>
                        <th className="px-5 py-4 text-left text-xs font-bold">제출 시각</th>
                        <th className="px-5 py-4 text-left text-xs font-bold">상태</th>
                        <th className="px-5 py-4 text-left text-xs font-bold">검토 시각</th>
                        <th className="px-5 py-4 text-center text-xs font-bold w-32">검토</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-kaist-darkgreen/10 font-medium">
                      {responses.map((r) => (
                        <tr key={r.id} className="hover:bg-kaist-darkgreen/3 transition-colors">
                          <td className="px-5 py-4 text-kaist-black font-bold text-xs truncate max-w-[200px]" title={r.userId ?? r.externalPhone ?? ""}>
                            {r.userId ? maskUuid(r.userId) : r.externalPhone ?? "—"}
                          </td>
                          <td className="px-5 py-4 text-kaist-grey/85 text-xs">
                            {r.submittedAt ? formatKoreanDateTime(r.submittedAt) : "—"}
                          </td>
                          <td className="px-5 py-4">
                            {STATUS_BADGE[r.status] ?? (
                              <span className="inline-flex items-center rounded-full bg-gray-50 px-2.5 py-1 text-xs font-bold text-gray-600 border border-gray-200">
                                {r.status}
                              </span>
                            )}
                          </td>
                          <td className="px-5 py-4 text-kaist-grey/85 text-xs">
                            {r.reviewedAt ? formatKoreanDateTime(r.reviewedAt) : "—"}
                          </td>
                          <td className="px-5 py-4 text-center">
                            <button
                              onClick={() => navigate(`/admin/surveys/${surveyId}/responses/${r.id}`)}
                              title="응답 상세 확인 및 검토"
                              className="border border-kaist-darkgreen/30 text-kaist-darkgreen hover:bg-kaist-darkgreen/5 font-extrabold px-3 py-1.5 rounded-xl transition-all cursor-pointer inline-flex items-center gap-1 text-xs"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              상세 검토
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </AuthGuard>
  );
}
