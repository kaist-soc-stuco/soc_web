import { BadRequestException, Body, Controller, ForbiddenException, Get, Inject, Param, Post, Query, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";

import { AuthGuard } from "../../shared/guards";
import type { PermissionChangeAction, PermissionScope } from "./permission.types";
import { PermissionsService } from "./permissions.service";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PERMISSION_KEY_PATTERN = /^[A-Z][A-Z0-9_]{1,63}$/;
const REASON_CODE_PATTERN = /^[A-Z][A-Z0-9_]{1,63}$/;
const REQUEST_KEYS = ["targetUserId", "action", "permission", "scope", "scopeId", "reasonCode"] as const;
const REASON_KEYS = ["reasonCode"] as const;
const AUDIT_QUERY_KEYS = ["limit", "cursor"] as const;
const QUEUE_QUERY_KEYS = ["stage", "limit", "cursor"] as const;

type AuthenticatedRequest = Request & { user: { id: string } };
type PermissionRequestBody = {
  targetUserId: string;
  action: PermissionChangeAction;
  permission: string;
  scope: PermissionScope;
  scopeId?: string;
  reasonCode: string;
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function hasOnlyKeys(value: Record<string, unknown>, allowedKeys: readonly string[]): boolean {
  return Object.keys(value).every((key) => allowedKeys.includes(key));
}

function validateRequestBody(body: unknown): PermissionRequestBody {
  if (
    !isPlainObject(body)
    || !hasOnlyKeys(body, REQUEST_KEYS)
    || typeof body.targetUserId !== "string"
    || !UUID_PATTERN.test(body.targetUserId)
    || (body.action !== "GRANT" && body.action !== "REVOKE")
    || typeof body.permission !== "string"
    || !PERMISSION_KEY_PATTERN.test(body.permission)
    || (body.scope !== "GLOBAL" && body.scope !== "BOARD" && body.scope !== "EVENT" && body.scope !== "SURVEY")
    || typeof body.reasonCode !== "string"
    || !REASON_CODE_PATTERN.test(body.reasonCode)
    || (body.scope === "GLOBAL" ? body.scopeId !== undefined : typeof body.scopeId !== "string" || body.scopeId.length === 0 || body.scopeId !== body.scopeId.trim())
  ) {
    throw new BadRequestException("invalid_permission_request");
  }

  return body as PermissionRequestBody;
}

function validateReasonBody(body: unknown): string {
  if (
    !isPlainObject(body)
    || !hasOnlyKeys(body, REASON_KEYS)
    || typeof body.reasonCode !== "string"
    || !REASON_CODE_PATTERN.test(body.reasonCode)
  ) {
    throw new BadRequestException("reason_code_required");
  }

  return body.reasonCode;
}

function validateUuid(value: string): string {
  if (!UUID_PATTERN.test(value)) throw new BadRequestException("invalid_permission_request_id");
  return value;
}

function validateAuditQuery(query: unknown): { limit?: number; cursor?: string } {
  if (!isPlainObject(query) || !hasOnlyKeys(query, AUDIT_QUERY_KEYS)) throw new BadRequestException("invalid_audit_query");

  const { cursor, limit } = query;
  if (cursor !== undefined && (typeof cursor !== "string" || cursor.length === 0)) {
    throw new BadRequestException("invalid_audit_query");
  }
  if (limit === undefined) return { cursor };

  if (typeof limit !== "string" || !/^(?:[1-9]|[1-9][0-9]|100)$/.test(limit)) {
    throw new BadRequestException("invalid_audit_query");
  }

  return { cursor, limit: Number(limit) };
}
function validateQueueQuery(query: unknown): { stage: "REQUESTED" | "APPROVAL" | "ACTIVATION"; limit?: number; cursor?: string } {
  if (!isPlainObject(query) || !hasOnlyKeys(query, QUEUE_QUERY_KEYS)) throw new BadRequestException("invalid_permission_queue_query");

  const { cursor, limit, stage } = query;
  if (stage !== "REQUESTED" && stage !== "APPROVAL" && stage !== "ACTIVATION") {
    throw new BadRequestException("invalid_permission_queue_query");
  }
  if (cursor !== undefined && (typeof cursor !== "string" || cursor.length === 0)) {
    throw new BadRequestException("invalid_permission_queue_query");
  }
  if (limit === undefined) return { stage, cursor };
  if (typeof limit !== "string" || !/^(?:[1-9]|[1-9][0-9]|100)$/.test(limit)) {
    throw new BadRequestException("invalid_permission_queue_query");
  }
  return { stage, cursor, limit: Number(limit) };
}


function requireOperationsEnabled(): void {
  if (process.env.AUTHORIZATION_OPERATIONS_ENABLED !== "true") {
    throw new ForbiddenException("authorization_operations_disabled");
  }
}

@Controller("permissions")
@UseGuards(AuthGuard)
export class PermissionsController {
  constructor(@Inject(PermissionsService) private readonly permissionsService: PermissionsService) {}

  @Post("requests")
  async request(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    return this.permissionsService.request(request.user.id, validateRequestBody(body));
  }

  @Post("requests/:requestId/approve")
  async approve(@Req() request: AuthenticatedRequest, @Param("requestId") requestId: string, @Body() body: unknown) {
    return this.permissionsService.approve(request.user.id, validateUuid(requestId), validateReasonBody(body));
  }

  @Post("requests/:requestId/activate")
  async activate(@Req() request: AuthenticatedRequest, @Param("requestId") requestId: string, @Body() body: unknown) {
    return this.permissionsService.activate(request.user.id, validateUuid(requestId), validateReasonBody(body));
  }

  @Post("bootstrap")
  async bootstrap(@Req() request: AuthenticatedRequest) {
    requireOperationsEnabled();
    return { completed: await this.permissionsService.bootstrap(request.user.id) };
  }

  @Post("backfill/legacy")
  async backfillLegacy(@Req() request: AuthenticatedRequest) {
    requireOperationsEnabled();
    return this.permissionsService.backfillLegacyPermissions(request.user.id);
  }

  @Get("definitions")
  async definitions(@Req() request: AuthenticatedRequest) {
    return this.permissionsService.listDefinitions(request.user.id);
  }

  @Get("requests")
  async requests(@Req() request: AuthenticatedRequest, @Query() query: unknown) {
    const { stage, limit, cursor } = validateQueueQuery(query);
    return this.permissionsService.listRequests(request.user.id, stage, limit, cursor);
  }
  @Get("audit")
  async audit(@Req() request: AuthenticatedRequest, @Query() query: unknown) {
    if (!(await this.permissionsService.hasPermission(request.user.id, "PERMISSION_AUDIT", "GLOBAL"))) throw new ForbiddenException("insufficient_permission");
    const { limit, cursor } = validateAuditQuery(query);
    return this.permissionsService.listAudit(limit, cursor);
  }
}
