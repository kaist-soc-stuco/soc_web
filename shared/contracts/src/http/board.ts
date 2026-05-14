export type BoardReadScope = "PUBLIC" | "LOGIN" | "STAFF_ONLY";

export interface BoardSummary {
  boardId: number;
  code: string;
  nameKo: string;
  nameEn?: string;
  description?: string;
  readScope: BoardReadScope;
  /** 글쓰기에 필요한 permission bit 값. 0이면 제한 없음. */
  writePermissionBit: number;
  /** 댓글에 필요한 permission bit 값. 0이면 제한 없음. */
  commentPermissionBit: number;
  /** 관리에 필요한 permission bit 값. 0이면 제한 없음. */
  managePermissionBit: number;
  allowComment: boolean;
  allowSecret: boolean;
  allowLike: boolean;
  isActive: boolean;
}

export interface BoardListResponse {
  items: BoardSummary[];
}

export type ArticleStatus = "DRAFT" | "PUBLISHED" | "HIDDEN" | "DELETED";
export type VisibilityScope = "PUBLIC" | "MEMBERS" | "STAFF_ONLY";

export interface ArticleAuthorSummary {
  userId: string;
  name: string;
}

export interface ArticleListItem {
  articleId: string;
  boardId: number;
  titleKo: string;
  titleEn?: string;
  status: ArticleStatus;
  visibilityScope: VisibilityScope;
  isPinned: boolean;
  pinOrder?: number | null;
  postedAt: string;
  updatedAt: string;
  author: ArticleAuthorSummary;
  isAnonymous: boolean;
  commentCount: number;
}

export interface ArticleListResponse {
  page: number;
  limit: number;
  total: number;
  items: ArticleListItem[];
}

export interface ArticleAssetItem {
  assetId: string;
  usageType: "IMAGE" | "ATTACHMENT" | "THUMBNAIL";
  sortOrder: number;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  storageKey: string;
}

export interface SurveySummary {
  surveyId: string;
  kind: string;
  titleKo: string;
  titleEn?: string;
  descriptionKo?: string;
  descriptionEn?: string;
  status: string;
  computedState: string;
  feeRequirementPolicy: string;
  openAt?: string;
  closeAt?: string;
}

export interface ArticleDetailResponse {
  articleId: string;
  boardId: number;
  titleKo: string;
  titleEn?: string;
  contentKo: string;
  contentEn?: string;
  status: ArticleStatus;
  visibilityScope: VisibilityScope;
  isPinned: boolean;
  pinOrder?: number | null;
  postedAt: string;
  updatedAt: string;
  author: ArticleAuthorSummary;
  isAnonymous: boolean;
  assets: ArticleAssetItem[];
  commentCount: number;
  survey?: SurveySummary | null;
}

export interface ArticleAssetRequest {
  assetId: string;
  usageType: "IMAGE" | "ATTACHMENT" | "THUMBNAIL";
  sortOrder: number;
}

export interface ArticleCreateRequest {
  titleKo: string;
  titleEn?: string;
  contentKo: string;
  contentEn?: string;
  visibilityScope: VisibilityScope;
  isPinned?: boolean;
  pinOrder?: number | null;
  isAnonymous?: boolean;
  assets?: ArticleAssetRequest[];
}

export interface ArticleCreateResponse {
  articleId: string;
  boardId: number;
  postedAt: string;
}

export interface ArticleUpdateRequest {
  titleKo?: string;
  titleEn?: string;
  contentKo?: string;
  contentEn?: string;
  visibilityScope?: VisibilityScope;
  isPinned?: boolean;
  pinOrder?: number | null;
  isAnonymous?: boolean;
  assets?: ArticleAssetRequest[];
}

export interface ArticleUpdateResponse {
  articleId: string;
  updatedAt: string;
}

export interface ArticleDeleteResponse {
  ok: boolean;
  articleId: string;
  deletedAt: string;
}

export type CommentStatus = "PUBLISHED" | "HIDDEN" | "DELETED";

export interface CommentItem {
  commentId: string;
  articleId: string;
  parentCommentId?: string | null;
  content: string;
  status: CommentStatus;
  createdAt: string;
  updatedAt: string;
  author: ArticleAuthorSummary;
}

export interface CommentListResponse {
  page: number;
  limit: number;
  total: number;
  items: CommentItem[];
}

export interface CommentCreateRequest {
  parentCommentId?: string | null;
  content: string;
}

export interface CommentCreateResponse {
  commentId: string;
  createdAt: string;
}

export interface CommentUpdateRequest {
  content: string;
}

export interface CommentUpdateResponse {
  commentId: string;
  updatedAt: string;
}

export interface CommentDeleteResponse {
  ok: boolean;
  commentId: string;
  deletedAt: string;
}
