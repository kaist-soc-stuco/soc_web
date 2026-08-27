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
import { ChevronLeft, ClipboardCheck, FileText, Image as ImageIcon, Music, User, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatSurveyAnswer } from "@/lib/survey-answer-display";
import { resolveAssetUrl } from "@/lib/asset-url";
import { SurveyRespondentDrawer } from "@/components/organisms/survey-respondent-drawer";

interface ResponseFile {
  assetId: string;
  fileName: string;
  sizeBytes?: number;
  mimeType?: string;
}

function getResponseFiles(content: Record<string, unknown>): ResponseFile[] {
  const metadata = Array.isArray(content.files)
    ? content.files.filter(
        (file): file is Record<string, unknown> =>
          typeof file === "object" && file !== null,
      )
    : [];
  const assetIds = Array.isArray(content.assetIds)
    ? content.assetIds.filter((assetId): assetId is string => typeof assetId === "string")
    : typeof content.assetId === "string"
      ? [content.assetId]
      : [];

  return assetIds.map((assetId, index) => {
    const metadataItem = metadata[index];
    return {
      assetId,
      fileName:
        typeof metadataItem?.fileName === "string"
          ? metadataItem.fileName
          : index === 0 && typeof content.fileName === "string"
            ? content.fileName
            : "첨부 파일",
      sizeBytes:
        typeof metadataItem?.sizeBytes === "number"
          ? metadataItem.sizeBytes
          : index === 0 && typeof content.sizeBytes === "number"
            ? content.sizeBytes
            : undefined,
      mimeType:
        typeof metadataItem?.mimeType === "string"
          ? metadataItem.mimeType
          : index === 0 && typeof content.mimeType === "string"
            ? content.mimeType
            : undefined,
    };
  });
}

function formatFileSize(sizeBytes?: number) {
  if (typeof sizeBytes !== "number" || !Number.isFinite(sizeBytes)) return "";
  if (sizeBytes < 1_000_000) return `${Math.max(1, Math.round(sizeBytes / 1_000))}KB`;
  return `${(sizeBytes / 1_000_000).toFixed(1)}MB`;
}

function FileTypeIcon({ mimeType }: { mimeType?: string }) {
  if (mimeType?.startsWith("image/")) return <ImageIcon aria-hidden="true" className="size-4" />;
  if (mimeType?.startsWith("video/")) return <Video aria-hidden="true" className="size-4" />;
  if (mimeType?.startsWith("audio/")) return <Music aria-hidden="true" className="size-4" />;
  return <FileText aria-hidden="true" className="size-4" />;
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
  const [selectedRespondent, setSelectedRespondent] = useState<ResponseDetailResponse["user"]>(null);

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
        <AdminPageMain aria-busy={loading}>
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
                    {response.user?.nameKo ? (
                      <button
                        type="button"
                        className="font-medium text-slate-900 underline-offset-4 hover:underline"
                        onClick={() => setSelectedRespondent(response.user)}
                      >
                        {response.user.nameKo}
                      </button>
                    ) : (
                      <span>{response.user ? "—" : "비로그인 응답"}</span>
                    )}
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
                        <p className="text-sm font-semibold text-[#172033]">
                          {match ? `[${match.sectionTitle}] ${match.question.titleKo}` : a.questionId}
                        </p>
                      </div>
                      <div className="whitespace-pre-wrap rounded-lg border border-slate-100 bg-slate-50/70 px-4 py-3 text-sm font-normal text-[#172033]">
                        {match?.question.questionType === "file_upload" && getResponseFiles(a.content).length > 0 ? (
                          <div className="space-y-2">
                            {getResponseFiles(a.content).map((file) => (
                              <a
                                key={file.assetId}
                                className="flex items-center gap-2 text-brand-primary underline-offset-4 hover:underline"
                                href={resolveAssetUrl(`asset:${file.assetId}`)}
                                target="_blank"
                                rel="noreferrer"
                              >
                                <FileTypeIcon mimeType={file.mimeType} />
                                <span className="min-w-0 truncate">{file.fileName}</span>
                                {formatFileSize(file.sizeBytes) ? <span className="shrink-0 text-xs text-slate-500">({formatFileSize(file.sizeBytes)})</span> : null}
                              </a>
                            ))}
                          </div>
                        ) : match ? formatSurveyAnswer(a, match.question) || "—" : "—"}
                      </div>
                    </div>
                  );})}
                </div>
              </AdminCard>
            </div>
          )}
        </AdminPageMain>
        <SurveyRespondentDrawer
          user={selectedRespondent}
          onClose={() => setSelectedRespondent(null)}
        />
      </AdminPageShell>
    </AuthGuard>
  );
}
