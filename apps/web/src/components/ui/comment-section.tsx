import type {
  CommentEngagementKind,
  CommentItem,
} from "@soc/contracts";
import { isoToDate, nowDate } from "@soc/shared";
import { ArrowUp, Edit2, Eye, EyeOff, Heart, Loader2, MessageCircle, MoreVertical, Trash2 } from "lucide-react";
import { useState } from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { AdminActionMenuPanel, AdminActionMenuItem } from "@/components/ui/admin-action-menu";

import { Button } from "@/components/ui/button";
import { EngagementActionButton } from "@/components/ui/article-engagement-actions";
import { UiInput, UiTextarea } from "@/components/ui/form-control";
import { Modal } from "@/components/ui/modal";
import { Pagination } from "@/components/ui/pagination";
import { cn } from "@/lib/utils";

const COMMENT_TEXTAREA_CLASS =
  "block w-full resize-none rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-base leading-normal text-slate-800 outline-none placeholder:text-slate-400 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400 md:text-[length:var(--ui-text-body-size)]";

type CommentSectionProps = {
  allowEngagement: boolean;
  canCreateComment: boolean;
  canManageComments: boolean;
  commentActionSubmitting: string | null;
  commentError: string | null;
  commentSubmitting: boolean;
  commentText: string;
  commentPage: number;
  commentPageSize: number;
  commentPageTotal: number;
  commentTotal: number;
  comments: CommentItem[];
  commentsLoading: boolean;
  currentUserId: string | null;
  isAuthenticated: boolean;
  lang: string;
  onCommentTextChange: (value: string) => void;
  onCreateComment: () => Promise<void>;
  onCreateReply: (parentCommentId: string) => Promise<void>;
  onDeleteComment: (commentId: string) => Promise<void>;
  onHideComment: (commentId: string, reason: string) => Promise<void>;
  onRestoreComment: (commentId: string) => Promise<void>;
  onCommentPageChange: (page: number) => void;
  onUpdateComment: (commentId: string, content: string) => Promise<void>;
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
  allowEngagement,
  comments,
  commentsLoading,
  canManageComments,
  canCreateComment,
  currentUserId,
  commentActionSubmitting,
  commentText,
  commentPage,
  commentPageSize,
  commentPageTotal,
  commentTotal,
  commentError,
  commentSubmitting,
  isAuthenticated,
  lang,
  onCommentTextChange,
  onCreateComment,
  onCreateReply,
  onDeleteComment,
  onHideComment,
  onRestoreComment,
  onCommentPageChange,
  onUpdateComment,
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
    <section className="flex w-full flex-col rounded-xl border border-slate-200 bg-white px-4 py-5 shadow-[0_8px_28px_rgba(15,23,42,0.04)] min-[360px]:px-5 min-[640px]:px-6 md:px-[52px] md:py-[24px]">
      <div className="flex items-center justify-between">
        <h2 className="text-[length:var(--ui-text-title-sm-size)] font-semibold leading-6 text-slate-800">
          <span>{lang === "ko" ? "댓글" : "Comments"}</span>
          <span className="ml-1 text-[length:var(--ui-text-body-size)] font-normal text-brand-primary">{commentTotal}</span>
        </h2>
        {commentsLoading && (
          <Loader2 className="size-4 animate-spin text-brand-primary" />
        )}
      </div>

      <div className="mt-3">
        {comments.length === 0 && !commentsLoading ? (
          <div className="py-4 text-[length:var(--ui-text-body-size)] font-medium text-slate-500">
            {lang === "ko" ? "아직 등록된 댓글이 없습니다." : "No comments yet."}
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {topLevelComments.map((comment) => {
              const replies = repliesByParent.get(comment.commentId) ?? [];
              const showReplyComposer = replyTargetId === comment.commentId;

              return (
                <div key={comment.commentId}>
                  <CommentRow
                    allowEngagement={allowEngagement}
                    canDelete={currentUserId === comment.author.userId}
                    canModerate={canManageComments}
                    comment={comment}
                    commentActionSubmitting={commentActionSubmitting}
                    isAuthenticated={isAuthenticated}
                    lang={lang}
                    onDeleteComment={onDeleteComment}
                    onHideComment={onHideComment}
                    onRestoreComment={onRestoreComment}
                    onUpdateComment={onUpdateComment}
                    onSetCommentEngagement={onSetCommentEngagement}
                    onReplyToggle={() =>
                      onReplyTargetChange(
                        showReplyComposer ? null : comment.commentId,
                      )
                    }
                    showReplyButton={canCreateComment && isAuthenticated}
                  />

                  {showReplyComposer && canCreateComment && isAuthenticated ? (
                    <div className="ml-5 min-w-0 border-l border-slate-200 pb-3 pl-4 pt-1 sm:ml-9 sm:pl-5">
                      <CommentComposer
                        ariaLabel={lang === "ko" ? "대댓글 입력" : "Reply input"}
                        disabled={!canCreateComment}
                        isSubmitting={replySubmitting}
                        onChange={onReplyTextChange}
                        onSubmit={() => onCreateReply(comment.commentId)}
                        placeholder={
                          lang === "ko"
                            ? "대댓글을 입력하세요."
                            : "Write a reply..."
                        }
                        value={replyText}
                      />
                    </div>
                  ) : null}

                  {replies.length > 0 ? (
                    <div className="mb-3 ml-5 border-l border-slate-200 pl-4 sm:ml-9 sm:pl-5">
                  {replies.map((reply) => (
                    <CommentRow
                      key={reply.commentId}
                      allowEngagement={allowEngagement}
                      canDelete={currentUserId === reply.author.userId}
                      canModerate={canManageComments}
                      comment={reply}
                      commentActionSubmitting={commentActionSubmitting}
                      isAuthenticated={isAuthenticated}
                      isNested
                      lang={lang}
                      onDeleteComment={onDeleteComment}
                      onHideComment={onHideComment}
                      onRestoreComment={onRestoreComment}
                      onUpdateComment={onUpdateComment}
                      onSetCommentEngagement={onSetCommentEngagement}
                      onReplyToggle={() => undefined}
                      showReplyButton={false}
                    />
                  ))}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {commentPageTotal > commentPageSize ? (
        <Pagination
          className="mt-4 border-t border-slate-100 pt-3"
          currentPage={commentPage}
          lang={lang}
          onPageChange={onCommentPageChange}
          totalPages={Math.ceil(commentPageTotal / commentPageSize)}
        />
      ) : null}

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
                ? "댓글을 입력하세요."
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
  allowEngagement,
  canDelete,
  canModerate,
  comment,
  commentActionSubmitting,
  isAuthenticated,
  isNested = false,
  lang,
  onDeleteComment,
  onHideComment,
  onRestoreComment,
  onUpdateComment,
  onSetCommentEngagement,
  onReplyToggle,
  showReplyButton,
}: {
  allowEngagement: boolean;
  canDelete: boolean;
  canModerate: boolean;
  comment: CommentItem;
  commentActionSubmitting: string | null;
  isAuthenticated: boolean;
  isNested?: boolean;
  lang: string;
  onDeleteComment: (commentId: string) => Promise<void>;
  onHideComment: (commentId: string, reason: string) => Promise<void>;
  onRestoreComment: (commentId: string) => Promise<void>;
  onUpdateComment: (commentId: string, content: string) => Promise<void>;
  onSetCommentEngagement: (
    commentId: string,
    kind: CommentEngagementKind,
    active: boolean,
  ) => Promise<void>;
  onReplyToggle: () => void;
  showReplyButton: boolean;
}) {
  const likeActionKey = `${comment.commentId}:LIKE`;
  const likeActive = isAuthenticated && comment.viewerHasLiked;
  const canHide = canModerate && comment.status === "PUBLISHED";
  const canRestore = canModerate && comment.status === "HIDDEN";
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [hideModalOpen, setHideModalOpen] = useState(false);
  const [hideReason, setHideReason] = useState("");
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(comment.content);
  const [editSubmitting, setEditSubmitting] = useState(false);

  const handleDeleteConfirm = async () => {
    setDeleteModalOpen(false);
    await onDeleteComment(comment.commentId);
  };

  const handleHideConfirm = async () => {
    if (!hideReason.trim()) return;
    const reason = hideReason.trim();
    setHideModalOpen(false);
    await onHideComment(comment.commentId, reason);
    setHideReason("");
  };

  const handleSaveEdit = async () => {
    if (!editText.trim() || editSubmitting) return;
    setEditSubmitting(true);
    try {
      await onUpdateComment(comment.commentId, editText);
      setEditing(false);
    } finally {
      setEditSubmitting(false);
    }
  };

  return (
    <article
      className={cn(
        "group flex items-start gap-2.5",
        isNested ? "py-2.5" : "py-4",
        comment.status === "HIDDEN" && "rounded-lg bg-amber-50/70 px-3 py-3",
      )}
    >
      <div className={cn("shrink-0 overflow-hidden rounded-full", isNested ? "size-6" : "size-7")}>
        <img
          src="/default-avatar.svg"
          alt=""
          aria-hidden="true"
          className="size-full object-cover"
          draggable="false"
        />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1">
            <span className="min-w-0 break-words text-[length:var(--ui-text-body-size)] font-semibold text-slate-800 [overflow-wrap:anywhere]">
              {(lang === "en" ? comment.author.nameEn || comment.author.name : comment.author.name)}
            </span>
            {comment.isOfficial ? (
              <span className="shrink-0 rounded-md border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[length:var(--ui-text-caption-size)] font-normal text-emerald-700">
                {lang === "ko" ? "공식 답변" : "Official response"}
              </span>
            ) : null}
            {comment.status === "HIDDEN" ? (
              <span className="shrink-0 rounded-md border border-amber-200 bg-amber-100 px-1.5 py-0.5 text-[length:var(--ui-text-caption-size)] font-semibold text-amber-800">
                {lang === "ko" ? "숨김" : "Hidden"}
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
          {!editing ? <div className="flex shrink-0 items-center gap-0.5 self-start sm:self-auto">
            {allowEngagement ? <EngagementActionButton
              active={likeActive}
              className="comment-engagement-action h-7 gap-1 rounded-md border-0 px-2 text-xs font-medium"
              count={comment.likeCount}
              icon={
                <Heart
                  className={cn(
                    "size-3.5",
                    likeActive ? "text-rose-600" : "text-slate-400",
                  )}
                  fill={likeActive ? "currentColor" : "none"}
                />
              }
              label={lang === "ko" ? "댓글 좋아요" : "Like comment"}
              loading={commentActionSubmitting === likeActionKey}
              onClick={() =>
                void onSetCommentEngagement(
                  comment.commentId,
                  "LIKE",
                  !likeActive,
                )
              }
              tone="like"
            /> : null}
            {showReplyButton ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={lang === "ko" ? "답글" : "Reply"}
                data-tooltip={lang === "ko" ? "답글" : "Reply"}
                onClick={onReplyToggle}
                className="comment-reply-action !size-7 !min-h-0 rounded-md border-0 bg-transparent !p-0 text-slate-400 hover:border-0 hover:bg-slate-100 hover:text-slate-500"
              >
                <MessageCircle className="size-3.5" aria-hidden="true" />
              </Button>
            ) : null}
            {(canDelete || canHide || canRestore) && (
              <DropdownMenu.Root modal={false}>
                <DropdownMenu.Trigger asChild>
                  <Button type="button" variant="ghost" size="icon" aria-label={lang === "ko" ? "댓글 더보기" : "Comment actions"} className="!size-7 !min-h-0 rounded-md border-0 text-slate-500">
                    <MoreVertical className="size-4" />
                  </Button>
                </DropdownMenu.Trigger>
                <DropdownMenu.Portal>
                  <DropdownMenu.Content asChild align="end" sideOffset={4}>
                    <AdminActionMenuPanel className="z-50">
                      {canDelete ? <DropdownMenu.Item asChild onSelect={() => { setEditText(comment.content); setEditing(true); }}>
                        <AdminActionMenuItem icon={<Edit2 />}>{lang === "ko" ? "수정" : "Edit"}</AdminActionMenuItem>
                      </DropdownMenu.Item> : null}
                      {canHide || canRestore ? <DropdownMenu.Item asChild onSelect={() => {
                        if (canRestore) { void onRestoreComment(comment.commentId); return; }
                        setHideReason(""); setHideModalOpen(true);
                      }}>
                        <AdminActionMenuItem icon={canRestore ? <Eye /> : <EyeOff />}>
                          {canRestore ? (lang === "ko" ? "숨김 해제" : "Unhide") : (lang === "ko" ? "숨기기" : "Hide")}
                        </AdminActionMenuItem>
                      </DropdownMenu.Item> : null}
                      {canDelete ? <DropdownMenu.Item asChild onSelect={() => setDeleteModalOpen(true)}>
                        <AdminActionMenuItem tone="danger" icon={<Trash2 />}>{lang === "ko" ? "삭제" : "Delete"}</AdminActionMenuItem>
                      </DropdownMenu.Item> : null}
                    </AdminActionMenuPanel>
                  </DropdownMenu.Content>
                </DropdownMenu.Portal>
              </DropdownMenu.Root>
            )}
          </div> : null}
        </div>
        {canDelete ? (
          <Modal
            open={deleteModalOpen}
            onClose={() => {
              if (commentActionSubmitting !== comment.commentId) {
                setDeleteModalOpen(false);
              }
            }}
            title={lang === "ko" ? "댓글을 삭제할까요?" : "Delete this comment?"}
            showClose={false}
            className="max-w-[25rem]"
            footer={(
              <>
                <Button
                  type="button"
                  variant="outline"
                  disabled={commentActionSubmitting === comment.commentId}
                  onClick={() => setDeleteModalOpen(false)}
                >
                  {lang === "ko" ? "취소" : "Cancel"}
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  disabled={commentActionSubmitting === comment.commentId}
                  onClick={() => void handleDeleteConfirm()}
                >
                  {lang === "ko" ? "삭제" : "Delete"}
                </Button>
              </>
            )}
          >
            <p className="text-sm font-normal leading-6 text-neutral-600">
              {lang === "ko" ? "삭제한 댓글은 복구할 수 없습니다." : "Deleted comments cannot be restored."}
            </p>
          </Modal>
        ) : null}
        {canHide ? (
          <Modal
            open={hideModalOpen}
            onClose={() => {
              if (commentActionSubmitting !== comment.commentId) {
                setHideModalOpen(false);
              }
            }}
            title={lang === "ko" ? "댓글 숨기기" : "Hide comment"}
            showClose={false}
            className="max-w-[25rem]"
            footer={(
              <>
                <Button
                  type="button"
                  variant="outline"
                  disabled={commentActionSubmitting === comment.commentId}
                  onClick={() => setHideModalOpen(false)}
                >
                  {lang === "ko" ? "취소" : "Cancel"}
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  disabled={commentActionSubmitting === comment.commentId || !hideReason.trim()}
                  onClick={() => void handleHideConfirm()}
                >
                  {lang === "ko" ? "숨기기" : "Hide"}
                </Button>
              </>
            )}
          >
            <div className="space-y-3">
              <p className="text-sm font-normal leading-6 text-slate-600">
                {lang === "ko" ? "숨김 사유를 입력해 주세요." : "Enter a reason for hiding this comment."}
              </p>
              <UiInput
                autoFocus
                className="w-full"
                value={hideReason}
                onChange={(event) => setHideReason(event.currentTarget.value)}
                placeholder={lang === "ko" ? "관리 기록에 남길 사유" : "Reason recorded in the audit log"}
              />
            </div>
          </Modal>
        ) : null}
        {editing ? (
          <div className="mt-2">
              <UiTextarea
                autoFocus
                autoResize
                rows={1}
                value={editText}
                onChange={(event) => setEditText(event.target.value)}
                className={cn(COMMENT_TEXTAREA_CLASS, "!min-h-0 font-medium")}
              />
            <div className="mt-2 flex justify-end gap-1.5">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setEditing(false)}
              >
                {lang === "ko" ? "취소" : "Cancel"}
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => void handleSaveEdit()}
                disabled={editSubmitting || !editText.trim()}
              >
                {lang === "ko" ? "저장" : "Save"}
              </Button>
            </div>
          </div>
        ) : (
            <p className="mt-0 whitespace-pre-line text-[length:var(--ui-text-body-size)] font-normal leading-relaxed text-slate-700">
            {comment.content}
          </p>
        )}
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
        disabled={disabled}
        className={cn(COMMENT_TEXTAREA_CLASS, "min-h-[var(--ui-control-height-mobile)] pr-14 font-medium")}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing && event.keyCode !== 229 && hasText && !disabled && !isSubmitting) {
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
            "absolute right-2 top-1/2 !size-8 !min-h-0 -translate-y-1/2 rounded-full !p-0 !text-white hover:!text-white focus-visible:!text-white",
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
