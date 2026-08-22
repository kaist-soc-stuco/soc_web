import { createApiClient } from "@soc/api-client";
import type { ContentBlockRecord, ContentBlockStatus, ContentBlockType, CreateContentBlockRequest, UpdateContentBlockRequest } from "@soc/contracts";
import { htmlDatetimeLocalToIso, isoToDate, isoToHtmlDatetimeLocal } from "@soc/shared";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Archive, ExternalLink, Image, LayoutTemplate, Link2, Megaphone, Plus, Save, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { AuthGuard } from "@/components/guards/auth-guard";
import { AdminSelectDropdown } from "@/components/ui/admin-select";
import { AdminCard, AdminCardHeader, AdminFormField, AdminMetaText, AdminPageHeader, AdminPageMain, AdminPageShell, AdminSearchField, AdminSectionTitle, AdminStickyActionBar, AdminToolbar, AdminToolbarGroup } from "@/components/ui/admin-page";
import { AdminStatusBadge } from "@/components/ui/admin-status-badge";
import { Button } from "@/components/ui/button";
import { useConfirmDialog } from "@/components/ui/confirm-dialog";
import { UiInput, UiTextarea } from "@/components/ui/form-control";
import { Modal } from "@/components/ui/modal";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Skeleton } from "@/components/ui/skeleton";
import { resolveApiBaseUrl } from "@/lib/api-base-url";
import { Permissions } from "@/lib/permissions";
import { cn } from "@/lib/utils";

type StatusFilter = "ALL" | ContentBlockStatus;

interface BlockDraft {
  bodyEn: string;
  bodyKo: string;
  endsAt: string;
  imageUrl: string;
  isEnabled: boolean;
  linkUrl: string;
  sortOrder: number;
  startsAt: string;
  titleEn: string;
  titleKo: string;
  type: ContentBlockType;
}

const CONTENT_BLOCK_QUERY_KEY = ["admin", "content-blocks"] as const;

const typeMeta: Record<ContentBlockType, { label: string }> = {
  HERO: { label: "메인 히어로" },
  TOP_BANNER: { label: "상단 띠배너" },
  POPUP: { label: "팝업" },
  STATUS_NOTICE: { label: "상태 공지" },
  QUICK_LINK: { label: "퀵링크" },
};

const statusMeta: Record<ContentBlockStatus, { label: string; tone: "neutral" | "positive" | "warning" | "info" }> = {
  DRAFT: { label: "초안", tone: "neutral" },
  SCHEDULED: { label: "예약", tone: "info" },
  PUBLISHED: { label: "게시 중", tone: "positive" },
  ARCHIVED: { label: "보관", tone: "warning" },
};

const emptyDraft = (type: ContentBlockType = "HERO"): BlockDraft => ({
  bodyEn: "",
  bodyKo: "",
  endsAt: "",
  imageUrl: "",
  isEnabled: true,
  linkUrl: "",
  sortOrder: 0,
  startsAt: "",
  titleEn: "",
  titleKo: "",
  type,
});

const toLocalDateTime = (value: string | null) => {
  if (!value) return "";
  return isoToHtmlDatetimeLocal(value);
};

const toIsoDateTime = (value: string) => value ? htmlDatetimeLocalToIso(value) : null;

const draftFromBlock = (block: ContentBlockRecord): BlockDraft => ({
  bodyEn: block.bodyEn ?? "",
  bodyKo: block.bodyKo ?? "",
  endsAt: toLocalDateTime(block.endsAt),
  imageUrl: block.imageUrl ?? "",
  isEnabled: block.isEnabled,
  linkUrl: block.linkUrl ?? "",
  sortOrder: block.sortOrder,
  startsAt: toLocalDateTime(block.startsAt),
  titleEn: block.titleEn,
  titleKo: block.titleKo,
  type: block.type,
});

const normalizeDraft = (draft: BlockDraft): CreateContentBlockRequest => ({
  bodyEn: draft.bodyEn.trim() || null,
  bodyKo: draft.bodyKo.trim() || null,
  endsAt: toIsoDateTime(draft.endsAt),
  imageUrl: draft.imageUrl.trim() || null,
  isEnabled: draft.isEnabled,
  linkUrl: draft.linkUrl.trim() || null,
  sortOrder: draft.sortOrder,
  startsAt: toIsoDateTime(draft.startsAt),
  titleEn: draft.titleEn.trim(),
  titleKo: draft.titleKo.trim(),
  type: draft.type,
});

const formatDateTime = (value: string | null) => value
  ? new Intl.DateTimeFormat("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(isoToDate(value))
  : "제한 없음";

export function SiteContentPage() {
  return <AuthGuard requirePermission={Permissions.MANAGE_CONTENT}><SiteContentPageContent /></AuthGuard>;
}

function SiteContentPageContent() {
  const apiClient = useMemo(() => createApiClient({ baseUrl: resolveApiBaseUrl() }), []);
  const queryClient = useQueryClient();
  const { confirm, ConfirmDialog } = useConfirmDialog();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState<BlockDraft>(emptyDraft());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [createDraft, setCreateDraft] = useState<BlockDraft>(emptyDraft());

  const blocksQuery = useQuery({
    queryKey: CONTENT_BLOCK_QUERY_KEY,
    queryFn: () => apiClient.listAdminContentBlocks(),
  });
  const blocks = blocksQuery.data?.items ?? [];
  const selectedBlock = blocks.find((block) => block.contentBlockId === selectedId) ?? null;

  useEffect(() => {
    if (!blocks.length) {
      setSelectedId(null);
      return;
    }
    if (!selectedId || !blocks.some((block) => block.contentBlockId === selectedId)) setSelectedId(blocks[0].contentBlockId);
  }, [blocks, selectedId]);

  useEffect(() => {
    if (selectedBlock) setDraft(draftFromBlock(selectedBlock));
  }, [selectedBlock?.contentBlockId, selectedBlock?.updatedAt]);

  const filteredBlocks = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("ko-KR");
    return blocks.filter((block) => {
      if (statusFilter !== "ALL" && block.status !== statusFilter) return false;
      if (!normalizedQuery) return true;
      return `${block.titleKo} ${block.titleEn} ${typeMeta[block.type].label}`.toLocaleLowerCase("ko-KR").includes(normalizedQuery);
    });
  }, [blocks, query, statusFilter]);

  const isDirty = Boolean(selectedBlock && JSON.stringify(normalizeDraft(draft)) !== JSON.stringify(normalizeDraft(draftFromBlock(selectedBlock))));

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: CONTENT_BLOCK_QUERY_KEY });
  };

  const selectBlock = async (block: ContentBlockRecord) => {
    if (block.contentBlockId === selectedId) return;
    if (isDirty) {
      const discard = await confirm({ title: "저장하지 않은 변경 사항을 버릴까요?", confirmLabel: "변경 사항 버리기", tone: "danger" });
      if (!discard) return;
    }
    setError(null);
    setSelectedId(block.contentBlockId);
  };

  const saveBlock = async (): Promise<ContentBlockRecord | null> => {
    if (!selectedBlock || !draft.titleKo.trim()) return null;
    setSaving(true);
    setError(null);
    try {
      const updated = await apiClient.updateContentBlock(selectedBlock.contentBlockId, normalizeDraft(draft) as UpdateContentBlockRequest);
      await refresh();
      setDraft(draftFromBlock(updated));
      return updated;
    } catch {
      setError("콘텐츠 변경 사항을 저장하지 못했습니다. 입력값과 노출 기간을 확인해 주세요.");
      return null;
    } finally {
      setSaving(false);
    }
  };

  const createBlock = async () => {
    if (!createDraft.titleKo.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const created = await apiClient.createContentBlock(normalizeDraft(createDraft));
      await refresh();
      setCreateOpen(false);
      setCreateDraft(emptyDraft());
      setSelectedId(created.contentBlockId);
    } catch {
      setError("운영 콘텐츠를 만들지 못했습니다. 입력값을 확인해 주세요.");
    } finally {
      setSaving(false);
    }
  };

  const publishBlock = async () => {
    if (!selectedBlock) return;
    setSaving(true);
    setError(null);
    try {
      if (isDirty) await apiClient.updateContentBlock(selectedBlock.contentBlockId, normalizeDraft(draft));
      await apiClient.publishContentBlock(selectedBlock.contentBlockId);
      await refresh();
    } catch {
      setError("콘텐츠를 게시하지 못했습니다.");
    } finally {
      setSaving(false);
    }
  };

  const archiveBlock = async () => {
    if (!selectedBlock) return;
    const approved = await confirm({ title: "이 콘텐츠를 보관할까요?", confirmLabel: "보관하기" });
    if (!approved) return;
    setSaving(true);
    try {
      await apiClient.archiveContentBlock(selectedBlock.contentBlockId);
      await refresh();
    } catch {
      setError("콘텐츠를 보관하지 못했습니다.");
    } finally {
      setSaving(false);
    }
  };

  const deleteBlock = async () => {
    if (!selectedBlock) return;
    const approved = await confirm({ title: `‘${selectedBlock.titleKo}’을 완전히 삭제할까요?`, confirmLabel: "완전히 삭제", tone: "danger" });
    if (!approved) return;
    setSaving(true);
    try {
      await apiClient.deleteContentBlock(selectedBlock.contentBlockId);
      setSelectedId(null);
      await refresh();
    } catch {
      setError("콘텐츠를 삭제하지 못했습니다.");
    } finally {
      setSaving(false);
    }
  };

  return <AdminPageShell>
    {ConfirmDialog}
    <AdminPageMain>
      <AdminPageHeader
        title="운영 콘텐츠"
        actions={<Button type="button" onClick={() => { setCreateDraft(emptyDraft()); setCreateOpen(true); }}><Plus aria-hidden="true" /> 콘텐츠 만들기</Button>}
      />

      {error ? <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">{error}</div> : null}

      <AdminToolbar>
        <AdminToolbarGroup className="min-w-0 flex-1">
          <AdminSearchField className="w-full sm:max-w-72" aria-label="운영 콘텐츠 검색" value={query} onValueChange={setQuery} placeholder="제목 또는 유형 검색" />
        </AdminToolbarGroup>
        <SegmentedControl ariaLabel="게시 상태" value={statusFilter} onChange={setStatusFilter} className="clean-segmented-control" options={[
          { value: "ALL", label: `전체 ${blocks.length}` },
          { value: "DRAFT", label: "초안" },
          { value: "SCHEDULED", label: "예약" },
          { value: "PUBLISHED", label: "게시 중" },
          { value: "ARCHIVED", label: "보관" },
        ]} />
      </AdminToolbar>

      <div className="grid min-h-[680px] gap-4 xl:grid-cols-[340px_minmax(0,1fr)]">
        <AdminCard className="self-start xl:sticky xl:top-6">
          <AdminCardHeader><div><AdminSectionTitle>콘텐츠 블록</AdminSectionTitle><AdminMetaText>{filteredBlocks.length}개 표시</AdminMetaText></div></AdminCardHeader>
          <div className="max-h-[680px] overflow-y-auto p-2">
            {blocksQuery.isLoading ? <div className="grid gap-2">{Array.from({ length: 5 }).map((_, index) => <Skeleton key={index} className="h-20 rounded-lg" />)}</div>
              : filteredBlocks.length === 0 ? <div className="px-4 py-16 text-center"><LayoutTemplate aria-hidden="true" className="mx-auto mb-3 size-8 text-slate-300" /><p className="text-sm font-medium text-slate-600">조건에 맞는 콘텐츠가 없습니다.</p></div>
              : <div className="grid gap-1">{filteredBlocks.map((block) => {
                const selected = block.contentBlockId === selectedId;
                const status = statusMeta[block.status];
                return <Button key={block.contentBlockId} type="button" variant="ghost" onClick={() => void selectBlock(block)} className={cn("h-auto w-full rounded-lg px-3 py-3 text-left", selected ? "bg-emerald-50" : "hover:bg-slate-50")}>
                  <span className="mb-1.5 flex items-center justify-between gap-2"><span className={cn("text-xs font-semibold", selected ? "text-brand-primary" : "text-slate-500")}>{typeMeta[block.type].label}</span><AdminStatusBadge tone={status.tone}>{status.label}</AdminStatusBadge></span>
                  <span className="block truncate text-sm font-semibold text-slate-950">{block.titleKo}</span>
                  <span className="mt-1 block truncate text-xs font-normal text-slate-500">{block.startsAt ? `${formatDateTime(block.startsAt)}부터` : "상시 노출"}</span>
                </Button>;
              })}</div>}
          </div>
        </AdminCard>

        {selectedBlock ? <div className="min-w-0 space-y-4">
          <AdminCard>
            <AdminCardHeader className="min-h-[72px] px-5 py-4">
              <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><AdminSectionTitle className="truncate">{selectedBlock.titleKo}</AdminSectionTitle><AdminStatusBadge tone={statusMeta[selectedBlock.status].tone}>{statusMeta[selectedBlock.status].label}</AdminStatusBadge></div></div>
              <AdminToolbarGroup>
                {selectedBlock.status !== "ARCHIVED" ? <Button type="button" variant="outline" size="sm" onClick={() => void archiveBlock()} disabled={saving}><Archive aria-hidden="true" /> 보관</Button> : null}
                <Button type="button" variant="ghost" size="sm" className="text-rose-600 hover:bg-rose-50 hover:text-rose-700" onClick={() => void deleteBlock()} disabled={saving}><Trash2 aria-hidden="true" /> 삭제</Button>
              </AdminToolbarGroup>
            </AdminCardHeader>
            <div className="grid gap-5 p-5">
              <div className="grid gap-4 md:grid-cols-2">
                <AdminFormField label="콘텐츠 유형"><AdminSelectDropdown ariaLabel="콘텐츠 유형" className="w-full" value={draft.type} onChange={(value) => setDraft((current) => ({ ...current, type: value as ContentBlockType }))} options={Object.entries(typeMeta).map(([value, meta]) => ({ value, label: meta.label }))} /></AdminFormField>
                <AdminFormField label="노출 순서"><UiInput type="number" min={0} value={draft.sortOrder} onChange={(event) => setDraft((current) => ({ ...current, sortOrder: Number(event.currentTarget.value) || 0 }))} /></AdminFormField>
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                <AdminFormField label="한국어 제목"><UiInput value={draft.titleKo} onChange={(event) => setDraft((current) => ({ ...current, titleKo: event.currentTarget.value }))} /></AdminFormField>
                <AdminFormField label="English title"><UiInput value={draft.titleEn} onChange={(event) => setDraft((current) => ({ ...current, titleEn: event.currentTarget.value }))} /></AdminFormField>
                <AdminFormField label="한국어 본문"><UiTextarea className="min-h-32" value={draft.bodyKo} onChange={(event) => setDraft((current) => ({ ...current, bodyKo: event.currentTarget.value }))} /></AdminFormField>
                <AdminFormField label="English body"><UiTextarea className="min-h-32" value={draft.bodyEn} onChange={(event) => setDraft((current) => ({ ...current, bodyEn: event.currentTarget.value }))} /></AdminFormField>
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                <AdminFormField label="링크 URL"><div className="relative"><Link2 aria-hidden="true" className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" /><UiInput type="url" className="w-full pl-9" value={draft.linkUrl} onChange={(event) => setDraft((current) => ({ ...current, linkUrl: event.currentTarget.value }))} placeholder="https://" /></div></AdminFormField>
                <AdminFormField label="이미지 URL"><div className="relative"><Image aria-hidden="true" className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" /><UiInput type="url" className="w-full pl-9" value={draft.imageUrl} onChange={(event) => setDraft((current) => ({ ...current, imageUrl: event.currentTarget.value }))} placeholder="https://" /></div></AdminFormField>
                <AdminFormField label="노출 시작"><UiInput type="datetime-local" value={draft.startsAt} onChange={(event) => setDraft((current) => ({ ...current, startsAt: event.currentTarget.value }))} /></AdminFormField>
                <AdminFormField label="노출 종료"><UiInput type="datetime-local" min={draft.startsAt || undefined} value={draft.endsAt} onChange={(event) => setDraft((current) => ({ ...current, endsAt: event.currentTarget.value }))} /></AdminFormField>
              </div>
              <label className="flex min-h-12 cursor-pointer items-center justify-between gap-4 rounded-lg border border-slate-200 px-4"><span className="block text-sm font-semibold text-slate-900">노출 허용</span><UiInput type="checkbox" checked={draft.isEnabled} onChange={(event) => setDraft((current) => ({ ...current, isEnabled: event.currentTarget.checked }))} className="size-4 accent-emerald-700" /></label>
            </div>
          </AdminCard>

          <AdminCard>
            <AdminCardHeader><div><AdminSectionTitle>미리보기</AdminSectionTitle><AdminMetaText>한국어 공개 화면 기준</AdminMetaText></div>{draft.linkUrl ? <a href={draft.linkUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-medium text-brand-primary hover:underline">링크 열기 <ExternalLink aria-hidden="true" className="size-3.5" /></a> : null}</AdminCardHeader>
            <div className="p-5"><div className={cn("relative overflow-hidden rounded-xl border border-slate-200 p-6", draft.type === "TOP_BANNER" ? "bg-slate-950 text-white" : "bg-gradient-to-br from-emerald-950 to-slate-900 text-white")}>
              {draft.imageUrl ? <img src={draft.imageUrl} alt="" className="absolute inset-0 h-full w-full object-cover opacity-25" /> : null}
              <div className="relative max-w-2xl"><span className="mb-3 inline-flex rounded-md bg-white/12 px-2 py-1 text-xs font-semibold">{typeMeta[draft.type].label}</span><h3 className="text-xl font-semibold tracking-tight">{draft.titleKo || "제목을 입력하세요"}</h3>{draft.bodyKo ? <p className="mt-2 whitespace-pre-wrap text-sm font-normal leading-6 text-white/75">{draft.bodyKo}</p> : null}{draft.linkUrl ? <span className="mt-4 inline-flex rounded-lg bg-white px-3 py-2 text-sm font-semibold text-slate-950">자세히 보기</span> : null}</div>
            </div></div>
          </AdminCard>

          <AdminStickyActionBar>
            <div><p className="text-sm font-medium text-slate-800">{isDirty ? "저장하지 않은 변경 사항이 있습니다." : `마지막 수정 ${formatDateTime(selectedBlock.updatedAt)}`}</p></div>
            <AdminToolbarGroup><Button type="button" variant="outline" onClick={() => setDraft(draftFromBlock(selectedBlock))} disabled={!isDirty || saving}>되돌리기</Button><Button type="button" variant="outline" onClick={() => void saveBlock()} disabled={!isDirty || saving || !draft.titleKo.trim()}><Save aria-hidden="true" /> 초안 저장</Button><Button type="button" onClick={() => void publishBlock()} disabled={saving || !draft.titleKo.trim()}><Megaphone aria-hidden="true" /> {selectedBlock.status === "PUBLISHED" ? "변경 게시" : "게시"}</Button></AdminToolbarGroup>
          </AdminStickyActionBar>
        </div> : <AdminCard className="grid min-h-[420px] place-items-center p-8 text-center"><div><LayoutTemplate aria-hidden="true" className="mx-auto mb-3 size-9 text-slate-300" /><p className="text-sm font-medium text-slate-700">관리할 콘텐츠를 선택하거나 새로 만드세요.</p></div></AdminCard>}
      </div>
    </AdminPageMain>

    <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="운영 콘텐츠 만들기" className="max-w-xl" footer={<><Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>취소</Button><Button type="button" onClick={() => void createBlock()} disabled={saving || !createDraft.titleKo.trim()}>{saving ? "만드는 중" : "초안 만들기"}</Button></>}>
      <div className="grid gap-4">
        <AdminFormField label="콘텐츠 유형"><AdminSelectDropdown ariaLabel="콘텐츠 유형" autoFocus className="w-full" value={createDraft.type} onChange={(value) => setCreateDraft((current) => ({ ...current, type: value as ContentBlockType }))} options={Object.entries(typeMeta).map(([value, meta]) => ({ value, label: meta.label }))} /></AdminFormField>
        <AdminFormField label="한국어 제목"><UiInput value={createDraft.titleKo} onChange={(event) => setCreateDraft((current) => ({ ...current, titleKo: event.currentTarget.value }))} placeholder="관리 목록에서 구분할 제목" /></AdminFormField>
        <AdminFormField label="English title"><UiInput value={createDraft.titleEn} onChange={(event) => setCreateDraft((current) => ({ ...current, titleEn: event.currentTarget.value }))} /></AdminFormField>
      </div>
    </Modal>
  </AdminPageShell>;
}
