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
import type { BoardViewer } from "./repositories/board.repository";

@Injectable()
export class BoardService {
  constructor(private readonly boardRepository: BoardRepository) {}

  async getBoards(viewer?: BoardViewer): Promise<BoardListResponse> {
    const items = await this.boardRepository.listBoards(viewer);
    return { items };
  }

  async getAdminBoards(viewer?: BoardViewer): Promise<BoardListResponse> {
    const items = await this.boardRepository.listAllBoards(viewer);
    return { items };
  }

  async getBoardByCode(code: string, viewer?: BoardViewer): Promise<BoardSummary> {
    const board = await this.boardRepository.findByCode(code, viewer);

    if (!board || !board.isActive) {
      throw new NotFoundException("board_not_found");
    }

    return board;
  }

  async createBoard(input: BoardCreateRequest): Promise<BoardSummary> {
    this.validatePermissionBits(input);
    const normalizedInput = this.normalizeWriteAccess(input);
    const existing = await this.boardRepository.findByCode(input.code);
    if (existing) {
      throw new ConflictException("board_code_already_exists");
    }

    return this.boardRepository.create(normalizedInput);
  }

  async updateBoard(
    code: string,
    input: BoardUpdateRequest,
  ): Promise<BoardSummary> {
    this.validatePermissionBits(input);
    const board = await this.boardRepository.update(
      code,
      this.normalizeWriteAccess(input),
    );
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

  async deleteBoard(code: string): Promise<BoardSummary> {
    const board = await this.boardRepository.delete(code);
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
        "writeAccessType" | "writePermissionBit" | "writeRoleGroupIds"
      >
    >,
  ): void {
    const validBits = new Set([
      ...PERMISSION_REGISTRY.map((permission) => permission.bit),
      // Existing deployments may still submit the old single-permission field.
      1,
      2,
      4,
      8,
      16,
      32,
      64,
      128,
      256,
      512,
    ]);
    const requestedBits = [input.writePermissionBit].filter(
      (bit): bit is number => bit !== undefined && bit !== 0,
    );

    if (requestedBits.some((bit) => !validBits.has(bit))) {
      throw new BadRequestException("unknown_board_permission_bit");
    }

    if (
      input.writeAccessType === "PERMISSION" &&
      (input.writePermissionBit ?? 0) <= 0
    ) {
      throw new BadRequestException("board_permission_bit_required");
    }

    if (
      input.writeRoleGroupIds?.some(
        (roleGroupId) => !Number.isInteger(roleGroupId) || roleGroupId <= 0,
      )
    ) {
      throw new BadRequestException("invalid_board_role_group");
    }
  }

  private normalizeWriteAccess<T extends BoardCreateRequest | BoardUpdateRequest>(
    input: T,
  ): T {
    if (input.writeRoleGroupIds !== undefined) {
      return {
        ...input,
        writeAccessType: "ROLE_GROUP",
        writePermissionBit: 0,
      } as T;
    }

    if (
      input.writeAccessType === undefined &&
      input.writePermissionBit === undefined
    ) {
      return input;
    }

    const accessType =
      input.writeAccessType === "EXECUTIVE"
        ? "EXECUTIVE"
        : input.writeAccessType === "PERMISSION" ||
            (input.writeAccessType === "AUTHENTICATED" &&
              (input.writePermissionBit ?? 0) > 0)
          ? "PERMISSION"
          : "AUTHENTICATED";

    return {
      ...input,
      writeAccessType: accessType,
      writePermissionBit:
        accessType === "PERMISSION" ? input.writePermissionBit ?? 0 : 0,
    } as T;
  }
}
