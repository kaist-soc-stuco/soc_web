import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import type {
  ArticleDraftListResponse,
  ArticleDraftRecord,
  ArticleDraftSaveRequest,
} from "@soc/contracts";
import { ArticleDraftSaveSchema } from "@soc/contracts";
import { Request } from "express";

import { AuthGuard } from "../auth/guards";
import { ZodValidationPipe } from "../../shared/pipes/zod-validation.pipe";
import { ArticleDraftService } from "./article-draft.service";

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    permission: number;
    roleGroupIds?: number[];
  };
}

@Controller("drafts")
@UseGuards(AuthGuard)
export class ArticleDraftController {
  constructor(private readonly articleDraftService: ArticleDraftService) {}

  @Get()
  async list(
    @Req() request: AuthenticatedRequest,
    @Query("page", new ParseIntPipe({ optional: true })) page?: number,
    @Query("limit", new ParseIntPipe({ optional: true })) limit?: number,
    @Query("boardCode") boardCode?: string,
  ): Promise<ArticleDraftListResponse> {
    return this.articleDraftService.list(request.user!, {
      boardCode,
      limit,
      page,
    });
  }

  @Get(":draftId")
  async get(
    @Param("draftId") draftId: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<ArticleDraftRecord> {
    return this.articleDraftService.get(draftId, request.user!);
  }

  @Post()
  async create(
    @Body(new ZodValidationPipe(ArticleDraftSaveSchema))
    body: ArticleDraftSaveRequest,
    @Req() request: AuthenticatedRequest,
  ): Promise<ArticleDraftRecord> {
    return this.articleDraftService.save(body, request.user!);
  }

  @Post(":draftId")
  async update(
    @Param("draftId") draftId: string,
    @Body(new ZodValidationPipe(ArticleDraftSaveSchema))
    body: ArticleDraftSaveRequest,
    @Req() request: AuthenticatedRequest,
  ): Promise<ArticleDraftRecord> {
    return this.articleDraftService.save(
      { ...body, draftId },
      request.user!,
    );
  }

  @Delete(":draftId")
  async delete(
    @Param("draftId") draftId: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<{ ok: true }> {
    return this.articleDraftService.delete(draftId, request.user!);
  }
}
