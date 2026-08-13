import { UnprocessableEntityException } from '@nestjs/common';
import type {
  ArticleListQuery,
  AssetType,
  BoardListQuery,
  BoardPermission,
  CompleteAssetRequest,
  ContentLocale,
  CreateArticleRequest,
  CreateBoardRequest,
  CreateCommentRequest,
  InitiateAssetRequest,
  PatchArticleRequest,
  VersionedPatchBoardRequest,
  DeleteBoardRequest,
  PatchCommentRequest,
  PutArticleReactionRequest,
} from '@soc/contracts';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const BOARD_CODE_PATTERN = /^[A-Za-z][A-Za-z0-9_-]{0,63}$/;
const CHECKSUM_PATTERN = /^[0-9a-f]{64}$/i;
const MIME_TYPE_PATTERN = /^[!#$%&'*+.^_`|~0-9A-Za-z-]+\/[!#$%&'*+.^_`|~0-9A-Za-z-]+$/;
const CURSOR_PATTERN = /^[A-Za-z0-9_-]{1,256}$/;
const POSITIVE_DECIMAL_PATTERN = /^[1-9][0-9]*$/;
const MAX_TEXT_LENGTH = 20_000;
const MAX_PAGE_SIZE = 50;
const MAX_DATABASE_INTEGER = 2_147_483_647;

function fail(code: string): never {
  throw new UnprocessableEntityException(code);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function plainObject(value: unknown, code: string): Record<string, unknown> {
  if (!isPlainObject(value)) fail(code);
  return value;
}

function objectWithAllowedKeys(value: unknown, allowedKeys: readonly string[], code: string, requireNonEmpty = false): Record<string, unknown> {
  const object = plainObject(value, code);
  const keys = Object.keys(object);
  if ((requireNonEmpty && keys.length === 0) || keys.some((key) => !allowedKeys.includes(key))) fail(code);
  return object;
}

function required(object: Record<string, unknown>, key: string, code: string): unknown {
  if (!Object.prototype.hasOwnProperty.call(object, key) || object[key] === undefined) fail(code);
  return object[key];
}

function text(value: unknown, code: string): string {
  if (typeof value !== 'string' || value.trim().length === 0 || value.length > MAX_TEXT_LENGTH) fail(code);
  return value.trim();
}

function locale(value: unknown): ContentLocale {
  if (value === 'ko') return 'ko';
  if (value === 'en') return 'en';
  fail('invalid_locale');
}

function queryLocale(value: unknown): ContentLocale | undefined {
  if (value === undefined) return undefined;
  return locale(value);
}

function detailQuery(value: unknown, code: string): { locale?: ContentLocale } {
  const query = objectWithAllowedKeys(value, ['locale'], code);
  const parsedLocale = queryLocale(query.locale);
  return parsedLocale === undefined ? {} : { locale: parsedLocale };
}

function booleanQuery(value: unknown, code: string): true | undefined {
  if (value === undefined) return undefined;
  if (value === 'true') return true;
  fail(code);
}

function positiveQueryInteger(value: unknown, maximum: number, code: string): number | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || !POSITIVE_DECIMAL_PATTERN.test(value)) fail(code);
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed > maximum) fail(code);
  return parsed;
}

function boolean(value: unknown, code: string): boolean {
  if (typeof value !== 'boolean') fail(code);
  return value;
}

function nonNegativeDatabaseInteger(value: unknown, code: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0 || value > MAX_DATABASE_INTEGER) fail(code);
  return value;
}

function positiveDatabaseInteger(value: unknown, code: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1 || value > MAX_DATABASE_INTEGER) fail(code);
  return value;
}

function boardPermission(value: unknown): BoardPermission {
  if (value === 'PUBLIC' || value === 'AUTHENTICATED' || value === 'COMMITTEE' || value === 'ADMIN') return value;
  fail('invalid_board');
}

function articleScope(value: unknown): CreateArticleRequest['scope'] {
  if (value === 'ALL' || value === 'KAIST' || value === 'SOC' || value === 'AUTHOR_AND_STAFF' || value === 'STAFF') return value;
  fail('invalid_article_scope');
}

function articleStatus(value: unknown): NonNullable<PatchArticleRequest['status']> {
  if (value === 'DRAFT' || value === 'HIDDEN') return value;
  fail('invalid_article_status');
}

function commentStatus(value: unknown): NonNullable<CreateCommentRequest['status']> {
  if (value === 'PUBLISHED' || value === 'SECRET') return value;
  fail('invalid_comment');
}

function assetType(value: unknown): AssetType {
  if (value === 'IMAGE' || value === 'ATTACHMENT' || value === 'IMAGE_THUMBNAIL') return value;
  fail('invalid_asset');
}

function pinnedOrder(value: unknown): number | null {
  if (value === null) return null;
  return nonNegativeDatabaseInteger(value, 'invalid_article_pinned');
}

function validatePinned(isPinned: boolean, order: number | null): void {
  if (isPinned !== (order !== null)) fail('invalid_article_pinned');
}

function checksum(value: unknown): string {
  if (typeof value !== 'string' || !CHECKSUM_PATTERN.test(value)) fail('invalid_asset');
  return value.toLowerCase();
}

function contentType(value: unknown): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > 255 || !MIME_TYPE_PATTERN.test(value)) fail('invalid_asset');
  return value;
}

export function parseBoardCode(value: unknown): string {
  if (typeof value !== 'string') fail('invalid_board_code');
  const code = value.trim();
  if (!BOARD_CODE_PATTERN.test(code)) fail('invalid_board_code');
  return code;
}

export function parseUuid(value: unknown, code: string): string {
  if (typeof value !== 'string' || !UUID_PATTERN.test(value)) fail(code);
  return value;
}

export function parseBoardId(value: unknown): string { return parseUuid(value, 'invalid_board_id'); }
export function parseArticleId(value: unknown): string { return parseUuid(value, 'invalid_article_id'); }
export function parseCommentId(value: unknown): string { return parseUuid(value, 'invalid_comment_id'); }
export function parseParentCommentId(value: unknown): string { return parseUuid(value, 'invalid_parent_comment_id'); }
export function parseAssetId(value: unknown): string { return parseUuid(value, 'invalid_asset_id'); }

export function parseBoardListQuery(value: unknown): BoardListQuery {
  const query = objectWithAllowedKeys(value, ['locale', 'home', 'latestLimit'], 'invalid_board_query');
  const home = booleanQuery(query.home, 'invalid_board_query');
  const latestLimit = positiveQueryInteger(query.latestLimit, 5, 'invalid_board_query') as BoardListQuery['latestLimit'] | undefined;
  if (latestLimit !== undefined && home !== true) fail('invalid_board_query');
  const result: BoardListQuery = {};
  const parsedLocale = queryLocale(query.locale);
  if (parsedLocale !== undefined) result.locale = parsedLocale;
  if (home !== undefined) result.home = home;
  if (latestLimit !== undefined) result.latestLimit = latestLimit;
  return result;
}

export function parseBoardDetailQuery(value: unknown): { locale?: ContentLocale } {
  return detailQuery(value, 'invalid_board_query');
}

export function parseArticleListQuery(value: unknown): ArticleListQuery {
  const query = objectWithAllowedKeys(value, ['locale', 'cursor', 'limit'], 'invalid_article_query');
  if (query.cursor !== undefined && (typeof query.cursor !== 'string' || !CURSOR_PATTERN.test(query.cursor))) fail('invalid_article_cursor');
  const result: ArticleListQuery = {};
  const parsedLocale = queryLocale(query.locale);
  const limit = positiveQueryInteger(query.limit, MAX_PAGE_SIZE, 'invalid_article_limit');
  if (parsedLocale !== undefined) result.locale = parsedLocale;
  if (query.cursor !== undefined) result.cursor = query.cursor;
  if (limit !== undefined) result.limit = limit;
  return result;
}

export function parseArticleDetailQuery(value: unknown): { locale?: ContentLocale } {
  return detailQuery(value, 'invalid_article_query');
}

export function parseCreateBoardRequest(value: unknown): CreateBoardRequest {
  const input = objectWithAllowedKeys(value, ['code', 'titleKr', 'titleEn', 'descriptionKr', 'descriptionEn', 'readPermission', 'writePermission', 'commentPermission', 'commentsAllowed', 'secretArticlesAllowed', 'reactionsAllowed', 'displayOrder', 'isHidden', 'showOnHome'], 'invalid_board');
  return {
    code: parseBoardCode(required(input, 'code', 'invalid_board')),
    titleKr: text(required(input, 'titleKr', 'invalid_board'), 'invalid_board'),
    titleEn: text(required(input, 'titleEn', 'invalid_board'), 'invalid_board'),
    descriptionKr: text(required(input, 'descriptionKr', 'invalid_board'), 'invalid_board'),
    descriptionEn: text(required(input, 'descriptionEn', 'invalid_board'), 'invalid_board'),
    readPermission: boardPermission(required(input, 'readPermission', 'invalid_board')),
    writePermission: boardPermission(required(input, 'writePermission', 'invalid_board')),
    commentPermission: boardPermission(required(input, 'commentPermission', 'invalid_board')),
    commentsAllowed: boolean(required(input, 'commentsAllowed', 'invalid_board'), 'invalid_board'),
    secretArticlesAllowed: boolean(required(input, 'secretArticlesAllowed', 'invalid_board'), 'invalid_board'),
    reactionsAllowed: boolean(required(input, 'reactionsAllowed', 'invalid_board'), 'invalid_board'),
    displayOrder: nonNegativeDatabaseInteger(required(input, 'displayOrder', 'invalid_board'), 'invalid_board_order'),
    isHidden: boolean(required(input, 'isHidden', 'invalid_board'), 'invalid_board'),
    showOnHome: boolean(required(input, 'showOnHome', 'invalid_board'), 'invalid_board'),
  };
}

function boardVersion(value: unknown): string {
  if (typeof value !== 'string') fail('invalid_board_version');
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString() !== value) fail('invalid_board_version');
  return value;
}

export function parsePatchBoardRequest(value: unknown): VersionedPatchBoardRequest {
  const input = objectWithAllowedKeys(value, ['expectedUpdatedAt', 'titleKr', 'titleEn', 'descriptionKr', 'descriptionEn', 'readPermission', 'writePermission', 'commentPermission', 'commentsAllowed', 'secretArticlesAllowed', 'reactionsAllowed', 'displayOrder', 'isHidden', 'showOnHome'], 'invalid_board');
  const expectedUpdatedAt = boardVersion(required(input, 'expectedUpdatedAt', 'invalid_board_version'));
  const result: VersionedPatchBoardRequest = { expectedUpdatedAt };
  const mutableKeys = Object.keys(input).filter((key) => key !== 'expectedUpdatedAt');
  if (mutableKeys.length === 0) fail('invalid_board');
  if ('titleKr' in input) result.titleKr = text(input.titleKr, 'invalid_board');
  if ('titleEn' in input) result.titleEn = text(input.titleEn, 'invalid_board');
  if ('descriptionKr' in input) result.descriptionKr = text(input.descriptionKr, 'invalid_board');
  if ('descriptionEn' in input) result.descriptionEn = text(input.descriptionEn, 'invalid_board');
  if ('readPermission' in input) result.readPermission = boardPermission(input.readPermission);
  if ('writePermission' in input) result.writePermission = boardPermission(input.writePermission);
  if ('commentPermission' in input) result.commentPermission = boardPermission(input.commentPermission);
  if ('commentsAllowed' in input) result.commentsAllowed = boolean(input.commentsAllowed, 'invalid_board');
  if ('secretArticlesAllowed' in input) result.secretArticlesAllowed = boolean(input.secretArticlesAllowed, 'invalid_board');
  if ('reactionsAllowed' in input) result.reactionsAllowed = boolean(input.reactionsAllowed, 'invalid_board');
  if ('displayOrder' in input) result.displayOrder = nonNegativeDatabaseInteger(input.displayOrder, 'invalid_board_order');
  if ('isHidden' in input) result.isHidden = boolean(input.isHidden, 'invalid_board');
  if ('showOnHome' in input) result.showOnHome = boolean(input.showOnHome, 'invalid_board');
  return result;
}

export function parseDeleteBoardRequest(value: unknown): DeleteBoardRequest {
  const input = objectWithAllowedKeys(value, ['expectedUpdatedAt'], 'invalid_board');
  return { expectedUpdatedAt: boardVersion(required(input, 'expectedUpdatedAt', 'invalid_board_version')) };
}

export function parseCreateArticleRequest(value: unknown): CreateArticleRequest {
  const input = objectWithAllowedKeys(value, ['title', 'body', 'titleKr', 'titleEn', 'bodyKr', 'bodyEn', 'scope', 'isPinned', 'pinnedOrder'], 'invalid_article');
  const isPinned = input.isPinned === undefined ? false : boolean(input.isPinned, 'invalid_article_pinned');
  const order = input.pinnedOrder === undefined ? null : pinnedOrder(input.pinnedOrder);
  validatePinned(isPinned, order);
  const result: CreateArticleRequest = { scope: articleScope(required(input, 'scope', 'invalid_article')) };
  for (const key of ['title', 'body', 'titleKr', 'titleEn', 'bodyKr', 'bodyEn'] as const) {
    if (key in input) result[key] = text(input[key], 'invalid_article');
  }
  if (input.isPinned !== undefined) result.isPinned = isPinned;
  if (input.pinnedOrder !== undefined) result.pinnedOrder = order;
  return result;
}

export function parsePatchArticleRequest(value: unknown): PatchArticleRequest {
  const input = objectWithAllowedKeys(value, ['titleKr', 'titleEn', 'bodyKr', 'bodyEn', 'scope', 'isPinned', 'pinnedOrder', 'status'], 'invalid_article', true);
  const result: PatchArticleRequest = {};
  if ('titleKr' in input) result.titleKr = text(input.titleKr, 'invalid_article');
  if ('titleEn' in input) result.titleEn = text(input.titleEn, 'invalid_article');
  if ('bodyKr' in input) result.bodyKr = text(input.bodyKr, 'invalid_article');
  if ('bodyEn' in input) result.bodyEn = text(input.bodyEn, 'invalid_article');
  if ('scope' in input) result.scope = articleScope(input.scope);
  if ('status' in input) result.status = articleStatus(input.status);
  const isPinned = 'isPinned' in input ? boolean(input.isPinned, 'invalid_article_pinned') : undefined;
  const order = 'pinnedOrder' in input ? pinnedOrder(input.pinnedOrder) : undefined;
  if (isPinned !== undefined && order !== undefined) validatePinned(isPinned, order);
  if (isPinned !== undefined) result.isPinned = isPinned;
  if (order !== undefined) result.pinnedOrder = order;
  return result;
}

export function parseCreateCommentRequest(value: unknown): CreateCommentRequest {
  const input = objectWithAllowedKeys(value, ['parentCommentId', 'body', 'status'], 'invalid_comment');
  const result: CreateCommentRequest = { body: text(required(input, 'body', 'invalid_comment'), 'invalid_comment') };
  if ('parentCommentId' in input) result.parentCommentId = input.parentCommentId === null ? null : parseParentCommentId(input.parentCommentId);
  if ('status' in input) result.status = commentStatus(input.status);
  return result;
}

export function parsePatchCommentRequest(value: unknown): PatchCommentRequest {
  const input = objectWithAllowedKeys(value, ['body', 'status'], 'invalid_comment', true);
  const result: PatchCommentRequest = {};
  if ('body' in input) result.body = text(input.body, 'invalid_comment');
  if ('status' in input) result.status = commentStatus(input.status);
  return result;
}

export function parsePutArticleReactionRequest(value: unknown): PutArticleReactionRequest {
  const input = objectWithAllowedKeys(value, ['type'], 'invalid_reaction');
  const type = required(input, 'type', 'invalid_reaction');
  if (type !== 'LIKE') fail('invalid_reaction');
  return { type };
}

export function parseInitiateAssetRequest(value: unknown): InitiateAssetRequest {
  const input = objectWithAllowedKeys(value, ['displayOrder', 'type', 'contentType', 'byteSize', 'checksumSha256'], 'invalid_asset');
  const result: InitiateAssetRequest = {
    displayOrder: nonNegativeDatabaseInteger(required(input, 'displayOrder', 'invalid_asset'), 'invalid_asset'),
    type: assetType(required(input, 'type', 'invalid_asset')),
    contentType: contentType(required(input, 'contentType', 'invalid_asset')),
    byteSize: positiveDatabaseInteger(required(input, 'byteSize', 'invalid_asset'), 'invalid_asset'),
  };
  if ('checksumSha256' in input) result.checksumSha256 = checksum(input.checksumSha256);
  return result;
}

export function parseCompleteAssetRequest(value: unknown): CompleteAssetRequest {
  const input = objectWithAllowedKeys(value, ['checksumSha256'], 'invalid_asset');
  return 'checksumSha256' in input ? { checksumSha256: checksum(input.checksumSha256) } : {};
}
