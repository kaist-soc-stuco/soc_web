import { useNavigate } from "react-router-dom";

import { Header } from "@/components/organisms/header";
import { Footer } from "@/components/organisms/footer";
import { PageHero } from "@/components/organisms/page-hero";
import {
  getBoardLabelFromMetadata,
  getBoardTitleFromMetadata,
} from "@/lib/board-metadata";
import {
  BoardWriteAttachmentList,
  BoardWriteDraftBanner,
  BoardWriteEditorFields,
  BoardWriteEventFields,
  BoardWriteHeaderControls,
  BoardWriteSettings,
  BoardWriteFooter,
} from "@/features/board-write/board-write-form-sections";
import { useBoardWritePageController } from "@/features/board-write/use-board-write-page-controller";

export function BoardWritePage() {
  const navigate = useNavigate();
  const {
    ConfirmDialog,
    activeTab,
    assets,
    allowComment,
    boardByCode,
    canConfigurePostSettings,
    canWriteSelected,
    contentEn,
    contentKo,
    draftTime,
    eventDescription,
    eventEndDate,
    eventStartDate,
    fileInputRef,
    handleCategoryChange,
    handleDiscardDraft,
    handleRestoreDraft,
    handleSaveDraft,
    handleSubmit,
    handleUploadFiles,
    hasDraft,
    isAnonymous,
    isEventAlwaysOpen,
    isKoreanOnly,
    isPinned,
    isSubmitting,
    lang,
    selectedBoard,
    selectedCategory,
    selectedSurveyId,
    setActiveTab,
    setAssets,
    setAllowComment,
    setContentEn,
    setContentKo,
    setEventDescription,
    setEventEndDate,
    setEventStartDate,
    setIsAnonymous,
    setIsEventAlwaysOpen,
    setIsKoreanOnly,
    setIsPinned,
    setSelectedSurveyId,
    setTitleEn,
    setTitleKo,
    surveys,
    titleEn,
    titleKo,
    uploading,
    writableBoardCodes,
  } = useBoardWritePageController();

  return (
    <div className="min-h-screen bg-[#fafafa] flex flex-col text-slate-950">
      {ConfirmDialog}
      <Header showLogo />

      <PageHero
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
        description={
          lang === "ko"
            ? "새로운 소식을 국문과 영문으로 공유해보세요."
            : "Share news in Korean and English."
        }
      />

      <main className="flex-1 w-full mx-auto pb-20">
        <div className="mx-auto max-w-[1040px] px-6 lg:px-8 pt-4 pb-16 flex flex-col gap-4 w-full">
          {hasDraft && (
            <BoardWriteDraftBanner
              draftTime={draftTime}
              lang={lang}
              onDiscard={() => void handleDiscardDraft()}
              onRestore={handleRestoreDraft}
            />
          )}

          {/* Hidden file input for editor uploads */}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(event) => void handleUploadFiles(event.target.files)}
          />

          {/* Unified Editor Card Container */}
          <div className="rounded-xl border border-slate-200 bg-white shadow-[0_10px_35px_rgba(15,23,42,0.05)]">
            <BoardWriteHeaderControls
              activeTab={activeTab}
              boardByCode={boardByCode}
              isKoreanOnly={isKoreanOnly}
              lang={lang}
              onActiveTabChange={setActiveTab}
              onCategoryChange={handleCategoryChange}
              onKoreanOnlyChange={(checked) => {
                setIsKoreanOnly(checked);
                if (checked) setActiveTab("ko");
              }}
              selectedCategory={selectedCategory}
              writableBoardCodes={writableBoardCodes}
            />

            <div className="p-6 md:p-8 space-y-6 min-h-[450px]">
              <BoardWriteEditorFields
                activeTab={activeTab}
                contentEn={contentEn}
                contentKo={contentKo}
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

              {selectedCategory === "행사" && (
                <BoardWriteEventFields
                  eventDescription={eventDescription}
                  eventEndDate={eventEndDate}
                  eventStartDate={eventStartDate}
                  isEventAlwaysOpen={isEventAlwaysOpen}
                  lang={lang}
                  onEventAlwaysOpenChange={(checked) => {
                    setIsEventAlwaysOpen(checked);
                    if (checked) {
                      setEventStartDate("");
                      setEventEndDate("");
                    }
                  }}
                  onEventDescriptionChange={setEventDescription}
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
            onAnonymousChange={setIsAnonymous}
            onPinnedChange={setIsPinned}
          />

          <BoardWriteFooter
            lang={lang}
            isSubmitting={isSubmitting}
            canWriteSelected={canWriteSelected}
            onCancel={() => navigate(-1)}
            onSaveDraft={() => handleSaveDraft(false)}
            onSubmit={handleSubmit}
          />
        </div>
      </main>

      <Footer />
    </div>
  );
}
