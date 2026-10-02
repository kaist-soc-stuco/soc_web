import { useToast } from "@/components/ui/toast";
import { restrictListDrag } from "@/lib/drag-bounds";
import { createApiClient } from "@soc/api-client";
import type { ContentBlockListResponse, ContentBlockRecord, ContentBlockStatus, ContentBlockType, CreateContentBlockRequest, UpdateContentBlockRequest } from "@soc/contracts";
import { isoToDate } from "@soc/shared";
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { GripVertical, Link2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";

import { AuthGuard } from "@/components/guards/auth-guard";
import { AdminCard, AdminCardHeader, AdminEmptyState, AdminEditorGuidance, AdminFormField, AdminLoadingState, AdminMetaText, AdminPageHeader, AdminPageMain, AdminPageShell, AdminSectionTitle } from "@/components/ui/admin-page";
import { AdminStatusBadge } from "@/components/ui/admin-status-badge";
import { AdminSelectDropdown } from "@/components/ui/admin-select";
import { Button } from "@/components/ui/button";
import { useConfirmDialog } from "@/components/ui/confirm-dialog";
import { UiInput, UiTextarea } from "@/components/ui/form-control";
import { ImageUploadField } from "@/components/ui/image-upload-field";
import { ImageCropModal } from "@/components/ui/image-crop-modal";
import { IconButton } from "@/components/ui/icon-button";
import { Modal } from "@/components/ui/modal";
import { SegmentedControl } from "@/components/ui/segmented-control";
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
  NOTICE: { createLabel: "띠배너 설정", createType: "TOP_BANNER", label: "띠배너", singleton: true, types: ["TOP_BANNER"] },
  HERO: { createLabel: "홈 히어로 설정", createType: "HERO", label: "홈 히어로", singleton: true, types: ["HERO"] },
  QUICK_LINK: { createLabel: "퀵링크 추가", createType: "QUICK_LINK", label: "퀵링크", singleton: false, types: ["QUICK_LINK"] },
  LOGO: { createLabel: "로고 설정", createType: "LOGO", label: "로고", singleton: true, types: ["LOGO"] },
  ORGANIZATION: { createLabel: "조직도 설정", createType: "ORGANIZATION_CHART", label: "조직도", singleton: true, types: ["ORGANIZATION_CHART"] },
  PLEDGE: { createLabel: "공약 추가", createType: "PLEDGE", label: "공약", singleton: false, types: ["PLEDGE"] },
};

type ImageContentBlockType = "HERO" | "LOGO" | "ORGANIZATION_CHART";

const isImageOnlyType = (type: ContentBlockType): type is ImageContentBlockType => type === "HERO" || type === "LOGO" || type === "ORGANIZATION_CHART";

const IMAGE_SPECS: Record<"HERO" | "LOGO" | "ORGANIZATION_CHART", { height: number; label: string; width: number }> = {
  HERO: { height: 600, label: "히어로 이미지", width: 1600 },
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
  ? new Intl.DateTimeFormat("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).format(isoToDate(value))
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
  const { toast } = useToast();
  const setError = useCallback((message: string | null) => { if (message) toast({type: "error", message}); }, [toast]);
  const [createOpen, setCreateOpen] = useState(false);
  const [createDraft, setCreateDraft] = useState<BlockDraft>(emptyDraft());
  const [orderedBlocks, setOrderedBlocks] = useState<ContentBlockRecord[]>([]);
  const [orderSaving, setOrderSaving] = useState(false);
  const [imageUploading, setImageUploading] = useState(false);
  const [imagePreview, setImagePreview] = useState<{ url: string; field: "ko" | "en"; target: "create" | "draft" } | null>(null);
  useEffect(() => () => { if (imagePreview) URL.revokeObjectURL(imagePreview.url); }, [imagePreview]);
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
      setDraft((current) => current.type === categoryMeta[category].createType ? current : draftForCategory(category));
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

  const isDirty = JSON.stringify(normalizeDraft(draft)) !== JSON.stringify(normalizeDraft(selectedBlock ? draftFromBlock(selectedBlock) : draftForCategory(category)));

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
    setImagePreview({ url: URL.createObjectURL(file), target, field });
    await uploadImage(file, (imageReference) => {
      const key = field === "en" ? "imageUrlEn" : "imageUrl";
      if (target === "draft") setDraft((current) => ({ ...current, [key]: imageReference }));
      else setCreateDraft((current) => ({ ...current, [key]: imageReference }));
    });
    setImagePreview(null);
  };

  const persistBlockOrder = async (reorderedCategory: ContentBlockRecord[], previous: ContentBlockRecord[]) => {
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

  const handleDragEnd = async ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id || isDirty || saving || orderSaving) return;
    const categoryBlocks = blocks.filter((block) => categoryMeta[category].types.includes(block.type));
    const oldIndex = categoryBlocks.findIndex((block) => block.contentBlockId === active.id);
    const newIndex = categoryBlocks.findIndex((block) => block.contentBlockId === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    await persistBlockOrder(
      arrayMove(categoryBlocks, oldIndex, newIndex).map((block, sortOrder) => ({ ...block, sortOrder })),
      blocks,
    );
  };


  const selectBlock = async (block: ContentBlockRecord) => {
    if (imageUploading || saving) return;
    if (block.contentBlockId === selectedId) return;
    if (isDirty) {
      const discard = await confirm({ title: "저장하지 않은 변경 사항을 버릴까요?", confirmLabel: "변경 사항 버리기", tone: "danger" });
      if (!discard) return;
    }
    setError(null);
    setSelectedId(block.contentBlockId);
  };

  const changeCategory = async (nextCategory: ContentCategory) => {
    if (imageUploading || saving) return;
    if (nextCategory === category) return;
    if (isDirty) {
      const discard = await confirm({ title: "저장하지 않은 변경 사항을 버릴까요?", confirmLabel: "변경 사항 버리기", tone: "danger" });
      if (!discard) return;
    }
    setError(null);
    const nextBlock = blocks.find((block) => categoryMeta[nextCategory].types.includes(block.type));
    setSelectedId(nextBlock?.contentBlockId ?? null);
    setDraft(nextBlock ? draftFromBlock(nextBlock) : draftForCategory(nextCategory));
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
    if (!draft.titleKo.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const block = selectedBlock ?? await apiClient.createContentBlock(normalizeDraft(draft));
      setSelectedId(block.contentBlockId);
      if (!selectedBlock) await refresh();
      if (selectedBlock) await apiClient.updateContentBlock(block.contentBlockId, normalizeDraft(draft) as UpdateContentBlockRequest);
      await apiClient.publishContentBlock(block.contentBlockId);
      await refresh();
      toast({ type: "success", message: "설정을 저장했습니다." });
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
      warning: "삭제한 항목은 복구할 수 없습니다.",
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


  return <AdminPageShell>
    {ConfirmDialog}
    <AdminPageMain className="admin-site-content !max-w-6xl">
      <AdminPageHeader title="사이트 설정" />

      <AdminEditorGuidance>
        <p>복잡한 콘텐츠 편집과 정렬은 데스크톱에서 계속하는 것을 권장합니다. 모바일에서 입력 중이라면 저장 전 페이지를 이동하지 마세요.</p>
      </AdminEditorGuidance>


      <div className="flex min-w-0 flex-wrap items-center gap-3">
        <SegmentedControl
          variant="underline" role="tablist"
          ariaLabel="사이트 설정 영역"
          value={category}
          onChange={(value) => void changeCategory(value as ContentCategory)}
          className="min-w-0 flex-1"
          options={Object.entries(categoryMeta).map(([value, meta]) => ({ value, label: meta.label, disabled: imageUploading || saving }))}
        />
        {!categoryMeta[category].singleton ? <Button type="button" onClick={() => { setCreateDraft(draftForCategory(category)); setCreateOpen(true); }}>{categoryMeta[category].createLabel}</Button> : null}
      </div>

      <div className={cn("grid min-h-[42rem] content-start gap-4 [overflow-anchor:none]", !categoryMeta[category].singleton && "xl:grid-cols-[280px_minmax(0,1fr)]")}>
        {!categoryMeta[category].singleton ? <AdminCard className="admin-site-content__list self-start xl:sticky xl:top-6">
          <AdminCardHeader className="!min-h-9 !pb-0"><AdminMetaText>{filteredBlocks.length}개 표시</AdminMetaText></AdminCardHeader>
          <div className="scrollbar-hidden max-h-none overflow-y-visible p-2 sm:max-h-[680px] sm:overflow-y-auto">
            {blocksQuery.isLoading && !blocksQuery.data ? <AdminLoadingState className="min-h-24 px-2 py-6" />
              : filteredBlocks.length === 0 ? <AdminEmptyState message="조건에 맞는 콘텐츠가 없습니다." />
              : <DndContext modifiers={[restrictListDrag]} autoScroll sensors={sensors} collisionDetection={closestCenter} onDragEnd={(event) => void handleDragEnd(event)}><SortableContext items={filteredBlocks.map((block) => block.contentBlockId)} strategy={verticalListSortingStrategy}><div className="grid gap-1">{filteredBlocks.map((block) => <SortableContentBlockItem key={block.contentBlockId} block={block} selected={block.contentBlockId === selectedId} disabled={isDirty || saving || orderSaving} sortable={!categoryMeta[category].singleton} onSelect={() => void selectBlock(block)} />)}</div></SortableContext></DndContext>}
            {orderSaving ? <p className="px-3 pb-3 pt-2 text-xs font-normal text-[#344054]">노출 순서를 저장하는 중입니다.</p> : null}
          </div>
        </AdminCard> : null}

        {selectedBlock || categoryMeta[category].singleton ? <div className="admin-site-content__editor min-w-0 space-y-4">
          <AdminCard>
            {!categoryMeta[category].singleton ? <AdminCardHeader>
              <AdminSectionTitle className="truncate !text-base !font-semibold">{selectedBlock?.titleKo}</AdminSectionTitle>
              <Button type="button" variant="ghost" size="sm" className="text-slate-500 hover:bg-rose-50 hover:text-rose-600" onClick={() => void deleteBlock()} disabled={saving}>삭제</Button>
            </AdminCardHeader> : null}
            <div className="grid gap-5 p-4 sm:p-5">
              {!isImageOnlyType(draft.type) ? <div className="grid gap-4 lg:grid-cols-2">
                <AdminFormField label="한국어 제목"><UiInput value={draft.titleKo} onChange={(event) => { const value = event.currentTarget.value; setDraft((current) => ({ ...current, titleKo: value })); }} /></AdminFormField>
                <AdminFormField label="영문 제목"><UiInput value={draft.titleEn} onChange={(event) => { const value = event.currentTarget.value; setDraft((current) => ({ ...current, titleEn: value })); }} /></AdminFormField>
                {draft.type !== "QUICK_LINK" ? <AdminFormField label="한국어 본문"><UiTextarea className="min-h-32" value={draft.bodyKo} onChange={(event) => { const value = event.currentTarget.value; setDraft((current) => ({ ...current, bodyKo: value })); }} /></AdminFormField> : null}
                {draft.type !== "QUICK_LINK" ? <AdminFormField label="영문 본문"><UiTextarea className="min-h-32" value={draft.bodyEn} onChange={(event) => { const value = event.currentTarget.value; setDraft((current) => ({ ...current, bodyEn: value })); }} /></AdminFormField> : null}
                {draft.type === "PLEDGE" ? <AdminFormField label="이행 상태"><AdminSelectDropdown ariaLabel="이행 상태" value={draft.pledgeStatus ?? "PLANNED"} options={pledgeStatusOptions} onChange={(value) => setDraft((current) => ({ ...current, pledgeStatus: value as BlockDraft["pledgeStatus"] }))} /></AdminFormField> : null}
              </div> : null}
              <div className="grid gap-4">
                {!isImageOnlyType(draft.type) && draft.type !== "PLEDGE" ? <AdminFormField label="링크 URL"><div className="relative"><Link2 aria-hidden="true" className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" /><UiInput type="url" className="w-full pl-9" value={draft.linkUrl} onChange={(event) => { const value = event.currentTarget.value; setDraft((current) => ({ ...current, linkUrl: value })); }} placeholder="https://" /></div></AdminFormField> : null}
                {isImageOnlyType(draft.type) ? <ContentImageInput spec={getImageSpec(draft.type)!} value={imagePreview?.target === "draft" && imagePreview.field === "ko" ? imagePreview.url : draft.imageUrl} secondaryValue={draft.type === "ORGANIZATION_CHART" ? (imagePreview?.target === "draft" && imagePreview.field === "en" ? imagePreview.url : draft.imageUrlEn) : undefined} secondaryLabel={draft.type === "ORGANIZATION_CHART" ? "영문 조직도" : undefined} uploading={imageUploading} onSelect={(file) => requestImageCrop("draft", draft.type, file)} onSecondarySelect={(file) => requestImageCrop("draft", draft.type, file, "en")} onRemove={() => setDraft((current) => ({ ...current, imageUrl: "" }))} onSecondaryRemove={() => setDraft((current) => ({ ...current, imageUrlEn: "" }))} /> : null}
              </div>
            </div>
            <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-5 py-4">
              <span className="text-xs text-slate-500">{selectedBlock ? `마지막 수정 ${formatDateTime(selectedBlock.updatedAt)}` : ""}</span>
              <Button loading={saving} type="button" onClick={() => void applyBlock()} disabled={saving || imageUploading || !isDirty || !draft.titleKo.trim() || (isImageOnlyType(draft.type) && !draft.imageUrl.trim())}>저장</Button>
            </div>
          </AdminCard>
        </div> : <AdminCard className="grid min-h-[420px] place-items-center"><AdminEmptyState message="관리할 콘텐츠를 선택하거나 새로 만드세요." /></AdminCard>}
      </div>
    </AdminPageMain>

    <Modal open={createOpen} onClose={() => { if (!imageUploading && !saving) setCreateOpen(false); }} title={categoryMeta[category].createLabel} mobileFullscreen size="standard" bodyClassName="space-y-4" footer={<><Button type="button" variant="outline" disabled={imageUploading || saving} onClick={() => setCreateOpen(false)}>취소</Button><Button loading={saving} type="button" onClick={() => void createBlock()} disabled={saving || imageUploading || !createDraft.titleKo.trim() || (isImageOnlyType(createDraft.type) && !createDraft.imageUrl.trim())}>{"추가"}</Button></>}>
      <div className="grid gap-4">
        {!isImageOnlyType(createDraft.type) ? <AdminFormField label="한국어 제목"><UiInput value={createDraft.titleKo} onChange={(event) => { const value = event.currentTarget.value; setCreateDraft((current) => ({ ...current, titleKo: value })); }} placeholder="공개 화면에 표시할 제목" /></AdminFormField> : null}
        {!isImageOnlyType(createDraft.type) ? <AdminFormField label="영문 제목"><UiInput value={createDraft.titleEn} onChange={(event) => { const value = event.currentTarget.value; setCreateDraft((current) => ({ ...current, titleEn: value })); }} /></AdminFormField> : null}
        {!isImageOnlyType(createDraft.type) && createDraft.type !== "QUICK_LINK" ? <AdminFormField label="한국어 본문"><UiTextarea className="min-h-24" value={createDraft.bodyKo} onChange={(event) => { const value = event.currentTarget.value; setCreateDraft((current) => ({ ...current, bodyKo: value })); }} /></AdminFormField> : null}
        {!isImageOnlyType(createDraft.type) && createDraft.type !== "QUICK_LINK" ? <AdminFormField label="영문 본문"><UiTextarea className="min-h-24" value={createDraft.bodyEn} onChange={(event) => { const value = event.currentTarget.value; setCreateDraft((current) => ({ ...current, bodyEn: value })); }} /></AdminFormField> : null}
        {createDraft.type === "PLEDGE" ? <AdminFormField label="이행 상태"><AdminSelectDropdown ariaLabel="이행 상태" value={createDraft.pledgeStatus ?? "PLANNED"} options={pledgeStatusOptions} onChange={(value) => setCreateDraft((current) => ({ ...current, pledgeStatus: value as BlockDraft["pledgeStatus"] }))} /></AdminFormField> : null}
        {!isImageOnlyType(createDraft.type) && createDraft.type !== "PLEDGE" ? <AdminFormField label="링크 URL"><div className="relative"><Link2 aria-hidden="true" className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" /><UiInput type="url" className="w-full pl-9" value={createDraft.linkUrl} onChange={(event) => { const value = event.currentTarget.value; setCreateDraft((current) => ({ ...current, linkUrl: value })); }} placeholder="https://" /></div></AdminFormField> : null}
        {isImageOnlyType(createDraft.type) ? <ContentImageInput spec={getImageSpec(createDraft.type)!} value={imagePreview?.target === "create" && imagePreview.field === "ko" ? imagePreview.url : createDraft.imageUrl} secondaryValue={createDraft.type === "ORGANIZATION_CHART" ? (imagePreview?.target === "create" && imagePreview.field === "en" ? imagePreview.url : createDraft.imageUrlEn) : undefined} secondaryLabel={createDraft.type === "ORGANIZATION_CHART" ? "영문 조직도" : undefined} uploading={imageUploading} onSelect={(file) => requestImageCrop("create", createDraft.type, file)} onSecondarySelect={(file) => requestImageCrop("create", createDraft.type, file, "en")} onRemove={() => setCreateDraft((current) => ({ ...current, imageUrl: "" }))} onSecondaryRemove={() => setCreateDraft((current) => ({ ...current, imageUrlEn: "" }))} /> : null}
      </div>
    </Modal>
    {cropRequest ? <ImageCropModal aspectRatio={getImageSpec(cropRequest.type)!.width / getImageSpec(cropRequest.type)!.height} file={cropRequest.file} outputHeight={getImageSpec(cropRequest.type)!.height} outputWidth={getImageSpec(cropRequest.type)!.width} onCancel={() => setCropRequest(null)} onComplete={applyCroppedImage} /> : null}
  </AdminPageShell>;
}

function ContentImageInput({ onRemove, onSecondaryRemove, onSecondarySelect, onSelect, secondaryLabel, secondaryValue, spec, uploading, value }: {
  onRemove: () => void;
  onSecondaryRemove?: () => void;
  onSecondarySelect?: (file: File) => void;
  onSelect: (file: File) => void;
  secondaryLabel?: string;
  secondaryValue?: string;
  spec: { height: number; label: string; width: number };
  uploading: boolean;
  value: string;
}) {
  const renderSlot = (key: string, label: string | null, slotValue: string, select: (file: File) => void, remove: (() => void) | undefined) => (
    <div key={key} className="space-y-2">
      <p className="text-sm font-medium text-slate-700">{label ?? spec.label}</p>
      <ImageUploadField alt={(label ?? spec.label) + " 미리보기"} accept="image/*" aspectRatio={spec.width / spec.height}
        metadata={"권장 " + spec.width + " × " + spec.height + " px"} imageUrl={slotValue ? resolveAssetUrl(slotValue) : undefined} disabled={uploading}
        selectLabel={(label ?? spec.label) + " 업로드"} removeLabel={(label ?? spec.label) + " 제거"} onSelect={select} onRemove={() => remove?.()} />
    </div>
  );

  const hasSecondary = Boolean(secondaryLabel && onSecondarySelect);
  return <div className="space-y-4">
    <div className={cn("grid gap-6", hasSecondary && "lg:grid-cols-2")}>
      {renderSlot("primary", hasSecondary ? "한국어 조직도" : null, value, onSelect, onRemove)}
      {hasSecondary ? renderSlot("secondary", secondaryLabel!, secondaryValue ?? "", onSecondarySelect!, onSecondaryRemove) : null}
    </div>
  </div>;
}

function SortableContentBlockItem({ block, disabled, onSelect, selected, sortable }: { block: ContentBlockRecord; disabled: boolean; onSelect: () => void; selected: boolean; sortable: boolean }) {
  const { attributes, isDragging, listeners, setNodeRef, transform, transition } = useSortable({ id: block.contentBlockId, disabled: disabled || !sortable });
  const style: CSSProperties = { transform: CSS.Translate.toString(transform), transition };
  return <div ref={setNodeRef} style={style} className={cn("group flex min-w-0 w-full select-none items-stretch overflow-hidden rounded-lg", selected ? "bg-slate-100 font-medium" : "hover:bg-slate-50", isDragging && "z-10 opacity-40")}>
    {sortable ? <button type="button" {...attributes} {...listeners} disabled={disabled} className="admin-list-drag-handle self-center ml-1 mr-1 disabled:cursor-default disabled:opacity-30" aria-label={`${block.titleKo} 노출 순서 변경`}><GripVertical aria-hidden="true" className="size-4" /></button> : null}
    <button type="button" onClick={onSelect} className={cn("min-w-0 flex-1 overflow-hidden pl-0 pr-2 py-3 text-left", selected && "!font-medium", sortable ? "rounded-none" : "rounded-lg")}>
      <span className="flex min-w-0 items-center justify-between gap-3"><span className="min-w-0 flex-1 truncate text-sm text-[#172033]">{block.titleKo}</span></span>
    </button>

  </div>;
}
