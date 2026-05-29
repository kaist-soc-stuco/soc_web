import type {
  ArticleCreateRequest,
  ArticleCreateResponse,
  ArticleDeleteResponse,
  ArticleDetailResponse,
  ArticleListItem,
  ArticleListResponse,
  ArticleUpdateRequest,
  ArticleUpdateResponse,
  BoardListResponse,
  BoardSummary,
  CommentCreateRequest,
  CommentCreateResponse,
  CommentDeleteResponse,
  CommentListResponse,
  CommentUpdateRequest,
  CommentUpdateResponse,
} from "@soc/contracts";

import { buildListQuery, type ApiClientContext, type ListQueryOptions } from "./core";

interface AssetUploadResponse {
  assetId: string;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  storageKey: string;
}

export const createBoardApi = ({
  assetBaseUrl,
  normalizedBaseUrl,
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
  ): Promise<ArticleListItem[]> => {
    const params = new URLSearchParams();
    if (query?.trim()) params.set("q", query.trim());
    params.set("limit", String(limit));
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
    const formData = new FormData();
    formData.set("file", file);

    return requestJson<AssetUploadResponse>(
      `${assetBaseUrl}/upload`,
      {
        body: formData,
        method: "POST",
      },
      {
        retryOnUnauthorized: true,
      },
    );
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
});
