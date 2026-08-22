export type AuditLogEventKind = "UPDATE" | "EXECUTE" | "BATCH" | "CREATE" | "DELETE" | "OTHER";

export interface AuditLogRecord {
  auditLogId: number;
  actorUserId: string | null;
  actorNameKo: string | null;
  action: string;
  actionLabel: string;
  domain: string;
  domainLabel: string;
  eventKind: AuditLogEventKind;
  targetType: string;
  targetId: string | null;
  targetLabel: string;
  payload: string | null;
  ipAddress: string | null;
  createdAt: string;
}

export interface AuditLogListResponse {
  items: AuditLogRecord[];
  page: number;
  pageSize: number;
  total: number;
}
