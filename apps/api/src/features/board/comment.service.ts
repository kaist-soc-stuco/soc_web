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
  CommentListResponse,
  CommentUpdateRequest,
  CommentUpdateResponse,
} from "@soc/contracts";

import { BoardRepository } from "./repositories/board.repository";
import { ArticleRepository } from "./repositories/article.repository";
import { CommentRepository } from "./repositories/comment.repository";
import { assertBoardReadable, type CurrentUserContext } from "./board-access";
import { COMMENT_STATUS } from "./board.constants";

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

    assertBoardReadable(board, currentUser);

    const articleReadable = await this.articleRepository.isReadableArticle(
      board.boardId,
      articleId,
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
    );

    return {
      page,
      limit,
      total: result.total,
      items: result.items,
    };
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

    const articleReadable = await this.articleRepository.isReadableArticle(
      board.boardId,
      articleId,
    );

    if (!articleReadable) {
      throw new NotFoundException("article_not_found");
    }

    const requiredPermission = board.commentPermissionId ?? 0;
    if (
      requiredPermission > 0 &&
      (user.permission & requiredPermission) !== requiredPermission
    ) {
      throw new ForbiddenException("insufficient_permission");
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
    }

    return this.commentRepository.createComment({
      articleId,
      authorUserId: user.id,
      payload,
    });
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

    const comment = await this.commentRepository.findPermissionInfo(
      commentId,
      articleId,
    );

    if (!comment || comment.status === COMMENT_STATUS.DELETED) {
      throw new NotFoundException("comment_not_found");
    }

    const managePermission = board.managePermissionId ?? 0;
    const isOwner = comment.authorUserId === user.id;
    const isManager =
      managePermission > 0 &&
      (user.permission & managePermission) === managePermission;

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

    const comment = await this.commentRepository.findPermissionInfo(
      commentId,
      articleId,
    );

    if (!comment || comment.status === COMMENT_STATUS.DELETED) {
      throw new NotFoundException("comment_not_found");
    }

    const managePermission = board.managePermissionId ?? 0;
    const isOwner = comment.authorUserId === user.id;
    const isManager =
      managePermission > 0 &&
      (user.permission & managePermission) === managePermission;

    if (!isOwner && !isManager) {
      throw new ForbiddenException("insufficient_permission");
    }

    return this.commentRepository.softDeleteComment(commentId);
  }
}
