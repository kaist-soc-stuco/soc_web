import type { z } from "zod";
import type { SendBulkEmailSchema } from "../schemas.js";

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

export type SendBulkEmailRequest = z.infer<typeof SendBulkEmailSchema>;

export interface SendBulkEmailResponse {
  success: boolean;
  recipientCount: number;
  emailId: string;
}

export interface BulkEmailListResponse {
  items: BulkEmailRecord[];
}
