import type { z } from "zod";
import type {
  CreateBulkEmailTemplateSchema,
  SaveBulkEmailDraftSchema,
  SendBulkEmailSchema,
  UpdateBulkEmailTemplateSchema,
} from "../schemas.js";

export type BulkEmailStatus =
  | "DRAFT"
  | "SCHEDULED"
  | "PENDING"
  | "SUCCESS"
  | "DRY_RUN"
  | "FAILED"
  | "CANCELLED";

export interface BulkEmailRecord {
  id: string;
  subject: string;
  content: string;
  contentType: "plain" | "html";
  recipientType: "ALL" | "PAID_STUDENTS" | "UNPAID_STUDENTS";
  filters: Record<string, string>;
  attachmentCount: number;
  senderId: string | null;
  senderName?: string;
  recipientCount: number;
  status: BulkEmailStatus;
  scheduledAt: string | null;
  updatedAt: string;
  sentAt: string;
}

export type SendBulkEmailRequest = z.infer<typeof SendBulkEmailSchema>;
export type SaveBulkEmailDraftRequest = z.infer<typeof SaveBulkEmailDraftSchema>;

export interface SendBulkEmailResponse {
  success: boolean;
  recipientCount: number;
  emailId: string;
  deliveryMode: "sent" | "dry_run" | "scheduled";
}

export interface SendBulkEmailTestResponse {
  success: boolean;
  recipientEmail: string;
  deliveryMode: "sent" | "dry_run";
}

export interface BulkEmailPreviewResponse {
  recipientCount: number;
  sample: Array<{ nameKo: string; email: string }>;
}

export interface BulkEmailListResponse {
  items: BulkEmailRecord[];
}

export interface BulkEmailDraftListResponse {
  items: BulkEmailRecord[];
}

export interface BulkEmailTemplate {
  id: string;
  name: string;
  description: string;
  subject: string;
  content: string;
  contentType: "plain" | "html";
  recipientType: SendBulkEmailRequest["recipientType"];
  filters: NonNullable<SendBulkEmailRequest["filters"]>;
  createdBy: string | null;
  updatedAt: string;
}

export interface BulkEmailTemplateListResponse {
  items: BulkEmailTemplate[];
}

export type CreateBulkEmailTemplateRequest = z.infer<
  typeof CreateBulkEmailTemplateSchema
>;
export type UpdateBulkEmailTemplateRequest = z.infer<
  typeof UpdateBulkEmailTemplateSchema
>;
