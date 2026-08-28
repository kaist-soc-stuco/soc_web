import { Loader2 } from "lucide-react";
import { useState } from "react";

import { Header } from "@/components/organisms/header";
import { CommentSection } from "@/components/ui/comment-section";
import {
  BoardDetailArticleCard,
  BoardDetailAdjacentNav,
  BoardDetailBackLink,
} from "@/features/board-detail/board-detail-sections";
import { useBoardDetailPageController } from "@/features/board-detail/use-board-detail-page-controller";
import { PageShell } from "@/components/ui/page-layout";
import { Modal } from "@/components/ui/modal";
import { UiInput } from "@/components/ui/form-control";
import { Button } from "@/components/ui/button";

export function BoardDetailPage({ forcedCategory, publicBasePath }: { forcedCategory?: string; publicBasePath?: string } = {}) {
  const {
    ConfirmDialog,
    article,
    allowEngagement,
    attachmentAssets,
    articleErrorCode,
    canCreateComment,
    canViewCommentSection,
    canEdit,
    canManageArticle,
    canManageComments,
    canModerate,
    category,
    commentActionSubmitting,
    commentPage,
    commentPageSize,
    commentError,
    commentSubmitting,
    commentText,
    commentTotal,
    comments,
    commentsLoading,
    content,
    engagementSubmitting,
    handleCreateComment,
    handleCreateReply,
    handleDeleteArticle,
    handleHideArticle,
    handleDeleteComment,
    handleUpdateComment,
    handleHideComment,
    handleSetCommentEngagement,
    handleSetArticleEngagement,
    handleShareArticle,
    lang,
    loading,
    posterAsset,
    commentPageTotal,
    replySubmitting,
    replyTargetId,
    replyText,
    session,
    shareCopied,
    setCommentText,
    setCommentPage,
    setReplyTargetId,
    setReplyText,
    surveyDescription,
    surveyTitle,
    title,
  } = useBoardDetailPageController(forcedCategory);
  const [hideDialogOpen, setHideDialogOpen] = useState(false);
  const [hideReason, setHideReason] = useState("");
  const [hideSubmitting, setHideSubmitting] = useState(false);

  if (loading) {
    return (
      <PageShell className="bg-white">
        <Header />
        <main className="flex flex-1 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-kaist-darkgreen" />
        </main>
      </PageShell>
    );
  }

  if (!article) {
    return (
      <PageShell className="bg-white">
        <Header />
        <main className="flex flex-1 items-center justify-center">
          <p className="text-sm font-bold text-slate-500">
            {lang === "ko"
              ? articleErrorCode === "secret_article_access_denied"
                ? "비밀글입니다."
                : "존재하지 않는 게시글입니다."
              : "This post does not exist or is unavailable."}
          </p>
        </main>
      </PageShell>
    );
  }

  return (
    <PageShell className="text-slate-950">
      {ConfirmDialog}
      <Modal
        open={hideDialogOpen}
        onClose={() => { if (!hideSubmitting) setHideDialogOpen(false); }}
        title={lang === "ko" ? "게시글 숨기기" : "Hide post"}
        footer={(
          <>
            <Button type="button" variant="outline" disabled={hideSubmitting} onClick={() => setHideDialogOpen(false)}>
              {lang === "ko" ? "취소" : "Cancel"}
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={hideSubmitting || hideReason.trim().length < 2}
              onClick={() => {
                setHideSubmitting(true);
                void handleHideArticle(hideReason.trim()).finally(() => setHideSubmitting(false));
              }}
            >
              {lang === "ko" ? "숨기기" : "Hide"}
            </Button>
          </>
        )}
      >
        <label className="block text-sm font-normal text-app-text-body">
          <span className="mb-2 block">{lang === "ko" ? "숨김 사유" : "Reason"}</span>
          <UiInput
            type="text"
            maxLength={500}
            className="w-full"
            value={hideReason}
            onChange={(event) => setHideReason(event.currentTarget.value)}
            placeholder={lang === "ko" ? "운영 기록에 남길 사유를 입력하세요." : "Enter a reason for the audit record."}
          />
        </label>
      </Modal>
      <Header />

      <main className="flex-1 w-full mx-auto pb-28">
        <div className="mx-auto max-w-[var(--ui-article-max-width)] px-6 lg:px-8 pt-6 pb-16 flex flex-col gap-3 w-full">
          <BoardDetailBackLink
            category={category}
            lang={lang}
            to={publicBasePath}
          />

          <BoardDetailArticleCard
            article={article}
            allowEngagement={allowEngagement}
            attachmentAssets={attachmentAssets}
            canEdit={canEdit}
            canModerate={canModerate}
            editHref={publicBasePath ? `${publicBasePath}/${article.articleId}/edit` : undefined}
            category={category}
            content={content}
            isAuthenticated={Boolean(session?.canUsePersistentFeatures)}
            lang={lang}
            onDeleteArticle={() => void handleDeleteArticle()}
            onHideArticle={() => { setHideReason(""); setHideDialogOpen(true); }}
            onShare={() => void handleShareArticle()}
            onToggle={(kind, active) =>
              void handleSetArticleEngagement(kind, active)
            }
            posterAsset={posterAsset}
            shareCopied={shareCopied}
            surveyDescription={surveyDescription}
            surveyTitle={surveyTitle}
            submitting={engagementSubmitting}
            title={title}
          />

          <BoardDetailAdjacentNav
            lang={lang}
            nextArticle={article.nextArticle}
            prevArticle={article.prevArticle}
            toBase={publicBasePath ?? `/board/${category}`}
          />

          {canViewCommentSection ? <CommentSection
            comments={comments}
            commentsLoading={commentsLoading}
            commentPage={commentPage}
            commentPageSize={commentPageSize}
            commentPageTotal={commentPageTotal}
            commentTotal={commentTotal}
            allowEngagement={allowEngagement}
            canManageComments={canManageComments}
            canCreateComment={canCreateComment}
            currentUserId={session?.userId ?? null}
            commentText={commentText}
            commentError={commentError}
            commentActionSubmitting={commentActionSubmitting}
            commentSubmitting={commentSubmitting}
            isAuthenticated={Boolean(session?.canUsePersistentFeatures)}
            lang={lang}
            onCommentTextChange={setCommentText}
            onCreateComment={handleCreateComment}
            onCreateReply={handleCreateReply}
            onDeleteComment={handleDeleteComment}
            onHideComment={handleHideComment}
            onCommentPageChange={setCommentPage}
            onUpdateComment={handleUpdateComment}
            onSetCommentEngagement={handleSetCommentEngagement}
            onReplyTextChange={setReplyText}
            onReplyTargetChange={setReplyTargetId}
            replySubmitting={replySubmitting}
            replyTargetId={replyTargetId}
            replyText={replyText}
          /> : null}

        </div>
      </main>

    </PageShell>
  );
}
