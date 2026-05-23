export interface BulkEmailRecord {
  id: string;
  subject: string;
  content: string;
  senderId: string | null;
  senderName?: string;
  recipientCount: number;
  status: string;
  sentAt: string;
}

export interface SendBulkEmailRequest {
  subject: string;
  content: string;
  recipientType: "ALL" | "PAID_STUDENTS" | "UNPAID_STUDENTS";
}

export interface SendBulkEmailResponse {
  success: boolean;
  recipientCount: number;
  emailId: string;
}

export interface BulkEmailListResponse {
  items: BulkEmailRecord[];
}
