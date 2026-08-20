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
  deliveryMode: "sent" | "dry_run";
}

export interface BulkEmailListResponse {
  items: BulkEmailRecord[];
}

export interface BulkEmailTemplate {
  id: string;
  name: string;
  description: string;
  subject: string;
  content: string;
  recipientType: SendBulkEmailRequest["recipientType"];
}

export interface BulkEmailTemplateListResponse {
  items: BulkEmailTemplate[];
}
