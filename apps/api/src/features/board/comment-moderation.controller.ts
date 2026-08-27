import { Controller, Get, Req, UseGuards } from "@nestjs/common";
import type { HiddenCommentListResponse } from "@soc/contracts";
import { Request } from "express";

import { AuthGuard } from "../auth/guards";
import { CommentService } from "./comment.service";

interface AuthenticatedRequest extends Request {
  user?: { id: string; permission: number };
}

@Controller("comment-moderation")
export class CommentModerationController {
  constructor(private readonly commentService: CommentService) {}

  @Get("hidden")
  @UseGuards(AuthGuard)
  async getHiddenComments(
    @Req() request: AuthenticatedRequest,
  ): Promise<HiddenCommentListResponse> {
    return this.commentService.listHiddenComments(request.user!);
  }
}
