import { createApiClient } from "@soc/api-client";
import { PERMISSION_REGISTRY, type BoardCreateRequest, type BoardSummary } from "@soc/contracts";
import { GripVertical, Pencil, Plus, RotateCcw, Save, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { AuthGuard } from "@/components/guards/auth-guard";
import { AdminDataTable, AdminTableBody, AdminTableCell, AdminTableEmpty, AdminTableHead, AdminTableHeader } from "@/components/ui/admin-data-table";
import { AdminSelectDropdown } from "@/components/ui/admin-select";
import { AdminCard, AdminCardHeader, AdminFormField, AdminMetaText, AdminPageHeader, AdminPageMain, AdminPageShell, AdminSectionTitle, AdminStickyActionBar } from "@/components/ui/admin-page";
import { AdminStatusBadge } from "@/components/ui/admin-status-badge";
import { Button } from "@/components/ui/button";
import { useConfirmDialog } from "@/components/ui/confirm-dialog";
import { UiInput } from "@/components/ui/form-control";
import { IconButton } from "@/components/ui/icon-button";
import { Modal } from "@/components/ui/modal";
import { resolveApiBaseUrl } from "@/lib/api-base-url";
import { Permissions } from "@/lib/permissions";
import { cn } from "@/lib/utils";

const permissionOptions = [
  { bit: 0, label: "제한 없음" },
  ...PERMISSION_REGISTRY.map((permission) => ({ bit: permission.bit, label: permission.labelKo })),
];

const createEmptyForm = (sortOrder = 0): BoardCreateRequest => ({
  allowComment: true,
  allowLike: true,
  allowSecret: false,
  code: "",
  commentPermissionBit: 0,
  descriptionEn: "",
  descriptionKo: "",
  managePermissionBit: 0,
  nameEn: "",
  nameKo: "",
  readScope: "PUBLIC",
  sortOrder,
  writePermissionBit: 0,
});

export function BoardManagementPage() {
  return <AuthGuard requirePermission={Permissions.ADMIN}><BoardManagementPageContent /></AuthGuard>;
}

function BoardManagementPageContent() {
  const apiClient = useMemo(() => createApiClient({ baseUrl: resolveApiBaseUrl() }), []);
  const { confirm, ConfirmDialog } = useConfirmDialog();
  const [boards, setBoards] = useState<BoardSummary[]>([]);
  const [savedOrder, setSavedOrder] = useState<string[]>([]);
  const [form, setForm] = useState<BoardCreateRequest>(createEmptyForm());
  const [editingCode, setEditingCode] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [draggingCode, setDraggingCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  const orderDirty = boards.map((board) => board.code).join("|") !== savedOrder.join("|");

  const loadBoards = async () => {
    setLoading(true);
    try {
      const response = await apiClient.getAdminBoards();
      setBoards(response.items);
      setSavedOrder(response.items.map((board) => board.code));
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
      allowLike: board.allowLike,
      allowSecret: board.allowSecret,
      code: board.code,
      commentPermissionBit: board.commentPermissionBit,
      descriptionEn: board.descriptionEn ?? "",
      descriptionKo: board.descriptionKo ?? "",
      managePermissionBit: board.managePermissionBit,
      nameEn: board.nameEn ?? "",
      nameKo: board.nameKo,
      readScope: board.readScope,
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
        await apiClient.createBoard({ ...form, code: form.code.trim() });
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

  const setBoardActive = async (board: BoardSummary, active: boolean) => {
    if (!active) {
      const approved = await confirm({ title: `${board.nameKo} 게시판을 비활성화할까요?`, confirmLabel: "비활성화", tone: "danger" });
      if (!approved) return;
    }
    setSaving(true);
    try {
      if (active) await apiClient.updateBoard(board.code, { isActive: true });
      else await apiClient.archiveBoard(board.code);
      setFormOpen(false);
      await loadBoards();
    } catch {
      setMessage({ tone: "error", text: "게시판 상태를 변경하지 못했습니다." });
    } finally {
      setSaving(false);
    }
  };

  const moveBoard = (targetCode: string) => {
    if (!draggingCode || draggingCode === targetCode) return;
    setBoards((current) => {
      const sourceIndex = current.findIndex((board) => board.code === draggingCode);
      const targetIndex = current.findIndex((board) => board.code === targetCode);
      if (sourceIndex < 0 || targetIndex < 0) return current;
      const next = [...current];
      const [moved] = next.splice(sourceIndex, 1);
      next.splice(targetIndex, 0, moved);
      return next;
    });
  };

  const saveOrder = async () => {
    setSaving(true);
    try {
      const response = await apiClient.reorderBoards({ items: boards.map((board, index) => ({ code: board.code, sortOrder: index * 10 })) });
      setBoards(response.items);
      setSavedOrder(response.items.map((board) => board.code));
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
        <AdminCardHeader>
          <div><AdminSectionTitle>노출 순서와 접근 설정</AdminSectionTitle><AdminMetaText>왼쪽 핸들을 끌어 공개 메뉴 순서를 변경합니다.</AdminMetaText></div>
        </AdminCardHeader>
        <AdminDataTable minWidth={900}>
          <colgroup><col style={{ width: 52 }} /><col style={{ width: 300 }} /><col style={{ width: 150 }} /><col style={{ width: 250 }} /><col style={{ width: 100 }} /><col style={{ width: 48 }} /></colgroup>
          <AdminTableHeader><tr><AdminTableHead><span className="sr-only">순서</span></AdminTableHead><AdminTableHead>게시판</AdminTableHead><AdminTableHead>읽기 범위</AdminTableHead><AdminTableHead>운영 설정</AdminTableHead><AdminTableHead>상태</AdminTableHead><AdminTableHead><span className="sr-only">편집</span></AdminTableHead></tr></AdminTableHeader>
          <AdminTableBody>
            {loading ? <tr><AdminTableCell colSpan={6} className="py-16 text-center">불러오는 중...</AdminTableCell></tr>
              : boards.length === 0 ? <AdminTableEmpty colSpan={6}>등록된 게시판이 없습니다.</AdminTableEmpty>
              : boards.map((board) => <tr key={board.boardId} onDragOver={(event) => event.preventDefault()} onDrop={() => { moveBoard(board.code); setDraggingCode(null); }} className={cn(draggingCode === board.code && "opacity-45")}>
                <AdminTableCell className="text-center"><Button type="button" variant="ghost" size="sm" draggable aria-label={`${board.nameKo} 순서 이동`} onDragStart={() => setDraggingCode(board.code)} onDragEnd={() => setDraggingCode(null)} className="size-8 cursor-grab p-0 text-slate-400 hover:text-slate-700 active:cursor-grabbing"><GripVertical aria-hidden="true" className="size-4" /></Button></AdminTableCell>
                <AdminTableCell truncate><span className="admin-table-text-emphasis block truncate">{board.nameKo}</span><span className="admin-table-text mt-0.5 block truncate">{board.code}{board.nameEn ? ` · ${board.nameEn}` : ""}</span></AdminTableCell>
                <AdminTableCell truncate>{readScopeLabel(board.readScope)}</AdminTableCell>
                <AdminTableCell truncate>{[board.allowComment && "댓글", board.allowSecret && "비밀글", board.allowLike && "좋아요·스크랩"].filter(Boolean).join(" · ") || "추가 기능 없음"}</AdminTableCell>
                <AdminTableCell>{board.isActive ? <AdminStatusBadge tone="positive">활성</AdminStatusBadge> : <AdminStatusBadge>비활성</AdminStatusBadge>}</AdminTableCell>
                <AdminTableCell><IconButton size="sm" tone="table-action" aria-label={`${board.nameKo} 편집`} title="편집" onClick={() => startEdit(board)}><Pencil aria-hidden="true" className="size-4" strokeWidth={1.5} /></IconButton></AdminTableCell>
              </tr>)}
          </AdminTableBody>
        </AdminDataTable>
      </AdminCard>

      {orderDirty ? <AdminStickyActionBar><p className="text-sm font-medium text-slate-700">변경한 게시판 노출 순서를 저장해 주세요.</p><div className="flex gap-2"><Button type="button" variant="outline" onClick={() => setBoards((current) => savedOrder.map((code) => current.find((board) => board.code === code)).filter((board): board is BoardSummary => Boolean(board)))} disabled={saving}><RotateCcw aria-hidden="true" /> 되돌리기</Button><Button type="button" onClick={() => void saveOrder()} disabled={saving}><Save aria-hidden="true" /> 순서 저장</Button></div></AdminStickyActionBar> : null}
    </AdminPageMain>

    <Modal open={formOpen} onClose={() => setFormOpen(false)} title={editingCode ? "게시판 설정" : "새 게시판"} className="max-w-3xl" footer={<>{editingCode ? <Button type="button" variant="ghost" className="mr-auto text-rose-600 hover:bg-rose-50 hover:text-rose-700" onClick={() => { const board = boards.find((item) => item.code === editingCode); if (board) void setBoardActive(board, !board.isActive); }} disabled={saving}>{boards.find((item) => item.code === editingCode)?.isActive ? <><Trash2 aria-hidden="true" /> 비활성화</> : <><RotateCcw aria-hidden="true" /> 복구</>}</Button> : null}<Button type="button" variant="outline" onClick={() => setFormOpen(false)}>취소</Button><Button type="button" onClick={() => void saveBoard()} disabled={saving || !form.code.trim() || !form.nameKo.trim()}>{saving ? "저장 중" : "저장"}</Button></>}>
      <div className="grid gap-5">
        <div className="grid gap-4 md:grid-cols-2"><AdminFormField label="게시판 코드"><UiInput value={form.code} disabled={Boolean(editingCode)} onChange={(event) => setForm((current) => ({ ...current, code: event.currentTarget.value }))} placeholder="notice" /></AdminFormField><AdminFormField label="읽기 범위"><AdminSelectDropdown ariaLabel="읽기 범위" className="w-full" value={form.readScope} onChange={(value) => setForm((current) => ({ ...current, readScope: value as BoardCreateRequest["readScope"] }))} options={[{ value: "PUBLIC", label: "전체 공개" }, { value: "LOGIN", label: "로그인 사용자" }, { value: "STAFF_ONLY", label: "운영진 전용" }]} /></AdminFormField><AdminFormField label="이름 (한글)"><UiInput value={form.nameKo} onChange={(event) => setForm((current) => ({ ...current, nameKo: event.currentTarget.value }))} /></AdminFormField><AdminFormField label="Name (English)"><UiInput value={form.nameEn ?? ""} onChange={(event) => setForm((current) => ({ ...current, nameEn: event.currentTarget.value }))} /></AdminFormField><AdminFormField label="설명 (한글)"><UiInput value={form.descriptionKo ?? ""} onChange={(event) => setForm((current) => ({ ...current, descriptionKo: event.currentTarget.value }))} /></AdminFormField><AdminFormField label="Description (English)"><UiInput value={form.descriptionEn ?? ""} onChange={(event) => setForm((current) => ({ ...current, descriptionEn: event.currentTarget.value }))} /></AdminFormField></div>
        <div className="grid gap-4 border-t border-slate-100 pt-5 md:grid-cols-3"><PermissionSelect label="작성 권한" value={form.writePermissionBit} onChange={(value) => setForm((current) => ({ ...current, writePermissionBit: value }))} /><PermissionSelect label="댓글 권한" value={form.commentPermissionBit} onChange={(value) => setForm((current) => ({ ...current, commentPermissionBit: value }))} /><PermissionSelect label="관리 권한" value={form.managePermissionBit} onChange={(value) => setForm((current) => ({ ...current, managePermissionBit: value }))} /></div>
        <div className="grid gap-2 border-t border-slate-100 pt-5 sm:grid-cols-3"><Toggle label="댓글 허용" checked={form.allowComment} onChange={(checked) => setForm((current) => ({ ...current, allowComment: checked }))} /><Toggle label="비밀글 허용" checked={form.allowSecret} onChange={(checked) => setForm((current) => ({ ...current, allowSecret: checked }))} /><Toggle label="좋아요·스크랩" checked={form.allowLike} onChange={(checked) => setForm((current) => ({ ...current, allowLike: checked }))} /></div>
      </div>
    </Modal>
  </AdminPageShell>;
}

function PermissionSelect({ label, onChange, value }: { label: string; onChange: (value: number) => void; value: number }) {
  return <AdminFormField label={label}><AdminSelectDropdown ariaLabel={label} className="w-full" value={String(value)} onChange={(nextValue) => onChange(Number(nextValue))} options={permissionOptions.map((option) => ({ value: String(option.bit), label: option.label }))} /></AdminFormField>;
}

function Toggle({ checked, label, onChange }: { checked: boolean; label: string; onChange: (checked: boolean) => void }) {
  return <label className="flex min-h-11 cursor-pointer items-center justify-between rounded-lg border border-slate-200 px-3 text-sm font-medium text-slate-700"><span>{label}</span><UiInput type="checkbox" className="size-4 accent-emerald-700" checked={checked} onChange={(event) => onChange(event.currentTarget.checked)} /></label>;
}

function readScopeLabel(scope: BoardSummary["readScope"]) {
  return scope === "LOGIN" ? "로그인 사용자" : scope === "STAFF_ONLY" ? "운영진 전용" : "전체 공개";
}
