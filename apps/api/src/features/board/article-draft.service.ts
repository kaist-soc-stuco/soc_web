import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
} from "@nestjs/common";
import type {
  ArticleDraftListResponse,
  ArticleDraftRecord,
  ArticleDraftSaveRequest,
} from "@soc/contracts";
import { AuditLogService } from "../audit/audit-log.service";
import type { AuditMetadata } from "../audit/audit-context";

import { BoardRepository } from "./repositories/board.repository";
import { ArticleDraftRepository } from "./repositories/article-draft.repository";
import { canWriteBoard } from "./board-write-access";
import { UsersService } from "../users/users.service";

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
    @Optional() private readonly usersService?: UsersService,
    @Optional() private readonly auditLogService?: AuditLogService,
  ) {}

  private async assertBoardWritable(
    boardCode: string,
    user: AuthenticatedUser,
  ) {
    if (this.usersService && await this.usersService.isPostingSuspended(user.id)) {
      throw new ForbiddenException("posting_suspended");
    }

    const board = await this.boardRepository.findByCode(boardCode);
    if (!board || !board.isActive) {
      throw new NotFoundException("board_not_found");
    }

    if (!(await canWriteBoard(board, user, this.usersService))) {
      throw new ForbiddenException("insufficient_permission");
    }

    return board;
  }

  async save(
    input: ArticleDraftSaveRequest,
    user: AuthenticatedUser,
    audit?: AuditMetadata,
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
      if (updated) {
        await this.auditLogService?.record({
          action: "article_draft.update",
          actorUserId: audit?.actorUserId ?? user.id,
          ipAddress: audit?.ipAddress ?? null,
          payload: {
            after: safeDraftSnapshot(updated),
            changedFields: ["title", "content", "visibility", "publishing_options", "event_options", "linked_survey"],
          },
          targetId: updated.draftId,
          targetType: "article_draft",
        });
        return updated;
      }

      throw new ConflictException("article_draft_conflict");
    }

    const created = await this.articleDraftRepository.create(user.id, board.boardId, input);
    await this.auditLogService?.record({
      action: "article_draft.create",
      actorUserId: audit?.actorUserId ?? user.id,
      ipAddress: audit?.ipAddress ?? null,
      payload: { after: safeDraftSnapshot(created) },
      targetId: created.draftId,
      targetType: "article_draft",
    });
    return created;
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

  async delete(
    draftId: string,
    user: AuthenticatedUser,
    audit?: AuditMetadata,
  ): Promise<{ ok: true }> {
    const deleted = await this.articleDraftRepository.delete(user.id, draftId);
    if (!deleted) throw new NotFoundException("article_draft_not_found");
    await this.auditLogService?.record({
      action: "article_draft.delete",
      actorUserId: audit?.actorUserId ?? user.id,
      ipAddress: audit?.ipAddress ?? null,
      payload: { deleted: true },
      targetId: draftId,
      targetType: "article_draft",
    });
    return { ok: true };
  }
}

function safeDraftSnapshot(draft: ArticleDraftRecord) {
  return {
    allowComment: draft.allowComment,
    boardCode: draft.boardCode,
    eventConfigured: Boolean(draft.eventStartDate || draft.eventEndDate || draft.eventLocation),
    hasAssets: Boolean(draft.assets?.length),
    hasContentEn: Boolean(draft.contentEn?.trim()),
    hasContentKo: Boolean(draft.contentKo.trim()),
    hasTitleEn: Boolean(draft.titleEn?.trim()),
    hasTitleKo: Boolean(draft.titleKo.trim()),
    isAnonymous: draft.isAnonymous,
    isKoreanOnly: draft.isKoreanOnly,
    isPinned: draft.isPinned,
    isSecret: draft.isSecret,
    linkedSurvey: Boolean(draft.linkedSurveyId),
    visibilityScope: draft.visibilityScope,
  };
}
