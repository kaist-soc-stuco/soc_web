import { useEffect, useMemo, useState } from "react";
import { createApiClient } from "@soc/api-client";
import type { BulkEmailRecord, SendBulkEmailRequest } from "@soc/contracts";
import { resolveApiBaseUrl } from "@/lib/api-base-url";
import { Send, History, AlertTriangle, Users, Mail } from "lucide-react";
import { formatKoreanDateTime, isoToMs } from "@soc/shared";
import { AuthGuard } from "@/components/guards/auth-guard";
import { useConfirmDialog } from "@/components/ui/confirm-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Permissions } from "@/lib/permissions";

export function BulkEmailPage() {
  return (
    <AuthGuard requirePermission={Permissions.ADMIN}>
      <BulkEmailPageContent />
    </AuthGuard>
  );
}

function BulkEmailPageContent() {
  const apiClient = useMemo(() => createApiClient({ baseUrl: resolveApiBaseUrl() }), []);
  const { confirm: requestConfirm, ConfirmDialog } = useConfirmDialog();

  const [history, setHistory] = useState<BulkEmailRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form states
  const [formData, setFormData] = useState<SendBulkEmailRequest>({
    subject: "",
    content: "",
    recipientType: "ALL",
  });

  const loadHistory = () => {
    setHistoryLoading(true);
    apiClient
      .getBulkEmailHistory()
      .then((res) => {
        // Sort history by sentAt descending
        const sorted = [...res.items].sort(
          (a, b) => isoToMs(b.sentAt) - isoToMs(a.sentAt)
        );
        setHistory(sorted);
      })
      .catch(() => {
        // Silent or small warning
      })
      .finally(() => {
        setHistoryLoading(false);
      });
  };

  useEffect(() => {
    loadHistory();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.subject || !formData.content) {
      alert("제목과 내용을 입력해 주세요.");
      return;
    }

    const typeLabels = {
      ALL: "전체 학생",
      PAID_STUDENTS: "과비 납부자",
      UNPAID_STUDENTS: "과비 미납자",
    };

    const confirmed = await requestConfirm({
      confirmLabel: "발송",
      description: `${typeLabels[formData.recipientType]} 대상에게 이메일을 일괄 발송합니다. 이 작업은 되돌릴 수 없습니다.`,
      title: "이메일을 발송하시겠습니까?",
      tone: "danger",
    });
    if (!confirmed) return;

    setSending(true);
    setError(null);

    try {
      const res = await apiClient.sendBulkEmail(formData);
      if (res.success) {
        alert(`성공적으로 이메일을 발송했습니다. (발송 대상: ${res.recipientCount}명)`);
        setFormData({
          subject: "",
          content: "",
          recipientType: "ALL",
        });
        loadHistory();
      } else {
        setError("일부 메일 전송이 실패했거나 데이터베이스 등록 오류가 발생했습니다.");
      }
    } catch (err) {
      setError("이메일 발송 중 오류가 발생했습니다. 백엔드 로그를 확인해 주세요.");
    } finally {
      setSending(false);
    }
  };

  const getRecipientTypeLabel = (type: string) => {
    switch (type) {
      case "ALL":
        return "전체 학생";
      case "PAID_STUDENTS":
        return "과비 납부 학생";
      case "UNPAID_STUDENTS":
        return "과비 미납 학생";
      default:
        return type;
    }
  };

  const historySkeleton = (
    <div className="space-y-4" aria-busy="true">
      {Array.from({ length: 4 }).map((_, index) => (
        <div
          key={index}
          className="space-y-3 rounded-2xl border border-slate-100 bg-slate-50/30 p-4"
        >
          <div className="flex items-start justify-between gap-2">
            <Skeleton className="h-5 w-16 rounded-md" />
            <Skeleton className="h-3 w-20" />
          </div>
          <Skeleton className="h-4 w-full" />
          <div className="flex items-center justify-between border-t border-slate-100 pt-2">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-3 w-16" />
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50/50 text-kaist-black pb-20">
      {ConfirmDialog}
      <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-8 md:px-8">
        {/* Unified Compact Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-200 pb-5 gap-4 select-none">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-slate-800">이메일 일괄발송</h1>
            <p className="mt-1 text-[13px] font-semibold leading-relaxed text-slate-400">
              특정 그룹(전체, 과비 납부자, 과비 미납자)을 지정하여 공식 공지 메일을 일괄적으로 발송합니다.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 items-start">
          {/* Left Column: Form */}
          <div className="lg:col-span-2 space-y-6">
            <form onSubmit={handleSubmit} className="space-y-6 rounded-2xl border border-slate-100 bg-white p-6 shadow-[0_8px_30px_rgba(0,0,0,0.015)]">
              <h2 className="flex items-center gap-2 border-b border-slate-100 pb-3 text-lg font-extrabold text-slate-800">
                <Mail className="w-5 h-5 text-kaist-darkgreen" />
                메일 작성
              </h2>

              {error && (
                <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-xs font-bold text-slate-400">수신 대상 *</label>
                  <div className="grid grid-cols-3 gap-3">
                    {(["ALL", "PAID_STUDENTS", "UNPAID_STUDENTS"] as const).map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setFormData({ ...formData, recipientType: type })}
                        className={`py-3 px-4 rounded-xl border text-xs sm:text-sm font-bold transition-all text-center cursor-pointer ${
                          formData.recipientType === type
                            ? "bg-kaist-darkgreen text-white border-0 hover:bg-[#0f5c29] shadow-sm"
                            : "bg-white hover:bg-slate-50 text-slate-700 border border-slate-200"
                        }`}
                      >
                        {getRecipientTypeLabel(type)}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-bold text-slate-400">메일 제목 *</label>
                  <input
                    type="text"
                    required
                    value={formData.subject}
                    onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                    placeholder="[KAIST 전산학부 집행위원회] 공지 제목을 입력하세요."
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-kaist-darkgreen focus:ring-2 focus:ring-kaist-darkgreen/10"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-bold text-slate-400">메일 본문 내용 *</label>
                  <textarea
                    required
                    rows={12}
                    value={formData.content}
                    onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                    placeholder="메일 본문 내용을 상세히 작성하세요. (텍스트 포맷 지원)"
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-kaist-darkgreen focus:ring-2 focus:ring-kaist-darkgreen/10"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={sending}
                  className="flex items-center gap-2 rounded-xl border-0 bg-kaist-darkgreen px-6 py-3 text-sm font-extrabold text-white transition-all shadow-sm cursor-pointer hover:bg-[#0f5c29] disabled:opacity-50"
                >
                  <Send className="w-4 h-4" />
                  {sending ? "전송 중..." : "일괄 전송하기"}
                </button>
              </div>
            </form>
          </div>

          {/* Right Column: Sending Logs History */}
          <div className="lg:col-span-1 space-y-6">
            <div className="space-y-4 rounded-2xl border border-slate-100 bg-white p-6 shadow-[0_8px_30px_rgba(0,0,0,0.015)]">
              <h2 className="flex items-center gap-2 border-b border-slate-100 pb-3 text-lg font-extrabold text-slate-800">
                <History className="w-5 h-5 text-kaist-greygreen" />
                최근 발송 내역
              </h2>

              {historyLoading ? (
                historySkeleton
              ) : history.length === 0 ? (
                <div className="py-8 text-center text-sm font-semibold text-slate-400">이전 발송 이력이 없습니다.</div>
              ) : (
                <div className="space-y-4 max-h-[500px] overflow-y-auto pr-1">
                  {history.map((record) => (
                    <div
                      key={record.id}
                      className="space-y-2 rounded-2xl border border-slate-100 bg-slate-50/30 p-4 transition-all hover:border-kaist-darkgreen/15"
                    >
                      <div className="flex justify-between items-start gap-2">
                        <span
                          className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md ${
                            record.status === "SUCCESS"
                              ? "bg-green-50 text-green-700 border border-green-200"
                              : "bg-red-50 text-red-700 border border-red-200"
                          }`}
                        >
                          {record.status}
                        </span>
                        <span className="text-[10px] text-kaist-grey font-semibold">
                          {formatKoreanDateTime(record.sentAt)}
                        </span>
                      </div>

                      <h3 className="line-clamp-1 text-xs font-extrabold text-slate-800 sm:text-sm">
                        {record.subject}
                      </h3>

                      <div className="flex items-center justify-between border-t border-slate-100 pt-1 text-xs text-slate-500">
                        <span className="flex items-center gap-1">
                          <Users className="w-3.5 h-3.5" />
                          수신: {record.recipientCount}명
                        </span>
                        {record.senderName && <span className="font-medium">발송: {record.senderName}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
