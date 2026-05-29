import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createApiClient } from '@soc/api-client';
import type { StudentFeeListResponse, FeeStatus } from '@soc/contracts';
import { Button } from '@/components/ui/button';
import { Pagination } from '@/components/ui/pagination';
import { AuthGuard } from '@/components/guards/auth-guard';
import { useCurrentSession } from '@/hooks/use-current-session';
import { resolveApiBaseUrl } from '@/lib/api';
import { Permissions } from '@/lib/permissions';
import { ChevronDown } from 'lucide-react';

export function FeeManagementPage() {
  const navigate = useNavigate();
  const apiClient = useMemo(() => createApiClient({ baseUrl: resolveApiBaseUrl() }), []);
  const [feeData, setFeeData] = useState<StudentFeeListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<FeeStatus | undefined>(undefined);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [isPageSizeDropdownOpen, setIsPageSizeDropdownOpen] = useState(false);
  const [savingUserId, setSavingUserId] = useState<string | null>(null);
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const { data: session, isLoading: sessionLoading } = useCurrentSession();
  const students = feeData?.students ?? [];
  const totalCount = feeData?.total ?? 0;
  const paidCount = students.filter((student) => student.status === 'PAID').length;
  const unpaidCount = students.filter((student) => student.status === 'UNPAID').length;

  useEffect(() => {
    if (sessionLoading) {
      return;
    }
    if (!Permissions.has(session?.permission ?? 0, Permissions.MANAGE_FINANCE)) {
      return;
    }
    loadData();
  }, [selectedStatus, currentPage, pageSize, session, sessionLoading]);

  const loadData = async () => {
    try {
      setLoading(true);

      const data = await apiClient.listStudentsByFeeStatus(
        selectedStatus,
        currentPage,
        pageSize,
      );
      setFeeData(data);
      setNoteDrafts(
        Object.fromEntries(data.students.map((student) => [student.userId, student.note ?? ''])),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : '데이터 로딩 실패');
    } finally {
      setLoading(false);
    }
  };

  const saveStudentFeeStatus = async (userId: string, status: FeeStatus, note: string) => {
    try {
      setSavingUserId(userId);
      await apiClient.updateStudentFeeStatus(userId, {
        status,
        note: note.trim() ? note : null,
      });
      loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : '업데이트 실패');
    } finally {
      setSavingUserId(null);
    }
  };

  const handleStatusChange = (userId: string, status: FeeStatus) => {
    void saveStudentFeeStatus(userId, status, noteDrafts[userId] ?? '');
  };

  const handleStatusToggle = (userId: string, currentStatus: FeeStatus) => {
    const nextStatus: FeeStatus = currentStatus === 'PAID' ? 'UNPAID' : 'PAID';
    handleStatusChange(userId, nextStatus);
  };

  const handleNoteBlur = (userId: string, status: FeeStatus, note: string) => {
    const currentNote = feeData?.students.find((student) => student.userId === userId)?.note ?? '';
    if (currentNote === note) {
      return;
    }
    void saveStudentFeeStatus(userId, status, note);
  };

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  const getStatusBadgeStyle = (status: FeeStatus, disabled: boolean) => {
    const base = 'inline-flex rounded-full px-3 py-1 text-xs font-bold transition-all';
    const interactive = disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:brightness-95';

    if (status === 'PAID') {
      return `${base} ${interactive} border border-emerald-200 bg-emerald-50 text-emerald-700`;
    }

    return `${base} ${interactive} border border-rose-200 bg-rose-50 text-rose-700`;
  };

  const getStatusLabel = (status: FeeStatus) => (status === 'PAID' ? '납부 완료' : '미납부');

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  if (loading) {
    return (
        <div className="min-h-screen bg-slate-50/50 text-kaist-black pb-20">
          <main className="mx-auto flex w-full max-w-7xl items-center justify-center px-4 py-20 md:px-8">
            <div className="rounded-2xl border border-slate-100 bg-white px-8 py-10 text-center shadow-[0_8px_30px_rgba(0,0,0,0.015)]">
              <p className="text-[11px] font-extrabold uppercase tracking-[0.24em] text-slate-400">
                Fee Console
              </p>
              <p className="mt-3 text-lg font-black text-slate-800">과비 데이터를 불러오는 중입니다.</p>
              <p className="mt-2 text-sm font-semibold text-slate-400">잠시만 기다려 주세요.</p>
            </div>
          </main>
        </div>
    );
  }

  if (error) {
    return (
        <div className="min-h-screen bg-slate-50/50 text-kaist-black pb-20">
          <main className="mx-auto flex w-full max-w-4xl px-4 py-10 md:px-8">
            <div className="w-full rounded-2xl border border-slate-100 bg-white p-6 shadow-[0_8px_30px_rgba(0,0,0,0.015)]">
              <p className="text-[11px] font-extrabold uppercase tracking-[0.28em] text-slate-400">
                Fee Console
              </p>
              <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-700">
                {error}
              </div>
              <div className="mt-6">
                <Button onClick={() => navigate('/')} variant="outline" className="rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900">
                  홈으로 돌아가기
                </Button>
              </div>
            </div>
          </main>
        </div>
    );
  }

  return (
    <AuthGuard requirePermission={Permissions.MANAGE_FINANCE}>
      <div className="min-h-screen bg-slate-50/50 text-kaist-black pb-20">
        <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-8 md:px-8">
          
          {/* Compact Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-200 pb-5 gap-4 select-none">
            <div>
              <h1 className="text-2xl font-black tracking-tight text-slate-800">과비 관리</h1>
              <p className="mt-1 text-[13px] font-semibold leading-relaxed text-slate-400">
                학생별 과비 납부 상태를 한 화면에서 확인하고 바로 수정합니다.
              </p>
            </div>
            <div className="flex items-center gap-2 text-sm font-semibold">
              <span className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-slate-700">전체 {totalCount}명</span>
              <span className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-emerald-700">납부 완료 {paidCount}명</span>
              <span className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-rose-700">미납부 {unpaidCount}명</span>
            </div>
          </div>

          {/* Filters and Controls */}
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_8px_30px_rgba(0,0,0,0.015)]">
            <div className="flex items-center gap-2">
              <span className="mr-2 text-sm font-bold text-slate-400">필터:</span>
              {([
                { key: undefined, label: '전체' },
                { key: 'UNPAID', label: '미납부' },
                { key: 'PAID', label: '납부 완료' },
              ] as Array<{ key: FeeStatus | undefined; label: string }>).map((item) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => {
                    setSelectedStatus(item.key);
                    setCurrentPage(1);
                  }}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition cursor-pointer ${
                    selectedStatus === item.key
                      ? 'border-kaist-darkgreen bg-kaist-darkgreen text-white shadow-sm'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>

          </div>

        <section className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-[0_8px_30px_rgba(0,0,0,0.015)]">
          <div className="border-b border-slate-100 px-6 py-4 md:px-8 bg-white">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-extrabold tracking-tight text-slate-800">학생 목록 <span className="text-slate-400">({totalCount})</span></h2>
              </div>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsPageSizeDropdownOpen(!isPageSizeDropdownOpen)}
                  className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-[12px] font-semibold text-slate-700 transition-all cursor-pointer shadow-sm hover:bg-slate-50 focus:outline-none"
                >
                  <span>{pageSize}개씩 보기</span>
                  <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${isPageSizeDropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                {isPageSizeDropdownOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsPageSizeDropdownOpen(false)} />
                    <div className="absolute top-full right-0 mt-1.5 w-28 rounded-xl border border-slate-200 bg-white py-1.5 shadow-[0_4px_20px_rgba(0,0,0,0.06)] z-50 animate-in fade-in slide-in-from-top-1 duration-150 select-none">
                      {[10, 20, 50].map((size) => {
                        const isSelected = size === pageSize;
                        return (
                          <button
                            key={size}
                            type="button"
                            onClick={() => {
                              setPageSize(size);
                              setCurrentPage(1);
                              setIsPageSizeDropdownOpen(false);
                            }}
                            className={`flex w-full items-center justify-between border-0 bg-transparent px-3.5 py-2 text-left text-[12px] font-semibold transition-colors cursor-pointer ${
                              isSelected
                                ? 'bg-[#e6f4ea]/40 font-bold text-kaist-darkgreen'
                                : 'text-slate-700 hover:bg-slate-50'
                            }`}
                          >
                            <span>{size}개씩 보기</span>
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {students.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse text-sm">
                <thead className="bg-slate-50/50 text-slate-500">
                  <tr>
                    <th className="px-5 py-4 text-left text-[13px] font-extrabold uppercase tracking-[0.14em]">이름</th>
                    <th className="px-5 py-4 text-left text-[13px] font-extrabold uppercase tracking-[0.14em]">학번</th>
                    <th className="px-5 py-4 text-left text-[13px] font-extrabold uppercase tracking-[0.14em]">이메일</th>
                    <th className="px-5 py-4 text-left text-[13px] font-extrabold uppercase tracking-[0.14em]">상태</th>
                    <th className="px-5 py-4 text-left text-[13px] font-extrabold uppercase tracking-[0.14em]">납부일</th>
                    <th className="px-5 py-4 text-left text-[13px] font-extrabold uppercase tracking-[0.14em]">비고</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700 font-semibold">
                  {students.map((student) => (
                    <tr key={student.userId} className="transition hover:bg-slate-50/60">
                      <td className="px-5 py-4 align-top">
                        <div className="font-extrabold text-slate-800">{student.nameKo}</div>
                        {student.nameEn && <div className="mt-1 text-xs text-slate-400">{student.nameEn}</div>}
                      </td>
                      <td className="px-5 py-4 align-top text-slate-400">{student.stdNo || '-'}</td>
                      <td className="px-5 py-4 align-top text-slate-400">{student.email}</td>
                      <td className="px-5 py-4 align-top">
                        <button
                          type="button"
                          onClick={() => handleStatusToggle(student.userId, student.status)}
                          disabled={savingUserId === student.userId}
                          className={getStatusBadgeStyle(student.status, savingUserId === student.userId)}
                          title="클릭하여 상태 변경"
                        >
                          {getStatusLabel(student.status)}
                        </button>
                      </td>
                      <td className="px-5 py-4 align-top text-slate-400">
                        {student.paidAt ? new Date(student.paidAt).toLocaleDateString('ko-KR') : '-'}
                      </td>
                      <td className="px-5 py-4 align-top">
                        <input
                          type="text"
                          value={noteDrafts[student.userId] ?? student.note ?? ''}
                          onChange={(e) =>
                            setNoteDrafts((prev) => ({
                              ...prev,
                              [student.userId]: e.target.value,
                            }))
                          }
                          onBlur={(e) => handleNoteBlur(student.userId, student.status, e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.currentTarget.blur();
                            }
                          }}
                          disabled={savingUserId === student.userId}
                          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-800 outline-none transition focus:border-kaist-darkgreen focus:ring-2 focus:ring-kaist-darkgreen/10 disabled:cursor-not-allowed disabled:opacity-60"
                          placeholder="비고 (선택사항)"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="px-6 py-16 text-center text-sm font-semibold text-slate-400 md:px-8">
              해당하는 학생이 없습니다.
            </div>
          )}

          {totalCount > 0 && (
            <div className="border-t border-slate-100 bg-slate-50/10 px-6 py-4 flex items-center justify-center gap-2 select-none md:px-8">
              <Pagination
                currentPage={currentPage}
                onPageChange={setCurrentPage}
                totalPages={totalPages}
              />
            </div>
          )}
        </section>
        </main>
      </div>
    </AuthGuard>
  );
}
