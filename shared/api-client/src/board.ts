import type {
  ArticleCreateRequest,
  ArticleCreateResponse,
  ArticleDeleteResponse,
  ArticleDetailResponse,
  ArticleDraftListResponse,
  ArticleDraftRecord,
  ArticleDraftSaveRequest,
  ArticleEngagementKind,
  ArticleEngagementResponse,
  ArticleListItem,
  ArticleListResponse,
  ArticleModerationRequest,
  ArticleModerationResponse,
  ArticleUpdateRequest,
  ArticleUpdateResponse,
  AnonymousArticleAuthorResponse,
  AssetDirectUploadPrepareRequest,
  AssetDirectUploadPrepareResponse,
  AssetDirectUploadCompleteRequest,
  AssetUploadResponse,
  BoardArchiveResponse,
  BoardCreateRequest,
  BoardDeleteResponse,
  BoardListResponse,
  BoardReorderRequest,
  BoardSummary,
  BoardUpdateRequest,
  CommentCreateRequest,
  CommentCreateResponse,
  CommentEngagementKind,
  CommentEngagementResponse,
  CommentDeleteResponse,
  CommentListResponse,
  CommentModerationRequest,
  CommentModerationResponse,
  CommentUpdateRequest,
  CommentUpdateResponse,
  HiddenArticleListResponse,
  HiddenCommentListResponse,
  FaqReorderRequest,
  FaqReorderResponse,
} from "@soc/contracts";

import {
  ApiClientHttpError,
  buildListQuery,
  type ApiClientContext,
  type ListQueryOptions,
} from "./core.js";

export const createBoardApi = ({
  assetBaseUrl,
  normalizedBaseUrl,
  putObject,
  requestJson,
}: ApiClientContext) => ({
  getBoards: async (): Promise<BoardListResponse> => {
    return requestJson<BoardListResponse>(`${normalizedBaseUrl}/boards`, {
      method: "GET",
    });
  },

  searchArticles: async (
    query?: string,
    limit = 20,
    searchBy: "title" | "title_content" = "title_content",
  ): Promise<ArticleListItem[]> => {
    const params = new URLSearchParams();
    if (query?.trim()) params.set("q", query.trim());
    params.set("limit", String(limit));
    params.set("searchBy", searchBy);
    return requestJson<ArticleListItem[]>(
      `${normalizedBaseUrl}/articles/search?${params.toString()}`,
      { method: "GET" },
      { retryOnUnauthorized: true },
    );
  },

  getAllArticles: async (
    options?: ListQueryOptions,
  ): Promise<ArticleListResponse> => {
    return requestJson<ArticleListResponse>(
      `${normalizedBaseUrl}/articles${buildListQuery(options)}`,
      {
        method: "GET",
      },
      {
        retryOnUnauthorized: true,
      },
    );
  },

  getBoard: async (code: string): Promise<BoardSummary> => {
    return requestJson<BoardSummary>(
      `${normalizedBaseUrl}/boards/${encodeURIComponent(code)}`,
      {
        method: "GET",
      },
    );
  },

  getArticles: async (
    code: string,
    options?: ListQueryOptions,
  ): Promise<ArticleListResponse> => {
    return requestJson<ArticleListResponse>(
      `${normalizedBaseUrl}/boards/${encodeURIComponent(code)}/articles${buildListQuery(options)}`,
      {
        method: "GET",
      },
      {
        retryOnUnauthorized: true,
      },
    );
  },

  getArticle: async (
    code: string,
    articleId: string,
  ): Promise<ArticleDetailResponse> => {
    return requestJson<ArticleDetailResponse>(
      `${normalizedBaseUrl}/boards/${encodeURIComponent(code)}/articles/${encodeURIComponent(articleId)}`,
      {
        method: "GET",
      },
      {
        retryOnUnauthorized: true,
      },
    );
  },

  uploadAsset: async (file: File): Promise<AssetUploadResponse> => {
    const prepareBody: AssetDirectUploadPrepareRequest = {
      originalFilename: file.name,
      mimeType: file.type,
      sizeBytes: file.size,
    };

    let preparation: AssetDirectUploadPrepareResponse | null = null;
    try {
      preparation = await requestJson<AssetDirectUploadPrepareResponse>(
        `${assetBaseUrl}/presign`,
        {
          body: JSON.stringify(prepareBody),
          headers: { "Content-Type": "application/json" },
          method: "POST",
        },
        { retryOnUnauthorized: true },
      );
    } catch (error) {
      if (!(error instanceof ApiClientHttpError) || error.status !== 409) {
        throw error;
      }
    }

    if (preparation) {
      await putObject(
        preparation.uploadUrl,
        file,
        preparation.uploadHeaders,
      );
      const completeBody: AssetDirectUploadCompleteRequest = {
        storageKey: preparation.storageKey,
      };
      return requestJson<AssetUploadResponse>(
        `${assetBaseUrl}/complete`,
        {
          body: JSON.stringify(completeBody),
          headers: { "Content-Type": "application/json" },
          method: "POST",
        },
        { retryOnUnauthorized: true },
      );
    }

    const formData = new FormData();
    formData.set("file", file);
    return requestJson<AssetUploadResponse>(`${assetBaseUrl}/upload`, {
      body: formData,
      method: "POST",
    }, { retryOnUnauthorized: true });
  },

  createArticle: async (
    code: string,
    input: ArticleCreateRequest,
  ): Promise<ArticleCreateResponse> => {
    return requestJson<ArticleCreateResponse>(
      `${normalizedBaseUrl}/boards/${encodeURIComponent(code)}/articles`,
      {
        body: JSON.stringify(input),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      },
      { retryOnUnauthorized: true },
    );
  },

  updateArticle: async (
    code: string,
    articleId: string,
    input: ArticleUpdateRequest,
  ): Promise<ArticleUpdateResponse> => {
    return requestJson<ArticleUpdateResponse>(
      `${normalizedBaseUrl}/boards/${encodeURIComponent(code)}/articles/${encodeURIComponent(articleId)}`,
      {
        body: JSON.stringify(input),
        headers: {
          "Content-Type": "application/json",
        },
        method: "PATCH",
      },
      { retryOnUnauthorized: true },
    );
  },

  deleteArticle: async (
    code: string,
    articleId: string,
  ): Promise<ArticleDeleteResponse> => {
    return requestJson<ArticleDeleteResponse>(
      `${normalizedBaseUrl}/boards/${encodeURIComponent(code)}/articles/${encodeURIComponent(articleId)}`,
      {
        method: "DELETE",
      },
      { retryOnUnauthorized: true },
    );
  },

  createFaqArticle: async (
    input: ArticleCreateRequest,
  ): Promise<ArticleCreateResponse> => {
    return requestJson<ArticleCreateResponse>(
      `${normalizedBaseUrl}/boards/FAQ/articles/admin`,
      {
        body: JSON.stringify(input),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      },
      { retryOnUnauthorized: true },
    );
  },

  updateFaqArticle: async (
    articleId: string,
    input: ArticleUpdateRequest,
  ): Promise<ArticleUpdateResponse> => {
    return requestJson<ArticleUpdateResponse>(
      `${normalizedBaseUrl}/boards/FAQ/articles/${encodeURIComponent(articleId)}/admin`,
      {
        body: JSON.stringify(input),
        headers: { "Content-Type": "application/json" },
        method: "PATCH",
      },
      { retryOnUnauthorized: true },
    );
  },

  deleteFaqArticle: async (articleId: string): Promise<ArticleDeleteResponse> => {
    return requestJson<ArticleDeleteResponse>(
      `${normalizedBaseUrl}/boards/FAQ/articles/${encodeURIComponent(articleId)}/admin`,
      { method: "DELETE" },
      { retryOnUnauthorized: true },
    );
  },

  reorderFaqArticles: async (
    input: FaqReorderRequest,
  ): Promise<FaqReorderResponse> => {
    return requestJson<FaqReorderResponse>(
      `${normalizedBaseUrl}/boards/FAQ/articles/admin/reorder`,
      {
        body: JSON.stringify(input),
        headers: { "Content-Type": "application/json" },
        method: "PATCH",
      },
      { retryOnUnauthorized: true },
    );
  },

  getHiddenArticles: async (code: string): Promise<HiddenArticleListResponse> => {
    return requestJson<HiddenArticleListResponse>(
      `${normalizedBaseUrl}/boards/${encodeURIComponent(code)}/articles/moderation/hidden`,
      { method: "GET" },
      { retryOnUnauthorized: true },
    );
  },

  hideArticle: async (
    code: string,
    articleId: string,
    input: ArticleModerationRequest,
  ): Promise<ArticleModerationResponse> => {
    return requestJson<ArticleModerationResponse>(
      `${normalizedBaseUrl}/boards/${encodeURIComponent(code)}/articles/${encodeURIComponent(articleId)}/hide`,
      {
        body: JSON.stringify(input),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      },
      { retryOnUnauthorized: true },
    );
  },

  restoreArticle: async (code: string, articleId: string): Promise<ArticleModerationResponse> => {
    return requestJson<ArticleModerationResponse>(
      `${normalizedBaseUrl}/boards/${encodeURIComponent(code)}/articles/${encodeURIComponent(articleId)}/restore`,
      { method: "POST" },
      { retryOnUnauthorized: true },
    );
  },

  revealAnonymousArticleAuthor: async (
    code: string,
    articleId: string,
  ): Promise<AnonymousArticleAuthorResponse> => {
    return requestJson<AnonymousArticleAuthorResponse>(
      `${normalizedBaseUrl}/boards/${encodeURIComponent(code)}/articles/${encodeURIComponent(articleId)}/anonymous-author`,
      { method: "GET" },
      { retryOnUnauthorized: true },
    );
  },

  getAdminBoards: async (): Promise<BoardListResponse> => {
    return requestJson<BoardListResponse>(
      `${normalizedBaseUrl}/boards/admin`,
      { method: "GET" },
      { retryOnUnauthorized: true },
    );
  },

  reorderBoards: async (input: BoardReorderRequest): Promise<BoardListResponse> => {
    return requestJson<BoardListResponse>(
      `${normalizedBaseUrl}/boards/admin/order`,
      {
        body: JSON.stringify(input),
        headers: { "Content-Type": "application/json" },
        method: "PATCH",
      },
      { retryOnUnauthorized: true },
    );
  },

  createBoard: async (input: BoardCreateRequest): Promise<BoardSummary> => {
    return requestJson<BoardSummary>(
      `${normalizedBaseUrl}/boards`,
      {
        body: JSON.stringify(input),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      },
      { retryOnUnauthorized: true },
    );
  },

  updateBoard: async (
    code: string,
    input: BoardUpdateRequest,
  ): Promise<BoardSummary> => {
    return requestJson<BoardSummary>(
      `${normalizedBaseUrl}/boards/${encodeURIComponent(code)}`,
      {
        body: JSON.stringify(input),
        headers: { "Content-Type": "application/json" },
        method: "PATCH",
      },
      { retryOnUnauthorized: true },
    );
  },

  archiveBoard: async (code: string): Promise<BoardArchiveResponse> => {
    return requestJson<BoardArchiveResponse>(
      `${normalizedBaseUrl}/boards/${encodeURIComponent(code)}`,
      { method: "DELETE" },
      { retryOnUnauthorized: true },
    );
  },

  deleteBoard: async (code: string): Promise<BoardDeleteResponse> => {
    return requestJson<BoardDeleteResponse>(
      `${normalizedBaseUrl}/boards/${encodeURIComponent(code)}/permanent`,
      { method: "DELETE" },
      { retryOnUnauthorized: true },
    );
  },

  setArticleEngagement: async (
    code: string,
    articleId: string,
    kind: ArticleEngagementKind,
    active: boolean,
  ): Promise<ArticleEngagementResponse> => {
    return requestJson<ArticleEngagementResponse>(
      `${normalizedBaseUrl}/boards/${encodeURIComponent(code)}/articles/${encodeURIComponent(articleId)}/engagements/${kind.toLowerCase()}`,
      {
        method: active ? "PUT" : "DELETE",
      },
      { retryOnUnauthorized: true },
    );
  },

  getArticleDrafts: async (options?: {
    boardCode?: string;
    limit?: number;
    page?: number;
  }): Promise<ArticleDraftListResponse> => {
    const params = new URLSearchParams();
    if (options?.boardCode) params.set("boardCode", options.boardCode);
    if (options?.limit) params.set("limit", String(options.limit));
    if (options?.page) params.set("page", String(options.page));
    return requestJson<ArticleDraftListResponse>(
      `${normalizedBaseUrl}/drafts${params.toString() ? `?${params.toString()}` : ""}`,
      { method: "GET" },
      { retryOnUnauthorized: true },
    );
  },

  getArticleDraft: async (draftId: string): Promise<ArticleDraftRecord> => {
    return requestJson<ArticleDraftRecord>(
      `${normalizedBaseUrl}/drafts/${encodeURIComponent(draftId)}`,
      { method: "GET" },
      { retryOnUnauthorized: true },
    );
  },

  saveArticleDraft: async (
    input: ArticleDraftSaveRequest,
  ): Promise<ArticleDraftRecord> => {
    const path = input.draftId
      ? `/drafts/${encodeURIComponent(input.draftId)}`
      : "/drafts";
    return requestJson<ArticleDraftRecord>(`${normalizedBaseUrl}${path}`, {
      body: JSON.stringify(input),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    }, { retryOnUnauthorized: true });
  },

  deleteArticleDraft: async (draftId: string): Promise<{ ok: true }> => {
    return requestJson<{ ok: true }>(
      `${normalizedBaseUrl}/drafts/${encodeURIComponent(draftId)}`,
      { method: "DELETE" },
      { retryOnUnauthorized: true },
    );
  },

  getComments: async (
    code: string,
    articleId: string,
    options?: ListQueryOptions,
  ): Promise<CommentListResponse> => {
    return requestJson<CommentListResponse>(
      `${normalizedBaseUrl}/boards/${encodeURIComponent(code)}/articles/${encodeURIComponent(articleId)}/comments${buildListQuery(options)}`,
      {
        method: "GET",
      },
      {
        retryOnUnauthorized: true,
      },
    );
  },

  createComment: async (
    code: string,
    articleId: string,
    input: CommentCreateRequest,
  ): Promise<CommentCreateResponse> => {
    return requestJson<CommentCreateResponse>(
      `${normalizedBaseUrl}/boards/${encodeURIComponent(code)}/articles/${encodeURIComponent(articleId)}/comments`,
      {
        body: JSON.stringify(input),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      },
      { retryOnUnauthorized: true },
    );
  },

  updateComment: async (
    code: string,
    articleId: string,
    commentId: string,
    input: CommentUpdateRequest,
  ): Promise<CommentUpdateResponse> => {
    return requestJson<CommentUpdateResponse>(
      `${normalizedBaseUrl}/boards/${encodeURIComponent(code)}/articles/${encodeURIComponent(articleId)}/comments/${encodeURIComponent(commentId)}`,
      {
        body: JSON.stringify(input),
        headers: {
          "Content-Type": "application/json",
        },
        method: "PATCH",
      },
      { retryOnUnauthorized: true },
    );
  },

  deleteComment: async (
    code: string,
    articleId: string,
    commentId: string,
  ): Promise<CommentDeleteResponse> => {
    return requestJson<CommentDeleteResponse>(
      `${normalizedBaseUrl}/boards/${encodeURIComponent(code)}/articles/${encodeURIComponent(articleId)}/comments/${encodeURIComponent(commentId)}`,
      {
        method: "DELETE",
      },
      { retryOnUnauthorized: true },
    );
  },

  getHiddenComments: async (): Promise<HiddenCommentListResponse> => {
    return requestJson<HiddenCommentListResponse>(
      `${normalizedBaseUrl}/comment-moderation/hidden`,
      { method: "GET" },
      { retryOnUnauthorized: true },
    );
  },

  hideComment: async (
    code: string,
    articleId: string,
    commentId: string,
    input: CommentModerationRequest,
  ): Promise<CommentModerationResponse> => {
    return requestJson<CommentModerationResponse>(
      `${normalizedBaseUrl}/boards/${encodeURIComponent(code)}/articles/${encodeURIComponent(articleId)}/comments/${encodeURIComponent(commentId)}/hide`,
      {
        body: JSON.stringify(input),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      },
      { retryOnUnauthorized: true },
    );
  },

  restoreComment: async (
    code: string,
    articleId: string,
    commentId: string,
  ): Promise<CommentModerationResponse> => {
    return requestJson<CommentModerationResponse>(
      `${normalizedBaseUrl}/boards/${encodeURIComponent(code)}/articles/${encodeURIComponent(articleId)}/comments/${encodeURIComponent(commentId)}/restore`,
      { method: "POST" },
      { retryOnUnauthorized: true },
    );
  },

  setCommentEngagement: async (
    code: string,
    articleId: string,
    commentId: string,
    kind: CommentEngagementKind,
    active: boolean,
  ): Promise<CommentEngagementResponse> => {
    return requestJson<CommentEngagementResponse>(
      `${normalizedBaseUrl}/boards/${encodeURIComponent(code)}/articles/${encodeURIComponent(articleId)}/comments/${encodeURIComponent(commentId)}/engagements/${kind.toLowerCase()}`,
      {
        method: active ? "PUT" : "DELETE",
      },
      { retryOnUnauthorized: true },
    );
  },

});
