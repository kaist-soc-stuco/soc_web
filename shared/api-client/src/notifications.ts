import type {
  NotificationListResponse,
  NotificationReadAllResponse,
  NotificationReadResponse,
} from "@soc/contracts";

import type { ApiClientContext } from "./core.js";

export const createNotificationsApi = ({
  notificationsBaseUrl,
  requestJson,
}: ApiClientContext) => ({
  getNotifications: async (options?: {
    page?: number;
    pageSize?: number;
  }): Promise<NotificationListResponse> => {
    const params = new URLSearchParams();
    if (options?.page !== undefined) params.set("page", String(options.page));
    if (options?.pageSize !== undefined) {
      params.set("pageSize", String(options.pageSize));
    }

    return requestJson<NotificationListResponse>(
      `${notificationsBaseUrl}${params.toString() ? `?${params.toString()}` : ""}`,
      { method: "GET" },
      { retryOnUnauthorized: true },
    );
  },

  markNotificationRead: async (
    notificationId: string,
  ): Promise<NotificationReadResponse> => {
    return requestJson<NotificationReadResponse>(
      `${notificationsBaseUrl}/${encodeURIComponent(notificationId)}/read`,
      { method: "PATCH" },
      { retryOnUnauthorized: true },
    );
  },

  markAllNotificationsRead: async (): Promise<NotificationReadAllResponse> => {
    return requestJson<NotificationReadAllResponse>(
      `${notificationsBaseUrl}/read-all`,
      { method: "PATCH" },
      { retryOnUnauthorized: true },
    );
  },
});
