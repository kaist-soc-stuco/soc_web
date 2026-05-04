import { useEffect, useMemo, useState } from "react";
import { createApiClient } from "@soc/api-client";
import type {
  ArticleCreateRequest,
  ArticleUpdateRequest,
  CommentCreateRequest,
  CommentUpdateRequest,
} from "@soc/contracts";

import { resolveApiBaseUrl } from "@/lib/api-base-url";

type BoardDebugResult =
  | {
      label: string;
      data: unknown;
      error?: never;
    }
  | {
      label: string;
      error: string;
      data?: never;
    };

interface BoardDebugPanelProps {
  defaultBoardCode: string;
}

const JSON_SPACES = 2;

const toErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }

  return "알 수 없는 오류가 발생했습니다.";
};

export function BoardDebugPanel({ defaultBoardCode }: BoardDebugPanelProps) {
  const [boardCode, setBoardCode] = useState(defaultBoardCode);
  const [articleId, setArticleId] = useState("1");
  const [commentId, setCommentId] = useState("1");
  const [articlePage, setArticlePage] = useState("1");
  const [articleLimit, setArticleLimit] = useState("10");
  const [commentPage, setCommentPage] = useState("1");
  const [commentLimit, setCommentLimit] = useState("10");
  const [articleForm, setArticleForm] = useState<ArticleCreateRequest>({
    contentKo: "테스트용 게시글 내용",
    isPinned: false,
    titleKo: "테스트용 게시글",
    visibilityScope: "PUBLIC",
  });
  const [articleUpdateForm, setArticleUpdateForm] = useState<
    Partial<ArticleUpdateRequest>
  >({
    contentKo: "수정된 테스트용 게시글 내용",
    titleKo: "수정된 테스트용 게시글",
  });
  const [commentForm, setCommentForm] = useState<CommentCreateRequest>({
    content: "테스트용 댓글",
  });
  const [commentUpdateForm, setCommentUpdateForm] = useState<
    CommentUpdateRequest
  >({
    content: "수정된 테스트용 댓글",
  });
  const [loadingLabel, setLoadingLabel] = useState<string | null>(null);
  const [result, setResult] = useState<BoardDebugResult | null>(null);

  const apiClient = useMemo(
    () => createApiClient({ baseUrl: resolveApiBaseUrl() }),
    [],
  );

  useEffect(() => {
    setBoardCode(defaultBoardCode);
  }, [defaultBoardCode]);

  if (!(import.meta.env.DEV || import.meta.env.VITE_ENABLE_BOARD_DEBUG === "true")) {
    return null;
  }

  const runAction = async (label: string, action: () => Promise<unknown>) => {
    setLoadingLabel(label);
    setResult(null);

    try {
      const data = await action();
      setResult({ label, data });
    } catch (error) {
      setResult({ label, error: toErrorMessage(error) });
    } finally {
      setLoadingLabel(null);
    }
  };

  const parseNumber = (value: string): number | undefined => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  };

  const canMutate = Boolean(boardCode.trim() && articleId.trim());

  return (
    <section className="rounded-2xl border border-kaist-greygreen/20 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-kaist-greygreen">
            Dev Board Test
          </p>
          <h2 className="mt-1 text-2xl font-extrabold tracking-tight text-kaist-black">
            게시판 API 임시 검증
          </h2>
          <p className="mt-2 text-sm font-medium leading-7 text-kaist-grey">
            읽기/쓰기 API를 버튼으로 직접 호출해서 게시판 기능을 빠르게 확인할 수 있습니다.
          </p>
        </div>
        <div className="rounded-xl bg-kaist-darkgreen/6 px-4 py-3 text-xs font-semibold text-kaist-greygreen">
          개발 환경에서만 표시
        </div>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <label className="space-y-2 text-sm font-semibold text-kaist-black">
          <span>boardCode</span>
          <input
            value={boardCode}
            onChange={(event) => setBoardCode(event.target.value)}
            className="w-full rounded-lg border border-kaist-grey/30 px-3 py-2 text-sm font-medium outline-none focus:border-kaist-darkgreen"
          />
        </label>
        <label className="space-y-2 text-sm font-semibold text-kaist-black">
          <span>articleId</span>
          <input
            value={articleId}
            onChange={(event) => setArticleId(event.target.value)}
            className="w-full rounded-lg border border-kaist-grey/30 px-3 py-2 text-sm font-medium outline-none focus:border-kaist-darkgreen"
          />
        </label>
        <label className="space-y-2 text-sm font-semibold text-kaist-black">
          <span>commentId</span>
          <input
            value={commentId}
            onChange={(event) => setCommentId(event.target.value)}
            className="w-full rounded-lg border border-kaist-grey/30 px-3 py-2 text-sm font-medium outline-none focus:border-kaist-darkgreen"
          />
        </label>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-4">
        <label className="space-y-2 text-sm font-semibold text-kaist-black">
          <span>article page</span>
          <input
            value={articlePage}
            onChange={(event) => setArticlePage(event.target.value)}
            className="w-full rounded-lg border border-kaist-grey/30 px-3 py-2 text-sm font-medium outline-none focus:border-kaist-darkgreen"
          />
        </label>
        <label className="space-y-2 text-sm font-semibold text-kaist-black">
          <span>article limit</span>
          <input
            value={articleLimit}
            onChange={(event) => setArticleLimit(event.target.value)}
            className="w-full rounded-lg border border-kaist-grey/30 px-3 py-2 text-sm font-medium outline-none focus:border-kaist-darkgreen"
          />
        </label>
        <label className="space-y-2 text-sm font-semibold text-kaist-black">
          <span>comment page</span>
          <input
            value={commentPage}
            onChange={(event) => setCommentPage(event.target.value)}
            className="w-full rounded-lg border border-kaist-grey/30 px-3 py-2 text-sm font-medium outline-none focus:border-kaist-darkgreen"
          />
        </label>
        <label className="space-y-2 text-sm font-semibold text-kaist-black">
          <span>comment limit</span>
          <input
            value={commentLimit}
            onChange={(event) => setCommentLimit(event.target.value)}
            className="w-full rounded-lg border border-kaist-grey/30 px-3 py-2 text-sm font-medium outline-none focus:border-kaist-darkgreen"
          />
        </label>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-kaist-grey/20 p-4">
          <h3 className="text-base font-extrabold tracking-tight text-kaist-black">
            Read APIs
          </h3>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={loadingLabel !== null}
              onClick={() => void runAction("boards", () => apiClient.getBoards())}
              className="rounded-full bg-kaist-darkgreen px-4 py-2 text-xs font-bold text-white disabled:opacity-50"
            >
              boards
            </button>
            <button
              type="button"
              disabled={loadingLabel !== null || !boardCode.trim()}
              onClick={() => void runAction("board", () => apiClient.getBoard(boardCode.trim()))}
              className="rounded-full bg-kaist-darkgreen px-4 py-2 text-xs font-bold text-white disabled:opacity-50"
            >
              board detail
            </button>
            <button
              type="button"
              disabled={loadingLabel !== null || !boardCode.trim()}
              onClick={() =>
                void runAction("articles", () =>
                  apiClient.getArticles(boardCode.trim(), {
                    page: parseNumber(articlePage),
                    limit: parseNumber(articleLimit),
                  }),
                )
              }
              className="rounded-full bg-kaist-darkgreen px-4 py-2 text-xs font-bold text-white disabled:opacity-50"
            >
              articles
            </button>
            <button
              type="button"
              disabled={loadingLabel !== null || !boardCode.trim() || !articleId.trim()}
              onClick={() =>
                void runAction("article", () =>
                  apiClient.getArticle(boardCode.trim(), articleId.trim()),
                )
              }
              className="rounded-full bg-kaist-darkgreen px-4 py-2 text-xs font-bold text-white disabled:opacity-50"
            >
              article detail
            </button>
            <button
              type="button"
              disabled={loadingLabel !== null || !boardCode.trim() || !articleId.trim()}
              onClick={() =>
                void runAction("comments", () =>
                  apiClient.getComments(boardCode.trim(), articleId.trim(), {
                    page: parseNumber(commentPage),
                    limit: parseNumber(commentLimit),
                  }),
                )
              }
              className="rounded-full bg-kaist-darkgreen px-4 py-2 text-xs font-bold text-white disabled:opacity-50"
            >
              comments
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-kaist-grey/20 p-4">
          <h3 className="text-base font-extrabold tracking-tight text-kaist-black">
            Write APIs
          </h3>
          <div className="mt-4 space-y-3">
            <label className="block space-y-2 text-sm font-semibold text-kaist-black">
              <span>article titleKo</span>
              <input
                value={articleForm.titleKo}
                onChange={(event) =>
                  setArticleForm((current) => ({
                    ...current,
                    titleKo: event.target.value,
                  }))
                }
                className="w-full rounded-lg border border-kaist-grey/30 px-3 py-2 text-sm font-medium outline-none focus:border-kaist-darkgreen"
              />
            </label>
            <label className="block space-y-2 text-sm font-semibold text-kaist-black">
              <span>article contentKo</span>
              <textarea
                value={articleForm.contentKo}
                onChange={(event) =>
                  setArticleForm((current) => ({
                    ...current,
                    contentKo: event.target.value,
                  }))
                }
                rows={3}
                className="w-full rounded-lg border border-kaist-grey/30 px-3 py-2 text-sm font-medium outline-none focus:border-kaist-darkgreen"
              />
            </label>
            <label className="block space-y-2 text-sm font-semibold text-kaist-black">
              <span>visibilityScope</span>
              <select
                value={articleForm.visibilityScope}
                onChange={(event) =>
                  setArticleForm((current) => ({
                    ...current,
                    visibilityScope: event.target.value as ArticleCreateRequest["visibilityScope"],
                  }))
                }
                className="w-full rounded-lg border border-kaist-grey/30 px-3 py-2 text-sm font-medium outline-none focus:border-kaist-darkgreen"
              >
                <option value="PUBLIC">PUBLIC</option>
                <option value="MEMBERS">MEMBERS</option>
                <option value="STAFF_ONLY">STAFF_ONLY</option>
              </select>
            </label>
            <label className="block space-y-2 text-sm font-semibold text-kaist-black">
              <span>comment content</span>
              <input
                value={commentForm.content}
                onChange={(event) =>
                  setCommentForm({ content: event.target.value })
                }
                className="w-full rounded-lg border border-kaist-grey/30 px-3 py-2 text-sm font-medium outline-none focus:border-kaist-darkgreen"
              />
            </label>
            <div className="flex flex-wrap gap-2 pt-2">
              <button
                type="button"
                disabled={loadingLabel !== null || !canMutate}
                onClick={() =>
                  void runAction("createArticle", () =>
                    apiClient.createArticle(boardCode.trim(), articleForm),
                  )
                }
                className="rounded-full border border-kaist-darkgreen px-4 py-2 text-xs font-bold text-kaist-darkgreen disabled:opacity-50"
              >
                create article
              </button>
              <button
                type="button"
                disabled={loadingLabel !== null || !canMutate}
                onClick={() =>
                  void runAction("updateArticle", () =>
                    apiClient.updateArticle(
                      boardCode.trim(),
                      articleId.trim(),
                      articleUpdateForm,
                    ),
                  )
                }
                className="rounded-full border border-kaist-darkgreen px-4 py-2 text-xs font-bold text-kaist-darkgreen disabled:opacity-50"
              >
                update article
              </button>
              <button
                type="button"
                disabled={loadingLabel !== null || !canMutate}
                onClick={() =>
                  void runAction("deleteArticle", () =>
                    apiClient.deleteArticle(boardCode.trim(), articleId.trim()),
                  )
                }
                className="rounded-full border border-red-400 px-4 py-2 text-xs font-bold text-red-600 disabled:opacity-50"
              >
                delete article
              </button>
              <button
                type="button"
                disabled={loadingLabel !== null || !canMutate}
                onClick={() =>
                  void runAction("createComment", () =>
                    apiClient.createComment(boardCode.trim(), articleId.trim(), {
                      ...commentForm,
                      parentCommentId: null,
                    }),
                  )
                }
                className="rounded-full border border-kaist-darkgreen px-4 py-2 text-xs font-bold text-kaist-darkgreen disabled:opacity-50"
              >
                create comment
              </button>
              <button
                type="button"
                disabled={loadingLabel !== null || !canMutate}
                onClick={() =>
                  void runAction("updateComment", () =>
                    apiClient.updateComment(
                      boardCode.trim(),
                      articleId.trim(),
                      commentId.trim(),
                      commentUpdateForm,
                    ),
                  )
                }
                className="rounded-full border border-kaist-darkgreen px-4 py-2 text-xs font-bold text-kaist-darkgreen disabled:opacity-50"
              >
                update comment
              </button>
              <button
                type="button"
                disabled={loadingLabel !== null || !canMutate}
                onClick={() =>
                  void runAction("deleteComment", () =>
                    apiClient.deleteComment(
                      boardCode.trim(),
                      articleId.trim(),
                      commentId.trim(),
                    ),
                  )
                }
                className="rounded-full border border-red-400 px-4 py-2 text-xs font-bold text-red-600 disabled:opacity-50"
              >
                delete comment
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-kaist-grey/20 bg-kaist-grey/5 p-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-extrabold tracking-tight text-kaist-black">
              Result
            </h3>
            <p className="mt-1 text-xs font-semibold uppercase tracking-[0.18em] text-kaist-greygreen">
              {loadingLabel ? `running: ${loadingLabel}` : "idle"}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setResult(null)}
            className="rounded-full border border-kaist-grey/30 px-4 py-2 text-xs font-bold text-kaist-greygreen"
          >
            clear
          </button>
        </div>

        <div className="mt-4">
          {result ? (
            result.error ? (
              <pre className="overflow-auto rounded-xl bg-black px-4 py-3 text-xs leading-6 text-red-200">
                {JSON.stringify(
                  {
                    label: result.label,
                    error: result.error,
                  },
                  null,
                  JSON_SPACES,
                )}
              </pre>
            ) : (
              <pre className="overflow-auto rounded-xl bg-black px-4 py-3 text-xs leading-6 text-green-200">
                {JSON.stringify(
                  {
                    label: result.label,
                    data: result.data,
                  },
                  null,
                  JSON_SPACES,
                )}
              </pre>
            )
          ) : (
            <p className="text-sm font-medium text-kaist-grey">
              버튼을 눌러 응답을 확인하세요.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
