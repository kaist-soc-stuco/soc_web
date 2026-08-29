import { createApiClient } from "@soc/api-client";
import type { ContentBlockListResponse, ContentBlockRecord, ContentBlockStatus, ContentBlockType, CreateContentBlockRequest, UpdateContentBlockRequest } from "@soc/contracts";
import { isoToDate } from "@soc/shared";
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, GripVertical, ImageUp, LayoutTemplate, Link2, Megaphone, Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState, type CSSProperties } from "react";

import { AuthGuard } from "@/components/guards/auth-guard";
import { AdminCard, AdminCardHeader, AdminFormField, AdminMetaText, AdminPageHeader, AdminPageMain, AdminPageShell, AdminSectionTitle, AdminStickyActionBar, AdminToolbarGroup } from "@/components/ui/admin-page";
import { AdminStatusBadge } from "@/components/ui/admin-status-badge";
import { AdminSelectDropdown } from "@/components/ui/admin-select";
import { Button } from "@/components/ui/button";
import { useConfirmDialog } from "@/components/ui/confirm-dialog";
import { UiInput, UiTextarea } from "@/components/ui/form-control";
import { ImageCropModal } from "@/components/ui/image-crop-modal";
import { Modal } from "@/components/ui/modal";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Skeleton } from "@/components/ui/skeleton";
import { resolveApiBaseUrl } from "@/lib/api-base-url";
import { resolveAssetUrl } from "@/lib/asset-url";
import { Permissions } from "@/lib/permissions";
import { cn } from "@/lib/utils";

type ContentCategory = "NOTICE" | "HERO" | "QUICK_LINK" | "LOGO" | "ORGANIZATION" | "PLEDGE";

interface BlockDraft {
  bodyEn: string;
  bodyKo: string;
  imageUrl: string;
  imageUrlEn: string;
  linkUrl: string;
  pledgeStatus: "PLANNED" | "IN_PROGRESS" | "COMPLETED" | null;
  sortOrder: number;
  titleEn: string;
  titleKo: string;
  type: ContentBlockType;
}

const CONTENT_BLOCK_QUERY_KEY = ["admin", "content-blocks"] as const;

const categoryMeta: Record<ContentCategory, { createLabel: string; createType: ContentBlockType; label: string; singleton: boolean; types: ContentBlockType[] }> = {
  NOTICE: { createLabel: "등록", createType: "TOP_BANNER", label: "띠배너", singleton: false, types: ["TOP_BANNER"] },
  HERO: { createLabel: "등록", createType: "HERO", label: "홈 히어로", singleton: false, types: ["HERO"] },
  QUICK_LINK: { createLabel: "등록", createType: "QUICK_LINK", label: "퀵링크", singleton: false, types: ["QUICK_LINK"] },
  LOGO: { createLabel: "등록", createType: "LOGO", label: "로고", singleton: true, types: ["LOGO"] },
  ORGANIZATION: { createLabel: "등록", createType: "ORGANIZATION_CHART", label: "조직도", singleton: true, types: ["ORGANIZATION_CHART"] },
  PLEDGE: { createLabel: "공약 추가", createType: "PLEDGE", label: "공약", singleton: false, types: ["PLEDGE"] },
};

type ImageContentBlockType = "HERO" | "LOGO" | "ORGANIZATION_CHART";

const isImageOnlyType = (type: ContentBlockType): type is ImageContentBlockType => type === "HERO" || type === "LOGO" || type === "ORGANIZATION_CHART";

const IMAGE_SPECS: Record<"HERO" | "LOGO" | "ORGANIZATION_CHART", { height: number; label: string; width: number }> = {
  HERO: { height: 1600, label: "히어로 이미지", width: 900 },
  LOGO: { height: 100, label: "로고 이미지", width: 400 },
  ORGANIZATION_CHART: { height: 900, label: "조직도 이미지", width: 1600 },
};

const getImageSpec = (type: ContentBlockType) => isImageOnlyType(type) ? IMAGE_SPECS[type] : null;

const draftForType = (type: ContentBlockType) => {
  const draft = emptyDraft(type);
  if (type === "HERO") {
    draft.titleKo = "홈 히어로";
    draft.titleEn = "Home hero";
  }
  if (type === "LOGO") {
    draft.titleKo = "사이트 로고";
    draft.titleEn = "Site logo";
  }
  if (type === "ORGANIZATION_CHART") {
    draft.titleKo = "조직도";
    draft.titleEn = "Organization Chart";
  }
  return draft;
};

const draftForCategory = (category: ContentCategory) => {
  return draftForType(categoryMeta[category].createType);
};

const statusMeta: Record<ContentBlockStatus, { label: string; tone: "neutral" | "positive" | "warning" | "info" }> = {
  DRAFT: { label: "초안", tone: "neutral" },
  PUBLISHED: { label: "게시 중", tone: "positive" },
};

const pledgeStatusOptions = [
  { value: "PLANNED", label: "예정" },
  { value: "IN_PROGRESS", label: "진행 중" },
  { value: "COMPLETED", label: "이행 완료" },
];

const emptyDraft = (type: ContentBlockType = "HERO"): BlockDraft => ({
  bodyEn: "",
  bodyKo: "",
  imageUrl: "",
  imageUrlEn: "",
  linkUrl: "",
  pledgeStatus: type === "PLEDGE" ? "PLANNED" : null,
  sortOrder: 0,
  titleEn: "",
  titleKo: "",
  type,
});

const draftFromBlock = (block: ContentBlockRecord): BlockDraft => ({
  bodyEn: block.bodyEn ?? "",
  bodyKo: block.bodyKo ?? "",
  imageUrl: block.imageUrl ?? "",
  imageUrlEn: block.imageUrlEn ?? "",
  linkUrl: block.linkUrl ?? "",
  pledgeStatus: block.pledgeStatus,
  sortOrder: block.sortOrder,
  titleEn: block.titleEn,
  titleKo: block.titleKo,
  type: block.type,
});

const normalizeDraft = (draft: BlockDraft): CreateContentBlockRequest => ({
  bodyEn: draft.bodyEn.trim() || null,
  bodyKo: draft.bodyKo.trim() || null,
  imageUrl: draft.imageUrl.trim() || null,
  imageUrlEn: draft.imageUrlEn.trim() || null,
  linkUrl: draft.linkUrl.trim() || null,
  pledgeStatus: draft.pledgeStatus,
  sortOrder: draft.sortOrder,
  titleEn: draft.titleEn.trim() || draft.titleKo.trim(),
  titleKo: draft.titleKo.trim(),
  type: draft.type,
});

const formatDateTime = (value: string | null) => value
  ? new Intl.DateTimeFormat("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(isoToDate(value))
  : "제한 없음";

const effectiveStatus = (block: ContentBlockRecord): ContentBlockStatus => block.status;

export function SiteContentPage() {
  return <AuthGuard requirePermission={Permissions.MANAGE_SITE_CONTENT}><SiteContentPageContent /></AuthGuard>;
}

function SiteContentPageContent() {
  const apiClient = useMemo(() => createApiClient({ baseUrl: resolveApiBaseUrl() }), []);
  const queryClient = useQueryClient();
  const { confirm, ConfirmDialog } = useConfirmDialog();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [category, setCategory] = useState<ContentCategory>("NOTICE");
  const [draft, setDraft] = useState<BlockDraft>(emptyDraft());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [createDraft, setCreateDraft] = useState<BlockDraft>(emptyDraft());
  const [orderedBlocks, setOrderedBlocks] = useState<ContentBlockRecord[]>([]);
  const [orderSaving, setOrderSaving] = useState(false);
  const [imageUploading, setImageUploading] = useState(false);
  const [cropRequest, setCropRequest] = useState<{ file: File; field: "ko" | "en"; target: "create" | "draft"; type: "HERO" | "LOGO" | "ORGANIZATION_CHART" } | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const blocksQuery = useQuery({
    queryKey: CONTENT_BLOCK_QUERY_KEY,
    queryFn: () => apiClient.listAdminContentBlocks(),
  });
  const blocks = orderedBlocks;
  const selectedBlock = blocks.find((block) => block.contentBlockId === selectedId) ?? null;

  useEffect(() => {
    if (blocksQuery.data?.items) setOrderedBlocks(blocksQuery.data.items);
  }, [blocksQuery.data?.items]);

  useEffect(() => {
    const categoryBlocks = blocks.filter((block) => categoryMeta[category].types.includes(block.type));
    if (!categoryBlocks.length) {
      setSelectedId(null);
      return;
    }
    if (!selectedId || !categoryBlocks.some((block) => block.contentBlockId === selectedId)) {
      setSelectedId(categoryBlocks[0].contentBlockId);
    }
  }, [blocks, category, selectedId]);

  useEffect(() => {
    if (selectedBlock) setDraft(draftFromBlock(selectedBlock));
  }, [selectedBlock?.contentBlockId, selectedBlock?.updatedAt]);

  const filteredBlocks = useMemo(
    () => blocks.filter((block) => categoryMeta[category].types.includes(block.type)),
    [blocks, category],
  );

  const isDirty = Boolean(selectedBlock && JSON.stringify(normalizeDraft(draft)) !== JSON.stringify(normalizeDraft(draftFromBlock(selectedBlock))));

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: CONTENT_BLOCK_QUERY_KEY });
  };

  const uploadImage = async (file: File, apply: (imageReference: string) => void) => {
    if (!file.type.startsWith("image/")) {
      setError("이미지 파일만 등록할 수 있습니다.");
      return;
    }
    setImageUploading(true);
    setError(null);
    try {
      const uploaded = await apiClient.uploadAsset(file);
      apply(uploaded.storageKey);
    } catch {
      setError("이미지를 업로드하지 못했습니다. 파일 형식과 크기를 확인해 주세요.");
    } finally {
      setImageUploading(false);
    }
  };

  const requestImageCrop = (target: "create" | "draft", type: ContentBlockType, file: File, field: "ko" | "en" = "ko") => {
    if (!isImageOnlyType(type)) return;
    setCropRequest({ file, field, target, type });
  };

  const applyCroppedImage = async (file: File) => {
    if (!cropRequest) return;
    const target = cropRequest.target;
    const field = cropRequest.field;
    setCropRequest(null);
    await uploadImage(file, (imageReference) => {
      const key = field === "en" ? "imageUrlEn" : "imageUrl";
      if (target === "draft") setDraft((current) => ({ ...current, [key]: imageReference }));
      else setCreateDraft((current) => ({ ...current, [key]: imageReference }));
    });
  };

  const handleDragEnd = async ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id || isDirty || saving || orderSaving) return;
    const categoryBlocks = blocks.filter((block) => categoryMeta[category].types.includes(block.type));
    const oldIndex = categoryBlocks.findIndex((block) => block.contentBlockId === active.id);
    const newIndex = categoryBlocks.findIndex((block) => block.contentBlockId === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const previous = blocks;
    const reorderedCategory = arrayMove(categoryBlocks, oldIndex, newIndex).map((block, sortOrder) => ({ ...block, sortOrder }));
    const reorderedById = new Map(reorderedCategory.map((block) => [block.contentBlockId, block]));
    const reordered = blocks.map((block) => reorderedById.get(block.contentBlockId) ?? block);
    setOrderedBlocks(reordered);
    queryClient.setQueryData<ContentBlockListResponse>(CONTENT_BLOCK_QUERY_KEY, { items: reordered });
    setOrderSaving(true);
    try {
      const result = await apiClient.reorderContentBlocks({ items: reorderedCategory.map((block) => ({ contentBlockId: block.contentBlockId, sortOrder: block.sortOrder })) });
      setOrderedBlocks(result.items);
      queryClient.setQueryData(CONTENT_BLOCK_QUERY_KEY, result);
    } catch {
      setOrderedBlocks(previous);
      queryClient.setQueryData(CONTENT_BLOCK_QUERY_KEY, { items: previous });
      setError("노출 순서를 저장하지 못했습니다.");
    } finally {
      setOrderSaving(false);
    }
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

  const changeCategory = async (nextCategory: ContentCategory) => {
    if (nextCategory === category) return;
    if (isDirty) {
      const discard = await confirm({ title: "저장하지 않은 변경 사항을 버릴까요?", confirmLabel: "변경 사항 버리기", tone: "danger" });
      if (!discard) return;
    }
    setError(null);
    setCategory(nextCategory);
  };

  const createBlock = async () => {
    if (!createDraft.titleKo.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const created = await apiClient.createContentBlock(normalizeDraft(createDraft));
      await apiClient.publishContentBlock(created.contentBlockId);
      await refresh();
      setCreateOpen(false);
      setCreateDraft(emptyDraft());
      setSelectedId(created.contentBlockId);
    } catch {
      setError("사이트 항목을 등록하지 못했습니다. 입력값을 확인해 주세요.");
    } finally {
      setSaving(false);
    }
  };

  const applyBlock = async () => {
    if (!selectedBlock) return;
    setSaving(true);
    setError(null);
    try {
      await apiClient.updateContentBlock(selectedBlock.contentBlockId, normalizeDraft(draft) as UpdateContentBlockRequest);
      await apiClient.publishContentBlock(selectedBlock.contentBlockId);
      await refresh();
    } catch {
      setError("변경 사항을 적용하지 못했습니다.");
    } finally {
      setSaving(false);
    }
  };

  const deleteBlock = async () => {
    if (!selectedBlock) return;
    const approved = await confirm({
      title: "콘텐츠 삭제",
      description: <>정말 <strong className="font-semibold text-slate-900">“{selectedBlock.titleKo}”</strong> 콘텐츠를 완전히 삭제할까요?</>,
      warning: "(삭제된 콘텐츠는 영구히 복구할 수 없습니다.)",
      confirmLabel: "삭제하기",
      tone: "danger",
    });
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

  const canCreateCategory = !categoryMeta[category].singleton || filteredBlocks.length === 0;

  return <AdminPageShell>
    {ConfirmDialog}
    <AdminPageMain className="max-w-[var(--ui-admin-page-max-width)]">
      <AdminPageHeader
        title="사이트 설정"
        actions={canCreateCategory ? <Button type="button" onClick={() => { setCreateDraft(draftForCategory(category)); setCreateOpen(true); }}><Plus aria-hidden="true" /> {categoryMeta[category].createLabel}</Button> : undefined}
      />

      {error ? <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">{error}</div> : null}

      <SegmentedControl
        ariaLabel="사이트 설정 영역"
        value={category}
        onChange={(value) => void changeCategory(value as ContentCategory)}
        className="clean-segmented-control w-fit"
        options={Object.entries(categoryMeta).map(([value, meta]) => ({ value, label: meta.label }))}
      />

      <div className="grid min-h-[680px] gap-4 xl:grid-cols-[340px_minmax(0,1fr)]">
        <AdminCard className="self-start xl:sticky xl:top-6">
          <AdminCardHeader><div><AdminSectionTitle>{categoryMeta[category].label}</AdminSectionTitle><AdminMetaText>{filteredBlocks.length}개 표시</AdminMetaText></div></AdminCardHeader>
          <div className="scrollbar-hidden max-h-[680px] overflow-y-auto p-2">
            {blocksQuery.isLoading && !blocksQuery.data ? <div className="grid gap-2">{Array.from({ length: 5 }).map((_, index) => <Skeleton key={index} className="h-20 rounded-lg" />)}</div>
              : filteredBlocks.length === 0 ? <div className="px-4 py-16 text-center"><LayoutTemplate aria-hidden="true" className="mx-auto mb-3 size-8 text-slate-300" /><p className="text-sm font-medium text-slate-600">조건에 맞는 콘텐츠가 없습니다.</p></div>
              : <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(event) => void handleDragEnd(event)}><SortableContext items={filteredBlocks.map((block) => block.contentBlockId)} strategy={verticalListSortingStrategy}><div className="grid gap-1">{filteredBlocks.map((block) => <SortableContentBlockItem key={block.contentBlockId} block={block} selected={block.contentBlockId === selectedId} disabled={isDirty || saving || orderSaving} sortable={!categoryMeta[category].singleton} onSelect={() => void selectBlock(block)} />)}</div></SortableContext></DndContext>}
            {orderSaving ? <p className="px-3 pb-3 pt-2 text-xs font-normal text-[#344054]">노출 순서를 저장하는 중입니다.</p> : null}
          </div>
        </AdminCard>

        {selectedBlock ? <div className="min-w-0 space-y-4">
          <AdminCard>
            <AdminCardHeader className="min-h-[72px] px-5 py-4">
              <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><AdminSectionTitle className="truncate">{selectedBlock.titleKo}</AdminSectionTitle><AdminStatusBadge tone={statusMeta[selectedBlock.status].tone}>{statusMeta[selectedBlock.status].label}</AdminStatusBadge></div></div>
              <AdminToolbarGroup>
                <Button type="button" variant="ghost" size="sm" className="text-rose-600 hover:bg-rose-50 hover:text-rose-700" onClick={() => void deleteBlock()} disabled={saving}><Trash2 aria-hidden="true" /> 삭제</Button>
              </AdminToolbarGroup>
            </AdminCardHeader>
            <div className="grid gap-5 p-5">
              {!isImageOnlyType(draft.type) ? <div className="grid gap-4 lg:grid-cols-2">
                <AdminFormField label="한국어 제목"><UiInput value={draft.titleKo} onChange={(event) => { const value = event.currentTarget.value; setDraft((current) => ({ ...current, titleKo: value })); }} /></AdminFormField>
                <AdminFormField label="English title"><UiInput value={draft.titleEn} onChange={(event) => { const value = event.currentTarget.value; setDraft((current) => ({ ...current, titleEn: value })); }} /></AdminFormField>
                {draft.type !== "QUICK_LINK" ? <AdminFormField label="한국어 본문"><UiTextarea className="min-h-32" value={draft.bodyKo} onChange={(event) => { const value = event.currentTarget.value; setDraft((current) => ({ ...current, bodyKo: value })); }} /></AdminFormField> : null}
                {draft.type !== "QUICK_LINK" ? <AdminFormField label="English body"><UiTextarea className="min-h-32" value={draft.bodyEn} onChange={(event) => { const value = event.currentTarget.value; setDraft((current) => ({ ...current, bodyEn: value })); }} /></AdminFormField> : null}
                {draft.type === "PLEDGE" ? <AdminFormField label="이행 상태"><AdminSelectDropdown ariaLabel="이행 상태" value={draft.pledgeStatus ?? "PLANNED"} options={pledgeStatusOptions} onChange={(value) => setDraft((current) => ({ ...current, pledgeStatus: value as BlockDraft["pledgeStatus"] }))} /></AdminFormField> : null}
              </div> : null}
              <div className="grid gap-4">
                {!isImageOnlyType(draft.type) && draft.type !== "PLEDGE" ? <AdminFormField label="링크 URL"><div className="relative"><Link2 aria-hidden="true" className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" /><UiInput type="url" className="w-full pl-9" value={draft.linkUrl} onChange={(event) => { const value = event.currentTarget.value; setDraft((current) => ({ ...current, linkUrl: value })); }} placeholder="https://" /></div></AdminFormField> : null}
                {isImageOnlyType(draft.type) ? <ContentImageInput spec={getImageSpec(draft.type)!} previewBorderless={draft.type === "ORGANIZATION_CHART"} value={draft.imageUrl} secondaryValue={draft.type === "ORGANIZATION_CHART" ? draft.imageUrlEn : undefined} secondaryLabel={draft.type === "ORGANIZATION_CHART" ? "English organization chart" : undefined} uploading={imageUploading} onSelect={(file) => requestImageCrop("draft", draft.type, file)} onSecondarySelect={(file) => requestImageCrop("draft", draft.type, file, "en")} onRemove={() => setDraft((current) => ({ ...current, imageUrl: "" }))} onSecondaryRemove={() => setDraft((current) => ({ ...current, imageUrlEn: "" }))} /> : null}
              </div>
            </div>
          </AdminCard>

          <AdminCard>
            <AdminCardHeader><div><AdminSectionTitle>미리보기</AdminSectionTitle><AdminMetaText>한국어 공개 화면 기준</AdminMetaText></div>{draft.linkUrl ? <a href={draft.linkUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-medium text-brand-primary hover:underline">링크 열기 <ExternalLink aria-hidden="true" className="size-3.5" /></a> : null}</AdminCardHeader>
            <div className="p-5"><ContentBlockPreview draft={draft} /></div>
          </AdminCard>

          <AdminStickyActionBar>
            <div><p className="text-sm font-medium text-slate-800">{isDirty ? "저장하지 않은 변경 사항이 있습니다." : `마지막 수정 ${formatDateTime(selectedBlock.updatedAt)}`}</p></div>
            <AdminToolbarGroup><Button type="button" variant="outline" onClick={() => setDraft(draftFromBlock(selectedBlock))} disabled={!isDirty || saving}>되돌리기</Button><Button type="button" onClick={() => void applyBlock()} disabled={saving || imageUploading || (!isDirty && selectedBlock.status === "PUBLISHED") || !draft.titleKo.trim() || (isImageOnlyType(draft.type) && !draft.imageUrl.trim())}>{saving ? "적용 중" : "변경 적용"}</Button></AdminToolbarGroup>
          </AdminStickyActionBar>
        </div> : <AdminCard className="grid min-h-[420px] place-items-center p-8 text-center"><div><LayoutTemplate aria-hidden="true" className="mx-auto mb-3 size-9 text-slate-300" /><p className="text-sm font-medium text-slate-700">관리할 콘텐츠를 선택하거나 새로 만드세요.</p></div></AdminCard>}
      </div>
    </AdminPageMain>

    <Modal open={createOpen} onClose={() => setCreateOpen(false)} title={categoryMeta[category].createLabel} className="max-w-xl" footer={<><Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>취소</Button><Button type="button" onClick={() => void createBlock()} disabled={saving || imageUploading || !createDraft.titleKo.trim() || (isImageOnlyType(createDraft.type) && !createDraft.imageUrl.trim())}>{saving ? "등록 중" : "등록"}</Button></>}>
      <div className="grid gap-4">
        {!isImageOnlyType(createDraft.type) ? <AdminFormField label="한국어 제목"><UiInput className="w-full" value={createDraft.titleKo} onChange={(event) => { const value = event.currentTarget.value; setCreateDraft((current) => ({ ...current, titleKo: value })); }} placeholder="공개 화면에 표시할 제목" /></AdminFormField> : null}
        {!isImageOnlyType(createDraft.type) ? <AdminFormField label="English title"><UiInput className="w-full" value={createDraft.titleEn} onChange={(event) => { const value = event.currentTarget.value; setCreateDraft((current) => ({ ...current, titleEn: value })); }} /></AdminFormField> : null}
        {!isImageOnlyType(createDraft.type) && createDraft.type !== "QUICK_LINK" ? <AdminFormField label="한국어 본문"><UiTextarea className="w-full min-h-24" value={createDraft.bodyKo} onChange={(event) => { const value = event.currentTarget.value; setCreateDraft((current) => ({ ...current, bodyKo: value })); }} /></AdminFormField> : null}
        {!isImageOnlyType(createDraft.type) && createDraft.type !== "QUICK_LINK" ? <AdminFormField label="English body"><UiTextarea className="w-full min-h-24" value={createDraft.bodyEn} onChange={(event) => { const value = event.currentTarget.value; setCreateDraft((current) => ({ ...current, bodyEn: value })); }} /></AdminFormField> : null}
        {createDraft.type === "PLEDGE" ? <AdminFormField label="이행 상태"><AdminSelectDropdown ariaLabel="이행 상태" value={createDraft.pledgeStatus ?? "PLANNED"} options={pledgeStatusOptions} onChange={(value) => setCreateDraft((current) => ({ ...current, pledgeStatus: value as BlockDraft["pledgeStatus"] }))} /></AdminFormField> : null}
        {!isImageOnlyType(createDraft.type) && createDraft.type !== "PLEDGE" ? <AdminFormField label="링크 URL"><div className="relative"><Link2 aria-hidden="true" className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" /><UiInput type="url" className="w-full pl-9" value={createDraft.linkUrl} onChange={(event) => { const value = event.currentTarget.value; setCreateDraft((current) => ({ ...current, linkUrl: value })); }} placeholder="https://" /></div></AdminFormField> : null}
        {isImageOnlyType(createDraft.type) ? <ContentImageInput spec={getImageSpec(createDraft.type)!} previewBorderless={createDraft.type === "ORGANIZATION_CHART"} value={createDraft.imageUrl} secondaryValue={createDraft.type === "ORGANIZATION_CHART" ? createDraft.imageUrlEn : undefined} secondaryLabel={createDraft.type === "ORGANIZATION_CHART" ? "English organization chart" : undefined} uploading={imageUploading} onSelect={(file) => requestImageCrop("create", createDraft.type, file)} onSecondarySelect={(file) => requestImageCrop("create", createDraft.type, file, "en")} onRemove={() => setCreateDraft((current) => ({ ...current, imageUrl: "" }))} onSecondaryRemove={() => setCreateDraft((current) => ({ ...current, imageUrlEn: "" }))} /> : null}
      </div>
    </Modal>
    {cropRequest ? <ImageCropModal allowFreeAspectRatio={cropRequest.type === "ORGANIZATION_CHART"} aspectRatio={getImageSpec(cropRequest.type)!.width / getImageSpec(cropRequest.type)!.height} file={cropRequest.file} outputHeight={getImageSpec(cropRequest.type)!.height} outputWidth={getImageSpec(cropRequest.type)!.width} onCancel={() => setCropRequest(null)} onComplete={applyCroppedImage} /> : null}
  </AdminPageShell>;
}

function ContentImageInput({ onRemove, onSecondaryRemove, onSecondarySelect, onSelect, previewBorderless = false, secondaryLabel, secondaryValue, spec, uploading, value }: {
  onRemove: () => void;
  onSecondaryRemove?: () => void;
  onSecondarySelect?: (file: File) => void;
  onSelect: (file: File) => void;
  previewBorderless?: boolean;
  secondaryLabel?: string;
  secondaryValue?: string;
  spec: { height: number; label: string; width: number };
  uploading: boolean;
  value: string;
}) {
  const renderSlot = (label: string, slotValue: string, select: (file: File) => void, remove: (() => void) | undefined) => (
    <div className="space-y-3">
      <p className="text-sm font-medium text-slate-700">{label} <span className="text-xs font-normal text-slate-400">({spec.width} × {spec.height})</span></p>
      {slotValue ? <div className={cn("overflow-hidden rounded-lg", previewBorderless ? "bg-white" : "border border-[#e5e9ec] bg-slate-50")}><img src={resolveAssetUrl(slotValue)} alt="" className={cn("block h-36 w-full object-contain", previewBorderless && "h-auto max-h-[420px]")} /></div> : null}
      <div className="flex flex-wrap gap-2">
        <label className={cn("inline-flex h-[var(--ui-control-height)] cursor-pointer items-center justify-center gap-2 rounded-[var(--ui-control-radius)] border border-[var(--ui-border-subtle)] bg-white px-3 text-[length:var(--ui-control-font-size)] font-normal text-[#172033] transition-colors hover:bg-slate-50", uploading && "pointer-events-none opacity-60")}>
          <ImageUp aria-hidden="true" className="size-4" />
          {uploading ? "업로드 중" : "이미지 선택"}
          <input type="file" accept="image/*" className="hidden" disabled={uploading} onChange={(event) => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ""; if (file) select(file); }} />
        </label>
        {slotValue && remove ? <Button type="button" variant="ghost" onClick={remove} disabled={uploading}>이미지 제거</Button> : null}
      </div>
    </div>
  );

  const hasSecondary = Boolean(secondaryLabel && onSecondarySelect);
  return <AdminFormField label={hasSecondary ? "조직도 이미지" : `${spec.label} (${spec.width} × ${spec.height}) *`}>
    <div className="grid gap-5">
      {renderSlot(hasSecondary ? "한국어 조직도" : spec.label, value, onSelect, onRemove)}
      {hasSecondary ? renderSlot(secondaryLabel!, secondaryValue ?? "", onSecondarySelect!, onSecondaryRemove) : null}
      <p className="text-xs font-normal text-[#344054]">JPG, PNG 또는 WebP 이미지 파일을 선택하면 지정한 크기로 자를 수 있습니다.</p>
    </div>
  </AdminFormField>;
}

function SortableContentBlockItem({ block, disabled, onSelect, selected, sortable }: { block: ContentBlockRecord; disabled: boolean; onSelect: () => void; selected: boolean; sortable: boolean }) {
  const { attributes, isDragging, listeners, setNodeRef, transform, transition } = useSortable({ id: block.contentBlockId, disabled: disabled || !sortable });
  const style: CSSProperties = { transform: CSS.Translate.toString(transform), transition };
  const displayStatus = statusMeta[effectiveStatus(block)];
  return <div ref={setNodeRef} style={style} className={cn("group flex items-stretch rounded-lg", selected ? "bg-emerald-50" : "hover:bg-slate-50", isDragging && "z-10 opacity-40")}>
    {sortable ? <button type="button" {...attributes} {...listeners} disabled={disabled} className="flex w-9 shrink-0 touch-none cursor-grab items-center justify-center rounded-l-lg text-slate-400 hover:text-[#344054] disabled:cursor-default disabled:opacity-30 active:cursor-grabbing" aria-label={`${block.titleKo} 노출 순서 변경`} title={disabled ? "변경 사항을 적용한 뒤 순서를 바꿀 수 있습니다." : "드래그하여 노출 순서 변경"}><GripVertical aria-hidden="true" className="size-4" /></button> : null}
    <button type="button" onClick={onSelect} className={cn("min-w-0 flex-1 px-3 py-3 text-left", sortable ? "rounded-r-lg" : "rounded-lg")}>
      <span className="flex items-center justify-between gap-3"><span className="min-w-0 truncate text-sm font-normal text-[#172033]">{block.titleKo}</span><AdminStatusBadge tone={displayStatus.tone}>{displayStatus.label}</AdminStatusBadge></span>
    </button>
  </div>;
}

function ContentBlockPreview({ draft }: { draft: BlockDraft }) {
  const title = draft.titleKo || "제목을 입력하세요";
  const body = draft.bodyKo || "본문이 입력되면 이곳에 표시됩니다.";
  const imageUrl = draft.imageUrl ? resolveAssetUrl(draft.imageUrl) : "";
  const image = imageUrl ? <img src={imageUrl} alt="" className="absolute inset-0 size-full object-cover" /> : null;
  if (draft.type === "TOP_BANNER") {
    return <div className="flex items-center gap-3 rounded-lg border border-[#e5e9ec] bg-white px-4 py-3"><Megaphone aria-hidden="true" className="size-4 shrink-0 text-brand-primary" /><div className="min-w-0 flex-1"><p className="truncate text-sm font-normal text-[#172033]">{title}</p><p className="truncate text-xs font-normal text-[#344054]">{body}</p></div>{draft.linkUrl ? <span className="text-xs font-normal text-brand-primary">보기</span> : null}</div>;
  }
  if (draft.type === "HERO") {
    return imageUrl
      ? <div className="overflow-hidden rounded-xl border border-[#e5e9ec] bg-[#172033]"><img src={imageUrl} alt="" className="h-72 w-full object-cover opacity-80" /></div>
      : <div className="grid min-h-64 place-items-center rounded-xl border border-dashed border-[#e5e9ec] bg-slate-50 text-sm font-normal text-[#344054]">히어로 이미지를 선택해 주세요.</div>;
  }
  if (draft.type === "LOGO") {
    return imageUrl
      ? <div className="grid min-h-28 place-items-center rounded-xl border border-[#e5e9ec] bg-white p-6"><img src={imageUrl} alt={title} className="max-h-20 max-w-[18rem] object-contain" /></div>
      : <div className="grid min-h-28 place-items-center rounded-xl border border-dashed border-[#e5e9ec] bg-slate-50 text-sm font-normal text-[#344054]">로고 이미지를 선택해 주세요.</div>;
  }
  if (draft.type === "QUICK_LINK") {
    return <div className="flex max-w-sm items-center gap-3 rounded-xl border border-[#e5e9ec] bg-white p-4"><div className="grid size-9 shrink-0 place-items-center rounded-lg bg-slate-50"><ExternalLink aria-hidden="true" className="size-4 text-[#344054]" /></div><div className="min-w-0"><p className="truncate text-sm font-normal text-[#172033]">{title}</p><p className="truncate text-xs font-normal text-[#344054]">{body}</p></div></div>;
  }
  if (draft.type === "ORGANIZATION_CHART") {
    const imageUrlEn = draft.imageUrlEn ? resolveAssetUrl(draft.imageUrlEn) : "";
    return imageUrl
      ? <div className="grid gap-4 sm:grid-cols-2"><div className="min-w-0"><p className="mb-2 text-xs font-medium text-slate-500">한국어</p><div className="overflow-hidden rounded-xl bg-white"><img src={imageUrl} alt={title} className="block max-h-[420px] w-full object-contain" /></div></div>{imageUrlEn ? <div className="min-w-0"><p className="mb-2 text-xs font-medium text-slate-500">English</p><div className="overflow-hidden rounded-xl bg-white"><img src={imageUrlEn} alt={draft.titleEn || title} className="block max-h-[420px] w-full object-contain" /></div></div> : null}</div>
      : <div className="grid min-h-56 place-items-center rounded-xl border border-dashed border-[#e5e9ec] bg-slate-50 text-sm font-normal text-[#344054]">조직도 이미지를 선택해 주세요.</div>;
  }
  if (draft.type === "PLEDGE") {
    const statusLabel = draft.pledgeStatus === "COMPLETED" ? "이행 완료" : draft.pledgeStatus === "IN_PROGRESS" ? "진행 중" : "예정";
    return <div className="rounded-xl border border-[#e5e9ec] bg-white p-5"><div className="flex items-start justify-between gap-4"><div><h3 className="text-sm font-normal text-[#172033]">{title}</h3><p className="mt-2 whitespace-pre-wrap text-sm font-normal leading-6 text-[#344054]">{body}</p></div><span className="shrink-0 rounded-md border border-[#e5e9ec] px-2 py-1 text-xs font-normal text-[#344054]">{statusLabel}</span></div></div>;
  }
  return <div className="relative min-h-64 overflow-hidden rounded-xl border border-[#e5e9ec] bg-[#172033] p-7 text-white">{image ? <div className="absolute inset-0 opacity-40">{image}</div> : null}<div className="absolute inset-0 bg-gradient-to-r from-[#172033]/90 to-[#172033]/20" /><div className="relative max-w-xl pt-16"><h3 className="text-2xl font-medium tracking-tight">{title}</h3><p className="mt-2 whitespace-pre-wrap text-sm font-normal leading-6 text-white/75">{body}</p>{draft.linkUrl ? <span className="mt-5 inline-flex rounded-lg bg-white px-3 py-2 text-sm font-normal text-[#172033]">자세히 보기</span> : null}</div></div>;
}
