import { useEffect, useMemo, useState } from "react";
import { createApiClient } from "@soc/api-client";
import type { BulkEmailRecord, SendBulkEmailRequest } from "@soc/contracts";
import { resolveApiBaseUrl } from "@/lib/api-base-url";
import { Send, History, CheckCircle, AlertTriangle, Users, Mail } from "lucide-react";
import { formatKoreanDateTime } from "@soc/shared";

export function BulkEmailPage() {
  const apiClient = useMemo(() => createApiClient({ baseUrl: resolveApiBaseUrl() }), []);

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
          (a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime()
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

    if (
      !confirm(
        `정말로 ${typeLabels[formData.recipientType]} 대상에게 이메일을 일괄 발송하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`
      )
    ) {
      return;
    }

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

  return (
    <div className="min-h-screen bg-slate-50/50 text-kaist-black pb-20">
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 md:px-8">
        {/* Unified Compact Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-gray-200 pb-5 gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">이메일 일괄발송</h1>
            <p className="mt-1 text-sm text-gray-500">
              특정 그룹(전체, 과비 납부자, 과비 미납자)을 지정하여 공식 공지 메일을 일괄적으로 발송합니다.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          {/* Left Column: Form */}
          <div className="lg:col-span-2 space-y-6">
            <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm space-y-6">
              <h2 className="text-lg font-bold text-kaist-black flex items-center gap-2">
                <Mail className="w-5 h-5 text-kaist-darkgreen" />
                메일 작성
              </h2>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl text-sm font-medium flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5">수신 대상 *</label>
                  <div className="grid grid-cols-3 gap-3">
                    {(["ALL", "PAID_STUDENTS", "UNPAID_STUDENTS"] as const).map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setFormData({ ...formData, recipientType: type })}
                        className={`py-3 px-4 rounded-xl border text-xs sm:text-sm font-bold transition-all text-center cursor-pointer ${
                          formData.recipientType === type
                            ? "bg-kaist-darkgreen text-white border-0 hover:bg-kaist-darkgreen/90 shadow-md shadow-kaist-darkgreen/15"
                            : "bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-200"
                        }`}
                      >
                        {getRecipientTypeLabel(type)}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5">메일 제목 *</label>
                  <input
                    type="text"
                    required
                    value={formData.subject}
                    onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                    placeholder="[KAIST 전산학부 학생회] 공지 제목을 입력하세요."
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-kaist-darkgreen focus:ring-1 focus:ring-kaist-darkgreen"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5">메일 본문 내용 *</label>
                  <textarea
                    required
                    rows={12}
                    value={formData.content}
                    onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                    placeholder="메일 본문 내용을 상세히 작성하세요. (텍스트 포맷 지원)"
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-kaist-darkgreen focus:ring-1 focus:ring-kaist-darkgreen"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={sending}
                  className="flex items-center gap-2 bg-kaist-darkgreen hover:bg-kaist-darkgreen/90 text-white font-bold text-sm px-6 py-3 rounded-xl transition-all shadow-md shadow-kaist-darkgreen/15 cursor-pointer border-0 disabled:opacity-50"
                >
                  <Send className="w-4 h-4" />
                  {sending ? "전송 중..." : "일괄 전송하기"}
                </button>
              </div>
            </form>
          </div>

          {/* Right Column: Sending Logs History */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm space-y-4">
              <h2 className="text-lg font-bold text-kaist-black flex items-center gap-2 border-b border-gray-50 pb-3">
                <History className="w-5 h-5 text-kaist-greygreen" />
                최근 발송 내역
              </h2>

              {historyLoading ? (
                <div className="text-center py-8 text-kaist-grey/60 text-sm font-medium">불러오는 중...</div>
              ) : history.length === 0 ? (
                <div className="text-center py-8 text-kaist-grey/60 text-sm font-medium">이전 발송 이력이 없습니다.</div>
              ) : (
                <div className="space-y-4 max-h-[500px] overflow-y-auto pr-1">
                  {history.map((record) => (
                    <div
                      key={record.id}
                      className="p-4 border border-gray-100 rounded-2xl hover:border-kaist-lightgreen/30 transition-all space-y-2 bg-slate-50/30"
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

                      <h3 className="font-bold text-gray-900 text-xs sm:text-sm line-clamp-1">
                        {record.subject}
                      </h3>

                      <div className="flex justify-between items-center text-xs text-kaist-grey pt-1 border-t border-gray-100/50">
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
