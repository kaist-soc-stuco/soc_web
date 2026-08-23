import { Loader2 } from "lucide-react";

import { Header } from "@/components/organisms/header";
import { CommentSection } from "@/components/ui/comment-section";
import {
  BoardDetailArticleCard,
  BoardDetailBackLink,
  BoardDetailBreadcrumb,
} from "@/features/board-detail/board-detail-sections";
import { useBoardDetailPageController } from "@/features/board-detail/use-board-detail-page-controller";
import { PageShell } from "@/components/ui/page-layout";

export function BoardDetailPage({ forcedCategory, publicBasePath }: { forcedCategory?: string; publicBasePath?: string } = {}) {
  const {
    ConfirmDialog,
    article,
    attachmentAssets,
    canCreateComment,
    canManageArticle,
    canManageComments,
    category,
    commentActionSubmitting,
    commentError,
    commentSubmitting,
    commentText,
    comments,
    commentsLoading,
    content,
    displayBoardLabel,
    engagementSubmitting,
    handleCreateComment,
    handleCreateReply,
    handleDeleteArticle,
    handleDeleteComment,
    handleSetCommentEngagement,
    handleSetArticleEngagement,
    handleShareArticle,
    lang,
    loading,
    posterAsset,
    replySubmitting,
    replyTargetId,
    replyText,
    session,
    shareCopied,
    setCommentText,
    setReplyTargetId,
    setReplyText,
    surveyDescription,
    surveyTitle,
    title,
  } = useBoardDetailPageController(forcedCategory);

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
              ? "존재하지 않는 게시글입니다."
              : "This post does not exist or is unavailable."}
          </p>
        </main>
      </PageShell>
    );
  }

  return (
    <PageShell className="text-slate-950">
      {ConfirmDialog}
      <Header />

      <main className="flex-1 w-full mx-auto pb-28">
        <div className="mx-auto max-w-[1040px] px-6 lg:px-8 pt-6 pb-16 flex flex-col gap-3 w-full">
          <BoardDetailBreadcrumb
            category={category}
            displayBoardLabel={displayBoardLabel}
            lang={lang}
            publicBasePath={publicBasePath}
          />

          <BoardDetailArticleCard
            article={article}
            attachmentAssets={attachmentAssets}
            canManageArticle={canManageArticle}
            editHref={publicBasePath ? `${publicBasePath}/${article.articleId}/edit` : undefined}
            category={category}
            categoryLabel={displayBoardLabel}
            content={content}
            lang={lang}
            onDeleteArticle={() => void handleDeleteArticle()}
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

          <CommentSection
            comments={comments}
            commentsLoading={commentsLoading}
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
            onSetCommentEngagement={handleSetCommentEngagement}
            onReplyTextChange={setReplyText}
            onReplyTargetChange={setReplyTargetId}
            replySubmitting={replySubmitting}
            replyTargetId={replyTargetId}
            replyText={replyText}
          />

          <BoardDetailBackLink
            category={category}
            lang={lang}
            to={publicBasePath}
          />
        </div>
      </main>

    </PageShell>
  );
}
