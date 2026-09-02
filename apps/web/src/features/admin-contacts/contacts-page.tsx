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
import { GripVertical, Mail, Pencil, Phone, Plus, Sheet, Trash2, Upload } from "lucide-react";

import { AuthGuard } from "@/components/guards/auth-guard";
import { AdminSelectDropdown } from "@/components/ui/admin-select";
import { AdminEmptyState, AdminFormField, AdminPageHeader, AdminPageShell, AdminTableCard, AdminTableViewport } from "@/components/ui/admin-page";
import { AdminDataTable, AdminTableBody, AdminTableCell, AdminTableHead, AdminTableHeader } from "@/components/ui/admin-data-table";
import { Button } from "@/components/ui/button";
import { useConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { UiInput, UiTextarea } from "@/components/ui/form-control";
import { Modal } from "@/components/ui/modal";
import { PageSearchField } from "@/components/ui/page-layout";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { resolveApiBaseUrl } from "@/lib/api-base-url";
import { CONTACT_XLSX_TEMPLATE_ROWS, parseContactSpreadsheet, type ParsedContactSpreadsheetRow } from "@/lib/contact-spreadsheet";
import { downloadBlob } from "@/lib/download-blob";
import { Permissions } from "@/lib/permissions";
import { ExecutiveMemberModal, type ExecutiveMemberFormValues } from "./ExecutiveMemberModal";

const CONTACT_LIST_PAGE_SIZE = 500;
const CONTACT_ROW_GRID = "grid min-w-[1120px] grid-cols-[52px_280px_120px_120px_220px_minmax(0,1fr)]";

export function ExecutiveDirectoryPage() {
  return <AuthGuard requirePermission={Permissions.MANAGE_CONTACTS}><ContactsPageContent /></AuthGuard>;
}

export const ContactsPage = ExecutiveDirectoryPage;

function sortContacts(items: ContactRecord[]) {
  return [...items].sort((a, b) => a.sortOrder - b.sortOrder || a.createdAt.localeCompare(b.createdAt));
}

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
  const [activeTab, setActiveTab] = useState<"members" | "departments">("members");
  const [contacts, setContacts] = useState<ContactRecord[]>([]);
  const [departments, setDepartments] = useState<ContactDepartmentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [departmentsLoading, setDepartmentsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [activityYearFilter, setActivityYearFilter] = useState("");
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
  const [departmentForm, setDepartmentForm] = useState({
    nameKo: "",
    nameEn: "",
    descriptionKo: "",
    descriptionEn: "",
  });
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
    setDepartmentsLoading(true);
    try {
      const response = await apiClient.getManagedContactDepartments();
      setDepartments(response.items);
    } catch {
      setError("부서 정보를 불러오는 데 실패했습니다.");
    } finally {
      setDepartmentsLoading(false);
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
    () => Array.from(new Set(contacts.map((contact) => contact.cohort).filter((year): year is number => year !== null)))
      .sort((a, b) => a - b),
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
      const matchesYear = !activityYearFilter || String(contact.cohort ?? "") === activityYearFilter;
      const matchesDepartment = !departmentFilter || contact.departmentKo === departmentFilter;
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
    const payload: CreateContactRequest = {
      nameKo: values.nameKo.trim(),
      nameEn: values.nameEn.trim(),
      studentNumber: values.studentNumber.trim() || null,
      departmentKo: values.departmentKo.trim() || null,
      departmentEn: values.departmentEn.trim() || null,
      roleKo: values.roleKo.trim(),
      roleEn: values.roleEn.trim(),
      cohort: values.cohort,
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
    setDepartmentForm({ nameKo: "", nameEn: "", descriptionKo: "", descriptionEn: "" });
    setDepartmentModalOpen(true);
  };
  const openEditDepartmentModal = (department: ContactDepartmentRecord) => {
    setEditingDepartment(department);
    setDepartmentForm({
      nameKo: department.nameKo,
      nameEn: department.nameEn,
      descriptionKo: department.descriptionKo,
      descriptionEn: department.descriptionEn,
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
          nameEn: departmentForm.nameEn.trim(),
          descriptionKo: departmentForm.descriptionKo.trim(),
          descriptionEn: departmentForm.descriptionEn.trim(),
        });
      } else {
        const payload: CreateContactDepartmentRequest = {
          nameKo: departmentForm.nameKo.trim(),
          nameEn: departmentForm.nameEn.trim(),
          descriptionKo: departmentForm.descriptionKo.trim(),
          descriptionEn: departmentForm.descriptionEn.trim(),
          inquiryEmail: "",
          isActive: true,
        };
        await apiClient.createContactDepartment(payload);
      }
      closeDepartmentModal();
      await loadDepartments();
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

  const headerActions = activeTab === "members" ? (
    <>
      {pageSpreadsheetLink}
      <Button type="button" variant="outline" onClick={() => bulkFileInputRef.current?.click()}><Upload aria-hidden="true" />불러오기</Button>
      <Button type="button" onClick={openNewMemberModal}><Plus aria-hidden="true" />부원 추가</Button>
    </>
  ) : <>{pageSpreadsheetLink}<Button type="button" onClick={openNewDepartmentModal}><Plus aria-hidden="true" />부서 추가</Button></>;

  return (
    <AdminPageShell>
      <main className="admin-page__main mx-auto flex w-full max-w-[var(--ui-admin-page-max-width)] flex-col gap-6 px-5 py-7 md:px-8 xl:px-10">
        {ConfirmDialog}
        <AdminPageHeader title="집행위 연락망" actions={headerActions} />
        <SegmentedControl
          ariaLabel="집행위 연락망 관리 탭"
          role="tablist"
          value={activeTab}
          onChange={setActiveTab}
          options={[
            { value: "members", label: "구성원" },
            { value: "departments", label: "부서 관리" },
          ]}
          className="w-fit"
        />
        <UiInput ref={bulkFileInputRef} type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="hidden" onChange={(event) => void handleBulkFileChange(event)} />
        {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{error}</div> : null}

        {activeTab === "members" ? (
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
                <AdminSelectDropdown value={activityYearFilter} onChange={setActivityYearFilter} ariaLabel="활동 연도 필터" className="w-32 shrink-0" options={[{ value: "", label: "활동 연도 전체" }, ...activityYearOptions.map((year) => ({ value: String(year), label: formatActivityYear(year) }))]} />
                <AdminSelectDropdown value={departmentFilter} onChange={setDepartmentFilter} ariaLabel="부서 필터" className="w-36 shrink-0" options={[{ value: "", label: "부서 전체" }, ...departments.filter((department) => department.isActive).map((department) => ({ value: department.nameKo, label: department.nameKo })), ...legacyDepartmentOptions.map((department) => ({ value: department, label: department }))]} />
                <PageSearchField ariaLabel="연락망 통합 검색" className="w-full max-w-[20rem] flex-none" onChange={setQuery} onClear={() => setQuery("")} placeholder="이름·학번·직책·메일·전화번호 검색" value={query} />
              </div></div>
              <div className="min-w-0">
                {loading && contacts.length === 0 ? null : filteredContacts.length === 0 ? <AdminEmptyState message={contacts.length === 0 ? "등록된 집행부원이 없습니다." : "검색 조건에 맞는 집행부원이 없습니다."} /> : <DndContext autoScroll={false} sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragCancel={handleDragCancel} onDragEnd={(event) => void handleDragEnd(event)}><AdminTableViewport className={activeContactId ? "admin-table-viewport--dragging" : undefined}><div className="min-w-[1120px]"><div role="row" className={`${CONTACT_ROW_GRID} border-t-2 border-t-brand-primary bg-slate-50/70 text-left text-sm font-medium text-[var(--j-color-text-secondary)]`}><div role="columnheader" className="flex h-12 items-center justify-center"><span className="sr-only">순서</span></div><div role="columnheader" className="flex h-12 items-center px-5">이름 (한글/영문)</div><div role="columnheader" className="flex h-12 items-center px-5">학번</div><div role="columnheader" className="flex h-12 items-center px-5">활동 연도</div><div role="columnheader" className="flex h-12 items-center px-5">직책</div><div role="columnheader" className="flex h-12 items-center px-5">연락처 정보</div></div><SortableContext items={filteredContacts.map((contact) => contact.id)} strategy={verticalListSortingStrategy}><div role="rowgroup">{filteredContacts.map((contact) => <SortableContactRow key={contact.id} contact={contact} disabled={orderSaving} onEdit={openEditMemberModal} />)}</div></SortableContext></div></AdminTableViewport>{typeof document !== "undefined" ? createPortal(<DragOverlay dropAnimation={{ duration: 200, easing: "ease" }}>{activeContact ? <ContactDragPreview contact={activeContact} width={activeDragWidth} /> : null}</DragOverlay>, document.body) : null}</DndContext>}
              </div>
              {orderSaving ? <p className="border-t border-slate-100 px-4 py-3 text-xs text-slate-500">표시 순서를 저장하는 중입니다...</p> : null}
            </AdminTableCard>
          </>
        ) : (
          <AdminTableCard className="overflow-hidden">
            {departmentsLoading && departments.length === 0 ? <div className="px-5 py-16 text-center text-sm text-slate-400">부서 정보를 불러오는 중입니다...</div> : departments.length === 0 ? <AdminEmptyState message="등록된 부서가 없습니다." /> : <div className="divide-y divide-slate-100">{departments.map((department) => <div key={department.id} className="flex min-h-16 items-center justify-between gap-4 px-5 py-3"><div className="min-w-0"><p className="truncate text-sm font-semibold text-slate-800">{department.nameKo}</p><p className="mt-0.5 truncate text-xs text-slate-500">{department.nameEn || "영문 부서명 미입력"}</p><p className="mt-1 truncate text-xs text-slate-500">{department.descriptionKo || "소개 문구 미입력"}</p></div><div className="flex shrink-0 items-center gap-2"><span className={`rounded-full px-2 py-1 text-xs font-medium ${department.isActive ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{department.isActive ? "사용 중" : "비활성"}</span><Button type="button" variant="outline" size="icon" aria-label={`${department.nameKo} 수정`} onClick={() => openEditDepartmentModal(department)}><Pencil aria-hidden="true" className="size-4" /></Button><Button type="button" variant="outline" size="icon" aria-label={`${department.nameKo} 삭제`} onClick={() => void handleDepartmentDelete(department)}><Trash2 aria-hidden="true" className="size-4 text-rose-600" /></Button></div></div>)}</div>}
          </AdminTableCard>
        )}

        <Modal
          open={departmentModalOpen}
          onClose={closeDepartmentModal}
          title={editingDepartment ? "부서 수정" : "부서 추가"}
          className="max-w-md"
          footer={<><Button type="button" variant="outline" onClick={closeDepartmentModal} disabled={departmentSaving}>취소</Button><Button type="button" onClick={() => void handleDepartmentSave()} disabled={departmentSaving || !departmentForm.nameKo.trim()}>{departmentSaving ? "저장 중..." : "저장"}</Button></>}
        >
            <div className="grid gap-4 sm:grid-cols-2">
              <AdminFormField label="부서 (한글) *"><UiInput value={departmentForm.nameKo} onChange={(event) => setDepartmentForm((current) => ({ ...current, nameKo: event.currentTarget.value }))} placeholder="예: 회장단" className="box-border w-full" /></AdminFormField>
              <AdminFormField label="부서 (영문)"><UiInput value={departmentForm.nameEn} onChange={(event) => setDepartmentForm((current) => ({ ...current, nameEn: event.currentTarget.value }))} placeholder="예: Presidium" className="box-border w-full" /></AdminFormField>
              <AdminFormField label="역할 소개 (한글)" className="sm:col-span-2"><UiTextarea value={departmentForm.descriptionKo} onChange={(event) => setDepartmentForm((current) => ({ ...current, descriptionKo: event.currentTarget.value }))} placeholder="예: 포털 개발 및 인프라 운영, 시스템 관리" className="min-h-24 w-full" /></AdminFormField>
              <AdminFormField label="역할 소개 (영문)" className="sm:col-span-2"><UiTextarea value={departmentForm.descriptionEn} onChange={(event) => setDepartmentForm((current) => ({ ...current, descriptionEn: event.currentTarget.value }))} placeholder="Describe this department's main responsibilities." className="min-h-24 w-full" /></AdminFormField>
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

function SortableContactRow({ contact, disabled, onEdit }: { contact: ContactRecord; disabled: boolean; onEdit: (contact: ContactRecord) => void }) {
  const { attributes, isDragging, listeners, setActivatorNodeRef, setNodeRef, transform, transition } = useSortable({ id: contact.id, disabled });
  const style: CSSProperties = { transform: CSS.Transform.toString(transform), transition: transition ?? "transform 200ms ease", willChange: isDragging ? "transform" : undefined };
  return <div ref={setNodeRef} style={style} role="row" className={`${CONTACT_ROW_GRID} ${isDragging ? "relative z-10 opacity-0" : "cursor-pointer transition-colors hover:bg-slate-50/60"}`} onClick={() => onEdit(contact)} onKeyDown={(event) => { if (event.target !== event.currentTarget) return; if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onEdit(contact); } }} tabIndex={0}>
    <div role="cell" className="flex min-h-20 items-center justify-center"><button ref={setActivatorNodeRef} type="button" {...attributes} {...listeners} onClick={(event) => event.stopPropagation()} className="flex size-7 touch-none cursor-grab items-center justify-center rounded-md border-0 bg-transparent p-0 text-kaist-grey/35 transition-colors hover:bg-slate-100 hover:text-kaist-grey/80 active:cursor-grabbing" aria-label={`${contact.nameKo} 표시 순서 변경`} title="드래그하여 순서 변경"><GripVertical aria-hidden="true" className="size-4" /></button></div>
    <div role="cell" className="min-w-0 px-5 py-3"><div className="admin-table-text-emphasis truncate" title={contact.nameKo}>{contact.nameKo}</div><div className="admin-table-text mt-0.5 truncate" title={contact.nameEn}>{contact.nameEn}</div></div>
    <div role="cell" className="min-w-0 truncate px-5 py-3 text-sm tabular-nums text-slate-700" title={contact.studentNumber ?? undefined}>{contact.studentNumber || "—"}</div>
    <div role="cell" className="px-5 py-3 text-sm tabular-nums text-slate-700">{formatActivityYear(contact.cohort)}</div>
    <div role="cell" className="min-w-0 px-5 py-3"><div className="admin-table-text truncate" title={contact.departmentKo ?? undefined}>{contact.departmentKo || "부서 미지정"}</div><div className="mt-0.5 truncate text-sm font-medium text-slate-700" title={contact.roleKo}>{contact.roleKo}</div><div className="admin-table-text mt-0.5 truncate" title={contact.roleEn}>{contact.roleEn}</div></div>
    <div role="cell" className="min-w-0 space-y-1 px-5 py-3"><div className="admin-table-text flex min-w-0 items-center gap-1.5"><Mail className="size-3.5 shrink-0 text-kaist-greygreen" aria-hidden="true" /><span className="truncate" title={contact.email ?? undefined}>{contact.email || "—"}</span></div><div className="admin-table-text flex min-w-0 items-center gap-1.5"><Phone className="size-3.5 shrink-0 text-kaist-greygreen" aria-hidden="true" /><span className="truncate" title={contact.phoneNumber ?? undefined}>{contact.phoneNumber || "—"}</span></div></div>
  </div>;
}

function ContactDragPreview({ contact, width }: { contact: ContactRecord; width: number | null }) {
  return <div style={{ width: width ?? undefined }} className={`${CONTACT_ROW_GRID} relative z-50 select-none min-h-20 cursor-grabbing rounded-lg border border-brand-primary/45 bg-white shadow-lg`}>
    <div className="flex items-center justify-center text-brand-primary"><GripVertical aria-hidden="true" className="size-4" /></div>
    <div className="min-w-0 px-5 py-3"><p className="truncate text-sm font-semibold text-slate-900">{contact.nameKo}</p><p className="truncate text-xs text-slate-500">{contact.nameEn}</p></div>
    <div className="min-w-0 truncate px-5 py-3 text-sm text-slate-700">{contact.studentNumber || "—"}</div>
    <div className="px-5 py-3 text-sm tabular-nums text-slate-700">{formatActivityYear(contact.cohort)}</div>
    <div className="min-w-0 px-5 py-3"><p className="truncate text-xs text-slate-500">{contact.departmentKo || "부서 미지정"}</p><p className="truncate text-sm text-slate-700">{contact.roleKo}</p><p className="mt-0.5 truncate text-xs text-slate-500">{contact.roleEn}</p></div>
    <div className="min-w-0 space-y-1 px-5 py-3 text-xs text-slate-500"><p className="truncate">{contact.email || "—"}</p><p className="truncate">{contact.phoneNumber || "—"}</p></div>
  </div>;
}
