import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { createApiClient } from "@soc/api-client";
import type { SurveyResponseRecord } from "@soc/contracts";
import { formatKoreanDateTime } from "@soc/shared";
import { Header } from "@/components/organisms/header";
import { resolveApiBaseUrl } from "@/lib/api";
import { getAuthSessionSummary } from "@/lib/auth-session";
import { hasPersistedProfile } from "@/lib/require-persisted-profile";

const STATUS_LABEL: Record<string, string> = {
  draft: "임시",
  submitted: "제출됨",
  approved: "승인",
  rejected: "반려",
  waitlisted: "대기",
};

const STATUS_COLOR: Record<string, string> = {
  submitted: "bg-blue-50 text-blue-700",
  approved: "bg-green-50 text-green-700",
  rejected: "bg-red-50 text-red-700",
  waitlisted: "bg-yellow-50 text-yellow-700",
  draft: "bg-gray-100 text-gray-600",
};

export function SurveyResponseListPage() {
  const navigate = useNavigate();
  const { id: surveyId } = useParams<{ id: string }>();
  const [responses, setResponses] = useState<SurveyResponseRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const client = createApiClient({ baseUrl: resolveApiBaseUrl() });

  useEffect(() => {
    if (!surveyId) return;
    (async () => {
      const session = await getAuthSessionSummary(client);
      if (!hasPersistedProfile(session)) {
        navigate("/login");
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
  }, [surveyId]);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header />
      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-8">
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => navigate("/admin/surveys")}
            className="text-sm text-gray-400 hover:text-gray-600"
          >
            ← 목록
          </button>
          <h1 className="text-xl font-bold text-gray-900">응답 목록</h1>
        </div>

        {loading && <p className="text-gray-500">불러오는 중…</p>}
        {error && <p className="text-red-500">{error}</p>}

        {!loading && !error && responses.length === 0 && (
          <p className="text-gray-500">제출된 응답이 없습니다.</p>
        )}

        {!loading && responses.length > 0 && (
          <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-100 text-gray-600 uppercase text-xs">
                <tr>
                  <th className="px-4 py-3 text-left">제출자</th>
                  <th className="px-4 py-3 text-left">제출 시각</th>
                  <th className="px-4 py-3 text-left">상태</th>
                  <th className="px-4 py-3 text-left">검토 시각</th>
                  <th className="px-4 py-3 text-left">작업</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {responses.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-700 font-mono text-xs">
                      {r.userId ?? r.externalPhone ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {r.submittedAt
                        ? formatKoreanDateTime(r.submittedAt)
                        : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLOR[r.status] ?? "bg-gray-100 text-gray-600"}`}
                      >
                        {STATUS_LABEL[r.status] ?? r.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {r.reviewedAt ? formatKoreanDateTime(r.reviewedAt) : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() =>
                          navigate(
                            `/admin/surveys/${surveyId}/responses/${r.id}`,
                          )
                        }
                        className="text-blue-600 hover:underline text-xs"
                      >
                        상세 / 검토
                      </button>
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
