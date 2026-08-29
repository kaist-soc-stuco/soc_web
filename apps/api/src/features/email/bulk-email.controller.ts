import { Body, Controller, Delete, Get, Param, Patch, Post, Req } from "@nestjs/common";
import {
  CreateBulkEmailTemplateSchema,
  SaveBulkEmailDraftSchema,
  SendBulkEmailSchema,
  UpdateBulkEmailTemplateSchema,
} from "@soc/contracts";
import { Permissions } from "@soc/contracts";
import { RequirePermissions } from "../auth/guards";
import { auditMetadataFromRequest } from "../audit/audit-context";
import { ZodValidationPipe } from "../../shared/pipes/zod-validation.pipe";
import { BulkEmailService } from "./bulk-email.service";
import type { Request } from "express";
import type {
  BulkEmailDraftListResponse,
  BulkEmailListResponse,
  BulkEmailPreviewResponse,
  BulkEmailRecord,
  SaveBulkEmailDraftRequest,
  SendBulkEmailRequest,
  SendBulkEmailResponse,
  SendBulkEmailTestResponse,
  CreateBulkEmailTemplateRequest,
  UpdateBulkEmailTemplateRequest,
} from "@soc/contracts";

interface AuthedRequest extends Request {
  user: { id: string; permission: number };
}

@Controller("admin/emails")
export class BulkEmailController {
  constructor(private readonly bulkEmailService: BulkEmailService) {}

  @Get("history")
  @RequirePermissions(Permissions.SEND_BULK_EMAIL)
  async getHistory(): Promise<BulkEmailListResponse> {
    const items = await this.bulkEmailService.getHistory();
    return { items };
  }

  @Get("templates")
  @RequirePermissions(Permissions.SEND_BULK_EMAIL)
  async getTemplates() {
    return { items: await this.bulkEmailService.getTemplates() };
  }

  @Post("templates")
  @RequirePermissions(Permissions.SEND_BULK_EMAIL)
  async createTemplate(
    @Req() req: AuthedRequest,
    @Body(new ZodValidationPipe(CreateBulkEmailTemplateSchema)) body: CreateBulkEmailTemplateRequest,
  ) {
    return this.bulkEmailService.createTemplate(req.user.id, body, auditMetadataFromRequest(req));
  }

  @Patch("templates/:templateId")
  @RequirePermissions(Permissions.SEND_BULK_EMAIL)
  async updateTemplate(
    @Req() req: AuthedRequest,
    @Param("templateId") templateId: string,
    @Body(new ZodValidationPipe(UpdateBulkEmailTemplateSchema)) body: UpdateBulkEmailTemplateRequest,
  ) {
    return this.bulkEmailService.updateTemplate(templateId, body, auditMetadataFromRequest(req));
  }

  @Delete("templates/:templateId")
  @RequirePermissions(Permissions.SEND_BULK_EMAIL)
  async deleteTemplate(@Req() req: AuthedRequest, @Param("templateId") templateId: string) {
    return this.bulkEmailService.deleteTemplate(templateId, auditMetadataFromRequest(req));
  }

  @Get("drafts")
  @RequirePermissions(Permissions.SEND_BULK_EMAIL)
  async getDrafts(@Req() req: AuthedRequest): Promise<BulkEmailDraftListResponse> {
    return this.bulkEmailService.getDrafts(req.user.id);
  }

  @Post("drafts")
  @RequirePermissions(Permissions.SEND_BULK_EMAIL)
  async saveDraft(
    @Req() req: AuthedRequest,
    @Body(new ZodValidationPipe(SaveBulkEmailDraftSchema)) body: SaveBulkEmailDraftRequest,
  ): Promise<BulkEmailRecord> {
    return this.bulkEmailService.saveDraft(req.user.id, body, auditMetadataFromRequest(req));
  }

  @Delete("drafts/:draftId")
  @RequirePermissions(Permissions.SEND_BULK_EMAIL)
  async deleteDraft(
    @Req() req: AuthedRequest,
    @Param("draftId") draftId: string,
  ): Promise<{ success: boolean }> {
    return this.bulkEmailService.deleteDraft(req.user.id, draftId, auditMetadataFromRequest(req));
  }

  @Post("send")
  @RequirePermissions(Permissions.SEND_BULK_EMAIL)
  async sendBulkEmail(
    @Req() req: AuthedRequest,
    @Body(new ZodValidationPipe(SendBulkEmailSchema)) body: SendBulkEmailRequest,
  ): Promise<SendBulkEmailResponse> {
    return this.bulkEmailService.sendBulkEmail(req.user.id, body, auditMetadataFromRequest(req));
  }

  @Post("test")
  @RequirePermissions(Permissions.SEND_BULK_EMAIL)
  async sendTestEmail(
    @Req() req: AuthedRequest,
    @Body(new ZodValidationPipe(SendBulkEmailSchema)) body: SendBulkEmailRequest,
  ): Promise<SendBulkEmailTestResponse> {
    return this.bulkEmailService.sendTestEmail(req.user.id, body, auditMetadataFromRequest(req));
  }

  @Post(":emailId/cancel")
  @RequirePermissions(Permissions.SEND_BULK_EMAIL)
  async cancelScheduled(
    @Req() req: AuthedRequest,
    @Param("emailId") emailId: string,
  ): Promise<BulkEmailRecord> {
    return this.bulkEmailService.cancelScheduled(req.user.id, emailId, auditMetadataFromRequest(req));
  }

  @Post(":emailId/retry")
  @RequirePermissions(Permissions.SEND_BULK_EMAIL)
  async retryFailed(
    @Req() req: AuthedRequest,
    @Param("emailId") emailId: string,
  ): Promise<SendBulkEmailResponse> {
    return this.bulkEmailService.retryFailed(req.user.id, emailId, auditMetadataFromRequest(req));
  }

  @Post("preview")
  @RequirePermissions(Permissions.SEND_BULK_EMAIL)
  async previewRecipients(
    @Body(new ZodValidationPipe(SendBulkEmailSchema)) body: SendBulkEmailRequest,
  ): Promise<BulkEmailPreviewResponse> {
    return this.bulkEmailService.previewRecipients(body);
  }
}
