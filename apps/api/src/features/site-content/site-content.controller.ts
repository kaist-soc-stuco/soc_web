import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Put,
  Req,
} from "@nestjs/common";
import {
  Permissions,
  SiteContentKeySchema,
  UpsertSiteContentSchema,
} from "@soc/contracts";
import type {
  AdminSiteContentListResponse,
  SiteContentKey,
  SiteContentListResponse,
  SiteContentRecord,
  UpsertSiteContentRequest,
} from "@soc/contracts";
import type { Request } from "express";

import { RequirePermissions } from "../auth/guards";
import { ZodValidationPipe } from "../../shared/pipes/zod-validation.pipe";
import { SiteContentService } from "./site-content.service";

interface AuthenticatedRequest extends Request {
  user?: { id: string; permission: number };
}

@Controller("site-content")
export class SiteContentController {
  constructor(private readonly siteContentService: SiteContentService) {}

  @Get("admin")
  @RequirePermissions(Permissions.MANAGE_CONTENT)
  async listAdmin(): Promise<AdminSiteContentListResponse> {
    return { items: await this.siteContentService.listAdmin() };
  }

  @Get()
  async listPublic(): Promise<SiteContentListResponse> {
    return { items: await this.siteContentService.listPublic() };
  }

  @Put(":key")
  @RequirePermissions(Permissions.MANAGE_CONTENT)
  async upsert(
    @Param("key", new ZodValidationPipe(SiteContentKeySchema))
    key: SiteContentKey,
    @Body(new ZodValidationPipe(UpsertSiteContentSchema))
    body: UpsertSiteContentRequest,
    @Req() request: AuthenticatedRequest,
  ): Promise<SiteContentRecord> {
    return this.siteContentService.upsert(key, body, {
      actorUserId: request.user!.id,
      ipAddress: request.ip,
    });
  }

  @Delete(":key")
  @HttpCode(204)
  @RequirePermissions(Permissions.MANAGE_CONTENT)
  async delete(
    @Param("key", new ZodValidationPipe(SiteContentKeySchema))
    key: SiteContentKey,
    @Req() request: AuthenticatedRequest,
  ): Promise<void> {
    await this.siteContentService.delete(key, {
      actorUserId: request.user!.id,
      ipAddress: request.ip,
    });
  }
}
