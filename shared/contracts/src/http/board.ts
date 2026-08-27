import type { z } from "zod";
import type {
  ArticleAssetRequestSchema,
  ArticleCreateSchema,
  ArticleModerationSchema,
  FaqReorderSchema,
  ArticleDraftSaveSchema,
  ArticleUpdateSchema,
  BoardCreateSchema,
  BoardReorderSchema,
  BoardUpdateSchema,
  CommentCreateSchema,
  CommentUpdateSchema,
} from "../schemas.js";

export interface BoardSummary {
  boardId: number;
  code: string;
  nameKo: string;
  nameEn?: string;
  descriptionKo?: string;
  descriptionEn?: string;
  /** 글쓰기에 필요한 permission bit 값. 0이면 제한 없음. */
  writePermissionBit: number;
  allowComment: boolean;
  allowSecret: boolean;
  allowLike: boolean;
  /** 비로그인 사용자가 게시글을 열람할 수 있는지 여부. */
  allowGuestRead: boolean;
  sortOrder: number;
  isActive: boolean;
}

export interface BoardListResponse {
  items: BoardSummary[];
}

export type BoardCreateRequest = z.infer<typeof BoardCreateSchema>;
export type BoardUpdateRequest = z.infer<typeof BoardUpdateSchema>;
export type BoardReorderRequest = z.infer<typeof BoardReorderSchema>;

export interface BoardArchiveResponse {
  ok: boolean;
  boardId: number;
  isActive: false;
}

export interface BoardDeleteResponse {
  ok: boolean;
  boardId: number;
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
  homeVisible?: boolean;
  homeOrder?: number | null;
  isSecret: boolean;
  postedAt: string;
  updatedAt: string;
  author: ArticleAuthorSummary;
  isAnonymous: boolean;
  allowComment?: boolean;
  commentCount: number;
  viewCount: number;
  likeCount: number;
  scrapCount: number;
  viewerHasLiked: boolean;
  viewerHasScrapped: boolean;
  hasAttachment?: boolean;
  thumbnailStorageKey?: string | null;
  snippetKo?: string | null;
  snippetEn?: string | null;
  eventStartDate?: string | null;
  eventEndDate?: string | null;
  eventDescriptionKo?: string | null;
  eventDescriptionEn?: string | null;
  surveyId?: string | null;
  survey?: SurveySummary | null;
  boardCode?: string;
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
  computedState: string;
  feeRequirementPolicy: string;
  isAlwaysOpen: boolean;
  openAt?: string;
  closeAt?: string;
  maxResponses?: number | null;
  responseCount?: number;
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
  homeVisible?: boolean;
  homeOrder?: number | null;
  isSecret: boolean;
  postedAt: string;
  updatedAt: string;
  author: ArticleAuthorSummary;
  isAnonymous: boolean;
  allowComment: boolean;
  assets: ArticleAssetItem[];
  commentCount: number;
  viewCount: number;
  likeCount: number;
  scrapCount: number;
  viewerHasLiked: boolean;
  viewerHasScrapped: boolean;
  survey?: SurveySummary | null;
  prevArticle?: { articleId: string; titleKo: string; titleEn?: string; postedAt: string; author: ArticleAuthorSummary; isAnonymous: boolean } | null;
  nextArticle?: { articleId: string; titleKo: string; titleEn?: string; postedAt: string; author: ArticleAuthorSummary; isAnonymous: boolean } | null;
  eventStartDate?: string | null;
  eventEndDate?: string | null;
  eventDescriptionKo?: string | null;
  eventDescriptionEn?: string | null;
}

export type ArticleAssetRequest = z.infer<typeof ArticleAssetRequestSchema>;

export type ArticleCreateRequest = z.infer<typeof ArticleCreateSchema>;

export interface ArticleCreateResponse {
  articleId: string;
  boardId: number;
  postedAt: string;
}

export type ArticleUpdateRequest = z.infer<typeof ArticleUpdateSchema>;
export type ArticleModerationRequest = z.infer<typeof ArticleModerationSchema>;
export type FaqReorderRequest = z.infer<typeof FaqReorderSchema>;

export interface FaqReorderResponse {
  ok: true;
}

export interface ArticleModerationResponse {
  ok: true;
  articleId: string;
  status: "PUBLISHED" | "HIDDEN";
  updatedAt: string;
}

export interface HiddenArticleItem {
  articleId: string;
  boardCode: string;
  titleKo: string;
  authorName: string;
  hiddenAt: string;
  hiddenReason: string;
}

export interface HiddenArticleListResponse {
  items: HiddenArticleItem[];
}

export type ArticleEngagementKind = "LIKE" | "SCRAP";

export interface ArticleEngagementResponse {
  articleId: string;
  kind: ArticleEngagementKind;
  active: boolean;
  likeCount: number;
  scrapCount: number;
  viewerHasLiked: boolean;
  viewerHasScrapped: boolean;
}

export interface ArticleUpdateResponse {
  articleId: string;
  updatedAt: string;
}

export interface AnonymousArticleAuthorResponse {
  articleId: string;
  authorUserId: string;
  authorName: string;
}

export interface ArticleDraftRecord {
  draftId: string;
  boardId: number;
  boardCode: string;
  targetArticleId?: string | null;
  titleKo: string;
  titleEn?: string | null;
  contentKo: string;
  contentEn?: string | null;
  visibilityScope: VisibilityScope;
  isPinned: boolean;
  pinOrder?: number | null;
  homeVisible?: boolean;
  homeOrder?: number | null;
  isSecret: boolean;
  isAnonymous: boolean;
  allowComment: boolean;
  isKoreanOnly: boolean;
  assets?: ArticleAssetRequest[];
  eventStartDate?: string | null;
  eventEndDate?: string | null;
  eventDescriptionKo?: string | null;
  eventDescriptionEn?: string | null;
  linkedSurveyId?: string | null;
  fingerprint: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface ArticleDraftListResponse {
  page: number;
  limit: number;
  total: number;
  items: ArticleDraftRecord[];
}

export type ArticleDraftSaveRequest = z.infer<typeof ArticleDraftSaveSchema>;

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
  likeCount: number;
  viewerHasLiked: boolean;
  isOfficial: boolean;
}

export interface CommentListResponse {
  page: number;
  limit: number;
  /** Total published comments, including replies. */
  total: number;
  /** Total top-level comments used to calculate comment pagination. */
  topLevelTotal: number;
  items: CommentItem[];
}

export type CommentCreateRequest = z.infer<typeof CommentCreateSchema>;

export type CommentEngagementKind = "LIKE";

export interface CommentEngagementResponse {
  commentId: string;
  kind: CommentEngagementKind;
  active: boolean;
  likeCount: number;
  viewerHasLiked: boolean;
}

export interface CommentCreateResponse {
  commentId: string;
  createdAt: string;
}

export type CommentUpdateRequest = z.infer<typeof CommentUpdateSchema>;

export interface CommentUpdateResponse {
  commentId: string;
  updatedAt: string;
}

export interface CommentDeleteResponse {
  ok: boolean;
  commentId: string;
  deletedAt: string;
}

export type CommentModerationRequest = ArticleModerationRequest;

export interface CommentModerationResponse {
  commentId: string;
  status: "PUBLISHED" | "HIDDEN";
  hiddenAt: string | null;
}

export interface HiddenCommentItem {
  commentId: string;
  articleId: string;
  articleTitleKo: string;
  boardCode: string;
  content: string;
  authorName: string;
  hiddenAt: string;
  hiddenReason: string;
}

export interface HiddenCommentListResponse {
  items: HiddenCommentItem[];
}
