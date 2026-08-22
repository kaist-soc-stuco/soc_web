import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { createApiClient } from "@soc/api-client";
import type {
  ArticleDraftRecord,
  ArticleDraftSaveRequest,
  SurveyRecord,
} from "@soc/contracts";
import {
  hasPermission,
  htmlDatetimeLocalToIso,
  nowMs,
  isoToHtmlDatetimeLocal,
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

const PUBLIC_WRITE_BOARD_CODES = new Set(["건의사항"]);

const getDraftFingerprint = (payload: Omit<ArticleDraftSaveRequest, "fingerprint" | "draftId" | "expectedVersion">) => {
  const serialized = JSON.stringify(payload);
  let hash = 2166136261;
  for (let index = 0; index < serialized.length; index += 1) {
    hash ^= serialized.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
};

export function useBoardWritePageController() {
  const location = useLocation();
  const navigate = useNavigate();
  const { category: routeCategory } = useParams<{ category?: string }>();
  const { lang } = useLanguage();
  const { data: session } = useCurrentSession();
  const { confirm: requestConfirm, ConfirmDialog } = useConfirmDialog();
  const routeInitialCategory = (
    location.state as BoardWriteLocationState | null
  )?.initialCategory;
  const routeDraftId = new URLSearchParams(location.search).get("draftId");
  const [selectedCategory, setSelectedCategory] = useState<string>(
    routeCategory ?? routeInitialCategory ?? "공지",
  );

  const [isAnonymous, setIsAnonymous] = useState(false);
  const [isPinned, setIsPinned] = useState(false);
  const [isSecret, setIsSecret] = useState(false);
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
  const [eventDescriptionKo, setEventDescriptionKo] = useState("");
  const [eventDescriptionEn, setEventDescriptionEn] = useState("");
  const [isEventAlwaysOpen, setIsEventAlwaysOpen] = useState(false);
  const [surveys, setSurveys] = useState<SurveyRecord[]>([]);
  const [selectedSurveyId, setSelectedSurveyId] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [drafts, setDrafts] = useState<ArticleDraftRecord[]>([]);
  const [serverDraftId, setServerDraftId] = useState<string | null>(null);
  const [serverDraftVersion, setServerDraftVersion] = useState<number>();
  const lastDraftFingerprintRef = useRef<string | null>(null);

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
    if (!selectedBoard?.allowSecret) {
      setIsSecret(false);
    }
  }, [selectedBoard?.allowSecret]);

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
    setServerDraftId(null);
    setServerDraftVersion(undefined);
    if (!canUseWriteFeatures || !canWriteSelected) return;

    let cancelled = false;
    const draftListRequest = apiClient.getArticleDrafts({
      boardCode: selectedCategory,
      limit: 20,
      page: 1,
    });
    draftListRequest
      .then((response) => {
        if (!cancelled) setDrafts(response.items);
      })
      .catch(() => {
        if (!cancelled) setDrafts([]);
      });

    if (!routeDraftId) {
      return () => {
        cancelled = true;
      };
    }

    apiClient
      .getArticleDraft(routeDraftId)
      .then((latest) => {
        if (cancelled || !latest) return;
        setTitleKo(latest.titleKo || "");
        setTitleEn(latest.titleEn || "");
        setContentKo(latest.contentKo || "");
        setContentEn(latest.contentEn || "");
        setIsAnonymous(latest.isAnonymous);
        setIsPinned(latest.isPinned);
        setIsSecret(latest.isSecret);
        setAllowComment(latest.allowComment);
        setIsKoreanOnly(latest.isKoreanOnly);
        setIsEventAlwaysOpen(
          !latest.eventStartDate &&
            !latest.eventEndDate &&
            Boolean(latest.eventDescriptionKo),
        );
        setEventStartDate(
          latest.eventStartDate
            ? isoToHtmlDatetimeLocal(latest.eventStartDate)
            : "",
        );
        setEventEndDate(
          latest.eventEndDate ? isoToHtmlDatetimeLocal(latest.eventEndDate) : "",
        );
        setEventDescriptionKo(latest.eventDescriptionKo || "");
        setEventDescriptionEn(latest.eventDescriptionEn || "");
        setSelectedSurveyId(latest.linkedSurveyId || "");
        setServerDraftId(latest.draftId);
        setServerDraftVersion(latest.version);
      })
      .catch(() => {
        // Local storage remains a usable fallback when the server draft API is unavailable.
      });

    return () => {
      cancelled = true;
    };
  }, [
    apiClient,
    canUseWriteFeatures,
    canWriteSelected,
    routeDraftId,
    selectedCategory,
  ]);

  const handleSaveDraft = async () => {
    const key = `draft_${selectedCategory}`;
    const data = {
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
      updatedAt: nowMs(),
    };
    localStorage.setItem(key, JSON.stringify(data));

    const draftPayload = {
      boardCode: selectedCategory,
      titleKo,
      titleEn: titleEn || null,
      contentKo,
      contentEn: contentEn || null,
      visibilityScope: "PUBLIC" as const,
      isPinned,
      isSecret,
      isAnonymous,
      allowComment,
      isKoreanOnly,
      assets: assets.map((asset, index) => ({
        assetId: asset.assetId,
        usageType: asset.usageType,
        sortOrder: index,
      })),
      eventStartDate:
        selectedCategory === "행사" && eventStartDate
          ? htmlDatetimeLocalToIso(eventStartDate)
          : null,
      eventEndDate:
        selectedCategory === "행사" && eventEndDate
          ? htmlDatetimeLocalToIso(eventEndDate)
          : null,
      eventDescriptionKo:
        selectedCategory === "행사" ? eventDescriptionKo || null : null,
      eventDescriptionEn:
        selectedCategory === "행사" ? eventDescriptionEn || null : null,
      linkedSurveyId: selectedSurveyId || null,
    } satisfies Omit<
      ArticleDraftSaveRequest,
      "draftId" | "expectedVersion" | "fingerprint"
    >;
    const fingerprint = getDraftFingerprint(draftPayload);

    if (
      canUseWriteFeatures &&
      canWriteSelected &&
      lastDraftFingerprintRef.current !== fingerprint
    ) {
      try {
        const response = await apiClient.saveArticleDraft({
          ...draftPayload,
          draftId: serverDraftId ?? undefined,
          expectedVersion: serverDraftVersion,
          fingerprint,
        });
        setServerDraftId(response.draftId);
        setServerDraftVersion(response.version);
        setDrafts((current) => [
          response,
          ...current.filter((draft) => draft.draftId !== response.draftId),
        ]);
        lastDraftFingerprintRef.current = fingerprint;
      } catch (error) {
        console.error(error);
      }
    }
  };

  const handleRestoreDraft = async (draftId?: string) => {
    const requestedDraftId = draftId ?? serverDraftId;
    if (requestedDraftId) {
      try {
        const draft = await apiClient.getArticleDraft(requestedDraftId);
        setTitleKo(draft.titleKo || "");
        setTitleEn(draft.titleEn || "");
        setContentKo(draft.contentKo || "");
        setContentEn(draft.contentEn || "");
        setIsAnonymous(draft.isAnonymous);
        setIsPinned(draft.isPinned);
        setIsSecret(draft.isSecret);
        setAllowComment(draft.allowComment);
        setIsKoreanOnly(draft.isKoreanOnly);
        setIsEventAlwaysOpen(
          !draft.eventStartDate && !draft.eventEndDate &&
            Boolean(draft.eventDescriptionKo),
        );
        setEventStartDate(draft.eventStartDate ? isoToHtmlDatetimeLocal(draft.eventStartDate) : "");
        setEventEndDate(draft.eventEndDate ? isoToHtmlDatetimeLocal(draft.eventEndDate) : "");
        setEventDescriptionKo(draft.eventDescriptionKo || "");
        setEventDescriptionEn(draft.eventDescriptionEn || "");
        setSelectedSurveyId(draft.linkedSurveyId || "");
        setServerDraftVersion(draft.version);
        return;
      } catch {
        // Keep the local browser fallback below available when the API is unavailable.
      }
    }

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
      setIsSecret(parsed.isSecret ?? false);
      setAllowComment(parsed.allowComment ?? true);
      setIsKoreanOnly(parsed.isKoreanOnly ?? false);
      setIsEventAlwaysOpen(parsed.isEventAlwaysOpen ?? false);
      setEventStartDate(parsed.eventStartDate || "");
      setEventEndDate(parsed.eventEndDate || "");
      setEventDescriptionKo(
        parsed.eventDescriptionKo || parsed.eventDescription || "",
      );
      setEventDescriptionEn(parsed.eventDescriptionEn || "");
    } catch (error) {
      console.error(error);
    }
  };

  const handleDeleteDraft = async (draftId: string) => {
    const confirmed = await requestConfirm({
      confirmLabel: lang === "ko" ? "삭제" : "Delete",
      description:
        lang === "ko"
          ? "선택한 임시저장글을 삭제합니다."
          : "Delete this saved draft.",
      title: lang === "ko" ? "임시저장글을 삭제하시겠습니까?" : "Delete saved draft?",
      tone: "danger",
      });
    if (!confirmed) return;

    try {
      await apiClient.deleteArticleDraft(draftId);
      setDrafts((current) => current.filter((draft) => draft.draftId !== draftId));
      if (serverDraftId === draftId) {
        setServerDraftId(null);
        setServerDraftVersion(undefined);
      }
    } catch {
      // A failed delete is intentionally silent; the draft remains in the list.
    }
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
      !eventDescriptionKo &&
      !eventDescriptionEn
    ) {
      return;
    }
    const timer = setTimeout(() => {
      void handleSaveDraft();
    }, 2000);
    return () => clearTimeout(timer);
  }, [
    titleKo,
    contentKo,
    titleEn,
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
    assets,
    selectedSurveyId,
    selectedCategory,
  ]);

  useEffect(() => {
    const saveOnLeave = () => {
      if (document.visibilityState !== "hidden") return;
      void handleSaveDraft();
    };
    window.addEventListener("pagehide", saveOnLeave);
    document.addEventListener("visibilitychange", saveOnLeave);
    return () => {
      window.removeEventListener("pagehide", saveOnLeave);
      document.removeEventListener("visibilitychange", saveOnLeave);
    };
  }, [
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
    assets,
    selectedSurveyId,
    selectedCategory,
    serverDraftId,
    serverDraftVersion,
    apiClient,
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
      return;
    }

    if (!isKoreanOnly && (!titleEn.trim() || !contentEn.trim())) {
      alert(
        lang === "ko"
            ? "영문 제목과 내용을 입력하거나 '한국어 콘텐츠만'을 선택해 주세요."
            : "Enter an English title and content, or select 'Korean content only'.",
      );
      return;
    }

    if (selectedCategory === "행사") {
      if (
        !eventDescriptionKo.trim() ||
        (!isKoreanOnly && !eventDescriptionEn.trim()) ||
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
        titleEn: isKoreanOnly ? undefined : titleEn,
        contentKo,
        contentEn: isKoreanOnly ? undefined : contentEn,
        visibilityScope: "PUBLIC",
        isAnonymous: canConfigurePostSettings ? isAnonymous : false,
        isPinned: canConfigurePostSettings ? isPinned : false,
        isSecret: selectedBoard?.allowSecret ? isSecret : false,
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
        eventDescriptionKo:
          selectedCategory === "행사" ? eventDescriptionKo.trim() : undefined,
        eventDescriptionEn:
          selectedCategory === "행사"
            ? isKoreanOnly
              ? undefined
              : eventDescriptionEn.trim() || undefined
            : undefined,
      });
      if (canConfigurePostSettings && selectedSurveyId) {
        let overwriteSchedule = false;
        let overwriteAlwaysOpen = false;
        if (selectedCategory === "행사" && isEventAlwaysOpen) {
          overwriteAlwaysOpen = await requestConfirm({
            confirmLabel: lang === "ko" ? "상시로 설정" : "Set always open",
            description:
              lang === "ko"
                ? "선택한 설문조사의 시작 시각을 비우고 상시 진행으로 설정할까요?"
                : "Set the linked survey as always open and clear its start time?",
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
                ? "설문 시작 시각도 행사 시작 시각과 동일하게 맞출까요?"
                : "Use the event start as the linked survey start time?",
            title:
              lang === "ko"
                ? "설문 시작 시각을 행사 시작 시각으로 덮어쓸까요?"
                : "Overwrite survey start time?",
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
        });
      }
      localStorage.removeItem(`draft_${selectedCategory}`);
      if (serverDraftId) {
        await apiClient.deleteArticleDraft(serverDraftId).catch(() => undefined);
      }
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
    assets,
    allowComment,
    boardByCode,
    canConfigurePostSettings,
    canWriteSelected,
    contentEn,
    contentKo,
    drafts,
    eventDescriptionKo,
    eventDescriptionEn,
    eventEndDate,
    eventStartDate,
    fileInputRef,
    handleCategoryChange,
    handleDeleteDraft,
    handleRestoreDraft,
    handleSaveDraft,
    handleSubmit,
    handleUploadFiles,
    isAnonymous,
    isEventAlwaysOpen,
    isSecret,
    isKoreanOnly,
    isPinned,
    isSubmitting,
    lang,
    selectedBoard,
    selectedCategory,
    selectedSurveyId,
    setAssets,
    setContentEn,
    setContentKo,
    setEventDescriptionKo,
    setEventDescriptionEn,
    setEventEndDate,
    setEventStartDate,
    setAllowComment,
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
  };
}
