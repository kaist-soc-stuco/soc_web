import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  ParseIntPipe,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import type {
  CommentCreateRequest,
  CommentCreateResponse,
  CommentDeleteResponse,
  CommentListResponse,
  CommentUpdateRequest,
  CommentUpdateResponse,
} from "@soc/contracts";
import { Request } from "express";

import { AuthGuard } from "../../shared/guards";
import { Cookies } from "../../shared/decorators/cookies.decorator";
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
    const currentUser = await this.authSessionService.getCurrentUser(accessToken);
    return this.commentService.getComments(code, articleId, {
      page,
      limit,
    }, currentUser);
  }

  @Post()
  @UseGuards(AuthGuard)
  async createComment(
    @Param("code") code: string,
    @Param("articleId") articleId: string,
    @Body() body: CommentCreateRequest,
    @Req() request: AuthenticatedRequest,
  ): Promise<CommentCreateResponse> {
    return this.commentService.createComment(code, articleId, body, request.user!);
  }

  @Patch(":commentId")
  @UseGuards(AuthGuard)
  async updateComment(
    @Param("code") code: string,
    @Param("articleId") articleId: string,
    @Param("commentId") commentId: string,
    @Body() body: CommentUpdateRequest,
    @Req() request: AuthenticatedRequest,
  ): Promise<CommentUpdateResponse> {
    return this.commentService.updateComment(code, articleId, commentId, body, request.user!);
  }

  @Delete(":commentId")
  @UseGuards(AuthGuard)
  async deleteComment(
    @Param("code") code: string,
    @Param("articleId") articleId: string,
    @Param("commentId") commentId: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<CommentDeleteResponse> {
    return this.commentService.deleteComment(code, articleId, commentId, request.user!);
  }
}
