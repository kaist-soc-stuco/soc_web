import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  ParseIntPipe,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import type {
  CommentCreateRequest,
  CommentCreateResponse,
  CommentDeleteResponse,
  CommentEngagementResponse,
  CommentListResponse,
  CommentModerationRequest,
  CommentModerationResponse,
  CommentUpdateRequest,
  CommentUpdateResponse,
} from "@soc/contracts";
import {
  CommentCreateSchema,
  CommentUpdateSchema,
  ArticleModerationSchema,
} from "@soc/contracts";
import { Request } from "express";

import { AuthGuard } from "../auth/guards";
import { Cookies } from "../../shared/decorators/cookies.decorator";
import { ZodValidationPipe } from "../../shared/pipes/zod-validation.pipe";
import { AUTH_ACCESS_COOKIE_NAME } from "../auth/auth.tokens";
import { AuthSessionService } from "../auth/auth-session.service";
import { CommentService } from "./comment.service";

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    permission: number;
  };
}

@Controller("boards/:code/articles/:articleId/comments")
export class CommentController {
  constructor(
    private readonly commentService: CommentService,
    private readonly authSessionService: AuthSessionService,
  ) {}

  @Get()
  async getComments(
    @Param("code") code: string,
    @Param("articleId") articleId: string,
    @Query("page", new ParseIntPipe({ optional: true })) page?: number,
    @Query("limit", new ParseIntPipe({ optional: true })) limit?: number,
    @Cookies(AUTH_ACCESS_COOKIE_NAME) accessToken?: string,
  ): Promise<CommentListResponse> {
    const currentUser =
      await this.authSessionService.getOptionalCurrentUser(accessToken);
    return this.commentService.getComments(
      code,
      articleId,
      {
        page,
        limit,
      },
      currentUser,
    );
  }

  @Post()
  @UseGuards(AuthGuard)
  async createComment(
    @Param("code") code: string,
    @Param("articleId") articleId: string,
    @Body(new ZodValidationPipe(CommentCreateSchema)) body: CommentCreateRequest,
    @Req() request: AuthenticatedRequest,
  ): Promise<CommentCreateResponse> {
    return this.commentService.createComment(
      code,
      articleId,
      body,
      request.user!,
    );
  }

  @Patch(":commentId")
  @UseGuards(AuthGuard)
  async updateComment(
    @Param("code") code: string,
    @Param("articleId") articleId: string,
    @Param("commentId") commentId: string,
    @Body(new ZodValidationPipe(CommentUpdateSchema)) body: CommentUpdateRequest,
    @Req() request: AuthenticatedRequest,
  ): Promise<CommentUpdateResponse> {
    return this.commentService.updateComment(
      code,
      articleId,
      commentId,
      body,
      request.user!,
    );
  }

  @Delete(":commentId")
  @UseGuards(AuthGuard)
  async deleteComment(
    @Param("code") code: string,
    @Param("articleId") articleId: string,
    @Param("commentId") commentId: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<CommentDeleteResponse> {
    return this.commentService.deleteComment(
      code,
      articleId,
      commentId,
      request.user!,
    );
  }

  @Post(":commentId/hide")
  @UseGuards(AuthGuard)
  async hideComment(
    @Param("code") code: string,
    @Param("articleId") articleId: string,
    @Param("commentId") commentId: string,
    @Body(new ZodValidationPipe(ArticleModerationSchema)) body: CommentModerationRequest,
    @Req() request: AuthenticatedRequest,
  ): Promise<CommentModerationResponse> {
    return this.commentService.hideComment(code, articleId, commentId, body, request.user!);
  }

  @Post(":commentId/restore")
  @UseGuards(AuthGuard)
  async restoreComment(
    @Param("code") code: string,
    @Param("articleId") articleId: string,
    @Param("commentId") commentId: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<CommentModerationResponse> {
    return this.commentService.restoreComment(code, articleId, commentId, request.user!);
  }

  @Put(":commentId/engagements/:kind")
  @UseGuards(AuthGuard)
  async activateCommentEngagement(
    @Param("code") code: string,
    @Param("articleId") articleId: string,
    @Param("commentId") commentId: string,
    @Param("kind") kind: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<CommentEngagementResponse> {
    return this.commentService.setCommentEngagement(
      code,
      articleId,
      commentId,
      kind,
      true,
      request.user!,
    );
  }

  @Delete(":commentId/engagements/:kind")
  @UseGuards(AuthGuard)
  async deactivateCommentEngagement(
    @Param("code") code: string,
    @Param("articleId") articleId: string,
    @Param("commentId") commentId: string,
    @Param("kind") kind: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<CommentEngagementResponse> {
    return this.commentService.setCommentEngagement(
      code,
      articleId,
      commentId,
      kind,
      false,
      request.user!,
    );
  }

}
