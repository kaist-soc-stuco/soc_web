import { Body, Controller, Delete, Get, Param, Patch, Post, Req } from "@nestjs/common";
import {
  CreateBulkEmailTemplateSchema,
  SaveBulkEmailDraftSchema,
  SendBulkEmailSchema,
  UpdateBulkEmailTemplateSchema,
} from "@soc/contracts";
import { Permissions } from "@soc/contracts";
import { RequirePermissions } from "../auth/guards";
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
  @RequirePermissions(Permissions.ADMIN)
  async getHistory(): Promise<BulkEmailListResponse> {
    const items = await this.bulkEmailService.getHistory();
    return { items };
  }

  @Get("templates")
  @RequirePermissions(Permissions.ADMIN)
  async getTemplates() {
    return { items: await this.bulkEmailService.getTemplates() };
  }

  @Post("templates")
  @RequirePermissions(Permissions.ADMIN)
  async createTemplate(
    @Req() req: AuthedRequest,
    @Body(new ZodValidationPipe(CreateBulkEmailTemplateSchema)) body: CreateBulkEmailTemplateRequest,
  ) {
    return this.bulkEmailService.createTemplate(req.user.id, body);
  }

  @Patch("templates/:templateId")
  @RequirePermissions(Permissions.ADMIN)
  async updateTemplate(
    @Param("templateId") templateId: string,
    @Body(new ZodValidationPipe(UpdateBulkEmailTemplateSchema)) body: UpdateBulkEmailTemplateRequest,
  ) {
    return this.bulkEmailService.updateTemplate(templateId, body);
  }

  @Delete("templates/:templateId")
  @RequirePermissions(Permissions.ADMIN)
  async deleteTemplate(@Param("templateId") templateId: string) {
    return this.bulkEmailService.deleteTemplate(templateId);
  }

  @Get("drafts")
  @RequirePermissions(Permissions.ADMIN)
  async getDrafts(@Req() req: AuthedRequest): Promise<BulkEmailDraftListResponse> {
    return this.bulkEmailService.getDrafts(req.user.id);
  }

  @Post("drafts")
  @RequirePermissions(Permissions.ADMIN)
  async saveDraft(
    @Req() req: AuthedRequest,
    @Body(new ZodValidationPipe(SaveBulkEmailDraftSchema)) body: SaveBulkEmailDraftRequest,
  ): Promise<BulkEmailRecord> {
    return this.bulkEmailService.saveDraft(req.user.id, body);
  }

  @Delete("drafts/:draftId")
  @RequirePermissions(Permissions.ADMIN)
  async deleteDraft(
    @Req() req: AuthedRequest,
    @Param("draftId") draftId: string,
  ): Promise<{ success: boolean }> {
    return this.bulkEmailService.deleteDraft(req.user.id, draftId);
  }

  @Post("send")
  @RequirePermissions(Permissions.ADMIN)
  async sendBulkEmail(
    @Req() req: AuthedRequest,
    @Body(new ZodValidationPipe(SendBulkEmailSchema)) body: SendBulkEmailRequest,
  ): Promise<SendBulkEmailResponse> {
    return this.bulkEmailService.sendBulkEmail(req.user.id, body);
  }

  @Post("test")
  @RequirePermissions(Permissions.ADMIN)
  async sendTestEmail(
    @Req() req: AuthedRequest,
    @Body(new ZodValidationPipe(SendBulkEmailSchema)) body: SendBulkEmailRequest,
  ): Promise<SendBulkEmailTestResponse> {
    return this.bulkEmailService.sendTestEmail(req.user.id, body);
  }

  @Post(":emailId/cancel")
  @RequirePermissions(Permissions.ADMIN)
  async cancelScheduled(
    @Req() req: AuthedRequest,
    @Param("emailId") emailId: string,
  ): Promise<BulkEmailRecord> {
    return this.bulkEmailService.cancelScheduled(req.user.id, emailId);
  }

  @Post(":emailId/retry")
  @RequirePermissions(Permissions.ADMIN)
  async retryFailed(
    @Req() req: AuthedRequest,
    @Param("emailId") emailId: string,
  ): Promise<SendBulkEmailResponse> {
    return this.bulkEmailService.retryFailed(req.user.id, emailId);
  }

  @Post("preview")
  @RequirePermissions(Permissions.ADMIN)
  async previewRecipients(
    @Body(new ZodValidationPipe(SendBulkEmailSchema)) body: SendBulkEmailRequest,
  ): Promise<BulkEmailPreviewResponse> {
    return this.bulkEmailService.previewRecipients(body);
  }
}
