import { ArrowLeft, Loader2 } from "lucide-react";

import { Header } from "@/components/organisms/header";
import { Footer } from "@/components/organisms/footer";
import { PageHero } from "@/components/organisms/page-hero";
import {
  BoardEditHeaderControls,
  BoardWriteAttachmentList,
  BoardWriteEditorFields,
  BoardWriteEventFields,
  BoardWriteSettings,
  BoardWriteFooter,
} from "@/features/board-write/board-write-form-sections";
import { useBoardEditPageController } from "@/features/board-write/use-board-edit-page-controller";

export function BoardEditPage() {
  const {
    ConfirmDialog,
    activeTab,
    articleId,
    assets,
    allowComment,
    backToArticle,
    canConfigurePostSettings,
    category,
    contentEn,
    contentKo,
    error,
    eventDescription,
    eventEndDate,
    eventStartDate,
    fileInputRef,
    handleSubmit,
    handleUploadFiles,
    isAnonymous,
    isEventAlwaysOpen,
    isKoreanOnly,
    isPinned,
    isSubmitting,
    lang,
    loading,
    selectedSurveyId,
    setAllowComment,
    setActiveTab,
    setAssets,
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
  } = useBoardEditPageController();

  return (
    <div className="min-h-screen bg-[#fafafa] flex flex-col text-slate-950">
      {ConfirmDialog}
      <Header showLogo />

      <PageHero
        title={
          lang === "ko"
            ? `${category} - 글 수정하기`
            : `${category} - Edit Post`
        }
        description={
          lang === "ko"
            ? "기존 게시글의 내용을 변경하고 다듬습니다."
            : "Modify and refine the content of the article."
        }
      />

      <main className="flex-1 w-full mx-auto pb-20">
        <div className="mx-auto max-w-[1040px] px-6 lg:px-8 pt-4 pb-16 flex flex-col gap-4 w-full">
          <div className="flex items-center select-none mb-1">
            <button
              onClick={backToArticle}
              className="flex items-center gap-1.5 text-slate-400 hover:text-slate-600 text-xs font-bold border-0 bg-transparent cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>{lang === "ko" ? "돌아가기" : "Back to post"}</span>
            </button>
          </div>

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
              <button
                onClick={backToArticle}
                className="px-5 py-2 bg-kaist-darkgreen text-white font-bold rounded-lg text-xs border-0 cursor-pointer shadow-sm hover:opacity-90 transition-all"
              >
                {lang === "ko" ? "게시글로 돌아가기" : "Back to Article"}
              </button>
            </div>
          ) : (
            <>
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
                <BoardEditHeaderControls
                  activeTab={activeTab}
                  category={category}
                  isKoreanOnly={isKoreanOnly}
                  lang={lang}
                  onActiveTabChange={setActiveTab}
                  onKoreanOnlyChange={(checked) => {
                    setIsKoreanOnly(checked);
                    if (checked) setActiveTab("ko");
                  }}
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

                  {category === "행사" && (
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
                anonymousLabel={
                  lang === "ko" ? "익명으로 수정" : "Edit Anonymously"
                }
                pinnedLabel={
                  lang === "ko" ? "게시글 상단 고정" : "Pin to Top"
                }
              />

              <BoardWriteFooter
                lang={lang}
                isSubmitting={isSubmitting}
                onCancel={backToArticle}
                onSubmit={handleSubmit}
                submitLabel={lang === "ko" ? "수정 완료" : "Save Changes"}
                submittingLabel={lang === "ko" ? "저장 중..." : "Saving..."}
              />
            </>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
