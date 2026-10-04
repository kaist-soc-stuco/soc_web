import { ArticleLoading } from "@/components/ui/article-loading";
import { useRef, useState } from "react";

import { CommentSection } from "@/components/ui/comment-section";
import {
  BoardDetailArticleCard,
  BoardDetailBackLink,
} from "@/features/board-detail/board-detail-sections";
import { useBoardDetailPageController } from "@/features/board-detail/use-board-detail-page-controller";
import { PageShell } from "@/components/ui/page-layout";
import { Modal } from "@/components/ui/modal";
import { UiInput } from "@/components/ui/form-control";
import { Button } from "@/components/ui/button";
import { useMediaQuery } from "@/hooks/use-media-query";
import { MobileArticleHeader } from "@/features/board-detail/mobile-article-header";
import { MobileCommentComposer } from "@/features/board-detail/mobile-comment-composer";

export function BoardDetailPage({ forcedCategory, publicBasePath }: { forcedCategory?: string; publicBasePath?: string } = {}) {
  const {
    ConfirmDialog,
    article,
    boardTitle,
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
    handleRestoreArticle,
    handleDeleteComment,
    handleUpdateComment,
    handleHideComment,
    handleRestoreComment,
    handleSetCommentEngagement,
    handleSetArticleEngagement,
    handleShareArticle,
    lang,
    loading,
    posterAsset,
    posterStorageKey,
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
  const isMobile = useMediaQuery("(max-width: 767px)");
  const commentInputRef = useRef<HTMLTextAreaElement>(null);
  const commentLoginRef = useRef<HTMLAnchorElement>(null);
  const backTo = publicBasePath ?? (category === "_EVENT" ? "/events" : `/board/${category}`);
  const editHref = `${publicBasePath ?? `/board/${category}`}/${article?.articleId ?? ""}/edit`;
  const mobileHeader = <MobileArticleHeader title={category === "_EVENT" ? (lang === "ko" ? "행사" : "Events") : boardTitle} backTo={backTo} editHref={editHref} lang={lang} canEdit={canEdit} canModerate={canModerate} hidden={article?.status === "HIDDEN"} copied={shareCopied} loading={loading || !article} onShare={() => void handleShareArticle()} onHide={() => { setHideReason(""); setHideDialogOpen(true); }} onRestore={() => void handleRestoreArticle()} onDelete={() => void handleDeleteArticle()} />;

  if (loading) return <ArticleLoading mobileHeader={isMobile ? mobileHeader : undefined} />;

  if (!article) {
    return (
      <PageShell className="bg-white">
        {isMobile && mobileHeader}
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
    <PageShell className={`mobile-flat-detail text-slate-950 ${canViewCommentSection ? "mobile-detail-has-composer" : ""}`}>
      {isMobile && mobileHeader}
      {ConfirmDialog}
      <Modal
        open={hideDialogOpen}
        onClose={() => { if (!hideSubmitting) setHideDialogOpen(false); }}
        title={lang === "ko" ? "게시글 숨기기" : "Hide post"}
        size="compact"
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
                void handleHideArticle(hideReason.trim())
                  .then((success) => {
                    if (success) {
                      setHideDialogOpen(false);
                      setHideReason("");
                    }
                  })
                  .finally(() => setHideSubmitting(false));
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


      <main className="flex-1 w-full mx-auto pb-28">
        <div className="mobile-article-container mx-auto flex w-full max-w-[72rem] flex-col gap-3 px-4 pb-16 pt-6 min-[360px]:px-5 min-[640px]:px-6 lg:px-8">
          {!isMobile && <>
          <BoardDetailBackLink
            category={category}
            lang={lang}
            to={publicBasePath}
          />
          </>}

          <BoardDetailArticleCard
            article={article}
            adjacentBasePath={publicBasePath ?? `/board/${category}`}
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
            onRestoreArticle={() => void handleRestoreArticle()}
            onShare={() => void handleShareArticle()}
            onToggle={(kind, active) =>
              void handleSetArticleEngagement(kind, active)
            }
            posterAsset={posterAsset}
            posterStorageKey={posterStorageKey}
            shareCopied={shareCopied}
            surveyDescription={surveyDescription}
            surveyTitle={surveyTitle}
            submitting={engagementSubmitting}
            title={title}
            canComment={canViewCommentSection}
            commentTotal={commentTotal}
            onCommentClick={() => {
              if (canCreateComment) commentInputRef.current?.focus({ preventScroll: true });
              else if (!session?.canUsePersistentFeatures) commentLoginRef.current?.focus({ preventScroll: true });
              else document.getElementById("article-comments")?.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
          />

          {canViewCommentSection ? <CommentSection
            hideComposerOnMobile
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
            onRestoreComment={handleRestoreComment}
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
      {isMobile && canViewCommentSection && <MobileCommentComposer inputRef={commentInputRef} loginRef={commentLoginRef} authenticated={Boolean(session?.canUsePersistentFeatures)} canCreate={canCreateComment} submitting={commentSubmitting} value={commentText} error={commentError} lang={lang} onChange={setCommentText} onSubmit={handleCreateComment} />}

    </PageShell>
  );
}
