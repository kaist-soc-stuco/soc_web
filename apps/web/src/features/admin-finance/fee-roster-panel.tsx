import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { DataGrid, SelectColumn, renderTextEditor, type Column, type SortColumn, type RenderSortStatusProps } from "react-data-grid";
import { Download, Plus, ChevronUp, ChevronDown } from "lucide-react";
import "react-data-grid/lib/styles.css";
import "@/components/ui/admin-sheet.css";
import { createApiClient } from "@soc/api-client";
import { SaveStudentFeeRosterSchema } from "@soc/contracts";
import { Button } from "@/components/ui/button";
import { AdminLoadingState, AdminTableCard } from "@/components/ui/admin-page";
import { AdminSelectDropdown } from "@/components/ui/admin-select";
import { PageSearchField } from "@/components/ui/page-layout";
import { useConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { useUnsavedNavigation } from "@/hooks/use-unsaved-navigation";
import { resolveApiBaseUrl } from "@/lib/api";
import { downloadBlob } from "@/lib/download-blob";
import { feeRosterRow, feeRosterUpdate, type FeeRosterRow } from "@/lib/fee-roster";
import { FeePaymentImport } from "./fee-payment-import";
import { randomId } from "@/lib/random-id";

function renderSortStatus({ sortDirection, priority }: RenderSortStatusProps) {
  if (!sortDirection) return null;
  const Icon = sortDirection === "ASC" ? ChevronUp : ChevronDown;
  return <span className="inline-flex items-center gap-0.5 text-slate-500"><Icon aria-hidden="true" className="size-3.5" />{priority !== undefined && <span className="text-xs">{priority}</span>}</span>;
}

interface Props {
  canEdit: boolean; canExport: boolean; semester: string; revision: number;
  onDirtyChange: (dirty: boolean) => void;
  onSelectionChange: (rows: FeeRosterRow[]) => void;
  onOpenDetail: (row: FeeRosterRow) => void;
  onSaved: () => void;
  selectionAction?: ReactNode;
}
export function FeeRosterPanel({ canEdit, canExport, semester, revision, onDirtyChange, onSelectionChange, onOpenDetail, onSaved, selectionAction }: Props) {
  const client = useMemo(() => createApiClient({ baseUrl: resolveApiBaseUrl() }), []);
  const { toast } = useToast();
  const { confirm, ConfirmDialog } = useConfirmDialog();
  const [original, setOriginal] = useState<FeeRosterRow[]>([]);
  const [rows, setRows] = useState<FeeRosterRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [membership, setMembership] = useState("all");
  const [status, setStatus] = useState("all");
  const [sortColumns, setSortColumns] = useState<SortColumn[]>([]);
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const base = useMemo(() => new Map(original.map(row => [row.key, JSON.stringify(feeRosterUpdate(row))])), [original]);
  const changed = useMemo(() => rows.filter(row => base.get(row.key) !== JSON.stringify(feeRosterUpdate(row))), [base, rows]);
  const dirty = changed.length > 0;
  const busy = saving || loading;
  useEffect(() => { onDirtyChange(dirty); }, [dirty, onDirtyChange]);
  useEffect(() => { onSelectionChange(rows.filter(row => selected.has(row.key))); }, [rows, selected, onSelectionChange]);
  useUnsavedNavigation(dirty, () => confirm({ title: "저장하지 않은 변경 사항을 버릴까요?", confirmLabel: "변경 사항 버리기", tone: "danger" }));
  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const result = await client.listStudentFeeRoster(semester);
      const next = result.records.map(feeRosterRow); setOriginal(next); setRows(next); setSelected(new Set());
    } catch { setError("납부 정보를 불러오지 못했습니다."); }
    finally { setLoading(false); }
  }, [client, semester]);
  useEffect(() => { void load(); }, [load, revision]);
  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const filtered = rows.filter(row => (membership === "all" || Boolean(row.userId) === (membership === "joined")) &&
      (status === "all" || row.status === status) && (!needle || [row.stdNo, row.nameKo, row.note, row.email ?? ""].some(value => value.toLowerCase().includes(needle))));
    return [...filtered].sort((a, b) => {
      for (const sort of sortColumns) {
        const key = sort.columnKey as keyof FeeRosterRow;
        const difference = ["totalPaidAmount", "admissionYear"].includes(key) ? Number(a[key]) - Number(b[key]) : String(a[key] ?? "").localeCompare(String(b[key] ?? ""), "ko");
        if (difference) return sort.direction === "ASC" ? difference : -difference;
      }
      return 0;
    });
  }, [rows, query, membership, status, sortColumns]);
  const columns = useMemo<Column<FeeRosterRow>[]>(() => [
    ...(canEdit ? [SelectColumn as Column<FeeRosterRow>] : []),
    { key: "stdNo", name: "학번", width: 135, frozen: true, editable: row => canEdit && !busy && !row.userId && row.updatedAt === null, renderEditCell: renderTextEditor,
      renderCell: ({ row }) => <span className="flex h-full items-center justify-between gap-1">{row.updatedAt || row.userId ? <button className="admin-sheet-link" onClick={() => onOpenDetail(row)}>{row.stdNo || "학번 없음"}</button> : <><span>{row.stdNo}</span><Button size="icon" variant="ghost" className="h-6 w-6" aria-label="추가 행 삭제" onClick={() => setRows(current => current.filter(item => item.key !== row.key))}>×</Button></>}</span> },
    { key: "nameKo", name: "이름", width: 130, editable: row => canEdit && !busy && !row.userId && row.updatedAt === null, renderEditCell: renderTextEditor,
      renderCell: ({ row }) => row.updatedAt || row.userId ? <button className="admin-sheet-link" onClick={() => onOpenDetail(row)}>{row.nameKo || "이름 없음"}</button> : row.nameKo },
    { key: "admissionYear", name: "입학 연도", width: 105, editable: row => canEdit && !busy && Boolean(row.stdNo), renderEditCell: renderTextEditor },
    { key: "totalPaidAmount", name: "누적 수납액", width: 145, cellClass: "admin-sheet-money", headerCellClass: "admin-sheet-money", renderCell: ({ row }) => (row.totalPaidAmount ?? 0).toLocaleString("ko-KR") },
    { key: "status", name: "납부 상태", width: 115, renderCell: ({ row }) => row.status === "PAID" ? "완납" : row.status === "PARTIAL" ? "부분 납부" : "미납" },
    { key: "joinedAt", name: "가입 여부", width: 110, renderCell: ({ row }) => row.userId ? "가입" : "미가입" },
    { key: "email", name: "이메일", minWidth: 200 },
    { key: "note", name: "비고", minWidth: 240, editable: row => canEdit && !busy && Boolean(row.stdNo), renderEditCell: renderTextEditor },
  ], [canEdit, busy, onOpenDetail]);
  const save = async () => {
    const numbers = rows.filter(row => row.stdNo).map(row => row.stdNo.trim());
    if (new Set(numbers).size !== numbers.length) { setError("중복 학번을 확인해 주세요."); return; }
    const parsed = SaveStudentFeeRosterSchema.safeParse({ records: changed.map(feeRosterUpdate) });
    if (!parsed.success) { setError("학번과 입력값을 확인해 주세요. 한 번에 최대 2,000행을 저장할 수 있습니다."); return; }
    setSaving(true); setError(null);
    try { await client.saveStudentFeeRoster(parsed.data); await load(); onSaved(); toast({ type: "success", message: "변경 사항을 저장했습니다." }); }
    catch (cause) { setError(cause instanceof Error && /fee_roster_changed|409/.test(cause.message) ? "다른 관리자가 수정했습니다. 변경 내용을 보관한 뒤 변경 취소로 최신 데이터를 불러오세요." : "저장하지 못했습니다. 입력한 내용은 유지됩니다."); }
    finally { setSaving(false); }
  };
  const exportRows = async () => {
    const reason = "";
    setExporting(true);
    try { downloadBlob(await client.exportStudentFeeRoster(reason, semester), "과비 납부 관리.xlsx"); }
    catch { toast({ type: "error", message: "내려받지 못했습니다." }); }
    finally { setExporting(false); }
  };
  return <section className="fee-roster-panel min-w-0" aria-label="과비 납부 관리">
    {ConfirmDialog}
    <AdminTableCard className="fee-roster-card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-4">
        <div className="flex flex-wrap gap-2">
          <PageSearchField ariaLabel="납부 검색" placeholder="이름·학번·이메일·비고 검색" value={query} onChange={setQuery} onClear={() => setQuery("")} />
          <AdminSelectDropdown className="w-32" ariaLabel="가입 여부" value={membership} onChange={setMembership} options={[{ value: "all", label: "가입 전체" }, { value: "joined", label: "가입" }, { value: "unjoined", label: "미가입" }]} />
          <AdminSelectDropdown className="w-32" ariaLabel="납부 상태" value={status} onChange={setStatus} options={[{ value: "all", label: "상태 전체" }, { value: "PAID", label: "완납" }, { value: "PARTIAL", label: "부분 납부" }, { value: "UNPAID", label: "미납" }]} />
        </div>
        <div className="flex flex-wrap gap-2">
          {selectionAction}
          {canExport && <Button variant="outline" loading={exporting} disabled={busy || dirty} onClick={() => void exportRows()}><Download />전체 명부 내보내기</Button>}
          {canEdit && <><Button variant="outline" disabled={busy} onClick={() => { setQuery(""); setMembership("all"); setStatus("all"); setRows(current => [{ key: randomId(), stdNo: "", nameKo: "", admissionYear: "", paidSemesters: "0", paidAmount: "0", note: "", userId: null, joinedAt: null, updatedAt: null, totalPaidAmount: 0, status: "UNPAID" }, ...current]); }}><Plus />행 추가</Button>
            <FeePaymentImport disabled={busy || dirty} onImported={async () => { await load(); onSaved(); }} />
            {dirty && <Button variant="ghost" disabled={busy} onClick={async () => { if (await confirm({ title: "저장하지 않은 변경 사항을 버릴까요?", tone: "danger" })) void load(); }}>변경 취소</Button>}
            <Button disabled={!dirty || busy} loading={saving} onClick={() => void save()}>저장{dirty ? ` (${changed.length})` : ""}</Button></>}
        </div>
      </div>
      {error && <p role="alert" className="px-4 py-3 text-sm text-rose-700">{error}{!dirty && <Button variant="ghost" onClick={() => void load()}>다시 시도</Button>}</p>}
      {loading ? <AdminLoadingState /> : <DataGrid aria-label="과비 납부 관리표" className="admin-sheet-grid rdg-light" columns={columns} rows={visible} rowKeyGetter={row => row.key}
        renderers={{ renderSortStatus }} defaultColumnOptions={{ sortable: true, resizable: true }} sortColumns={sortColumns} onSortColumnsChange={setSortColumns}
        selectedRows={selected} onSelectedRowsChange={canEdit ? setSelected : undefined} isRowSelectionDisabled={row => !canEdit || busy || (!row.userId && row.updatedAt === null)}
        onRowsChange={canEdit && !busy ? next => { const updates = new Map(next.map(row => [row.key, row])); setRows(current => current.map(row => updates.get(row.key) ?? row)); } : undefined} />}
      <p className="border-t border-slate-100 px-4 py-3 text-xs text-slate-500">{visible.length.toLocaleString()}명 / 전체 {rows.length.toLocaleString()}명{canEdit ? " · 이름·학번을 눌러 상세 보기" : " · 조회 전용"}</p>
    </AdminTableCard>
  </section>;
}
