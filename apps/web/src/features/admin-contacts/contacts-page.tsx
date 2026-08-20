import { useEffect, useMemo, useRef, useState } from "react";
import { createApiClient } from "@soc/api-client";
import type {
  BulkImportContactsRequest,
  ContactRecord,
  CreateContactRequest,
} from "@soc/contracts";
import { resolveApiBaseUrl } from "@/lib/api-base-url";
import {
  Download,
  Edit2,
  FileSpreadsheet,
  Mail,
  Phone,
  Plus,
  Save,
  Trash2,
  Upload,
  User,
  X,
} from "lucide-react";
import { AuthGuard } from "@/components/guards/auth-guard";
import { useConfirmDialog } from "@/components/ui/confirm-dialog";
import { TableSkeleton } from "@/components/ui/skeleton";
import { Permissions } from "@/lib/permissions";
import {
  CONTACT_CSV_TEMPLATE,
  parseContactCsv,
  type ParsedContactCsvRow,
} from "@/lib/contact-csv";

export function ContactsPage() {
  return (
    <AuthGuard requirePermission={Permissions.MANAGE_CONTENT}>
      <ContactsPageContent />
    </AuthGuard>
  );
}

function ContactsPageContent() {
  const apiClient = useMemo(() => createApiClient({ baseUrl: resolveApiBaseUrl() }), []);
  const { confirm: requestConfirm, ConfirmDialog } = useConfirmDialog();

  const [contacts, setContacts] = useState<ContactRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bulkRows, setBulkRows] = useState<ParsedContactCsvRow[]>([]);
  const [bulkErrors, setBulkErrors] = useState<string[]>([]);
  const [bulkFileName, setBulkFileName] = useState<string | null>(null);
  const [bulkReplaceExisting, setBulkReplaceExisting] = useState(false);
  const [bulkImporting, setBulkImporting] = useState(false);
  const bulkFileInputRef = useRef<HTMLInputElement>(null);

  // Form states
  const [isEditing, setIsEditing] = useState<string | null>(null); // contact ID or 'new'
  const [formData, setFormData] = useState<CreateContactRequest>({
    nameKo: "",
    nameEn: "",
    roleKo: "",
    roleEn: "",
    email: "",
    phoneNumber: "",
    sortOrder: 0,
  });

  const loadContacts = () => {
    setLoading(true);
    apiClient
      .getContacts()
      .then((res) => {
        // Sort contacts by sortOrder ascending
        const sorted = [...res.items].sort((a, b) => a.sortOrder - b.sortOrder);
        setContacts(sorted);
        setError(null);
      })
      .catch(() => {
        setError("연락망 정보를 불러오는 데 실패했습니다.");
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    loadContacts();
  }, []);

  const handleBulkFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    try {
      const parsed = parseContactCsv(await file.text());
      setBulkFileName(file.name);
      setBulkRows(parsed.rows);
      setBulkErrors(parsed.errors);
    } catch {
      setBulkFileName(file.name);
      setBulkRows([]);
      setBulkErrors(["CSV 파일을 읽지 못했습니다."]);
    }
  };

  const downloadContactTemplate = () => {
    const blob = new Blob(["\uFEFF" + CONTACT_CSV_TEMPLATE], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "executive_contacts_template.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleBulkImport = async () => {
    if (bulkRows.length === 0 || bulkErrors.length > 0) return;

    const payload: BulkImportContactsRequest = {
      items: bulkRows,
      replaceExisting: bulkReplaceExisting,
    };

    try {
      setBulkImporting(true);
      const result = await apiClient.bulkImportContacts(payload);
      setBulkRows([]);
      setBulkFileName(null);
      setBulkErrors([]);
      setBulkReplaceExisting(false);
      await loadContacts();
      alert(
        `${result.importedCount}명을 가져왔습니다.${
          result.removedCount > 0 ? ` 기존 ${result.removedCount}명은 교체되었습니다.` : ""
        }`,
      );
    } catch {
      setBulkErrors(["일괄 업로드에 실패했습니다. 입력값과 권한을 확인해 주세요."]);
    } finally {
      setBulkImporting(false);
    }
  };

  const handleEditClick = (contact: ContactRecord) => {
    setIsEditing(contact.id);
    setFormData({
      nameKo: contact.nameKo,
      nameEn: contact.nameEn,
      roleKo: contact.roleKo,
      roleEn: contact.roleEn,
      email: contact.email || "",
      phoneNumber: contact.phoneNumber || "",
      sortOrder: contact.sortOrder,
    });
  };

  const handleNewClick = () => {
    setIsEditing("new");
    setFormData({
      nameKo: "",
      nameEn: "",
      roleKo: "",
      roleEn: "",
      email: "",
      phoneNumber: "",
      sortOrder: contacts.length > 0 ? Math.max(...contacts.map(c => c.sortOrder)) + 10 : 10,
    });
  };

  const handleCancel = () => {
    setIsEditing(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const hasAllLocalizedFields = [
      formData.nameKo,
      formData.nameEn,
      formData.roleKo,
      formData.roleEn,
    ].every((value) => value.trim().length > 0);
    if (!hasAllLocalizedFields) {
      alert("한글·영문 이름과 역할/직책을 모두 입력해 주세요.");
      return;
    }

    const payload: CreateContactRequest = {
      ...formData,
      nameKo: formData.nameKo.trim(),
      nameEn: formData.nameEn.trim(),
      roleKo: formData.roleKo.trim(),
      roleEn: formData.roleEn.trim(),
    };

    try {
      if (isEditing === "new") {
        await apiClient.createContact(payload);
      } else if (isEditing) {
        await apiClient.updateContact(isEditing, payload);
      }
      setIsEditing(null);
      loadContacts();
    } catch (err) {
      alert("저장에 실패했습니다. 입력을 다시 확인해 주세요.");
    }
  };

  const handleDelete = async (id: string) => {
    const confirmed = await requestConfirm({
      confirmLabel: "삭제",
      description: "About 페이지의 구성원 연락처에서 즉시 제거됩니다.",
      title: "이 연락처를 삭제하시겠습니까?",
      tone: "danger",
    });
    if (!confirmed) return;

    try {
      await apiClient.deleteContact(id);
      loadContacts();
    } catch {
      alert("삭제에 실패했습니다.");
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/50 pb-20 text-slate-950">
      <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-8 md:px-8">
      {ConfirmDialog}
      <div className="flex flex-col justify-between gap-4 border-b border-slate-200 pb-5 md:flex-row md:items-center">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-800">집행위연락망 관리</h1>
          <p className="mt-1 text-[13px] font-semibold leading-relaxed text-slate-400">About 페이지 구성원 탭에 노출될 집행위원회 집행부원 연락망을 관리합니다.</p>
        </div>
        <button
          onClick={handleNewClick}
          className="inline-flex items-center gap-2 rounded-lg bg-kaist-darkgreen px-3.5 py-2 text-xs font-black text-white shadow-sm transition-all hover:bg-[#0f5c29] cursor-pointer border-0"
        >
          <Plus className="w-4 h-4" />
          부원 추가
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
          {error}
        </div>
      )}

      <section className="rounded-2xl border border-emerald-100 bg-emerald-50/50 p-5 shadow-[0_8px_30px_rgba(0,0,0,0.015)]">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
          <div>
            <div className="flex items-center gap-2 text-kaist-darkgreen">
              <FileSpreadsheet className="h-5 w-5" aria-hidden="true" />
              <h2 className="text-sm font-black">연락망 CSV 일괄 업로드</h2>
            </div>
            <p className="mt-1 text-xs font-semibold leading-5 text-emerald-900/70">
              한글/영문 이름·직책, 이메일, 전화번호를 한 번에 등록합니다. 기존 데이터를 유지한 채
              추가하거나, 필요할 때만 전체 교체할 수 있습니다.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={downloadContactTemplate}
              className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-white px-3 py-2 text-xs font-black text-emerald-800 transition hover:bg-emerald-50"
            >
              <Download className="h-3.5 w-3.5" aria-hidden="true" />
              양식 다운로드
            </button>
            <button
              type="button"
              onClick={() => bulkFileInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-kaist-darkgreen px-3 py-2 text-xs font-black text-white transition hover:bg-[#0f5c29]"
            >
              <Upload className="h-3.5 w-3.5" aria-hidden="true" />
              CSV 선택
            </button>
            <input
              ref={bulkFileInputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(event) => void handleBulkFileChange(event)}
            />
          </div>
        </div>

        {bulkFileName && (
          <div className="mt-4 rounded-xl border border-white/80 bg-white/80 p-4">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <div>
                <p className="text-xs font-black text-slate-800">{bulkFileName}</p>
                <p className="mt-1 text-xs font-semibold text-slate-500">
                  정상 행 {bulkRows.length}개 · 오류 {bulkErrors.length}개
                </p>
              </div>
              <label className="inline-flex items-center gap-2 text-xs font-bold text-slate-700">
                <input
                  type="checkbox"
                  checked={bulkReplaceExisting}
                  onChange={(event) => setBulkReplaceExisting(event.target.checked)}
                  className="h-4 w-4 accent-kaist-darkgreen"
                />
                기존 연락망 전체 교체
              </label>
            </div>

            {bulkErrors.length > 0 && (
              <ul className="mt-3 space-y-1 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
                {bulkErrors.slice(0, 8).map((message) => (
                  <li key={message}>{message}</li>
                ))}
                {bulkErrors.length > 8 && <li>외 {bulkErrors.length - 8}건</li>}
              </ul>
            )}

            {bulkRows.length > 0 && bulkErrors.length === 0 && (
              <div className="mt-3 overflow-x-auto rounded-lg border border-slate-100">
                <table className="min-w-full text-left text-xs">
                  <thead className="bg-slate-50 font-black text-slate-500">
                    <tr>
                      <th className="px-3 py-2">이름</th>
                      <th className="px-3 py-2">직책</th>
                      <th className="px-3 py-2">이메일</th>
                      <th className="px-3 py-2">순서</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white font-semibold text-slate-700">
                    {bulkRows.slice(0, 5).map((row, index) => (
                      <tr key={`${row.email}-${index}`}>
                        <td className="px-3 py-2">{row.nameKo}</td>
                        <td className="px-3 py-2">{row.roleKo}</td>
                        <td className="px-3 py-2">{row.email || "—"}</td>
                        <td className="px-3 py-2">{row.sortOrder ?? "자동"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {bulkRows.length > 5 && (
                  <p className="border-t border-slate-100 px-3 py-2 text-[11px] font-bold text-slate-400">
                    미리보기는 처음 5행만 표시합니다.
                  </p>
                )}
              </div>
            )}

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setBulkRows([]);
                  setBulkErrors([]);
                  setBulkFileName(null);
                  setBulkReplaceExisting(false);
                }}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-600"
              >
                취소
              </button>
              <button
                type="button"
                disabled={bulkRows.length === 0 || bulkErrors.length > 0 || bulkImporting}
                onClick={() => void handleBulkImport()}
                className="inline-flex items-center gap-1.5 rounded-lg bg-kaist-darkgreen px-3 py-2 text-xs font-black text-white disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                <Upload className="h-3.5 w-3.5" aria-hidden="true" />
                {bulkImporting ? "가져오는 중..." : "일괄 등록"}
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Editor Modal/Panel */}
      {isEditing && (
        <form onSubmit={handleSave} className="animate-in fade-in slide-in-from-top-4 rounded-2xl border border-slate-100 bg-white p-5 shadow-[0_8px_30px_rgba(0,0,0,0.015)] duration-200 space-y-5">
          <div className="flex justify-between items-center border-b border-slate-100 pb-3">
            <h2 className="text-base font-extrabold tracking-tight text-slate-800">
              {isEditing === "new" ? "새 집행부원 등록" : "집행부원 정보 수정"}
            </h2>
            <button
              type="button"
              onClick={handleCancel}
              className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors text-slate-400 cursor-pointer border-0 bg-transparent"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1.5">이름 (한글) *</label>
              <input
                type="text"
                required
                value={formData.nameKo}
                onChange={(e) => setFormData({ ...formData, nameKo: e.target.value })}
                className="w-full rounded-lg border border-slate-200 px-3.5 py-2 text-xs font-bold text-slate-950 outline-none transition focus:border-kaist-darkgreen focus:ring-2 focus:ring-kaist-darkgreen/10"
                placeholder="홍길동"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1.5">이름 (영문) *</label>
              <input
                type="text"
                required
                value={formData.nameEn}
                onChange={(e) => setFormData({ ...formData, nameEn: e.target.value })}
                className="w-full rounded-lg border border-slate-200 px-3.5 py-2 text-xs font-bold text-slate-950 outline-none transition focus:border-kaist-darkgreen focus:ring-2 focus:ring-kaist-darkgreen/10"
                placeholder="Gildong Hong"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1.5">역할 / 직책 (한글) *</label>
              <input
                type="text"
                required
                value={formData.roleKo}
                onChange={(e) => setFormData({ ...formData, roleKo: e.target.value })}
                className="w-full rounded-lg border border-slate-200 px-3.5 py-2 text-xs font-bold text-slate-950 outline-none transition focus:border-kaist-darkgreen focus:ring-2 focus:ring-kaist-darkgreen/10"
                placeholder="회장, 기획부장 등"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1.5">역할 / 직책 (영문) *</label>
              <input
                type="text"
                required
                value={formData.roleEn}
                onChange={(e) => setFormData({ ...formData, roleEn: e.target.value })}
                className="w-full rounded-lg border border-slate-200 px-3.5 py-2 text-xs font-bold text-slate-950 outline-none transition focus:border-kaist-darkgreen focus:ring-2 focus:ring-kaist-darkgreen/10"
                placeholder="President, Head of Planning etc."
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1.5">이메일</label>
              <input
                type="email"
                value={formData.email || ""}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full rounded-lg border border-slate-200 px-3.5 py-2 text-xs font-bold text-slate-950 outline-none transition focus:border-kaist-darkgreen focus:ring-2 focus:ring-kaist-darkgreen/10"
                placeholder="email@kaist.ac.kr"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1.5">전화번호</label>
              <input
                type="text"
                value={formData.phoneNumber || ""}
                onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                className="w-full rounded-lg border border-slate-200 px-3.5 py-2 text-xs font-bold text-slate-950 outline-none transition focus:border-kaist-darkgreen focus:ring-2 focus:ring-kaist-darkgreen/10"
                placeholder="010-XXXX-XXXX"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1.5">정렬 순서 (낮을수록 먼저 노출)</label>
              <input
                type="number"
                value={formData.sortOrder}
                onChange={(e) => setFormData({ ...formData, sortOrder: parseInt(e.target.value) || 0 })}
                className="w-full rounded-lg border border-slate-200 px-3.5 py-2 text-xs font-bold text-slate-950 outline-none transition focus:border-kaist-darkgreen focus:ring-2 focus:ring-kaist-darkgreen/10"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={handleCancel}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-600 transition-all hover:bg-slate-50 cursor-pointer"
            >
              취소
            </button>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 rounded-lg bg-kaist-darkgreen px-3 py-2 text-xs font-black text-white transition-all hover:bg-[#0f5c29] cursor-pointer border-0"
            >
              <Save className="w-4 h-4" />
              저장
            </button>
          </div>
        </form>
      )}

      {/* List Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-[0_8px_30px_rgba(0,0,0,0.015)]">
        {loading ? (
          <TableSkeleton columns={5} rows={6} />
        ) : contacts.length === 0 ? (
          <div className="p-12 text-center text-sm font-bold text-slate-400">등록된 집행부원이 없습니다.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-xs font-black text-slate-500">
                  <th className="px-6 py-4 w-16 text-center">순서</th>
                  <th className="px-6 py-4">이름 (한글/영문)</th>
                  <th className="px-6 py-4">역할 / 직책</th>
                  <th className="px-6 py-4">연락처 정보</th>
                  <th className="px-6 py-4 w-28 text-center">관리</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {contacts.map((contact) => (
                  <tr key={contact.id} className="transition-colors hover:bg-slate-50/60">
                    <td className="px-6 py-4 text-center font-bold text-slate-400">
                      {contact.sortOrder}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-kaist-lightgreen/10 flex items-center justify-center text-kaist-darkgreen shrink-0">
                          <User className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="font-extrabold text-slate-800 truncate max-w-[150px]" title={contact.nameKo}>{contact.nameKo}</div>
                          <div className="mt-0.5 truncate max-w-[150px] text-xs font-semibold text-slate-400" title={contact.nameEn}>{contact.nameEn}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-bold text-slate-700 truncate max-w-[180px]" title={contact.roleKo}>{contact.roleKo}</div>
                      <div className="mt-0.5 truncate max-w-[180px] text-xs font-semibold text-slate-400" title={contact.roleEn}>{contact.roleEn}</div>
                    </td>
                    <td className="px-6 py-4 space-y-1 min-w-0">
                      {contact.email && (
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
                          <Mail className="w-3.5 h-3.5 text-kaist-greygreen shrink-0" />
                          <span className="truncate max-w-[180px]" title={contact.email}>{contact.email}</span>
                        </div>
                      )}
                      {contact.phoneNumber && (
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
                          <Phone className="w-3.5 h-3.5 text-kaist-greygreen shrink-0" />
                          <span className="truncate max-w-[150px]" title={contact.phoneNumber}>{contact.phoneNumber}</span>
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleEditClick(contact)}
                          className="p-2 hover:bg-kaist-lightgreen/10 hover:text-kaist-darkgreen text-slate-500 rounded-lg transition-colors cursor-pointer border-0 bg-transparent"
                          title="수정"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(contact.id)}
                          className="p-2 hover:bg-red-50 hover:text-red-500 text-slate-500 rounded-lg transition-colors cursor-pointer border-0 bg-transparent"
                          title="삭제"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      </main>
    </div>
  );
}
