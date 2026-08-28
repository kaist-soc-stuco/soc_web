import { ArrowLeft, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";

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
import {
  switchEventDateInputMode,
  switchEventEndDateInputMode,
} from "@/features/board-write/event-date-utils";

export function BoardEditPage({ forcedCategory }: { forcedCategory?: string } = {}) {
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
    error,
    eventDescriptionKo,
    eventDescriptionEn,
    eventEndDate,
    eventStartDate,
    fileInputRef,
    handleSubmit,
    handleUploadThumbnail,
    handleUploadFiles,
    handleUploadInlineImage,
    isAnonymous,
    isAllDay,
    isEventAlwaysOpen,
    isKoreanOnly,
    isPinned,
    homeVisible,
    homeOrder,
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
    setIsAllDay,
    setIsEventAlwaysOpen,
    setIsKoreanOnly,
    setIsPinned,
    setHomeVisible,
    setHomeOrder,
    setIsSecret,
    setSelectedSurveyId,
    setTitleEn,
    setTitleKo,
    surveys,
    titleEn,
    titleKo,
    uploading,
  } = useBoardEditPageController(forcedCategory);
  const categoryLabel = category === "_EVENT" ? (lang === "ko" ? "행사" : "Events") : getBoardLabelFromMetadata(undefined, category, lang);
  const boardHref = category === "_EVENT"
    ? "/events"
    : category
      ? `/board/${category}`
      : "/board";
  const templateSnapshot: BoardTemplateSnapshot = {
    boardCode: category,
    titleKo,
    titleEn,
    contentKo,
    contentEn,
    isAnonymous,
    isPinned,
    homeVisible,
    homeOrder,
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
    if (template.homeVisible !== undefined) setHomeVisible(template.homeVisible);
    if (template.homeOrder !== undefined) setHomeOrder(template.homeOrder);
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

  const isEvent = category === "_EVENT";
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
      boardCode={category}
      isEvent={isEvent}
      isPinned={isPinned}
      homeVisible={homeVisible}
      isSecret={isSecret}
      allowSecret={allowSecret}
      onAnonymousChange={setIsAnonymous}
      onPinnedChange={setIsPinned}
      onHomeVisibleChange={setHomeVisible}
      onSecretChange={setIsSecret}
      anonymousLabel={lang === "ko" ? "익명으로 작성" : "Write Anonymously"}
      pinnedLabel={
        isEvent
          ? lang === "ko"
            ? "홈 행사 우선 노출"
            : "Prioritize on home"
          : lang === "ko"
            ? "게시글 상단 고정"
            : "Pin to Top"
      }
      stacked={isEvent}
    />
  );
  const editorCard = (includeSettings: boolean) => (
    <DataViewCard>
      <BoardEditHeaderControls
        category={category}
        isKoreanOnly={isKoreanOnly}
        lang={lang}
        onKoreanOnlyChange={(checked) => {
          setIsKoreanOnly(checked);
        }}
      />

      <div className="min-h-[450px]">
        <BoardWriteEditorFields
          contentEn={contentEn}
          contentKo={contentKo}
          isKoreanOnly={isKoreanOnly}
          lang={lang}
          onContentEnChange={setContentEn}
          onContentKoChange={setContentKo}
          onImageUpload={handleUploadInlineImage}
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
            <span className="truncate">{categoryLabel}</span>
          </Link>
        }
        actions={
          <div className="flex items-center justify-end gap-2">
            <BoardWriteFooter
              compact
              lang={lang}
              isSubmitting={isSubmitting}
              leadingActions={canManageTemplates ? (
                <ArticleTemplateControl
                  boardCode={category}
                  lang={lang}
                  onApply={applyTemplate}
                  snapshot={templateSnapshot}
                />
              ) : null}
              onCancel={backToArticle}
              onSubmit={handleSubmit}
              submitLabel={lang === "ko" ? "수정" : "Save"}
              submittingLabel={lang === "ko" ? "저장 중..." : "Saving..."}
            />
          </div>
        }
      />

      <PageMain className="pb-20">
        <PageContainer className="flex flex-col gap-4 pb-16 pt-4">
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

            </>
          )}
        </PageContainer>
      </PageMain>

    </PageShell>
  );
}
