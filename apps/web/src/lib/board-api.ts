import type {
  AppErrorResponse, Article, ArticleDetailResponse, ArticleListQuery, ArticleListResponse, ArticleScope, ArticleSummary,
  Board, BoardListQuery, BoardListResponse, ContentLocale, CreateArticleRequest,
} from '@soc/contracts';

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL ?? '/api').replace(/\/+$/, '');
type Dict = Record<string, unknown>;
const isObject = (v: unknown): v is Dict => !!v && typeof v === 'object' && !Array.isArray(v);
const has = (v: Dict, keys: readonly string[]) => keys.every((k) => k in v);
const isString = (v: unknown): v is string => typeof v === 'string';
const nullableString = (v: unknown): v is string | null => v === null || isString(v);
const locale = (v: unknown): v is ContentLocale => v === 'ko' || v === 'en';
const localized = (v: unknown) => isObject(v) && has(v, ['value', 'translationUnavailable']) && isString(v.value) && typeof v.translationUnavailable === 'boolean';
const scopes = new Set<ArticleScope>(['ALL', 'KAIST', 'SOC', 'AUTHOR_AND_STAFF', 'STAFF']);

export class BoardApiError extends Error {
  constructor(public readonly status: number, public readonly code?: string, message?: string) { super(message ?? `HTTP ${status}`); this.name = 'BoardApiError'; }
}
export class BoardApiProtocolError extends Error {
  constructor() { super('The server returned an invalid JSON response.'); this.name = 'BoardApiProtocolError'; }
}
const isAppError = (v: unknown): v is AppErrorResponse => isObject(v) && isString(v.code) && isString(v.message) && isString(v.requestId);
const isSummary = (v: unknown): v is ArticleSummary => isObject(v) && has(v, ['id','boardCode','title','status','scope','isPinned','pinnedOrder','publishedAt','updatedAt']) && isString(v.id) && isString(v.boardCode) && localized(v.title) && ['DRAFT','PUBLISHED','DELETED','HIDDEN'].includes(String(v.status)) && scopes.has(v.scope as ArticleScope) && typeof v.isPinned === 'boolean' && (v.pinnedOrder === null || Number.isSafeInteger(v.pinnedOrder)) && nullableString(v.publishedAt) && isString(v.updatedAt);
const isBoard = (v: unknown): v is Board => isObject(v) && has(v, ['id','code','title','description','config','updatedAt']) && isString(v.id) && isString(v.code) && localized(v.title) && localized(v.description) && isObject(v.config) && isString(v.updatedAt);
const isList = (v: unknown): v is BoardListResponse => isObject(v) && has(v, ['locale','items']) && locale(v.locale) && Array.isArray(v.items) && v.items.every((item) => isBoard(item) && (!('latestArticles' in item) || (Array.isArray(item.latestArticles) && item.latestArticles.every(isSummary))));
const isArticleList = (v: unknown): v is ArticleListResponse => isObject(v) && has(v, ['locale','items','nextCursor']) && locale(v.locale) && Array.isArray(v.items) && v.items.every(isSummary) && nullableString(v.nextCursor);
const isArticle = (v: unknown): v is Article => isSummary(v) && isObject(v) && has(v, ['body','deletedAt']) && localized(v.body) && nullableString(v.deletedAt);
const isDetail = (v: unknown): v is ArticleDetailResponse => isObject(v) && has(v, ['locale','article','comments','assets','myReaction']) && locale(v.locale) && isArticle(v.article) && Array.isArray(v.comments) && Array.isArray(v.assets) && (v.myReaction === null || v.myReaction === 'LIKE' || v.myReaction === 'DISLIKE');

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
  createDraft: (code: string, input: CreateArticleRequest, signal?: AbortSignal) => request(`/admin/boards/${encodeURIComponent(code)}/articles`, 'POST', input, signal).then((v) => decode(v, isArticle)),
  publish: (id: string, signal?: AbortSignal) => request(`/admin/articles/${encodeURIComponent(id)}/publish`, 'POST', undefined, signal).then((v) => decode(v, isArticle)),
};
