import { restrictListDrag } from "@/lib/drag-bounds";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ChangeEvent,
} from "react";
import * as XLSX from "xlsx";
import { createApiClient } from "@soc/api-client";
import type {
  AdminUserRecord,
  ContactDepartmentRecord,
  ContactRecord,
  CreateContactDepartmentRequest,
  CreateContactRequest,
} from "@soc/contracts";
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
import { GripVertical, Mail, Phone, Plus, Sheet, Upload, X } from "lucide-react";

import { AuthGuard } from "@/components/guards/auth-guard";
import { AdminSelectDropdown } from "@/components/ui/admin-select";
import { AdminEmptyState, AdminFormField, AdminPageHeader, AdminPageShell, AdminTableCard, AdminTableViewport } from "@/components/ui/admin-page";
import { AdminDataTable, AdminTableBody, AdminTableCell, AdminTableHead, AdminTableHeader } from "@/components/ui/admin-data-table";
import { Button } from "@/components/ui/button";
import { useConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { UiInput } from "@/components/ui/form-control";
import { Modal } from "@/components/ui/modal";
import { PageSearchField } from "@/components/ui/page-layout";
import { resolveApiBaseUrl } from "@/lib/api-base-url";
import { CONTACT_XLSX_TEMPLATE_ROWS, parseContactSpreadsheet, type ParsedContactSpreadsheetRow } from "@/lib/contact-spreadsheet";
import { downloadBlob } from "@/lib/download-blob";
import { Permissions } from "@/lib/permissions";
import { ExecutiveMemberModal, type ExecutiveMemberFormValues } from "./ExecutiveMemberModal";

const CONTACT_LIST_PAGE_SIZE = 500;
const CONTACT_ROW_GRID = "grid min-w-[1120px] grid-cols-[52px_180px_120px_120px_150px_140px_minmax(0,1fr)]";

export function ExecutiveDirectoryPage() {
  return <AuthGuard requirePermission={Permissions.MANAGE_CONTACTS}><ContactsPageContent /></AuthGuard>;
}

export const ContactsPage = ExecutiveDirectoryPage;

function sortContacts(items: ContactRecord[]) {
  return [...items].sort((a, b) => a.sortOrder - b.sortOrder || a.createdAt.localeCompare(b.createdAt));
}

function normalizeYear(value: number | null | undefined): number { return value ? (value < 100 ? 2000 + value : value) : 0; }

function formatActivityYear(value: number | null): string {
  if (!value) return "—";
  return `${value < 100 ? 2000 + value : value}년`;
}

function ContactsPageContent() {
  const apiClient = useMemo(() => createApiClient({ baseUrl: resolveApiBaseUrl() }), []);
  const { confirm: requestConfirm, ConfirmDialog } = useConfirmDialog();
  const { toast } = useToast();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const [contacts, setContacts] = useState<ContactRecord[]>([]);
  const [departments, setDepartments] = useState<ContactDepartmentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [activityYearFilter, setActivityYearFilter] = useState("2026");
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [orderSaving, setOrderSaving] = useState(false);
  const [activeContactId, setActiveContactId] = useState<string | null>(null);
  const [activeDragWidth, setActiveDragWidth] = useState<number | null>(null);
  const [bulkRows, setBulkRows] = useState<ParsedContactSpreadsheetRow[]>([]);
  const [bulkErrors, setBulkErrors] = useState<string[]>([]);
  const [bulkFileName, setBulkFileName] = useState<string | null>(null);
  const [bulkReplaceExisting, setBulkReplaceExisting] = useState(false);
  const [bulkImporting, setBulkImporting] = useState(false);
  const bulkFileInputRef = useRef<HTMLInputElement>(null);
  const [memberModalOpen, setMemberModalOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<ContactRecord | null>(null);
  const [memberSaving, setMemberSaving] = useState(false);
  const [spreadsheetUrl, setSpreadsheetUrl] = useState<string | null>(null);
  const [departmentModalOpen, setDepartmentModalOpen] = useState(false);
  const [editingDepartment, setEditingDepartment] = useState<ContactDepartmentRecord | null>(null);
  const [departmentForm, setDepartmentForm] = useState({ nameKo: "" });
  const [departmentSaving, setDepartmentSaving] = useState(false);

  const loadContacts = useCallback(async () => {
    setLoading(true);
    try {
      const response = await apiClient.getManagedContacts({ page: 1, pageSize: CONTACT_LIST_PAGE_SIZE });
      setContacts(sortContacts(response.items));
    } catch {
      setError("연락망 정보를 불러오는 데 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }, [apiClient]);

  const loadDepartments = useCallback(async () => {
    try {
      const response = await apiClient.getManagedContactDepartments();
      setDepartments(response.items);
    } catch {
      setError("부서 정보를 불러오는 데 실패했습니다.");
    }
  }, [apiClient]);

  const loadSpreadsheet = useCallback(async () => {
    try {
      const spreadsheet = await apiClient.getContactsSpreadsheet();
      setSpreadsheetUrl(spreadsheet.spreadsheetUrl);
    } catch {
      setSpreadsheetUrl(null);
    }
  }, [apiClient]);

  useEffect(() => {
    void Promise.all([loadContacts(), loadDepartments(), loadSpreadsheet()]);
  }, [loadContacts, loadDepartments, loadSpreadsheet]);

  const activityYearOptions = useMemo(
    () => Array.from(new Set([2026, ...contacts.flatMap((contact) => contact.activities?.length ? contact.activities.map((activity) => activity.year) : [contact.cohort]).filter((year): year is number => year !== null).map(normalizeYear)]))
      .filter((year) => year >= 1900).sort((a, b) => b - a),
    [contacts],
  );
  const legacyDepartmentOptions = useMemo(
    () => Array.from(new Set(contacts.map((contact) => contact.departmentKo?.trim()).filter((department): department is string => Boolean(department))))
      .filter((department) => !departments.some((item) => item.nameKo === department))
      .sort((a, b) => a.localeCompare(b, "ko")),
    [contacts, departments],
  );
  const filteredContacts = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    return contacts.filter((contact) => {
      const matchesQuery = !normalizedQuery || [
        contact.nameKo,
        contact.nameEn,
        contact.studentNumber ?? "",
        contact.departmentKo ?? "",
        contact.departmentEn ?? "",
        contact.roleKo,
        contact.roleEn,
        contact.email ?? "",
        contact.phoneNumber ?? "",
      ].some((value) => value.toLocaleLowerCase().includes(normalizedQuery));
      const activities = contact.activities?.length ? contact.activities : [{ year: normalizeYear(contact.cohort), departmentKo: contact.departmentKo }];
      const matchesYear = !activityYearFilter || activities.some((activity) => String(normalizeYear(activity.year)) === activityYearFilter);
      const matchesDepartment = !departmentFilter || activities.some((activity) => activity.departmentKo === departmentFilter && (!activityYearFilter || String(normalizeYear(activity.year)) === activityYearFilter));
      return matchesQuery && matchesYear && matchesDepartment;
    });
  }, [activityYearFilter, contacts, departmentFilter, query]);
  const activeContact = activeContactId
    ? contacts.find((contact) => contact.id === activeContactId) ?? null
    : null;

  const searchPortalMembers = useCallback(
    (searchQuery: string): Promise<AdminUserRecord[]> => apiClient.searchContactPortalMembers(searchQuery, 20),
    [apiClient],
  );

  const handleDragStart = ({ active }: DragStartEvent) => {
    setActiveContactId(String(active.id));
    setActiveDragWidth(active.rect.current.initial?.width ?? null);
  };

  const handleDragCancel = () => {
    setActiveContactId(null);
    setActiveDragWidth(null);
  };

  const handleDragEnd = async ({ active, over }: DragEndEvent) => {
    setActiveContactId(null);
    setActiveDragWidth(null);
    if (!over || active.id === over.id || orderSaving) return;
    const oldIndex = contacts.findIndex((contact) => contact.id === active.id);
    const newIndex = contacts.findIndex((contact) => contact.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const previousContacts = contacts;
    const reorderedContacts = arrayMove(contacts, oldIndex, newIndex).map((contact, index) => ({ ...contact, sortOrder: index }));
    setContacts(reorderedContacts);
    setOrderSaving(true);
    setError(null);
    try {
      const savedContacts = await apiClient.reorderContacts({ items: reorderedContacts.map((contact, index) => ({ id: contact.id, sortOrder: index })) });
      setContacts(sortContacts(savedContacts));
    } catch {
      setContacts(previousContacts);
      setError("연락망 순서를 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setOrderSaving(false);
    }
  };

  const handleBulkFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;
    try {
      const parsed = parseContactSpreadsheet(await file.arrayBuffer());
      setBulkFileName(file.name);
      setBulkRows(parsed.rows);
      setBulkErrors(parsed.errors);
    } catch {
      setBulkFileName(file.name);
      setBulkRows([]);
      setBulkErrors(["XLSX 파일을 읽지 못했습니다."]);
    }
  };

  const clearBulkImport = (force = false) => {
    if (bulkImporting && !force) return;
    setBulkRows([]);
    setBulkErrors([]);
    setBulkFileName(null);
    setBulkReplaceExisting(false);
  };

  const downloadContactTemplate = () => {
    const worksheet = XLSX.utils.aoa_to_sheet(CONTACT_XLSX_TEMPLATE_ROWS.map((row) => [...row]));
    worksheet["!cols"] = [
      { wch: 16 }, { wch: 22 }, { wch: 16 }, { wch: 18 }, { wch: 22 }, { wch: 16 },
      { wch: 22 }, { wch: 12 }, { wch: 32 }, { wch: 18 }, { wch: 16 }, { wch: 12 },
    ];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "연락망");
    const buffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    downloadBlob(blob, "executive_contacts_template.xlsx");
  };

  const handleBulkImport = async () => {
    if (bulkRows.length === 0 || bulkErrors.length > 0) return;
    try {
      setBulkImporting(true);
      const result = await apiClient.bulkImportContacts({ items: bulkRows, replaceExisting: bulkReplaceExisting });
      clearBulkImport(true);
      await loadContacts();
      toast({
        type: "success",
        message: `${result.importedCount}명을 가져왔습니다.${result.removedCount > 0 ? ` 기존 ${result.removedCount}명은 교체되었습니다.` : ""}`,
      });
    } catch {
      setBulkErrors(["일괄 업로드에 실패했습니다. 입력값과 권한을 확인해 주세요."]);
    } finally {
      setBulkImporting(false);
    }
  };

  const openNewMemberModal = () => { setEditingContact(null); setMemberModalOpen(true); };
  const openEditMemberModal = (contact: ContactRecord) => { setEditingContact(contact); setMemberModalOpen(true); };
  const closeMemberModal = () => {
    if (memberSaving) return;
    setMemberModalOpen(false);
    setEditingContact(null);
  };

  const handleMemberSave = async (values: ExecutiveMemberFormValues) => {
    const latest = values.activities.reduce((current, activity) => !current || activity.year >= current.year ? activity : current, values.activities[0]);
    if (!latest) { setError("활동 이력을 하나 이상 입력해 주세요."); return; }
    const payload: CreateContactRequest = {
      portalUserId: values.portalUserId,
      activities: values.activities,
      nameKo: values.nameKo.trim(),
      nameEn: values.nameEn.trim(),
      studentNumber: values.studentNumber.trim() || null,
      departmentKo: latest.departmentKo.trim() || null,
      departmentEn: latest.departmentEn.trim() || null,
      roleKo: latest.roleKo.trim(),
      roleEn: latest.roleEn.trim(),
      cohort: latest.year,
      email: values.email.trim(),
      phoneNumber: values.phoneNumber.trim(),
      privacyConsented: true,
    };
    try {
      setMemberSaving(true);
      if (editingContact) await apiClient.updateContact(editingContact.id, payload);
      else await apiClient.createContact(payload);
      setMemberModalOpen(false);
      setEditingContact(null);
      await loadContacts();
    } catch {
      setError("저장에 실패했습니다. 입력을 다시 확인해 주세요.");
    } finally {
      setMemberSaving(false);
    }
  };

  const openNewDepartmentModal = () => {
    setEditingDepartment(null);
    setDepartmentForm({ nameKo: "" });
    setDepartmentModalOpen(true);
  };
  const openEditDepartmentModal = (department: ContactDepartmentRecord) => {
    setEditingDepartment(department);
    setDepartmentForm({
      nameKo: department.nameKo,
    });
    setDepartmentModalOpen(true);
  };
  const closeDepartmentModal = () => {
    if (departmentSaving) return;
    setDepartmentModalOpen(false);
    setEditingDepartment(null);
  };
  const handleDepartmentSave = async () => {
    if (!departmentForm.nameKo.trim()) return;
    try {
      setDepartmentSaving(true);
      if (editingDepartment) {
        await apiClient.updateContactDepartment(editingDepartment.id, {
          nameKo: departmentForm.nameKo.trim(),
          nameEn: "",
          descriptionKo: "",
          descriptionEn: "",
        });
      } else {
        const payload: CreateContactDepartmentRequest = {
          nameKo: departmentForm.nameKo.trim(),
          nameEn: "",
          descriptionKo: "",
          descriptionEn: "",
          inquiryEmail: "",
          isActive: true,
        };
        await apiClient.createContactDepartment(payload);
      }
      setEditingDepartment(null);
      setDepartmentForm({ nameKo: "" });
      await Promise.all([loadDepartments(), loadContacts()]);
      toast({ type: "success", message: editingDepartment ? "부서 정보를 수정했습니다." : "부서를 추가했습니다." });
    } catch {
      setError("부서 저장에 실패했습니다. 중복 여부와 입력값을 확인해 주세요.");
    } finally {
      setDepartmentSaving(false);
    }
  };
  const handleDepartmentDelete = async (department: ContactDepartmentRecord) => {
    const confirmed = await requestConfirm({
      confirmLabel: "삭제하기",
      description: <>정말 <strong className="font-semibold text-slate-900">“{department.nameKo}”</strong> 부서를 삭제하시겠습니까?</>,
      title: "부서 삭제",
      tone: "danger",
      warning: "연락망에서 사용 중인 부서는 삭제할 수 없습니다.",
    });
    if (!confirmed) return;
    try {
      await apiClient.deleteContactDepartment(department.id);
      await loadDepartments();
      toast({ type: "success", message: "부서를 삭제했습니다." });
    } catch {
      setError("연락망에서 사용 중인 부서는 삭제할 수 없습니다.");
    }
  };

  const pageSpreadsheetLink = (
    <Button
      type="button"
      variant="outline"
      disabled={!spreadsheetUrl}
      onClick={() => {
        if (spreadsheetUrl) window.open(spreadsheetUrl, "_blank", "noopener,noreferrer");
      }}
    >
      <Sheet className="size-4" aria-hidden="true" />
      Google Sheets에서 보기 ↗
    </Button>
  );

  const headerActions = <>
    {pageSpreadsheetLink}
    <Button type="button" variant="outline" onClick={openNewDepartmentModal}>부서 관리</Button>
    <Button type="button" variant="outline" onClick={() => bulkFileInputRef.current?.click()}><Upload aria-hidden="true" />불러오기</Button>
    <Button type="button" onClick={openNewMemberModal}><Plus aria-hidden="true" />부원 추가</Button>
  </>;

  return (
    <AdminPageShell>
      <main className="admin-page__main mx-auto flex w-full max-w-[var(--ui-admin-page-max-width)] flex-col gap-6 px-5 py-7 md:px-8 xl:px-10">
        {ConfirmDialog}
        <AdminPageHeader title="집행위 연락망" actions={headerActions} />
        <UiInput ref={bulkFileInputRef} type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="hidden" onChange={(event) => void handleBulkFileChange(event)} />
        {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{error}</div> : null}

        <>
            <ExecutiveMemberModal
              open={memberModalOpen}
              contact={editingContact}
              departments={departments}
              onClose={closeMemberModal}
              onDelete={editingContact ? async () => {
                const deleted = await handleDelete(editingContact.id);
                if (deleted) closeMemberModal();
              } : undefined}
              onSearchPortalMembers={searchPortalMembers}
              onSave={handleMemberSave}
              saving={memberSaving}
            />
            <Modal
              open={bulkFileName !== null}
              onClose={() => clearBulkImport()}
              title="연락망 불러오기"
              className="max-w-3xl"
              footer={<>
                <Button type="button" variant="ghost" onClick={downloadContactTemplate} disabled={bulkImporting}>양식 내보내기</Button>
                <Button type="button" variant="outline" onClick={() => clearBulkImport()} disabled={bulkImporting}>취소</Button>
                <Button type="button" onClick={() => void handleBulkImport()} disabled={bulkRows.length === 0 || bulkErrors.length > 0 || bulkImporting}>불러오기</Button>
              </>}
            >
              <div className="space-y-4">
                <div><p className="text-sm font-semibold text-slate-800">{bulkFileName}</p><p className="mt-1 text-xs text-slate-500">정상 행 {bulkRows.length}개 · 오류 {bulkErrors.length}개</p></div>
                <label className="inline-flex items-center gap-2 text-sm text-slate-700"><UiInput type="checkbox" checked={bulkReplaceExisting} onChange={(event) => setBulkReplaceExisting(event.currentTarget.checked)} className="size-4 accent-brand-primary" />기존 연락망 전체 교체</label>
                {bulkErrors.length > 0 ? <ul className="space-y-1 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-700">{bulkErrors.slice(0, 8).map((message) => <li key={message}>{message}</li>)}{bulkErrors.length > 8 ? <li>외 {bulkErrors.length - 8}건</li> : null}</ul> : null}
                {bulkRows.length > 0 && bulkErrors.length === 0 ? <div className="overflow-hidden rounded-lg border border-slate-100"><AdminDataTable minWidth={640}><AdminTableHeader><tr><AdminTableHead>이름</AdminTableHead><AdminTableHead>직책</AdminTableHead><AdminTableHead>이메일</AdminTableHead><AdminTableHead>순서</AdminTableHead></tr></AdminTableHeader><AdminTableBody>{bulkRows.slice(0, 5).map((row, index) => <tr key={`${row.email}-${index}`}><AdminTableCell><span className="admin-table-text-emphasis">{row.nameKo}</span></AdminTableCell><AdminTableCell>{row.roleKo}</AdminTableCell><AdminTableCell>{row.email || "—"}</AdminTableCell><AdminTableCell>{row.sortOrder ?? "자동"}</AdminTableCell></tr>)}</AdminTableBody></AdminDataTable></div> : null}
              </div>
            </Modal>

            <AdminTableCard className="overflow-visible">
              <div className="border-b border-slate-100 p-4"><div className="flex flex-wrap items-center justify-end gap-2">
                <AdminSelectDropdown value={activityYearFilter} onChange={setActivityYearFilter} ariaLabel="활동 연도 필터" className="w-32 shrink-0" options={[{ value: "", label: "활동 연도" }, ...activityYearOptions.map((year) => ({ value: String(year), label: formatActivityYear(year) }))]} />
                <AdminSelectDropdown value={departmentFilter} onChange={setDepartmentFilter} ariaLabel="부서 필터" className="w-36 shrink-0" options={[{ value: "", label: "부서 전체" }, ...departments.filter((department) => department.isActive).map((department) => ({ value: department.nameKo, label: department.nameKo })), ...legacyDepartmentOptions.map((department) => ({ value: department, label: department }))]} />
                <PageSearchField ariaLabel="연락망 통합 검색" className="w-full max-w-[20rem] flex-none" onChange={setQuery} onClear={() => setQuery("")} placeholder="이름·학번·직책·메일·전화번호 검색" value={query} />
              </div></div>
              <div className="min-w-0">
                {loading && contacts.length === 0 ? null : filteredContacts.length === 0 ? <AdminEmptyState message={contacts.length === 0 ? "등록된 집행부원이 없습니다." : "검색 조건에 맞는 집행부원이 없습니다."} /> : <DndContext modifiers={[restrictListDrag]} autoScroll={false} sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragCancel={handleDragCancel} onDragEnd={(event) => void handleDragEnd(event)}><AdminTableViewport className={activeContactId ? "admin-table-viewport--dragging" : undefined}><div className="admin-contacts-table min-w-[1120px]"><div role="row" className={`admin-contacts-table__header ${CONTACT_ROW_GRID} bg-slate-50/70 text-left text-sm font-medium text-[var(--j-color-text-secondary)]`}><div role="columnheader" className="flex h-12 items-center justify-center"><span className="sr-only">순서</span></div><div role="columnheader" className="flex h-12 items-center pl-1 pr-5">이름</div><div role="columnheader" className="flex h-12 items-center px-5">학번</div><div role="columnheader" className="flex h-12 items-center px-5">활동 연도</div><div role="columnheader" className="flex h-12 items-center px-5">부서</div><div role="columnheader" className="flex h-12 items-center px-5">직책</div><div role="columnheader" className="flex h-12 items-center px-5">연락처 정보</div></div><SortableContext items={filteredContacts.map((contact) => contact.id)} strategy={verticalListSortingStrategy}><div role="rowgroup">{filteredContacts.map((contact) => <SortableContactRow key={contact.id} contact={contact} activityYear={activityYearFilter} disabled={orderSaving} onEdit={openEditMemberModal} />)}</div></SortableContext></div></AdminTableViewport>{typeof document !== "undefined" ? createPortal(<DragOverlay dropAnimation={{ duration: 200, easing: "ease" }}>{activeContact ? <ContactDragPreview contact={activeContact} width={activeDragWidth} /> : null}</DragOverlay>, document.body) : null}</DndContext>}
              </div>
              {orderSaving ? <p className="border-t border-slate-100 px-4 py-3 text-xs text-slate-500">표시 순서를 저장하는 중입니다...</p> : null}
            </AdminTableCard>
        </>

        <Modal
          open={departmentModalOpen}
          onClose={closeDepartmentModal}
          title="부서 관리"
          className="max-w-md"
          footer={<><Button type="button" variant="outline" onClick={closeDepartmentModal} disabled={departmentSaving}>취소</Button><Button type="button" onClick={() => void handleDepartmentSave()} disabled={departmentSaving || !departmentForm.nameKo.trim()}>{departmentSaving ? "저장 중..." : "저장"}</Button></>}
        >
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {departments.map((department) => <span key={department.id} className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 py-1 pl-3 pr-1 text-sm">
                <button type="button" onClick={() => openEditDepartmentModal(department)} className="py-1 text-slate-700">{department.nameKo}</button>
                <button type="button" aria-label={`${department.nameKo} 삭제`} onClick={() => void handleDepartmentDelete(department)} className="inline-flex size-6 items-center justify-center rounded-full text-slate-400 hover:bg-slate-200 hover:text-rose-600"><X className="size-3.5" /></button>
              </span>)}
            </div>
            <AdminFormField label={editingDepartment ? "부서명 수정" : "부서명"}><UiInput value={departmentForm.nameKo} onChange={(event) => { const value = event.currentTarget.value; setDepartmentForm((current) => ({ ...current, nameKo: value })); }} placeholder="부서명 입력" /></AdminFormField>
          </div>
        </Modal>
      </main>
    </AdminPageShell>
  );

  async function handleDelete(id: string): Promise<boolean> {
    const contact = contacts.find((item) => item.id === id);
    const confirmed = await requestConfirm({
      confirmLabel: "삭제하기",
      description: <>정말 <strong className="font-semibold text-slate-900">“{contact?.nameKo ?? "이 연락처"}”</strong> 연락처를 삭제하시겠습니까?</>,
      title: "연락처 삭제",
      tone: "danger",
      warning: "연락망에서 즉시 제거되며 복구할 수 없습니다.",
    });
    if (!confirmed) return false;
    try {
      await apiClient.deleteContact(id);
      await loadContacts();
      return true;
    } catch {
      setError("삭제에 실패했습니다.");
      return false;
    }
  }
}

function ContactCells({ contact, activityYear = "" }: { contact: ContactRecord; activityYear?: string }) {
  const activities = (contact.activities?.length ? contact.activities : [{ year: normalizeYear(contact.cohort), departmentKo: contact.departmentKo, roleKo: contact.roleKo }])
    .filter((activity) => !activityYear || String(normalizeYear(activity.year)) === activityYear)
    .sort((a, b) => normalizeYear(b.year) - normalizeYear(a.year));
  const years = [...new Set(activities.map((activity) => normalizeYear(activity.year)).filter(Boolean))];
  return <>
    <div role="cell" className="min-w-0 py-3 pl-1 pr-5"><div className="admin-table-text-emphasis truncate">{contact.nameKo}</div></div>
    <div role="cell" className="min-w-0 truncate px-5 py-3 text-sm tabular-nums text-slate-700">{contact.studentNumber || "—"}</div>
    <div role="cell" data-mobile-label="활동 연도" className="px-5 py-3 text-sm tabular-nums text-slate-700">{years.map(formatActivityYear).join(", ") || "—"}</div>
    <div role="cell" data-mobile-label="부서" className="min-w-0 px-5 py-3 text-sm text-slate-700">{[...new Set(activities.map((activity) => activity.departmentKo).filter(Boolean))].join(", ") || "—"}</div>
    <div role="cell" data-mobile-label="직책" className="min-w-0 px-5 py-3 text-sm text-slate-700">{[...new Set(activities.map((activity) => activity.roleKo).filter(Boolean))].join(", ") || "—"}</div>
    <div role="cell" className="min-w-0 space-y-1 px-5 py-3"><div className="admin-table-text flex min-w-0 items-center gap-1.5"><Mail className="size-3.5 shrink-0 text-slate-400" /><span className="truncate">{contact.email || "—"}</span></div><div className="admin-table-text flex min-w-0 items-center gap-1.5"><Phone className="size-3.5 shrink-0 text-slate-400" /><span className="truncate">{contact.phoneNumber || "—"}</span></div></div>
  </>;
}

function SortableContactRow({ contact, activityYear, disabled, onEdit }: { contact: ContactRecord; activityYear: string; disabled: boolean; onEdit: (contact: ContactRecord) => void }) {
  const { attributes, isDragging, listeners, setActivatorNodeRef, setNodeRef, transform, transition } = useSortable({ id: contact.id, disabled });
  const style: CSSProperties = { transform: CSS.Transform.toString(transform), transition: transition ?? "transform 200ms ease" };
  return <div ref={setNodeRef} style={style} role="row" className={`admin-contacts-table__row ${CONTACT_ROW_GRID} items-center ${isDragging ? "relative z-10 opacity-0" : "cursor-pointer transition-colors hover:bg-slate-50/60"}`} onClick={() => onEdit(contact)} onKeyDown={(event) => { if (event.target !== event.currentTarget) return; if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onEdit(contact); } }} tabIndex={0}>
    <div role="cell" className="flex min-h-16 items-center pl-5 pr-1"><button ref={setActivatorNodeRef} type="button" {...attributes} {...listeners} onClick={(event) => event.stopPropagation()} className="admin-list-drag-handle" aria-label={`${contact.nameKo} 표시 순서 변경`}><GripVertical aria-hidden="true" className="size-4" /></button></div>
    <ContactCells contact={contact} activityYear={activityYear} />
  </div>;
}

function ContactDragPreview({ contact, width }: { contact: ContactRecord; width: number | null }) {
  return <div style={{ width: width ?? undefined }} className={`admin-contacts-table__row ${CONTACT_ROW_GRID} items-center relative z-50 select-none min-h-16 cursor-grabbing rounded-lg border border-slate-200 bg-white shadow-lg`}>
    <div className="pl-5 pr-1"><span className="admin-list-drag-handle"><GripVertical aria-hidden="true" className="size-4" /></span></div>
    <ContactCells contact={contact} />
  </div>;
}
