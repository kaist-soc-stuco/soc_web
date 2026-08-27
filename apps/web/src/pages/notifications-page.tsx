import { createApiClient } from "@soc/api-client";
import type { NotificationRecord } from "@soc/contracts";
import { isoToDate } from "@soc/shared";
import { Bell, CheckCheck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { Header } from "@/components/organisms/header";
import { Button } from "@/components/ui/button";
import { PageSizeSelect, Pagination } from "@/components/ui/pagination";
import {
  DataViewCard,
  PageContainer,
  PageHeader,
  PageMain,
  PageShell,
} from "@/components/ui/page-layout";
import { TableSkeleton } from "@/components/ui/skeleton";
import { useLanguage } from "@/hooks/use-language";
import { resolveApiBaseUrl } from "@/lib/api-base-url";

function formatNotificationTime(value: string, lang: string) {
  const date = isoToDate(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(lang === "ko" ? "ko-KR" : "en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function NotificationsPage() {
  const apiClient = useMemo(() => createApiClient({ baseUrl: resolveApiBaseUrl() }), []);
  const navigate = useNavigate();
  const { lang } = useLanguage();
  const [items, setItems] = useState<NotificationRecord[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [total, setTotal] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(false);
    try {
      const response = await apiClient.getNotifications({ page, pageSize });
      setItems(response.items);
      setTotal(response.total);
      setUnreadCount(response.unreadCount);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [page, pageSize]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const rangeStart = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(total, page * pageSize);

  const openNotification = async (notification: NotificationRecord) => {
    if (!notification.isRead) {
      await apiClient.markNotificationRead(notification.notificationId);
      setItems((current) => current.map((item) => item.notificationId === notification.notificationId ? { ...item, isRead: true } : item));
      setUnreadCount((current) => Math.max(0, current - 1));
    }
    if (notification.link) navigate(notification.link);
  };

  return (
    <PageShell>
      <Header />
      <PageMain>
        <PageHeader
          title={lang === "ko" ? "알림" : "Notifications"}
          actions={(
            <Button
              type="button"
              variant="outline"
              disabled={unreadCount === 0}
              onClick={() => void apiClient.markAllNotificationsRead().then(() => {
                setItems((current) => current.map((item) => ({ ...item, isRead: true })));
                setUnreadCount(0);
              })}
            >
              <CheckCheck className="size-4" aria-hidden="true" />
              {lang === "ko" ? "모두 읽음" : "Mark all read"}
            </Button>
          )}
        />
        <PageContainer className="pb-20">
          <DataViewCard>
            {loading && items.length === 0 ? (
              <TableSkeleton columns={1} rows={8} />
            ) : error ? (
              <div className="px-5 py-16 text-center text-sm font-normal text-rose-600">
                {lang === "ko" ? "알림을 불러오지 못했습니다." : "Failed to load notifications."}
              </div>
            ) : items.length === 0 ? (
              <div className="flex min-h-64 flex-col items-center justify-center gap-3 px-5 text-center">
                <Bell className="size-5 text-slate-400" aria-hidden="true" />
                <p className="text-sm font-normal text-app-text-muted">
                  {lang === "ko" ? "받은 알림이 없습니다." : "You have no notifications."}
                </p>
              </div>
            ) : (
              <ul>
                {items.map((notification) => (
                  <li key={notification.notificationId} className="border-b border-slate-100 last:border-b-0">
                    <button
                      type="button"
                      onClick={() => void openNotification(notification)}
                      className={`flex w-full items-start gap-3 px-5 py-4 text-left transition-colors hover:bg-slate-50 ${notification.isRead ? "bg-white" : "bg-emerald-50/40"}`}
                    >
                      <span className={`mt-1.5 size-2 shrink-0 rounded-full ${notification.isRead ? "bg-slate-200" : "bg-brand-primary"}`} aria-hidden="true" />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium text-app-text-strong">{notification.titleKo}</span>
                        {notification.bodyKo ? <span className="mt-1 block text-sm font-normal text-app-text-body">{notification.bodyKo}</span> : null}
                        <time className="mt-1.5 block text-xs font-normal text-app-text-muted" dateTime={notification.createdAt}>
                          {formatNotificationTime(notification.createdAt, lang)}
                        </time>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {total > 0 ? (
              <Pagination
                currentPage={page}
                totalPages={totalPages}
                onPageChange={setPage}
                pageSizeControl={<PageSizeSelect value={pageSize} onChange={(value) => { setPageSize(value); setPage(1); }} />}
                range={lang === "ko" ? `전체 ${total}건 중 ${rangeStart}-${rangeEnd}` : `${rangeStart}-${rangeEnd} of ${total}`}
              />
            ) : null}
          </DataViewCard>
        </PageContainer>
      </PageMain>
    </PageShell>
  );
}
