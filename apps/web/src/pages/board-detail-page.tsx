import { Loader2 } from "lucide-react";

import { Header } from "@/components/organisms/header";
import { Footer } from "@/components/organisms/footer";
import { PageHero } from "@/components/organisms/page-hero";
import { CommentSection } from "@/components/ui/comment-section";
import {
  BoardDetailAdjacentLinks,
  BoardDetailArticleCard,
  BoardDetailBreadcrumb,
  BoardDetailTabs,
} from "@/features/board-detail/board-detail-sections";
import { useBoardDetailPageController } from "@/features/board-detail/use-board-detail-page-controller";

export function BoardDetailPage() {
  const {
    ConfirmDialog,
    article,
    attachmentAssets,
    boardDescription,
    boardTitle,
    boards,
    canCreateComment,
    canEdit,
    canManageComments,
    category,
    commentError,
    commentSubmitting,
    commentText,
    comments,
    commentsLoading,
    content,
    displayBoardLabel,
    handleCreateComment,
    handleDeleteArticle,
    handleDeleteComment,
    lang,
    loading,
    posterAsset,
    session,
    setCommentText,
    surveyDescription,
    surveyTitle,
    title,
  } = useBoardDetailPageController();

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col bg-white">
        <Header showLogo />
        <main className="flex flex-1 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-kaist-darkgreen" />
        </main>
      </div>
    );
  }

  if (!article) {
    return (
      <div className="flex min-h-screen flex-col bg-white">
        <Header showLogo />
        <main className="flex flex-1 items-center justify-center">
          <p className="text-sm font-bold text-slate-500">
            존재하지 않는 게시글입니다.
          </p>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fafafa] flex flex-col text-slate-950">
      {ConfirmDialog}
      <Header showLogo />

      <main className="flex-1 w-full mx-auto pb-16">
        <PageHero
          title={boardTitle}
          description={boardDescription}
          variant="compact"
        />
        <BoardDetailTabs boards={boards} category={category} lang={lang} />

        <div className="mx-auto max-w-[1040px] px-6 lg:px-8 pt-1 pb-16 flex flex-col gap-3 w-full">
          <BoardDetailBreadcrumb
            category={category}
            displayBoardLabel={displayBoardLabel}
          />

          <BoardDetailArticleCard
            article={article}
            attachmentAssets={attachmentAssets}
            canEdit={canEdit}
            category={category}
            content={content}
            lang={lang}
            onDeleteArticle={() => void handleDeleteArticle()}
            posterAsset={posterAsset}
            surveyDescription={surveyDescription}
            surveyTitle={surveyTitle}
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
            commentSubmitting={commentSubmitting}
            isAuthenticated={Boolean(session?.canUsePersistentFeatures)}
            onCommentTextChange={setCommentText}
            onCreateComment={handleCreateComment}
            onDeleteComment={handleDeleteComment}
          />

          <BoardDetailAdjacentLinks article={article} category={category} />
        </div>
      </main>

      <Footer />
    </div>
  );
}
