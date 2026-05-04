import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import type {
  ArticleCreateRequest,
  ArticleCreateResponse,
  ArticleDetailResponse,
  ArticleListResponse,
  ArticleUpdateRequest,
  ArticleUpdateResponse,
  ArticleDeleteResponse,
} from "@soc/contracts";

import { BoardRepository } from "./repositories/board.repository";
import { ArticleRepository } from "./repositories/article.repository";
import { assertBoardReadable, type CurrentUserContext } from "./board-access";
import { ARTICLE_STATUS } from "./board.constants";

interface ArticleQueryParams {
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
export class ArticleService {
  constructor(
    private readonly boardRepository: BoardRepository,
    private readonly articleRepository: ArticleRepository,
  ) {}

  async getArticles(
    code: string,
    params: ArticleQueryParams,
    currentUser: CurrentUserContext,
  ): Promise<ArticleListResponse> {
    const board = await this.boardRepository.findByCode(code);

    if (!board || !board.isActive) {
      throw new NotFoundException("board_not_found");
    }

    assertBoardReadable(board, currentUser);

    const page = params.page && params.page > 0 ? params.page : 1;
    const rawLimit = params.limit && params.limit > 0 ? params.limit : 20;
    const limit = Math.min(rawLimit, MAX_PAGE_SIZE);

    const result = await this.articleRepository.listByBoardId(board.boardId, page, limit);

    return {
      page,
      limit,
      total: result.total,
      items: result.items,
    };
  }

  async getArticle(
    code: string,
    articleId: string,
    currentUser: CurrentUserContext,
  ): Promise<ArticleDetailResponse> {
    const board = await this.boardRepository.findByCode(code);

    if (!board || !board.isActive) {
      throw new NotFoundException("board_not_found");
    }

    assertBoardReadable(board, currentUser);

    const article = await this.articleRepository.findDetailById(board.boardId, articleId);

    if (!article) {
      throw new NotFoundException("article_not_found");
    }

    return article;
  }

  async createArticle(
    code: string,
    payload: ArticleCreateRequest,
    user: AuthenticatedUser,
  ): Promise<ArticleCreateResponse> {
    if (payload.contentKo.length > MAX_CONTENT_LENGTH) {
      throw new BadRequestException("content_too_long");
    }

    if (payload.contentEn && payload.contentEn.length > MAX_CONTENT_LENGTH) {
      throw new BadRequestException("content_too_long");
    }

    const board = await this.boardRepository.findByCode(code);

    if (!board || !board.isActive) {
      throw new NotFoundException("board_not_found");
    }

    const requiredPermission = board.writePermissionId ?? 0;
    if (
      requiredPermission > 0
      && (user.permission & requiredPermission) !== requiredPermission
    ) {
      throw new ForbiddenException("insufficient_permission");
    }

    return this.articleRepository.createArticle({
      boardId: board.boardId,
      authorUserId: user.id,
      payload,
    });
  }

  async updateArticle(
    code: string,
    articleId: string,
    payload: ArticleUpdateRequest,
    user: AuthenticatedUser,
  ): Promise<ArticleUpdateResponse> {
    if (payload.contentKo && payload.contentKo.length > MAX_CONTENT_LENGTH) {
      throw new BadRequestException("content_too_long");
    }

    if (payload.contentEn && payload.contentEn.length > MAX_CONTENT_LENGTH) {
      throw new BadRequestException("content_too_long");
    }

    const board = await this.boardRepository.findByCode(code);

    if (!board || !board.isActive) {
      throw new NotFoundException("board_not_found");
    }

    const article = await this.articleRepository.findPermissionInfo(
      board.boardId,
      articleId,
    );

    if (!article || article.status === ARTICLE_STATUS.DELETED) {
      throw new NotFoundException("article_not_found");
    }

    const managePermission = board.managePermissionId ?? 0;
    const isOwner = article.authorUserId === user.id;
    const isManager =
      managePermission > 0 && (user.permission & managePermission) === managePermission;

    if (!isOwner && !isManager) {
      throw new ForbiddenException("insufficient_permission");
    }

    return this.articleRepository.updateArticle(board.boardId, articleId, payload);
  }

  async deleteArticle(
    code: string,
    articleId: string,
    user: AuthenticatedUser,
  ): Promise<ArticleDeleteResponse> {
    const board = await this.boardRepository.findByCode(code);

    if (!board || !board.isActive) {
      throw new NotFoundException("board_not_found");
    }

    const article = await this.articleRepository.findPermissionInfo(
      board.boardId,
      articleId,
    );

    if (!article || article.status === ARTICLE_STATUS.DELETED) {
      throw new NotFoundException("article_not_found");
    }

    const managePermission = board.managePermissionId ?? 0;
    const isOwner = article.authorUserId === user.id;
    const isManager =
      managePermission > 0 && (user.permission & managePermission) === managePermission;

    if (!isOwner && !isManager) {
      throw new ForbiddenException("insufficient_permission");
    }

    return this.articleRepository.softDeleteArticle(board.boardId, articleId);
  }
}
