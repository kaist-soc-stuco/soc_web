import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Req,
} from "@nestjs/common";
import {
  CreateContentBlockSchema,
  Permissions,
  SiteContentKeySchema,
  UpdateContentBlockSchema,
  UpsertSiteContentSchema,
} from "@soc/contracts";
import type {
  AdminSiteContentListResponse,
  ContentBlockListResponse,
  ContentBlockRecord,
  CreateContentBlockRequest,
  SiteContentKey,
  SiteContentListResponse,
  SiteContentRecord,
  UpdateContentBlockRequest,
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

  @Get("blocks/admin")
  @RequirePermissions(Permissions.MANAGE_CONTENT)
  async listContentBlocksAdmin(): Promise<ContentBlockListResponse> {
    return { items: await this.siteContentService.listContentBlocksAdmin() };
  }

  @Get("blocks/public")
  async listContentBlocksPublic(): Promise<ContentBlockListResponse> {
    return { items: await this.siteContentService.listContentBlocksPublic() };
  }

  @Post("blocks")
  @RequirePermissions(Permissions.MANAGE_CONTENT)
  async createContentBlock(
    @Body(new ZodValidationPipe(CreateContentBlockSchema)) body: CreateContentBlockRequest,
    @Req() request: AuthenticatedRequest,
  ): Promise<ContentBlockRecord> {
    return this.siteContentService.createContentBlock(body, {
      actorUserId: request.user!.id,
      ipAddress: request.ip,
    });
  }

  @Patch("blocks/:contentBlockId")
  @RequirePermissions(Permissions.MANAGE_CONTENT)
  async updateContentBlock(
    @Param("contentBlockId", ParseUUIDPipe) contentBlockId: string,
    @Body(new ZodValidationPipe(UpdateContentBlockSchema)) body: UpdateContentBlockRequest,
    @Req() request: AuthenticatedRequest,
  ): Promise<ContentBlockRecord> {
    return this.siteContentService.updateContentBlock(contentBlockId, body, {
      actorUserId: request.user!.id,
      ipAddress: request.ip,
    });
  }

  @Post("blocks/:contentBlockId/publish")
  @RequirePermissions(Permissions.MANAGE_CONTENT)
  async publishContentBlock(
    @Param("contentBlockId", ParseUUIDPipe) contentBlockId: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<ContentBlockRecord> {
    return this.siteContentService.setContentBlockStatus(contentBlockId, "PUBLISHED", {
      actorUserId: request.user!.id,
      ipAddress: request.ip,
    });
  }

  @Post("blocks/:contentBlockId/archive")
  @RequirePermissions(Permissions.MANAGE_CONTENT)
  async archiveContentBlock(
    @Param("contentBlockId", ParseUUIDPipe) contentBlockId: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<ContentBlockRecord> {
    return this.siteContentService.setContentBlockStatus(contentBlockId, "ARCHIVED", {
      actorUserId: request.user!.id,
      ipAddress: request.ip,
    });
  }

  @Delete("blocks/:contentBlockId")
  @HttpCode(204)
  @RequirePermissions(Permissions.MANAGE_CONTENT)
  async deleteContentBlock(
    @Param("contentBlockId", ParseUUIDPipe) contentBlockId: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<void> {
    await this.siteContentService.deleteContentBlock(contentBlockId, {
      actorUserId: request.user!.id,
      ipAddress: request.ip,
    });
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
