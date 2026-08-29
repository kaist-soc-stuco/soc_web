import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
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
  ArticleModerationRequest,
  ArticleModerationResponse,
  HiddenArticleListResponse,
  FaqReorderRequest,
} from "@soc/contracts";
import { Permissions } from "@soc/contracts";
import { isoToDate, localDate, msToIso, nowDate, nowMs } from "@soc/shared";

import { BoardRepository } from "./repositories/board.repository";
import { ArticleRepository } from "./repositories/article.repository";
import {
  assertArticleScopeAssignable,
  getReadableArticleScopes,
} from "./article-access";
import type { CurrentUserContext } from "./board-access";
import { ARTICLE_STATUS } from "./board.constants";
import { sanitizeArticleHtml } from "./article-html-sanitizer";
import { canWriteBoard } from "./board-write-access";
import { AuditLogService } from "../audit/audit-log.service";
import { NotificationsService } from "../notifications/notifications.service";
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
}

const MAX_CONTENT_LENGTH = 50_000;
const MAX_PAGE_SIZE = 100;
const PUBLIC_NON_AGGREGATE_BOARD_CODES = new Set(["_EVENT", "faq"]);

const canReadSecretArticle = (
  article: Pick<ArticleListItem, "isSecret" | "author">,
  currentUser: CurrentUserContext,
): boolean => {
  if (!article.isSecret) return true;
  if (currentUser.user?.id === article.author.userId) return true;
  return Boolean(currentUser.user && Permissions.hasAny(
    currentUser.user.permission,
    Permissions.WRITE_REPLY,
    Permissions.MODERATE_CONTENT,
  ));
};

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
  eventLocation: undefined,
  eventDescriptionKo: undefined,
  eventDescriptionEn: undefined,
  surveyId: undefined,
});

@Injectable()
export class ArticleService {
  private readonly auditLogService: AuditLogService;

  constructor(
    private readonly boardRepository: BoardRepository,
    private readonly articleRepository: ArticleRepository,
    @Optional() auditLogService: AuditLogService | undefined,
    @Optional() private readonly notificationsService?: NotificationsService,
    @Optional() private readonly usersService?: UsersService,
  ) {
    this.auditLogService = auditLogService ?? {
      record: async () => undefined,
    } as unknown as AuditLogService;
  }

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
    const readableScopes = getReadableArticleScopes(currentUser, board.allowGuestRead);

    if (readableScopes.length === 0) {
      return { page, limit, total: 0, items: [] };
    }

    const result = await this.articleRepository.listByBoardId(
      board.boardId,
      page,
      limit,
      readableScopes,
      query,
      currentUser.user?.id,
      params.includeContentPreview,
      params.searchBy === "title_content" ? "title_content" : "title",
    );

    const visibleItems = result.items.map((item) =>
      canReadSecretArticle(item, currentUser)
        ? item
        : maskSecretListItem(item),
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
      .filter((board) => currentUser.authenticated || board.allowGuestRead)
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

    const readableScopes = getReadableArticleScopes(currentUser);
    if (readableBoards.length === 0 || readableScopes.length === 0) {
      return { page, limit, total: 0, items: [] };
    }

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
        visibilityScopes: readableScopes,
        viewerUserId: currentUser.user?.id,
      },
    );

    const boardById = new Map(
      readableBoards.map((board) => [board.boardId, board]),
    );
    const visibleItems = result.items.map((item) => {
      const board = boardById.get(item.boardId);
      return board && canReadSecretArticle(item, currentUser)
        ? item
        : board
          ? maskSecretListItem(item)
          : item;
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

    const readableScopes = getReadableArticleScopes(currentUser, board.allowGuestRead);
    if (readableScopes.length === 0) {
      throw new ForbiddenException("board_guest_read_disabled");
    }

    const canModerate = Boolean(
      currentUser.user &&
        Permissions.has(currentUser.user.permission, Permissions.MODERATE_CONTENT),
    );

    const article = await this.articleRepository.findDetailById(
      board.boardId,
      articleId,
      readableScopes,
      currentUser.user?.id,
      canModerate,
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

    if (this.usersService && await this.usersService.isPostingSuspended(user.id)) {
      throw new ForbiddenException("posting_suspended");
    }

    if (payload.isSecret && !board.allowSecret) {
      throw new ForbiddenException("secret_post_not_allowed");
    }

    if (payload.allowComment === true && !board.allowComment) {
      throw new ForbiddenException("comment_not_allowed");
    }

    if (!(await canWriteBoard(board, user, this.usersService))) {
      throw new ForbiddenException("insufficient_permission");
    }

    const created = await this.articleRepository.createArticle({
      boardId: board.boardId,
      authorUserId: user.id,
      payload: sanitizedPayload,
    });
    await this.auditLogService.record({
      action: "article.create",
      actorUserId: user.id,
      targetId: created.articleId,
      targetType: "article",
      payload: {
        created: {
          titleKo: payload.titleKo,
          titleEn: payload.titleEn ?? null,
          boardCode: code,
          boardId: board.boardId,
          visibilityScope: payload.visibilityScope,
          isSecret: payload.isSecret ?? false,
          isAnonymous: payload.isAnonymous ?? false,
          allowComment: payload.allowComment ?? true,
        },
      },
    });
    return created;
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

    if (payload.allowComment === true && !board.allowComment) {
      throw new ForbiddenException("comment_not_allowed");
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
      throw new ForbiddenException("insufficient_permission");
    }

    const updated = await this.articleRepository.updateArticle(
      board.boardId,
      articleId,
      sanitizedPayload,
      user.id,
    );
    await this.auditLogService.record({
      action: "article.update",
      actorUserId: user.id,
      targetId: articleId,
      targetType: "article",
      payload: {
        after: {
          boardCode: code,
          changedFields: Object.keys(sanitizedPayload),
          ...(sanitizedPayload.titleKo !== undefined ? { titleKo: sanitizedPayload.titleKo } : {}),
          ...(sanitizedPayload.titleEn !== undefined ? { titleEn: sanitizedPayload.titleEn } : {}),
        },
      },
    });
    return updated;
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
    const canModerate = Permissions.has(user.permission, Permissions.MODERATE_CONTENT);
    if (!isOwner && !canModerate) {
      throw new ForbiddenException("insufficient_permission");
    }

    const result = await this.articleRepository.softDeleteArticle(board.boardId, articleId);
    await this.notificationsService?.removeForArticle(code, articleId);
    await this.auditLogService.record({
      action: "article.delete",
      actorUserId: user.id,
      targetId: articleId,
      targetType: "article",
      payload: { deleted: { articleId, boardCode: code } },
    });
    return result;
  }

  async updateFaqArticle(
    articleId: string,
    payload: ArticleUpdateRequest,
    user: AuthenticatedUser,
  ): Promise<ArticleUpdateResponse> {
    this.assertFaqManager(user);
    const board = await this.getFaqBoard();
    const article = await this.articleRepository.findPermissionInfo(board.boardId, articleId);
    if (!article || article.status === ARTICLE_STATUS.DELETED) {
      throw new NotFoundException("article_not_found");
    }

    const sanitizedPayload: ArticleUpdateRequest = {};
    if (payload.titleKo !== undefined) sanitizedPayload.titleKo = payload.titleKo;
    if (payload.titleEn !== undefined) sanitizedPayload.titleEn = payload.titleEn;
    if (payload.contentKo !== undefined) {
      const contentKo = sanitizeArticleHtml(payload.contentKo);
      if (!contentKo.trim()) throw new BadRequestException("content_empty_after_sanitization");
      sanitizedPayload.contentKo = contentKo;
    }
    if (payload.contentEn !== undefined) {
      sanitizedPayload.contentEn = payload.contentEn
        ? sanitizeArticleHtml(payload.contentEn)
        : payload.contentEn;
    }

    if (Object.keys(sanitizedPayload).length === 0) {
      throw new BadRequestException("faq_update_empty");
    }

    const updated = await this.articleRepository.updateArticle(
      board.boardId,
      articleId,
      sanitizedPayload,
      user.id,
    );
    await this.auditLogService.record({
      action: "article.update",
      actorUserId: user.id,
      targetId: articleId,
      targetType: "article",
      payload: {
        after: {
          boardCode: "faq",
          changedFields: Object.keys(sanitizedPayload),
          ...(sanitizedPayload.titleKo !== undefined ? { titleKo: sanitizedPayload.titleKo } : {}),
          ...(sanitizedPayload.titleEn !== undefined ? { titleEn: sanitizedPayload.titleEn } : {}),
        },
      },
    });
    return updated;
  }

  async createFaqArticle(
    payload: ArticleCreateRequest,
    user: AuthenticatedUser,
  ): Promise<ArticleCreateResponse> {
    this.assertFaqManager(user);
    const board = await this.getFaqBoard();
    const contentKo = sanitizeArticleHtml(payload.contentKo);
    if (!contentKo.trim()) throw new BadRequestException("content_empty_after_sanitization");
    const contentEn = payload.contentEn ? sanitizeArticleHtml(payload.contentEn) : undefined;

    const created = await this.articleRepository.createArticle({
      boardId: board.boardId,
      authorUserId: user.id,
      payload: {
        titleKo: payload.titleKo,
        titleEn: payload.titleEn,
        contentKo,
        contentEn,
        visibilityScope: "PUBLIC",
        isPinned: false,
        pinOrder: null,
        isSecret: false,
        isAnonymous: false,
        allowComment: false,
        assets: payload.assets,
      },
    });
    await this.auditLogService.record({
      action: "article.create",
      actorUserId: user.id,
      targetId: created.articleId,
      targetType: "article",
      payload: {
        created: {
          titleKo: payload.titleKo,
          titleEn: payload.titleEn ?? null,
          boardCode: "faq",
          boardId: board.boardId,
          visibilityScope: "PUBLIC",
          allowComment: false,
        },
      },
    });
    return created;
  }

  async deleteFaqArticle(
    articleId: string,
    user: AuthenticatedUser,
  ): Promise<ArticleDeleteResponse> {
    this.assertFaqManager(user);
    const board = await this.getFaqBoard();
    const article = await this.articleRepository.findPermissionInfo(board.boardId, articleId);
    if (!article || article.status === ARTICLE_STATUS.DELETED) {
      throw new NotFoundException("article_not_found");
    }
    const result = await this.articleRepository.softDeleteArticle(board.boardId, articleId);
      await this.notificationsService?.removeForArticle("faq", articleId);
    await this.auditLogService.record({
      action: "article.delete",
      actorUserId: user.id,
      targetId: articleId,
      targetType: "article",
      payload: { deleted: { articleId, boardCode: "faq" } },
    });
    return result;
  }

  async reorderFaqArticles(
    input: FaqReorderRequest,
    user: AuthenticatedUser,
  ): Promise<{ ok: true }> {
    this.assertFaqManager(user);
    const board = await this.getFaqBoard();
    const articles = await Promise.all(
      input.items.map((item) => this.articleRepository.findPermissionInfo(board.boardId, item.articleId)),
    );
    if (articles.some((article) => !article || article.status !== ARTICLE_STATUS.PUBLISHED)) {
      throw new BadRequestException("faq_reorder_article_invalid");
    }
    await this.articleRepository.reorderFaqArticles(input.items);
    await this.auditLogService.record({
      action: "article.reorder",
      actorUserId: user.id,
      targetType: "article",
      payload: { boardCode: "faq", count: input.items.length },
    });
    return { ok: true };
  }

  private async getFaqBoard() {
    const board = await this.boardRepository.findByCode("faq");
    if (!board || !board.isActive) throw new NotFoundException("board_not_found");
    return board;
  }

  private assertFaqManager(user: AuthenticatedUser): void {
    if (!Permissions.has(user.permission, Permissions.MANAGE_SITE_CONTENT)) {
      throw new ForbiddenException("insufficient_permission");
    }
  }

  async listHiddenArticles(code: string, user: AuthenticatedUser): Promise<HiddenArticleListResponse> {
    if (!Permissions.has(user.permission, Permissions.MODERATE_CONTENT)) {
      throw new ForbiddenException("insufficient_permission");
    }
    const board = await this.boardRepository.findByCode(code);
    if (!board) throw new NotFoundException("board_not_found");
    return { items: await this.articleRepository.listHiddenArticles(board.boardId, code) };
  }

  async hideArticle(
    code: string,
    articleId: string,
    input: ArticleModerationRequest,
    user: AuthenticatedUser,
  ): Promise<ArticleModerationResponse> {
    if (!Permissions.has(user.permission, Permissions.MODERATE_CONTENT)) {
      throw new ForbiddenException("insufficient_permission");
    }
    const board = await this.boardRepository.findByCode(code);
    if (!board) throw new NotFoundException("board_not_found");
    const article = await this.articleRepository.findPermissionInfo(board.boardId, articleId);
    if (!article || article.status !== ARTICLE_STATUS.PUBLISHED) {
      throw new NotFoundException("article_not_found");
    }
    const result = await this.articleRepository.moderateArticle(board.boardId, articleId, {
      hidden: true,
      moderatorUserId: user.id,
      reason: input.reason,
    });
    await this.auditLogService.record({
      action: "article.hide",
      actorUserId: user.id,
      payload: { boardCode: code, reason: input.reason },
      targetId: articleId,
      targetType: "article",
    });
    return result;
  }

  async restoreArticle(
    code: string,
    articleId: string,
    user: AuthenticatedUser,
  ): Promise<ArticleModerationResponse> {
    if (!Permissions.has(user.permission, Permissions.MODERATE_CONTENT)) {
      throw new ForbiddenException("insufficient_permission");
    }
    const board = await this.boardRepository.findByCode(code);
    if (!board) throw new NotFoundException("board_not_found");
    const article = await this.articleRepository.findPermissionInfo(board.boardId, articleId);
    if (!article || article.status !== ARTICLE_STATUS.HIDDEN) {
      throw new NotFoundException("article_not_found");
    }
    const result = await this.articleRepository.moderateArticle(board.boardId, articleId, {
      hidden: false,
      moderatorUserId: user.id,
    });
    await this.auditLogService.record({
      action: "article.restore",
      actorUserId: user.id,
      payload: { boardCode: code },
      targetId: articleId,
      targetType: "article",
    });
    return result;
  }

  async revealAnonymousAuthor(
    code: string,
    articleId: string,
    user: AuthenticatedUser,
  ): Promise<{ articleId: string; authorUserId: string; authorName: string }> {
    if (!Permissions.has(user.permission, Permissions.MODERATE_CONTENT)) {
      throw new ForbiddenException("insufficient_permission");
    }

    const board = await this.boardRepository.findByCode(code);
    if (!board) throw new NotFoundException("board_not_found");

    const article = await this.articleRepository.findAnonymousAuthor(
      board.boardId,
      articleId,
    );
    if (!article) throw new NotFoundException("anonymous_article_not_found");

    await this.auditLogService.record({
      action: "article.anonymous_identity_reveal",
      actorUserId: user.id,
      payload: { boardCode: code },
      targetId: articleId,
      targetType: "article",
    });

    return { articleId, ...article };
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

    if (!board.allowLike) {
      throw new ForbiddenException("engagement_not_allowed");
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

    const response = {
      articleId,
      kind,
      active: kind === "LIKE" ? summary.viewerHasLiked : summary.viewerHasScrapped,
      ...summary,
    };
    await this.auditLogService.record({
      action: `article.engagement.${kind === "LIKE" ? "like" : "scrap"}`,
      actorUserId: user.id,
      targetId: articleId,
      targetType: "article",
      payload: {
        articleId,
        titleKo: article.titleKo,
        boardCode: code,
        active: response.active,
      },
    });
    return response;
  }

  async searchArticles(
    query: string | undefined,
    limit: number,
    currentUser: CurrentUserContext,
    searchBy: "title" | "title_content" = "title_content",
  ): Promise<ArticleListItem[]> {
    const result = await this.getAllArticles(
      {
        limit,
        page: 1,
        q: query,
        searchBy,
        sortBy: "latest",
        sortDirection: "desc",
        includeContentPreview: true,
      },
      currentUser,
    );

    return result.items;
  }
}
