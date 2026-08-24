import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";

import { Header } from "@/components/organisms/header";
import { DataViewCard, PageContainer, PageHeader, PageMain, PageShell } from "@/components/ui/page-layout";
import {
  getBoardLabelFromMetadata,
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
import {
  switchEventDateInputMode,
  switchEventEndDateInputMode,
} from "@/features/board-write/event-date-utils";

export function BoardWritePage({ forcedCategory }: { forcedCategory?: string } = {}) {
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
    handleUploadThumbnail,
    handleUploadFiles,
    isAnonymous,
    isAllDay,
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
    setIsAllDay,
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
  } = useBoardWritePageController(forcedCategory);
  const [dismissedDraftAt, setDismissedDraftAt] = useState<string | null>(null);
  const showDraftRestoredBanner = Boolean(draftRestoredAt && draftRestoredAt !== dismissedDraftAt);
  const boardLabel = selectedCategory === "_EVENT" ? (lang === "ko" ? "행사" : "Events") : getBoardLabelFromMetadata(selectedBoard, selectedCategory, lang);
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
    isAllDay,
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
    setIsAllDay(Boolean(template.isAllDay));
    setIsEventAlwaysOpen(template.isEventAlwaysOpen);
    setEventStartDate(
      switchEventDateInputMode(template.eventStartDate, Boolean(template.isAllDay)),
    );
    setEventEndDate(
      switchEventEndDateInputMode(template.eventEndDate, Boolean(template.isAllDay)),
    );
    setEventDescriptionKo(template.eventDescriptionKo);
    setEventDescriptionEn(template.eventDescriptionEn);
    setSelectedSurveyId(template.selectedSurveyId);
    setAssets(template.assets.map((asset) => ({ ...asset })));
  };

  const isEvent = selectedCategory === "_EVENT";
  const boardHref = isEvent
    ? "/events"
    : selectedCategory
      ? `/board/${selectedCategory}`
      : "/board";
  const eventFields = isEvent ? (
    <BoardWriteEventFields
      eventDescriptionKo={eventDescriptionKo}
      eventDescriptionEn={eventDescriptionEn}
      eventEndDate={eventEndDate}
      eventStartDate={eventStartDate}
      isAllDay={isAllDay}
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
      onThumbnailRemove={() =>
        setAssets((current) =>
          current.filter((item) => item.usageType !== "THUMBNAIL"),
        )
      }
      onThumbnailSelect={handleUploadThumbnail}
      thumbnail={assets.find((asset) => asset.usageType === "THUMBNAIL")}
      uploading={uploading}
      onAllDayChange={(checked) => {
        setIsAllDay(checked);
        setEventStartDate(switchEventDateInputMode(eventStartDate, checked));
        setEventEndDate(switchEventEndDateInputMode(eventEndDate, checked));
      }}
    />
  ) : null;
  const postSettings = (
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
      stacked={isEvent}
    />
  );
  const editorCard = (includeSettings: boolean) => (
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

      <div className="min-h-[450px]">
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
      </div>

      <div className="space-y-6 px-6 pb-6 pt-6 md:px-8">
        <BoardWriteAttachmentList
          assets={assets}
          lang={lang}
          onRemoveAsset={(assetId) =>
            setAssets((prev) => prev.filter((item) => item.assetId !== assetId))
          }
          uploading={uploading}
        />
      </div>

      {includeSettings ? postSettings : null}
    </DataViewCard>
  );

  return (
    <PageShell className="text-slate-950">
      {ConfirmDialog}
      <Header />

      <PageHeader
        className="board-write-page-header"
        title={
          <Link
            to={boardHref}
            className="inline-flex min-w-0 items-center gap-2 text-inherit transition-colors hover:text-brand-primary"
          >
            <ArrowLeft aria-hidden="true" className="size-5 shrink-0" />
            <span className="truncate">{boardLabel}</span>
          </Link>
        }
        actions={
          <div className="flex items-center justify-end gap-2">
            <BoardWriteFooter
              compact
              lang={lang}
              isSubmitting={isSubmitting}
              canWriteSelected={canWriteSelected}
              leadingActions={canManageTemplates ? (
                <ArticleTemplateControl
                  boardCode={selectedCategory}
                  lang={lang}
                  onApply={applyTemplate}
                  snapshot={templateSnapshot}
                />
              ) : null}
              onCancel={() => navigate(-1)}
              onSubmit={handleSubmit}
            />
          </div>
        }
      />

      <PageMain className="pb-20">
        <PageContainer className="flex flex-col gap-4 pb-16 pt-4">
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

          {isEvent ? (
            <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
              {editorCard(false)}
              <DataViewCard className="min-w-0">
                {eventFields}
                {postSettings}
              </DataViewCard>
            </div>
          ) : (
            editorCard(true)
          )}

        </PageContainer>
      </PageMain>

    </PageShell>
  );
}
