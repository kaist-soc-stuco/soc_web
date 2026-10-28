import { Body, Controller, ForbiddenException, Get, Post, Req } from "@nestjs/common";
import { Permissions } from "@soc/contracts";
import { isoToDate, nowDate } from "@soc/shared";
import type { Request } from "express";
import { z } from "zod";
import { RequirePermissions } from "../auth/guards";
import { ZodValidationPipe } from "../../shared/pipes/zod-validation.pipe";
import { AuditLogService } from "../audit/audit-log.service";
import { FinalizeRetentionSchema, RetentionHoldSchema, type FinalizeRetentionInput, type RetentionKind } from "./retention-policy";
import { RetentionRepository } from "./retention.repository";
import { RetentionService } from "./retention.service";

interface AdminRequest extends Request { user?: { id: string; permission: number } }
const domainPermission: Record<RetentionKind, number> = {
  SURVEY: Permissions.MANAGE_SURVEY,
  APPLICATION: Permissions.MANAGE_SURVEY,
  VOTE: Permissions.MANAGE_VOTE,
  FEE_PAYMENT: Permissions.MANAGE_FINANCE,
  CONTACT: Permissions.MANAGE_CONTACTS,
};
const RunSchema = z.object({ dryRun: z.boolean().default(true) }).strict();

@Controller("admin/privacy-retention")
@RequirePermissions(Permissions.MANAGE_USERS, Permissions.MANAGE_ROLES)
export class RetentionController {
  constructor(private readonly repository: RetentionRepository, private readonly service: RetentionService, private readonly audit: AuditLogService) {}

  @Get()
  list() { return this.repository.list(); }

  @Post("finalize")
  async finalize(@Body(new ZodValidationPipe(FinalizeRetentionSchema)) body: FinalizeRetentionInput, @Req() request: AdminRequest) {
    if (!Permissions.has(request.user!.permission, domainPermission[body.kind])) throw new ForbiddenException("insufficient_permission");
    const result = await this.repository.finalize(body, request.user!.id, nowDate());
    await this.audit.record({ action: "privacy_retention.finalize", actorUserId: request.user!.id, targetType: "privacy_retention", targetId: body.resourceId, payload: { kind: body.kind, expiresAt: result.expires_at }, ipAddress: request.ip });
    return result;
  }

  @Post("hold")
  async hold(@Body(new ZodValidationPipe(RetentionHoldSchema)) body: z.infer<typeof RetentionHoldSchema>, @Req() request: AdminRequest) {
    if (!Permissions.has(request.user!.permission, domainPermission[body.kind])) throw new ForbiddenException("insufficient_permission");
    const result = await this.repository.setHold(body.kind, body.resourceId, body.holdUntil ? isoToDate(body.holdUntil) : null, body.reason, nowDate());
    await this.audit.record({ action: "privacy_retention.hold", actorUserId: request.user!.id, targetType: "privacy_retention", targetId: body.resourceId, payload: { kind: body.kind, holdUntil: body.holdUntil }, ipAddress: request.ip });
    return result;
  }

  @Post("run")
  @RequirePermissions(Permissions.MANAGE_USERS, Permissions.MANAGE_ROLES, Permissions.MANAGE_SURVEY, Permissions.MANAGE_VOTE, Permissions.MANAGE_FINANCE, Permissions.MANAGE_CONTACTS)
  async run(@Body(new ZodValidationPipe(RunSchema)) body: z.infer<typeof RunSchema>, @Req() request: AdminRequest) {
    const result = await this.service.run(body.dryRun);
    await this.audit.record({ action: "privacy_retention.run", actorUserId: request.user!.id, targetType: "privacy_retention", targetId: "scheduled-records", payload: { dryRun: body.dryRun, drafts: result.drafts, logs: result.auditLogs, cases: result.cases.length }, ipAddress: request.ip });
    return result;
  }
}
