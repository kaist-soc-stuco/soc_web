import { isIP } from "node:net";

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

export function normalizeAuditIp(value: string | null | undefined): string | null {
  if (!value) return null;
  const address = value.trim().replace(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i, "$1");
  return isIP(address) ? address : null;
}

export function auditMetadataFromRequest(request: AuditRequestLike): AuditMetadata {
  return {
    actorUserId: request.user?.id ?? null,
    ipAddress: normalizeAuditIp(request.ip),
  };
}
