import type {
  CommentEngagementKind,
  CommentItem,
} from "@soc/contracts";
import { isoToDate } from "@soc/shared";
import { ArrowUp, Flag, Heart, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { UiTextarea } from "@/components/ui/form-control";
import { cn } from "@/lib/utils";

type CommentSectionProps = {
  canCreateComment: boolean;
  canManageComments: boolean;
  commentActionSubmitting: string | null;
  commentError: string | null;
  commentSubmitting: boolean;
  commentText: string;
  comments: CommentItem[];
  commentsLoading: boolean;
  currentUserId: string | null;
  isAuthenticated: boolean;
  lang: string;
  onCommentTextChange: (value: string) => void;
  onCreateComment: () => Promise<void>;
  onCreateReply: (parentCommentId: string) => Promise<void>;
  onDeleteComment: (commentId: string) => Promise<void>;
  onReportComment: (commentId: string) => Promise<void>;
  onSetCommentEngagement: (
    commentId: string,
    kind: CommentEngagementKind,
    active: boolean,
  ) => Promise<void>;
  onReplyTextChange: (value: string) => void;
  onReplyTargetChange: (commentId: string | null) => void;
  replySubmitting: boolean;
  replyTargetId: string | null;
  replyText: string;
};

export function CommentSection({
  comments,
  commentsLoading,
  canManageComments,
  canCreateComment,
  currentUserId,
  commentActionSubmitting,
  commentText,
  commentError,
  commentSubmitting,
  isAuthenticated,
  lang,
  onCommentTextChange,
  onCreateComment,
  onCreateReply,
  onDeleteComment,
  onReportComment,
  onSetCommentEngagement,
  onReplyTextChange,
  onReplyTargetChange,
  replySubmitting,
  replyTargetId,
  replyText,
}: CommentSectionProps) {
  const topLevelComments = comments.filter((comment) => !comment.parentCommentId);
  const repliesByParent = new Map<string, CommentItem[]>();
  comments
    .filter((comment) => Boolean(comment.parentCommentId))
    .forEach((comment) => {
      const parentId = comment.parentCommentId!;
      const replies = repliesByParent.get(parentId) ?? [];
      replies.push(comment);
      repliesByParent.set(parentId, replies);
    });

  return (
    <section className="flex w-full flex-col rounded-xl border border-slate-200 bg-white px-6 py-6 shadow-[0_8px_28px_rgba(15,23,42,0.04)] md:px-[40px] md:py-[24px]">
      <div className="flex items-center justify-between">
        <h2 className="text-[18px] font-semibold leading-6 text-slate-800">
          <span>{lang === "ko" ? "댓글" : "Comments"}</span>
          <span className="ml-1 text-brand-primary">{comments.length}</span>
        </h2>
        {commentsLoading && (
          <Loader2 className="size-4 animate-spin text-brand-primary" />
        )}
      </div>

      <div className="mt-3">
        {comments.length === 0 && !commentsLoading ? (
          <div className="py-4 text-[14px] font-medium text-slate-500">
            {lang === "ko" ? "아직 등록된 댓글이 없습니다." : "No comments yet."}
          </div>
        ) : (
          <div className="space-y-1">
            {topLevelComments.map((comment) => {
              const replies = repliesByParent.get(comment.commentId) ?? [];
              const showReplyComposer = replyTargetId === comment.commentId;

              return (
                <div key={comment.commentId}>
                  <CommentRow
                    canDelete={
                      canManageComments || currentUserId === comment.author.userId
                    }
                    comment={comment}
                    commentActionSubmitting={commentActionSubmitting}
                    isAuthenticated={isAuthenticated}
                    lang={lang}
                    onDeleteComment={onDeleteComment}
                    onReportComment={onReportComment}
                    onSetCommentEngagement={onSetCommentEngagement}
                    onReplyToggle={() =>
                      onReplyTargetChange(
                        showReplyComposer ? null : comment.commentId,
                      )
                    }
                    showReplyButton={canCreateComment && isAuthenticated}
                  />

                  {showReplyComposer && canCreateComment && isAuthenticated ? (
                    <div className="ml-11 border-l-2 border-brand-primary/15 pb-2 pl-4 pt-1">
                      <CommentComposer
                        ariaLabel={lang === "ko" ? "대댓글 입력" : "Reply input"}
                        disabled={!canCreateComment}
                        isSubmitting={replySubmitting}
                        onChange={onReplyTextChange}
                        onSubmit={() => onCreateReply(comment.commentId)}
                        placeholder={
                          lang === "ko"
                            ? "대댓글을 입력해 주세요."
                            : "Write a reply..."
                        }
                        value={replyText}
                      />
                    </div>
                  ) : null}

                  {replies.map((reply) => (
                    <CommentRow
                      key={reply.commentId}
                      canDelete={
                        canManageComments || currentUserId === reply.author.userId
                      }
                      comment={reply}
                      commentActionSubmitting={commentActionSubmitting}
                      isAuthenticated={isAuthenticated}
                      isNested
                      lang={lang}
                      onDeleteComment={onDeleteComment}
                      onReportComment={onReportComment}
                      onSetCommentEngagement={onSetCommentEngagement}
                      onReplyToggle={() => undefined}
                      showReplyButton={false}
                    />
                  ))}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="mt-5">
        {isAuthenticated ? (
          <CommentComposer
            ariaLabel={lang === "ko" ? "댓글 입력" : "Comment input"}
            disabled={!canCreateComment}
            isSubmitting={commentSubmitting}
            onChange={onCommentTextChange}
            onSubmit={onCreateComment}
            placeholder={
              lang === "ko" ? "댓글을 입력해 주세요." : "Write a comment..."
            }
            value={commentText}
          />
        ) : (
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
            <p className="text-[14px] font-medium text-slate-600">
              {lang === "ko"
                ? "댓글 작성은 로그인이 필요합니다."
                : "Sign in to write a comment."}
            </p>
          </div>
        )}
        {!canCreateComment && isAuthenticated && (
          <p className="mt-2 text-xs font-medium text-rose-600">
            {lang === "ko"
              ? "이 게시글에는 댓글을 작성할 수 없습니다."
              : "Comments are not available on this post."}
          </p>
        )}
        {commentError && (
          <p className="mt-2 text-xs font-medium text-rose-600">{commentError}</p>
        )}
      </div>
    </section>
  );
}

function CommentRow({
  canDelete,
  comment,
  commentActionSubmitting,
  isAuthenticated,
  isNested = false,
  lang,
  onDeleteComment,
  onReportComment,
  onSetCommentEngagement,
  onReplyToggle,
  showReplyButton,
}: {
  canDelete: boolean;
  comment: CommentItem;
  commentActionSubmitting: string | null;
  isAuthenticated: boolean;
  isNested?: boolean;
  lang: string;
  onDeleteComment: (commentId: string) => Promise<void>;
  onReportComment: (commentId: string) => Promise<void>;
  onSetCommentEngagement: (
    commentId: string,
    kind: CommentEngagementKind,
    active: boolean,
  ) => Promise<void>;
  onReplyToggle: () => void;
  showReplyButton: boolean;
}) {
  const authorInitial = (
    comment.author.name || (lang === "ko" ? "익명" : "Anonymous")
  )
    .trim()
    .charAt(0)
    .toUpperCase();
  const likeActionKey = `${comment.commentId}:LIKE`;
  const reportActionKey = `${comment.commentId}:REPORT`;

  return (
    <article
      className={cn(
        "flex items-start gap-3.5 py-3.5",
        isNested ? "ml-11 border-l-2 border-slate-100 pl-4" : "",
      )}
    >
      <div className="flex size-8 shrink-0 select-none items-center justify-center rounded-full border border-slate-200 bg-slate-100">
        <span className="text-xs font-semibold text-slate-500">{authorInitial}</span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex items-baseline gap-2">
            <span className="truncate text-[14px] font-semibold text-slate-800">
              {comment.author.name}
            </span>
            <time className="shrink-0 text-xs font-normal text-slate-400">
              {formatDateTime(comment.createdAt)}
            </time>
          </div>
          <div className="flex shrink-0 items-center gap-0.5">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              aria-label={lang === "ko" ? "댓글 좋아요" : "Like comment"}
              aria-pressed={comment.viewerHasLiked}
              disabled={commentActionSubmitting === likeActionKey}
              onClick={() =>
                void onSetCommentEngagement(
                  comment.commentId,
                  "LIKE",
                  !comment.viewerHasLiked,
                )
              }
              className={cn(
                "h-7 gap-1 px-1.5 text-xs font-medium",
                comment.viewerHasLiked
                  ? "text-brand-primary"
                  : "text-slate-400 hover:text-brand-primary",
              )}
            >
              {commentActionSubmitting === likeActionKey ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Heart
                  className="size-3.5"
                  fill={comment.viewerHasLiked ? "currentColor" : "none"}
                />
              )}
              <span className="tabular-nums">{comment.likeCount}</span>
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              aria-label={lang === "ko" ? "댓글 신고" : "Report comment"}
              disabled={
                !isAuthenticated ||
                comment.viewerHasReported ||
                commentActionSubmitting === reportActionKey
              }
              onClick={() => void onReportComment(comment.commentId)}
              className={cn(
                "h-7 gap-1 px-1.5 text-xs font-medium",
                comment.viewerHasReported
                  ? "text-slate-300"
                  : "text-slate-400 hover:text-rose-600",
              )}
            >
              {commentActionSubmitting === reportActionKey ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Flag className="size-3.5" />
              )}
              <span>
                {comment.viewerHasReported
                  ? lang === "ko"
                    ? "신고됨"
                    : "Reported"
                  : lang === "ko"
                    ? "신고"
                    : "Report"}
              </span>
            </Button>
            {showReplyButton ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onReplyToggle}
                className="h-7 px-1.5 text-xs font-medium text-slate-400 hover:text-brand-primary"
              >
                {lang === "ko" ? "답글" : "Reply"}
              </Button>
            ) : null}
            {canDelete && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => void onDeleteComment(comment.commentId)}
                className="h-7 px-1.5 text-xs font-medium text-slate-400 hover:text-rose-600"
                title={lang === "ko" ? "댓글 삭제" : "Delete comment"}
              >
                {lang === "ko" ? "삭제" : "Delete"}
              </Button>
            )}
          </div>
        </div>
        <p className="mt-2 whitespace-pre-line text-[14px] font-medium leading-relaxed text-slate-700">
          {comment.content}
        </p>
      </div>
    </article>
  );
}

function CommentComposer({
  ariaLabel,
  disabled,
  isSubmitting,
  onChange,
  onSubmit,
  placeholder,
  value,
}: {
  ariaLabel: string;
  disabled: boolean;
  isSubmitting: boolean;
  onChange: (value: string) => void;
  onSubmit: () => Promise<void>;
  placeholder: string;
  value: string;
}) {
  const hasText = Boolean(value.trim());

  return (
    <div className="relative w-full">
      <UiTextarea
        rows={1}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel}
        className="min-h-[42px] w-full resize-none rounded-lg border border-slate-200 bg-white px-4 py-2.5 pr-12 text-[14px] font-medium leading-normal text-slate-800 outline-none placeholder:text-slate-400"
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey && hasText && !disabled) {
            event.preventDefault();
            void onSubmit();
          }
        }}
      />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label={ariaLabel.replace("입력", "등록")}
        onClick={() => void onSubmit()}
        disabled={disabled || isSubmitting || !hasText}
        className={cn(
          "absolute right-2 top-1/2 size-8 -translate-y-1/2 rounded-full p-0",
          hasText
            ? "bg-brand-primary text-white hover:bg-brand-primary/90"
            : "bg-slate-100 text-slate-400",
        )}
      >
        {isSubmitting ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <ArrowUp className="size-4" aria-hidden="true" />
        )}
      </Button>
    </div>
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
