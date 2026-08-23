import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import { createApiClient } from "@soc/api-client";
import type {
  BulkEmailPreviewResponse,
  BulkEmailRecord,
  BulkEmailTemplate,
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
import {
  CalendarClock,
  ChevronDown,
  ChevronRight,
  FileText,
  History,
  Plus,
  Rocket,
  Trash2,
  Users,
  X,
} from "lucide-react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";

import { AuthGuard } from "@/components/guards/auth-guard";
import { RichTextEditor } from "@/components/organisms/rich-text-editor";
import { RichTextContent } from "@/components/ui/rich-text-content";
import { AdminFormField, AdminPageShell } from "@/components/ui/admin-page";
import { Button } from "@/components/ui/button";
import { DraftRestoredBanner } from "@/components/ui/draft-restored-banner";
import { Modal } from "@/components/ui/modal";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { UiInput, UiTextarea } from "@/components/ui/form-control";
import { Permissions } from "@/lib/permissions";
import { resolveApiBaseUrl } from "@/lib/api-base-url";

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

const EMAIL_DRAFT_STORAGE_KEY = "soc:admin:bulk-email:draft";

type StoredEmailDraft = {
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

const RECIPIENT_FILTER_GROUPS: ReadonlyArray<{
  label: string;
  options: ReadonlyArray<RecipientFilterMenuOption>;
}> = [
  {
    label: "학번",
    options: [
      { kind: "filter", key: "studentNumber", value: "2026", label: "26학번" },
      { kind: "filter", key: "studentNumber", value: "2025", label: "25학번" },
      {
        kind: "filter",
        key: "studentNumber",
        value: "2024_OR_EARLIER",
        label: "24학번 이전",
      },
    ],
  },
  {
    label: "학과 구분",
    options: [
      { kind: "filter", key: "primaryMajor", value: "전산학부", label: "전산학부 주전공" },
      { kind: "filter", key: "doubleMajor", value: "전산학부", label: "전산학부 복수전공" },
      { kind: "filter", key: "minor", value: "전산학부", label: "전산학부 부전공" },
    ],
  },
  {
    label: "과비 납부",
    options: [
      { kind: "recipientType", value: "PAID_STUDENTS", label: "납부" },
      { kind: "recipientType", value: "UNPAID_STUDENTS", label: "미납부" },
      { kind: "recipientType", value: "ALL", label: "전체 학생" },
    ],
  },
  {
    label: "학적",
    options: [
      { kind: "filter", key: "academicStatus", value: "재학", label: "재학" },
      { kind: "filter", key: "academicStatus", value: "졸업", label: "졸업" },
    ],
  },
];

type AttachmentView = {
  assetId: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
};

const EXECUTION_HISTORY_STATUSES = new Set<BulkEmailRecord["status"]>([
  "SUCCESS",
  "SCHEDULED",
  "DRY_RUN",
]);

export function BulkEmailPage() {
  return (
    <AuthGuard requirePermission={Permissions.ADMIN}>
      <BulkEmailPageContent />
    </AuthGuard>
  );
}

function BulkEmailPageContent() {
  const apiClient = useMemo(() => createApiClient({ baseUrl: resolveApiBaseUrl() }), []);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const idempotencyKeyRef = useRef<string | null>(null);

  const [templates, setTemplates] = useState<BulkEmailTemplate[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(true);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [templateSaveOpen, setTemplateSaveOpen] = useState(false);
  const [templateSearch, setTemplateSearch] = useState("");
  const [templateName, setTemplateName] = useState("");
  const [templateDescription, setTemplateDescription] = useState("");
  const [templateSaving, setTemplateSaving] = useState(false);

  const [initialLocalDraft] = useState<StoredEmailDraft | null>(() => readStoredEmailDraft());
  const [draftRestored, setDraftRestored] = useState(false);
  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(null);
  const [draftNoticeVisible, setDraftNoticeVisible] = useState(false);
  const [draftReady, setDraftReady] = useState(false);
  const draftClearedRef = useRef(false);
  const skipNextDraftSaveRef = useRef(false);

  const [recipientType, setRecipientType] = useState<SendBulkEmailRequest["recipientType"]>(
    "UNPAID_STUDENTS",
  );
  const [filters, setFilters] = useState<RecipientFilters>({});
  const [recipientMenuOpen, setRecipientMenuOpen] = useState(false);
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
  const [recipientListOpen, setRecipientListOpen] = useState(false);
  const [deliveryMode, setDeliveryMode] = useState<DeliveryMode>("now");
  const [scheduledAt, setScheduledAt] = useState("");
  const [sending, setSending] = useState(false);
  const [testSending, setTestSending] = useState(false);

  const [history, setHistory] = useState<BulkEmailRecord[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);

  const [operationError, setOperationError] = useState<string | null>(null);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);

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

    add("studentNumber", "학번", formatStudentNumberFilter(filters.studentNumber));
    add("academicStatus", "학적", filters.academicStatus);
    add("primaryMajor", "주전공", filters.primaryMajor, `${filters.primaryMajor ?? ""} 주전공`);
    add("doubleMajor", "복수전공", filters.doubleMajor, `${filters.doubleMajor ?? ""} 복수전공`);
    add("minor", "부전공", filters.minor, `${filters.minor ?? ""} 부전공`);
    add("query", "검색", filters.query, `검색: ${filters.query ?? ""}`);
    return entries;
  }, [filters]);
  const filteredTemplates = useMemo(() => {
    const query = templateSearch.trim().toLocaleLowerCase();
    if (!query) return templates;
    return templates.filter((template) =>
      `${template.name} ${template.description ?? ""}`.toLocaleLowerCase().includes(query),
    );
  }, [templateSearch, templates]);
  const selectedRecipientLabel =
    RECIPIENT_TYPES.find((option) => option.value === recipientType)?.label ?? "수신 대상";
  const previewRecipient = reviewPreview?.sample[0];
  const previewContent = renderEmailTemplate(content, {
    이름: previewRecipient?.nameKo || "학우",
    학번: previewRecipient?.studentNumber ?? "",
    이메일: previewRecipient?.email ?? "",
    전화번호: previewRecipient?.phoneNumber ?? "",
  });

  const applyTemplateToForm = (template: BulkEmailTemplate) => {
    setSelectedTemplateId(template.id);
    setRecipientType(template.recipientType);
    setSubject(template.subject);
    setContent(template.content);
    setContentType(template.contentType);
    setFilters(template.filters ?? {});
    setScheduledAt("");
    setAttachments([]);
    setTemplateName("");
    setTemplateDescription("");
    setOperationError(null);
  };

  const applyLocalDraftToForm = (draft: StoredEmailDraft) => {
    skipNextDraftSaveRef.current = true;
    setSelectedTemplateId("");
    setRecipientType(draft.recipientType);
    setSubject(draft.subject);
    setContent(draft.content);
    setContentType(draft.contentType);
    setFilters(draft.filters ?? {});
    setScheduledAt("");
    setAttachments([]);
    setTemplateName("");
    setTemplateDescription("");
    setOperationError(null);
    setDraftRestored(true);
    setDraftSavedAt(draft.savedAt);
    setDraftNoticeVisible(true);
  };

  useEffect(() => {
    let mounted = true;
    if (initialLocalDraft) applyLocalDraftToForm(initialLocalDraft);

    const loadInitialData = async () => {
      try {
        const templateResponse = await apiClient.getBulkEmailTemplates();
        if (!mounted) return;

        setTemplates(templateResponse.items);
        const defaultTemplate =
          templateResponse.items.find((template) => template.id === "f26-unpaid-reminder") ??
          templateResponse.items[0];
        if (!initialLocalDraft && defaultTemplate) {
          skipNextDraftSaveRef.current = true;
          applyTemplateToForm(defaultTemplate);
        }
      } catch {
        if (!mounted) return;
        setOperationError("템플릿을 불러오지 못했습니다.");
      }
      if (mounted) {
        setTemplatesLoading(false);
        setDraftReady(true);
      }
    };
    void loadInitialData();
    return () => {
      mounted = false;
    };
  }, [apiClient, initialLocalDraft]);

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
    if (!draftReady) return;
    if (skipNextDraftSaveRef.current) {
      skipNextDraftSaveRef.current = false;
      return;
    }

    const hasDraftContent = Boolean(
      subject.trim() || content.trim() || Object.keys(normalizeFilters(filters)).length,
    );
    if (draftClearedRef.current && !hasDraftContent) return;
    if (draftClearedRef.current) draftClearedRef.current = false;

    const timer = window.setTimeout(() => {
      const savedAt = msToIso(nowMs());
      const draft: StoredEmailDraft = {
        content,
        contentType,
        filters: normalizeFilters(filters),
        recipientType,
        savedAt,
        subject,
      };
      try {
        window.localStorage.setItem(EMAIL_DRAFT_STORAGE_KEY, JSON.stringify(draft));
        if (draftRestored) setDraftSavedAt(savedAt);
      } catch {
        // Storage can be unavailable in private browsing; the editor remains usable.
      }
    }, 500);

    return () => window.clearTimeout(timer);
  }, [content, contentType, draftReady, draftRestored, filters, recipientType, subject]);

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

  const validateMessage = () => {
    if (!subject.trim() || !content.trim()) {
      setOperationError("제목과 본문을 입력해 주세요.");
      return false;
    }
    if (deliveryMode === "scheduled" && !scheduledAt) {
      setOperationError("예약 발송 일시를 선택해 주세요.");
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
      setRecipientListOpen(false);
      setReviewOpen(true);
    } catch {
      setOperationError("발송 전 수신 대상을 확인하지 못했습니다.");
    } finally {
      setSending(false);
    }
  };

  const clearStoredDraft = () => {
    try {
      window.localStorage.removeItem(EMAIL_DRAFT_STORAGE_KEY);
    } catch {
      // Storage can be unavailable in private browsing; continue clearing the form.
    }
    draftClearedRef.current = true;
    setDraftRestored(false);
    setDraftSavedAt(null);
    setDraftNoticeVisible(false);
  };

  const handleStartNew = () => {
    clearStoredDraft();
    setSelectedTemplateId("");
    setRecipientType("ALL");
    setFilters({});
    setSubject("");
    setContent("");
    setContentType("html");
    setAttachments([]);
    setScheduledAt("");
    setRecipientMenuOpen(false);
    setOperationError(null);
    setStatusNotice(null);
  };

  const handleRecipientMenuSelect = (option: RecipientFilterMenuOption) => {
    if (option.kind === "recipientType") {
      setRecipientType(option.value);
    } else {
      setFilters((previous) => ({ ...previous, [option.key]: option.value }));
    }
    setRecipientMenuOpen(false);
    setOperationError(null);
  };

  const handleConfirmSend = async () => {
    if (!reviewPreview) return;
    if (!validateMessage()) return;
    try {
      setSending(true);
      setOperationError(null);
      idempotencyKeyRef.current ??= crypto.randomUUID();
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

  const handleTestSend = async () => {
    if (!validateMessage()) return;
    try {
      setTestSending(true);
      setOperationError(null);
      const response = await apiClient.sendBulkEmailTest(
        buildRequest({ includeSchedule: false }),
      );
      setStatusNotice(`내 계정(${response.recipientEmail})으로 테스트 메일을 보냈습니다.`);
    } catch {
      setOperationError("테스트 메일 발송에 실패했습니다.");
    } finally {
      setTestSending(false);
    }
  };

  const handleSaveTemplate = async () => {
    if (!templateName.trim() || !subject.trim() || !content.trim()) {
      setOperationError("템플릿 이름과 제목, 본문을 입력해 주세요.");
      return;
    }
    try {
      setTemplateSaving(true);
      setOperationError(null);
      const templateInput = {
        name: templateName.trim(),
        description: templateDescription.trim() || undefined,
        subject: subject.trim(),
        content,
        contentType,
        recipientType,
        filters: normalizeFilters(filters),
      };
      const selectedTemplate = templates.find((template) => template.id === selectedTemplateId);
      const saved = selectedTemplate?.createdBy
        ? await apiClient.updateBulkEmailTemplate(selectedTemplate.id, templateInput)
        : await apiClient.createBulkEmailTemplate(templateInput);
      setSelectedTemplateId(saved.id);
      setTemplates((previous) => [
        ...previous.filter((template) => template.id !== saved.id),
        saved,
      ]);
      setTemplateSaveOpen(false);
      setStatusNotice("템플릿을 저장했습니다.");
    } catch {
      setOperationError("템플릿 저장에 실패했습니다.");
    } finally {
      setTemplateSaving(false);
    }
  };

  const handleDeleteTemplate = async (templateId: string) => {
    const template = templates.find((item) => item.id === templateId);
    if (!template?.createdBy) return;
    try {
      setTemplateSaving(true);
      await apiClient.deleteBulkEmailTemplate(templateId);
      setTemplates((previous) => previous.filter((item) => item.id !== templateId));
      if (selectedTemplateId === templateId) setSelectedTemplateId("");
    } catch {
      setOperationError("템플릿 삭제에 실패했습니다.");
    } finally {
      setTemplateSaving(false);
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
    try {
      setUploading(true);
      setOperationError(null);
      const uploaded = await Promise.all(files.map((file) => apiClient.uploadAsset(file)));
      setAttachments((previous) =>
        [
          ...previous,
          ...uploaded.map((asset) => ({
            assetId: asset.assetId,
            filename: asset.originalFilename,
            mimeType: asset.mimeType,
            sizeBytes: asset.sizeBytes,
          })),
        ].slice(0, 10),
      );
    } catch {
      setOperationError("첨부파일을 업로드하지 못했습니다.");
    } finally {
      setUploading(false);
    }
  };

  const dismissReview = () => {
    if (sending || testSending) return;
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
      itemClassName="!h-8 !min-h-8 !rounded-md !px-3 !text-xs"
      options={[
        { value: "editor" as const, label: "에디터" },
        { value: "preview" as const, label: "미리보기" },
        { value: "html" as const, label: "HTML" },
      ]}
    />
  );

  return (
    <AdminPageShell className="email-composer-page min-h-screen !bg-slate-50">
      <main className="w-full px-5 pb-16 md:px-8">
        <header className="email-composer-header mx-auto mt-6 flex w-full max-w-5xl items-center justify-end gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:p-5">
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={openHistory}>
              <History aria-hidden="true" />
              발송 이력
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setTemplateSaveOpen(false);
                setTemplateSearch("");
                setTemplateModalOpen(true);
              }}
            >
              <FileText aria-hidden="true" />
              템플릿
            </Button>
            <Button form="bulk-email-compose" type="submit" size="sm" disabled={sending || templatesLoading}>
              <Rocket aria-hidden="true" />
              {sending ? "검토 중…" : "검토 및 발송"}
            </Button>
          </div>
        </header>

        {operationError ? (
          <div className="mx-auto mt-4 w-full max-w-5xl rounded-lg bg-rose-50 px-4 py-3 text-sm font-normal text-rose-700" role="alert">
            {operationError}
          </div>
        ) : null}
        {statusNotice ? (
          <div className="mx-auto mt-4 w-full max-w-5xl rounded-lg bg-emerald-50 px-4 py-3 text-sm font-normal text-emerald-700" role="status">
            {statusNotice}
          </div>
        ) : null}

        <form id="bulk-email-compose" className="mx-auto mt-6 w-full max-w-5xl" onSubmit={(event) => void handleReview(event)}>
          <div className="email-composer-canvas rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
            {draftRestored && draftSavedAt && draftNoticeVisible ? (
              <DraftRestoredBanner
                className="mb-5"
                savedAt={draftSavedAt}
                onStartNew={handleStartNew}
                onDismiss={() => setDraftNoticeVisible(false)}
              />
            ) : null}
            <section className="border-b border-slate-100 pb-5" aria-label="수신 대상">
              <div className="flex min-h-10 items-center justify-between gap-4">
                <div className="flex min-w-0 flex-wrap items-center gap-2.5">
                  <span className="shrink-0 text-sm font-medium text-slate-600">받는 사람:</span>
                  <RecipientToken label={selectedRecipientLabel} onRemove={() => setRecipientType("ALL")} />
                  {activeFilterEntries.map((entry) => (
                    <RecipientToken
                      key={entry.key}
                      label={entry.tokenLabel}
                      onRemove={() => setFilters((previous) => ({ ...previous, [entry.key]: undefined }))}
                    />
                  ))}
                  <DropdownMenu.Root modal={false} open={recipientMenuOpen} onOpenChange={setRecipientMenuOpen}>
                    <DropdownMenu.Trigger asChild>
                      <Button type="button" variant="ghost" size="sm" className="shrink-0 text-slate-500">
                        <Plus aria-hidden="true" />
                        필터 추가
                        <ChevronDown aria-hidden="true" />
                      </Button>
                    </DropdownMenu.Trigger>
                    <DropdownMenu.Portal>
                      <DropdownMenu.Content
                        side="bottom"
                        align="start"
                        sideOffset={8}
                        collisionPadding={12}
                        className="z-[100] min-w-48 rounded-xl border border-slate-200 bg-white p-1.5 shadow-[0_16px_40px_rgb(15_23_42_/_0.14)]"
                      >
                        {RECIPIENT_FILTER_GROUPS.map((group) => (
                          <DropdownMenu.Sub key={group.label}>
                            <DropdownMenu.SubTrigger className="flex h-9 w-full items-center justify-between rounded-md px-2.5 text-sm font-normal text-slate-700 outline-none data-[highlighted]:bg-slate-100 data-[state=open]:bg-slate-100">
                              {group.label}
                              <ChevronRight aria-hidden="true" className="size-4 text-slate-400" />
                            </DropdownMenu.SubTrigger>
                            <DropdownMenu.Portal>
                              <DropdownMenu.SubContent
                                align="start"
                                sideOffset={6}
                                collisionPadding={12}
                                className="z-[101] min-w-48 rounded-xl border border-slate-200 bg-white p-1.5 shadow-[0_16px_40px_rgb(15_23_42_/_0.14)]"
                              >
                                {group.options.map((option) => (
                                  <DropdownMenu.Item
                                    key={`${option.kind}-${option.label}`}
                                    onSelect={() => handleRecipientMenuSelect(option)}
                                    className="flex h-9 cursor-pointer items-center rounded-md px-2.5 text-sm font-normal text-slate-700 outline-none data-[highlighted]:bg-slate-100"
                                  >
                                    {option.label}
                                  </DropdownMenu.Item>
                                ))}
                              </DropdownMenu.SubContent>
                            </DropdownMenu.Portal>
                          </DropdownMenu.Sub>
                        ))}
                      </DropdownMenu.Content>
                    </DropdownMenu.Portal>
                  </DropdownMenu.Root>
                </div>
                <span className="shrink-0 whitespace-nowrap text-sm font-normal text-slate-500">
                  수신 대상: {recipientCountLoading ? "계산 중…" : recipientCount === null ? "—" : `총 ${recipientCount}명`}
                </span>
              </div>
            </section>

          <section className="pb-8 pt-6 md:pt-7">
            <UiInput
              aria-label="메일 제목"
              spellCheck={false}
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              maxLength={255}
              placeholder="제목을 입력하세요"
              required
              className="!h-auto !rounded-none border-0 bg-transparent px-0 py-4 text-2xl font-bold leading-tight text-slate-800 shadow-none focus:border-0 focus:outline-none focus:ring-0 placeholder:text-slate-300 md:text-[30px]"
            />
            {editorMode === "editor" ? (
              <div className="mt-2 min-w-0 overflow-hidden">
                <RichTextEditor
                  className="email-composer-editor max-w-none"
                  content={content}
                  fileInputRef={fileInputRef}
                  lang="ko"
                  onChange={(value) => {
                    setContent(value);
                    setContentType("html");
                  }}
                  placeholder="본문을 입력하세요"
                  spellCheck={false}
                  toolbarVariant="email"
                  uploading={uploading}
                  variableOptions={[
                    { label: "{이름}", token: "{{이름}}" },
                    { label: "{이메일}", token: "{{이메일}}" },
                    { label: "{전화번호}", token: "{{전화번호}}" },
                    { label: "{학번}", token: "{{학번}}" },
                  ]}
                  toolbarSuffix={editorModeTabs}
                />
              </div>
            ) : editorMode === "preview" ? (
              <>
                <div className="email-composer-mode-toolbar mt-2 flex items-center justify-end border-y border-slate-100">
                  {editorModeTabs}
                </div>
                <div className="tiptap-container min-h-[400px] px-6 py-6 prose prose-slate">
                  {content.trim() ? (
                    <RichTextContent content={previewContent} className="text-[15px] leading-7 text-slate-800" />
                  ) : (
                    <p className="text-[15px] font-normal text-slate-400">본문을 입력하세요</p>
                  )}
                </div>
              </>
            ) : (
              <>
                <div className="email-composer-mode-toolbar mt-2 flex items-center justify-end border-y border-slate-100">
                  {editorModeTabs}
                </div>
                <UiTextarea
                  aria-label="HTML 본문"
                  value={content}
                  onChange={(event) => {
                    setContent(event.target.value);
                    setContentType("html");
                  }}
                  spellCheck={false}
                  className="min-h-[400px] w-full resize-y rounded-none border-0 bg-transparent px-6 py-6 font-mono text-sm font-normal leading-6 text-slate-700 shadow-none focus:border-0 focus:ring-0"
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
              <ul className="mt-4 flex flex-wrap gap-2" aria-label="첨부파일">
                {attachments.map((attachment) => (
                  <li key={attachment.assetId} className="inline-flex max-w-full items-center gap-2 rounded-md bg-slate-100 px-2.5 py-1.5 text-xs font-normal text-slate-600">
                    <span className="max-w-[18rem] truncate">{attachment.filename}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`${attachment.filename} 첨부 제거`}
                      onClick={() => setAttachments((previous) => previous.filter((item) => item.assetId !== attachment.assetId))}
                      className="size-5 rounded text-slate-400 hover:bg-slate-200"
                    >
                      <X aria-hidden="true" />
                    </Button>
                  </li>
                ))}
              </ul>
            ) : null}
          </section>
          </div>
        </form>
      </main>

      <Modal
        open={templateModalOpen}
        onClose={() => setTemplateModalOpen(false)}
        title="템플릿 양식 선택"
        className="max-w-2xl"
      >
        <div className="space-y-5">
          <div className="flex items-center gap-2">
            <UiInput
              aria-label="템플릿 검색"
              spellCheck={false}
              value={templateSearch}
              onChange={(event) => setTemplateSearch(event.target.value)}
              placeholder="템플릿 검색"
              className="h-9 min-w-0 flex-1 text-sm font-normal"
            />
            <Button type="button" variant="outline" size="sm" onClick={() => setTemplateSaveOpen((open) => !open)} className="shrink-0">
              <Plus aria-hidden="true" />
              현재 작성 내용을 새 템플릿으로 저장
            </Button>
          </div>
          {templateSaveOpen ? (
            <div className="grid gap-3 rounded-lg bg-slate-50 p-3 sm:grid-cols-2">
              <AdminFormField label="템플릿 이름">
                <UiInput spellCheck={false} value={templateName} onChange={(event) => setTemplateName(event.target.value)} placeholder="템플릿 이름" maxLength={100} className="h-9 text-sm font-normal" />
              </AdminFormField>
              <AdminFormField label="설명 (선택)">
                <UiInput spellCheck={false} value={templateDescription} onChange={(event) => setTemplateDescription(event.target.value)} placeholder="설명" maxLength={255} className="h-9 text-sm font-normal" />
              </AdminFormField>
              <div className="flex justify-end gap-2 sm:col-span-2">
                <Button type="button" variant="ghost" size="sm" onClick={() => setTemplateSaveOpen(false)}>취소</Button>
                <Button type="button" size="sm" onClick={() => void handleSaveTemplate()} disabled={templateSaving}>{templateSaving ? "저장 중…" : "저장"}</Button>
              </div>
            </div>
          ) : null}
          <section>
            <h3 className="mb-2 text-sm font-semibold text-slate-800">저장된 양식</h3>
            {templatesLoading ? (
              <p className="py-6 text-center text-sm font-normal text-slate-500">불러오는 중…</p>
            ) : templates.length === 0 ? (
              <p className="py-6 text-center text-sm font-normal text-slate-500">저장된 양식이 없습니다.</p>
            ) : filteredTemplates.length === 0 ? (
              <p className="py-6 text-center text-sm font-normal text-slate-500">검색 결과가 없습니다.</p>
            ) : (
              <div className="divide-y divide-slate-100 rounded-lg border border-slate-200">
                {filteredTemplates.map((template) => (
                  <div key={template.id} className="group flex items-center gap-3 px-3 py-3 transition-colors hover:bg-slate-50">
                    <button
                      type="button"
                      onClick={() => {
                        applyTemplateToForm(template);
                        setTemplateModalOpen(false);
                      }}
                      className="min-w-0 flex-1 text-left outline-none"
                    >
                      <p className="truncate text-sm font-medium text-slate-800">{template.name}</p>
                      {template.description ? <p className="mt-0.5 truncate text-xs font-normal text-slate-500">{template.description}</p> : null}
                    </button>
                    {template.createdBy ? (
                      <Button type="button" variant="ghost" size="icon" aria-label={`${template.name} 삭제`} title="템플릿 삭제" onClick={() => void handleDeleteTemplate(template.id)} disabled={templateSaving} className="size-8 text-slate-400 hover:bg-rose-50 hover:text-rose-600">
                        <Trash2 aria-hidden="true" />
                      </Button>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </Modal>

      <Modal
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        title="발송 이력"
        className="max-w-2xl"
        footer={<Button type="button" variant="outline" onClick={() => setHistoryOpen(false)}>닫기</Button>}
      >
        {historyLoading ? (
          <p className="py-8 text-center text-sm font-normal text-slate-500">불러오는 중…</p>
        ) : historyError ? (
          <p className="py-8 text-center text-sm font-normal text-rose-600">{historyError}</p>
        ) : history.length === 0 ? (
          <p className="py-8 text-center text-sm font-normal text-slate-500">발송 이력이 없습니다.</p>
        ) : (
          <ol className="scrollbar-hidden max-h-[min(60vh,36rem)] overflow-y-auto pr-2">
            {history.map((record) => (
              <li key={record.id} className="flex gap-3 border-b border-slate-100 py-4 first:pt-0 last:border-b-0">
                <span className="mt-1.5 size-2 shrink-0 rounded-full bg-emerald-500" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="truncate text-sm font-medium text-slate-800">{record.subject || "제목 없음"}</p>
                    <span className="text-xs font-normal text-slate-500">{formatBulkEmailStatus(record.status)}</span>
                  </div>
                  <p className="mt-1 flex items-center gap-1 text-xs font-normal text-slate-500">
                    <Users className="size-3.5" aria-hidden="true" />
                    {record.recipientCount}명 · {formatKoreanDateTime(record.scheduledAt ?? record.sentAt ?? record.updatedAt)}
                  </p>
                  {record.status === "SCHEDULED" ? <Button type="button" variant="ghost" size="sm" onClick={() => void handleCancelScheduled(record.id)} className="mt-2 px-0 text-xs font-normal text-slate-500 hover:bg-transparent hover:text-rose-600">예약 취소</Button> : null}
                </div>
              </li>
            ))}
          </ol>
        )}
      </Modal>

      <Modal
        open={reviewOpen}
        onClose={dismissReview}
        title="메일 발송 전 최종 검토"
        className="max-w-2xl"
        footer={
          <>
            <Button type="button" variant="ghost" onClick={() => void handleTestSend()} disabled={sending || testSending} className="mr-auto">
              {testSending ? "테스트 발송 중…" : "내 계정으로 테스트 발송"}
            </Button>
            <Button type="button" variant="outline" onClick={dismissReview} disabled={sending || testSending}>취소</Button>
            <Button type="button" onClick={() => void handleConfirmSend()} disabled={sending || !reviewPreview}>{sending ? "발송 중…" : "최종 발송 확정"}</Button>
          </>
        }
      >
        {reviewPreview ? (
          <div className="space-y-5">
            <dl className="divide-y divide-slate-100 text-sm">
              <div className="grid grid-cols-[5rem_1fr] gap-3 py-2 first:pt-0">
                <dt className="text-slate-500">발송 대상</dt>
                <dd className="font-medium text-slate-800">
                  {selectedRecipientLabel} · 총 {reviewPreview.recipientCount}명{" "}
                  <Button type="button" variant="link" size="sm" onClick={() => setRecipientListOpen((open) => !open)} className="ml-2 h-auto p-0 text-xs font-normal text-slate-500">
                    {recipientListOpen ? "명단 닫기" : "명단 확인"}
                  </Button>
                  {activeFilterEntries.length ? <span className="mt-1 block text-xs font-normal text-slate-500">{activeFilterEntries.map((entry) => `${entry.label}: ${entry.value}`).join(" · ")}</span> : null}
                  {recipientListOpen && reviewPreview.sample.length ? <div className="mt-2 flex flex-wrap gap-1.5">{reviewPreview.sample.map((sample) => <span key={sample.email} className="rounded-md bg-slate-100 px-2 py-1 text-xs font-normal text-slate-600">{sample.nameKo}{sample.studentNumber ? ` · ${sample.studentNumber}` : ""} · {sample.email}</span>)}</div> : null}
                </dd>
              </div>
              <div className="grid grid-cols-[5rem_1fr] gap-3 py-2">
                <dt className="text-slate-500">제목</dt>
                <dd className="font-medium text-slate-800">{subject}</dd>
              </div>
            </dl>
            <section>
              <h3 className="mb-2 text-xs font-medium text-slate-500">치환자 미리보기</h3>
              <div className="scrollbar-hidden max-h-48 overflow-y-auto rounded-lg bg-slate-50 px-3 py-3">
                <RichTextContent content={previewContent} className="text-sm leading-6 text-slate-700" />
              </div>
            </section>
            <fieldset className="space-y-2">
              <legend className="text-xs font-medium text-slate-500">발송 방식</legend>
              <div className="flex flex-wrap gap-4 text-sm font-normal text-slate-700">
                <label className="inline-flex items-center gap-2"><input type="radio" name="delivery-mode" checked={deliveryMode === "now"} onChange={() => setDeliveryMode("now")} className="accent-emerald-700" />즉시 발송</label>
                <label className="inline-flex items-center gap-2"><input type="radio" name="delivery-mode" checked={deliveryMode === "scheduled"} onChange={() => setDeliveryMode("scheduled")} className="accent-emerald-700" />예약 발송</label>
              </div>
              {deliveryMode === "scheduled" ? (
                <AdminFormField label="예약 일시" className="max-w-xs">
                  <div className="relative">
                    <CalendarClock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                    <UiInput spellCheck={false} type="datetime-local" value={scheduledAt} min={isoToHtmlDatetimeLocal(msToIso(nowMs() + 60_000))} onChange={(event) => setScheduledAt(event.target.value)} className="w-full pl-9 text-sm font-normal" />
                  </div>
                </AdminFormField>
              ) : null}
            </fieldset>
            {attachments.length ? <p className="text-xs font-normal text-slate-500">첨부 파일 {attachments.length}개</p> : null}
          </div>
        ) : null}
      </Modal>
    </AdminPageShell>
  );
}

function RecipientToken({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex max-w-full items-center gap-1 rounded-md border border-slate-200/80 bg-slate-100 px-2.5 py-1.5 text-xs font-medium text-slate-700">
      <span aria-hidden="true" className="text-[11px] leading-none">🏷️</span>
      <span className="max-w-[16rem] truncate">{label}</span>
      <Button type="button" variant="ghost" size="icon" aria-label={`${label} 제거`} onClick={onRemove} className="size-5 rounded text-slate-400 hover:bg-slate-200 hover:text-slate-700">
        <X aria-hidden="true" />
      </Button>
    </span>
  );
}

function readStoredEmailDraft(): StoredEmailDraft | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(EMAIL_DRAFT_STORAGE_KEY);
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
  if (value === "2024_OR_EARLIER") return "24학번 이전";
  if (/^20\d{2}$/.test(value)) return `${value.slice(2)}학번`;
  return value;
}

function renderEmailTemplate(
  content: string,
  variables: { 이름: string; 학번: string; 이메일: string; 전화번호: string },
): string {
  const values: Record<string, string> = variables;
  return content
    .replace(/\{\{\s*([^{}]+?)\s*\}\}/g, (match, key: string) => values[key.trim()] ?? match)
    .replace(/\{(이름|학번|이메일|전화번호)\}/g, (match, key: string) => values[key] ?? match);
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
    default:
      return "처리 기록";
  }
}
