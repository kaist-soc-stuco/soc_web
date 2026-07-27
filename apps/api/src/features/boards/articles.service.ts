import { ConflictException, ForbiddenException, Injectable, NotFoundException, ServiceUnavailableException, UnprocessableEntityException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Article, ArticleListResponse, ArticleScope, ArticleStatus, ContentLocale, CreateArticleRequest, PatchArticleRequest } from '@soc/contracts';

import { Clock } from '../../shared/time/clock';
import { PermissionsService } from '../permissions/permissions.service';
import { ArticlesRepository, type ArticleRow, type BoardRow } from './articles.repository';
import { parseBoardCode } from './boards.validation';
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_TEXT_LENGTH = 20_000;
const MAX_PAGE_SIZE = 50;
const ARTICLE_SCOPES: ArticleScope[] = ['ALL', 'KAIST', 'SOC', 'AUTHOR_AND_STAFF', 'STAFF'];
const ARTICLE_STATUSES: ArticleStatus[] = ['DRAFT', 'PUBLISHED', 'HIDDEN', 'DELETED'];
const CORRELATION_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

@Injectable()
export class ArticlesService {
  constructor(
    private readonly repository: ArticlesRepository,
    private readonly permissions: PermissionsService,
    private readonly clock: Clock,
    private readonly config: ConfigService,
  ) {}

  async list(actorUserId: string | undefined, boardCode: string, query: { locale?: unknown; cursor?: unknown; limit?: unknown }): Promise<ArticleListResponse> {
    const locale = this.locale(query.locale);
    const board = await this.board(boardCode);
    await this.requireBoardRead(actorUserId, board);
    const limit = this.limit(query.limit);
    const cursor = this.cursor(query.cursor);
    const rows = await this.repository.list(board.id, await this.visibleScopes(actorUserId), actorUserId, cursor, limit + 1);
    const hasMore = rows.length > limit;
    const items = rows.slice(0, limit);
    const last = items.at(-1);
    return { locale, items: items.map((row) => this.articleSummary(row, board.code, locale)), nextCursor: hasMore && last ? this.encodeCursor(last) : null };
  }

  async get(actorUserId: string | undefined, id: string, localeValue: unknown): Promise<Article> {
    this.uuid(id);
    const locale = this.locale(localeValue);
    const row = await this.repository.findArticleWithBoardById(id);
    if (!row || row.article.status === 'DELETED') throw new NotFoundException('article_not_found');
    try {
      await this.requireBoardRead(actorUserId, row.board);
    } catch (error) {
      if (error instanceof NotFoundException) throw new NotFoundException('article_not_found');
      throw error;
    }
    if (!await this.canReadArticle(actorUserId, row.article)) throw new NotFoundException('article_not_found');
    return this.article(row.article, row.board.code, locale);
  }

  async create(actorUserId: string, boardCode: string, input: CreateArticleRequest, correlationId: string): Promise<Article> {
    correlationId = this.correlation(correlationId);
    this.uuid(actorUserId);
    const normalizedBoardCode = parseBoardCode(boardCode);
    const normalized = this.createInput(input);
    const now = this.clock.now();
    const created = await this.write(() => this.repository.create(normalizedBoardCode, actorUserId, correlationId, async (board) => {
      const manager = await this.isManager(actorUserId);
      await this.requireBoardRead(actorUserId, board);
      await this.requireBoardWrite(actorUserId, board);
      if ((normalized.isPinned || normalized.pinnedOrder !== null) && !manager) throw new ForbiddenException('insufficient_permission');
      if (this.isSecretScope(normalized.scope) && !board.secretArticlesAllowed) throw new ConflictException('secret_articles_not_allowed');
      return { ...normalized, boardId: board.id, authorUserId: actorUserId, status: 'DRAFT', createdAt: now, updatedAt: now };
    }));
    if (!created) throw new NotFoundException('board_not_found');
    return this.article(created.article, created.board.code, 'ko');
  }

  async patch(actorUserId: string, id: string, input: PatchArticleRequest, correlationId: string): Promise<Article> {
    correlationId = this.correlation(correlationId);
    this.uuid(actorUserId); this.uuid(id);
    const patch = this.patchInput(input);
    if (patch.status === 'PUBLISHED') throw new ConflictException('invalid_article_transition');
    const updated = await this.write(() => this.repository.patch(id, actorUserId, correlationId, async (current, board) => {
      const manager = await this.assertMutationAllowed(current, board, actorUserId);
      const merged = { ...current, ...patch };
      this.validatePinned(merged.isPinned, merged.pinnedOrder);
      if ((patch.isPinned !== undefined || patch.pinnedOrder !== undefined) && !manager) throw new ForbiddenException('insufficient_permission');
      if (patch.scope && this.isSecretScope(patch.scope) && !board.secretArticlesAllowed) throw new ConflictException('secret_articles_not_allowed');
      const status = patch.status ?? current.status;
      this.transition(current.status, status);
      const now = this.clock.now();
      return {
        values: { ...patch, publishedAt: current.publishedAt, updatedAt: now },
        changedFieldNames: this.changedFields(patch),
      };
    }));
    if (!updated) throw new NotFoundException('article_not_found');
    return this.article(updated.article, updated.board.code, 'ko');
  }

  async publish(actorUserId: string, id: string, correlationId: string): Promise<Article> {
    correlationId = this.correlation(correlationId);
    this.uuid(actorUserId); this.uuid(id);
    const updated = await this.write(() => this.repository.publish(id, actorUserId, correlationId, async (current, board) => {
      await this.assertMutationAllowed(current, board, actorUserId);
      if (this.isSecretScope(current.scope) && !board.secretArticlesAllowed) {
        throw new ConflictException('secret_articles_not_allowed');
      }
      if (current.status !== 'DRAFT' && current.status !== 'HIDDEN') throw new ConflictException('invalid_article_transition');
      const now = this.clock.now();
      return { status: 'PUBLISHED', publishedAt: now, updatedAt: now };
    }));
    if (!updated) throw new NotFoundException('article_not_found');
    return this.article(updated.article, updated.board.code, 'ko');
  }

  async softDelete(actorUserId: string, id: string, correlationId: string): Promise<void> {
    correlationId = this.correlation(correlationId);
    this.uuid(actorUserId); this.uuid(id);
    const graceDays = this.purgeGraceDays();
    const deleted = await this.write(() => this.repository.softDelete(id, actorUserId, correlationId, async (current, board) => {
      await this.assertMutationAllowed(current, board, actorUserId);
      if (current.status === 'DELETED') throw new ConflictException('article_already_deleted');
      const now = this.clock.now();
      return { status: 'DELETED', deletedAt: now, purgeAfter: new Date(now.getTime() + graceDays * 86_400_000), updatedAt: now };
    }));
    if (!deleted) throw new NotFoundException('article_not_found');
  }

  private async board(code: string): Promise<BoardRow> {
    const board = await this.repository.findBoardByCode(parseBoardCode(code));
    if (!board) throw new NotFoundException('board_not_found');
    return board;
  }

  private async requireBoardRead(actorUserId: string | undefined, board: BoardRow): Promise<void> {
    if (board.isHidden && !await this.isManager(actorUserId)) throw new NotFoundException('board_not_found');
    if (board.readPermission === 'PUBLIC') return;
    if (!actorUserId) throw new NotFoundException('board_not_found');
    if (board.readPermission === 'AUTHENTICATED') return;
    if (board.readPermission === 'COMMITTEE' && await this.isCommittee(actorUserId)) return;
    if (board.readPermission === 'ADMIN' && await this.isManager(actorUserId)) return;
    throw new NotFoundException('board_not_found');
  }

  private async requireBoardWrite(actorUserId: string, board: BoardRow): Promise<void> {
    if (board.writePermission === 'PUBLIC' || board.writePermission === 'AUTHENTICATED') return;
    if (board.writePermission === 'COMMITTEE' && await this.isCommittee(actorUserId)) return;
    if (board.writePermission === 'ADMIN' && await this.isManager(actorUserId)) return;
    throw new ForbiddenException('insufficient_permission');
  }

  private async visibleScopes(actorUserId: string | undefined): Promise<ArticleScope[]> {
    if (!actorUserId) return ['ALL'];
    const scopes: ArticleScope[] = ['ALL', 'KAIST'];
    if (await this.isCommittee(actorUserId)) scopes.push('SOC');
    if (await this.isManager(actorUserId)) scopes.push('STAFF', 'AUTHOR_AND_STAFF');
    return scopes;
  }

  private async canReadArticle(actorUserId: string | undefined, article: ArticleRow): Promise<boolean> {
    if (article.status !== 'PUBLISHED') return actorUserId !== undefined && (article.authorUserId === actorUserId || await this.isManager(actorUserId));
    if (article.scope === 'ALL') return true;
    if (!actorUserId) return false;
    if (article.scope === 'KAIST') return true;
    if (article.scope === 'SOC') return this.isCommittee(actorUserId);
    if (article.scope === 'AUTHOR_AND_STAFF') return article.authorUserId === actorUserId || this.isManager(actorUserId);
    return this.isManager(actorUserId);
  }

  private async assertMutationAllowed(article: ArticleRow, board: BoardRow, actorUserId: string): Promise<boolean> {
    try {
      await this.requireBoardRead(actorUserId, board);
    } catch (error) {
      if (error instanceof NotFoundException) throw new NotFoundException('article_not_found');
      throw error;
    }
    const manager = await this.isManager(actorUserId);
    if (!manager && article.authorUserId !== actorUserId) throw new NotFoundException('article_not_found');
    await this.requireBoardWrite(actorUserId, board);
    return manager;
  }

  private createInput(input: CreateArticleRequest) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw new UnprocessableEntityException('invalid_article');
    const allowed = new Set(['titleKr', 'titleEn', 'bodyKr', 'bodyEn', 'scope', 'isPinned', 'pinnedOrder']);
    if (Object.keys(input).some((key) => !allowed.has(key))) throw new UnprocessableEntityException('invalid_article');
    const scope = input.scope;
    if (!ARTICLE_SCOPES.includes(scope)) throw new UnprocessableEntityException('invalid_article_scope');
    const isPinned = input.isPinned ?? false;
    const pinnedOrder = input.pinnedOrder ?? null;
    this.validatePinned(isPinned, pinnedOrder);
    return { titleKr: this.text(input.titleKr), titleEn: this.text(input.titleEn), bodyKr: this.text(input.bodyKr), bodyEn: this.text(input.bodyEn), scope, isPinned, pinnedOrder };
  }

  private patchInput(input: PatchArticleRequest): Partial<CreateArticleRequest> & { status?: Exclude<ArticleStatus, 'DELETED'> } {
    if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).length === 0) throw new UnprocessableEntityException('invalid_article');
    const allowed = new Set(['titleKr', 'titleEn', 'bodyKr', 'bodyEn', 'scope', 'isPinned', 'pinnedOrder', 'status']);
    let statusValue: unknown;
    for (const [key, value] of Object.entries(input)) {
      if (!allowed.has(key) || (value === null && key !== 'pinnedOrder')) throw new UnprocessableEntityException('invalid_article');
      if (key === 'status') statusValue = value;
    }
    if (input.scope !== undefined && !ARTICLE_SCOPES.includes(input.scope)) throw new UnprocessableEntityException('invalid_article_scope');
    if (statusValue !== undefined && (!ARTICLE_STATUSES.some((status) => status === statusValue) || statusValue === 'DELETED')) throw new UnprocessableEntityException('invalid_article_status');
    if (input.isPinned !== undefined && typeof input.isPinned !== 'boolean') throw new UnprocessableEntityException('invalid_article_pinned');
    if (input.pinnedOrder !== undefined && input.pinnedOrder !== null && (!Number.isSafeInteger(input.pinnedOrder) || input.pinnedOrder < 0)) throw new UnprocessableEntityException('invalid_article_pinned');
    return {
      ...(input.titleKr === undefined ? {} : { titleKr: this.text(input.titleKr) }),
      ...(input.titleEn === undefined ? {} : { titleEn: this.text(input.titleEn) }),
      ...(input.bodyKr === undefined ? {} : { bodyKr: this.text(input.bodyKr) }),
      ...(input.bodyEn === undefined ? {} : { bodyEn: this.text(input.bodyEn) }),
      ...(input.scope === undefined ? {} : { scope: input.scope }),
      ...(input.isPinned === undefined ? {} : { isPinned: input.isPinned }),
      ...(input.pinnedOrder === undefined ? {} : { pinnedOrder: input.pinnedOrder }),
      ...(input.status === undefined ? {} : { status: input.status }),
    };
  }

  private transition(from: ArticleStatus, to: ArticleStatus): void {
    if (from === 'DELETED' || (from === 'PUBLISHED' && to === 'DRAFT') || (from === 'HIDDEN' && to === 'DRAFT')) throw new ConflictException('invalid_article_transition');
  }

  private validatePinned(isPinned: boolean, pinnedOrder: number | null): void {
    if (typeof isPinned !== 'boolean' || (pinnedOrder !== null && (!Number.isSafeInteger(pinnedOrder) || pinnedOrder < 0)) || (isPinned !== (pinnedOrder !== null))) throw new UnprocessableEntityException('invalid_article_pinned');
  }

  private changedFields(patch: object): string {
    const fields = new Set(Object.keys(patch).map((key) => key === 'titleKr' || key === 'titleEn' ? 'title' : key === 'bodyKr' || key === 'bodyEn' ? 'body' : key));
    return [...fields].join(',');
  }

  private articleSummary(article: ArticleRow, boardCode: string, locale: ContentLocale) {
    return { id: article.id, boardCode, title: this.localized(article.titleKr, article.titleEn, locale), status: article.status, scope: article.scope, isPinned: article.isPinned, pinnedOrder: article.pinnedOrder, publishedAt: article.publishedAt?.toISOString() ?? null, updatedAt: article.updatedAt.toISOString() };
  }

  private article(article: ArticleRow, boardCode: string, locale: ContentLocale): Article {
    return { ...this.articleSummary(article, boardCode, locale), body: this.localized(article.bodyKr, article.bodyEn, locale), deletedAt: article.deletedAt?.toISOString() ?? null };
  }

  private localized(kr: string, en: string, locale: ContentLocale) { const value = locale === 'ko' ? kr : en; return { value: value || null, translationUnavailable: !value }; }
  private locale(value: unknown): ContentLocale { if (value === undefined || value === 'ko') return 'ko'; if (value === 'en') return 'en'; throw new UnprocessableEntityException('invalid_locale'); }
  private text(value: unknown): string { if (typeof value !== 'string' || value.trim().length === 0 || value.length > MAX_TEXT_LENGTH) throw new UnprocessableEntityException('invalid_article'); return value.trim(); }
  private uuid(value: string): void { if (!UUID_PATTERN.test(value)) throw new UnprocessableEntityException('invalid_article_id'); }
  private correlation(value: unknown): string { if (typeof value !== 'string' || !CORRELATION_ID_PATTERN.test(value)) throw new UnprocessableEntityException('invalid_correlation_id'); return value; }
  private isSecretScope(scope: ArticleScope): boolean { return scope === 'AUTHOR_AND_STAFF' || scope === 'STAFF'; }
  private async isManager(userId: string | undefined): Promise<boolean> { return !!userId && this.permissions.hasPermission(userId, 'BOARD_MANAGE', 'GLOBAL'); }
  private async isCommittee(userId: string): Promise<boolean> { return this.permissions.hasPermission(userId, 'COMMITTEE_MEMBER', 'GLOBAL'); }
  private limit(value: unknown): number { if (value === undefined) return 20; const parsed = typeof value === 'number' ? value : typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : NaN; if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > MAX_PAGE_SIZE) throw new UnprocessableEntityException('invalid_article_limit'); return parsed; }
  private encodeCursor(article: ArticleRow): string {
    return Buffer.from(JSON.stringify({ n: article.isPinned, o: article.pinnedOrder, p: article.publishedAt!.toISOString(), i: article.id })).toString('base64url');
  }

  private cursor(value: unknown): { isPinned: boolean; pinnedOrder: number | null; publishedAt: Date; id: string } | null {
    if (value === undefined) return null;
    if (typeof value !== 'string' || value.length > 256) throw new UnprocessableEntityException('invalid_article_cursor');
    try {
      const parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
      if (!parsed || typeof parsed.n !== 'boolean' || (parsed.o !== null && (!Number.isSafeInteger(parsed.o) || parsed.o < 0)) || (parsed.n !== (parsed.o !== null)) || typeof parsed.p !== 'string' || typeof parsed.i !== 'string' || !UUID_PATTERN.test(parsed.i)) throw new Error();
      const publishedAt = new Date(parsed.p);
      if (!Number.isFinite(publishedAt.getTime()) || publishedAt.toISOString() !== parsed.p) throw new Error();
      return { isPinned: parsed.n, pinnedOrder: parsed.o, publishedAt, id: parsed.i };
    } catch { throw new UnprocessableEntityException('invalid_article_cursor'); }
  }
  private async write<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      let current: unknown = error;
      while (current && typeof current === 'object') {
        const code = (current as { code?: string }).code;
        if (code === '40001' || code === '40P01') {
          throw new ServiceUnavailableException('article_operation_unavailable', { cause: error });
        }
        current = (current as { cause?: unknown }).cause;
      }
      throw error;
    }
  }
  private purgeGraceDays(): number {
    const days = this.config.getOrThrow<number>('CONTENT_PURGE_GRACE_DAYS');
    if (!Number.isInteger(days) || days < 1 || days > 365) {
      throw new ServiceUnavailableException('invalid_content_purge_grace');
    }
    return days;
  }
}
