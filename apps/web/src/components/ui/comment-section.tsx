import type { CommentItem } from "@soc/contracts";
import { isoToDate } from "@soc/shared";
import { Loader2 } from "lucide-react";

type CommentSectionProps = {
  canCreateComment: boolean;
  canManageComments: boolean;
  commentError: string | null;
  commentSubmitting: boolean;
  commentText: string;
  comments: CommentItem[];
  commentsLoading: boolean;
  currentUserId: string | null;
  isAuthenticated: boolean;
  onCommentTextChange: (value: string) => void;
  onCreateComment: () => Promise<void>;
  onDeleteComment: (commentId: string) => Promise<void>;
};

export function CommentSection({
  comments,
  commentsLoading,
  canManageComments,
  canCreateComment,
  currentUserId,
  commentText,
  commentError,
  commentSubmitting,
  isAuthenticated,
  onCommentTextChange,
  onCreateComment,
  onDeleteComment,
}: CommentSectionProps) {
  return (
    <section className="flex w-full flex-col rounded-xl border border-slate-200 bg-white px-6 py-6 shadow-[0_8px_28px_rgba(15,23,42,0.04)] md:px-[40px] md:py-[24px]">
      <div className="flex items-center justify-between pb-3">
        <h2 className="text-sm font-bold text-slate-800">
          댓글 {comments.length}
        </h2>
        {commentsLoading && (
          <Loader2 className="h-4 w-4 animate-spin text-kaist-darkgreen" />
        )}
      </div>

      <div className="order-3 mt-2 border-t border-slate-100 pt-4">
        {isAuthenticated ? (
          <div className="flex w-full items-stretch gap-2.5">
            <textarea
              rows={1}
              value={commentText}
              onChange={(event) => onCommentTextChange(event.target.value)}
              placeholder="댓글을 입력해주세요."
              className="min-h-[40px] flex-1 resize-none rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium leading-normal text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-kaist-darkgreen focus:ring-2 focus:ring-kaist-darkgreen/10"
              onKeyDown={(event) => {
                if (
                  event.key === "Enter" &&
                  !event.shiftKey &&
                  commentText.trim() &&
                  !commentSubmitting &&
                  canCreateComment
                ) {
                  event.preventDefault();
                  void onCreateComment();
                }
              }}
            />
            <button
              type="button"
              onClick={() => void onCreateComment()}
              disabled={
                !canCreateComment || commentSubmitting || !commentText.trim()
              }
              className="inline-flex h-[40px] shrink-0 items-center justify-center rounded-lg bg-[#004b2c] px-6 text-sm font-bold text-white transition hover:bg-[#003820] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {commentSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "등록"
              )}
            </button>
          </div>
        ) : (
          <div className="rounded-lg bg-slate-50 px-3 py-2.5">
            <p className="text-sm font-bold text-slate-500">
              댓글 작성은 로그인이 필요합니다.
            </p>
          </div>
        )}
        {!canCreateComment && isAuthenticated && (
          <p className="mt-2 text-xs font-semibold text-rose-600">
            이 게시글에는 댓글을 작성할 수 없습니다.
          </p>
        )}
        {commentError && (
          <p className="mt-2 text-xs font-semibold text-rose-600">
            {commentError}
          </p>
        )}
      </div>

      <div className="order-2 mt-2 divide-y divide-slate-100">
        {comments.length === 0 && !commentsLoading ? (
          <div className="py-4 text-sm font-medium text-slate-400">
            아직 등록된 댓글이 없습니다.
          </div>
        ) : (
          comments.map((comment) => {
            const canDelete =
              canManageComments || currentUserId === comment.author.userId;
            const authorInitial = (comment.author.name || "익명")
              .trim()
              .charAt(0)
              .toUpperCase();

            return (
              <article
                key={comment.commentId}
                className="flex items-start gap-3.5 py-3.5"
              >
                <div className="flex h-8 w-8 shrink-0 select-none items-center justify-center rounded-full border border-slate-200 bg-slate-100">
                  <span className="text-xs font-bold text-slate-500">
                    {authorInitial}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="min-w-0 text-sm">
                      <span className="mr-2.5 font-extrabold text-slate-800">
                        {comment.author.name}
                      </span>
                      <span className="text-xs font-semibold text-slate-400">
                        {formatDateTime(comment.createdAt)}
                      </span>
                    </p>
                    {canDelete && (
                      <button
                        type="button"
                        onClick={() => void onDeleteComment(comment.commentId)}
                        className="shrink-0 text-xs font-bold text-slate-400 transition hover:text-rose-600"
                        title="댓글 삭제"
                      >
                        삭제
                      </button>
                    )}
                  </div>
                  <p className="mt-1.5 whitespace-pre-line text-[0.92rem] font-medium leading-relaxed text-slate-700">
                    {comment.content}
                  </p>
                </div>
              </article>
            );
          })
        )}
      </div>
    </section>
  );
}

function formatDateTime(isoString: string) {
  const date = isoToDate(isoString);
  if (Number.isNaN(date.getTime())) return "";

  const yyyy = date.getFullYear();
  const MM = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  return `${yyyy}.${MM}.${dd} ${hh}:${mm}`;
}
