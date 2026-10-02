import { useToast } from "@/components/ui/toast";
import { randomId } from "@/lib/random-id";
import {
  useEffect,
  useCallback,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import { ApiClientHttpError, createApiClient } from "@soc/api-client";
import type {
  BulkEmailPreviewResponse,
  CurrentUserResponse,
  BulkEmailRecord,
  SendBulkEmailRequest,
} from "@soc/contracts";
import {
  formatKoreanDateTime,
  htmlDatetimeLocalToIso,
  isoToHtmlDatetimeLocal,
  isoToMs,
  msToIso,
  nowMs,
} from "@soc/shared";
import { ArrowLeft, CalendarClock, ChevronDown, ChevronRight, Users, X } from "lucide-react";
import { PopoverPanel } from "@/components/ui/popover-panel";

import { AuthGuard } from "@/components/guards/auth-guard";
import { RichTextEditor } from "@/components/organisms/rich-text-editor";
import { RichTextContent } from "@/components/ui/rich-text-content";
import { AdminEmptyState, AdminEditorGuidance, AdminFormField, AdminPageShell, AdminPageHeader } from "@/components/ui/admin-page";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { UiInput, UiTextarea } from "@/components/ui/form-control";
import { Permissions } from "@/lib/permissions";
import { resolveApiBaseUrl } from "@/lib/api-base-url";
import { resolveAssetUrl } from "@/lib/asset-url";
import { useCurrentSession } from "@/hooks/use-current-session";
import { getDraftStorageKey } from "@/lib/draft-storage";

const RECIPIENT_TYPES: ReadonlyArray<{
  value: SendBulkEmailRequest["recipientType"];
  label: string;
}> = [
  { value: "ALL", label: "전체 학생" },
  { value: "PAID_STUDENTS", label: "과비 납부자" },
  { value: "UNPAID_STUDENTS", label: "과비 미납자" },
];

type RecipientFilters = NonNullable<SendBulkEmailRequest["filters"]>;
type RecipientFilterKey = keyof RecipientFilters;
type DeliveryMode = "now" | "scheduled";

type StoredEmailDraft = {
  attachments?: AttachmentView[];
  content: string;
  contentType: SendBulkEmailRequest["contentType"];
  filters: RecipientFilters;
  recipientType: SendBulkEmailRequest["recipientType"];
  savedAt: string;
  subject: string;
};

type RecipientFilterMenuOption =
  | {
      kind: "filter";
      key: RecipientFilterKey;
      label: string;
      value: string;
    }
  | {
      kind: "recipientType";
      label: string;
      value: SendBulkEmailRequest["recipientType"];
    };

const currentAdmissionYear = Number(msToIso(nowMs() + 9 * 60 * 60 * 1000).slice(0, 4));

const RECIPIENT_FILTER_GROUPS: ReadonlyArray<{
  label: string;
  options: ReadonlyArray<RecipientFilterMenuOption>;
}> = [
  {
    label: "학번",
    options: [
      ...Array.from({ length: 6 }, (_, index): RecipientFilterMenuOption => {
        const year = currentAdmissionYear - index;
        return { kind: "filter", key: "studentNumber", value: String(year), label: `${String(year).slice(2)}학번` };
      }),
      { kind: "filter", key: "studentNumber", value: `${currentAdmissionYear - 6}_OR_EARLIER`, label: `${String(currentAdmissionYear - 6).slice(2)}학번 이전` },
    ],
  },
  {
    label: "학과 구분",
    options: [
      { kind: "filter", key: "primaryMajor", value: "전산학부", label: "전산학부 주전공" },
    ],
  },
  {
    label: "과비 납부",
    options: [
      { kind: "recipientType", value: "PAID_STUDENTS", label: "납부" },
      { kind: "recipientType", value: "UNPAID_STUDENTS", label: "미납부" },
    ],
  },
];

type AttachmentView = {
  assetId: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  inlineUrl?: string;
};

const EXECUTION_HISTORY_STATUSES = new Set<BulkEmailRecord["status"]>([
  "SUCCESS",
  "SCHEDULED",
  "DRY_RUN",
  "SENDING",
  "UNKNOWN",
]);

export function BulkEmailPage() {
  return (
    <AuthGuard requirePermission={Permissions.SEND_BULK_EMAIL}>
      <BulkEmailPageContent />
    </AuthGuard>
  );
}

function BulkEmailPageContent() {
  const { toast } = useToast();
  const apiClient = useMemo(() => createApiClient({ baseUrl: resolveApiBaseUrl() }), []);
  const { data: session, isLoading: sessionLoading } = useCurrentSession();
  const emailDraftStorageKey = useMemo(
    () => getDraftStorageKey("bulk-email", "compose", session),
    [session?.authenticated, session?.storageMode, session?.draftNamespace],
  );
  const fileInputRef = useRef<HTMLInputElement>(null);
  const subjectInputRef = useRef<HTMLInputElement>(null);
  const bodySectionRef = useRef<HTMLElement>(null);
  const recipientPopoverRef = useRef<HTMLDivElement>(null);
  const recipientTriggerRef = useRef<HTMLButtonElement>(null);
  const recipientPanelRef = useRef<HTMLDivElement>(null);
  const idempotencyKeyRef = useRef<string | null>(null);

  const [initialLocalDraft, setInitialLocalDraft] = useState<StoredEmailDraft | null>(null);
  const [draftIdentityKey, setDraftIdentityKey] = useState<string | null | undefined>(undefined);
  const [loadedDraftIdentityKey, setLoadedDraftIdentityKey] = useState<string | null>(null);
  const [draftReady, setDraftReady] = useState(false);
  const draftClearedRef = useRef(false);
  const skipNextDraftSaveRef = useRef(false);

  const [recipientType, setRecipientType] = useState<SendBulkEmailRequest["recipientType"]>(
    "ALL",
  );
  const [filters, setFilters] = useState<RecipientFilters>({});
  const [recipientMenuOpen, setRecipientMenuOpen] = useState(false);
  const [recipientMenuAnchor, setRecipientMenuAnchor] = useState<{ left: number; top: number } | null>(null);
  const [recipientFilterGroup, setRecipientFilterGroup] = useState<string | null>(null);
  const [recipientCount, setRecipientCount] = useState<number | null>(null);
  const [recipientCountLoading, setRecipientCountLoading] = useState(false);

  const [subject, setSubject] = useState("");
  const [content, setContent] = useState("");
  const [contentType, setContentType] = useState<SendBulkEmailRequest["contentType"]>("html");
  const [editorMode, setEditorMode] = useState<"editor" | "preview" | "html">("editor");
  const [attachments, setAttachments] = useState<AttachmentView[]>([]);
  const [uploading, setUploading] = useState(false);

  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewPreview, setReviewPreview] = useState<BulkEmailPreviewResponse | null>(null);
  const [deliveryMode, setDeliveryMode] = useState<DeliveryMode>("now");
  const [scheduledAt, setScheduledAt] = useState("");
  const [sending, setSending] = useState(false);

  const [history, setHistory] = useState<BulkEmailRecord[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);

  const setOperationError = useCallback((message: string | null) => { if (message) toast({ type: "error", message }); }, [toast]);
  const [currentUser, setCurrentUser] = useState<CurrentUserResponse["user"]>();
  useEffect(() => { let active = true; void apiClient.getCurrentUser().then((response) => { if (active) setCurrentUser(response.user); }).catch(() => {}); return () => { active = false; }; }, [apiClient]);
  const setStatusNotice = (message: string | null) => { if (message) toast({ type: "success", message }); };

  useEffect(() => {
    if (sessionLoading || draftIdentityKey === emailDraftStorageKey) return;

    setInitialLocalDraft(readStoredEmailDraft(emailDraftStorageKey));
    setDraftIdentityKey(emailDraftStorageKey);
    setLoadedDraftIdentityKey(null);
    setDraftReady(false);
    setRecipientType("ALL");
    setFilters({});
    setSubject("");
    setContent("");
    setContentType("html");
    setAttachments([]);
    setScheduledAt("");
  }, [draftIdentityKey, emailDraftStorageKey, sessionLoading]);

  const filterSignature = useMemo(() => JSON.stringify(normalizeFilters(filters)), [filters]);
  const activeFilterEntries = useMemo(() => {
    const entries: Array<{
      key: RecipientFilterKey;
      label: string;
      tokenLabel: string;
      value: string;
    }> = [];
    const add = (
      key: RecipientFilterKey,
      label: string,
      value: string | undefined,
      tokenLabel = value,
    ) => {
      const normalized = value?.trim();
      if (normalized) entries.push({ key, label, tokenLabel: tokenLabel ?? normalized, value: normalized });
    };

    for (const value of filters.studentNumber?.split(",").filter(Boolean).sort((left, right) => parseInt(right, 10) - parseInt(left, 10)) ?? []) add("studentNumber", "학번", value, formatStudentNumberFilter(value));
    for (const value of filters.primaryMajor?.split(",").filter(Boolean) ?? []) add("primaryMajor", "주전공", value, `${value} 주전공`);
    for (const value of filters.query?.split(",").filter(Boolean) ?? []) add("query", "검색", value, `검색: ${value}`);
    return entries;
  }, [filters]);
  const activeFilterChips = useMemo(() => {
    const groups = new Map<RecipientFilterKey, { key: RecipientFilterKey; label: string; values: string[] }>();
    for (const entry of activeFilterEntries) {
      const group = groups.get(entry.key) ?? { key: entry.key, label: entry.label, values: [] };
      group.values.push(entry.key === "studentNumber" ? entry.tokenLabel.replace("학번", "") : entry.value);
      groups.set(entry.key, group);
    }
    return Array.from(groups.values()).map((group) => ({ key: group.key, label: `${group.label}: ${group.values.join(" · ")}` }));
  }, [activeFilterEntries]);

  useEffect(() => {
    if (!recipientMenuOpen) return;
    const frame = requestAnimationFrame(() => recipientPanelRef.current?.querySelector<HTMLElement>("button, input")?.focus({ preventScroll: true }));
    const closeOnOutside = (event: PointerEvent) => {
      if (!recipientPopoverRef.current?.contains(event.target as Node)) setRecipientMenuOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setRecipientMenuOpen(false);
      recipientTriggerRef.current?.focus();
    };
    const closeOnFocusOutside = (event: FocusEvent) => {
      if (!recipientPopoverRef.current?.contains(event.target as Node)) setRecipientMenuOpen(false);
    };
    const closeOnViewportChange = () => setRecipientMenuOpen(false);
    const closeOnPageScroll = (event: Event) => {
      if (event.target instanceof Node && recipientPopoverRef.current?.contains(event.target)) return;
      setRecipientMenuOpen(false);
    };
    window.addEventListener("resize", closeOnViewportChange);
    window.addEventListener("scroll", closeOnPageScroll, true);
    document.addEventListener("pointerdown", closeOnOutside);
    document.addEventListener("keydown", closeOnEscape);
    document.addEventListener("focusin", closeOnFocusOutside);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", closeOnViewportChange);
      window.removeEventListener("scroll", closeOnPageScroll, true);
      document.removeEventListener("pointerdown", closeOnOutside);
      document.removeEventListener("keydown", closeOnEscape);
      document.removeEventListener("focusin", closeOnFocusOutside);
    };
  }, [recipientMenuOpen, recipientFilterGroup]);
  const selectedRecipientLabel =
    RECIPIENT_TYPES.find((option) => option.value === recipientType)?.label ?? "받는 사람";
  const previewVariables = {
    이름: currentUser?.nameKo || session?.nameKo || "",
    학번: currentUser?.studentNumber ?? "",
    이메일: currentUser?.email ?? "",
  };
  const previewContent = renderEmailTemplate(content, previewVariables);
  const previewSubject = renderEmailTemplate(subject, previewVariables);

  const applyLocalDraftToForm = (draft: StoredEmailDraft) => {
    skipNextDraftSaveRef.current = true;
    setRecipientType(draft.recipientType);
    setSubject(draft.subject);
    setContent(draft.content);
    setContentType(draft.contentType);
    setFilters(draft.filters ?? {});
    setScheduledAt("");
    setAttachments(draft.attachments ?? []);
    setOperationError(null);
  };

  useEffect(() => {
    if (sessionLoading || draftIdentityKey !== emailDraftStorageKey) return;
    if (initialLocalDraft) applyLocalDraftToForm(initialLocalDraft);
    setDraftReady(true);
    setLoadedDraftIdentityKey(emailDraftStorageKey);
  }, [draftIdentityKey, emailDraftStorageKey, initialLocalDraft, sessionLoading]);

  useEffect(() => {
    let active = true;
    setRecipientCountLoading(true);
    const timer = window.setTimeout(() => {
      const request: SendBulkEmailRequest = {
        subject: "recipient-preview",
        content: "preview",
        contentType: "plain",
        recipientType,
        filters: normalizeFilters(filters),
        attachmentAssetIds: [],
      };
      void apiClient
        .previewBulkEmailRecipients(request)
        .then((response) => {
          if (active) {
            setRecipientCount(response.recipientCount);
            setReviewPreview(response);
          }
        })
        .catch(() => {
          if (active) setRecipientCount(null);
        })
        .finally(() => {
          if (active) setRecipientCountLoading(false);
        });
    }, 220);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [apiClient, filterSignature, filters, recipientType]);

  useEffect(() => {
    if (!draftReady || loadedDraftIdentityKey !== emailDraftStorageKey) return;
    if (skipNextDraftSaveRef.current) {
      skipNextDraftSaveRef.current = false;
      return;
    }

    const hasDraftContent = Boolean(
      subject.trim() || content.trim() || Object.keys(normalizeFilters(filters)).length,
    );
    if (draftClearedRef.current && !hasDraftContent) return;
    if (draftClearedRef.current) draftClearedRef.current = false;

    const savedAt = msToIso(nowMs());
    const draft: StoredEmailDraft = {
      attachments,
      content,
      contentType,
      filters: normalizeFilters(filters),
      recipientType,
      savedAt,
      subject,
    };
    try {
      if (emailDraftStorageKey) {
        window.localStorage.setItem(emailDraftStorageKey, JSON.stringify(draft));
      }
    } catch {
      // Storage can be unavailable in private browsing; the editor remains usable.
    }
  }, [attachments, content, contentType, draftReady, loadedDraftIdentityKey, emailDraftStorageKey, filters, recipientType, subject]);

  const buildRequest = (options?: {
    includeSchedule?: boolean;
    idempotencyKey?: string;
  }): SendBulkEmailRequest => ({
    subject: subject.trim(),
    content: content.trim(),
    contentType,
    recipientType,
    filters: normalizeFilters(filters),
    attachmentAssetIds: attachments.map((attachment) => attachment.assetId),
    ...(options?.includeSchedule !== false && deliveryMode === "scheduled" && scheduledAt
      ? { scheduledAt: htmlDatetimeLocalToIso(scheduledAt) }
      : {}),
    ...(options?.idempotencyKey ? { idempotencyKey: options.idempotencyKey } : {}),
  });

  const hasBody = contentType === "html"
    ? Boolean(new DOMParser().parseFromString(content, "text/html").body.textContent?.trim() || /<(img|table|video)\b/i.test(content))
    : Boolean(content.trim());
  const validateMessage = () => {
    if (!subject.trim() || !hasBody) {
      if (!subject.trim()) {
        subjectInputRef.current?.focus();
        setOperationError("제목을 입력해 주세요.");
      } else {
        setEditorMode("editor");
        requestAnimationFrame(() => bodySectionRef.current?.querySelector<HTMLElement>('[contenteditable="true"]')?.focus());
        setOperationError("본문을 입력해 주세요.");
      }
      return false;
    }
    if (deliveryMode === "scheduled" && (!scheduledAt || Date.parse(scheduledAt) <= nowMs())) {
      document.querySelector<HTMLInputElement>('input[type="datetime-local"]')?.focus();
      setOperationError("현재 시간 이후의 예약 발송 일시를 선택해 주세요.");
      return false;
    }
    return true;
  };

  const handleReview = async (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    if (!validateMessage()) return;
    try {
      setOperationError(null);
      setSending(true);
      setReviewPreview(await apiClient.previewBulkEmailRecipients(buildRequest()));
      setReviewOpen(true);
    } catch (error) {
      const missingId = error instanceof ApiClientHttpError ? error.code?.split("bulk_email_attachment_unavailable:")[1] : null;
      const missing = attachments.find(file => file.assetId === missingId);
      setOperationError(missing ? `첨부파일 “${missing.filename}”을 사용할 수 없습니다. 제거한 뒤 다시 첨부해 주세요.` : "발송 전 받는 사람과 첨부파일을 확인하지 못했습니다.");
    } finally {
      setSending(false);
    }
  };

  const clearStoredDraft = () => {
    try {
      if (emailDraftStorageKey) window.localStorage.removeItem(emailDraftStorageKey);
    } catch {
      // Storage can be unavailable in private browsing; continue clearing the form.
    }
    draftClearedRef.current = true;
  };

  const handleRecipientMenuSelect = (option: RecipientFilterMenuOption) => {
    if (option.kind === "recipientType") {
      setRecipientType((current) => current === option.value ? "ALL" : option.value);
    } else {
      setFilters((previous) => {
        const values = previous[option.key]?.split(",").filter(Boolean) ?? [];
        const next = values.includes(option.value) ? values.filter(value => value !== option.value) : [...values, option.value];
        return { ...previous, [option.key]: next.join(",") || undefined };
      });
    }
    setOperationError(null);
  };

  const handleConfirmSend = async () => {
    if (!reviewPreview) return;
    if (!validateMessage()) return;
    try {
      setSending(true);
      setOperationError(null);
      idempotencyKeyRef.current ??= randomId();
      const response = await apiClient.sendBulkEmail(
        buildRequest({ idempotencyKey: idempotencyKeyRef.current }),
      );
      skipNextDraftSaveRef.current = true;
      clearStoredDraft();
      setReviewOpen(false);
      setReviewPreview(null);
      setDeliveryMode("now");
      setScheduledAt("");
      idempotencyKeyRef.current = null;
      setStatusNotice(
        response.deliveryMode === "scheduled"
          ? "예약 발송을 등록했습니다."
          : `${response.recipientCount}명에게 발송했습니다.`,
      );
    } catch {
      setOperationError("메일 발송에 실패했습니다.");
    } finally {
      setSending(false);
    }
  };

  const loadHistory = async () => {
    setHistoryLoading(true);
    setHistoryError(null);
    try {
      const response = await apiClient.getBulkEmailHistory();
      setHistory(
        response.items
          .filter((record) => EXECUTION_HISTORY_STATUSES.has(record.status))
          .sort((a, b) => isoToMs(b.sentAt || b.updatedAt) - isoToMs(a.sentAt || a.updatedAt)),
      );
    } catch {
      setHistoryError("발송 이력을 불러오지 못했습니다.");
    } finally {
      setHistoryLoading(false);
    }
  };

  const openHistory = () => {
    setHistoryOpen(true);
    void loadHistory();
  };

  const handleCancelScheduled = async (emailId: string) => {
    try {
      setOperationError(null);
      await apiClient.cancelScheduledBulkEmail(emailId);
      await loadHistory();
    } catch {
      setOperationError("예약 발송을 취소하지 못했습니다.");
    }
  };

  const handleAttachmentChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (!files.length) return;
    if (uploading) return;
    if (attachments.length + files.length > 10) {
      setOperationError(`첨부파일은 최대 10개입니다. ${10 - attachments.length}개까지 추가할 수 있습니다.`);
      return;
    }
    try {
      setUploading(true);
      setOperationError(null);
      const results = await Promise.allSettled(files.map((file) => apiClient.uploadAsset(file, { transport: "server" })));
      const uploaded = results.flatMap((result) => result.status === "fulfilled" ? [result.value] : []);
      setAttachments((previous) =>
        [
          ...previous,
          ...uploaded.map((asset) => ({
            assetId: asset.assetId,
            filename: asset.originalFilename,
            mimeType: asset.mimeType,
            sizeBytes: asset.sizeBytes,
          })),
        ],
      );
      const failed = files.filter((_, index) => results[index].status === "rejected");
      if (failed.length) setOperationError(`업로드하지 못한 파일: ${failed.map((file) => file.name).join(", ")}. 성공한 파일은 유지됩니다. 실패한 파일만 다시 선택해 주세요.`);
    } catch {
      setOperationError("첨부파일을 업로드하지 못했습니다.");
    } finally {
      setUploading(false);
    }
  };

  const handleInlineImageUpload = async (file: File): Promise<string | null> => {
    if (uploading || attachments.length >= 10) {
      setOperationError(uploading ? "현재 업로드가 끝난 뒤 다시 시도해 주세요." : "본문 이미지를 포함해 첨부파일은 최대 10개입니다.");
      return null;
    }
    if (!file.type.startsWith("image/")) {
      setOperationError("본문 이미지는 이미지 파일만 첨부할 수 있습니다.");
      return null;
    }
    try {
      setUploading(true);
      setOperationError(null);
      const asset = await apiClient.uploadAsset(file, { transport: "server" });
      setAttachments((previous) =>
        [
          ...previous,
          {
            assetId: asset.assetId,
            filename: asset.originalFilename,
            mimeType: asset.mimeType,
            sizeBytes: asset.sizeBytes,
            inlineUrl: resolveAssetUrl(asset.storageKey),
          },
        ].slice(0, 10),
      );
      return resolveAssetUrl(asset.storageKey);
    } catch {
      setOperationError("본문 이미지를 업로드하지 못했습니다.");
      return null;
    } finally {
      setUploading(false);
    }
  };

  const dismissReview = () => {
    if (sending) return;
    setReviewOpen(false);
    setReviewPreview(null);
  };

  const editorModeTabs = (
    <SegmentedControl
      ariaLabel="메일 본문 보기"
      role="tablist"
      value={editorMode}
      onChange={setEditorMode}
      className="email-composer-mode-tabs"
      itemClassName="!h-8 !min-h-8 !px-3 !text-xs"
      options={[
        { value: "editor" as const, label: "에디터" },
        { value: "preview" as const, label: "미리보기" },
        { value: "html" as const, label: "HTML" },
      ]}
    />
  );

  if (sessionLoading || draftIdentityKey !== emailDraftStorageKey || loadedDraftIdentityKey !== emailDraftStorageKey) {
    return <div className="flex min-h-64 items-center justify-center text-sm text-slate-500" aria-busy="true">불러오는 중…</div>;
  }

  return (
    <AdminPageShell className="email-composer-page min-h-screen">
      <main className="admin-page__main mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-5 md:px-8 xl:px-10">
        <AdminPageHeader title="이메일 발송" />
        <SegmentedControl variant="underline" role="tablist" ariaLabel="이메일 화면" value={historyOpen ? "history" : "compose"}
          onChange={value => { if (value === "history") openHistory(); else setHistoryOpen(false); }}
          options={[{ value: "compose", label: "작성" }, { value: "history", label: "발송 이력" }]} />
        <div className="email-composer-shell w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-none" style={{ display: historyOpen ? "none" : undefined }}>


        <div className="p-4 pb-0 sm:p-5 sm:pb-0 md:hidden">
          <AdminEditorGuidance>
            <p>긴 메일 본문은 데스크톱 편집을 권장합니다. 초안은 자동 저장되며 최종 발송 전 검토 화면에서 다시 확인하세요.</p>
          </AdminEditorGuidance>
        </div>




        <form id="bulk-email-compose" noValidate className="w-full" onSubmit={(event) => void handleReview(event)}>
          <div className="email-composer-canvas bg-white">
            <section className="border-b border-slate-100 px-4 py-2 sm:px-5" aria-label="받는 사람">
              <div className="flex min-h-9 flex-wrap items-center gap-x-4 gap-y-2">
                <div className="flex min-w-0 flex-1 basis-full flex-wrap items-center gap-2 sm:basis-auto">
                  <span className="w-[4.5rem] shrink-0 py-1.5 text-sm font-medium text-slate-600">받는 사람</span>
                  {recipientType !== "ALL" || activeFilterChips.length === 0 ? <RecipientToken label={selectedRecipientLabel} onRemove={recipientType === "ALL" ? undefined : () => setRecipientType("ALL")} /> : null}
                  {activeFilterChips.map((entry) => (
                    <RecipientToken key={entry.key} label={entry.label} onRemove={() => setFilters((previous) => ({ ...previous, [entry.key]: undefined }))} />
                  ))}
                  <div ref={recipientPopoverRef} className="relative shrink-0">
                    <Button ref={recipientTriggerRef} type="button" variant="ghost" size="sm" className="text-slate-600"
                      aria-expanded={recipientMenuOpen} aria-haspopup="dialog" aria-controls={recipientMenuOpen ? "recipient-filter-popover" : undefined}
                      onClick={() => {
                        if (!recipientMenuOpen) {
                          const rect = recipientTriggerRef.current?.getBoundingClientRect();
                          if (rect) setRecipientMenuAnchor({ left: Math.max(16, Math.min(rect.left, window.innerWidth - 208)), top: rect.bottom + 8 });
                          setRecipientFilterGroup(null);
                        }
                        setRecipientMenuOpen((open) => !open);
                      }}>
                      필터 추가<ChevronDown aria-hidden="true" />
                    </Button>
                    {recipientMenuOpen && recipientMenuAnchor ? (
                      <PopoverPanel id="recipient-filter-popover" role="dialog" aria-label="받는 사람 필터" className="!fixed !mt-0 w-48 max-w-[calc(100vw-2rem)] !overflow-y-auto !rounded-lg p-1.5 !shadow-[0_2px_8px_rgb(15_23_42_/_0.08)]"
                        style={{ left: recipientMenuAnchor.left, top: recipientMenuAnchor.top, maxHeight: `calc(100dvh - ${recipientMenuAnchor.top + 16}px)` }}>
                        <div ref={recipientPanelRef}>
                          {recipientFilterGroup ? (
                            <>
                              <Button type="button" variant="ghost" size="sm" className="mb-1 w-full justify-start text-slate-700" onClick={() => setRecipientFilterGroup(null)}>
                                <ArrowLeft aria-hidden="true" className="size-4" />{recipientFilterGroup}
                              </Button>
                              <div className="border-t border-slate-100 pt-1">
                                {RECIPIENT_FILTER_GROUPS.find((group) => group.label === recipientFilterGroup)?.options.map((option) => (
                                  <label key={option.label} className="flex min-h-9 cursor-pointer items-center gap-2.5 rounded-md px-2.5 text-sm font-normal text-slate-700 hover:bg-slate-50">
                                    <input type="checkbox" className="ui-checkbox" checked={option.kind === "filter" ? Boolean(filters[option.key]?.split(",").includes(option.value)) : recipientType === option.value}
                                      onChange={() => handleRecipientMenuSelect(option)} />
                                    {option.label}
                                  </label>
                                ))}
                              </div>
                            </>
                          ) : RECIPIENT_FILTER_GROUPS.map((group) => (
                            <Button key={group.label} type="button" variant="ghost" size="sm" className="w-full justify-between text-sm font-normal text-slate-700" onClick={() => setRecipientFilterGroup(group.label)}>
                              {group.label}<ChevronRight aria-hidden="true" className="size-4 text-slate-400" />
                            </Button>
                          ))}
                        </div>
                      </PopoverPanel>
                    ) : null}
                  </div>
                </div>
                <div className="ml-auto shrink-0 text-xs font-normal text-slate-500 sm:min-w-32 sm:text-right" aria-live="polite" aria-busy={recipientCountLoading}>
                  {recipientCount === null ? null : `발송 대상 ${recipientCount}명`}
                </div>
              </div>
            </section>

            <section className="flex items-center gap-2 border-b border-slate-100 px-4 py-1 sm:px-5">
              <label htmlFor="bulk-email-subject" className="w-[4.5rem] shrink-0 text-sm font-medium text-slate-600">제목</label>
              <UiInput id="bulk-email-subject" aria-label="메일 제목" ref={subjectInputRef} spellCheck={false} value={subject}
                onChange={event => setSubject(event.currentTarget.value)} maxLength={255} placeholder="제목을 입력하세요"
                className="w-full min-w-0 !rounded-none !border-0 bg-transparent px-0 text-sm !font-normal !shadow-none focus:!ring-0" />
            </section>
          <section ref={bodySectionRef} className="min-w-0">
            {editorMode === "editor" ? (
              <div className="min-w-0 overflow-hidden">
                <RichTextEditor
                  className="email-composer-editor max-w-none"
                  content={content}
                  fileInputRef={fileInputRef}
                  lang="ko"
                  onImageUpload={handleInlineImageUpload}
                  onChange={(value) => {
                    setContent(value);
                    setContentType("html");
                  }}
                  placeholder="본문을 입력하세요"
                  spellCheck={false}
                  toolbarVariant="email"
                  uploading={uploading}
                  variableLabel="변수 삽입"
                  variableOptions={[
                    { label: "받는 사람 이름", token: "{{이름}}" },
                    { label: "받는 사람 이메일", token: "{{이메일}}" },
                    { label: "받는 사람 학번", token: "{{학번}}" },
                  ]}
                  toolbarSuffix={editorModeTabs}
                />
              </div>
            ) : editorMode === "preview" ? (
              <>
                <div className="email-composer-mode-toolbar flex items-center justify-end border-y border-slate-100">
                  {editorModeTabs}
                </div>
                <div className="tiptap-container min-h-[400px] px-4 py-6 prose prose-slate sm:px-6">
                  {content.trim() ? (
                    <RichTextContent content={previewContent} className="text-[length:var(--ui-text-section-size)] leading-7 text-slate-800" />
                  ) : (
                    <p className="text-[length:var(--ui-text-section-size)] font-normal text-slate-400">본문을 입력하세요</p>
                  )}
                </div>
              </>
            ) : (
              <>
                <div className="email-composer-mode-toolbar flex items-center justify-end border-y border-slate-100">
                  {editorModeTabs}
                </div>
                <UiTextarea
                  autoResize={false}
                  aria-label="HTML 본문"
                  value={content}
                  onChange={(event) => {
                    setContent(event.target.value);
                    setContentType("html");
                  }}
                  spellCheck={false}
                  className="min-h-[400px] w-full resize-none rounded-none border-0 bg-transparent px-4 py-6 font-mono text-sm font-normal leading-6 text-slate-700 shadow-none focus:border-0 focus:ring-0 sm:px-6"
                />
              </>
            )}
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="sr-only"
              onChange={(event) => void handleAttachmentChange(event)}
              disabled={uploading || attachments.length >= 10}
            />
            {attachments.length ? (
              <ul className="flex flex-wrap gap-2 px-4 py-3 sm:px-5" aria-label="첨부파일">
                {attachments.map((attachment) => (
                  <li key={attachment.assetId} className="inline-flex max-w-full items-center gap-2 rounded-md bg-slate-100 px-2.5 py-1.5 text-xs font-normal text-slate-600">
                    <span className="max-w-[18rem] truncate">{attachment.filename}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`${attachment.filename} 첨부 제거`}
                      data-tooltip="파일 삭제"
                      onClick={() => {
                        setAttachments((previous) => previous.filter((item) => item.assetId !== attachment.assetId));
                        if (attachment.inlineUrl) setContent((previous) => {
                          const document = new DOMParser().parseFromString(previous, "text/html");
                          document.querySelectorAll("img").forEach((image) => {
                            if (image.getAttribute("src") === attachment.inlineUrl) image.remove();
                          });
                          return document.body.innerHTML;
                        });
                      }}
                      className="min-h-11 min-w-11 rounded text-slate-400 hover:bg-slate-200 sm:size-5 sm:min-h-0 sm:min-w-0"
                    >
                      <X aria-hidden="true" />
                    </Button>
                  </li>
                ))}
              </ul>
            ) : null}
          </section>
          </div>
          <div className="flex items-center border-t border-slate-100 px-4 py-3 sm:px-5">
            <Button type="submit" disabled={sending}>보내기</Button>
          </div>
        </form>
        </div>
        {historyOpen ? <section className="min-h-80 rounded-2xl border border-slate-200 bg-white p-5" aria-label="발송 이력">
        {historyLoading ? (
          <p className="py-8 text-center text-sm font-normal text-slate-500">불러오는 중…</p>
        ) : historyError ? (
          <p className="py-8 text-center text-sm font-normal text-rose-600">{historyError}</p>
        ) : history.length === 0 ? (
          <AdminEmptyState message="발송 이력이 없습니다." />
        ) : (
          <ol className="divide-y divide-slate-100">
            {history.map((record) => (
              <li key={record.id} className="flex gap-3 border-b border-slate-100 py-3 last:border-b-0">
                <span className="mt-1.5 size-2 shrink-0 rounded-full bg-slate-300" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="truncate text-sm font-medium text-slate-800">{record.subject || "제목 없음"}</p>
                    <span className="text-xs font-normal text-slate-500">{formatBulkEmailStatus(record.status)}</span>
                  </div>
                  <p className="mt-1 flex items-center gap-1 text-xs font-normal text-slate-500">
                    <Users className="size-3.5" aria-hidden="true" />
                    {record.recipientCount}명 · {formatKoreanDateTime(record.scheduledAt ?? record.sentAt ?? record.updatedAt)}
                  </p>
                  {record.status === "SCHEDULED" && record.senderId === session?.userId ? <Button type="button" variant="ghost" size="sm" onClick={() => void handleCancelScheduled(record.id)} className="mt-2 px-0 text-xs font-normal text-slate-500 hover:bg-transparent hover:text-rose-600">예약 취소</Button> : null}
                </div>
              </li>
            ))}
          </ol>
        )}

        </section> : null}
      </main>



      <Modal
        open={reviewOpen}
        onClose={dismissReview}
        title="메일 발송 확인"
        mobileFullscreen
        size="standard"
        bodyClassName="space-y-5"
        footer={
          <div className="email-review-footer flex w-full flex-wrap items-center gap-2">
            <Button type="button" variant="outline" onClick={dismissReview} disabled={sending}>취소</Button>
            <Button loading={sending} type="button" onClick={() => void handleConfirmSend()} disabled={sending || !reviewPreview} className="min-w-20">보내기</Button>
          </div>
        }
      >
        {reviewPreview ? (
          <div className="space-y-5">

            <section className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
              <dl className="grid grid-cols-[4.5rem_minmax(0,1fr)] items-start gap-x-3 gap-y-2">
                <dt className="leading-6 text-slate-500">받는 사람</dt>
                <dd className="min-w-0 leading-6 text-slate-800">{[...(recipientType !== "ALL" || activeFilterChips.length === 0 ? [selectedRecipientLabel] : []), ...activeFilterEntries.map((entry) => entry.tokenLabel)].join(", ")} <span className="whitespace-nowrap font-semibold">· 총 {reviewPreview.recipientCount}명</span></dd>
                <dt className="leading-6 text-slate-500">발송 방식</dt><dd className="leading-6">{deliveryMode === "now" ? "즉시 발송" : "예약 발송"}</dd>
              </dl>
              <div className="mt-3 max-h-28 overflow-y-auto border-t border-slate-200 pt-3 text-xs leading-6 text-slate-600" aria-label="받는 사람 명단">
                {reviewPreview.sample.map((sample) => <div key={sample.email} className="break-all">{sample.nameKo} &lt;{sample.email}&gt;</div>)}
                {reviewPreview.recipientCount > reviewPreview.sample.length ? <p>외 {reviewPreview.recipientCount - reviewPreview.sample.length}명</p> : null}
              </div>
            </section>
            <section className="overflow-hidden rounded-xl border border-slate-200 bg-white" aria-label="미리보기">
              <dl className="grid grid-cols-[4.5rem_minmax(0,1fr)] gap-x-3 gap-y-2 border-b border-slate-100 p-4 text-sm">
                <dt className="text-slate-500">제목</dt><dd className="break-words font-medium">{previewSubject}</dd>
                <dt className="text-slate-500">받는 사람</dt><dd className="break-all">{previewVariables.이름} &lt;{previewVariables.이메일}&gt;</dd>
              </dl>
              <div className="max-h-72 overflow-y-auto p-4"><RichTextContent content={previewContent} className="text-sm leading-6 text-slate-700" /></div>
            </section>
            <fieldset className="space-y-2">
              <legend className="text-xs font-medium text-slate-500">발송 방식</legend>
              <div className="flex flex-wrap gap-4 text-sm font-normal text-slate-700">
                <label className="inline-flex items-center gap-2"><input type="radio" name="delivery-mode" checked={deliveryMode === "now"} onChange={() => setDeliveryMode("now")} className="accent-emerald-700" />즉시 발송</label>
                <label className="inline-flex items-center gap-2"><input type="radio" name="delivery-mode" checked={deliveryMode === "scheduled"} onChange={() => setDeliveryMode("scheduled")} className="accent-emerald-700" />예약 발송</label>
              </div>
              <div className="email-schedule-panel" data-open={deliveryMode === "scheduled"} inert={deliveryMode !== "scheduled"}><div className="min-h-0 overflow-hidden">
                <AdminFormField label="예약 일시" className="max-w-xs">
                  <div className="relative">
                    <CalendarClock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                    <UiInput spellCheck={false} type="datetime-local" value={scheduledAt} min={isoToHtmlDatetimeLocal(msToIso(nowMs() + 60_000))} onChange={(event) => setScheduledAt(event.target.value)} className="w-full pl-9 text-sm font-normal" />
                  </div>
                </AdminFormField>
              </div></div>
            </fieldset>
            {attachments.length ? <p className="text-xs font-normal text-slate-500">첨부 파일 {attachments.length}개</p> : null}
          </div>
        ) : null}
      </Modal>
    </AdminPageShell>
  );
}

function RecipientToken({ label, onRemove }: { label: string; onRemove?: () => void }) {
  return (
    <span className="inline-flex h-7 max-w-full items-center gap-1 rounded-full border border-slate-200/70 bg-slate-100 px-2.5 text-xs font-medium text-slate-700">
      <span className="max-w-[16rem] truncate">{label}</span>
      {onRemove ? <Button type="button" variant="ghost" size="icon" aria-label={`${label} 제거`} onClick={onRemove} className="size-6 min-h-0 min-w-0 rounded-full text-slate-400 hover:bg-slate-200 hover:text-slate-700">
        <X aria-hidden="true" />
      </Button> : null}
    </span>
  );
}

function readStoredEmailDraft(storageKey: string | null): StoredEmailDraft | null {
  if (typeof window === "undefined") return null;
  if (!storageKey) return null;

  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;

    const draft = parsed as Partial<StoredEmailDraft>;
    if (
      typeof draft.subject !== "string" ||
      typeof draft.content !== "string" ||
      typeof draft.savedAt !== "string" ||
      !isRecipientType(draft.recipientType) ||
      !isContentType(draft.contentType) ||
      !draft.filters ||
      typeof draft.filters !== "object"
    ) {
      return null;
    }

    return {
      subject: draft.subject,
      content: draft.content,
      contentType: draft.contentType,
      recipientType: draft.recipientType,
      filters: normalizeFilters(draft.filters as RecipientFilters),
      savedAt: draft.savedAt,
      attachments: Array.isArray(draft.attachments) ? draft.attachments.filter((file): file is AttachmentView => Boolean(file && typeof file.assetId === "string" && /^\d+$/.test(file.assetId) && typeof file.filename === "string" && typeof file.mimeType === "string" && typeof file.sizeBytes === "number")).slice(0, 10) : [],
    };
  } catch {
    return null;
  }
}

function isRecipientType(value: unknown): value is SendBulkEmailRequest["recipientType"] {
  return value === "ALL" || value === "PAID_STUDENTS" || value === "UNPAID_STUDENTS";
}

function isContentType(value: unknown): value is SendBulkEmailRequest["contentType"] {
  return value === "plain" || value === "html";
}

function formatStudentNumberFilter(value: string | undefined): string | undefined {
  if (!value) return undefined;
  if (/^20\d{2}_OR_EARLIER$/.test(value)) return `${value.slice(2, 4)}학번 이전`;
  if (/^20\d{2}$/.test(value)) return `${value.slice(2)}학번`;
  return value;
}

function renderEmailTemplate(
  content: string,
  variables: { 이름: string; 학번: string; 이메일: string },
): string {
  const values: Record<string, string> = variables;
  return content
    .replace(/\{\{\s*([^{}]+?)\s*\}\}/g, (match, key: string) => values[key.trim()] ?? match)
    .replace(/\{(이름|학번|이메일)\}/g, (match, key: string) => values[key] ?? match);
}

function normalizeFilters(filters: RecipientFilters): RecipientFilters {
  return Object.fromEntries(Object.entries(filters).filter(([, value]) => Boolean(value?.trim()))) as RecipientFilters;
}

function formatBulkEmailStatus(status: BulkEmailRecord["status"]): string {
  switch (status) {
    case "SUCCESS":
      return "발송 완료";
    case "SCHEDULED":
      return "예약 중";
    case "DRY_RUN":
      return "테스트 발송";
    case "SENDING":
      return "전송 확인 중";
    case "UNKNOWN":
      return "전송 결과 확인 필요";
    default:
      return "처리 기록";
  }
}
