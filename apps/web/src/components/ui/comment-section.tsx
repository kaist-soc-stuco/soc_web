import type {
  CommentEngagementKind,
  CommentItem,
} from "@soc/contracts";
import { isoToDate, nowDate } from "@soc/shared";
import { ArrowUp, Heart, Loader2, Trash2 } from "lucide-react";
import { useState } from "react";

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
    <section className="flex w-full flex-col rounded-xl border border-slate-200 bg-white px-6 py-6 shadow-[0_8px_28px_rgba(15,23,42,0.04)] md:px-[52px] md:py-[24px]">
      <div className="flex items-center justify-between">
        <h2 className="text-[18px] font-semibold leading-6 text-slate-800">
          <span>{lang === "ko" ? "댓글" : "Comments"}</span>
          <span className="ml-1 text-[14px] text-brand-primary">{comments.length}</span>
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
                    lang={lang}
                    onDeleteComment={onDeleteComment}
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
                      isNested
                      lang={lang}
                      onDeleteComment={onDeleteComment}
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
        <CommentComposer
          ariaLabel={lang === "ko" ? "댓글 입력" : "Comment input"}
          disabled={!isAuthenticated || !canCreateComment}
          isSubmitting={commentSubmitting}
          onChange={onCommentTextChange}
          onSubmit={onCreateComment}
          placeholder={
            isAuthenticated
              ? lang === "ko"
                ? "댓글을 입력해 주세요."
                : "Write a comment..."
              : lang === "ko"
                ? "로그인 후 댓글을 작성해 보세요."
                : "Sign in to write a comment."
          }
          value={commentText}
        />
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
  isNested = false,
  lang,
  onDeleteComment,
  onSetCommentEngagement,
  onReplyToggle,
  showReplyButton,
}: {
  canDelete: boolean;
  comment: CommentItem;
  commentActionSubmitting: string | null;
  isNested?: boolean;
  lang: string;
  onDeleteComment: (commentId: string) => Promise<void>;
  onSetCommentEngagement: (
    commentId: string,
    kind: CommentEngagementKind,
    active: boolean,
  ) => Promise<void>;
  onReplyToggle: () => void;
  showReplyButton: boolean;
}) {
  const likeActionKey = `${comment.commentId}:LIKE`;
  const [deletePopoverOpen, setDeletePopoverOpen] = useState(false);

  const handleDeleteConfirm = async () => {
    setDeletePopoverOpen(false);
    await onDeleteComment(comment.commentId);
  };

  return (
    <article
      className={cn(
        "group flex items-start gap-2.5 py-3.5",
        isNested ? "ml-9 border-l-2 border-slate-100 pl-3" : "",
      )}
    >
      <div className="size-6 shrink-0 overflow-hidden rounded-full">
        <img
          src="/default-avatar.svg"
          alt=""
          aria-hidden="true"
          className="size-full object-cover"
          draggable="false"
        />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex items-baseline gap-2">
            <span className="truncate text-[14px] font-semibold text-slate-800">
              {comment.author.name}
            </span>
            {comment.isOfficial ? (
              <span className="shrink-0 rounded-md border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[11px] font-normal text-emerald-700">
                {lang === "ko" ? "공식 답변" : "Official response"}
              </span>
            ) : null}
            <time
              className="shrink-0 text-xs font-normal text-slate-400"
              dateTime={comment.createdAt}
              title={formatDateTime(comment.createdAt)}
            >
              {formatRelativeTime(comment.createdAt, lang)}
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
                  "h-7 gap-1 rounded-md border-0 px-1.5 text-xs font-medium hover:bg-slate-100",
                  comment.viewerHasLiked
                    ? "text-rose-600 hover:text-rose-600"
                    : "text-slate-400 hover:text-slate-400",
                )}
            >
              {commentActionSubmitting === likeActionKey ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Heart
                  className={cn(
                    "size-3.5",
                    comment.viewerHasLiked ? "text-rose-600" : "text-slate-400",
                  )}
                  fill={comment.viewerHasLiked ? "currentColor" : "none"}
                />
              )}
              <span className="tabular-nums">{comment.likeCount}</span>
            </Button>
            {showReplyButton ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onReplyToggle}
                className="h-7 rounded-md border-0 bg-transparent px-1.5 text-xs font-medium text-slate-400 hover:border-0 hover:bg-slate-100 hover:text-slate-400"
              >
                {lang === "ko" ? "답글" : "Reply"}
              </Button>
            ) : null}
            {canDelete && (
              <div className="relative">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={lang === "ko" ? "댓글 삭제" : "Delete comment"}
                  aria-expanded={deletePopoverOpen}
                  onClick={() => setDeletePopoverOpen((open) => !open)}
                  className="pointer-events-none size-7 rounded-md border-0 bg-transparent text-slate-400 opacity-0 transition-opacity hover:border-0 hover:bg-slate-100 hover:text-rose-600 group-hover:pointer-events-auto group-hover:opacity-100 focus-visible:pointer-events-auto focus-visible:opacity-100"
                  title={lang === "ko" ? "댓글 삭제" : "Delete comment"}
                >
                  <Trash2 className="size-3.5" aria-hidden="true" />
                </Button>
                {deletePopoverOpen ? (
                  <div
                    aria-label={lang === "ko" ? "댓글 삭제 확인" : "Confirm comment deletion"}
                    className="absolute bottom-full right-0 z-30 mb-2 w-52 rounded-lg border border-slate-200 bg-white p-3 text-left shadow-[0_10px_24px_rgba(15,23,42,0.14)]"
                    role="dialog"
                  >
                    <p className="text-[13px] font-medium leading-5 text-slate-700">
                      {lang === "ko" ? "댓글을 삭제할까요?" : "Delete this comment?"}
                    </p>
                    <div className="mt-2.5 flex justify-end gap-1.5">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => setDeletePopoverOpen(false)}
                      >
                        {lang === "ko" ? "취소" : "Cancel"}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="destructive"
                        disabled={commentActionSubmitting === comment.commentId}
                        onClick={() => void handleDeleteConfirm()}
                      >
                        {lang === "ko" ? "삭제" : "Delete"}
                      </Button>
                    </div>
                  </div>
                ) : null}
              </div>
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
  const [isFocused, setIsFocused] = useState(false);

  return (
    <div
      className="relative w-full"
      onFocus={() => setIsFocused(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setIsFocused(false);
        }
      }}
    >
      <UiTextarea
        rows={1}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel}
        className="block min-h-[42px] w-full resize-none rounded-lg border border-slate-200 bg-white px-4 py-2.5 pr-12 text-[14px] font-medium leading-normal text-slate-800 outline-none placeholder:text-slate-400"
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey && hasText && !disabled) {
            event.preventDefault();
            void onSubmit();
          }
        }}
      />
      {isFocused ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={ariaLabel.replace("입력", "등록")}
          onClick={() => void onSubmit()}
          disabled={disabled || isSubmitting || !hasText}
          className={cn(
            "animate-in fade-in zoom-in-95 absolute right-2 top-1/2 size-8 -translate-y-1/2 rounded-full p-0 text-white duration-200",
            hasText
              ? "bg-brand-primary hover:bg-brand-primary/90"
              : "bg-brand-primary/20 hover:bg-brand-primary/20",
          )}
        >
          {isSubmitting ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <ArrowUp className="size-4" aria-hidden="true" />
          )}
        </Button>
      ) : null}
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

function formatRelativeTime(isoString: string, lang: string) {
  const date = isoToDate(isoString);
  if (Number.isNaN(date.getTime())) return "";

  const elapsedMs = Math.max(0, nowDate().getTime() - date.getTime());
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  const week = 7 * day;
  const month = 30 * day;
  const year = 365 * day;

  if (elapsedMs < minute) return lang === "ko" ? "방금" : "Just now";
  if (elapsedMs < hour) {
    const value = Math.floor(elapsedMs / minute);
    return lang === "ko" ? `${value}분 전` : `${value}m ago`;
  }
  if (elapsedMs < day) {
    const value = Math.floor(elapsedMs / hour);
    return lang === "ko" ? `${value}시간 전` : `${value}h ago`;
  }
  if (elapsedMs < week) {
    const value = Math.floor(elapsedMs / day);
    return lang === "ko" ? `${value}일 전` : `${value}d ago`;
  }
  if (elapsedMs < month) {
    const value = Math.floor(elapsedMs / week);
    return lang === "ko" ? `${value}주 전` : `${value}w ago`;
  }
  if (elapsedMs < year) {
    const value = Math.floor(elapsedMs / month);
    return lang === "ko" ? `${value}달 전` : `${value}mo ago`;
  }

  const value = Math.floor(elapsedMs / year);
  return lang === "ko" ? `${value}년 전` : `${value}y ago`;
}
