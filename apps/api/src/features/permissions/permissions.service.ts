import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHash } from "crypto";

import { PermissionChangeActions, PermissionScopeValues, type PermissionChangeAction, type PermissionRequestInput, type PermissionScope } from "./permission.types";
import { PermissionsRepository } from "./permissions.repository";

const BOOTSTRAP_KEYS = ["PERMISSION_GRANT", "PERMISSION_REVOKE", "PERMISSION_APPROVE", "PERMISSION_ACTIVATE"];
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PERMISSION_KEY_PATTERN = /^[A-Z][A-Z0-9_]{1,63}$/;
const REASON_CODE_PATTERN = /^[A-Z][A-Z0-9_]{1,63}$/;

@Injectable()
export class PermissionsService {
  constructor(private readonly repository: PermissionsRepository, private readonly config: ConfigService) {}

  async hasPermission(userId: string, key: string, scope: PermissionScope, scopeId?: string): Promise<boolean> {
    this.validateScope(scope, scopeId);
    return (await this.repository.findEffectivePermission(userId, key, scope, scopeId ?? null)).length > 0;
  }

  async request(actorUserId: string, input: PermissionRequestInput) {
    if (
      !input ||
      typeof input !== "object" ||
      typeof input.targetUserId !== "string" ||
      !UUID_PATTERN.test(input.targetUserId) ||
      typeof input.permission !== "string" ||
      !PERMISSION_KEY_PATTERN.test(input.permission) ||
      typeof input.reasonCode !== "string" ||
      !REASON_CODE_PATTERN.test(input.reasonCode)
    ) {
      throw new BadRequestException("invalid_permission_request");
    }
    this.validateScope(input.scope, input.scopeId);
    if (!PermissionChangeActions.includes(input.action)) throw new BadRequestException("invalid_permission_action");
    const required = input.action === "GRANT" ? "PERMISSION_GRANT" : "PERMISSION_REVOKE";
    await this.requirePermission(actorUserId, required, input.scope, input.scopeId);
    const definition = await this.repository.findDefinition(input.permission);
    if (!definition) throw new NotFoundException("permission_definition_not_found");
    if (!(await this.repository.userExists(input.targetUserId))) {
      throw new NotFoundException("user_not_found");
    }
    const requestHash = this.hash({ action: input.action, permissionDefinitionId: definition.id, reasonCode: input.reasonCode, requesterUserId: actorUserId, scope: input.scope, scopeId: input.scopeId ?? null, targetUserId: input.targetUserId });
    try {
      const created = await this.repository.createRequest({ targetUserId: input.targetUserId, action: input.action, reasonCode: input.reasonCode, permissionDefinitionId: definition.id, scope: input.scope, scopeId: input.scopeId ?? null, requestHash, requesterUserId: actorUserId, authorityKey: required });
      if (!created) throw new ForbiddenException("insufficient_permission");
      return {
        id: created.id,
        requestHash: created.requestHash,
        status: created.status,
        requestedAt: created.requestedAt.toISOString(),
        expiresAt: created.expiresAt.toISOString(),
      };
    } catch (error) {
      if ((error as { code?: string }).code === "23505") {
        throw new ConflictException("permission_request_conflict");
      }
      if ((error as { code?: string }).code === "23503") {
        throw new NotFoundException("user_not_found");
      }
      throw error;
    }
  }

  async approve(actorUserId: string, requestId: string, reasonCode: string) {
    if (typeof reasonCode !== "string" || !REASON_CODE_PATTERN.test(reasonCode)) {
      throw new BadRequestException("reason_code_required");
    }
    const updated = await this.repository.approveRequest(requestId, actorUserId, reasonCode, "PERMISSION_APPROVE");
    if (!updated) throw new ConflictException("permission_request_not_approvable");
    return this.requestResponse(updated, updated);
  }

  async activate(actorUserId: string, requestId: string, reasonCode: string) {
    if (typeof reasonCode !== "string" || !REASON_CODE_PATTERN.test(reasonCode)) {
      throw new BadRequestException("reason_code_required");
    }
    const updated = await this.repository.activateRequest(requestId, actorUserId, reasonCode, "PERMISSION_ACTIVATE");
    if (!updated) throw new ConflictException("permission_request_not_activatable");
    return this.requestResponse(updated, updated);
  }

  async listAudit(limit = 50, cursor?: string) {
    const boundedLimit = Math.min(Math.max(Number.isInteger(limit) ? limit : 50, 1), 100);
    let before: { occurredAt: Date; id: string } | undefined;
    if (cursor) {
      try {
        const parsed = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as { occurredAt?: string; id?: string };
        const occurredAt = new Date(parsed.occurredAt ?? "");
        if (Number.isNaN(occurredAt.valueOf()) || typeof parsed.id !== "string" || !UUID_PATTERN.test(parsed.id)) throw new Error();
        before = { occurredAt, id: parsed.id };
      } catch {
        throw new BadRequestException("invalid_audit_cursor");
      }
    }
    const rows = await this.repository.listAudit(boundedLimit + 1, before);
    const hasMore = rows.length > boundedLimit;
    const items = rows.slice(0, boundedLimit);
    return {
      items: items.map((entry) => ({
        ...entry,
        changedFieldNames: entry.changedFieldNames.split(",").filter(Boolean),
        occurredAt: entry.occurredAt.toISOString(),
      })),
      nextCursor: hasMore
        ? Buffer.from(JSON.stringify({ occurredAt: items.at(-1)!.occurredAt.toISOString(), id: items.at(-1)!.id })).toString("base64url")
        : null,
    };
  }

  async bootstrap(actorUserId: string): Promise<boolean> {
    const configuredSubject = this.config.get<string>("AUTHORIZATION_BOOTSTRAP_SSO_SUBJECT");
    const verifiedSsoSubject = await this.repository.findCanonicalSubject(actorUserId);
    if (
      !configuredSubject ||
      !verifiedSsoSubject ||
      configuredSubject !== verifiedSsoSubject
    ) {
      throw new ForbiddenException("bootstrap_subject_not_authorized");
    }
    const fingerprint = this.hash({
      configuredSubject,
      permissionKeys: [...BOOTSTRAP_KEYS].sort(),
    });
    const completed = await this.repository.bootstrap(
      actorUserId,
      verifiedSsoSubject,
      fingerprint,
      BOOTSTRAP_KEYS,
    );
    if (!completed) {
      throw new ConflictException("authorization_bootstrap_refused");
    }
    return true;
  }

  async backfillLegacyPermissions(actorUserId?: string) {
    if (actorUserId) {
      await this.requirePermission(actorUserId, "PERMISSION_ACTIVATE", "GLOBAL");
    }
    return this.repository.backfillLegacyPermissions();
  }

  private async requirePermission(userId: string, key: string, scope: PermissionScope, scopeId?: string | null) {
    if (!(await this.hasPermission(userId, key, scope, scopeId ?? undefined))) throw new ForbiddenException("insufficient_permission");
  }

  private requestResponse(
    request: {
      id: string;
      action: PermissionChangeAction;
      permission: string;
      scope: PermissionScope;
      scopeId: string | null;
      targetUserId: string;
    },
    updated: {
      status: string;
      requestedAt: Date;
      approvedAt: Date | null;
      activatedAt: Date | null;
      expiresAt: Date;
    },
  ) {
    return {
      id: request.id,
      targetUserId: request.targetUserId,
      action: request.action,
      permission: request.permission,
      scope: request.scope,
      scopeId: request.scopeId,
      status: updated.status,
      requestedAt: updated.requestedAt.toISOString(),
      approvedAt: updated.approvedAt?.toISOString() ?? null,
      activatedAt: updated.activatedAt?.toISOString() ?? null,
      expiresAt: updated.expiresAt.toISOString(),
    };
  }

  private hash(value: Record<string, unknown>): string {
    const canonical = JSON.stringify(Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b))));
    return createHash("sha256").update(canonical).digest("hex");
  }

  private validateScope(scope: PermissionScope, scopeId?: string) {
    if (!PermissionScopeValues.includes(scope)) throw new BadRequestException("invalid_permission_scope");
    if (
      (scope === "GLOBAL") !== !scopeId ||
      (scopeId !== undefined && scopeId !== scopeId.trim())
    ) {
      throw new BadRequestException("invalid_permission_scope");
    }
  }
}
