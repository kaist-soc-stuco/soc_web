import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createApiClient } from '@soc/api-client';
import type { StudentFeeListResponse, FeeStatus } from '@soc/contracts';
import { Button } from '@/components/ui/button';
import { resolveApiBaseUrl } from '@/lib/api';
import { Permissions } from '@/lib/permissions';

export function FeeManagementPage() {
  const navigate = useNavigate();
  const apiClient = useMemo(() => createApiClient({ baseUrl: resolveApiBaseUrl() }), []);
  const [feeData, setFeeData] = useState<StudentFeeListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<FeeStatus | undefined>(undefined);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(20);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editStatus, setEditStatus] = useState<FeeStatus>('UNPAID');
  const [editNote, setEditNote] = useState('');
  const students = feeData?.students ?? [];
  const totalCount = feeData?.total ?? 0;
  const paidCount = students.filter((student) => student.status === 'PAID').length;
  const unpaidCount = students.filter((student) => student.status === 'UNPAID').length;

  useEffect(() => {
    loadData();
  }, [selectedStatus, currentPage]);

  const loadData = async () => {
    try {
      setLoading(true);

      const me = await apiClient.getCurrentUser();
      const permission = me?.user?.permission ?? 0;
      if (!Permissions.has(permission, Permissions.MANAGE_FINANCE)) {
        setError('과비 관리 권한이 없습니다.');
        navigate('/');
        return;
      }

      const data = await apiClient.listStudentsByFeeStatus(
        selectedStatus,
        currentPage,
        pageSize,
      );
      setFeeData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '데이터 로딩 실패');
    } finally {
      setLoading(false);
    }
  };

  const handleEditClick = (userId: string, status: FeeStatus, note: string | null) => {
    setEditingUserId(userId);
    setEditStatus(status);
    setEditNote(note || '');
  };

  const handleSaveClick = async (userId: string) => {
    try {
      await apiClient.updateStudentFeeStatus(userId, {
        status: editStatus,
        note: editNote || null,
      });
      setEditingUserId(null);
      loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : '업데이트 실패');
    }
  };

  const handleCancelClick = () => {
    setEditingUserId(null);
  };

  const getStatusBadgeColor = (status: FeeStatus) => {
    switch (status) {
      case 'PAID':
        return 'bg-green-100 text-green-800';
      case 'UNPAID':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusLabel = (status: FeeStatus) => {
    switch (status) {
      case 'PAID':
        return '납부 완료';
      case 'UNPAID':
        return '미납부';
      default:
        return '미납부';
    }
  };

  if (loading) {
    return (
        <div className="min-h-screen bg-gradient-to-br from-kaist-white via-[#f4f7f1] to-[#edf4ef] text-kaist-black">
          <main className="mx-auto flex w-full max-w-6xl items-center justify-center px-4 py-20 md:px-8">
            <div className="rounded-3xl border border-kaist-darkgreen/10 bg-white px-8 py-10 shadow-[0_20px_60px_rgba(11,31,18,0.08)]">
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-kaist-greygreen">
                Fee Console
              </p>
              <p className="mt-3 text-lg font-bold text-kaist-black">과비 데이터를 불러오는 중입니다.</p>
              <p className="mt-2 text-sm text-kaist-grey">잠시만 기다려 주세요.</p>
            </div>
          </main>
        </div>
    );
  }

  if (error) {
    return (
        <div className="min-h-screen bg-gradient-to-br from-kaist-white via-[#f4f7f1] to-[#edf4ef] text-kaist-black">
          <main className="mx-auto flex w-full max-w-4xl px-4 py-10 md:px-8">
            <div className="w-full rounded-3xl border border-red-200 bg-white p-6 shadow-[0_20px_60px_rgba(11,31,18,0.08)]">
              <p className="text-xs font-extrabold uppercase tracking-[0.28em] text-kaist-greygreen">
                Fee Console
              </p>
              <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-red-700">
                {error}
              </div>
              <div className="mt-6">
                <Button onClick={() => navigate('/')} variant="outline">
                  홈으로 돌아가기
                </Button>
              </div>
            </div>
          </main>
        </div>
    );
  }

  return (
      <div className="min-h-screen bg-gradient-to-br from-kaist-white via-[#f4f7f1] to-[#edf4ef] text-kaist-black">
        <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-10 md:px-8">
        <section className="overflow-hidden rounded-3xl border border-kaist-darkgreen/10 bg-white shadow-[0_20px_60px_rgba(11,31,18,0.08)]">
          <div className="grid gap-6 p-6 md:grid-cols-[1.25fr_0.95fr] md:p-8">
            <div className="space-y-4">
              <p className="text-xs font-extrabold uppercase tracking-[0.28em] text-kaist-greygreen">
                Fee Console
              </p>
              <h1 className="text-3xl font-black tracking-tight md:text-4xl">
                과비 관리
              </h1>
              <p className="max-w-2xl text-sm leading-7 text-kaist-grey md:text-base">
                학생별 과비 납부 상태를 한 화면에서 확인하고, 필요할 때 바로 수정할 수 있습니다.
              </p>
              <div className="flex flex-wrap gap-3 pt-2 text-sm font-semibold text-kaist-darkgreen/80">
                <span className="rounded-full bg-kaist-darkgreen/6 px-4 py-2">전체 {totalCount}명</span>
                <span className="rounded-full bg-green-50 px-4 py-2 text-green-700">납부 완료 {paidCount}명</span>
                <span className="rounded-full bg-red-50 px-4 py-2 text-red-700">미납부 {unpaidCount}명</span>
              </div>
            </div>

            <div className="grid gap-3 rounded-2xl bg-kaist-darkgreen/5 p-5 md:p-6">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-kaist-greygreen">
                  Filter
                </p>
                <p className="mt-2 text-lg font-extrabold">
                  {selectedStatus ? getStatusLabel(selectedStatus) : '전체 보기'}
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
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
                    className={`rounded-2xl border px-4 py-3 text-left text-sm font-bold transition ${
                      selectedStatus === item.key
                        ? 'border-kaist-darkgreen bg-kaist-darkgreen text-white shadow-lg shadow-kaist-darkgreen/20'
                        : 'border-kaist-darkgreen/10 bg-white text-kaist-black hover:border-kaist-darkgreen/30 hover:bg-kaist-darkgreen/5'
                    }`}
                  >
                    <span className="block text-xs uppercase tracking-[0.2em] opacity-70">
                      Status
                    </span>
                    <span className="mt-1 block">{item.label}</span>
                  </button>
                ))}
              </div>
              <div className="flex items-center justify-between rounded-2xl bg-white p-4 shadow-sm">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-kaist-greygreen">
                    Page
                  </p>
                  <p className="mt-1 text-sm font-bold text-kaist-black">
                    {currentPage} / {Math.max(1, Math.ceil(totalCount / pageSize))}
                  </p>
                </div>
                <Button variant="outline" onClick={loadData}>
                  새로고침
                </Button>
              </div>
            </div>
          </div>
        </section>

        <section className="overflow-hidden rounded-3xl border border-kaist-darkgreen/10 bg-white shadow-[0_20px_60px_rgba(11,31,18,0.08)]">
          <div className="border-b border-kaist-darkgreen/10 px-6 py-4 md:px-8">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-black md:text-xl">학생 목록</h2>
                <p className="text-sm text-kaist-grey">행을 선택해 상태와 비고를 수정할 수 있습니다.</p>
              </div>
              <Button variant="ghost" onClick={() => navigate('/admin/permissions')}>
                권한 관리
              </Button>
            </div>
          </div>

          {students.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse text-sm">
                <thead className="bg-kaist-darkgreen/5 text-kaist-grey">
                  <tr>
                    <th className="px-5 py-4 text-left font-bold uppercase tracking-[0.16em]">이름</th>
                    <th className="px-5 py-4 text-left font-bold uppercase tracking-[0.16em]">학번</th>
                    <th className="px-5 py-4 text-left font-bold uppercase tracking-[0.16em]">이메일</th>
                    <th className="px-5 py-4 text-left font-bold uppercase tracking-[0.16em]">상태</th>
                    <th className="px-5 py-4 text-left font-bold uppercase tracking-[0.16em]">납부일</th>
                    <th className="px-5 py-4 text-left font-bold uppercase tracking-[0.16em]">비고</th>
                    <th className="px-5 py-4 text-center font-bold uppercase tracking-[0.16em]">작업</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-kaist-darkgreen/10">
                  {students.map((student) => (
                    <tr key={student.userId} className="transition hover:bg-kaist-darkgreen/3">
                      <td className="px-5 py-4 align-top">
                        <div className="font-semibold text-kaist-black">{student.nameKo}</div>
                        {student.nameEn && <div className="mt-1 text-xs text-kaist-grey">{student.nameEn}</div>}
                      </td>
                      <td className="px-5 py-4 align-top text-kaist-grey">{student.stdNo || '-'}</td>
                      <td className="px-5 py-4 align-top text-kaist-grey">{student.email}</td>
                      <td className="px-5 py-4 align-top">
                        {editingUserId === student.userId ? (
                          <select
                            value={editStatus}
                            onChange={(e) => setEditStatus(e.target.value as FeeStatus)}
                            className="w-full rounded-2xl border border-kaist-darkgreen/15 bg-white px-3 py-2 text-sm font-semibold outline-none transition focus:border-kaist-darkgreen"
                          >
                            <option value="PAID">납부 완료</option>
                            <option value="UNPAID">미납부</option>
                          </select>
                        ) : (
                          <span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${getStatusBadgeColor(student.status)}`}>
                            {getStatusLabel(student.status)}
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-4 align-top text-kaist-grey">
                        {student.paidAt ? new Date(student.paidAt).toLocaleDateString('ko-KR') : '-'}
                      </td>
                      <td className="px-5 py-4 align-top">
                        {editingUserId === student.userId ? (
                          <textarea
                            value={editNote}
                            onChange={(e) => setEditNote(e.target.value)}
                            className="min-h-[4.5rem] w-full rounded-2xl border border-kaist-darkgreen/15 bg-white px-3 py-2 text-sm outline-none transition focus:border-kaist-darkgreen"
                            rows={2}
                            placeholder="비고 (선택사항)"
                          />
                        ) : (
                          <span className="text-kaist-grey">{student.note || '-'}</span>
                        )}
                      </td>
                      <td className="px-5 py-4 align-top text-center">
                        {editingUserId === student.userId ? (
                          <div className="flex justify-center gap-2">
                            <Button onClick={() => handleSaveClick(student.userId)}>
                              저장
                            </Button>
                            <Button variant="outline" onClick={handleCancelClick}>
                              취소
                            </Button>
                          </div>
                        ) : (
                          <Button variant="outline" onClick={() => handleEditClick(student.userId, student.status, student.note)}>
                            수정
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="px-6 py-16 text-center text-kaist-grey md:px-8">
              해당하는 학생이 없습니다.
            </div>
          )}

          {totalCount > 0 && (
            <div className="flex items-center justify-center gap-3 border-t border-kaist-darkgreen/10 px-6 py-5 md:px-8">
              <Button
                variant="outline"
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
              >
                이전
              </Button>
              <span className="min-w-24 text-center text-sm font-semibold text-kaist-grey">
                {currentPage} / {Math.max(1, Math.ceil(totalCount / pageSize))}
              </span>
              <Button
                variant="outline"
                onClick={() => setCurrentPage(currentPage + 1)}
                disabled={currentPage >= Math.ceil(totalCount / pageSize)}
              >
                다음
              </Button>
            </div>
          )}
        </section>
        </main>
      </div>
  );
}
