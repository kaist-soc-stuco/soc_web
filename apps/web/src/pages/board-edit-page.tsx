import { useState } from "react";
import { Loader2 } from "lucide-react";

import { Header } from "@/components/organisms/header";
import { DataViewCard, PageContainer, PageHeader, PageMain, PageShell } from "@/components/ui/page-layout";
import {
  BoardEditHeaderControls,
  BoardWriteAttachmentList,
  BoardWriteEditorFields,
  BoardWriteEventFields,
  BoardWriteSettings,
  BoardWriteFooter,
} from "@/features/board-write/board-write-form-sections";
import {
  ArticleTemplateControl,
  type BoardTemplateSnapshot,
} from "@/features/board-write/article-template-control";
import { useBoardEditPageController } from "@/features/board-write/use-board-edit-page-controller";
import { getBoardLabelFromMetadata } from "@/lib/board-metadata";
import { Button } from "@/components/ui/button";
import { UiInput } from "@/components/ui/form-control";
import { DraftRestoredBanner } from "@/components/ui/draft-restored-banner";

export function BoardEditPage() {
  const {
    ConfirmDialog,
    assets,
    allowComment,
    allowSecret,
    backToArticle,
    canConfigurePostSettings,
    canManageTemplates,
    category,
    contentEn,
    contentKo,
    draftRestoredAt,
    error,
    eventDescriptionKo,
    eventDescriptionEn,
    eventEndDate,
    eventStartDate,
    fileInputRef,
    handleSubmit,
    handleStartNewDraft,
    handleUploadFiles,
    isAnonymous,
    isEventAlwaysOpen,
    isKoreanOnly,
    isPinned,
    isSecret,
    isSubmitting,
    lang,
    loading,
    selectedSurveyId,
    setAllowComment,
    setAssets,
    setContentEn,
    setContentKo,
    setEventDescriptionKo,
    setEventDescriptionEn,
    setEventEndDate,
    setEventStartDate,
    setIsAnonymous,
    setIsEventAlwaysOpen,
    setIsKoreanOnly,
    setIsPinned,
    setIsSecret,
    setSelectedSurveyId,
    setTitleEn,
    setTitleKo,
    surveys,
    titleEn,
    titleKo,
    uploading,
  } = useBoardEditPageController();
  const categoryLabel = getBoardLabelFromMetadata(undefined, category, lang);
  const [dismissedDraftAt, setDismissedDraftAt] = useState<string | null>(null);
  const showDraftRestoredBanner = Boolean(draftRestoredAt && draftRestoredAt !== dismissedDraftAt);
  const templateSnapshot: BoardTemplateSnapshot = {
    boardCode: category,
    titleKo,
    titleEn,
    contentKo,
    contentEn,
    isAnonymous,
    isPinned,
    isSecret,
    allowComment,
    isKoreanOnly,
    isEventAlwaysOpen,
    eventStartDate,
    eventEndDate,
    eventDescriptionKo,
    eventDescriptionEn,
    selectedSurveyId,
    assets,
  };
  const applyTemplate = (template: BoardTemplateSnapshot) => {
    setTitleKo(template.titleKo);
    setTitleEn(template.titleEn);
    setContentKo(template.contentKo);
    setContentEn(template.contentEn);
    setIsAnonymous(template.isAnonymous);
    setIsPinned(template.isPinned);
    setIsSecret(template.isSecret);
    setAllowComment(template.allowComment);
    setIsKoreanOnly(template.isKoreanOnly);
    setIsEventAlwaysOpen(template.isEventAlwaysOpen);
    setEventStartDate(template.eventStartDate);
    setEventEndDate(template.eventEndDate);
    setEventDescriptionKo(template.eventDescriptionKo);
    setEventDescriptionEn(template.eventDescriptionEn);
    setSelectedSurveyId(template.selectedSurveyId);
    setAssets(template.assets.map((asset) => ({ ...asset })));
  };

  return (
    <PageShell className="text-slate-950">
      {ConfirmDialog}
      <Header />

      <PageHeader
        className="board-write-page-header"
        title={
          lang === "ko"
            ? `${categoryLabel} - 글 수정하기`
            : `${categoryLabel} - Edit Post`
        }
        breadcrumbs={[
          { label: lang === "ko" ? "게시판" : "Board", to: "/board" },
          { label: categoryLabel },
        ]}
        actions={
          <div className="flex items-center justify-end gap-2">
            {canManageTemplates ? (
              <ArticleTemplateControl
                boardCode={category}
                boardLabel={categoryLabel}
                lang={lang}
                onApply={applyTemplate}
                snapshot={templateSnapshot}
              />
            ) : null}
            <BoardWriteFooter
              compact
              lang={lang}
              isSubmitting={isSubmitting}
              onCancel={backToArticle}
              onSubmit={handleSubmit}
              submitLabel={lang === "ko" ? "수정 완료" : "Save Changes"}
              submittingLabel={lang === "ko" ? "저장 중..." : "Saving..."}
            />
          </div>
        }
      />

      <PageMain className="pb-20">
        <PageContainer className="flex max-w-none flex-col gap-4 pb-16 pt-4">
          {loading ? (
            <div className="bg-white border border-slate-200 rounded-xl p-16 shadow-[0_10px_35px_rgba(15,23,42,0.05)] flex flex-col items-center justify-center gap-4">
              <Loader2 className="w-10 h-10 text-kaist-darkgreen animate-spin" />
              <p className="text-xs font-semibold text-slate-400">
                {lang === "ko"
                  ? "게시글을 불러오는 중입니다..."
                  : "Loading article..."}
              </p>
            </div>
          ) : error ? (
            <div className="bg-white border border-slate-200 rounded-xl p-12 shadow-[0_10px_35px_rgba(15,23,42,0.05)] text-center space-y-4">
              <p className="text-red-500 text-sm font-bold">{error}</p>
              <Button variant="ghost"
                onClick={backToArticle}
                className="px-5 py-2 bg-kaist-darkgreen text-white font-bold rounded-lg text-xs border-0 cursor-pointer shadow-sm hover:opacity-90 transition-all"
              >
                {lang === "ko" ? "게시글로 돌아가기" : "Back to Article"}
              </Button>
            </div>
          ) : (
            <>
              {/* Hidden file input for editor uploads */}
              <UiInput
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={(event) => void handleUploadFiles(event.target.files)}
              />

              {showDraftRestoredBanner ? (
                <DraftRestoredBanner
                  savedAt={draftRestoredAt ?? undefined}
                  onStartNew={handleStartNewDraft}
                  onDismiss={() => setDismissedDraftAt(draftRestoredAt)}
                />
              ) : null}

              {/* Unified Editor Card Container */}
              <DataViewCard>
                <BoardEditHeaderControls
                  category={category}
                  isKoreanOnly={isKoreanOnly}
                  lang={lang}
                  onKoreanOnlyChange={(checked) => {
                    setIsKoreanOnly(checked);
                  }}
                />

                <div className="min-h-[450px] space-y-6">
                  <BoardWriteEditorFields
                    contentEn={contentEn}
                    contentKo={contentKo}
                    isKoreanOnly={isKoreanOnly}
                    lang={lang}
                    onContentEnChange={setContentEn}
                    onContentKoChange={setContentKo}
                    onTitleEnChange={setTitleEn}
                    onTitleKoChange={setTitleKo}
                    titleEn={titleEn}
                    titleKo={titleKo}
                    fileInputRef={fileInputRef}
                    uploading={uploading}
                  />

                  <div className="space-y-6 px-6 pb-6 md:px-8">
                    {category === "행사" && (
                      <BoardWriteEventFields
                        eventDescriptionKo={eventDescriptionKo}
                        eventDescriptionEn={eventDescriptionEn}
                        eventEndDate={eventEndDate}
                        eventStartDate={eventStartDate}
                        isEventAlwaysOpen={isEventAlwaysOpen}
                        isKoreanOnly={isKoreanOnly}
                        lang={lang}
                        onEventAlwaysOpenChange={(checked) => {
                          setIsEventAlwaysOpen(checked);
                          if (checked) {
                            setEventStartDate("");
                            setEventEndDate("");
                          }
                        }}
                        onEventDescriptionKoChange={setEventDescriptionKo}
                        onEventDescriptionEnChange={setEventDescriptionEn}
                        onEventEndDateChange={setEventEndDate}
                        onEventStartDateChange={setEventStartDate}
                      />
                    )}

                    <BoardWriteAttachmentList
                      assets={assets}
                      lang={lang}
                      onRemoveAsset={(assetId) =>
                        setAssets((prev) =>
                          prev.filter((item) => item.assetId !== assetId),
                        )
                      }
                      uploading={uploading}
                    />
                  </div>
                </div>
              </DataViewCard>

              <BoardWriteSettings
                allowComment={allowComment}
                canConfigurePostSettings={canConfigurePostSettings}
                lang={lang}
                onAllowCommentChange={setAllowComment}
                onSelectedSurveyIdChange={setSelectedSurveyId}
                selectedSurveyId={selectedSurveyId}
                surveys={surveys}
                isAnonymous={isAnonymous}
                isPinned={isPinned}
                isSecret={isSecret}
                allowSecret={allowSecret}
                onAnonymousChange={setIsAnonymous}
                onPinnedChange={setIsPinned}
                onSecretChange={setIsSecret}
                anonymousLabel={
                  lang === "ko" ? "익명으로 수정" : "Edit Anonymously"
                }
                pinnedLabel={
                  lang === "ko" ? "게시글 상단 고정" : "Pin to Top"
                }
              />

            </>
          )}
        </PageContainer>
      </PageMain>

    </PageShell>
  );
}
