import type {
  AdminBoard, AdminBoardListResponse, AppErrorResponse, Article, ArticleDetailResponse, ArticleListQuery, ArticleListResponse, ArticleReactionResponse, ArticleScope, ArticleSummary,
  Asset, AssetInitiatedResponse, Board, BoardListQuery, BoardListResponse, Comment, CompleteAssetRequest, ContentLocale, CreateArticleRequest, CreateBoardRequest, CreateCommentRequest, DeleteBoardRequest, InitiateAssetRequest, PutArticleReactionRequest, VersionedPatchBoardRequest,
} from '@soc/contracts';
import { invalidateBoardCatalog } from './board-catalog';

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL ?? '/api').replace(/\/+$/, '');
type Dict = Record<string, unknown>;
const isObject = (v: unknown): v is Dict => !!v && typeof v === 'object' && !Array.isArray(v);
const has = (v: Dict, keys: readonly string[]) => keys.every((k) => k in v);
const exact = (v: unknown, keys: readonly string[]): v is Dict => isObject(v) && Object.keys(v).length === keys.length && has(v, keys);
const isString = (v: unknown): v is string => typeof v === 'string';
const nullableString = (v: unknown): v is string | null => v === null || isString(v);
const locale = (v: unknown): v is ContentLocale => v === 'ko' || v === 'en';
const localized = (v: unknown) => exact(v, ['value', 'translationUnavailable']) && nullableString(v.value) && typeof v.translationUnavailable === 'boolean';
const timestamp = (v: unknown): v is string => {
  if (!isString(v)) return false;
  const date = new Date(v);
  return !Number.isNaN(date.getTime()) && date.toISOString() === v;
};
const nullableTimestamp = (v: unknown): v is string | null => v === null || timestamp(v);
const scopes = new Set<ArticleScope>(['ALL', 'KAIST', 'SOC', 'AUTHOR_AND_STAFF', 'STAFF']);
const permissions = new Set(['PUBLIC', 'AUTHENTICATED', 'COMMITTEE', 'ADMIN']);
const statuses = new Set(['DRAFT', 'PUBLISHED', 'DELETED', 'HIDDEN']);
const commentStatuses = new Set(['PUBLISHED', 'SECRET', 'DELETED']);
const assetTypes = new Set(['IMAGE', 'ATTACHMENT', 'IMAGE_THUMBNAIL']);
const assetStatuses = new Set(['INITIATED', 'COMPLETED', 'DELETED']);
const nonnegativeInteger = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0;
const isConfig = (v: unknown) => exact(v, ['readPermission', 'writePermission', 'commentPermission', 'commentsAllowed', 'secretArticlesAllowed', 'reactionsAllowed', 'displayOrder', 'isHidden', 'showOnHome'])
  && permissions.has(String(v.readPermission)) && permissions.has(String(v.writePermission)) && permissions.has(String(v.commentPermission))
  && typeof v.commentsAllowed === 'boolean' && typeof v.secretArticlesAllowed === 'boolean' && typeof v.reactionsAllowed === 'boolean'
  && nonnegativeInteger(v.displayOrder) && typeof v.isHidden === 'boolean' && typeof v.showOnHome === 'boolean';

export class BoardApiError extends Error {
  constructor(public readonly status: number, public readonly code?: string, message?: string) { super(message ?? `HTTP ${status}`); this.name = 'BoardApiError'; }
}
export class BoardApiProtocolError extends Error {
  constructor() { super('The server returned an invalid JSON response.'); this.name = 'BoardApiProtocolError'; }
}
const isAppError = (v: unknown): v is AppErrorResponse => exact(v, ['code', 'message', 'requestId']) && isString(v.code) && isString(v.message) && isString(v.requestId);
const isSummary = (v: unknown): v is ArticleSummary => exact(v, ['id', 'boardCode', 'title', 'status', 'scope', 'isPinned', 'pinnedOrder', 'publishedAt', 'updatedAt'])
  && isString(v.id) && isString(v.boardCode) && localized(v.title) && statuses.has(String(v.status)) && scopes.has(v.scope as ArticleScope)
  && typeof v.isPinned === 'boolean' && (v.pinnedOrder === null || nonnegativeInteger(v.pinnedOrder)) && nullableTimestamp(v.publishedAt) && timestamp(v.updatedAt);
const isBoard = (v: unknown): v is Board => exact(v, ['id', 'code', 'title', 'description', 'config', 'updatedAt'])
  && isString(v.id) && isString(v.code) && localized(v.title) && localized(v.description) && isConfig(v.config) && timestamp(v.updatedAt);
const isBoardWithLatest = (v: unknown): v is Board & { latestArticles?: ArticleSummary[] } => isBoard(v)
  || exact(v, ['id', 'code', 'title', 'description', 'config', 'updatedAt', 'latestArticles']) && isString(v.id) && isString(v.code)
    && localized(v.title) && localized(v.description) && isConfig(v.config) && timestamp(v.updatedAt)
    && Array.isArray(v.latestArticles) && v.latestArticles.every(isSummary);
const isList = (v: unknown): v is BoardListResponse => exact(v, ['locale', 'items']) && locale(v.locale) && Array.isArray(v.items) && v.items.every(isBoardWithLatest);
const isAdminBoard = (v: unknown): v is AdminBoard => exact(v, ['id','code','titleKr','titleEn','descriptionKr','descriptionEn','readPermission','writePermission','commentPermission','commentsAllowed','secretArticlesAllowed','reactionsAllowed','displayOrder','isHidden','showOnHome','createdAt','updatedAt']) && isString(v.id) && isString(v.code) && isString(v.titleKr) && isString(v.titleEn) && isString(v.descriptionKr) && isString(v.descriptionEn) && permissions.has(String(v.readPermission)) && permissions.has(String(v.writePermission)) && permissions.has(String(v.commentPermission)) && typeof v.commentsAllowed === 'boolean' && typeof v.secretArticlesAllowed === 'boolean' && typeof v.reactionsAllowed === 'boolean' && nonnegativeInteger(v.displayOrder) && typeof v.isHidden === 'boolean' && typeof v.showOnHome === 'boolean' && timestamp(v.createdAt) && timestamp(v.updatedAt);
const isAdminList = (v: unknown): v is AdminBoardListResponse => exact(v, ['items']) && Array.isArray(v.items) && v.items.every(isAdminBoard);
const isArticleList = (v: unknown): v is ArticleListResponse => exact(v, ['locale', 'items', 'nextCursor']) && locale(v.locale) && Array.isArray(v.items) && v.items.every(isSummary) && nullableString(v.nextCursor);
const isArticle = (v: unknown): v is Article => exact(v, ['id', 'boardCode', 'title', 'status', 'scope', 'isPinned', 'pinnedOrder', 'publishedAt', 'updatedAt', 'body', 'deletedAt'])
  && isSummary({ id: v.id, boardCode: v.boardCode, title: v.title, status: v.status, scope: v.scope, isPinned: v.isPinned, pinnedOrder: v.pinnedOrder, publishedAt: v.publishedAt, updatedAt: v.updatedAt })
  && localized(v.body) && nullableTimestamp(v.deletedAt);
const isComment = (v: unknown) => exact(v, ['id', 'articleId', 'parentCommentId', 'body', 'status', 'createdAt', 'updatedAt'])
  && isString(v.id) && isString(v.articleId) && nullableString(v.parentCommentId) && nullableString(v.body) && commentStatuses.has(String(v.status)) && timestamp(v.createdAt) && timestamp(v.updatedAt);
const isAsset = (v: unknown) => exact(v, ['id', 'articleId', 'displayOrder', 'type', 'status', 'contentType', 'byteSize', 'checksumSha256', 'completedAt'])
  && isString(v.id) && isString(v.articleId) && nonnegativeInteger(v.displayOrder) && assetTypes.has(String(v.type)) && assetStatuses.has(String(v.status))
  && isString(v.contentType) && nonnegativeInteger(v.byteSize) && nullableString(v.checksumSha256) && nullableTimestamp(v.completedAt);
const isDetail = (v: unknown): v is ArticleDetailResponse => exact(v, ['locale', 'article', 'comments', 'assets', 'myReaction']) && locale(v.locale) && isArticle(v.article) && Array.isArray(v.comments) && v.comments.every(isComment) && Array.isArray(v.assets) && v.assets.every(isAsset) && (v.myReaction === null || v.myReaction === 'LIKE' || v.myReaction === 'DISLIKE');

async function request(path: string, method = 'GET', body?: unknown, signal?: AbortSignal): Promise<unknown> {
  const response = await fetch(`${apiBaseUrl}${path}`, { method, signal, credentials: 'include', headers: { Accept: 'application/json', ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) }, body: body === undefined ? undefined : JSON.stringify(body) });
  const payload: unknown = response.status === 204 ? undefined : await response.json().catch(() => undefined);
  if (!response.ok) { const error = isAppError(payload) ? payload : undefined; throw new BoardApiError(response.status, error?.code, error?.message); }
  return payload;
}
const decode = <T>(value: unknown, guard: (v: unknown) => v is T): T => { if (!guard(value)) throw new BoardApiProtocolError(); return value; };
const query = (params: Record<string, unknown>) => { const q = new URLSearchParams(); for (const [k, v] of Object.entries(params)) if (v !== undefined) q.set(k, String(v)); return q.toString() ? `?${q}` : ''; };

export const boardApi = {
  list: (params: BoardListQuery = {}, signal?: AbortSignal) => request(`/boards${query(params as Dict)}`, 'GET', undefined, signal).then((v) => decode(v, isList)),
  get: (code: string, lang?: ContentLocale, signal?: AbortSignal) => request(`/boards/${encodeURIComponent(code)}${query({ locale: lang })}`, 'GET', undefined, signal).then((v) => decode(v, (x): x is { locale: ContentLocale; board: Board } => isObject(x) && has(x, ['locale','board']) && locale(x.locale) && isBoard(x.board))),
  articles: (code: string, params: ArticleListQuery = {}, signal?: AbortSignal) => request(`/boards/${encodeURIComponent(code)}/articles${query(params as Dict)}`, 'GET', undefined, signal).then((v) => decode(v, isArticleList)),
  article: (id: string, lang?: ContentLocale, signal?: AbortSignal) => request(`/articles/${encodeURIComponent(id)}${query({ locale: lang })}`, 'GET', undefined, signal).then((v) => decode(v, isDetail)),
  createDraft: (code: string, input: CreateArticleRequest, signal?: AbortSignal) => request(`/boards/${encodeURIComponent(code)}/articles`, 'POST', input, signal).then((v) => decode(v, isArticle)),
  publish: (id: string, signal?: AbortSignal) => request(`/articles/${encodeURIComponent(id)}/publish`, 'POST', undefined, signal).then((v) => decode(v, isArticle)),
  initiateAsset: (id: string, input: InitiateAssetRequest) => request(`/articles/${encodeURIComponent(id)}/assets/initiate`, 'POST', input).then((v) => decode(v, (x): x is AssetInitiatedResponse => exact(x, ['asset', 'uploadUrl', 'uploadHeaders']) && isAsset(x.asset) && isString(x.uploadUrl) && isObject(x.uploadHeaders) && Object.values(x.uploadHeaders).every(isString))),
  uploadAsset: async (uploadUrl: string, uploadHeaders: Record<string, string>, file: File) => {
    const response = await fetch(uploadUrl, { method: 'PUT', headers: uploadHeaders, body: file });
    if (!response.ok) throw new BoardApiError(response.status);
  },
  completeAsset: (id: string, input: CompleteAssetRequest = {}) => request(`/assets/${encodeURIComponent(id)}/complete`, 'POST', input).then((v) => decode(v, (x): x is Asset => isAsset(x))),
  createComment: (id: string, input: CreateCommentRequest) => request(`/articles/${encodeURIComponent(id)}/comments`, 'POST', input).then((v) => decode(v, (x): x is Comment => isComment(x))),
  deleteComment: (id: string) => request(`/comments/${encodeURIComponent(id)}`, 'DELETE').then((v) => { if (v !== undefined) throw new BoardApiProtocolError(); }),
  putReaction: (id: string, input: PutArticleReactionRequest) => request(`/articles/${encodeURIComponent(id)}/reaction`, 'PUT', input).then((v) => decode(v, (x): x is ArticleReactionResponse => exact(x, ['type']) && (x.type === 'LIKE' || x.type === 'DISLIKE' || x.type === null))),
  deleteReaction: (id: string) => request(`/articles/${encodeURIComponent(id)}/reaction`, 'DELETE').then((v) => decode(v, (x): x is ArticleReactionResponse => exact(x, ['type']) && x.type === null)),
  adminList: (signal?: AbortSignal) => request('/admin/boards', 'GET', undefined, signal).then((v) => decode(v, isAdminList)),
  adminCreate: (input: CreateBoardRequest, signal?: AbortSignal) => request('/admin/boards', 'POST', input, signal).then((v) => {
    const board = decode(v, isAdminBoard);
    invalidateBoardCatalog();
    return board;
  }),
  adminPatch: (id: string, input: VersionedPatchBoardRequest, signal?: AbortSignal) => request(`/admin/boards/${encodeURIComponent(id)}`, 'PATCH', input, signal).then((v) => {
    const board = decode(v, isAdminBoard);
    invalidateBoardCatalog();
    return board;
  }),
  adminDelete: (id: string, input: DeleteBoardRequest, signal?: AbortSignal) => request(`/admin/boards/${encodeURIComponent(id)}`, 'DELETE', input, signal).then((v) => {
    if (v !== undefined) throw new BoardApiProtocolError();
    invalidateBoardCatalog();
  }),
};
