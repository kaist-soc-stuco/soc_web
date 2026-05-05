import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createApiClient } from "@soc/api-client";
import type { SurveyRecord } from "@soc/contracts";
import { formatKoreanDateTime } from "@soc/shared";
import { Header } from "@/components/organisms/header";
import { Button } from "@/components/ui/button";
import { resolveApiBaseUrl } from "@/lib/api";
import { getAuthSessionSummary } from "@/lib/auth-session";
import { hasPersistedProfile } from "@/lib/require-persisted-profile";

const STATUS_LABEL: Record<string, string> = {
  draft: "초안",
  scheduled: "예약됨",
  open: "진행 중",
  closed: "마감",
  archived: "보관됨",
};

const STATE_LABEL: Record<string, string> = {
  before_open: "개시 전",
  open: "진행 중",
  closed: "마감",
};

export function SurveyListPage() {
  const navigate = useNavigate();
  const [surveys, setSurveys] = useState<SurveyRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const client = createApiClient({ baseUrl: resolveApiBaseUrl() });

  useEffect(() => {
    (async () => {
      const session = await getAuthSessionSummary(client);
      if (!hasPersistedProfile(session)) {
        navigate("/login");
        return;
      }
      try {
        const data = await client.listSurveys();
        setSurveys(data);
      } catch {
        setError("설문조사 목록을 불러오지 못했습니다.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

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

  const copyLink = (id: string) => {
    const url = `${window.location.origin}/survey/${id}`;
    navigator.clipboard
      .writeText(url)
      .then(() => alert("링크가 복사되었습니다."));
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header />
      <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">설문조사 관리</h1>
          <Button onClick={() => navigate("/admin/surveys/new")}>
            + 새 설문조사
          </Button>
        </div>

        {loading && <p className="text-gray-500">불러오는 중…</p>}
        {error && <p className="text-red-500">{error}</p>}

        {!loading && !error && surveys.length === 0 && (
          <p className="text-gray-500">등록된 설문조사가 없습니다.</p>
        )}

        {!loading && surveys.length > 0 && (
          <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-100 text-gray-600 uppercase text-xs">
                <tr>
                  <th className="px-4 py-3 text-left">제목</th>
                  <th className="px-4 py-3 text-left">상태</th>
                  <th className="px-4 py-3 text-left">시작</th>
                  <th className="px-4 py-3 text-left">마감</th>
                  <th className="px-4 py-3 text-left">작업</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {surveys.map((s) => (
                  <tr key={s.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {s.titleKo}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-block rounded-full px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-700 mr-1">
                        {STATUS_LABEL[s.status] ?? s.status}
                      </span>
                      <span className="inline-block rounded-full px-2 py-0.5 text-xs font-medium bg-blue-50 text-blue-700">
                        {STATE_LABEL[s.computedState] ?? s.computedState}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {s.opensAt ? formatKoreanDateTime(s.opensAt) : "—"}
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {s.closesAt ? formatKoreanDateTime(s.closesAt) : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2 flex-wrap">
                        <button
                          onClick={() =>
                            navigate(`/admin/surveys/${s.id}/edit`)
                          }
                          className="text-blue-600 hover:underline text-xs"
                        >
                          편집
                        </button>
                        <button
                          onClick={() =>
                            navigate(`/admin/surveys/${s.id}/responses`)
                          }
                          className="text-green-600 hover:underline text-xs"
                        >
                          응답
                        </button>
                        <button
                          onClick={() => copyLink(s.id)}
                          className="text-gray-500 hover:underline text-xs"
                        >
                          링크
                        </button>
                        <button
                          onClick={() => handleDelete(s.id, s.titleKo)}
                          disabled={deleting === s.id}
                          className="text-red-500 hover:underline text-xs disabled:opacity-50"
                        >
                          삭제
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
