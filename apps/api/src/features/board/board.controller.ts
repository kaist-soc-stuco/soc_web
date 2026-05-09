import { Controller, Get, Param } from "@nestjs/common";
import type { BoardListResponse, BoardSummary } from "@soc/contracts";

import { BoardService } from "./board.service";

@Controller("boards")
export class BoardController {
  constructor(private readonly boardService: BoardService) {}

  @Get()
  async getBoards(): Promise<BoardListResponse> {
    return this.boardService.getBoards();
  }

  @Get(":code")
  async getBoard(@Param("code") code: string): Promise<BoardSummary> {
    return this.boardService.getBoardByCode(code);
  }
}
