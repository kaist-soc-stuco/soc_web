import { useEffect, useMemo, useState } from "react";
import { createApiClient } from "@soc/api-client";
import type {
  BulkEmailRecord,
  BulkEmailTemplate,
  SendBulkEmailRequest,
} from "@soc/contracts";
import { formatKoreanDateTime, isoToMs } from "@soc/shared";
import { AlertTriangle, History, Mail, Send, Sparkles, Users } from "lucide-react";

import { AuthGuard } from "@/components/guards/auth-guard";
import { Skeleton } from "@/components/ui/skeleton";
import { Permissions } from "@/lib/permissions";
import { resolveApiBaseUrl } from "@/lib/api-base-url";

const RECIPIENT_TYPES: Array<{
  value: SendBulkEmailRequest["recipientType"];
  label: string;
  description: string;
}> = [
  { value: "ALL", label: "전체 학생", description: "활성 사용자 전체" },
  { value: "PAID_STUDENTS", label: "과비 납부자", description: "납부 완료로 확인된 학생" },
  { value: "UNPAID_STUDENTS", label: "F26 미납자", description: "미납 또는 아직 확인되지 않은 학생" },
];

export function BulkEmailPage() {
  return (
    <AuthGuard requirePermission={Permissions.ADMIN}>
      <BulkEmailPageContent />
    </AuthGuard>
  );
}

function BulkEmailPageContent() {
  const apiClient = useMemo(() => createApiClient({ baseUrl: resolveApiBaseUrl() }), []);
  const [history, setHistory] = useState<BulkEmailRecord[]>([]);
  const [templates, setTemplates] = useState<BulkEmailTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [recipientType, setRecipientType] = useState<SendBulkEmailRequest["recipientType"]>(
    "UNPAID_STUDENTS",
  );
  const [subject, setSubject] = useState("");
  const [content, setContent] = useState("");
  const [historyLoading, setHistoryLoading] = useState(true);
  const [templatesLoading, setTemplatesLoading] = useState(true);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [operationError, setOperationError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [lastDeliveryMode, setLastDeliveryMode] = useState<"sent" | "dry_run" | null>(null);

  const loadHistory = async () => {
    setHistoryLoading(true);
    setHistoryError(null);
    try {
      const response = await apiClient.getBulkEmailHistory();
      setHistory([...response.items].sort((a, b) => isoToMs(b.sentAt) - isoToMs(a.sentAt)));
    } catch {
      setHistoryError("기존 처리 기록을 불러오지 못했습니다.");
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    void loadHistory();
    apiClient
      .getBulkEmailTemplates()
      .then((response) => setTemplates(response.items))
      .catch(() => setOperationError("메일 템플릿을 불러오지 못했습니다."))
      .finally(() => setTemplatesLoading(false));
  }, []);

  useEffect(() => {
    if (templates.length === 0) return;
    const defaultTemplate =
      templates.find((template) => template.id === "f26-unpaid-reminder") ?? templates[0];
    setSelectedTemplateId(defaultTemplate.id);
    setRecipientType(defaultTemplate.recipientType);
    setSubject(defaultTemplate.subject);
    setContent(defaultTemplate.content);
  }, [templates]);

  const applyTemplate = (template: BulkEmailTemplate) => {
    setSelectedTemplateId(template.id);
    setRecipientType(template.recipientType);
    setSubject(template.subject);
    setContent(template.content);
    setOperationError(null);
  };

  const handleSend = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!subject.trim() || !content.trim()) {
      setOperationError("메일 제목과 본문을 입력해 주세요.");
      return;
    }

    try {
      setSending(true);
      setOperationError(null);
      const response = await apiClient.sendBulkEmail({
        subject: subject.trim(),
        content: content.trim(),
        recipientType,
      });
      setLastDeliveryMode(response.deliveryMode);
      await loadHistory();
    } catch {
      setOperationError("메일 발송에 실패했습니다. SMTP 설정과 발송 권한을 확인해 주세요.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/50 pb-20 text-kaist-black">
      <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-8 md:px-8">
        <div className="flex flex-col justify-between gap-4 border-b border-slate-200 pb-5 md:flex-row md:items-center">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-slate-800">이메일 일괄발송</h1>
            <p className="mt-1 text-[13px] font-semibold leading-relaxed text-slate-400">
              템플릿을 골라 전체 학생 또는 과비 상태별 그룹에 공지 메일을 보냅니다.
            </p>
          </div>
          {lastDeliveryMode && (
            <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-black text-emerald-700">
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              {lastDeliveryMode === "dry_run" ? "개발용 드라이런 완료" : "SMTP 발송 완료"}
            </span>
          )}
        </div>

        <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-amber-950">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" aria-hidden="true" />
          <p className="text-xs font-semibold leading-5 sm:text-sm">
            개발 환경에서는 기본적으로 실제 수신자에게 보내지 않는 드라이런으로 기록됩니다. 운영에서
            실제 발송을 하려면 <code className="rounded bg-white/70 px-1">EMAIL_DRY_RUN=false</code>와
            SMTP 설정이 필요합니다.
          </p>
        </div>

        {operationError && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
            {operationError}
          </div>
        )}

        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.55fr)_minmax(20rem,0.85fr)]">
          <form onSubmit={(event) => void handleSend(event)} className="space-y-6 rounded-2xl border border-slate-100 bg-white p-6 shadow-[0_8px_30px_rgba(0,0,0,0.015)]">
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <h2 className="flex items-center gap-2 text-lg font-extrabold text-slate-800">
                <Mail className="h-5 w-5 text-kaist-darkgreen" aria-hidden="true" />
                메일 작성
              </h2>
              <span className="text-xs font-bold text-slate-400">
                {templatesLoading ? "템플릿 불러오는 중..." : `${templates.length}개 템플릿`}
              </span>
            </div>

            <div>
              <p className="mb-2 text-xs font-bold text-slate-500">빠른 템플릿</p>
              <div className="grid gap-3 sm:grid-cols-2">
                {templates.map((template) => (
                  <button
                    key={template.id}
                    type="button"
                    onClick={() => applyTemplate(template)}
                    className={`rounded-xl border p-4 text-left transition ${
                      selectedTemplateId === template.id
                        ? "border-kaist-darkgreen bg-emerald-50/60 ring-2 ring-kaist-darkgreen/10"
                        : "border-slate-200 bg-white hover:border-kaist-darkgreen/40 hover:bg-slate-50"
                    }`}
                  >
                    <p className="text-sm font-black text-slate-800">{template.name}</p>
                    <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">{template.description}</p>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-2 text-xs font-bold text-slate-500">수신 대상</p>
              <div className="grid gap-2 sm:grid-cols-3">
                {RECIPIENT_TYPES.map((type) => (
                  <button
                    key={type.value}
                    type="button"
                    onClick={() => setRecipientType(type.value)}
                    className={`rounded-xl border px-3 py-3 text-left transition ${
                      recipientType === type.value
                        ? "border-kaist-darkgreen bg-kaist-darkgreen text-white"
                        : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    <span className="block text-xs font-black">{type.label}</span>
                    <span className={`mt-1 block text-[11px] font-semibold ${recipientType === type.value ? "text-white/75" : "text-slate-400"}`}>
                      {type.description}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <label className="block">
              <span className="mb-2 block text-xs font-bold text-slate-500">메일 제목</span>
              <input
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
                maxLength={255}
                required
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-kaist-darkgreen focus:ring-4 focus:ring-kaist-darkgreen/10"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-xs font-bold text-slate-500">메일 본문</span>
              <textarea
                value={content}
                onChange={(event) => setContent(event.target.value)}
                rows={13}
                required
                className="w-full resize-y rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium leading-6 text-slate-800 outline-none transition focus:border-kaist-darkgreen focus:ring-4 focus:ring-kaist-darkgreen/10"
              />
            </label>

            <div className="flex justify-end border-t border-slate-100 pt-4">
              <button
                type="submit"
                disabled={sending || templatesLoading}
                className="inline-flex items-center gap-2 rounded-xl bg-kaist-darkgreen px-6 py-3 text-sm font-extrabold text-white transition hover:bg-kaist-darkgreen/90 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                <Send className="h-4 w-4" aria-hidden="true" />
                {sending ? "발송 처리 중..." : "선택 그룹에 발송"}
              </button>
            </div>
          </form>

          <section className="space-y-4 rounded-2xl border border-slate-100 bg-white p-6 shadow-[0_8px_30px_rgba(0,0,0,0.015)]">
            <h2 className="flex items-center gap-2 border-b border-slate-100 pb-3 text-lg font-extrabold text-slate-800">
              <History className="h-5 w-5 text-kaist-greygreen" aria-hidden="true" />
              발송 기록
            </h2>

            {historyLoading ? (
              <div className="space-y-4" aria-busy="true">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div key={index} className="space-y-3 rounded-2xl border border-slate-100 bg-slate-50/30 p-4">
                    <div className="flex items-start justify-between gap-2"><Skeleton className="h-5 w-16 rounded-md" /><Skeleton className="h-3 w-20" /></div>
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                ))}
              </div>
            ) : historyError ? (
              <div className="rounded-xl border border-red-100 bg-red-50 px-3 py-4 text-center text-xs font-semibold text-red-700">{historyError}</div>
            ) : history.length === 0 ? (
              <div className="py-8 text-center text-sm font-semibold text-slate-400">아직 발송 기록이 없습니다.</div>
            ) : (
              <div className="max-h-[640px] space-y-4 overflow-y-auto pr-1">
                {history.map((record) => (
                  <div key={record.id} className="space-y-2 rounded-2xl border border-slate-100 bg-slate-50/30 p-4 transition hover:border-kaist-darkgreen/15">
                    <div className="flex items-start justify-between gap-2">
                      <span className={`rounded-md border px-2 py-0.5 text-[10px] font-extrabold ${
                        record.status === "FAILED"
                          ? "border-red-200 bg-red-50 text-red-700"
                          : record.status === "DRY_RUN"
                            ? "border-sky-200 bg-sky-50 text-sky-700"
                            : record.status === "SUCCESS"
                              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                              : "border-amber-200 bg-amber-50 text-amber-800"
                      }`}>
                        {record.status === "DRY_RUN" ? "드라이런" : record.status === "SUCCESS" ? "발송 완료" : record.status === "FAILED" ? "발송 실패" : "처리 중"}
                      </span>
                      <span className="text-[10px] font-semibold text-kaist-grey">{formatKoreanDateTime(record.sentAt)}</span>
                    </div>
                    <h3 className="line-clamp-2 text-sm font-extrabold text-slate-800">{record.subject}</h3>
                    <div className="flex items-center justify-between border-t border-slate-100 pt-1 text-xs font-semibold text-slate-500">
                      <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" aria-hidden="true" />대상 {record.recipientCount}명</span>
                      <span>{record.senderName ?? "관리자"}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
