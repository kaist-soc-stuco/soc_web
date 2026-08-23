import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type {
  CommentCreateRequest,
  CommentCreateResponse,
  CommentDeleteResponse,
  CommentEngagementKind,
  CommentEngagementResponse,
  CommentListResponse,
  CommentUpdateRequest,
  CommentUpdateResponse,
} from "@soc/contracts";
import { Permissions } from "@soc/contracts";

import { BoardRepository } from "./repositories/board.repository";
import { ArticleRepository } from "./repositories/article.repository";
import { CommentRepository } from "./repositories/comment.repository";
import { getReadableArticleScopes } from "./article-access";
import type { CurrentUserContext } from "./board-access";
import { ARTICLE_STATUS, COMMENT_STATUS } from "./board.constants";
import { NotificationsService } from "../notifications/notifications.service";

interface CommentQueryParams {
  page?: number;
  limit?: number;
}

interface AuthenticatedUser {
  id: string;
  permission: number;
}

const MAX_CONTENT_LENGTH = 50_000;
const MAX_PAGE_SIZE = 100;

@Injectable()
export class CommentService {
  constructor(
    private readonly boardRepository: BoardRepository,
    private readonly articleRepository: ArticleRepository,
    private readonly commentRepository: CommentRepository,
    private readonly notificationsService: NotificationsService,
  ) {}

  async getComments(
    code: string,
    articleId: string,
    params: CommentQueryParams,
    currentUser: CurrentUserContext,
  ): Promise<CommentListResponse> {
    const board = await this.boardRepository.findByCode(code);

    if (!board || !board.isActive) {
      throw new NotFoundException("board_not_found");
    }

    const articleReadable = await this.articleRepository.isReadableArticle(
      board.boardId,
      articleId,
      getReadableArticleScopes(currentUser),
    );

    if (!articleReadable) {
      throw new NotFoundException("article_not_found");
    }

    const page = params.page && params.page > 0 ? params.page : 1;
    const rawLimit = params.limit && params.limit > 0 ? params.limit : 20;
    const limit = Math.min(rawLimit, MAX_PAGE_SIZE);

    const result = await this.commentRepository.listByArticleId(
      articleId,
      page,
      limit,
      currentUser.user?.id,
    );

    return {
      page,
      limit,
      total: result.total,
      items: result.items,
    };
  }

  async setCommentEngagement(
    code: string,
    articleId: string,
    commentId: string,
    rawKind: string,
    active: boolean,
    user: AuthenticatedUser,
  ): Promise<CommentEngagementResponse> {
    const kind = rawKind.toUpperCase() as CommentEngagementKind;
    if (kind !== "LIKE") {
      throw new BadRequestException("unsupported_comment_engagement");
    }

    await this.assertCommentActionAllowed(code, articleId, commentId, user);
    return this.commentRepository.setCommentEngagement(
      commentId,
      user.id,
      kind,
      active,
    );
  }

  async createComment(
    code: string,
    articleId: string,
    payload: CommentCreateRequest,
    user: AuthenticatedUser,
  ): Promise<CommentCreateResponse> {
    if (payload.content.length > MAX_CONTENT_LENGTH) {
      throw new BadRequestException("content_too_long");
    }

    const board = await this.boardRepository.findByCode(code);

    if (!board || !board.isActive) {
      throw new NotFoundException("board_not_found");
    }

    if (!board.allowComment) {
      throw new ForbiddenException("comment_not_allowed");
    }

    const article = await this.articleRepository.findCommentPermissionInfo(
      board.boardId,
      articleId,
      getReadableArticleScopes({ authenticated: true, user }),
    );

    if (!article || article.status !== ARTICLE_STATUS.PUBLISHED) {
      throw new NotFoundException("article_not_found");
    }

    if (!article.allowComment) {
      throw new ForbiddenException("comment_not_allowed");
    }

    if (payload.parentCommentId) {
      const parent = await this.commentRepository.findById(
        payload.parentCommentId,
      );

      if (
        !parent ||
        parent.articleId !== articleId ||
        parent.status === COMMENT_STATUS.DELETED
      ) {
        throw new BadRequestException("parent_comment_invalid");
      }

      if (parent.parentCommentId) {
        throw new BadRequestException("nested_reply_not_allowed");
      }
    }

    const created = await this.commentRepository.createComment({
      articleId,
      authorUserId: user.id,
      isOfficial:
        code === "건의사항" &&
        Permissions.hasAny(user.permission, Permissions.WRITE_REPLY, Permissions.ADMIN),
      payload,
    });

    const notificationTargets = await this.commentRepository.findNotificationTargets(
      created.commentId,
    );
    if (notificationTargets) {
      await this.notificationsService.notifyCommentCreated({
        ...notificationTargets,
        actorUserId: user.id,
        commentId: created.commentId,
      });
    }

    return created;
  }

  async updateComment(
    code: string,
    articleId: string,
    commentId: string,
    payload: CommentUpdateRequest,
    user: AuthenticatedUser,
  ): Promise<CommentUpdateResponse> {
    if (payload.content.length > MAX_CONTENT_LENGTH) {
      throw new BadRequestException("content_too_long");
    }

    const board = await this.boardRepository.findByCode(code);

    if (!board || !board.isActive) {
      throw new NotFoundException("board_not_found");
    }

    const articleReadable = await this.articleRepository.isReadableArticle(
      board.boardId,
      articleId,
      getReadableArticleScopes({ authenticated: true, user }),
    );

    if (!articleReadable) {
      throw new NotFoundException("article_not_found");
    }

    const comment = await this.commentRepository.findPermissionInfo(
      commentId,
      articleId,
      board.boardId,
    );

    if (!comment || comment.status === COMMENT_STATUS.DELETED) {
      throw new NotFoundException("comment_not_found");
    }

    const isOwner = comment.authorUserId === user.id;
    const isManager = Permissions.hasAny(
      user.permission,
      Permissions.MODERATOR,
      Permissions.ADMIN,
    );

    if (!isOwner && !isManager) {
      throw new ForbiddenException("insufficient_permission");
    }

    return this.commentRepository.updateComment(commentId, payload);
  }

  async deleteComment(
    code: string,
    articleId: string,
    commentId: string,
    user: AuthenticatedUser,
  ): Promise<CommentDeleteResponse> {
    const board = await this.boardRepository.findByCode(code);

    if (!board || !board.isActive) {
      throw new NotFoundException("board_not_found");
    }

    const articleReadable = await this.articleRepository.isReadableArticle(
      board.boardId,
      articleId,
      getReadableArticleScopes({ authenticated: true, user }),
    );

    if (!articleReadable) {
      throw new NotFoundException("article_not_found");
    }

    const comment = await this.commentRepository.findPermissionInfo(
      commentId,
      articleId,
      board.boardId,
    );

    if (!comment || comment.status === COMMENT_STATUS.DELETED) {
      throw new NotFoundException("comment_not_found");
    }

    const isOwner = comment.authorUserId === user.id;
    const isManager = Permissions.hasAny(
      user.permission,
      Permissions.MODERATOR,
      Permissions.ADMIN,
    );

    if (!isOwner && !isManager) {
      throw new ForbiddenException("insufficient_permission");
    }

    return this.commentRepository.softDeleteComment(commentId);
  }

  private async assertCommentActionAllowed(
    code: string,
    articleId: string,
    commentId: string,
    user: AuthenticatedUser,
  ): Promise<void> {
    const board = await this.boardRepository.findByCode(code);

    if (!board || !board.isActive) {
      throw new NotFoundException("board_not_found");
    }

    const articleReadable = await this.articleRepository.isReadableArticle(
      board.boardId,
      articleId,
      getReadableArticleScopes({ authenticated: true, user }),
    );

    if (!articleReadable) {
      throw new NotFoundException("article_not_found");
    }

    const comment = await this.commentRepository.findPermissionInfo(
      commentId,
      articleId,
      board.boardId,
    );

    if (!comment || comment.status === COMMENT_STATUS.DELETED) {
      throw new NotFoundException("comment_not_found");
    }
  }
}
