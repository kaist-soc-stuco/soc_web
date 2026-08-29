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
import type { Request } from "express";
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
import { auditMetadataFromRequest } from "../audit/audit-context";
import { ZodValidationPipe } from "../../shared/pipes/zod-validation.pipe";
import { BoardService } from "./board.service";

@Controller("boards")
export class BoardController {
  constructor(private readonly boardService: BoardService) {}

  @Get()
  async getBoards(): Promise<BoardListResponse> {
    return this.boardService.getBoards();
  }

  @Get("admin")
  @RequirePermissions(Permissions.MANAGE_BOARDS)
  async getAdminBoards(): Promise<BoardListResponse> {
    return this.boardService.getAdminBoards();
  }

  @Post()
  @RequirePermissions(Permissions.MANAGE_BOARDS)
  async createBoard(
    @Req() request: Request & { user?: { id: string } },
    @Body(new ZodValidationPipe(BoardCreateSchema)) body: BoardCreateRequest,
  ): Promise<BoardSummary> {
    return this.boardService.createBoard(body, auditMetadataFromRequest(request));
  }

  @Patch("admin/order")
  @RequirePermissions(Permissions.MANAGE_BOARDS)
  async reorderBoards(
    @Req() request: Request & { user?: { id: string } },
    @Body(new ZodValidationPipe(BoardReorderSchema)) body: BoardReorderRequest,
  ): Promise<BoardListResponse> {
    return this.boardService.reorderBoards(body, auditMetadataFromRequest(request));
  }

  @Get(":code")
  async getBoard(@Param("code") code: string): Promise<BoardSummary> {
    return this.boardService.getBoardByCode(code);
  }

  @Patch(":code")
  @RequirePermissions(Permissions.MANAGE_BOARDS)
  async updateBoard(
    @Req() request: Request & { user?: { id: string } },
    @Param("code") code: string,
    @Body(new ZodValidationPipe(BoardUpdateSchema)) body: BoardUpdateRequest,
  ): Promise<BoardSummary> {
    return this.boardService.updateBoard(code, body, auditMetadataFromRequest(request));
  }

  @Delete(":code/permanent")
  @HttpCode(200)
  @RequirePermissions(Permissions.MANAGE_BOARDS)
  async deleteBoard(
    @Req() request: Request & { user?: { id: string } },
    @Param("code") code: string,
  ): Promise<BoardDeleteResponse> {
    const board = await this.boardService.deleteBoard(code, auditMetadataFromRequest(request));
    return { ok: true, boardId: board.boardId };
  }

  @Delete(":code")
  @HttpCode(200)
  @RequirePermissions(Permissions.MANAGE_BOARDS)
  async archiveBoard(
    @Req() request: Request & { user?: { id: string } },
    @Param("code") code: string,
  ): Promise<BoardArchiveResponse> {
    const board = await this.boardService.archiveBoard(code, auditMetadataFromRequest(request));
    return { ok: true, boardId: board.boardId, isActive: false };
  }
}
