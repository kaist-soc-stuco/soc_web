import { useEffect, useMemo, useState } from "react";
import { createApiClient } from "@soc/api-client";
import type { BulkEmailRecord } from "@soc/contracts";
import { resolveApiBaseUrl } from "@/lib/api-base-url";
import { Send, History, AlertTriangle, Users, Mail } from "lucide-react";
import { formatKoreanDateTime, isoToMs } from "@soc/shared";
import { AuthGuard } from "@/components/guards/auth-guard";
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

  const [history, setHistory] = useState<BulkEmailRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState<string | null>(null);

  const loadHistory = () => {
    setHistoryLoading(true);
    setHistoryError(null);
    apiClient
      .getBulkEmailHistory()
      .then((res) => {
        const sorted = [...res.items].sort(
          (a, b) => isoToMs(b.sentAt) - isoToMs(a.sentAt)
        );
        setHistory(sorted);
      })
      .catch(() => {
        setHistoryError("기존 처리 기록을 불러오지 못했습니다.");
      })
      .finally(() => {
        setHistoryLoading(false);
      });
  };

  useEffect(() => {
    loadHistory();
  }, []);

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

  const getHistoryStatusPresentation = (status: string) => {
    if (status === "FAILED") {
      return {
        className: "border-red-200 bg-red-50 text-red-700",
        label: "실패 기록",
      };
    }

    if (status === "SUCCESS") {
      return {
        className: "border-amber-200 bg-amber-50 text-amber-800",
        label: "전달 미검증",
      };
    }

    return {
      className: "border-slate-200 bg-slate-100 text-slate-600",
      label: "상태 미확인",
    };
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
      <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-8 md:px-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-200 pb-5 gap-4 select-none">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-slate-800">이메일 일괄발송</h1>
            <p className="mt-1 text-[13px] font-semibold leading-relaxed text-slate-400">
              공식 공지 메일 발송 기능의 준비 상태와 기존 처리 기록을 확인합니다.
            </p>
          </div>
        </div>

        <section
          id="bulk-email-unavailable-description"
          role="status"
          className="flex flex-col gap-4 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-amber-950 sm:flex-row sm:items-start sm:justify-between"
        >
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
            <div>
              <p className="text-sm font-extrabold">현재 일괄발송을 사용할 수 없습니다.</p>
              <p className="mt-1 text-xs font-semibold leading-5 text-amber-900/80 sm:text-sm">
                메일 전송 제공자와 운영 설정이 아직 연결되지 않았습니다. 현재 화면과 API는
                메일을 발송하지 않으며, 제공자 선정·자격 증명·발신 도메인 검증이 끝난 뒤
                별도로 활성화해야 합니다.
              </p>
            </div>
          </div>
          <span className="w-fit shrink-0 rounded-full border border-amber-300 bg-white/70 px-3 py-1 text-xs font-extrabold text-amber-800">
            구현 예정 · 설정 필요
          </span>
        </section>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 items-start">
          <div className="lg:col-span-2 space-y-6">
            <form
              aria-describedby="bulk-email-unavailable-description"
              onSubmit={(event) => event.preventDefault()}
              className="space-y-6 rounded-2xl border border-slate-100 bg-white p-6 shadow-[0_8px_30px_rgba(0,0,0,0.015)]"
            >
              <h2 className="flex items-center gap-2 border-b border-slate-100 pb-3 text-lg font-extrabold text-slate-800">
                <Mail className="w-5 h-5 text-kaist-darkgreen" />
                메일 작성
              </h2>

              <fieldset disabled className="m-0 space-y-6 border-0 p-0">
                <div className="space-y-4 opacity-60">
                  <div>
                    <label className="mb-1.5 block text-xs font-bold text-slate-400">수신 대상</label>
                    <div className="grid grid-cols-3 gap-3">
                      {(["ALL", "PAID_STUDENTS", "UNPAID_STUDENTS"] as const).map((type) => (
                        <button
                          key={type}
                          type="button"
                          disabled
                          className={`cursor-not-allowed rounded-xl border px-4 py-3 text-center text-xs font-bold sm:text-sm ${
                            type === "ALL"
                              ? "border-slate-300 bg-slate-200 text-slate-600"
                              : "border-slate-200 bg-white text-slate-500"
                          }`}
                        >
                          {getRecipientTypeLabel(type)}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-bold text-slate-400">메일 제목</label>
                    <input
                      type="text"
                      disabled
                      placeholder="메일 전송 설정 후 작성할 수 있습니다."
                      className="w-full cursor-not-allowed rounded-xl border border-slate-200 bg-slate-100 px-4 py-2.5 text-sm font-medium text-slate-500 placeholder:text-slate-400"
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-bold text-slate-400">메일 본문</label>
                    <textarea
                      disabled
                      rows={12}
                      placeholder="메일 전송 설정 후 작성할 수 있습니다."
                      className="w-full cursor-not-allowed rounded-xl border border-slate-200 bg-slate-100 px-4 py-3 text-sm font-medium text-slate-500 placeholder:text-slate-400"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    disabled
                    title="메일 전송 제공자와 운영 설정이 필요합니다."
                    className="flex cursor-not-allowed items-center gap-2 rounded-xl border-0 bg-slate-200 px-6 py-3 text-sm font-extrabold text-slate-500"
                  >
                    <Send className="w-4 h-4" />
                    발송 기능 준비 중
                  </button>
                </div>
              </fieldset>
            </form>
          </div>

          <div className="lg:col-span-1 space-y-6">
            <div className="space-y-4 rounded-2xl border border-slate-100 bg-white p-6 shadow-[0_8px_30px_rgba(0,0,0,0.015)]">
              <h2 className="flex items-center gap-2 border-b border-slate-100 pb-3 text-lg font-extrabold text-slate-800">
                <History className="w-5 h-5 text-kaist-greygreen" />
                기존 처리 기록
              </h2>

              <p className="rounded-xl border border-amber-100 bg-amber-50/70 px-3 py-2 text-xs font-semibold leading-5 text-amber-900">
                과거의 SUCCESS 표시는 시스템 처리 기록일 뿐, 실제 메일 전달 성공을 증명하지
                않습니다.
              </p>

              {historyLoading ? (
                historySkeleton
              ) : historyError ? (
                <div className="rounded-xl border border-red-100 bg-red-50 px-3 py-4 text-center text-xs font-semibold text-red-700">
                  {historyError}
                </div>
              ) : history.length === 0 ? (
                <div className="py-8 text-center text-sm font-semibold text-slate-400">기존 처리 기록이 없습니다.</div>
              ) : (
                <div className="space-y-4 max-h-[500px] overflow-y-auto pr-1">
                  {history.map((record) => {
                    const statusPresentation = getHistoryStatusPresentation(record.status);

                    return (
                      <div
                        key={record.id}
                        className="space-y-2 rounded-2xl border border-slate-100 bg-slate-50/30 p-4 transition-all hover:border-kaist-darkgreen/15"
                      >
                        <div className="flex justify-between items-start gap-2">
                          <span
                            className={`rounded-md border px-2 py-0.5 text-[10px] font-extrabold ${statusPresentation.className}`}
                          >
                            {statusPresentation.label}
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
                            대상 산정: {record.recipientCount}명
                          </span>
                          {record.senderName && (
                            <span className="font-medium">요청: {record.senderName}</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
