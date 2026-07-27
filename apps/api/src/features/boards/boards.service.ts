import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type {
  AdminBoard,
  ArticleSummary,
  Board,
  BoardConfig,
  BoardDetailResponse,
  BoardListResponse,
  BoardPermission,
  ContentLocale,
  CreateBoardRequest,
  PatchBoardRequest,
} from '@soc/contracts';

import { Clock } from '../../shared/time/clock';
import { boards } from '../../infrastructure/postgres/postgres.schema';
import { PermissionsService } from '../permissions/permissions.service';
import { parseBoardCode } from './boards.validation';
import { BoardsRepository } from './boards.repository';

const MAX_TEXT_LENGTH = 20_000;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
type ReadCapabilities = { authenticated: boolean; committee: boolean; manager: boolean };
const PERMISSIONS: readonly BoardPermission[] = ['PUBLIC', 'AUTHENTICATED', 'COMMITTEE', 'ADMIN'];
const CORRELATION_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const BOARD_FIELDS = [
  'code', 'titleKr', 'titleEn', 'descriptionKr', 'descriptionEn', 'readPermission', 'writePermission',
  'commentPermission', 'commentsAllowed', 'secretArticlesAllowed', 'reactionsAllowed', 'displayOrder',
  'isHidden', 'showOnHome',
] as const;
const PATCH_FIELDS = BOARD_FIELDS.filter((field) => field !== 'code');

@Injectable()
export class BoardsService {
  constructor(
    @Inject(BoardsRepository) private readonly repository: BoardsRepository,
    @Inject(PermissionsService) private readonly permissions: PermissionsService,
    @Inject(Clock) private readonly clock: Clock,
  ) {}

  async list(actorUserId: string | undefined, query: unknown): Promise<BoardListResponse> {
    const { locale, home } = this.listQuery(query);
    if (!home) {
      const rows = await this.repository.listVisible();
      const capabilities = await this.readCapabilities(actorUserId, rows.map((row) => row.readPermission));
      const items: Board[] = [];
      for (const row of rows) if (this.canRead(row.readPermission, capabilities)) items.push(this.board(row, locale));
      return { locale, items };
    }

    const rows = await this.repository.listVisibleHomeWithLatest(this.clock.now());
    const capabilities = await this.readCapabilities(actorUserId, rows.map(({ board }) => board.readPermission));
    const items: BoardListResponse['items'] = [];
    for (const { board, latest } of rows) {
      if (!this.canRead(board.readPermission, capabilities)) continue;
      const item: Board & { latestArticles?: ArticleSummary[] } = this.board(board, locale);
      if (latest) item.latestArticles = [this.articleSummary(latest, board.code, locale)];
      items.push(item);
    }
    return { locale, items };
  }

  async get(actorUserId: string | undefined, code: string, localeValue: unknown): Promise<BoardDetailResponse> {
    const normalizedCode = parseBoardCode(code);
    const locale = this.locale(localeValue);
    const board = await this.repository.findVisibleByCode(normalizedCode);
    if (!board || !this.canRead(board.readPermission, await this.readCapabilities(actorUserId, [board.readPermission]))) throw new NotFoundException('board_not_found');
    return { locale, board: this.board(board, locale) };
  }

  async create(actorUserId: string, input: CreateBoardRequest, correlationId: string): Promise<AdminBoard> {
    correlationId = this.correlation(correlationId);
    await this.requireManager(actorUserId);
    const values = this.createValues(input);
    try {
      return this.adminBoard(await this.repository.create({
        actorUserId,
        correlationId,
        now: this.clock.now(),
        values,
        changedFieldNames: 'code,title,description,readPermission,writePermission,commentPermission,commentsAllowed,secretArticlesAllowed,reactionsAllowed,displayOrder,isHidden,showOnHome',
      }));
    } catch (error) {
      this.mapWriteError(error);
    }
  }

  async patch(actorUserId: string, id: string, input: PatchBoardRequest, correlationId: string): Promise<AdminBoard> {
    correlationId = this.correlation(correlationId);
    await this.requireManager(actorUserId);
    this.uuid(id);
    const values = this.patchValues(input);
    try {
      const updated = await this.repository.patch(id, {
        actorUserId,
        correlationId,
        now: this.clock.now(),
        values,
        changedFieldNames: this.changedFields(input),
      });
      if (!updated) throw new NotFoundException('board_not_found');
      return this.adminBoard(updated);
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      this.mapWriteError(error);
    }
  }

  async delete(actorUserId: string, id: string, correlationId: string): Promise<void> {
    correlationId = this.correlation(correlationId);
    await this.requireManager(actorUserId);
    this.uuid(id);
    try {
      const result = await this.repository.delete(id, actorUserId, correlationId);
      if (result === 'missing') throw new NotFoundException('board_not_found');
      if (result === 'has_articles') throw new ConflictException('board_has_articles');
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof ConflictException) throw error;
      this.mapWriteError(error);
    }
  }

  private listQuery(query: unknown): { locale: ContentLocale; home: boolean } {
    if (!query || typeof query !== 'object' || Array.isArray(query)) throw new UnprocessableEntityException('invalid_board_query');
    const source = query as Record<string, unknown>;
    for (const key of Object.keys(source)) if (key !== 'locale' && key !== 'home' && key !== 'latestLimit') {
      throw new UnprocessableEntityException('invalid_board_query');
    }
    const home = source.home === undefined ? false : source.home === true || source.home === 'true';
    if (source.home !== undefined && !home) throw new UnprocessableEntityException('invalid_board_query');
    if (source.latestLimit !== undefined && source.latestLimit !== 1 && source.latestLimit !== '1') {
      throw new UnprocessableEntityException('invalid_board_query');
    }
    if (!home && source.latestLimit !== undefined) throw new UnprocessableEntityException('invalid_board_query');
    return { locale: this.locale(source.locale), home };
  }

  private createValues(input: CreateBoardRequest) {
    this.input(input, false);
    return {
      code: parseBoardCode(input.code), titleKr: input.titleKr.trim(), titleEn: input.titleEn.trim(),
      descriptionKr: input.descriptionKr.trim(), descriptionEn: input.descriptionEn.trim(),
      readPermission: input.readPermission, writePermission: input.writePermission, commentPermission: input.commentPermission,
      commentsAllowed: input.commentsAllowed, secretArticlesAllowed: input.secretArticlesAllowed,
      reactionsAllowed: input.reactionsAllowed, displayOrder: input.displayOrder, isHidden: input.isHidden, showOnHome: input.showOnHome,
    };
  }

  private patchValues(input: PatchBoardRequest) {
    this.input(input, true);
    const result: Record<string, string | number | boolean> = {};
    for (const [key, value] of Object.entries(input)) result[key] = typeof value === 'string' && ['titleKr', 'titleEn', 'descriptionKr', 'descriptionEn'].includes(key) ? value.trim() : value as string | number | boolean;
    return result;
  }

  private input(input: unknown, patch: boolean): asserts input is CreateBoardRequest | PatchBoardRequest {
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw new UnprocessableEntityException('invalid_board');
    const source = input as Record<string, unknown>;
    const allowed = patch ? PATCH_FIELDS : BOARD_FIELDS;
    if ((patch && Object.keys(source).length === 0) || Object.keys(source).some((key) => !allowed.includes(key as never))) {
      throw new UnprocessableEntityException('invalid_board');
    }
    for (const field of BOARD_FIELDS) {
      if (patch && !(field in source)) continue;
      if (!patch && !(field in source)) throw new UnprocessableEntityException('invalid_board');
      const value = source[field];
      if (field === 'code') parseBoardCode(value);
      else if (field === 'titleKr' || field === 'titleEn' || field === 'descriptionKr' || field === 'descriptionEn') this.text(value);
      else if (field === 'readPermission' || field === 'writePermission' || field === 'commentPermission') this.permission(value);
      else if (field === 'displayOrder') this.order(value);
      else if (typeof value !== 'boolean') throw new UnprocessableEntityException('invalid_board');
    }
  }

  private canRead(permission: BoardPermission, capabilities: ReadCapabilities): boolean {
    if (permission === 'PUBLIC') return true;
    if (!capabilities.authenticated) return false;
    if (permission === 'AUTHENTICATED') return true;
    return permission === 'COMMITTEE' ? capabilities.committee : capabilities.manager;
  }

  private async readCapabilities(actorUserId: string | undefined, requiredPermissions: readonly BoardPermission[]): Promise<ReadCapabilities> {
    if (!actorUserId) return { authenticated: false, committee: false, manager: false };
    const needsCommittee = requiredPermissions.includes('COMMITTEE');
    const needsManager = requiredPermissions.includes('ADMIN');
    const [committee, manager] = await Promise.all([
      needsCommittee ? this.permissions.hasPermission(actorUserId, 'COMMITTEE_MEMBER', 'GLOBAL') : false,
      needsManager ? this.permissions.hasPermission(actorUserId, 'BOARD_MANAGE', 'GLOBAL') : false,
    ]);
    return { authenticated: true, committee, manager };
  }

  private async requireManager(actorUserId: string): Promise<void> {
    if (!(await this.permissions.hasPermission(actorUserId, 'BOARD_MANAGE', 'GLOBAL'))) throw new ForbiddenException('insufficient_permission');
  }

  private board(row: typeof boards.$inferSelect, locale: ContentLocale): Board {
    return {
      id: row.id, code: row.code,
      title: this.localized(locale, row.titleKr, row.titleEn),
      description: this.localized(locale, row.descriptionKr, row.descriptionEn),
      config: this.config(row), updatedAt: row.updatedAt.toISOString(),
    };
  }

  private articleSummary(row: { id: string; titleKr: string; titleEn: string; status: 'DRAFT' | 'PUBLISHED' | 'DELETED' | 'HIDDEN'; scope: 'ALL' | 'KAIST' | 'SOC' | 'AUTHOR_AND_STAFF' | 'STAFF'; isPinned: boolean; pinnedOrder: number | null; publishedAt: Date | null; updatedAt: Date }, boardCode: string, locale: ContentLocale): ArticleSummary {
    return { id: row.id, boardCode, title: this.localized(locale, row.titleKr, row.titleEn), status: row.status, scope: row.scope, isPinned: row.isPinned, pinnedOrder: row.pinnedOrder, publishedAt: row.publishedAt?.toISOString() ?? null, updatedAt: row.updatedAt.toISOString() };
  }

  private adminBoard(row: typeof boards.$inferSelect): AdminBoard {
    return { id: row.id, code: row.code, titleKr: row.titleKr, titleEn: row.titleEn, descriptionKr: row.descriptionKr, descriptionEn: row.descriptionEn, ...this.config(row), createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() };
  }

  private config(row: typeof boards.$inferSelect): BoardConfig {
    return { readPermission: row.readPermission, writePermission: row.writePermission, commentPermission: row.commentPermission, commentsAllowed: row.commentsAllowed, secretArticlesAllowed: row.secretArticlesAllowed, reactionsAllowed: row.reactionsAllowed, displayOrder: row.displayOrder, isHidden: row.isHidden, showOnHome: row.showOnHome };
  }

  private localized(locale: ContentLocale, kr: string, en: string) { const value = locale === 'ko' ? kr : en; return { value: value || null, translationUnavailable: !value }; }
  private locale(value: unknown): ContentLocale { if (value === undefined || value === 'ko') return 'ko'; if (value === 'en') return 'en'; throw new UnprocessableEntityException('invalid_locale'); }
  private text(value: unknown): asserts value is string { if (typeof value !== 'string' || value.trim().length === 0 || value.length > MAX_TEXT_LENGTH) throw new UnprocessableEntityException('invalid_board'); }
  private permission(value: unknown): asserts value is BoardPermission { if (!PERMISSIONS.includes(value as BoardPermission)) throw new UnprocessableEntityException('invalid_board'); }
  private order(value: unknown): asserts value is number { if (!Number.isInteger(value) || (value as number) < 0 || (value as number) > 2_147_483_647) throw new UnprocessableEntityException('invalid_board_order'); }
  private uuid(value: unknown): asserts value is string { if (typeof value !== 'string' || !UUID_PATTERN.test(value)) throw new UnprocessableEntityException('invalid_board'); }
  private correlation(value: unknown): string { if (typeof value !== 'string' || !CORRELATION_ID_PATTERN.test(value)) throw new UnprocessableEntityException('invalid_correlation_id'); return value; }
  private changedFields(input: PatchBoardRequest): string { return [...new Set(Object.keys(input).map((key) => key === 'titleKr' || key === 'titleEn' ? 'title' : key === 'descriptionKr' || key === 'descriptionEn' ? 'description' : key))].join(','); }

  private mapWriteError(error: unknown): never {
    let current: unknown = error;
    while (current && typeof current === 'object') {
      const code = (current as { code?: string }).code;
      if (code === '23505') throw new ConflictException('board_conflict');
      if (code === '23514') throw new UnprocessableEntityException('invalid_board');
      if (code === '40001' || code === '40P01') throw new ServiceUnavailableException('board_operation_unavailable', { cause: error });
      current = (current as { cause?: unknown }).cause;
    }
    throw error;
  }
}
