import { Injectable, NotFoundException } from "@nestjs/common";
import type { BoardListResponse, BoardSummary } from "@soc/contracts";

import { BoardRepository } from "./repositories/board.repository";

@Injectable()
export class BoardService {
  constructor(private readonly boardRepository: BoardRepository) {}

  async getBoards(): Promise<BoardListResponse> {
    const items = await this.boardRepository.listBoards();
    return { items };
  }

  async getBoardByCode(code: string): Promise<BoardSummary> {
    const board = await this.boardRepository.findByCode(code);

    if (!board || !board.isActive) {
      throw new NotFoundException("board_not_found");
    }

    return board;
  }
}
