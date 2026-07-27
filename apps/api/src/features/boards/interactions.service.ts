import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  Asset,
  AssetInitiatedResponse,
  Comment,
  CompleteAssetRequest,
  CreateCommentRequest,
  InitiateAssetRequest,
  PatchCommentRequest,
  PutArticleReactionRequest,
} from '@soc/contracts';

import { Clock } from '../../shared/time/clock';
import { PermissionsService } from '../permissions/permissions.service';
import { InteractionsRepository } from './interactions.repository';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_COMMENT_LENGTH = 20_000;

@Injectable()
export class InteractionsService {
  constructor(
    @Inject(InteractionsRepository) private readonly repository: InteractionsRepository,
    @Inject(PermissionsService) private readonly permissions: PermissionsService,
    @Inject(Clock) private readonly clock: Clock,
    @Inject(ConfigService) private readonly config: ConfigService,
  ) {}

  async createComment(actorUserId: string, articleId: string, input: CreateCommentRequest, correlationId: string): Promise<Comment> {
    this.uuid(articleId, 'invalid_article_id');
    this.correlation(correlationId);
    this.exactKeys(input, ['body', 'status', 'parentCommentId'], 'invalid_comment');
    const body = this.commentBody(input?.body);
    const status = input?.status ?? 'PUBLISHED';
    if (status !== 'PUBLISHED' && status !== 'SECRET') throw new UnprocessableEntityException('invalid_comment');
    const parentCommentId = input?.parentCommentId ?? null;
    if (parentCommentId !== null) this.uuid(parentCommentId, 'invalid_parent_comment_id');
    const now = this.clock.now();
    const created = await this.repository.createComment({
      articleId, parentCommentId, authorUserId: actorUserId, body, status,
      purgeAfter: null, createdAt: now, updatedAt: now,
    }, correlationId, async ({ article, board, parent }) => {
      await this.validateCommentInteraction(actorUserId, article, board);
      if (parentCommentId && (!parent || parent.articleId !== articleId)) throw new UnprocessableEntityException('invalid_parent_comment');
      if (parent?.status === 'DELETED') throw new ConflictException('parent_comment_deleted');
    });
    if (!created) throw new NotFoundException('article_not_found');
    return this.comment(created, actorUserId, false);
  }

  async patchComment(actorUserId: string, commentId: string, input: PatchCommentRequest, correlationId: string): Promise<Comment> {
    this.uuid(commentId, 'invalid_comment_id');
    this.correlation(correlationId);
    this.patchInput(input);
    const now = this.clock.now();
    const values: { body?: string; status?: 'PUBLISHED' | 'SECRET'; updatedAt: Date } = { updatedAt: now };
    const changed: string[] = [];
    if (input.body !== undefined) { values.body = this.commentBody(input.body); changed.push('body'); }
    if (input.status !== undefined) {
      if (input.status !== 'PUBLISHED' && input.status !== 'SECRET') throw new UnprocessableEntityException('invalid_comment');
      values.status = input.status;
      changed.push('status');
    }
    const updated = await this.repository.patchComment(commentId, actorUserId, values, changed.join(','), correlationId, async ({ article, board, comment }) => {
      await this.validateCommentMutation(actorUserId, article, board);
      const isManager = await this.isManager(actorUserId);
      if (comment.authorUserId !== actorUserId && !isManager) throw new ForbiddenException('insufficient_permission');
      if (comment.status === 'DELETED') throw new ConflictException('comment_deleted');
    });
    if (!updated) throw new NotFoundException('comment_not_found');
    return this.comment(updated, actorUserId, await this.isManager(actorUserId));
  }

  async deleteComment(actorUserId: string, commentId: string, correlationId: string): Promise<void> {
    this.uuid(commentId, 'invalid_comment_id');
    this.correlation(correlationId);
    const now = this.clock.now();
    const deleted = await this.repository.softDeleteComment(commentId, actorUserId, now, this.purgeAfter(now), correlationId, async ({ article, board, comment }) => {
      await this.validateCommentMutation(actorUserId, article, board);
      const isManager = await this.isManager(actorUserId);
      if (comment.authorUserId !== actorUserId && !isManager) throw new ForbiddenException('insufficient_permission');
    });
    if (!deleted) throw new NotFoundException('comment_not_found');
  }

  async listComments(actorUserId: string | undefined, articleId: string): Promise<Comment[]> {
    this.uuid(articleId, 'invalid_article_id');
    const result = await this.repository.readPublishedArticleComments(articleId, async ({ article, board }) => {
      await this.assertReadablePublishedArticle(actorUserId, article, board);
      return { canReadSecretComments: actorUserId ? await this.isManager(actorUserId) : false };
    });
    if (!result) throw new NotFoundException('article_not_found');
    return result.comments.map((row) => this.comment(row, actorUserId, result.canReadSecretComments));
  }
  async detailExtras(actorUserId: string | undefined, articleId: string): Promise<{
    comments: Comment[];
    assets: Asset[];
    myReaction: 'LIKE' | 'DISLIKE' | null;
  }> {
    this.uuid(articleId, 'invalid_article_id');
    const detail = await this.repository.readArticleDetail(articleId, actorUserId, async ({ article, board }) => {
      await this.assertDetailReadable(actorUserId, article, board);
      return { canReadSecretComments: actorUserId ? await this.isManager(actorUserId) : false };
    });
    if (!detail) throw new NotFoundException('article_not_found');
    return {
      comments: detail.comments.map((row) => this.comment(row, actorUserId, detail.canReadSecretComments)),
      assets: detail.assets.map((row) => this.asset(row)),
      myReaction: detail.reaction?.type ?? null,
    };
  }

  async putReaction(actorUserId: string, articleId: string, input: PutArticleReactionRequest, correlationId: string): Promise<{ type: 'LIKE' | 'DISLIKE' }> {
    this.uuid(articleId, 'invalid_article_id');
    this.correlation(correlationId);
    this.exactKeys(input, ['type'], 'invalid_reaction');
    if (input?.type !== 'LIKE' && input?.type !== 'DISLIKE') throw new UnprocessableEntityException('invalid_reaction');
    const written = await this.repository.putReaction(articleId, actorUserId, input.type, this.clock.now(), correlationId, async ({ article, board }) => {
      await this.validateReactionInteraction(actorUserId, article, board);
    });
    if (!written) throw new NotFoundException('article_not_found');
    return { type: input.type };
  }

  async deleteReaction(actorUserId: string, articleId: string, correlationId: string): Promise<{ type: null }> {
    this.uuid(articleId, 'invalid_article_id');
    this.correlation(correlationId);
    const result = await this.repository.deleteReaction(articleId, actorUserId, correlationId, async ({ article, board }) => {
      await this.validateReactionInteraction(actorUserId, article, board);
    });
    if (result.kind === 'article_not_found') throw new NotFoundException('article_not_found');
    if (result.kind === 'reaction_not_found') throw new NotFoundException('reaction_not_found');
    return { type: null };
  }

  async initiateAsset(_actorUserId: string, _articleId: string, _input: InitiateAssetRequest, correlationId?: string): Promise<AssetInitiatedResponse> {
    if (correlationId !== undefined) this.correlation(correlationId);
    this.assetProviderUnavailable();
  }

  async completeAsset(_actorUserId: string, _assetId: string, _input: CompleteAssetRequest, correlationId?: string): Promise<Asset> {
    if (correlationId !== undefined) this.correlation(correlationId);
    this.assetProviderUnavailable();
  }

  async deleteAsset(_actorUserId: string, _assetId: string, correlationId?: string): Promise<void> {
    if (correlationId !== undefined) this.correlation(correlationId);
    this.assetProviderUnavailable();
  }

  private async validateCommentMutation(
    actorUserId: string,
    article: { status: string; scope: 'ALL' | 'KAIST' | 'SOC' | 'AUTHOR_AND_STAFF' | 'STAFF'; authorUserId: string },
    board: { isHidden: boolean; readPermission: 'PUBLIC' | 'AUTHENTICATED' | 'COMMITTEE' | 'ADMIN'; commentPermission: 'PUBLIC' | 'AUTHENTICATED' | 'COMMITTEE' | 'ADMIN'; commentsAllowed: boolean },
  ): Promise<void> {
    try {
      await this.validateCommentInteraction(actorUserId, article, board);
    } catch (error) {
      if (error instanceof NotFoundException) throw new NotFoundException('comment_not_found');
      throw error;
    }
  }

  private async validateCommentInteraction(
    actorUserId: string,
    article: { status: string; scope: 'ALL' | 'KAIST' | 'SOC' | 'AUTHOR_AND_STAFF' | 'STAFF'; authorUserId: string },
    board: { isHidden: boolean; readPermission: 'PUBLIC' | 'AUTHENTICATED' | 'COMMITTEE' | 'ADMIN'; commentPermission: 'PUBLIC' | 'AUTHENTICATED' | 'COMMITTEE' | 'ADMIN'; commentsAllowed: boolean },
  ) {
    await this.assertReadablePublishedArticle(actorUserId, article, board);
    await this.requireCommentPermission(actorUserId, board.commentPermission);
    if (!board.commentsAllowed) throw new ConflictException('comments_disabled');
  }

  private async validateReactionInteraction(
    actorUserId: string,
    article: { status: string; scope: 'ALL' | 'KAIST' | 'SOC' | 'AUTHOR_AND_STAFF' | 'STAFF'; authorUserId: string },
    board: { isHidden: boolean; readPermission: 'PUBLIC' | 'AUTHENTICATED' | 'COMMITTEE' | 'ADMIN'; reactionsAllowed: boolean },
  ) {
    await this.assertReadablePublishedArticle(actorUserId, article, board);
    if (!board.reactionsAllowed) throw new ConflictException('reactions_disabled');
  }

  private async assertDetailReadable(
    actorUserId: string | undefined,
    article: { status: string; scope: 'ALL' | 'KAIST' | 'SOC' | 'AUTHOR_AND_STAFF' | 'STAFF'; authorUserId: string },
    board: { isHidden: boolean; readPermission: 'PUBLIC' | 'AUTHENTICATED' | 'COMMITTEE' | 'ADMIN' },
  ) {
    if (article.status === 'DELETED') throw new NotFoundException('article_not_found');
    if (article.status === 'PUBLISHED') {
      await this.assertReadablePublishedArticle(actorUserId, article, board);
      return;
    }
    const manager = actorUserId ? await this.isManager(actorUserId) : false;
    if (board.isHidden && !manager) throw new NotFoundException('article_not_found');
    if (!(await this.canReadBoard(actorUserId, board.readPermission))) throw new NotFoundException('article_not_found');
    if (!actorUserId || (article.authorUserId !== actorUserId && !manager)) {
      throw new NotFoundException('article_not_found');
    }
  }

  private async assertReadablePublishedArticle(
    actorUserId: string | undefined,
    article: { status: string; scope: 'ALL' | 'KAIST' | 'SOC' | 'AUTHOR_AND_STAFF' | 'STAFF'; authorUserId: string },
    board: { isHidden: boolean; readPermission: 'PUBLIC' | 'AUTHENTICATED' | 'COMMITTEE' | 'ADMIN' },
  ) {
    const manager = actorUserId ? await this.isManager(actorUserId) : false;
    if (board.isHidden && !manager) throw new NotFoundException('article_not_found');
    if (article.status !== 'PUBLISHED') throw new NotFoundException('article_not_found');
    if (!(await this.canReadBoard(actorUserId, board.readPermission))) throw new NotFoundException('article_not_found');
    const committeeMember = article.scope === 'SOC' && actorUserId ? await this.isCommittee(actorUserId) : false;
    const allowed = article.scope === 'ALL'
      || (article.scope === 'KAIST' && Boolean(actorUserId))
      || (article.scope === 'SOC' && committeeMember)
      || (article.scope === 'AUTHOR_AND_STAFF' && Boolean(actorUserId) && (article.authorUserId === actorUserId || manager))
      || (article.scope === 'STAFF' && manager);
    if (!allowed) throw new NotFoundException('article_not_found');
  }

  private async requireCommentPermission(userId: string, permission: 'PUBLIC' | 'AUTHENTICATED' | 'COMMITTEE' | 'ADMIN') {
    if (!(await this.canReadBoard(userId, permission))) throw new ForbiddenException('insufficient_permission');
  }

  private async canReadBoard(userId: string | undefined, permission: 'PUBLIC' | 'AUTHENTICATED' | 'COMMITTEE' | 'ADMIN') {
    if (permission === 'PUBLIC') return true;
    if (!userId) return false;
    if (permission === 'AUTHENTICATED') return true;
    if (permission === 'COMMITTEE') return this.isCommittee(userId);
    return this.isManager(userId);
  }

  private asset(row: {
    id: string;
    articleId: string;
    displayOrder: number;
    type: 'IMAGE' | 'ATTACHMENT' | 'IMAGE_THUMBNAIL';
    status: 'INITIATED' | 'COMPLETED' | 'DELETED';
    contentType: string;
    byteSize: number;
    checksumSha256: string | null;
    completedAt: Date | null;
  }): Asset {
    return {
      id: row.id,
      articleId: row.articleId,
      displayOrder: row.displayOrder,
      type: row.type,
      status: row.status,
      contentType: row.contentType,
      byteSize: row.byteSize,
      checksumSha256: row.checksumSha256,
      completedAt: row.completedAt?.toISOString() ?? null,
    };
  }
  private isManager(userId: string) { return this.permissions.hasPermission(userId, 'BOARD_MANAGE', 'GLOBAL'); }
  private isCommittee(userId: string) { return this.permissions.hasPermission(userId, 'COMMITTEE_MEMBER', 'GLOBAL'); }

  private comment(row: { id: string; articleId: string; parentCommentId: string | null; authorUserId: string; body: string; status: 'PUBLISHED' | 'SECRET' | 'DELETED'; createdAt: Date; updatedAt: Date }, viewerUserId: string | undefined, manager: boolean): Comment {
    const visible = row.status === 'PUBLISHED' || (row.status === 'SECRET' && (manager || row.authorUserId === viewerUserId));
    return { id: row.id, articleId: row.articleId, parentCommentId: row.parentCommentId, body: visible ? row.body : null, status: row.status, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() };
  }

  private exactKeys(value: unknown, allowed: readonly string[], error: string): asserts value is Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)
      || Object.keys(value).some((key) => !allowed.includes(key))) {
      throw new UnprocessableEntityException(error);
    }
  }
  private patchInput(input: PatchCommentRequest): void {
    if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).length === 0
      || Object.keys(input).some((key) => key !== 'body' && key !== 'status')) throw new UnprocessableEntityException('invalid_comment');
  }

  private commentBody(value: unknown): string {
    if (typeof value !== 'string' || value.trim().length === 0 || value.length > MAX_COMMENT_LENGTH) throw new UnprocessableEntityException('invalid_comment');
    return value.trim();
  }

  private purgeAfter(now: Date): Date {
    const days = this.config.getOrThrow<number>('CONTENT_PURGE_GRACE_DAYS');
    if (!Number.isInteger(days) || days < 1 || days > 365) {
      throw new ServiceUnavailableException('invalid_content_purge_grace');
    }
    return new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
  }

  private assetProviderUnavailable(): never {
    // No provider or malware-scan adapter is wired, so enabled configuration is also fail-closed.
    throw new ServiceUnavailableException('feature_disabled');
  }

  private correlation(correlationId: string): void {
    if (typeof correlationId !== 'string' || correlationId.trim().length === 0) {
      throw new UnprocessableEntityException('invalid_correlation_id');
    }
  }
  private uuid(value: string, error: string): void {
    if (!UUID_PATTERN.test(value)) throw new UnprocessableEntityException(error);
  }
}
