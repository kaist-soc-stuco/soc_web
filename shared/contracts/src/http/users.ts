import type { ArticleStatus, VisibilityScope, CommentStatus } from "./board.js";
import type { ResponseStatus } from "./survey.js";
import type { z } from "zod";
import type {
  UpdateUserActiveStatusSchema,
} from "../schemas.js";

export interface MyPageListMeta {
  page: number;
  limit: number;
  total: number;
}

export interface MyArticleItem {
  articleId: string;
  boardId: number;
  boardNameKo: string;
  boardNameEn: string | null;
  boardCode: string;
  titleKo: string;
  titleEn: string | null;
  status: ArticleStatus;
  visibilityScope: VisibilityScope;
  postedAt: string;
  commentCount: number;
}

export interface MyArticleListResponse extends MyPageListMeta {
  items: MyArticleItem[];
}

export interface MyCommentItem {
  commentId: string;
  articleId: string;
  boardId: number;
  boardNameKo: string;
  boardNameEn: string | null;
  boardCode: string;
  articleTitleKo: string;
  articleTitleEn: string | null;
  content: string;
  status: CommentStatus;
  createdAt: string;
}

export interface MyCommentListResponse extends MyPageListMeta {
  items: MyCommentItem[];
}

export interface MySurveyResponseItem {
  responseId: string;
  surveyId: string;
  surveyTitleKo: string;
  surveyTitleEn: string | null;
  status: ResponseStatus;
  submittedAt: string | null;
}

export interface MySurveyResponseListResponse extends MyPageListMeta {
  items: MySurveyResponseItem[];
}

export type MyActivityType = "survey" | "post" | "comment";

export interface MyActivityItem {
  type: MyActivityType;
  resourceId: string;
  titleKo: string;
  titleEn: string | null;
  commentContent: string | null;
  occurredAt: string;
  articleId: string | null;
  boardCode: string | null;
  surveyId: string | null;
}

export interface MyActivityListResponse extends MyPageListMeta {
  items: MyActivityItem[];
}

export interface MyScrapItem {
  articleId: string;
  boardId: number;
  boardCode: string;
  boardNameKo: string;
  boardNameEn: string | null;
  titleKo: string;
  titleEn: string | null;
  isPinned: boolean;
  postedAt: string;
  scrapUpdatedAt: string;
  eventStartDate: string | null;
  eventEndDate: string | null;
}

export interface MyScrapListResponse extends MyPageListMeta {
  items: MyScrapItem[];
}

export type UpdateUserActiveStatusRequest = z.infer<
  typeof UpdateUserActiveStatusSchema
>;
