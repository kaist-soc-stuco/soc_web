import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  Optional,
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
import { AuditLogService } from "../audit/audit-log.service";
import type { AuditMetadata } from "../audit/audit-context";

@Injectable()
export class BoardService {
  constructor(
    private readonly boardRepository: BoardRepository,
    @Optional() private readonly auditLogService?: AuditLogService,
  ) {}

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

  async createBoard(input: BoardCreateRequest, audit?: AuditMetadata): Promise<BoardSummary> {
    this.validatePermissionBits(input);
    const existing = await this.boardRepository.findByCode(input.code);
    if (existing) {
      throw new ConflictException("board_code_already_exists");
    }

    const board = await this.boardRepository.create(input);
    await this.auditLogService?.record({
      action: "board.create",
      actorUserId: audit?.actorUserId ?? null,
      ipAddress: audit?.ipAddress ?? null,
      payload: { after: safeBoardSnapshot(board) },
      targetId: board.boardId,
      targetType: "board",
    });
    return board;
  }

  async updateBoard(
    code: string,
    input: BoardUpdateRequest,
    audit?: AuditMetadata,
  ): Promise<BoardSummary> {
    this.validatePermissionBits(input);
    const before = await this.boardRepository.findByCode(code);
    const board = await this.boardRepository.update(code, input);
    if (!board) {
      throw new NotFoundException("board_not_found");
    }

    await this.auditLogService?.record({
      action: "board.update",
      actorUserId: audit?.actorUserId ?? null,
      ipAddress: audit?.ipAddress ?? null,
      payload: {
        before: before ? safeBoardSnapshot(before) : undefined,
        after: safeBoardSnapshot(board),
        changedFields: Object.keys(input),
      },
      targetId: board.boardId,
      targetType: "board",
    });
    return board;
  }

  async archiveBoard(code: string, audit?: AuditMetadata): Promise<BoardSummary> {
    const before = await this.boardRepository.findByCode(code);
    const board = await this.boardRepository.archive(code);
    if (!board) {
      throw new NotFoundException("board_not_found");
    }

    await this.auditLogService?.record({
      action: "board.archive",
      actorUserId: audit?.actorUserId ?? null,
      ipAddress: audit?.ipAddress ?? null,
      payload: {
        before: before ? safeBoardSnapshot(before) : undefined,
        after: safeBoardSnapshot(board),
      },
      targetId: board.boardId,
      targetType: "board",
    });
    return board;
  }

  async deleteBoard(code: string, audit?: AuditMetadata): Promise<BoardSummary> {
    const before = await this.boardRepository.findByCode(code);
    const board = await this.boardRepository.delete(code);
    if (!board) {
      throw new NotFoundException("board_not_found");
    }

    await this.auditLogService?.record({
      action: "board.delete",
      actorUserId: audit?.actorUserId ?? null,
      ipAddress: audit?.ipAddress ?? null,
      payload: { deleted: before ? safeBoardSnapshot(before) : safeBoardSnapshot(board) },
      targetId: board.boardId,
      targetType: "board",
    });
    return board;
  }

  async reorderBoards(
    input: BoardReorderRequest,
    audit?: AuditMetadata,
  ): Promise<BoardListResponse> {
    const codes = input.items.map((item) => item.code);
    if (new Set(codes).size !== codes.length) {
      throw new BadRequestException("duplicate_board_code");
    }
    await this.boardRepository.reorder(input.items);
    await this.auditLogService?.record({
      action: "board.reorder",
      actorUserId: audit?.actorUserId ?? null,
      ipAddress: audit?.ipAddress ?? null,
      payload: { itemCount: input.items.length, items: input.items },
      targetType: "board",
    });
    return this.getAdminBoards();
  }

  private validatePermissionBits(
    input: Partial<
      Pick<
        BoardCreateRequest,
        "writeAccessScope" | "writePermissionBit"
      >
    >,
  ): void {
    const validBits = new Set(PERMISSION_REGISTRY.map((permission) => permission.bit));
    const requestedBits = [input.writePermissionBit].filter(
      (bit): bit is number => bit !== undefined && bit !== 0,
    );

    if (requestedBits.some((bit) => !validBits.has(bit))) {
      throw new BadRequestException("unknown_board_permission_bit");
    }

    if (
      input.writeAccessScope === "PERMISSION" &&
      (input.writePermissionBit ?? 0) <= 0
    ) {
      throw new BadRequestException("board_permission_required");
    }
  }
}

function safeBoardSnapshot(board: BoardSummary) {
  return {
    allowComment: board.allowComment,
    allowGuestRead: board.allowGuestRead,
    allowLike: board.allowLike,
    allowSecret: board.allowSecret,
    code: board.code,
    isActive: board.isActive,
    nameKo: board.nameKo,
    sortOrder: board.sortOrder,
    writeAccessScope: board.writeAccessScope,
    writePermissionBit: board.writePermissionBit,
  };
}
