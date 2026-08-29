import { createElement, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { createApiClient } from "@soc/api-client";
import type {
  ArticleDraftRecord,
  ArticleDraftSaveRequest,
  SurveyRecord,
} from "@soc/contracts";
import {
  hasPermission,
  msToIso,
  nowMs,
} from "@soc/shared";

import { useConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { useBoardCatalog } from "@/hooks/use-board-catalog";
import { useCurrentSession } from "@/hooks/use-current-session";
import { useLanguage } from "@/hooks/use-language";
import {
  getBoardWritePermissionBitFromMetadata,
} from "@/lib/board-metadata";
import { resolveApiBaseUrl } from "@/lib/api-base-url";
import { resolveAssetUrl } from "@/lib/asset-url";
import { hasAdminPermission } from "@/lib/permissions";
import { hasPersistedProfile } from "@/lib/require-persisted-profile";

import type { AttachedAsset } from "./board-write-form-sections";
import {
  eventDateInputToIso,
  isAllDayDateRange,
  isoToEventDateInput,
} from "./event-date-utils";

type BoardWriteLocationState = {
  initialCategory?: string;
};

const PUBLIC_WRITE_BOARD_CODES = new Set(["건의사항"]);

const parseHomeOrder = (value: string): number | null => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const getDraftFingerprint = (payload: Omit<ArticleDraftSaveRequest, "fingerprint" | "draftId" | "expectedVersion">) => {
  const serialized = JSON.stringify(payload);
  let hash = 2166136261;
  for (let index = 0; index < serialized.length; index += 1) {
    hash ^= serialized.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
};

export function useBoardWritePageController(forcedCategory?: string) {
  const location = useLocation();
  const navigate = useNavigate();
  const { category: routeCategory } = useParams<{ category?: string }>();
  const { lang } = useLanguage();
  const { data: session } = useCurrentSession();
  const { confirm: requestConfirm, ConfirmDialog } = useConfirmDialog();
  const { toast } = useToast();
  const routeInitialCategory = (
    location.state as BoardWriteLocationState | null
  )?.initialCategory;
  const routeDraftId = new URLSearchParams(location.search).get("draftId");
  const [selectedCategory, setSelectedCategory] = useState<string>(
    forcedCategory ?? routeCategory ?? routeInitialCategory ?? "공지",
  );

  const [isAnonymous, setIsAnonymous] = useState(false);
  const [isPinned, setIsPinned] = useState(false);
  const [homeVisible, setHomeVisible] = useState(true);
  const [homeOrder, setHomeOrder] = useState("");
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
  const [eventLocation, setEventLocation] = useState("");
  const [eventDescriptionKo, setEventDescriptionKo] = useState("");
  const [eventDescriptionEn, setEventDescriptionEn] = useState("");
  const [isAllDay, setIsAllDay] = useState(false);
  const [isEventAlwaysOpen, setIsEventAlwaysOpen] = useState(false);
  const [surveys, setSurveys] = useState<SurveyRecord[]>([]);
  const [selectedSurveyId, setSelectedSurveyId] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [drafts, setDrafts] = useState<ArticleDraftRecord[]>([]);
  const [serverDraftId, setServerDraftId] = useState<string | null>(null);
  const [serverDraftVersion, setServerDraftVersion] = useState<number>();
  const [draftRestoredAt, setDraftRestoredAt] = useState<string | null>(null);
  const lastDraftFingerprintRef = useRef<string | null>(null);
  const hasWriteContentRef = useRef(false);

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
      .filter((board) => forcedCategory ? board.code === forcedCategory : board.code !== "_EVENT")
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
  }, [boardCatalogSource, boards, canUseWriteFeatures, forcedCategory, userPermission]);
  const canWriteSelected =
    canUseWriteFeatures && writableBoardCodes.includes(selectedCategory);
  const canManageTemplates = hasAdminPermission(userPermission);
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
    if (selectedCategory === "_EVENT") return;
    setHomeVisible(true);
    setHomeOrder("");
  }, [selectedCategory]);

  useEffect(() => {
    if (selectedCategory === "건의사항") {
      setAllowComment(true);
      return;
    }

    if (selectedBoard?.allowComment === false) {
      setAllowComment(false);
      return;
    }

    setAllowComment(true);
  }, [selectedBoard?.allowComment, selectedCategory]);

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
            usageType: "ATTACHMENT",
          } satisfies AttachedAsset;
        }),
      );
      setAssets((prev) => [...prev, ...uploaded]);
    } catch (err) {
      console.error(err);
      toast({
        type: "error",
        message:
          lang === "ko"
            ? "파일 업로드에 실패했습니다."
            : "Failed to upload files.",
      });
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleUploadInlineImage = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast({
        type: "error",
        message:
          lang === "ko"
            ? "본문 이미지는 이미지 파일만 선택할 수 있습니다."
            : "Inline images must be image files.",
      });
      return null;
    }

    setUploading(true);
    try {
      const asset = await apiClient.uploadAsset(file);
      setAssets((current) => [
        ...current,
        {
          assetId: asset.assetId,
          mimeType: asset.mimeType,
          originalFilename: asset.originalFilename,
          sizeBytes: asset.sizeBytes,
          storageKey: asset.storageKey,
          usageType: "IMAGE",
        } satisfies AttachedAsset,
      ]);
      return resolveAssetUrl(asset.storageKey);
    } catch (error) {
      console.error(error);
      toast({
        type: "error",
        message:
          lang === "ko"
            ? "본문 이미지 업로드에 실패했습니다."
            : "Failed to upload the inline image.",
      });
      return null;
    } finally {
      setUploading(false);
    }
  };

  const handleUploadThumbnail = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast({
        type: "error",
        message:
          lang === "ko"
            ? "썸네일은 이미지 파일만 선택할 수 있습니다."
            : "The thumbnail must be an image file.",
      });
      return;
    }

    setUploading(true);
    try {
      const asset = await apiClient.uploadAsset(file);
      const thumbnail = {
        assetId: asset.assetId,
        mimeType: asset.mimeType,
        originalFilename: asset.originalFilename,
        sizeBytes: asset.sizeBytes,
        storageKey: asset.storageKey,
        usageType: "THUMBNAIL",
      } satisfies AttachedAsset;
      setAssets((current) => [
        ...current.filter((item) => item.usageType !== "THUMBNAIL"),
        thumbnail,
      ]);
    } catch (error) {
      console.error(error);
      toast({
        type: "error",
        message:
          lang === "ko"
            ? "썸네일 업로드에 실패했습니다."
            : "Failed to upload the thumbnail.",
      });
    } finally {
      setUploading(false);
    }
  };

  hasWriteContentRef.current = Boolean(
    titleKo.trim() ||
      titleEn.trim() ||
      contentKo.trim() ||
      contentEn.trim() ||
      eventDescriptionKo.trim() ||
      eventDescriptionEn.trim() ||
      eventStartDate ||
      eventEndDate ||
      eventLocation.trim(),
  );

  const applyDraftToForm = (draft: ArticleDraftRecord) => {
    setTitleKo(draft.titleKo || "");
    setTitleEn(draft.titleEn || "");
    setContentKo(draft.contentKo || "");
    setContentEn(draft.contentEn || "");
    setIsAnonymous(draft.isAnonymous);
    setIsPinned(draft.isPinned);
    setHomeVisible(draft.homeVisible !== false);
    setHomeOrder(
      draft.homeOrder === null || draft.homeOrder === undefined
        ? ""
        : String(draft.homeOrder),
    );
    setIsSecret(draft.isSecret);
    setAllowComment(selectedCategory === "건의사항" ? true : draft.allowComment);
    setIsKoreanOnly(draft.isKoreanOnly);
    setIsEventAlwaysOpen(
      !draft.eventStartDate &&
        !draft.eventEndDate &&
        Boolean(draft.eventDescriptionKo),
    );
    const draftIsAllDay = isAllDayDateRange(
      draft.eventStartDate,
      draft.eventEndDate,
    );
    setIsAllDay(draftIsAllDay);
    setEventStartDate(
      draft.eventStartDate
        ? isoToEventDateInput(draft.eventStartDate, draftIsAllDay)
        : "",
    );
    setEventEndDate(
      draft.eventEndDate
        ? isoToEventDateInput(draft.eventEndDate, draftIsAllDay)
        : "",
    );
    setEventLocation(draft.eventLocation || "");
    setEventDescriptionKo(draft.eventDescriptionKo || "");
    setEventDescriptionEn(draft.eventDescriptionEn || "");
    setSelectedSurveyId(draft.linkedSurveyId || "");
    setServerDraftId(draft.draftId);
    setServerDraftVersion(draft.version);
    setDraftRestoredAt(draft.updatedAt);
  };

  useEffect(() => {
    setServerDraftId(null);
    setServerDraftVersion(undefined);
    setDraftRestoredAt(null);
    if (!canUseWriteFeatures || !canWriteSelected) return;

    let cancelled = false;
    const draftListRequest = apiClient.getArticleDrafts({
      boardCode: selectedCategory,
      limit: 20,
      page: 1,
    });
    draftListRequest
      .then((response) => {
        if (!cancelled) {
          setDrafts(response.items);
          if (!routeDraftId && !hasWriteContentRef.current) {
            const latest = response.items[0];
            if (latest) applyDraftToForm(latest);
          }
        }
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
        applyDraftToForm(latest);
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
      homeVisible,
      homeOrder,
      isSecret,
      allowComment,
      isKoreanOnly,
      isAllDay,
      isEventAlwaysOpen,
      eventStartDate,
      eventEndDate,
      eventLocation,
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
      homeVisible: selectedCategory === "_EVENT" ? homeVisible : true,
      homeOrder: selectedCategory === "_EVENT" ? parseHomeOrder(homeOrder) : undefined,
      isSecret,
      isAnonymous,
      allowComment: selectedCategory === "건의사항" ? true : allowComment,
      isKoreanOnly,
      assets: assets.map((asset, index) => ({
        assetId: asset.assetId,
        usageType: asset.usageType,
        sortOrder: index,
      })),
      eventStartDate:
        selectedCategory === "_EVENT" && eventStartDate
          ? eventDateInputToIso(eventStartDate, isAllDay)
          : null,
      eventEndDate:
        selectedCategory === "_EVENT" && eventEndDate
          ? eventDateInputToIso(eventEndDate, isAllDay, true)
          : null,
      eventLocation:
        selectedCategory === "_EVENT" ? eventLocation.trim() || null : null,
      eventDescriptionKo:
        selectedCategory === "_EVENT" ? eventDescriptionKo || null : null,
      eventDescriptionEn:
        selectedCategory === "_EVENT" ? eventDescriptionEn || null : null,
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
        setHomeVisible(draft.homeVisible !== false);
        setHomeOrder(
          draft.homeOrder === null || draft.homeOrder === undefined
            ? ""
            : String(draft.homeOrder),
        );
        setIsSecret(draft.isSecret);
        setAllowComment(selectedCategory === "건의사항" ? true : draft.allowComment);
        setIsKoreanOnly(draft.isKoreanOnly);
        setIsEventAlwaysOpen(
          !draft.eventStartDate && !draft.eventEndDate &&
            Boolean(draft.eventDescriptionKo),
        );
        const draftIsAllDay = isAllDayDateRange(
          draft.eventStartDate,
          draft.eventEndDate,
        );
        setIsAllDay(draftIsAllDay);
        setEventStartDate(
          draft.eventStartDate
            ? isoToEventDateInput(draft.eventStartDate, draftIsAllDay)
            : "",
        );
        setEventEndDate(
          draft.eventEndDate
            ? isoToEventDateInput(draft.eventEndDate, draftIsAllDay)
            : "",
        );
        setEventLocation(draft.eventLocation || "");
        setEventDescriptionKo(draft.eventDescriptionKo || "");
        setEventDescriptionEn(draft.eventDescriptionEn || "");
        setSelectedSurveyId(draft.linkedSurveyId || "");
        setServerDraftId(draft.draftId);
        setServerDraftVersion(draft.version);
        setDraftRestoredAt(draft.updatedAt);
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
      setHomeVisible(parsed.homeVisible !== false);
      setHomeOrder(
        parsed.homeOrder === null || parsed.homeOrder === undefined
          ? ""
          : String(parsed.homeOrder),
      );
      setIsSecret(parsed.isSecret ?? false);
      setAllowComment(
        selectedCategory === "건의사항" ? true : parsed.allowComment ?? true,
      );
      setIsKoreanOnly(parsed.isKoreanOnly ?? false);
      const parsedIsAllDay =
        parsed.isAllDay ??
        isAllDayDateRange(parsed.eventStartDate || null, parsed.eventEndDate || null);
      setIsAllDay(parsedIsAllDay);
      setIsEventAlwaysOpen(parsed.isEventAlwaysOpen ?? false);
      setEventStartDate(
        parsed.eventStartDate
          ? parsedIsAllDay
            ? parsed.eventStartDate.slice(0, 10)
            : parsed.eventStartDate
          : "",
      );
      setEventEndDate(
        parsed.eventEndDate
          ? parsedIsAllDay
            ? parsed.eventEndDate.slice(0, 10)
            : parsed.eventEndDate
          : "",
      );
      setEventLocation(parsed.eventLocation || "");
      setEventDescriptionKo(
        parsed.eventDescriptionKo || parsed.eventDescription || "",
      );
      setEventDescriptionEn(parsed.eventDescriptionEn || "");
      if (typeof parsed.updatedAt === "number") {
        setDraftRestoredAt(msToIso(parsed.updatedAt));
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleStartNewDraft = () => {
    if (serverDraftId) {
      void apiClient.deleteArticleDraft(serverDraftId).catch(() => undefined);
      setDrafts((current) =>
        current.filter((draft) => draft.draftId !== serverDraftId),
      );
    }
    localStorage.removeItem(`draft_${selectedCategory}`);
    setTitleKo("");
    setTitleEn("");
    setContentKo("");
    setContentEn("");
    setIsAnonymous(false);
    setIsPinned(false);
    setHomeVisible(true);
    setHomeOrder("");
    setIsSecret(false);
    setAllowComment(true);
    setIsKoreanOnly(false);
    setAssets([]);
    setEventStartDate("");
    setEventEndDate("");
    setEventLocation("");
    setEventDescriptionKo("");
    setEventDescriptionEn("");
    setIsEventAlwaysOpen(false);
    setSelectedSurveyId("");
    setServerDraftId(null);
    setServerDraftVersion(undefined);
    setDraftRestoredAt(null);
    lastDraftFingerprintRef.current = null;
    navigate(location.pathname, { replace: true, state: location.state });
  };

  const handleDeleteDraft = async (draftId: string) => {
    const draft = drafts.find((item) => item.draftId === draftId);
    const confirmed = await requestConfirm({
      confirmLabel: lang === "ko" ? "삭제" : "Delete",
      description:
        lang === "ko"
          ? createElement(
              "span",
              null,
              "정말 ",
              createElement("strong", { className: "font-semibold text-slate-900" }, `“${draft?.titleKo || "제목 없는 임시저장글"}”`),
              " 임시저장글을 삭제하시겠습니까?",
            )
          : createElement(
              "span",
              null,
              "Are you sure you want to delete ",
              createElement("strong", { className: "font-semibold text-slate-900" }, `“${draft?.titleKo || "this saved draft"}”`),
              "?",
            ),
      warning:
        lang === "ko"
          ? "(삭제된 임시저장글은 영구히 복구할 수 없습니다.)"
          : "(Deleted saved drafts cannot be restored.)",
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
      !eventLocation &&
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
    isAllDay,
    isEventAlwaysOpen,
    eventStartDate,
    eventEndDate,
    eventLocation,
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
    isAllDay,
    isEventAlwaysOpen,
    eventStartDate,
    eventEndDate,
    eventLocation,
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
      toast({
        type: "error",
        message:
          lang === "ko"
            ? "이 게시판에 글을 작성할 권한이 없습니다."
            : "You do not have permission to write to this board.",
      });
      return;
    }

    if (!titleKo.trim() || !contentKo.trim()) {
      toast({
        type: "error",
        message:
          lang === "ko"
            ? "국문 제목과 내용은 필수입니다."
            : "Korean title and content are required.",
      });
      return;
    }

    if (!isKoreanOnly && (!titleEn.trim() || !contentEn.trim())) {
      toast({
        type: "error",
        message:
          lang === "ko"
            ? "영문 제목과 내용을 입력하거나 '한국어 전용'을 선택해 주세요."
            : "Enter an English title and content, or select 'Korean only'.",
      });
      return;
    }

    if (selectedCategory === "_EVENT") {
      if (
        !eventDescriptionKo.trim() ||
        (!isKoreanOnly && !eventDescriptionEn.trim()) ||
        (!isEventAlwaysOpen && (!eventStartDate || !eventEndDate))
      ) {
        toast({
          type: "error",
          message:
            lang === "ko"
              ? "행사 일정 또는 상시 여부, 그리고 간단한 설명은 필수입니다."
              : "Event schedule or always-open status, plus card description, is required.",
        });
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
        homeVisible: selectedCategory === "_EVENT" ? homeVisible : undefined,
        homeOrder: selectedCategory === "_EVENT" ? parseHomeOrder(homeOrder) : undefined,
        isSecret: selectedBoard?.allowSecret ? isSecret : false,
        allowComment:
          selectedCategory === "건의사항"
            ? true
            : selectedBoard?.allowComment === false
              ? false
              : allowComment,
        assets: assets.map((asset, index) => ({
          assetId: asset.assetId,
          usageType: asset.usageType,
          sortOrder: index,
        })),
        eventStartDate:
          selectedCategory === "_EVENT"
            ? isEventAlwaysOpen
              ? null
              : eventDateInputToIso(eventStartDate, isAllDay)
            : undefined,
        eventEndDate:
          selectedCategory === "_EVENT"
            ? isEventAlwaysOpen
              ? null
              : eventDateInputToIso(eventEndDate, isAllDay, true)
            : undefined,
        eventLocation:
          selectedCategory === "_EVENT"
            ? eventLocation.trim() || undefined
            : undefined,
        eventDescriptionKo:
          selectedCategory === "_EVENT" ? eventDescriptionKo.trim() : undefined,
        eventDescriptionEn:
          selectedCategory === "_EVENT"
            ? isKoreanOnly
              ? undefined
              : eventDescriptionEn.trim() || undefined
            : undefined,
      });
      if (canConfigurePostSettings && selectedSurveyId) {
        let overwriteSchedule = false;
        let overwriteAlwaysOpen = false;
        if (selectedCategory === "_EVENT" && isEventAlwaysOpen) {
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
        } else if (selectedCategory === "_EVENT" && eventStartDate && eventEndDate) {
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
          kind: selectedCategory === "_EVENT" ? "APPLICATION" : undefined,
          isAlwaysOpen: overwriteAlwaysOpen
            ? true
            : overwriteSchedule
              ? false
              : undefined,
          openAt: overwriteAlwaysOpen
            ? null
            : overwriteSchedule
              ? eventDateInputToIso(eventStartDate, isAllDay)
              : undefined,
        });
      }
      localStorage.removeItem(`draft_${selectedCategory}`);
      if (serverDraftId) {
        await apiClient.deleteArticleDraft(serverDraftId).catch(() => undefined);
      }
      toast({
        type: "success",
        message:
          lang === "ko"
            ? "게시글이 작성되었습니다."
            : "Article published successfully.",
      });
      navigate(selectedCategory === "_EVENT" ? `/events/${article.articleId}` : `/board/${selectedCategory}/${article.articleId}`);
    } catch (error) {
      console.error(error);
      toast({
        type: "error",
        message:
          lang === "ko"
            ? "게시글 작성에 실패했습니다."
            : "Failed to publish article.",
      });
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
    canManageTemplates,
    canWriteSelected,
    contentEn,
    contentKo,
    drafts,
    draftRestoredAt,
    eventDescriptionKo,
    eventDescriptionEn,
    eventEndDate,
    eventLocation,
    eventStartDate,
    fileInputRef,
    handleCategoryChange,
    handleDeleteDraft,
    handleRestoreDraft,
    handleStartNewDraft,
    handleSaveDraft,
    handleSubmit,
    handleUploadThumbnail,
    handleUploadFiles,
    handleUploadInlineImage,
    isAnonymous,
    isAllDay,
    isEventAlwaysOpen,
    isSecret,
    isKoreanOnly,
    isPinned,
    homeVisible,
    homeOrder,
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
    setEventLocation,
    setEventStartDate,
    setAllowComment,
    setIsAnonymous,
    setIsAllDay,
    setIsEventAlwaysOpen,
    setHomeOrder,
    setHomeVisible,
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
