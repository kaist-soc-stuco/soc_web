import type { ContentLocale, LocalizedContent } from "./faq";

export type BoardPermission = "PUBLIC" | "AUTHENTICATED" | "COMMITTEE" | "ADMIN";
export type ArticleStatus = "DRAFT" | "PUBLISHED" | "DELETED" | "HIDDEN";
export type ArticleScope = "ALL" | "KAIST" | "SOC" | "AUTHOR_AND_STAFF" | "STAFF";
export type CommentStatus = "PUBLISHED" | "SECRET" | "DELETED";
export type ReactionType = "LIKE";
export type AssetType = "IMAGE" | "ATTACHMENT" | "IMAGE_THUMBNAIL";
export type AssetStatus = "INITIATED" | "COMPLETED" | "DELETED";

export interface BoardConfig {
  readPermission: BoardPermission;
  writePermission: BoardPermission;
  commentPermission: BoardPermission;
  commentsAllowed: boolean;
  secretArticlesAllowed: boolean;
  reactionsAllowed: boolean;
  displayOrder: number;
  isHidden: boolean;
  showOnHome: boolean;
}

export interface Board {
  id: string;
  code: string;
  title: LocalizedContent;
  description: LocalizedContent;
  config: BoardConfig;
  updatedAt: string;
}

export interface AdminBoard extends BoardConfig {
  id: string;
  code: string;
  titleKr: string;
  titleEn: string;
  descriptionKr: string;
  descriptionEn: string;
  createdAt: string;
  updatedAt: string;
}

export interface ArticleSummary {
  id: string;
  boardCode: string;
  title: LocalizedContent;
  status: ArticleStatus;
  scope: ArticleScope;
  isPinned: boolean;
  pinnedOrder: number | null;
  publishedAt: string | null;
  updatedAt: string;
}

export interface Article extends ArticleSummary {
  body: LocalizedContent;
  deletedAt: string | null;
}

export interface Comment {
  id: string;
  articleId: string;
  parentCommentId: string | null;
  authorNameKr: string;
  body: string | null;
  status: CommentStatus;
  canEdit: boolean;
  canDelete: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Asset {
  id: string;
  articleId: string;
  displayOrder: number;
  type: AssetType;
  status: AssetStatus;
  contentType: string;
  byteSize: number;
  checksumSha256: string | null;
  completedAt: string | null;
}

export interface BoardListQuery {
  home?: true;
  latestLimit?: 1;
  locale?: ContentLocale;
}

export interface BoardListResponse {
  locale: ContentLocale;
  items: Array<Board & { latestArticles?: ArticleSummary[] }>;
}
export interface AdminBoardListResponse {
  items: AdminBoard[];
}

export interface BoardDetailResponse {
  locale: ContentLocale;
  board: Board;
}

export interface CreateBoardRequest extends BoardConfig {
  code: string;
  titleKr: string;
  titleEn: string;
  descriptionKr: string;
  descriptionEn: string;
}

export type PatchBoardFields = Partial<Omit<CreateBoardRequest, "code">>;
export type PatchBoardRequest = PatchBoardFields;
export type VersionedPatchBoardRequest = { expectedUpdatedAt: string } & PatchBoardFields;
export interface DeleteBoardRequest {
  expectedUpdatedAt: string;
}

export interface ArticleListQuery {
  locale?: ContentLocale;
  cursor?: string;
  limit?: number;
}

export interface ArticleListResponse {
  locale: ContentLocale;
  items: ArticleSummary[];
  nextCursor: string | null;
}

export interface CreateArticleRequest {
  title?: string;
  body?: string;
  titleKr?: string;
  titleEn?: string;
  bodyKr?: string;
  bodyEn?: string;
  scope: ArticleScope;
  isPinned?: boolean;
  pinnedOrder?: number | null;
}

export interface PatchArticleRequest {
  titleKr?: string;
  titleEn?: string;
  bodyKr?: string;
  bodyEn?: string;
  scope?: ArticleScope;
  isPinned?: boolean;
  pinnedOrder?: number | null;
  status?: Exclude<ArticleStatus, "PUBLISHED" | "DELETED">;
}

export interface ArticleDetailResponse {
  locale: ContentLocale;
  article: Article;
  comments: Comment[];
  assets: Asset[];
  myReaction: ReactionType | null;
  likeCount: number;
}

export interface CreateCommentRequest {
  parentCommentId?: string | null;
  body: string;
  status?: Exclude<CommentStatus, "DELETED">;
}

export interface PatchCommentRequest {
  body?: string;
  status?: Exclude<CommentStatus, "DELETED">;
}

export interface PutArticleReactionRequest {
  type: ReactionType;
}

export interface ArticleReactionResponse {
  type: ReactionType | null;
  likeCount: number;
}

export interface InitiateAssetRequest {
  displayOrder: number;
  type: AssetType;
  contentType: string;
  byteSize: number;
  checksumSha256?: string;
}

export interface AssetInitiatedResponse {
  asset: Asset;
  uploadUrl: string;
  uploadHeaders: Record<string, string>;
}

export interface CompleteAssetRequest {
  checksumSha256?: string;
}

export interface FeatureDisabledError {
  code: "feature_disabled";
  message: string;
  requestId: string;
}

export type InitiateAssetResult = AssetInitiatedResponse | FeatureDisabledError;
export type CompleteAssetResult = Asset | FeatureDisabledError;
export interface BoardListOperation {
  query: BoardListQuery;
  response: BoardListResponse;
}

export interface BoardGetOperation {
  response: BoardDetailResponse;
}

export interface BoardCreateOperation {
  request: CreateBoardRequest;
  response: AdminBoard;
}

export interface AdminBoardListOperation {
  response: AdminBoardListResponse;
}
export interface BoardPatchOperation {
  request: VersionedPatchBoardRequest;
  response: AdminBoard;
}
export interface BoardDeleteOperation {
  request: DeleteBoardRequest;
  response: void;
}

export interface ArticleListOperation {
  query: ArticleListQuery;
  response: ArticleListResponse;
}

export interface ArticleCreateOperation {
  request: CreateArticleRequest;
  response: Article;
}

export interface ArticleGetOperation {
  response: ArticleDetailResponse;
}

export interface ArticlePatchOperation {
  request: PatchArticleRequest;
  response: Article;
}

export interface ArticleDeleteOperation {
  response: void;
}

export interface ArticlePublishOperation {
  response: Article;
}

export interface CommentCreateOperation {
  request: CreateCommentRequest;
  response: Comment;
}

export interface CommentPatchOperation {
  request: PatchCommentRequest;
  response: Comment;
}

export interface CommentDeleteOperation {
  response: void;
}

export interface ArticleReactionPutOperation {
  request: PutArticleReactionRequest;
  response: ArticleReactionResponse;
}

export interface ArticleReactionDeleteOperation {
  response: ArticleReactionResponse;
}

export interface AssetInitiateOperation {
  request: InitiateAssetRequest;
  response: InitiateAssetResult;
}

export interface AssetCompleteOperation {
  request: CompleteAssetRequest;
  response: CompleteAssetResult;
}

export type AssetDeleteResult = void | FeatureDisabledError;

export interface AssetDeleteOperation {
  response: AssetDeleteResult;
}
