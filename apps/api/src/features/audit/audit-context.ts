export interface AuditMetadata {
  actorUserId?: string | null;
  ipAddress?: string | null;
}

export interface AuditRequestLike {
  ip?: string;
  user?: {
    id?: string;
  };
}

export function auditMetadataFromRequest(request: AuditRequestLike): AuditMetadata {
  return {
    actorUserId: request.user?.id ?? null,
    ipAddress: request.ip ?? null,
  };
}
