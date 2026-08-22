import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type {
  ArticleDraftListResponse,
  ArticleDraftRecord,
  ArticleDraftSaveRequest,
} from "@soc/contracts";
import { Permissions } from "@soc/contracts";

import { BoardRepository } from "./repositories/board.repository";
import { ArticleDraftRepository } from "./repositories/article-draft.repository";

interface AuthenticatedUser {
  id: string;
  permission: number;
}

const MAX_PAGE_SIZE = 100;

@Injectable()
export class ArticleDraftService {
  constructor(
    private readonly boardRepository: BoardRepository,
    private readonly articleDraftRepository: ArticleDraftRepository,
  ) {}

  private async assertBoardWritable(
    boardCode: string,
    user: AuthenticatedUser,
  ) {
    const board = await this.boardRepository.findByCode(boardCode);
    if (!board || !board.isActive) {
      throw new NotFoundException("board_not_found");
    }

    if (
      board.writePermissionBit > 0 &&
      !Permissions.has(user.permission, board.writePermissionBit)
    ) {
      throw new ForbiddenException("insufficient_permission");
    }

    return board;
  }

  async save(
    input: ArticleDraftSaveRequest,
    user: AuthenticatedUser,
  ): Promise<ArticleDraftRecord> {
    if (!input.titleKo.trim() && !input.contentKo.trim()) {
      throw new BadRequestException("article_draft_empty");
    }

    const board = await this.assertBoardWritable(input.boardCode, user);

    if (input.draftId) {
      const existing = await this.articleDraftRepository.findById(
        user.id,
        input.draftId,
      );
      if (!existing) {
        throw new NotFoundException("article_draft_not_found");
      }

      if (existing.fingerprint === input.fingerprint) {
        return existing;
      }

      const updated = await this.articleDraftRepository.update(
        user.id,
        input.draftId,
        board.boardId,
        input,
      );
      if (updated) return updated;

      throw new ConflictException("article_draft_conflict");
    }

    return this.articleDraftRepository.create(user.id, board.boardId, input);
  }

  async list(
    user: AuthenticatedUser,
    options: { page?: number; limit?: number; boardCode?: string },
  ): Promise<ArticleDraftListResponse> {
    const page = options.page && options.page > 0 ? Math.floor(options.page) : 1;
    const limit = Math.min(
      options.limit && options.limit > 0 ? Math.floor(options.limit) : 20,
      MAX_PAGE_SIZE,
    );
    const result = await this.articleDraftRepository.listByOwner(
      user.id,
      page,
      limit,
      options.boardCode,
    );

    return {
      page,
      limit,
      total: result.total,
      items: result.items,
    };
  }

  async get(
    draftId: string,
    user: AuthenticatedUser,
  ): Promise<ArticleDraftRecord> {
    const draft = await this.articleDraftRepository.findById(user.id, draftId);
    if (!draft) throw new NotFoundException("article_draft_not_found");
    return draft;
  }

  async delete(draftId: string, user: AuthenticatedUser): Promise<{ ok: true }> {
    const deleted = await this.articleDraftRepository.delete(user.id, draftId);
    if (!deleted) throw new NotFoundException("article_draft_not_found");
    return { ok: true };
  }
}
