import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { createApiClient } from "@soc/api-client";
import type {
  ArticleDraftRecord,
  ArticleDraftSaveRequest,
  SurveyRecord,
} from "@soc/contracts";
import {
  htmlDatetimeLocalToIso,
  isoToHtmlDatetimeLocal,
} from "@soc/shared";

import { useConfirmDialog } from "@/components/ui/confirm-dialog";
import { useLanguage } from "@/hooks/use-language";
import { resolveApiBaseUrl } from "@/lib/api-base-url";

import type { AttachedAsset } from "./board-write-form-sections";

const PUBLIC_WRITE_BOARD_CODES = new Set(["건의사항"]);

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

export function useBoardEditPageController() {
  const { category = "공지", articleId } = useParams<{
    category: string;
    articleId: string;
  }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { lang } = useLanguage();
  const { confirm: requestConfirm, ConfirmDialog } = useConfirmDialog();

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
  const initialFingerprintRef = useRef<string | null>(null);
  const lastDraftFingerprintRef = useRef<string | null>(null);
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
        setIsSecret(res.isSecret);
        setAllowComment(res.allowComment);
        setIsKoreanOnly(
          !res.titleEn?.trim() ||
            !res.contentEn?.trim() ||
            (category === "행사" && !res.eventDescriptionEn?.trim()),
        );
        setIsEventAlwaysOpen(
          category === "행사" &&
            !res.eventStartDate &&
            !res.eventEndDate &&
            Boolean(res.eventDescriptionKo),
        );
        setEventStartDate(
          res.eventStartDate ? isoToHtmlDatetimeLocal(res.eventStartDate) : "",
        );
        setEventEndDate(
          res.eventEndDate ? isoToHtmlDatetimeLocal(res.eventEndDate) : "",
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
      category === "행사" && eventStartDate
        ? htmlDatetimeLocalToIso(eventStartDate)
        : null,
    eventEndDate:
      category === "행사" && eventEndDate
        ? htmlDatetimeLocalToIso(eventEndDate)
        : null,
    eventDescriptionKo:
      category === "행사" ? eventDescriptionKo || null : null,
    eventDescriptionEn:
      category === "행사" ? eventDescriptionEn || null : null,
    linkedSurveyId: selectedSurveyId || null,
  });

  const applyDraft = (draft: ArticleDraftRecord) => {
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
      !draft.eventStartDate &&
        !draft.eventEndDate &&
        Boolean(draft.eventDescriptionKo),
    );
    setEventStartDate(
      draft.eventStartDate ? isoToHtmlDatetimeLocal(draft.eventStartDate) : "",
    );
    setEventEndDate(
      draft.eventEndDate ? isoToHtmlDatetimeLocal(draft.eventEndDate) : "",
    );
    setEventDescriptionKo(draft.eventDescriptionKo || "");
    setEventDescriptionEn(draft.eventDescriptionEn || "");
    setSelectedSurveyId(draft.linkedSurveyId || "");
  };

  useEffect(() => {
    if (!articleId) return;

    let cancelled = false;
    const routeDraftId = new URLSearchParams(location.search).get("draftId");
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
        })
        .catch(() => undefined);
    }

    return () => {
      cancelled = true;
    };
  }, [apiClient, articleId, category, location.search]);

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
    } catch {
      setDraftStatus("failed");
    }
  };

  const handleDeleteDraft = async (draftId: string) => {
    const confirmed = await requestConfirm({
      confirmLabel: lang === "ko" ? "삭제" : "Delete",
      description:
        lang === "ko"
          ? "선택한 임시저장글을 삭제합니다."
          : "Delete this saved draft.",
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
    isSecret,
    allowComment,
    isKoreanOnly,
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
    isSecret,
    allowComment,
    isKoreanOnly,
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

    if (category === "행사") {
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
      await apiClient.updateArticle(category, articleId, {
        titleKo,
        titleEn: isKoreanOnly ? "" : titleEn,
        contentKo,
        contentEn: isKoreanOnly ? "" : contentEn,
        isAnonymous: canConfigurePostSettings ? isAnonymous : false,
        isPinned: canConfigurePostSettings ? isPinned : false,
        isSecret: allowSecret ? isSecret : false,
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
        eventDescriptionKo:
          category === "행사" ? eventDescriptionKo.trim() : undefined,
        eventDescriptionEn:
          category === "행사"
            ? isKoreanOnly
              ? null
              : eventDescriptionEn.trim()
            : undefined,
      });
      if (canConfigurePostSettings && selectedSurveyId) {
        let overwriteSchedule = false;
        let overwriteAlwaysOpen = false;
        if (category === "행사" && isEventAlwaysOpen) {
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
        } else if (category === "행사" && eventStartDate && eventEndDate) {
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
    articleId,
    assets,
    allowComment,
    allowSecret,
    backToArticle,
    canConfigurePostSettings,
    category,
    contentEn,
    contentKo,
    drafts,
    draftStatus,
    error,
    eventDescriptionKo,
    eventDescriptionEn,
    eventEndDate,
    eventStartDate,
    fileInputRef,
    handleSubmit,
    handleDeleteDraft,
    handleRestoreDraft,
    handleSaveDraft,
    handleUploadFiles,
    isAnonymous,
    isEventAlwaysOpen,
    isKoreanOnly,
    isPinned,
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
  };
}
