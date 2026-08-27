import { createElement, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { createApiClient } from "@soc/api-client";
import type {
  ArticleDraftRecord,
  ArticleDraftSaveRequest,
  SurveyRecord,
} from "@soc/contracts";
import { useConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { useCurrentSession } from "@/hooks/use-current-session";
import { useLanguage } from "@/hooks/use-language";
import { resolveApiBaseUrl } from "@/lib/api-base-url";
import { hasAdminPermission } from "@/lib/permissions";

import type { AttachedAsset } from "./board-write-form-sections";
import {
  eventDateInputToIso,
  isAllDayDateRange,
  isoToEventDateInput,
} from "./event-date-utils";

const PUBLIC_WRITE_BOARD_CODES = new Set(["건의사항"]);

const parseHomeOrder = (value: string): number | null => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const getDraftFingerprint = (
  payload: Omit<
    ArticleDraftSaveRequest,
    "fingerprint" | "draftId" | "expectedVersion"
  >,
) => {
  const serialized = JSON.stringify(payload);
  let hash = 2166136261;
  for (let index = 0; index < serialized.length; index += 1) {
    hash ^= serialized.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
};

export function useBoardEditPageController(forcedCategory?: string) {
  const { category: routeCategory = "공지", articleId } = useParams<{
    category: string;
    articleId: string;
  }>();
  const category = forcedCategory ?? routeCategory;
  const navigate = useNavigate();
  const location = useLocation();
  const { lang } = useLanguage();
  const { data: session } = useCurrentSession();
  const { confirm: requestConfirm, ConfirmDialog } = useConfirmDialog();
  const { toast } = useToast();

  const apiClient = useMemo(
    () => createApiClient({ baseUrl: resolveApiBaseUrl() }),
    [],
  );

  const [titleKo, setTitleKo] = useState("");
  const [titleEn, setTitleEn] = useState("");
  const [contentKo, setContentKo] = useState("");
  const [contentEn, setContentEn] = useState("");
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [isPinned, setIsPinned] = useState(false);
  const [homeVisible, setHomeVisible] = useState(true);
  const [homeOrder, setHomeOrder] = useState("");
  const [isSecret, setIsSecret] = useState(false);
  const [allowSecret, setAllowSecret] = useState(false);
  const [allowComment, setAllowComment] = useState(true);
  const [isKoreanOnly, setIsKoreanOnly] = useState(false);
  const [assets, setAssets] = useState<AttachedAsset[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [eventStartDate, setEventStartDate] = useState("");
  const [eventEndDate, setEventEndDate] = useState("");
  const [eventDescriptionKo, setEventDescriptionKo] = useState("");
  const [eventDescriptionEn, setEventDescriptionEn] = useState("");
  const [isAllDay, setIsAllDay] = useState(false);
  const [isEventAlwaysOpen, setIsEventAlwaysOpen] = useState(false);
  const [surveys, setSurveys] = useState<SurveyRecord[]>([]);
  const [selectedSurveyId, setSelectedSurveyId] = useState("");
  const [initialSurveyId, setInitialSurveyId] = useState("");

  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<ArticleDraftRecord[]>([]);
  const [serverDraftId, setServerDraftId] = useState<string | null>(null);
  const [serverDraftVersion, setServerDraftVersion] = useState<number>();
  const [draftStatus, setDraftStatus] = useState<
    "idle" | "saving" | "saved" | "failed" | "conflict"
  >("idle");
  const [draftRestoredAt, setDraftRestoredAt] = useState<string | null>(null);
  const initialFingerprintRef = useRef<string | null>(null);
  const lastDraftFingerprintRef = useRef<string | null>(null);
  const autoRestoredDraftRef = useRef<string | null>(null);
  const canConfigurePostSettings = !PUBLIC_WRITE_BOARD_CODES.has(category);
  const canManageTemplates = hasAdminPermission(session?.permission);
  const routeDraftId = new URLSearchParams(location.search).get("draftId");

  const backToArticle = () => {
    navigate(category === "_EVENT" ? `/events/${articleId}` : `/board/${category}/${articleId}`);
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
        setHomeVisible(res.homeVisible !== false);
        setHomeOrder(
          res.homeOrder === null || res.homeOrder === undefined
            ? ""
            : String(res.homeOrder),
        );
        setIsSecret(res.isSecret);
        setAllowComment(res.allowComment);
        setIsKoreanOnly(
          !res.titleEn?.trim() ||
            !res.contentEn?.trim() ||
            (category === "_EVENT" && !res.eventDescriptionEn?.trim()),
        );
        setIsEventAlwaysOpen(
          category === "_EVENT" &&
            !res.eventStartDate &&
            !res.eventEndDate &&
            Boolean(res.eventDescriptionKo),
        );
        const eventIsAllDay = isAllDayDateRange(
          res.eventStartDate,
          res.eventEndDate,
        );
        setIsAllDay(eventIsAllDay);
        setEventStartDate(
          res.eventStartDate
            ? isoToEventDateInput(res.eventStartDate, eventIsAllDay)
            : "",
        );
        setEventEndDate(
          res.eventEndDate
            ? isoToEventDateInput(res.eventEndDate, eventIsAllDay)
            : "",
        );
        setEventDescriptionKo(res.eventDescriptionKo || "");
        setEventDescriptionEn(res.eventDescriptionEn || "");
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
        initialFingerprintRef.current = null;
        lastDraftFingerprintRef.current = null;
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
    apiClient
      .getBoard(category)
      .then((board) => setAllowSecret(board.allowSecret))
      .catch(() => setAllowSecret(false));
  }, [apiClient, category]);

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

  const buildDraftPayload = () => ({
    boardCode: category,
    targetArticleId: articleId ?? null,
    titleKo,
    titleEn: titleEn || null,
    contentKo,
    contentEn: contentEn || null,
    visibilityScope: "PUBLIC" as const,
    isPinned: canConfigurePostSettings ? isPinned : false,
    homeVisible: category === "_EVENT" ? homeVisible : true,
    homeOrder: category === "_EVENT" ? parseHomeOrder(homeOrder) : undefined,
    isSecret: allowSecret ? isSecret : false,
    isAnonymous: canConfigurePostSettings ? isAnonymous : false,
    allowComment,
    isKoreanOnly,
    assets: assets.map((asset, index) => ({
      assetId: asset.assetId,
      usageType: asset.usageType,
      sortOrder: index,
    })),
    eventStartDate:
      category === "_EVENT" && eventStartDate
        ? eventDateInputToIso(eventStartDate, isAllDay)
        : null,
    eventEndDate:
      category === "_EVENT" && eventEndDate
        ? eventDateInputToIso(eventEndDate, isAllDay, true)
        : null,
    eventDescriptionKo:
      category === "_EVENT" ? eventDescriptionKo || null : null,
    eventDescriptionEn:
      category === "_EVENT" ? eventDescriptionEn || null : null,
    linkedSurveyId: selectedSurveyId || null,
  });

  const applyDraft = (draft: ArticleDraftRecord) => {
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
    setAllowComment(draft.allowComment);
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
    setEventDescriptionKo(draft.eventDescriptionKo || "");
    setEventDescriptionEn(draft.eventDescriptionEn || "");
    setSelectedSurveyId(draft.linkedSurveyId || "");
  };

  useEffect(() => {
    if (!articleId) return;

    let cancelled = false;
    const listRequest = apiClient.getArticleDrafts({
      boardCode: category,
      limit: 20,
      page: 1,
    });

    listRequest
      .then((response) => {
        if (!cancelled) setDrafts(response.items);
      })
      .catch(() => {
        if (!cancelled) setDrafts([]);
      });

    if (routeDraftId) {
      apiClient
        .getArticleDraft(routeDraftId)
        .then((draft) => {
          if (
            cancelled ||
            (draft.targetArticleId && draft.targetArticleId !== articleId)
          ) {
            return;
          }
          applyDraft(draft);
          setServerDraftId(draft.draftId);
          setServerDraftVersion(draft.version);
          setDraftStatus("saved");
          setDraftRestoredAt(draft.updatedAt);
        })
        .catch(() => undefined);
    }

    return () => {
      cancelled = true;
    };
  }, [apiClient, articleId, category, location.search]);

  useEffect(() => {
    if (loading || !articleId || routeDraftId) return;
    const draft = drafts.find(
      (item) => item.targetArticleId === articleId,
    );
    if (!draft || autoRestoredDraftRef.current === draft.draftId) return;

    autoRestoredDraftRef.current = draft.draftId;
    applyDraft(draft);
    setServerDraftId(draft.draftId);
    setServerDraftVersion(draft.version);
    setDraftStatus("saved");
    setDraftRestoredAt(draft.updatedAt);
  }, [articleId, drafts, loading, routeDraftId]);

  const handleSaveDraft = async () => {
    if (!articleId || (!titleKo.trim() && !contentKo.trim())) return;

    const payload = buildDraftPayload();
    const fingerprint = getDraftFingerprint(payload);
    if (lastDraftFingerprintRef.current === fingerprint) return;

    setDraftStatus("saving");
    try {
      const response = await apiClient.saveArticleDraft({
        ...payload,
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
      setDraftStatus("saved");
      lastDraftFingerprintRef.current = fingerprint;
    } catch (saveError) {
      setDraftStatus(
        String(saveError).includes("conflict") ? "conflict" : "failed",
      );
    }
  };

  const handleRestoreDraft = async (draftId: string) => {
    try {
      const draft = await apiClient.getArticleDraft(draftId);
      if (draft.targetArticleId && draft.targetArticleId !== articleId) return;
      applyDraft(draft);
      setServerDraftId(draft.draftId);
      setServerDraftVersion(draft.version);
      setDraftStatus("saved");
      setDraftRestoredAt(draft.updatedAt);
    } catch {
      setDraftStatus("failed");
    }
  };

  const handleStartNewDraft = () => {
    if (serverDraftId) {
      void apiClient.deleteArticleDraft(serverDraftId).catch(() => undefined);
    }
    navigate(category === "_EVENT" ? "/events/write" : `/board/${category}/write`);
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
      title:
        lang === "ko" ? "임시저장글을 삭제하시겠습니까?" : "Delete saved draft?",
      tone: "danger",
    });
    if (!confirmed) return;

    try {
      await apiClient.deleteArticleDraft(draftId);
      setDrafts((current) =>
        current.filter((draft) => draft.draftId !== draftId),
      );
      if (serverDraftId === draftId) {
        setServerDraftId(null);
        setServerDraftVersion(undefined);
        lastDraftFingerprintRef.current = null;
      }
    } catch {
      setDraftStatus("failed");
    }
  };

  useEffect(() => {
    if (loading || !articleId) return;

    const fingerprint = getDraftFingerprint(buildDraftPayload());
    if (initialFingerprintRef.current === null) {
      initialFingerprintRef.current = fingerprint;
      lastDraftFingerprintRef.current = fingerprint;
      return;
    }
    if (lastDraftFingerprintRef.current === fingerprint) return;

    const timer = window.setTimeout(() => void handleSaveDraft(), 2000);
    return () => window.clearTimeout(timer);
  }, [
    loading,
    articleId,
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
    assets,
    eventStartDate,
    eventEndDate,
    eventDescriptionKo,
    eventDescriptionEn,
    selectedSurveyId,
  ]);

  useEffect(() => {
    const saveOnLeave = () => {
      if (document.visibilityState === "hidden") void handleSaveDraft();
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
    homeVisible,
    homeOrder,
    isSecret,
    allowComment,
    isKoreanOnly,
    isAllDay,
    assets,
    eventStartDate,
    eventEndDate,
    eventDescriptionKo,
    eventDescriptionEn,
    selectedSurveyId,
    serverDraftId,
    serverDraftVersion,
  ]);

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

  const handleSubmit = async () => {
    if (!articleId) return;

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
            ? "영문 제목과 내용을 입력하거나 '한국어 사용자만'을 선택해 주세요."
            : "Enter an English title and content, or select 'Korean Speakers Only'.",
      });
      return;
    }

    if (category === "_EVENT") {
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
      await apiClient.updateArticle(category, articleId, {
        titleKo,
        titleEn: isKoreanOnly ? "" : titleEn,
        contentKo,
        contentEn: isKoreanOnly ? "" : contentEn,
        isAnonymous: canConfigurePostSettings ? isAnonymous : false,
        isPinned: canConfigurePostSettings ? isPinned : false,
        homeVisible: category === "_EVENT" ? homeVisible : undefined,
        homeOrder: category === "_EVENT" ? parseHomeOrder(homeOrder) : undefined,
        isSecret: allowSecret ? isSecret : false,
        allowComment,
        assets: assets.map((asset, index) => ({
          assetId: asset.assetId,
          usageType: asset.usageType,
          sortOrder: index,
        })),
        eventStartDate:
          category === "_EVENT"
            ? isEventAlwaysOpen
              ? null
              : eventDateInputToIso(eventStartDate, isAllDay)
            : undefined,
        eventEndDate:
          category === "_EVENT"
            ? isEventAlwaysOpen
              ? null
              : eventDateInputToIso(eventEndDate, isAllDay, true)
            : undefined,
        eventDescriptionKo:
          category === "_EVENT" ? eventDescriptionKo.trim() : undefined,
        eventDescriptionEn:
          category === "_EVENT"
            ? isKoreanOnly
              ? null
              : eventDescriptionEn.trim()
            : undefined,
      });
      if (canConfigurePostSettings && selectedSurveyId) {
        let overwriteSchedule = false;
        let overwriteAlwaysOpen = false;
        if (category === "_EVENT" && isEventAlwaysOpen) {
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
        } else if (category === "_EVENT" && eventStartDate && eventEndDate) {
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
          connectedArticleId: articleId,
          kind: category === "_EVENT" ? "APPLICATION" : undefined,
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
      if (
        canConfigurePostSettings &&
        initialSurveyId &&
        initialSurveyId !== selectedSurveyId
      ) {
        await apiClient.updateSurvey(initialSurveyId, {
          connectedArticleId: null,
        });
      }
      if (serverDraftId) {
        await apiClient.deleteArticleDraft(serverDraftId).catch(() => undefined);
        setDrafts((current) =>
          current.filter((draft) => draft.draftId !== serverDraftId),
        );
        setServerDraftId(null);
        setServerDraftVersion(undefined);
      }
      toast({
        type: "success",
        message:
          lang === "ko"
            ? "게시글이 수정되었습니다."
            : "Article updated successfully.",
      });
      backToArticle();
    } catch (err) {
      console.error(err);
      toast({
        type: "error",
        message:
          lang === "ko"
            ? "게시글 수정에 실패했습니다."
            : "Failed to update article.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
    ConfirmDialog,
    articleId,
    assets,
    allowComment,
    allowSecret,
    backToArticle,
    canConfigurePostSettings,
    canManageTemplates,
    category,
    contentEn,
    contentKo,
    drafts,
    draftStatus,
    draftRestoredAt,
    error,
    eventDescriptionKo,
    eventDescriptionEn,
    eventEndDate,
    eventStartDate,
    fileInputRef,
    handleSubmit,
    handleDeleteDraft,
    handleRestoreDraft,
    handleStartNewDraft,
    handleSaveDraft,
    handleUploadThumbnail,
    handleUploadFiles,
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
  };
}
