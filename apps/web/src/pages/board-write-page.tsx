import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { Header } from "@/components/organisms/header";
import { DataViewCard, PageContainer, PageHeader, PageMain, PageShell } from "@/components/ui/page-layout";
import {
  getBoardLabelFromMetadata,
  getBoardTitleFromMetadata,
} from "@/lib/board-metadata";
import {
  BoardWriteAttachmentList,
  BoardWriteEditorFields,
  BoardWriteEventFields,
  BoardWriteHeaderControls,
  BoardWriteSettings,
  BoardWriteFooter,
} from "@/features/board-write/board-write-form-sections";
import {
  ArticleTemplateControl,
  type BoardTemplateSnapshot,
} from "@/features/board-write/article-template-control";
import { useBoardWritePageController } from "@/features/board-write/use-board-write-page-controller";
import { UiInput } from "@/components/ui/form-control";
import { DraftRestoredBanner } from "@/components/ui/draft-restored-banner";

export function BoardWritePage() {
  const navigate = useNavigate();
  const {
    ConfirmDialog,
    assets,
    allowComment,
    boardByCode,
    canConfigurePostSettings,
    canManageTemplates,
    canWriteSelected,
    contentEn,
    contentKo,
    draftRestoredAt,
    eventDescriptionKo,
    eventDescriptionEn,
    eventEndDate,
    eventStartDate,
    fileInputRef,
    handleCategoryChange,
    handleStartNewDraft,
    handleSubmit,
    handleUploadFiles,
    isAnonymous,
    isEventAlwaysOpen,
    isKoreanOnly,
    isPinned,
    isSecret,
    isSubmitting,
    lang,
    selectedBoard,
    selectedCategory,
    selectedSurveyId,
    setAssets,
    setAllowComment,
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
    writableBoardCodes,
  } = useBoardWritePageController();
  const [dismissedDraftAt, setDismissedDraftAt] = useState<string | null>(null);
  const showDraftRestoredBanner = Boolean(draftRestoredAt && draftRestoredAt !== dismissedDraftAt);
  const templateSnapshot: BoardTemplateSnapshot = {
    boardCode: selectedCategory,
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
            ? `${getBoardTitleFromMetadata(
                selectedBoard,
                selectedCategory,
                lang,
              )} 글 작성`
            : `${getBoardLabelFromMetadata(
                selectedBoard,
                selectedCategory,
                lang,
              )} - Write Post`
        }
        breadcrumbs={[
          { label: lang === "ko" ? "게시판" : "Board", to: "/board" },
          {
            label: getBoardLabelFromMetadata(
              selectedBoard,
              selectedCategory,
              lang,
            ),
          },
        ]}
        actions={
          <div className="flex items-center justify-end gap-2">
            {canManageTemplates ? (
              <ArticleTemplateControl
                boardCode={selectedCategory}
                boardLabel={getBoardLabelFromMetadata(selectedBoard, selectedCategory, lang)}
                lang={lang}
                onApply={applyTemplate}
                snapshot={templateSnapshot}
              />
            ) : null}
            <BoardWriteFooter
              compact
              lang={lang}
              isSubmitting={isSubmitting}
              canWriteSelected={canWriteSelected}
              onCancel={() => navigate(-1)}
              onSubmit={handleSubmit}
            />
          </div>
        }
      />

      <PageMain className="pb-20">
        <PageContainer className="flex max-w-none flex-col gap-4 pb-16 pt-4">
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
            <BoardWriteHeaderControls
              boardByCode={boardByCode}
              isKoreanOnly={isKoreanOnly}
              lang={lang}
              onCategoryChange={handleCategoryChange}
              onKoreanOnlyChange={(checked) => {
                setIsKoreanOnly(checked);
              }}
              selectedCategory={selectedCategory}
              writableBoardCodes={writableBoardCodes}
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
                {selectedCategory === "행사" && (
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
            allowSecret={selectedBoard?.allowSecret ?? false}
            onAnonymousChange={setIsAnonymous}
            onPinnedChange={setIsPinned}
            onSecretChange={setIsSecret}
          />

        </PageContainer>
      </PageMain>

    </PageShell>
  );
}
