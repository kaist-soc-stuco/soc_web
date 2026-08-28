import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Req,
} from "@nestjs/common";
import { Request } from "express";
import {
  BoardCreateSchema,
  BoardReorderSchema,
  BoardUpdateSchema,
  Permissions,
} from "@soc/contracts";
import type {
  BoardArchiveResponse,
  BoardCreateRequest,
  BoardDeleteResponse,
  BoardListResponse,
  BoardReorderRequest,
  BoardSummary,
  BoardUpdateRequest,
} from "@soc/contracts";

import { RequirePermissions } from "../auth/guards";
import { Cookies } from "../../shared/decorators/cookies.decorator";
import { AUTH_ACCESS_COOKIE_NAME } from "../auth/auth.tokens";
import { AuthSessionService } from "../auth/auth-session.service";
import { ZodValidationPipe } from "../../shared/pipes/zod-validation.pipe";
import { BoardService } from "./board.service";

@Controller("boards")
export class BoardController {
  constructor(
    private readonly boardService: BoardService,
    private readonly authSessionService: AuthSessionService,
  ) {}

  private toViewer(user?: {
    permission: number;
    roleGroupIds?: number[];
  }) {
    return user
      ? { permission: user.permission, roleGroupIds: user.roleGroupIds }
      : undefined;
  }

  @Get()
  async getBoards(
    @Cookies(AUTH_ACCESS_COOKIE_NAME) accessToken?: string,
  ): Promise<BoardListResponse> {
    const currentUser = await this.authSessionService.getOptionalCurrentUser(accessToken);
    return this.boardService.getBoards(this.toViewer(currentUser.user));
  }

  @Get("admin")
  @RequirePermissions(Permissions.MANAGE_BOARD_SETTINGS)
  async getAdminBoards(@Req() request: Request & { user?: { permission: number; roleGroupIds?: number[] } }): Promise<BoardListResponse> {
    return this.boardService.getAdminBoards(this.toViewer(request.user));
  }

  @Post()
  @RequirePermissions(Permissions.MANAGE_BOARD_SETTINGS)
  async createBoard(
    @Body(new ZodValidationPipe(BoardCreateSchema)) body: BoardCreateRequest,
  ): Promise<BoardSummary> {
    return this.boardService.createBoard(body);
  }

  @Patch("admin/order")
  @RequirePermissions(Permissions.MANAGE_BOARD_SETTINGS)
  async reorderBoards(
    @Body(new ZodValidationPipe(BoardReorderSchema)) body: BoardReorderRequest,
  ): Promise<BoardListResponse> {
    return this.boardService.reorderBoards(body);
  }

  @Get(":code")
  async getBoard(
    @Param("code") code: string,
    @Cookies(AUTH_ACCESS_COOKIE_NAME) accessToken?: string,
  ): Promise<BoardSummary> {
    const currentUser = await this.authSessionService.getOptionalCurrentUser(accessToken);
    return this.boardService.getBoardByCode(code, this.toViewer(currentUser.user));
  }

  @Patch(":code")
  @RequirePermissions(Permissions.MANAGE_BOARD_SETTINGS)
  async updateBoard(
    @Param("code") code: string,
    @Body(new ZodValidationPipe(BoardUpdateSchema)) body: BoardUpdateRequest,
  ): Promise<BoardSummary> {
    return this.boardService.updateBoard(code, body);
  }

  @Delete(":code/permanent")
  @HttpCode(200)
  @RequirePermissions(Permissions.MANAGE_BOARD_SETTINGS)
  async deleteBoard(@Param("code") code: string): Promise<BoardDeleteResponse> {
    const board = await this.boardService.deleteBoard(code);
    return { ok: true, boardId: board.boardId };
  }

  @Delete(":code")
  @HttpCode(200)
  @RequirePermissions(Permissions.MANAGE_BOARD_SETTINGS)
  async archiveBoard(@Param("code") code: string): Promise<BoardArchiveResponse> {
    const board = await this.boardService.archiveBoard(code);
    return { ok: true, boardId: board.boardId, isActive: false };
  }
}
