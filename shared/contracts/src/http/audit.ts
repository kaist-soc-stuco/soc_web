export interface AuditLogRecord {
  auditLogId: number;
  actorUserId: string | null;
  actorNameKo: string | null;
  action: string;
  targetType: string;
  targetId: string | null;
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
