import { useEffect, useMemo, useState } from 'react';
import { createApiClient } from '@soc/api-client';
import type {
  FeeStatus,
  StudentFeeListResponse,
  UpdateStudentFeeStatusRequest,
} from '@soc/contracts';
import { isoToDate, nowIso } from '@soc/shared';
import { Pagination } from '@/components/ui/pagination';
import { Skeleton, TableSkeleton } from '@/components/ui/skeleton';
import { AuthGuard } from '@/components/guards/auth-guard';
import { useCurrentSession } from '@/hooks/use-current-session';
import { resolveApiBaseUrl } from '@/lib/api';
import { Permissions } from '@/lib/permissions';
import { ArrowDown, ChevronDown } from 'lucide-react';

type FeeSortBy = 'name' | 'studentId' | 'status' | 'paidAt';
type SortDirection = 'asc' | 'desc';
type StudentFeeRow = StudentFeeListResponse['students'][number];

export function FeeManagementPage() {
  const apiClient = useMemo(() => createApiClient({ baseUrl: resolveApiBaseUrl() }), []);
  const [feeData, setFeeData] = useState<StudentFeeListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [operationError, setOperationError] = useState<string | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<FeeStatus | undefined>(undefined);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [isPageSizeDropdownOpen, setIsPageSizeDropdownOpen] = useState(false);
  const [savingUserId, setSavingUserId] = useState<string | null>(null);
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const [sortBy, setSortBy] = useState<FeeSortBy>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
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
  }, [
    selectedStatus,
    currentPage,
    pageSize,
    session,
    sessionLoading,
    sortBy,
    sortDirection,
  ]);

  const loadData = async () => {
    try {
      setLoading(true);

      const data = await apiClient.listStudentsByFeeStatus(
        selectedStatus,
        currentPage,
        pageSize,
        sortBy,
        sortDirection,
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

  const updateStudentRow = (userId: string, patch: Partial<StudentFeeRow>) => {
    setFeeData((current) => {
      if (!current) return current;

      const nextStudents = current.students
        .map((student) =>
          student.userId === userId ? { ...student, ...patch } : student,
        )
        .filter((student) => !selectedStatus || student.status === selectedStatus);
      const removedByFilter =
        current.students.length > nextStudents.length &&
        current.students.some((student) => student.userId === userId);

      return {
        ...current,
        students: nextStudents,
        total: removedByFilter ? Math.max(0, current.total - 1) : current.total,
      };
    });
  };

  const saveStudentFeeStatus = async (
    userId: string,
    input: UpdateStudentFeeStatusRequest,
  ) => {
    const previousStudent = feeData?.students.find((student) => student.userId === userId);
    const previousNoteDraft = noteDrafts[userId];
    const nextStatus = input.status ?? previousStudent?.status ?? 'UNPAID';
    const nextNote = input.note !== undefined ? input.note : previousStudent?.note ?? null;
    const statusChanged = input.status !== undefined && input.status !== previousStudent?.status;
    const optimisticPaidAt = statusChanged
      ? nextStatus === 'PAID'
        ? nowIso()
        : null
      : previousStudent?.paidAt ?? null;

    try {
      setSavingUserId(userId);
      setOperationError(null);
      updateStudentRow(userId, {
        note: nextNote,
        paidAt: optimisticPaidAt,
        status: nextStatus,
      });

      const record = await apiClient.updateStudentFeeStatus(userId, input);
      setNoteDrafts((prev) => ({
        ...prev,
        [userId]: record.note ?? '',
      }));
      updateStudentRow(userId, {
        note: record.note,
        paidAt: record.paidAt,
        status: record.status,
        verifiedAt: record.verifiedAt,
      });
    } catch (err) {
      if (previousStudent) {
        setFeeData((current) => {
          if (!current) return current;
          const hasPreviousRow = current.students.some(
            (student) => student.userId === userId,
          );

          return {
            ...current,
            students: hasPreviousRow
              ? current.students.map((student) =>
                  student.userId === userId ? previousStudent : student,
                )
              : [previousStudent, ...current.students],
            total: hasPreviousRow ? current.total : current.total + 1,
          };
        });
      }
      setNoteDrafts((prev) => ({
        ...prev,
        [userId]: previousNoteDraft ?? previousStudent?.note ?? '',
      }));
      setOperationError(err instanceof Error ? err.message : '업데이트 실패');
    } finally {
      setSavingUserId(null);
    }
  };

  const handleStatusChange = (userId: string, status: FeeStatus) => {
    const note = noteDrafts[userId] ?? '';
    void saveStudentFeeStatus(userId, {
      status,
      note: note.trim() ? note : null,
    });
  };

  const handleStatusToggle = (userId: string, currentStatus: FeeStatus) => {
    const nextStatus: FeeStatus = currentStatus === 'PAID' ? 'UNPAID' : 'PAID';
    handleStatusChange(userId, nextStatus);
  };

  const handleNoteBlur = (userId: string, note: string) => {
    const currentNote = feeData?.students.find((student) => student.userId === userId)?.note ?? '';
    if (currentNote === note) {
      return;
    }
    void saveStudentFeeStatus(userId, { note: note.trim() ? note : null });
  };

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const isInitialLoading = loading && feeData === null;

  const getStatusBadgeStyle = (status: FeeStatus, disabled: boolean) => {
    const base = 'inline-flex rounded-full px-3 py-1 text-xs font-bold transition-all';
    const interactive = disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:brightness-95';

    if (status === 'PAID') {
      return `${base} ${interactive} border border-emerald-200 bg-emerald-50 text-emerald-700`;
    }

    return `${base} ${interactive} border border-rose-200 bg-rose-50 text-rose-700`;
  };

  const getStatusLabel = (status: FeeStatus) => (status === 'PAID' ? '납부 완료' : '미납부');

  const handleSortChange = (nextSortBy: FeeSortBy) => {
    if (sortBy === nextSortBy) {
      setSortDirection((currentDirection) =>
        currentDirection === 'asc' ? 'desc' : 'asc',
      );
    } else {
      setSortBy(nextSortBy);
      setSortDirection('asc');
    }
    setCurrentPage(1);
  };

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  return (
    <AuthGuard requirePermission={Permissions.MANAGE_FINANCE}>
      <div className="min-h-screen bg-slate-50/50 pb-20 text-slate-950">
        <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-8 md:px-8">
          
          {/* Compact Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-200 pb-5 gap-4 select-none">
            <div>
              <h1 className="text-2xl font-black tracking-tight text-slate-800">과비 관리</h1>
              <p className="mt-1 text-[13px] font-semibold leading-relaxed text-slate-400">
                학생별 과비 납부 상태를 한 화면에서 확인하고 바로 수정합니다.
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs font-bold">
              {isInitialLoading ? (
                <>
                  <Skeleton className="h-7 w-20 rounded-lg" />
                  <Skeleton className="h-7 w-28 rounded-lg" />
                  <Skeleton className="h-7 w-24 rounded-lg" />
                </>
              ) : (
                <>
                  <span className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-slate-700">전체 {totalCount}명</span>
                  <span className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-emerald-700">납부 완료 {paidCount}명</span>
                  <span className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-rose-700">미납부 {unpaidCount}명</span>
                </>
              )}
            </div>
          </div>

          {/* Filters and Controls */}
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_8px_30px_rgba(0,0,0,0.015)]">
            <div className="flex items-center gap-2">
              <span className="mr-2 text-xs font-black text-slate-400">필터:</span>
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

          {operationError && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
              {operationError}
            </div>
          )}

          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
              {error}
            </div>
          )}

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

          {loading ? (
            <TableSkeleton columns={6} rows={8} />
          ) : students.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse text-sm">
                <thead className="bg-slate-50/50 text-xs font-black text-slate-500">
                  <tr>
                    <th className="px-5 py-4 text-left">
                      <SortableHeader
                        active={sortBy === 'name'}
                        ascending={sortBy === 'name' && sortDirection === 'asc'}
                        label="이름"
                        onClick={() => handleSortChange('name')}
                      />
                    </th>
                    <th className="px-5 py-4 text-left">
                      <SortableHeader
                        active={sortBy === 'studentId'}
                        ascending={sortBy === 'studentId' && sortDirection === 'asc'}
                        label="학번"
                        onClick={() => handleSortChange('studentId')}
                      />
                    </th>
                    <th className="px-5 py-4 text-left">이메일</th>
                    <th className="px-5 py-4 text-left">
                      <SortableHeader
                        active={sortBy === 'status'}
                        ascending={sortBy === 'status' && sortDirection === 'asc'}
                        label="상태"
                        onClick={() => handleSortChange('status')}
                      />
                    </th>
                    <th className="px-5 py-4 text-left">
                      <SortableHeader
                        active={sortBy === 'paidAt'}
                        ascending={sortBy === 'paidAt' && sortDirection === 'asc'}
                        label="납부일"
                        onClick={() => handleSortChange('paidAt')}
                      />
                    </th>
                    <th className="px-5 py-4 text-left">비고</th>
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
                        {student.paidAt ? isoToDate(student.paidAt).toLocaleDateString('ko-KR') : '-'}
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
                          onBlur={(e) => handleNoteBlur(student.userId, e.target.value)}
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

          {!loading && totalCount > 0 && (
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

function SortableHeader({
  active,
  ascending,
  label,
  onClick,
}: {
  active: boolean;
  ascending: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 transition-colors ${
        active ? 'text-kaist-darkgreen' : 'text-slate-500 hover:text-slate-700'
      }`}
    >
      <span>{label}</span>
      <ArrowDown
        className={`h-3 w-3 transition-transform ${
          ascending ? 'rotate-180' : ''
        }`}
      />
    </button>
  );
}
