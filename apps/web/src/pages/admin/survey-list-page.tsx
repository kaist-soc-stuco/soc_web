import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createApiClient } from "@soc/api-client";
import type { SurveyRecord } from "@soc/contracts";
import { formatKoreanDateTime } from "@soc/shared";
import { resolveApiBaseUrl } from "@/lib/api";
import { AuthGuard } from "@/components/guards/auth-guard";
import { useCurrentSession } from "@/hooks/use-current-session";
import { hasSurveyManagePermission, Permissions } from "@/lib/permissions";
import { 
  Copy, 
  Edit2, 
  BarChart3, 
  Trash2, 
  Link2, 
  ExternalLink,
  Loader2 
} from "lucide-react";

function formatShortDate(dateIso: string | null) {
  if (!dateIso) return "";
  const d = new Date(dateIso);
  if (isNaN(d.getTime())) return "";
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function renderStatusBadge(s: SurveyRecord) {
  if (s.status === "draft") {
    return (
      <span className="inline-flex items-center rounded-full bg-slate-50 px-2.5 py-1 text-xs font-bold text-slate-600 border border-slate-200">
        임시저장
      </span>
    );
  }

  if (s.status === "closed") {
    return (
      <span className="inline-flex items-center rounded-full bg-rose-50 px-2.5 py-1 text-xs font-bold text-rose-700 border border-rose-200">
        마감
      </span>
    );
  }

  if (s.computedState === "before_open") {
    const startStr = formatShortDate(s.opensAt);
    const endStr = formatShortDate(s.closesAt);
    const dateRange = startStr && endStr ? ` [${startStr}-${endStr}]` : "";
    return (
      <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-700 border border-amber-200">
        개시 전{dateRange}
      </span>
    );
  }

  if (s.computedState === "open") {
    let dDayText = "";
    if (s.closesAt) {
      const now = new Date();
      const closeDate = new Date(s.closesAt);
      const d1 = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const d2 = new Date(closeDate.getFullYear(), closeDate.getMonth(), closeDate.getDate());
      const diffMs = d2.getTime() - d1.getTime();
      const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

      if (diffDays > 0) {
        dDayText = ` [D-${diffDays}]`;
      } else if (diffDays === 0) {
        dDayText = " [D-Day]";
      } else {
        dDayText = " [마감]";
      }
    }
    return (
      <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-extrabold text-emerald-700 border border-emerald-200">
        진행중{dDayText}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center rounded-full bg-rose-50 px-2.5 py-1 text-xs font-bold text-rose-700 border border-rose-200">
      마감
    </span>
  );
}

export function SurveyListPage() {
  const navigate = useNavigate();
  const [surveys, setSurveys] = useState<SurveyRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [duplicating, setDuplicating] = useState<string | null>(null);

  const client = useMemo(() => createApiClient({ baseUrl: resolveApiBaseUrl() }), []);
  const { data: session, isLoading: sessionLoading } = useCurrentSession();

  const fetchSurveys = async () => {
    try {
      const data = await client.listSurveys();
      setSurveys(data);
    } catch {
      setError("설문조사 목록을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (sessionLoading || !hasSurveyManagePermission(session?.permission)) {
      return;
    }
    fetchSurveys();
  }, [client, session, sessionLoading]);

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`"${title}" 설문조사를 삭제하시겠습니까?`)) return;
    setDeleting(id);
    try {
      await client.deleteSurvey(id);
      setSurveys((prev) => prev.filter((s) => s.id !== id));
    } catch {
      alert("삭제에 실패했습니다.");
    } finally {
      setDeleting(null);
    }
  };

  const handleDuplicate = async (id: string, title: string) => {
    if (!confirm(`"${title}" 설문조사를 복제하시겠습니까?`)) return;
    setDuplicating(id);
    try {
      await client.duplicateSurvey(id);
      await fetchSurveys();
      alert("설문조사가 성공적으로 복제되었습니다.");
    } catch (err) {
      console.error(err);
      alert("설문 복제에 실패했습니다.");
    } finally {
      setDuplicating(null);
    }
  };

  const copyLink = (id: string) => {
    const url = `${window.location.origin}/survey/${id}`;
    navigator.clipboard
      .writeText(url)
      .then(() => alert("설문 응답 링크가 복사되었습니다."));
  };

  return (
    <AuthGuard requirePermission={Permissions.MANAGE_SURVEY}>
      <div className="min-h-screen bg-slate-50/50 text-kaist-black">
        <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 md:px-8">
          
          {/* Compact Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-gray-200 pb-5 gap-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-gray-900">설문조사 관리</h1>
              <p className="mt-1 text-sm text-gray-500">
                학생회 행사 및 각종 안건 수렴을 위한 설문조사 개설/관리 도구입니다.
              </p>
            </div>
            <button
              onClick={() => navigate("/admin/surveys/new")}
              className="px-4 py-2 bg-kaist-darkgreen text-white font-bold text-sm rounded-lg hover:bg-kaist-darkgreen/90 transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
            >
              + 새 설문조사
            </button>
          </div>

          {/* Table Container Card */}
          <div className="rounded-2xl border border-gray-200 bg-white shadow-xs p-6">
            <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
              <div>
                <h2 className="text-lg font-bold text-kaist-black">설문 목록</h2>
                <p className="text-xs text-kaist-grey mt-1">총 {surveys.length}개의 설문조사가 등록되어 있습니다.</p>
              </div>
            </div>

            {loading && (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <Loader2 className="w-10 h-10 text-kaist-darkgreen animate-spin" />
                <p className="text-sm font-semibold text-kaist-grey">설문 목록을 불러오는 중입니다...</p>
              </div>
            )}
            
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-6 py-4 rounded-2xl text-sm font-medium mb-6">
                {error}
              </div>
            )}

            {!loading && !error && surveys.length === 0 && (
              <div className="text-center py-20 text-kaist-grey font-medium border border-dashed border-kaist-darkgreen/10 rounded-2xl bg-gray-50">
                등록된 설문조사가 없습니다.
              </div>
            )}

            {!loading && surveys.length > 0 && (
              <div className="overflow-hidden rounded-2xl border border-kaist-darkgreen/10 bg-white">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm divide-y divide-kaist-darkgreen/10 border-collapse">
                    <thead className="bg-kaist-darkgreen/5 text-kaist-grey uppercase tracking-[0.16em]">
                      <tr>
                        <th className="px-5 py-4 text-left text-xs font-bold">제목</th>
                        <th className="px-5 py-4 text-left text-xs font-bold">상태</th>
                        <th className="px-5 py-4 text-left text-xs font-bold">시작 일시</th>
                        <th className="px-5 py-4 text-left text-xs font-bold">마감 일시</th>
                        <th className="px-5 py-4 text-center text-xs font-bold w-48">작업</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-kaist-darkgreen/10 font-medium">
                      {surveys.map((s) => (
                        <tr key={s.id} className="hover:bg-kaist-darkgreen/3 transition-colors">
                          <td className="px-5 py-4 text-kaist-black font-bold">
                            {s.titleKo}
                          </td>
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {renderStatusBadge(s)}
                              {s.computedState === "open" && (
                                <span className="inline-flex items-center rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-bold text-indigo-700 border border-indigo-200">
                                  {s.responseCount ?? 0}명 응답
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-5 py-4 text-kaist-grey/85 text-xs">
                            {s.opensAt ? formatKoreanDateTime(s.opensAt) : "—"}
                          </td>
                          <td className="px-5 py-4 text-kaist-grey/85 text-xs">
                            {s.closesAt ? formatKoreanDateTime(s.closesAt) : "—"}
                          </td>
                          <td className="px-5 py-4">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => navigate(`/admin/surveys/${s.id}/edit`)}
                                title="편집"
                                className="p-2 hover:bg-kaist-darkgreen/10 text-kaist-darkgreen rounded-lg transition-colors cursor-pointer"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              
                              <button
                                onClick={() => navigate(`/admin/surveys/${s.id}/responses`)}
                                title="응답 결과 확인"
                                className="p-2 hover:bg-emerald-600/10 text-emerald-700 rounded-lg transition-colors cursor-pointer"
                              >
                                <BarChart3 className="w-4 h-4" />
                              </button>
                              
                              <button
                                onClick={() => handleDuplicate(s.id, s.titleKo)}
                                disabled={duplicating === s.id}
                                title="설문 복제"
                                className="p-2 hover:bg-amber-500/10 text-amber-600 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                              >
                                <Copy className="w-4 h-4" />
                              </button>

                              <button
                                onClick={() => copyLink(s.id)}
                                title="설문 링크 복사"
                                className="p-2 hover:bg-slate-500/10 text-slate-600 rounded-lg transition-colors cursor-pointer"
                              >
                                <Link2 className="w-4 h-4" />
                              </button>

                              <button
                                onClick={() => handleDelete(s.id, s.titleKo)}
                                disabled={deleting === s.id}
                                title="설문 삭제"
                                className="p-2 hover:bg-rose-500/10 text-rose-600 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
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
