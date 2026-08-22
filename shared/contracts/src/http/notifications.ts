export type NotificationType = "COMMENT_ON_ARTICLE" | "REPLY_TO_COMMENT" | "SYSTEM";

export interface NotificationRecord {
  notificationId: string;
  type: NotificationType;
  titleKo: string;
  bodyKo: string | null;
  link: string | null;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
}

export interface NotificationListResponse {
  items: NotificationRecord[];
  page: number;
  pageSize: number;
  total: number;
  unreadCount: number;
}

export interface NotificationReadResponse {
  notificationId: string;
  isRead: true;
  readAt: string;
}

export interface NotificationReadAllResponse {
  updatedCount: number;
  readAt: string;
}
