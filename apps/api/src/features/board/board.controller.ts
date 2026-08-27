import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
} from "@nestjs/common";
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
    @Body(new ZodValidationPipe(BoardCreateSchema)) body: BoardCreateRequest,
  ): Promise<BoardSummary> {
    return this.boardService.createBoard(body);
  }

  @Patch("admin/order")
  @RequirePermissions(Permissions.MANAGE_BOARDS)
  async reorderBoards(
    @Body(new ZodValidationPipe(BoardReorderSchema)) body: BoardReorderRequest,
  ): Promise<BoardListResponse> {
    return this.boardService.reorderBoards(body);
  }

  @Get(":code")
  async getBoard(@Param("code") code: string): Promise<BoardSummary> {
    return this.boardService.getBoardByCode(code);
  }

  @Patch(":code")
  @RequirePermissions(Permissions.MANAGE_BOARDS)
  async updateBoard(
    @Param("code") code: string,
    @Body(new ZodValidationPipe(BoardUpdateSchema)) body: BoardUpdateRequest,
  ): Promise<BoardSummary> {
    return this.boardService.updateBoard(code, body);
  }

  @Delete(":code/permanent")
  @HttpCode(200)
  @RequirePermissions(Permissions.MANAGE_BOARDS)
  async deleteBoard(@Param("code") code: string): Promise<BoardDeleteResponse> {
    const board = await this.boardService.deleteBoard(code);
    return { ok: true, boardId: board.boardId };
  }

  @Delete(":code")
  @HttpCode(200)
  @RequirePermissions(Permissions.MANAGE_BOARDS)
  async archiveBoard(@Param("code") code: string): Promise<BoardArchiveResponse> {
    const board = await this.boardService.archiveBoard(code);
    return { ok: true, boardId: board.boardId, isActive: false };
  }
}
