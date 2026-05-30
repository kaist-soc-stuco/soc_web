import type { ArticleStatus, VisibilityScope, CommentStatus } from "./board.js";
import type { ResponseStatus } from "./survey.js";

export interface MyPageListMeta {
  page: number;
  limit: number;
  total: number;
}

export interface MyArticleItem {
  articleId: string;
  boardId: number;
  boardNameKo: string;
  boardCode: string;
  titleKo: string;
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
  boardCode: string;
  articleTitleKo: string;
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
  title: string;
  occurredAt: string;
  articleId: string | null;
  boardCode: string | null;
  surveyId: string | null;
}

export interface MyActivityListResponse extends MyPageListMeta {
  items: MyActivityItem[];
}
