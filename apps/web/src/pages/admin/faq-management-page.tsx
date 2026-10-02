import { useAdminListQuery } from "@/hooks/use-admin-list-query";
import { restrictListDrag } from "@/lib/drag-bounds";
import type { ArticleListItem } from "@soc/contracts";
import { createApiClient } from "@soc/api-client";
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { AuthGuard } from "@/components/guards/auth-guard";
import {
  AdminDataTable,
  AdminTableBody,
  AdminTableCell,
  AdminTableEmpty,
  AdminTableHead,
  AdminTableHeader,
} from "@/components/ui/admin-data-table";
import {
  AdminPageHeader,
  AdminLoadingState,
  AdminPageMain,
  AdminPageShell,
  AdminTableCard,
} from "@/components/ui/admin-page";
import { AdminDrawer } from "@/components/ui/admin-drawer";
import { Button } from "@/components/ui/button";
import { useConfirmDialog } from "@/components/ui/confirm-dialog";
import { UiInput, UiTextarea } from "@/components/ui/form-control";
import { stripRichText } from "@/components/ui/rich-text-content";
import { useToast } from "@/components/ui/toast";
import { resolveApiBaseUrl } from "@/lib/api-base-url";
import { Permissions } from "@/lib/permissions";
import { cn } from "@/lib/utils";

type FaqForm = {
  titleKo: string;
  titleEn: string;
  contentKo: string;
  contentEn: string;
};

const emptyForm: FaqForm = {
  titleKo: "",
  titleEn: "",
  contentKo: "",
  contentEn: "",
};

export function FaqManagementPage() {
  return (
    <AuthGuard
      requirePermission={Permissions.MANAGE_SITE_CONTENT}
    >
      <FaqManagementPageContent />
    </AuthGuard>
  );
}

function FaqManagementPageContent() {
  const apiClient = useMemo(() => createApiClient({ baseUrl: resolveApiBaseUrl() }), []);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const { confirm: requestConfirm, ConfirmDialog } = useConfirmDialog();
  const { toast } = useToast();
  const faqQuery = useAdminListQuery({ resource: "faq", queryFn: async () => { const response = await apiClient.getArticles("faq", { page: 1, limit: 100 }); return [...response.items].sort(compareFaqOrder); } });
  const items = faqQuery.data ?? [];
  const setItems = faqQuery.setData;
  const loading = faqQuery.isPending;
  const [saving, setSaving] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ArticleListItem | null>(null);
  const [activeFaqId, setActiveFaqId] = useState<string | null>(null);
  const [form, setForm] = useState<FaqForm>(emptyForm);

  const loadItems = async () => { await faqQuery.refetch(); };
  useEffect(() => {
    if (faqQuery.isError) toast({ type: "error", message: "FAQ 목록을 불러오지 못했습니다." });
  }, [faqQuery.isError, toast]);

  const openCreate = () => {
    setEditingItem(null);
    setForm(emptyForm);
    setDrawerOpen(true);
  };

  const openEdit = (item: ArticleListItem) => {
    setEditingItem(item);
    setForm({
      titleKo: item.titleKo,
      titleEn: item.titleEn ?? "",
      contentKo: item.snippetKo ?? "",
      contentEn: item.snippetEn ?? "",
    });
    setDrawerOpen(true);
  };

  const save = async () => {
    if (!form.titleKo.trim() || !form.contentKo.trim()) return;
    setSaving(true);
    try {
      if (editingItem) {
        await apiClient.updateFaqArticle(editingItem.articleId, {
          titleKo: form.titleKo.trim(),
          titleEn: form.titleEn.trim() || undefined,
          contentKo: form.contentKo,
          contentEn: form.contentEn.trim() || undefined,
        });
      } else {
        await apiClient.createFaqArticle({
          titleKo: form.titleKo.trim(),
          titleEn: form.titleEn.trim() || undefined,
          contentKo: form.contentKo,
          contentEn: form.contentEn.trim() || undefined,
          visibilityScope: "PUBLIC",
          isSecret: false,
          isAnonymous: false,
          allowComment: false,
        });
      }
      setDrawerOpen(false);
      toast({ type: "success", message: "FAQ를 저장했습니다." });
      await loadItems();
    } catch {
      toast({ type: "error", message: "FAQ를 저장하지 못했습니다." });
    } finally {
      setSaving(false);
    }
  };

  const remove = async (item: ArticleListItem) => {
    const approved = await requestConfirm({
      title: "FAQ 삭제",
      description: <>정말 <strong className="font-semibold text-slate-900">“{item.titleKo}”</strong> FAQ를 삭제할까요?</>,
      warning: "삭제된 FAQ는 공개 목록에서 사라집니다.",
      confirmLabel: "삭제",
      tone: "danger",
    });
    if (!approved) return;

    setSaving(true);
    try {
      await apiClient.deleteFaqArticle(item.articleId);
      setItems((current) => current.filter((candidate) => candidate.articleId !== item.articleId));
      if (editingItem?.articleId === item.articleId) setDrawerOpen(false);
      toast({ type: "success", message: "FAQ를 삭제했습니다." });
    } catch {
      toast({ type: "error", message: "FAQ를 삭제하지 못했습니다." });
    } finally {
      setSaving(false);
    }
  };

  const handleDragEnd = async ({ active, over }: DragEndEvent) => {
    setActiveFaqId(null);
    if (!over || active.id === over.id || saving) return;
    const oldIndex = items.findIndex((item) => item.articleId === String(active.id));
    const newIndex = items.findIndex((item) => item.articleId === String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;

    const reordered = arrayMove(items, oldIndex, newIndex);
    setItems(reordered);
    setSaving(true);
    try {
      await apiClient.reorderFaqArticles({
        items: reordered.map((item, sortOrder) => ({ articleId: item.articleId, sortOrder })),
      });
      toast({ type: "success", message: "FAQ 노출 순서를 저장했습니다." });
    } catch {
      setItems(items);
      toast({ type: "error", message: "FAQ 노출 순서를 저장하지 못했습니다." });
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminPageShell>
      {ConfirmDialog}
      <AdminPageMain tableLayout className="!max-w-5xl">
        <AdminPageHeader
          title="FAQ 관리"
          actions={(
            <Button type="button" onClick={openCreate}>
               FAQ 추가
            </Button>
          )}
        />
        <AdminTableCard refreshing={faqQuery.isFetching && !!faqQuery.data} className="min-w-0">
          {loading && items.length === 0 ? <AdminLoadingState /> : (
            <DndContext modifiers={[restrictListDrag]}
              autoScroll
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={({ active }) => setActiveFaqId(String(active.id))}
              onDragCancel={() => setActiveFaqId(null)}
              onDragEnd={(event) => void handleDragEnd(event)}
            >
              <AdminDataTable className="admin-sortable-table" minWidth={0} isDragging={Boolean(activeFaqId)}>
                <colgroup>
                  <col style={{ width: 36 }} />
                  <col />
                  <col style={{ width: "45%" }} />
                  <col style={{ width: 72 }} />
                </colgroup>
                <AdminTableHeader>
                  <tr>
                    <AdminTableHead><span className="sr-only">순서</span></AdminTableHead>
                    <AdminTableHead>질문</AdminTableHead>
                    <AdminTableHead>답변</AdminTableHead>
                    <AdminTableHead><span className="sr-only">작업</span></AdminTableHead>
                  </tr>
                </AdminTableHeader>
                <AdminTableBody>
                  {items.length === 0 ? (
                    <AdminTableEmpty colSpan={4}>등록된 FAQ가 없습니다.</AdminTableEmpty>
                  ) : (
                    <SortableContext items={items.map((item) => item.articleId)} strategy={verticalListSortingStrategy}>
                      {items.map((item) => (
                        <SortableFaqRow
                          key={item.articleId}
                          item={item}
                          disabled={saving}
                          onEdit={openEdit}
                          onDelete={(candidate) => void remove(candidate)}
                        />
                      ))}
                    </SortableContext>
                  )}
                </AdminTableBody>
              </AdminDataTable>
            </DndContext>
          )}
        </AdminTableCard>
      </AdminPageMain>

      <AdminDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
          title={editingItem ? "FAQ 편집" : "FAQ 추가"}
        footer={(
          <div className="flex w-full justify-end gap-2">
            {editingItem ? <Button type="button" variant="ghost" className="mr-auto text-rose-600 hover:bg-rose-50 hover:text-rose-700" disabled={saving} onClick={() => void remove(editingItem)}>삭제</Button> : null}
            <Button type="button" variant="outline" onClick={() => setDrawerOpen(false)}>취소</Button>
            <Button loading={saving} type="button" onClick={() => void save()} disabled={saving || !form.titleKo.trim() || !form.contentKo.trim()}>
              {editingItem ? "저장" : "추가"}
            </Button>
          </div>
        )}
      >
        <div className="space-y-5">
          <label className="grid gap-1.5 text-xs font-normal text-slate-600">
            질문
            <UiInput spellCheck={false} value={form.titleKo} onChange={(event) => { const value = event.currentTarget.value; setForm((current) => ({ ...current, titleKo: value })); }} />
          </label>
          <label className="grid gap-1.5 text-xs font-normal text-slate-600">
            질문 (영문)
            <UiInput spellCheck={false} value={form.titleEn} onChange={(event) => { const value = event.currentTarget.value; setForm((current) => ({ ...current, titleEn: value })); }} />
          </label>
          <label className="grid gap-1.5 text-xs font-normal text-slate-600">
            답변
            <UiTextarea autoResize={false} spellCheck={false} rows={10} value={form.contentKo} onChange={(event) => { const value = event.currentTarget.value; setForm((current) => ({ ...current, contentKo: value })); }} />
          </label>
          <label className="grid gap-1.5 text-xs font-normal text-slate-600">
            답변 (영문)
            <UiTextarea autoResize={false} spellCheck={false} rows={10} value={form.contentEn} onChange={(event) => { const value = event.currentTarget.value; setForm((current) => ({ ...current, contentEn: value })); }} />
          </label>
        </div>
      </AdminDrawer>
    </AdminPageShell>
  );
}

function compareFaqOrder(left: ArticleListItem, right: ArticleListItem) {
  return (left.pinOrder ?? Number.MAX_SAFE_INTEGER) - (right.pinOrder ?? Number.MAX_SAFE_INTEGER)
    || left.postedAt.localeCompare(right.postedAt);
}

function SortableFaqRow({
  item,
  disabled,
  onDelete,
  onEdit,
}: {
  item: ArticleListItem;
  disabled: boolean;
  onDelete: (item: ArticleListItem) => void;
  onEdit: (item: ArticleListItem) => void;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: item.articleId, disabled });
  return (
    <tr ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition: transition ?? "transform 180ms ease" }} className={cn("faq-management-row group cursor-pointer transition-colors hover:bg-slate-50/60", isDragging && "relative z-10 opacity-70")} tabIndex={disabled ? -1 : 0} onClick={() => { if (!disabled) onEdit(item); }} onKeyDown={(event) => { if (event.target === event.currentTarget && !disabled && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); onEdit(item); } }}>
      <AdminTableCell className="text-center">
        <button ref={setActivatorNodeRef} type="button" aria-label="FAQ 순서 이동" onClick={(event) => event.stopPropagation()} {...attributes} {...listeners} className="admin-list-drag-handle">
          <GripVertical className="size-4" aria-hidden="true" />
        </button>
      </AdminTableCell>
      <AdminTableCell><span className="admin-table-text-emphasis block truncate">{item.titleKo}</span></AdminTableCell>
      <AdminTableCell><span className="admin-table-text block truncate">{stripRichText(item.snippetKo)}</span></AdminTableCell>
      <AdminTableCell>
        <div className="admin-row-action flex items-center gap-1">
          <Button type="button" variant="ghost" size="icon" aria-label="FAQ 삭제" data-tooltip="FAQ 삭제" onClick={(event) => { event.stopPropagation(); onDelete(item); }} disabled={disabled} className="text-slate-400 hover:text-rose-600"><Trash2 aria-hidden="true" /></Button>
        </div>
      </AdminTableCell>
    </tr>
  );
}
