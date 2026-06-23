import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { createApiClient } from "@soc/api-client";
import type { SurveyRecord } from "@soc/contracts";
import {
  hasPermission,
  htmlDatetimeLocalToIso,
  nowMs,
} from "@soc/shared";

import { useConfirmDialog } from "@/components/ui/confirm-dialog";
import { useBoardCatalog } from "@/hooks/use-board-catalog";
import { useCurrentSession } from "@/hooks/use-current-session";
import { useLanguage } from "@/hooks/use-language";
import {
  getBoardWritePermissionBitFromMetadata,
} from "@/lib/board-metadata";
import { resolveApiBaseUrl } from "@/lib/api-base-url";
import { hasPersistedProfile } from "@/lib/require-persisted-profile";

import type { AttachedAsset } from "./board-write-form-sections";

type BoardWriteLocationState = {
  initialCategory?: string;
};

const PUBLIC_WRITE_BOARD_CODES = new Set(["건의사항", "QnA"]);

export function useBoardWritePageController() {
  const location = useLocation();
  const navigate = useNavigate();
  const { lang } = useLanguage();
  const { data: session } = useCurrentSession();
  const { confirm: requestConfirm, ConfirmDialog } = useConfirmDialog();
  const routeInitialCategory = (
    location.state as BoardWriteLocationState | null
  )?.initialCategory;
  const [selectedCategory, setSelectedCategory] = useState<string>(
    routeInitialCategory ?? "공지",
  );

  const [activeTab, setActiveTab] = useState<"ko" | "en">("ko");
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [isPinned, setIsPinned] = useState(false);
  const [allowComment, setAllowComment] = useState(true);
  const [isKoreanOnly, setIsKoreanOnly] = useState(false);
  const [titleKo, setTitleKo] = useState("");
  const [titleEn, setTitleEn] = useState("");
  const [contentKo, setContentKo] = useState("");
  const [contentEn, setContentEn] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [assets, setAssets] = useState<AttachedAsset[]>([]);
  const [uploading, setUploading] = useState(false);
  const [eventStartDate, setEventStartDate] = useState("");
  const [eventEndDate, setEventEndDate] = useState("");
  const [eventDescription, setEventDescription] = useState("");
  const [isEventAlwaysOpen, setIsEventAlwaysOpen] = useState(false);
  const [surveys, setSurveys] = useState<SurveyRecord[]>([]);
  const [selectedSurveyId, setSelectedSurveyId] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [hasDraft, setHasDraft] = useState(false);
  const [draftTime, setDraftTime] = useState<number>(0);

  const apiClient = useMemo(
    () => createApiClient({ baseUrl: resolveApiBaseUrl() }),
    [],
  );
  const {
    boards,
    boardByCode,
    source: boardCatalogSource,
  } = useBoardCatalog(apiClient);
  const userPermission = session?.permission ?? 0;
  const canUseWriteFeatures = hasPersistedProfile(session ?? null);
  const writableBoardCodes = useMemo(() => {
    if (!canUseWriteFeatures) return [];
    if (boardCatalogSource !== "server") return [];

    return boards
      .filter((board) => {
        const requiredPermission = getBoardWritePermissionBitFromMetadata(
          board,
          board.code,
        );
        return (
          requiredPermission === 0 ||
          hasPermission(userPermission, requiredPermission)
        );
      })
      .map((board) => board.code);
  }, [boardCatalogSource, boards, canUseWriteFeatures, userPermission]);
  const canWriteSelected =
    canUseWriteFeatures && writableBoardCodes.includes(selectedCategory);
  const canConfigurePostSettings =
    !PUBLIC_WRITE_BOARD_CODES.has(selectedCategory);

  useEffect(() => {
    if (!canUseWriteFeatures || writableBoardCodes.length === 0) return;
    if (writableBoardCodes.includes(selectedCategory)) return;

    const preferredCategory =
      routeInitialCategory && writableBoardCodes.includes(routeInitialCategory)
        ? routeInitialCategory
        : writableBoardCodes[0];

    if (preferredCategory && selectedCategory !== preferredCategory) {
      setSelectedCategory(preferredCategory);
    }
  }, [
    routeInitialCategory,
    selectedCategory,
    canUseWriteFeatures,
    writableBoardCodes,
  ]);

  const selectedBoard = boardByCode.get(selectedCategory);

  useEffect(() => {
    if (canConfigurePostSettings) return;

    setIsAnonymous(false);
    setIsPinned(false);
    setSelectedSurveyId("");
  }, [canConfigurePostSettings]);

  useEffect(() => {
    if (selectedBoard?.allowComment === false) {
      setAllowComment(false);
      return;
    }

    setAllowComment(true);
  }, [selectedBoard?.allowComment]);

  useEffect(() => {
    if (!canUseWriteFeatures || !canConfigurePostSettings) return;
    apiClient
      .listSurveys()
      .then(setSurveys)
      .catch(() => setSurveys([]));
  }, [apiClient, canConfigurePostSettings, canUseWriteFeatures]);

  const handleCategoryChange = (nextCategory: string) => {
    setSelectedCategory(nextCategory);
  };

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

  useEffect(() => {
    const key = `draft_${selectedCategory}`;
    const raw = localStorage.getItem(key);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (
          parsed.titleKo ||
          parsed.contentKo ||
          parsed.titleEn ||
          parsed.contentEn
        ) {
          setHasDraft(true);
          setDraftTime(parsed.updatedAt || 0);
        }
      } catch (error) {
        console.error(error);
      }
    } else {
      setHasDraft(false);
    }
  }, [selectedCategory]);

  const handleSaveDraft = (silent = false) => {
    const key = `draft_${selectedCategory}`;
    const data = {
      titleKo,
      titleEn,
      contentKo,
      contentEn,
      isAnonymous,
      isPinned,
      allowComment,
      isKoreanOnly,
      isEventAlwaysOpen,
      eventStartDate,
      eventEndDate,
      eventDescription,
      updatedAt: nowMs(),
    };
    localStorage.setItem(key, JSON.stringify(data));
    if (!silent) {
      alert(
        lang === "ko" ? "임시 저장되었습니다." : "Draft saved successfully.",
      );
    }
  };

  const handleRestoreDraft = () => {
    const key = `draft_${selectedCategory}`;
    const raw = localStorage.getItem(key);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      setTitleKo(parsed.titleKo || "");
      setTitleEn(parsed.titleEn || "");
      setContentKo(parsed.contentKo || "");
      setContentEn(parsed.contentEn || "");
      setIsAnonymous(parsed.isAnonymous ?? false);
      setIsPinned(parsed.isPinned ?? false);
      setAllowComment(parsed.allowComment ?? true);
      setIsKoreanOnly(parsed.isKoreanOnly ?? false);
      setIsEventAlwaysOpen(parsed.isEventAlwaysOpen ?? false);
      setEventStartDate(parsed.eventStartDate || "");
      setEventEndDate(parsed.eventEndDate || "");
      setEventDescription(parsed.eventDescription || "");
      setHasDraft(false);
      alert(
        lang === "ko"
          ? "임시 저장글이 복구되었습니다."
          : "Draft restored successfully.",
      );
    } catch (error) {
      console.error(error);
    }
  };

  const handleDiscardDraft = async () => {
    const confirmed = await requestConfirm({
      confirmLabel: lang === "ko" ? "삭제" : "Delete",
      description:
        lang === "ko"
          ? "브라우저에 저장된 임시 작성 내용이 삭제됩니다."
          : "The draft saved in this browser will be removed.",
      title:
        lang === "ko"
          ? "임시 저장글을 삭제하시겠습니까?"
          : "Delete this draft?",
      tone: "danger",
    });
    if (!confirmed) return;

    const key = `draft_${selectedCategory}`;
    localStorage.removeItem(key);
    setEventStartDate("");
    setEventEndDate("");
    setEventDescription("");
    setIsEventAlwaysOpen(false);
    setHasDraft(false);
  };

  useEffect(() => {
    if (
      !titleKo &&
      !contentKo &&
      !titleEn &&
      !contentEn &&
      !isEventAlwaysOpen &&
      !eventStartDate &&
      !eventEndDate &&
      !eventDescription
    ) {
      return;
    }
    const timer = setTimeout(() => {
      handleSaveDraft(true);
    }, 10000);
    return () => clearTimeout(timer);
  }, [
    titleKo,
    contentKo,
    titleEn,
    contentEn,
    isAnonymous,
    isPinned,
    allowComment,
    isKoreanOnly,
    isEventAlwaysOpen,
    eventStartDate,
    eventEndDate,
    eventDescription,
    selectedCategory,
  ]);

  const handleSubmit = async () => {
    if (!canWriteSelected) {
      alert(
        lang === "ko"
          ? "이 게시판에 글을 작성할 권한이 없습니다."
          : "You do not have permission to write to this board.",
      );
      return;
    }

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

    if (selectedCategory === "행사") {
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
      const article = await apiClient.createArticle(selectedCategory, {
        titleKo,
        titleEn: titleEn || undefined,
        contentKo,
        contentEn: contentEn || undefined,
        visibilityScope: isKoreanOnly ? "MEMBERS" : "PUBLIC",
        isAnonymous: canConfigurePostSettings ? isAnonymous : false,
        isPinned: canConfigurePostSettings ? isPinned : false,
        allowComment: selectedBoard?.allowComment === false ? false : allowComment,
        assets: assets.map((asset, index) => ({
          assetId: asset.assetId,
          usageType: asset.usageType,
          sortOrder: index,
        })),
        eventStartDate:
          selectedCategory === "행사"
            ? isEventAlwaysOpen
              ? null
              : htmlDatetimeLocalToIso(eventStartDate)
            : undefined,
        eventEndDate:
          selectedCategory === "행사"
            ? isEventAlwaysOpen
              ? null
              : htmlDatetimeLocalToIso(eventEndDate)
            : undefined,
        eventDescription:
          selectedCategory === "행사" ? eventDescription.trim() : undefined,
      });
      if (canConfigurePostSettings && selectedSurveyId) {
        let overwriteSchedule = false;
        let overwriteAlwaysOpen = false;
        if (selectedCategory === "행사" && isEventAlwaysOpen) {
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
        } else if (selectedCategory === "행사" && eventStartDate && eventEndDate) {
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
          connectedArticleId: article.articleId,
          kind: selectedCategory === "행사" ? "EVENT" : undefined,
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
      localStorage.removeItem(`draft_${selectedCategory}`);
      alert(
        lang === "ko"
          ? "게시글이 작성되었습니다."
          : "Article published successfully.",
      );
      navigate(`/board/${selectedCategory}/${article.articleId}`);
    } catch (error) {
      console.error(error);
      alert(
        lang === "ko"
          ? "게시글 작성에 실패했습니다."
          : "Failed to publish article.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
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
    setContentEn,
    setContentKo,
    setEventDescription,
    setEventEndDate,
    setEventStartDate,
    setAllowComment,
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
  };
}
