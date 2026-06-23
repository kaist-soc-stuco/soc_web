import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { createApiClient } from "@soc/api-client";
import type { SurveyRecord } from "@soc/contracts";
import { htmlDatetimeLocalToIso, isoToHtmlDatetimeLocal } from "@soc/shared";

import { useConfirmDialog } from "@/components/ui/confirm-dialog";
import { useLanguage } from "@/hooks/use-language";
import { resolveApiBaseUrl } from "@/lib/api-base-url";

import type { AttachedAsset } from "./board-write-form-sections";

const PUBLIC_WRITE_BOARD_CODES = new Set(["건의사항", "QnA"]);

export function useBoardEditPageController() {
  const { category = "공지", articleId } = useParams<{
    category: string;
    articleId: string;
  }>();
  const navigate = useNavigate();
  const { lang } = useLanguage();
  const { confirm: requestConfirm, ConfirmDialog } = useConfirmDialog();

  const apiClient = useMemo(
    () => createApiClient({ baseUrl: resolveApiBaseUrl() }),
    [],
  );

  const [activeTab, setActiveTab] = useState<"ko" | "en">("ko");
  const [titleKo, setTitleKo] = useState("");
  const [titleEn, setTitleEn] = useState("");
  const [contentKo, setContentKo] = useState("");
  const [contentEn, setContentEn] = useState("");
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [isPinned, setIsPinned] = useState(false);
  const [allowComment, setAllowComment] = useState(true);
  const [isKoreanOnly, setIsKoreanOnly] = useState(false);
  const [assets, setAssets] = useState<AttachedAsset[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [eventStartDate, setEventStartDate] = useState("");
  const [eventEndDate, setEventEndDate] = useState("");
  const [eventDescription, setEventDescription] = useState("");
  const [isEventAlwaysOpen, setIsEventAlwaysOpen] = useState(false);
  const [surveys, setSurveys] = useState<SurveyRecord[]>([]);
  const [selectedSurveyId, setSelectedSurveyId] = useState("");
  const [initialSurveyId, setInitialSurveyId] = useState("");

  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canConfigurePostSettings = !PUBLIC_WRITE_BOARD_CODES.has(category);

  const backToArticle = () => {
    navigate(`/board/${category}/${articleId}`);
  };

  useEffect(() => {
    if (!articleId) return;

    setLoading(true);
    apiClient
      .getArticle(category, articleId)
      .then((res) => {
        setTitleKo(res.titleKo);
        setTitleEn(res.titleEn || "");
        setContentKo(res.contentKo);
        setContentEn(res.contentEn || "");
        setIsAnonymous(res.isAnonymous);
        setIsPinned(res.isPinned);
        setAllowComment(res.allowComment);
        setIsKoreanOnly(res.visibilityScope === "MEMBERS");
        setIsEventAlwaysOpen(
          category === "행사" &&
            !res.eventStartDate &&
            !res.eventEndDate &&
            Boolean(res.eventDescription),
        );
        setEventStartDate(
          res.eventStartDate ? isoToHtmlDatetimeLocal(res.eventStartDate) : "",
        );
        setEventEndDate(
          res.eventEndDate ? isoToHtmlDatetimeLocal(res.eventEndDate) : "",
        );
        setEventDescription(res.eventDescription || "");
        setSelectedSurveyId(res.survey?.surveyId ?? "");
        setInitialSurveyId(res.survey?.surveyId ?? "");
        setAssets(
          res.assets.map((asset) => ({
            assetId: asset.assetId,
            mimeType: asset.mimeType,
            originalFilename: asset.originalFilename,
            sizeBytes: asset.sizeBytes,
            storageKey: asset.storageKey,
            usageType: asset.usageType,
          })),
        );
        setError(null);
      })
      .catch(() => {
        setError(
          lang === "ko"
            ? "게시글 정보를 불러오는 데 실패했습니다."
            : "Failed to load the article details.",
        );
      })
      .finally(() => {
        setLoading(false);
      });
  }, [category, articleId, apiClient, lang]);

  useEffect(() => {
    if (!canConfigurePostSettings) return;

    apiClient
      .listSurveys()
      .then(setSurveys)
      .catch(() => setSurveys([]));
  }, [apiClient, canConfigurePostSettings]);

  useEffect(() => {
    if (canConfigurePostSettings) return;

    setIsAnonymous(false);
    setIsPinned(false);
    setSelectedSurveyId("");
  }, [canConfigurePostSettings]);

  const handleUploadFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    setUploading(true);
    try {
      const uploaded = await Promise.all(
        Array.from(files).map(async (file) => {
          const asset = await apiClient.uploadAsset(file);
          return {
            assetId: asset.assetId,
            mimeType: asset.mimeType,
            originalFilename: asset.originalFilename,
            sizeBytes: asset.sizeBytes,
            storageKey: asset.storageKey,
            usageType: asset.mimeType.startsWith("image/")
              ? "IMAGE"
              : "ATTACHMENT",
          } satisfies AttachedAsset;
        }),
      );
      setAssets((prev) => [...prev, ...uploaded]);
    } catch (err) {
      console.error(err);
      alert(
        lang === "ko"
          ? "파일 업로드에 실패했습니다."
          : "Failed to upload files.",
      );
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleSubmit = async () => {
    if (!articleId) return;

    if (!titleKo.trim() || !contentKo.trim()) {
      alert(
        lang === "ko"
          ? "국문 제목과 내용은 필수입니다."
          : "Korean title and content are required.",
      );
      setActiveTab("ko");
      return;
    }

    if (!isKoreanOnly && (!titleEn.trim() || !contentEn.trim())) {
      alert(
        lang === "ko"
          ? "영문 제목과 내용을 입력하거나, 'Korean Speakers Only'를 체크해주세요."
          : "Please enter English title and content, or check 'Korean Speakers Only'.",
      );
      setActiveTab("en");
      return;
    }

    if (category === "행사") {
      if (
        !eventDescription.trim() ||
        (!isEventAlwaysOpen && (!eventStartDate || !eventEndDate))
      ) {
        alert(
          lang === "ko"
            ? "행사 일정 또는 상시 여부, 그리고 간단한 설명은 필수입니다."
            : "Event schedule or always-open status, plus card description, is required.",
        );
        return;
      }
    }

    try {
      setIsSubmitting(true);
      await apiClient.updateArticle(category, articleId, {
        titleKo,
        titleEn: titleEn || undefined,
        contentKo,
        contentEn: contentEn || undefined,
        visibilityScope: isKoreanOnly ? "MEMBERS" : "PUBLIC",
        isAnonymous: canConfigurePostSettings ? isAnonymous : false,
        isPinned: canConfigurePostSettings ? isPinned : false,
        allowComment,
        assets: assets.map((asset, index) => ({
          assetId: asset.assetId,
          usageType: asset.usageType,
          sortOrder: index,
        })),
        eventStartDate:
          category === "행사"
            ? isEventAlwaysOpen
              ? null
              : htmlDatetimeLocalToIso(eventStartDate)
            : undefined,
        eventEndDate:
          category === "행사"
            ? isEventAlwaysOpen
              ? null
              : htmlDatetimeLocalToIso(eventEndDate)
            : undefined,
        eventDescription:
          category === "행사" ? eventDescription.trim() : undefined,
      });
      if (canConfigurePostSettings && selectedSurveyId) {
        let overwriteSchedule = false;
        let overwriteAlwaysOpen = false;
        if (category === "행사" && isEventAlwaysOpen) {
          overwriteAlwaysOpen = await requestConfirm({
            confirmLabel: lang === "ko" ? "상시로 설정" : "Set always open",
            description:
              lang === "ko"
                ? "선택한 설문조사의 시작/마감 시각을 비우고 상시 진행으로 설정할까요?"
                : "Set the linked survey as always open and clear its schedule?",
            title:
              lang === "ko"
                ? "설문 일정도 상시로 맞출까요?"
                : "Set linked survey always open?",
          });
        } else if (category === "행사" && eventStartDate && eventEndDate) {
          overwriteSchedule = await requestConfirm({
            confirmLabel: lang === "ko" ? "덮어쓰기" : "Overwrite",
            description:
              lang === "ko"
                ? "선택한 설문조사의 시작/마감 시각을 행사 일정과 동일하게 맞출까요?"
                : "Use this event schedule as the linked survey schedule?",
            title:
              lang === "ko"
                ? "설문 일정도 행사 일정으로 덮어쓸까요?"
                : "Overwrite survey schedule?",
          });
        }

        await apiClient.updateSurvey(selectedSurveyId, {
          connectedArticleId: articleId,
          kind: category === "행사" ? "EVENT" : undefined,
          isAlwaysOpen: overwriteAlwaysOpen
            ? true
            : overwriteSchedule
              ? false
              : undefined,
          openAt: overwriteAlwaysOpen
            ? null
            : overwriteSchedule
              ? htmlDatetimeLocalToIso(eventStartDate)
              : undefined,
          closeAt: overwriteAlwaysOpen
            ? null
            : overwriteSchedule
              ? htmlDatetimeLocalToIso(eventEndDate)
              : undefined,
        });
      }
      if (
        canConfigurePostSettings &&
        initialSurveyId &&
        initialSurveyId !== selectedSurveyId
      ) {
        await apiClient.updateSurvey(initialSurveyId, {
          connectedArticleId: null,
        });
      }
      alert(
        lang === "ko"
          ? "게시글이 수정되었습니다."
          : "Article updated successfully.",
      );
      backToArticle();
    } catch (err) {
      console.error(err);
      alert(
        lang === "ko"
          ? "게시글 수정에 실패했습니다."
          : "Failed to update article.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
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
  };
}
