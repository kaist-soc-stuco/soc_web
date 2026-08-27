import { createApiClient } from "@soc/api-client";
import { PERMISSION_REGISTRY, type BoardCreateRequest, type BoardSummary } from "@soc/contracts";
import {
  closestCenter,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { createPortal } from "react-dom";
import { GripVertical, Plus, RotateCcw, Save, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { AuthGuard } from "@/components/guards/auth-guard";
import { AdminDataTable, AdminTableBody, AdminTableCell, AdminTableEmpty, AdminTableHead, AdminTableHeader } from "@/components/ui/admin-data-table";
import { AdminDrawer } from "@/components/ui/admin-drawer";
import { AdminSelectDropdown } from "@/components/ui/admin-select";
import { AdminCard, AdminFormField, AdminPageHeader, AdminPageMain, AdminPageShell, AdminStickyActionBar } from "@/components/ui/admin-page";
import { AdminStatusBadge } from "@/components/ui/admin-status-badge";
import { Button } from "@/components/ui/button";
import { useConfirmDialog } from "@/components/ui/confirm-dialog";
import { UiInput } from "@/components/ui/form-control";
import { resolveApiBaseUrl } from "@/lib/api-base-url";
import { Permissions } from "@/lib/permissions";
import { cn } from "@/lib/utils";

const permissionOptions = [
  { bit: 0, label: "제한 없음" },
  ...PERMISSION_REGISTRY
    .filter((permission) => permission.code === "WRITE_OFFICIAL" || permission.code === "WRITE_LAB")
    .map((permission) => ({ bit: permission.bit, label: permission.labelKo })),
];

type BoardFormValues = Omit<BoardCreateRequest, "descriptionKo" | "descriptionEn"> & { isActive: boolean };

const createEmptyForm = (sortOrder = 0): BoardFormValues => ({
  allowComment: true,
  allowGuestRead: true,
  allowLike: true,
  allowSecret: false,
  code: "",
  isActive: true,
  nameEn: "",
  nameKo: "",
  sortOrder,
  writePermissionBit: 0,
});

export function BoardManagementPage() {
  return <AuthGuard requirePermission={Permissions.MANAGE_BOARDS}><BoardManagementPageContent /></AuthGuard>;
}

function BoardManagementPageContent() {
  const apiClient = useMemo(() => createApiClient({ baseUrl: resolveApiBaseUrl() }), []);
  const { confirm: requestConfirm, ConfirmDialog } = useConfirmDialog();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const [boards, setBoards] = useState<BoardSummary[]>([]);
  const [savedOrder, setSavedOrder] = useState<string[]>([]);
  const [form, setForm] = useState<BoardFormValues>(createEmptyForm());
  const [editingCode, setEditingCode] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [activeBoardCode, setActiveBoardCode] = useState<string | null>(null);
  const [activeDragWidth, setActiveDragWidth] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  const orderDirty = boards.map((board) => board.code).join("|") !== savedOrder.join("|");
  const activeBoard = activeBoardCode
    ? boards.find((board) => board.code === activeBoardCode) ?? null
    : null;

  const loadBoards = async () => {
    setLoading(true);
    try {
      const response = await apiClient.getAdminBoards();
      const visibleBoards = response.items.filter((board) => board.code !== "_EVENT");
      setBoards(visibleBoards);
      setSavedOrder(visibleBoards.map((board) => board.code));
      setMessage(null);
    } catch {
      setMessage({ tone: "error", text: "게시판 목록을 불러오지 못했습니다." });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadBoards(); }, []);

  const startCreate = () => {
    setEditingCode(null);
    setForm(createEmptyForm(boards.length * 10));
    setFormOpen(true);
  };

  const startEdit = (board: BoardSummary) => {
    setEditingCode(board.code);
    setForm({
      allowComment: board.allowComment,
      allowGuestRead: board.allowGuestRead,
      allowLike: board.allowLike,
      allowSecret: board.allowSecret,
      code: board.code,
      isActive: board.isActive,
      nameEn: board.nameEn ?? "",
      nameKo: board.nameKo,
      sortOrder: board.sortOrder,
      writePermissionBit: board.writePermissionBit,
    });
    setFormOpen(true);
  };

  const saveBoard = async () => {
    if (!form.code.trim() || !form.nameKo.trim()) {
      setMessage({ tone: "error", text: "게시판 코드와 한글 이름을 입력해 주세요." });
      return;
    }
    setSaving(true);
    try {
      if (editingCode) {
        const { code: _code, ...update } = form;
        await apiClient.updateBoard(editingCode, update);
      } else {
        const { isActive: _isActive, ...createInput } = form;
        await apiClient.createBoard({ ...createInput, code: form.code.trim() });
      }
      setFormOpen(false);
      setMessage({ tone: "success", text: "게시판 설정을 저장했습니다." });
      await loadBoards();
    } catch {
      setMessage({ tone: "error", text: "게시판 설정을 저장하지 못했습니다." });
    } finally {
      setSaving(false);
    }
  };

  const removeBoard = async () => {
    if (!editingCode) return;
    const board = boards.find((item) => item.code === editingCode);
    if (!board) return;
    const approved = await requestConfirm({
      title: "게시판 삭제",
      description: <>정말 <strong className="font-semibold text-slate-900">“{board.nameKo}”</strong> 게시판을 영구 삭제할까요?</>,
      warning: "(게시판의 게시글과 초안도 함께 삭제되며 영구히 복구할 수 없습니다.)",
      confirmLabel: "삭제하기",
      tone: "danger",
    });
    if (!approved) return;

    setSaving(true);
    try {
      await apiClient.deleteBoard(editingCode);
      setFormOpen(false);
      setEditingCode(null);
      setMessage({ tone: "success", text: "게시판을 영구 삭제했습니다." });
      await loadBoards();
    } catch {
      setMessage({ tone: "error", text: "게시판을 삭제하지 못했습니다. 잠시 후 다시 시도해 주세요." });
    } finally {
      setSaving(false);
    }
  };

  const handleDragStart = ({ active }: DragStartEvent) => {
    setActiveBoardCode(String(active.id));
    setActiveDragWidth(active.rect.current.initial?.width ?? null);
  };

  const handleDragCancel = () => {
    setActiveBoardCode(null);
    setActiveDragWidth(null);
  };

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    const activeId = String(active.id);
    const overId = over ? String(over.id) : null;
    handleDragCancel();
    if (!overId || activeId === overId) return;

    setBoards((current) => {
      const oldIndex = current.findIndex((board) => board.code === activeId);
      const newIndex = current.findIndex((board) => board.code === overId);
      if (oldIndex < 0 || newIndex < 0) return current;
      return arrayMove(current, oldIndex, newIndex);
    });
  };

  const saveOrder = async () => {
    setSaving(true);
    try {
      const response = await apiClient.reorderBoards({ items: boards.map((board, index) => ({ code: board.code, sortOrder: index * 10 })) });
      const visibleBoards = response.items.filter((board) => board.code !== "_EVENT");
      setBoards(visibleBoards);
      setSavedOrder(visibleBoards.map((board) => board.code));
      setMessage({ tone: "success", text: "게시판 노출 순서를 저장했습니다." });
    } catch {
      setMessage({ tone: "error", text: "게시판 순서를 저장하지 못했습니다." });
    } finally {
      setSaving(false);
    }
  };

  return <AdminPageShell>
    {ConfirmDialog}
    <AdminPageMain>
      <AdminPageHeader title="게시판 관리" actions={<Button type="button" onClick={startCreate}><Plus aria-hidden="true" /> 게시판 추가</Button>} />
      {message ? <div role="status" className={cn("rounded-lg border px-4 py-3 text-sm font-medium", message.tone === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-rose-200 bg-rose-50 text-rose-700")}>{message.text}</div> : null}

      <AdminCard>
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragCancel={handleDragCancel}
          onDragEnd={handleDragEnd}
        >
          <AdminDataTable minWidth={780} className={loading && boards.length > 0 ? "opacity-60 transition-opacity" : undefined}>
            <colgroup><col style={{ width: 52 }} /><col style={{ width: 360 }} /><col style={{ width: 280 }} /><col style={{ width: 100 }} /></colgroup>
            <AdminTableHeader><tr><AdminTableHead><span className="sr-only">순서</span></AdminTableHead><AdminTableHead>게시판</AdminTableHead><AdminTableHead>운영 설정</AdminTableHead><AdminTableHead>상태</AdminTableHead></tr></AdminTableHeader>
            <AdminTableBody>
              {loading && boards.length === 0 ? <tr><AdminTableCell colSpan={4} className="py-16 text-center">불러오는 중...</AdminTableCell></tr>
                : boards.length === 0 ? <AdminTableEmpty colSpan={4}>등록된 게시판이 없습니다.</AdminTableEmpty>
                : <SortableContext items={boards.map((board) => board.code)} strategy={verticalListSortingStrategy}>
                  {boards.map((board) => <SortableBoardRow key={board.boardId} board={board} disabled={saving} onOpen={startEdit} />)}
                </SortableContext>}
            </AdminTableBody>
          </AdminDataTable>
          {typeof document !== "undefined"
            ? createPortal(
                <DragOverlay dropAnimation={{ duration: 200, easing: "ease" }}>
                  {activeBoard ? <BoardDragPreview board={activeBoard} width={activeDragWidth} /> : null}
                </DragOverlay>,
                document.body,
              )
            : null}
        </DndContext>
      </AdminCard>

      {orderDirty ? <AdminStickyActionBar><p className="text-sm font-medium text-slate-700">변경한 게시판 노출 순서를 저장해 주세요.</p><div className="flex gap-2"><Button type="button" variant="outline" onClick={() => setBoards((current) => savedOrder.map((code) => current.find((board) => board.code === code)).filter((board): board is BoardSummary => Boolean(board)))} disabled={saving}><RotateCcw aria-hidden="true" /> 되돌리기</Button><Button type="button" onClick={() => void saveOrder()} disabled={saving}><Save aria-hidden="true" /> 순서 저장</Button></div></AdminStickyActionBar> : null}
    </AdminPageMain>

    <AdminDrawer
      open={formOpen}
      onClose={() => setFormOpen(false)}
      title={editingCode ? "게시판 설정" : "새 게시판"}
      width="max-w-2xl"
      footer={<div className="flex items-center justify-between gap-2"><div>{editingCode ? <Button type="button" variant="ghost" className="text-rose-600 hover:bg-rose-50 hover:text-rose-700" onClick={() => void removeBoard()} disabled={saving}><Trash2 aria-hidden="true" /> 게시판 삭제</Button> : null}</div><div className="flex gap-2"><Button type="button" variant="outline" onClick={() => setFormOpen(false)}>취소</Button><Button type="button" onClick={() => void saveBoard()} disabled={saving || !form.code.trim() || !form.nameKo.trim()}>{saving ? "저장 중" : "저장"}</Button></div></div>}
    >
      <div className="space-y-8">
        <section className="space-y-4">
          <h3 className="text-sm font-semibold text-slate-900">기본 정보</h3>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2"><AdminFormField label="게시판 코드"><UiInput value={form.code} disabled={Boolean(editingCode)} onChange={(event) => setForm((current) => ({ ...current, code: event.currentTarget.value }))} placeholder="notice" /></AdminFormField></div>
            <AdminFormField label="이름 (한글)"><UiInput value={form.nameKo} onChange={(event) => setForm((current) => ({ ...current, nameKo: event.currentTarget.value }))} /></AdminFormField>
            <AdminFormField label="Name (English)"><UiInput value={form.nameEn ?? ""} onChange={(event) => setForm((current) => ({ ...current, nameEn: event.currentTarget.value }))} /></AdminFormField>
          </div>
          <Toggle label="공개 여부" checked={form.isActive} onChange={(checked) => setForm((current) => ({ ...current, isActive: checked }))} />
        </section>

        <section className="space-y-4 border-t border-slate-100 pt-6">
          <h3 className="text-sm font-semibold text-slate-900">작성 권한</h3>
          <div className="max-w-sm"><PermissionSelect label="작성 권한" value={form.writePermissionBit} onChange={(value) => setForm((current) => ({ ...current, writePermissionBit: value }))} /></div>
        </section>

        <section className="space-y-4 border-t border-slate-100 pt-6">
          <h3 className="text-sm font-semibold text-slate-900">게시판 기능</h3>
          <div className="grid gap-2 md:grid-cols-2"><Toggle label="댓글 허용" checked={form.allowComment} onChange={(checked) => setForm((current) => ({ ...current, allowComment: checked }))} /><Toggle label="비밀글 허용" checked={form.allowSecret} onChange={(checked) => setForm((current) => ({ ...current, allowSecret: checked }))} /><Toggle label="추천 및 스크랩" checked={form.allowLike} onChange={(checked) => setForm((current) => ({ ...current, allowLike: checked }))} /><Toggle label="비로그인 열람 허용" checked={form.allowGuestRead} onChange={(checked) => setForm((current) => ({ ...current, allowGuestRead: checked }))} /></div>
        </section>

      </div>
    </AdminDrawer>
  </AdminPageShell>;
}

function SortableBoardRow({ board, disabled, onOpen }: { board: BoardSummary; disabled: boolean; onOpen: (board: BoardSummary) => void }) {
  const { attributes, isDragging, listeners, setActivatorNodeRef, setNodeRef, transform, transition } = useSortable({ id: board.code, disabled });
  const style = { transform: CSS.Transform.toString(transform), transition: transition ?? "transform 200ms ease", willChange: isDragging ? "transform" : undefined };

  return <tr ref={setNodeRef} style={style} className={cn("transition-colors hover:bg-slate-50/60", isDragging && "relative z-0 opacity-0")} onClick={() => onOpen(board)} onKeyDown={(event) => { if (event.target !== event.currentTarget) return; if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onOpen(board); } }} tabIndex={0}>
    <AdminTableCell className="text-center"><button ref={setActivatorNodeRef} type="button" aria-label={`${board.nameKo} 순서 이동`} title="드래그하여 순서 변경" {...attributes} {...listeners} onClick={(event) => event.stopPropagation()} className="flex size-7 touch-none cursor-grab items-center justify-center rounded-md border-0 bg-transparent p-0 text-kaist-grey/35 transition-colors hover:bg-slate-100 hover:text-kaist-grey/80 active:cursor-grabbing"><GripVertical aria-hidden="true" className="size-4" /></button></AdminTableCell>
    <AdminTableCell truncate><span className="admin-table-text-emphasis block truncate">{board.nameKo}</span><span className="admin-table-text mt-0.5 block truncate">{board.code}{board.nameEn ? ` · ${board.nameEn}` : ""}</span></AdminTableCell>
    <AdminTableCell truncate>{[board.allowComment && "댓글", board.allowSecret && "비밀글", board.allowLike && "추천·스크랩"].filter(Boolean).join(" · ") || "추가 기능 없음"}</AdminTableCell>
    <AdminTableCell>{board.isActive ? <AdminStatusBadge tone="positive">활성</AdminStatusBadge> : <AdminStatusBadge>비활성</AdminStatusBadge>}</AdminTableCell>
  </tr>;
}

function BoardDragPreview({ board, width }: { board: BoardSummary; width: number | null }) {
  return <div style={{ width: width ?? undefined }} className="relative z-50 grid cursor-grabbing grid-cols-[52px_minmax(0,1.5fr)_minmax(180px,1.2fr)_100px] items-center rounded-lg border border-brand-primary/45 bg-white px-0 shadow-lg">
    <div className="flex h-16 items-center justify-center text-brand-primary"><GripVertical aria-hidden="true" className="size-4" /></div>
    <div className="min-w-0 px-4"><p className="truncate text-sm font-semibold text-slate-900">{board.nameKo}</p><p className="truncate text-xs text-slate-500">{board.code}{board.nameEn ? ` · ${board.nameEn}` : ""}</p></div>
    <div className="truncate px-4 text-sm text-slate-700">{[board.allowComment && "댓글", board.allowSecret && "비밀글", board.allowLike && "추천·스크랩"].filter(Boolean).join(" · ") || "추가 기능 없음"}</div>
    <div className="px-4">{board.isActive ? <AdminStatusBadge tone="positive">활성</AdminStatusBadge> : <AdminStatusBadge>비활성</AdminStatusBadge>}</div>
  </div>;
}

function PermissionSelect({ label, onChange, value }: { label: string; onChange: (value: number) => void; value: number }) {
  return <AdminFormField label={label}><AdminSelectDropdown ariaLabel={label} value={String(value)} onChange={(nextValue) => onChange(Number(nextValue))} options={permissionOptions.map((option) => ({ value: String(option.bit), label: option.label }))} /></AdminFormField>;
}

function Toggle({ checked, label, onChange }: { checked: boolean; label: string; onChange: (checked: boolean) => void }) {
  return <div className="flex min-h-12 items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 text-sm font-medium text-slate-700"><span>{label}</span><button type="button" role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)} className={cn("relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors", checked ? "bg-brand-primary" : "bg-slate-200")}><span className={cn("pointer-events-none size-5 rounded-full bg-white shadow-sm transition-transform", checked ? "translate-x-5" : "translate-x-0")} /></button></div>;
}
