import { useEffect, useMemo, useState } from "react";
import { createApiClient } from "@soc/api-client";
import type { ContactRecord, CreateContactRequest } from "@soc/contracts";
import { resolveApiBaseUrl } from "@/lib/api-base-url";
import { Plus, Edit2, Trash2, Save, X, Phone, Mail, User } from "lucide-react";
import { AuthGuard } from "@/components/guards/auth-guard";
import { useConfirmDialog } from "@/components/ui/confirm-dialog";
import { Permissions } from "@/lib/permissions";

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

  const handleEditClick = (contact: ContactRecord) => {
    setIsEditing(contact.id);
    setFormData({
      nameKo: contact.nameKo,
      nameEn: contact.nameEn || "",
      roleKo: contact.roleKo,
      roleEn: contact.roleEn || "",
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
    if (!formData.nameKo || !formData.roleKo) {
      alert("이름(한글)과 역할(한글)은 필수 입력 사항입니다.");
      return;
    }

    try {
      if (isEditing === "new") {
        await apiClient.createContact(formData);
      } else if (isEditing) {
        await apiClient.updateContact(isEditing, formData);
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
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {ConfirmDialog}
      <div className="flex justify-between items-center border-b border-gray-100 pb-5">
        <div>
          <h1 className="text-2xl font-black text-kaist-black tracking-tight">집행위연락망 관리</h1>
          <p className="text-sm text-kaist-grey mt-1">About 페이지 구성원 탭에 노출될 집행위원회 집행부원 연락망을 관리합니다.</p>
        </div>
        <button
          onClick={handleNewClick}
          className="flex items-center gap-2 bg-kaist-darkgreen hover:bg-kaist-darkgreen/90 text-white font-bold text-sm px-4 py-2.5 rounded-xl transition-all shadow-md shadow-kaist-darkgreen/15 cursor-pointer border-0"
        >
          <Plus className="w-4 h-4" />
          부원 추가
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm font-medium">
          {error}
        </div>
      )}

      {/* Editor Modal/Panel */}
      {isEditing && (
        <form onSubmit={handleSave} className="bg-white border border-gray-200 rounded-2xl p-6 shadow-xl space-y-6 animate-in fade-in slide-in-from-top-4 duration-200">
          <div className="flex justify-between items-center border-b border-gray-100 pb-3">
            <h2 className="text-lg font-bold text-kaist-black">
              {isEditing === "new" ? "새 집행부원 등록" : "집행부원 정보 수정"}
            </h2>
            <button
              type="button"
              onClick={handleCancel}
              className="p-1.5 hover:bg-gray-100 rounded-xl transition-colors text-gray-400 cursor-pointer border-0 bg-transparent"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1.5">이름 (한글) *</label>
              <input
                type="text"
                required
                value={formData.nameKo}
                onChange={(e) => setFormData({ ...formData, nameKo: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-kaist-darkgreen focus:ring-1 focus:ring-kaist-darkgreen"
                placeholder="홍길동"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1.5">이름 (영문)</label>
              <input
                type="text"
                value={formData.nameEn || ""}
                onChange={(e) => setFormData({ ...formData, nameEn: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-kaist-darkgreen focus:ring-1 focus:ring-kaist-darkgreen"
                placeholder="Gildong Hong"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1.5">역할 / 직책 (한글) *</label>
              <input
                type="text"
                required
                value={formData.roleKo}
                onChange={(e) => setFormData({ ...formData, roleKo: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-kaist-darkgreen focus:ring-1 focus:ring-kaist-darkgreen"
                placeholder="회장, 기획부장 등"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1.5">역할 / 직책 (영문)</label>
              <input
                type="text"
                value={formData.roleEn || ""}
                onChange={(e) => setFormData({ ...formData, roleEn: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-kaist-darkgreen focus:ring-1 focus:ring-kaist-darkgreen"
                placeholder="President, Head of Planning etc."
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1.5">이메일</label>
              <input
                type="email"
                value={formData.email || ""}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-kaist-darkgreen focus:ring-1 focus:ring-kaist-darkgreen"
                placeholder="email@kaist.ac.kr"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1.5">전화번호</label>
              <input
                type="text"
                value={formData.phoneNumber || ""}
                onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-kaist-darkgreen focus:ring-1 focus:ring-kaist-darkgreen"
                placeholder="010-XXXX-XXXX"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1.5">정렬 순서 (낮을수록 먼저 노출)</label>
              <input
                type="number"
                value={formData.sortOrder}
                onChange={(e) => setFormData({ ...formData, sortOrder: parseInt(e.target.value) || 0 })}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-kaist-darkgreen focus:ring-1 focus:ring-kaist-darkgreen"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 border-t border-gray-100 pt-4">
            <button
              type="button"
              onClick={handleCancel}
              className="bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-200 font-bold px-4 py-2.5 rounded-xl transition-all cursor-pointer"
            >
              취소
            </button>
            <button
              type="submit"
              className="flex items-center gap-1.5 bg-kaist-darkgreen hover:bg-kaist-darkgreen/90 text-white font-bold text-sm px-5 py-2.5 rounded-xl transition-all shadow-md shadow-kaist-darkgreen/15 cursor-pointer border-0"
            >
              <Save className="w-4 h-4" />
              저장
            </button>
          </div>
        </form>
      )}

      {/* List Table */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-12 text-center text-kaist-grey/60 font-medium">로딩 중...</div>
        ) : contacts.length === 0 ? (
          <div className="p-12 text-center text-kaist-grey/60 font-medium">등록된 집행부원이 없습니다.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100 text-xs font-extrabold text-gray-500 uppercase tracking-wider">
                  <th className="px-6 py-4 w-16 text-center">순서</th>
                  <th className="px-6 py-4">이름 (한글/영문)</th>
                  <th className="px-6 py-4">역할 / 직책</th>
                  <th className="px-6 py-4">연락처 정보</th>
                  <th className="px-6 py-4 w-28 text-center">관리</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm">
                {contacts.map((contact) => (
                  <tr key={contact.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4 text-center font-bold text-kaist-grey">
                      {contact.sortOrder}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-kaist-lightgreen/10 flex items-center justify-center text-kaist-darkgreen shrink-0">
                          <User className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="font-bold text-gray-900 truncate max-w-[150px]" title={contact.nameKo}>{contact.nameKo}</div>
                          {contact.nameEn && <div className="text-xs text-kaist-grey mt-0.5 truncate max-w-[150px]" title={contact.nameEn}>{contact.nameEn}</div>}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-semibold text-gray-800 truncate max-w-[180px]" title={contact.roleKo}>{contact.roleKo}</div>
                      {contact.roleEn && <div className="text-xs text-kaist-grey mt-0.5 truncate max-w-[180px]" title={contact.roleEn}>{contact.roleEn}</div>}
                    </td>
                    <td className="px-6 py-4 space-y-1 min-w-0">
                      {contact.email && (
                        <div className="flex items-center gap-1.5 text-xs text-gray-600">
                          <Mail className="w-3.5 h-3.5 text-kaist-greygreen shrink-0" />
                          <span className="truncate max-w-[180px]" title={contact.email}>{contact.email}</span>
                        </div>
                      )}
                      {contact.phoneNumber && (
                        <div className="flex items-center gap-1.5 text-xs text-gray-600">
                          <Phone className="w-3.5 h-3.5 text-kaist-greygreen shrink-0" />
                          <span className="truncate max-w-[150px]" title={contact.phoneNumber}>{contact.phoneNumber}</span>
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleEditClick(contact)}
                          className="p-2 hover:bg-kaist-lightgreen/10 hover:text-kaist-darkgreen text-gray-500 rounded-xl transition-colors cursor-pointer border-0 bg-transparent"
                          title="수정"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(contact.id)}
                          className="p-2 hover:bg-red-50 hover:text-red-500 text-gray-500 rounded-xl transition-colors cursor-pointer border-0 bg-transparent"
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
    </div>
  );
}
