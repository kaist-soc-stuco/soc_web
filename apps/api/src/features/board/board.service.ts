import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  PERMISSION_REGISTRY,
  type BoardCreateRequest,
  type BoardListResponse,
  type BoardReorderRequest,
  type BoardSummary,
  type BoardUpdateRequest,
} from "@soc/contracts";

import { BoardRepository } from "./repositories/board.repository";

@Injectable()
export class BoardService {
  constructor(private readonly boardRepository: BoardRepository) {}

  async getBoards(): Promise<BoardListResponse> {
    const items = await this.boardRepository.listBoards();
    return { items };
  }

  async getAdminBoards(): Promise<BoardListResponse> {
    const items = await this.boardRepository.listAllBoards();
    return { items };
  }

  async getBoardByCode(code: string): Promise<BoardSummary> {
    const board = await this.boardRepository.findByCode(code);

    if (!board || !board.isActive) {
      throw new NotFoundException("board_not_found");
    }

    return board;
  }

  async createBoard(input: BoardCreateRequest): Promise<BoardSummary> {
    this.validatePermissionBits(input);
    const existing = await this.boardRepository.findByCode(input.code);
    if (existing) {
      throw new ConflictException("board_code_already_exists");
    }

    return this.boardRepository.create(input);
  }

  async updateBoard(
    code: string,
    input: BoardUpdateRequest,
  ): Promise<BoardSummary> {
    this.validatePermissionBits(input);
    const board = await this.boardRepository.update(code, input);
    if (!board) {
      throw new NotFoundException("board_not_found");
    }

    return board;
  }

  async archiveBoard(code: string): Promise<BoardSummary> {
    const board = await this.boardRepository.archive(code);
    if (!board) {
      throw new NotFoundException("board_not_found");
    }

    return board;
  }

  async reorderBoards(input: BoardReorderRequest): Promise<BoardListResponse> {
    const codes = input.items.map((item) => item.code);
    if (new Set(codes).size !== codes.length) {
      throw new BadRequestException("duplicate_board_code");
    }
    await this.boardRepository.reorder(input.items);
    return this.getAdminBoards();
  }

  private validatePermissionBits(
    input: Partial<
      Pick<
        BoardCreateRequest,
        "writePermissionBit" | "commentPermissionBit" | "managePermissionBit"
      >
    >,
  ): void {
    const validBits = new Set(PERMISSION_REGISTRY.map((permission) => permission.bit));
    const requestedBits = [
      input.writePermissionBit,
      input.commentPermissionBit,
      input.managePermissionBit,
    ].filter((bit): bit is number => bit !== undefined && bit !== 0);

    if (requestedBits.some((bit) => !validBits.has(bit))) {
      throw new BadRequestException("unknown_board_permission_bit");
    }
  }
}
