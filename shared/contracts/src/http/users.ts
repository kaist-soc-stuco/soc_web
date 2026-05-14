import type { ArticleStatus, VisibilityScope, CommentStatus } from "./board.js";
import type { SurveyStatus, ResponseStatus } from "./survey.js";

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

export interface MyArticleListResponse {
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

export interface MyCommentListResponse {
  items: MyCommentItem[];
}

export interface MySurveyResponseItem {
  responseId: string;
  surveyId: string;
  surveyTitleKo: string;
  status: ResponseStatus;
  submittedAt: string | null;
}

export interface MySurveyResponseListResponse {
  items: MySurveyResponseItem[];
}
