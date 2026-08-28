import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type {
  ArticleCreateRequest,
  ArticleCreateResponse,
  ArticleDetailResponse,
  ArticleEngagementKind,
  ArticleEngagementResponse,
  ArticleListResponse,
  ArticleListItem,
  ArticleUpdateRequest,
  ArticleUpdateResponse,
  ArticleDeleteResponse,
  UserRestrictionCreateRequest,
  UserRestrictionAppliedResponse,
} from "@soc/contracts";
import { Permissions } from "@soc/contracts";
import { isoToDate, localDate, msToIso, nowDate, nowMs } from "@soc/shared";

import { BoardRepository } from "./repositories/board.repository";
import { ArticleRepository } from "./repositories/article.repository";
import {
  assertSecretArticleAccess,
  assertArticleScopeAssignable,
  getReadableArticleScopes,
} from "./article-access";
import {
  canUseOfficialIdentity,
  canWriteToBoard,
} from "./board-access";
import type { CurrentUserContext } from "./board-access";
import { ARTICLE_STATUS } from "./board.constants";
import { sanitizeArticleHtml } from "./article-html-sanitizer";
import { UsersService } from "../users/users.service";

interface ArticleQueryParams {
  page?: number;
  limit?: number;
  q?: string;
  period?: "all" | "today" | "7days" | "30days";
  searchBy?: "title" | "author" | "title_content";
  sortBy?: "latest" | "views";
  sortDirection?: "asc" | "desc";
  includeContentPreview?: boolean;
}

interface AuthenticatedUser {
  id: string;
  permission: number;
  roleGroupIds?: number[];
}

const MAX_CONTENT_LENGTH = 50_000;
const MAX_PAGE_SIZE = 100;
const PUBLIC_NON_AGGREGATE_BOARD_CODES = new Set(["_EVENT", "FAQ"]);

const canReadSecretArticle = (
  article: Pick<ArticleListItem, "isSecret" | "author">,
  currentUser: CurrentUserContext,
): boolean => {
  if (!article.isSecret) return true;
  if (currentUser.user?.id === article.author.userId) return true;
  return Boolean(currentUser.user && Permissions.hasAny(
    currentUser.user.permission,
    Permissions.VIEW_SECRET_POST,
    Permissions.SUPER_ADMIN,
  ));
};

/** 익명 작성자의 계정 식별자는 모든 공개 응답에서 제거합니다. */
const maskAnonymousAuthor = <
  T extends { isAnonymous: boolean; author: { userId: string; name: string } },
>(item: T): T =>
  item.isAnonymous
    ? { ...item, author: { userId: "", name: "익명" } }
    : item;

const maskSecretListItem = (item: ArticleListItem): ArticleListItem => ({
  ...item,
  titleKo: "비밀글입니다.",
  titleEn: "Secret post",
  author: { userId: "", name: "비밀글" },
  commentCount: 0,
  viewCount: 0,
  likeCount: 0,
  scrapCount: 0,
  viewerHasLiked: false,
  viewerHasScrapped: false,
  hasAttachment: false,
  thumbnailStorageKey: undefined,
  snippetKo: undefined,
  snippetEn: undefined,
  eventStartDate: undefined,
  eventEndDate: undefined,
  eventDescriptionKo: undefined,
  eventDescriptionEn: undefined,
  surveyId: undefined,
});

@Injectable()
export class ArticleService {
  constructor(
    private readonly boardRepository: BoardRepository,
    private readonly articleRepository: ArticleRepository,
    private readonly usersService: UsersService,
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

    const page = params.page && params.page > 0 ? params.page : 1;
    const rawLimit = params.limit && params.limit > 0 ? params.limit : 20;
    const limit = Math.min(rawLimit, MAX_PAGE_SIZE);
    const query = params.q?.trim();

    const result = await this.articleRepository.listByBoardId(
      board.boardId,
      page,
      limit,
      getReadableArticleScopes(currentUser),
      query,
      currentUser.user?.id,
      params.includeContentPreview,
    );

    const visibleItems = result.items.map((item) =>
      maskAnonymousAuthor(
        canReadSecretArticle(item, currentUser)
          ? item
          : maskSecretListItem(item),
      ),
    );

    return {
      page,
      limit,
      total: result.total,
      items: visibleItems,
    };
  }

  async getAllArticles(
    params: ArticleQueryParams,
    currentUser: CurrentUserContext,
  ): Promise<ArticleListResponse> {
    const readableBoards = (await this.boardRepository.listBoards())
      // Keep legacy boards addressable through their direct routes, but keep
      // the public aggregate feed aligned with the current IA.
      .filter((board) => !PUBLIC_NON_AGGREGATE_BOARD_CODES.has(board.code));

    const page = params.page && params.page > 0 ? params.page : 1;
    const rawLimit = params.limit && params.limit > 0 ? params.limit : 20;
    const limit = Math.min(rawLimit, MAX_PAGE_SIZE);
    const query = params.q?.trim();
    const searchBy = params.searchBy ?? "title";
    const sortBy = params.sortBy ?? "latest";
    const sortDirection = params.sortDirection ?? "desc";
    const now = nowDate();
    const todayStart = localDate(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    ).getTime();
    const cutoffDate =
      params.period === "today"
        ? isoToDate(msToIso(todayStart))
        : params.period === "7days"
          ? isoToDate(msToIso(nowMs() - 7 * 24 * 60 * 60 * 1000))
          : params.period === "30days"
            ? isoToDate(msToIso(nowMs() - 30 * 24 * 60 * 60 * 1000))
            : undefined;

    const result = await this.articleRepository.listByBoardIds(
      readableBoards.map((board) => board.boardId),
      {
        cutoffDate,
        limit,
        page,
        query,
        searchBy,
        sortBy,
        sortDirection,
        includeContentPreview: params.includeContentPreview,
        visibilityScopes: getReadableArticleScopes(currentUser),
        viewerUserId: currentUser.user?.id,
      },
    );

    const boardById = new Map(
      readableBoards.map((board) => [board.boardId, board]),
    );
    const visibleItems = result.items.map((item) => {
      const board = boardById.get(item.boardId);
      const visibleItem =
        board && canReadSecretArticle(item, currentUser)
          ? item
          : maskSecretListItem(item);
      return maskAnonymousAuthor(visibleItem);
    });

    return {
      page,
      limit,
      total: result.total,
      items: visibleItems,
    };
  }

  async getArticle(
    code: string,
    articleId: string,
    currentUser: CurrentUserContext,
    incrementView?: boolean,
  ): Promise<ArticleDetailResponse> {
    const board = await this.boardRepository.findByCode(code);

    if (!board || !board.isActive) {
      throw new NotFoundException("board_not_found");
    }

    const article = await this.articleRepository.findDetailById(
      board.boardId,
      articleId,
      getReadableArticleScopes(currentUser),
      currentUser.user?.id,
    );

    if (!article) {
      throw new NotFoundException("article_not_found");
    }

    if (!canReadSecretArticle(article, currentUser)) {
      throw new ForbiddenException("secret_article_access_denied");
    }

    if (incrementView && currentUser.user?.id) {
      const wasRecorded = await this.articleRepository.recordArticleView(
        articleId,
        currentUser.user.id,
      );
      if (wasRecorded) article.viewCount += 1;
    }

    return maskAnonymousAuthor({
      ...article,
      prevArticle: article.prevArticle
        ? maskAnonymousAuthor(article.prevArticle)
        : article.prevArticle,
      nextArticle: article.nextArticle
        ? maskAnonymousAuthor(article.nextArticle)
        : article.nextArticle,
    });
  }

  /**
   * 익명 게시글도 서버 내부의 작성자 FK를 기준으로 제재합니다.
   * 작성자 ID는 이 메서드의 응답이나 공개 게시글 DTO로 반환하지 않습니다.
   */
  async restrictArticleAuthor(
    code: string,
    articleId: string,
    input: UserRestrictionCreateRequest,
    user: AuthenticatedUser,
    ipAddress?: string,
  ): Promise<UserRestrictionAppliedResponse> {
    if (
      !Permissions.hasAny(
        user.permission,
        Permissions.MODERATE_POST_COMMENT,
        Permissions.SUPER_ADMIN,
      )
    ) {
      throw new ForbiddenException("insufficient_permission");
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

    const restriction = await this.usersService.createUserRestriction(article.authorUserId, input, {
      actorUserId: user.id,
      ipAddress,
      permission: user.permission,
    });

    return {
      restrictionId: restriction.restrictionId,
      duration: restriction.duration,
      reasonCode: restriction.reasonCode,
      reasonDetail: restriction.reasonDetail,
      expiresAt: restriction.expiresAt,
      createdAt: restriction.createdAt,
    };
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

    assertArticleScopeAssignable(payload.visibilityScope, {
      authenticated: true,
      user,
    });

    const sanitizedContentKo = sanitizeArticleHtml(payload.contentKo);
    if (!sanitizedContentKo.trim()) {
      throw new BadRequestException("content_empty_after_sanitization");
    }

    const sanitizedPayload: ArticleCreateRequest = {
      ...payload,
      contentKo: sanitizedContentKo,
      ...(payload.contentEn === undefined
        ? {}
        : { contentEn: sanitizeArticleHtml(payload.contentEn) }),
    };

    const board = await this.boardRepository.findByCode(code);

    if (!board || !board.isActive) {
      throw new NotFoundException("board_not_found");
    }

    if (payload.isSecret && !board.allowSecret) {
      throw new ForbiddenException("secret_post_not_allowed");
    }

    if (
      payload.isPinned &&
      !Permissions.hasAny(
        user.permission,
        Permissions.POST_ANNOUNCEMENT,
        Permissions.SUPER_ADMIN,
      )
    ) {
      throw new ForbiddenException("announcement_permission_required");
    }

    if (!canWriteToBoard(board, user)) {
      throw new ForbiddenException("insufficient_permission");
    }

    if (payload.isOfficial && !canUseOfficialIdentity(board, user)) {
      throw new ForbiddenException("official_identity_not_allowed");
    }

    if (payload.isOfficial) {
      sanitizedPayload.isAnonymous = false;
    }

    return this.articleRepository.createArticle({
      boardId: board.boardId,
      authorUserId: user.id,
      payload: sanitizedPayload,
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

    if (payload.visibilityScope) {
      assertArticleScopeAssignable(payload.visibilityScope, {
        authenticated: true,
        user,
      });
    }

    const sanitizedContentKo =
      payload.contentKo === undefined
        ? undefined
        : sanitizeArticleHtml(payload.contentKo);
    if (sanitizedContentKo !== undefined && !sanitizedContentKo.trim()) {
      throw new BadRequestException("content_empty_after_sanitization");
    }

    const sanitizedPayload: ArticleUpdateRequest = {
      ...payload,
      ...(sanitizedContentKo === undefined
        ? {}
        : { contentKo: sanitizedContentKo }),
      ...(payload.contentEn === undefined
        ? {}
        : { contentEn: sanitizeArticleHtml(payload.contentEn) }),
    };

    const board = await this.boardRepository.findByCode(code);

    if (!board || !board.isActive) {
      throw new NotFoundException("board_not_found");
    }

    if (payload.isSecret && !board.allowSecret) {
      throw new ForbiddenException("secret_post_not_allowed");
    }

    if (
      payload.isPinned === true &&
      !Permissions.hasAny(
        user.permission,
        Permissions.POST_ANNOUNCEMENT,
        Permissions.SUPER_ADMIN,
      )
    ) {
      throw new ForbiddenException("announcement_permission_required");
    }

    if (payload.isOfficial && !canUseOfficialIdentity(board, user)) {
      throw new ForbiddenException("official_identity_not_allowed");
    }

    if (payload.isOfficial) {
      sanitizedPayload.isAnonymous = false;
    }

    const article = await this.articleRepository.findPermissionInfo(
      board.boardId,
      articleId,
    );

    if (!article || article.status === ARTICLE_STATUS.DELETED) {
      throw new NotFoundException("article_not_found");
    }

    const isOwner = article.authorUserId === user.id;
    if (!isOwner) {
      assertSecretArticleAccess(article, { authenticated: true, user });
    }
    const isManager = Permissions.hasAny(
      user.permission,
      Permissions.MODERATE_POST_COMMENT,
      Permissions.SUPER_ADMIN,
    );

    if (!isOwner && !isManager) {
      throw new ForbiddenException("insufficient_permission");
    }

    return this.articleRepository.updateArticle(
      board.boardId,
      articleId,
      sanitizedPayload,
      user.id,
    );
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

    const isOwner = article.authorUserId === user.id;
    if (!isOwner) {
      assertSecretArticleAccess(article, { authenticated: true, user });
    }
    const isManager = Permissions.hasAny(
      user.permission,
      Permissions.MODERATE_POST_COMMENT,
      Permissions.SUPER_ADMIN,
    );

    if (!isOwner && !isManager) {
      throw new ForbiddenException("insufficient_permission");
    }

    return this.articleRepository.softDeleteArticle(board.boardId, articleId);
  }

  async setArticleEngagement(
    code: string,
    articleId: string,
    rawKind: string,
    active: boolean,
    user: AuthenticatedUser,
  ): Promise<ArticleEngagementResponse> {
    const kind = rawKind.toUpperCase() as ArticleEngagementKind;
    if (kind !== "LIKE" && kind !== "SCRAP") {
      throw new BadRequestException("invalid_article_engagement");
    }

    const board = await this.boardRepository.findByCode(code);
    if (!board || !board.isActive) {
      throw new NotFoundException("board_not_found");
    }

    if (kind === "LIKE" && !board.allowLike) {
      throw new ForbiddenException("like_not_allowed");
    }

    const article = await this.articleRepository.findDetailById(
      board.boardId,
      articleId,
      getReadableArticleScopes({ authenticated: true, user }),
      user.id,
    );
    if (!article) {
      throw new NotFoundException("article_not_found");
    }

    if (!canReadSecretArticle(article, { authenticated: true, user })) {
      throw new ForbiddenException("secret_article_access_denied");
    }

    await this.articleRepository.setArticleEngagement(
      articleId,
      user.id,
      kind,
      active,
    );
    const summary = await this.articleRepository.getArticleEngagementSummary(
      articleId,
      user.id,
    );

    return {
      articleId,
      kind,
      active: kind === "LIKE" ? summary.viewerHasLiked : summary.viewerHasScrapped,
      ...summary,
    };
  }

  async searchArticles(
    query: string | undefined,
    limit: number,
    currentUser: CurrentUserContext,
  ): Promise<ArticleListItem[]> {
    const result = await this.getAllArticles(
      {
        limit,
        page: 1,
        q: query,
        searchBy: "title_content",
        sortBy: "latest",
        sortDirection: "desc",
        includeContentPreview: true,
      },
      currentUser,
    );

    return result.items;
  }
}
