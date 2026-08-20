import { Body, Controller, Get, Post, Req } from "@nestjs/common";
import { SendBulkEmailSchema } from "@soc/contracts";
import { Permissions } from "@soc/contracts";
import { RequirePermissions } from "../auth/guards";
import { ZodValidationPipe } from "../../shared/pipes/zod-validation.pipe";
import { BulkEmailService } from "./bulk-email.service";
import type { Request } from "express";
import type { BulkEmailListResponse, SendBulkEmailRequest, SendBulkEmailResponse } from "@soc/contracts";

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
    return { items: this.bulkEmailService.getTemplates() };
  }

  @Post("send")
  @RequirePermissions(Permissions.ADMIN)
  async sendBulkEmail(
    @Req() req: AuthedRequest,
    @Body(new ZodValidationPipe(SendBulkEmailSchema)) body: SendBulkEmailRequest,
  ): Promise<SendBulkEmailResponse> {
    return this.bulkEmailService.sendBulkEmail(req.user.id, body);
  }
}
