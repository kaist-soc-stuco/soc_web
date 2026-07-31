import { useEffect, useMemo, useState } from 'react';
import type { AdminFeeListItem, FeeStatus } from '@soc/contracts';
import { feeApi, FeeApiError } from '@/lib/fee-api';

const statusLabel = { PAID: '납부', UNPAID: '미납', UNKNOWN: '확인 불가' } as const;
const formatDate = (value: string) => new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));

export function AdminPaymentsPage() {
  const [items, setItems] = useState<AdminFeeListItem[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<AdminFeeListItem | null>(null);
  const [nextStatus, setNextStatus] = useState<FeeStatus>('PAID');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    void feeApi.listCurrent(controller.signal).then((response) => {
      setItems(response.items);
      setState('ready');
    }).catch((cause) => {
      if (cause instanceof DOMException && cause.name === 'AbortError') return;
      setError(cause instanceof FeeApiError ? cause.message : '현재 과비 정보를 불러오지 못했습니다.');
      setState('error');
    });
    return () => controller.abort();
  }, []);

  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase('ko-KR');
    if (!needle) return items;
    return items.filter((item) => [item.nameKr, item.nameEn, item.kaistUid, item.studentOrEmployeeNumber]
      .some((value) => value?.toLocaleLowerCase('ko-KR').includes(needle)));
  }, [items, query]);

  const startEdit = (item: AdminFeeListItem) => {
    setEditing(item);
    setNextStatus(item.feeStatus);
    setReason('');
    setError('');
  };
  const save = async () => {
    if (!editing || !reason.trim()) return;
    setSaving(true);
    try {
      const updated = await feeApi.update(editing.id, nextStatus, reason.trim());
      setItems((current) => current.map((item) => item.id === editing.id
        ? { ...item, feeStatus: updated.feeStatus, updatedAt: updated.updatedAt }
        : item));
      setEditing(null);
    } catch (cause) {
      setError(cause instanceof FeeApiError ? cause.message : '과비 상태를 변경하지 못했습니다.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section>
      <div className="mb-6 border-b border-kaist-grey/25 pb-4">
        <h1 className="text-[32px] font-extrabold tracking-tight text-kaist-black">과비 납부 관리</h1>
        <p className="mt-2 text-sm text-kaist-grey">사용자를 찾은 뒤 변경 사유를 기록하고 상태를 확인해 주세요.</p>
      </div>
      {state === 'loading' && <p role="status">현재 과비 정보를 불러오는 중...</p>}
      {error && <p role="alert" className="mb-4 text-red-600">{error}</p>}
      {state === 'ready' && <>
        <label className="mb-4 block text-sm font-bold">사용자 검색
          <input aria-label="과비 사용자 검색" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="이름, 학번 또는 KAIST UID" className="mt-2 block w-full max-w-md rounded border px-3 py-2 font-normal" />
        </label>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-left text-sm">
            <thead><tr className="border-y"><th className="p-3">이름</th><th>학번/KAIST UID</th><th>상태</th><th>수정일</th><th>작업</th></tr></thead>
            <tbody>{filtered.map((item) => <tr key={item.id} className="border-b">
              <td className="p-3">{item.nameKr ?? item.nameEn ?? '-'}</td>
              <td>{item.studentOrEmployeeNumber ?? item.kaistUid ?? '-'}</td>
              <td>{statusLabel[item.feeStatus]}</td><td>{formatDate(item.updatedAt)}</td>
              <td><button type="button" onClick={() => startEdit(item)} className="font-bold text-kaist-darkgreen">상태 변경</button></td>
            </tr>)}</tbody>
          </table>
        </div>
        {filtered.length === 0 && <p role="status" className="mt-4">일치하는 과비 정보가 없습니다.</p>}
        <a href="/admin/users" className="mt-6 inline-block text-sm font-bold text-kaist-darkgreen underline">사용자 상세 및 권한 관리로 이동</a>
      </>}
      {editing && <div role="dialog" aria-modal="true" aria-labelledby="fee-dialog-title" className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
        <div className="w-full max-w-md rounded bg-white p-6">
          <h2 id="fee-dialog-title" className="text-xl font-extrabold">{editing.nameKr ?? editing.nameEn ?? '사용자'} 과비 상태 변경</h2>
          <label className="mt-4 block text-sm font-bold">변경 상태<select aria-label="변경 상태" value={nextStatus} onChange={(event) => setNextStatus(event.target.value as FeeStatus)} className="mt-2 block w-full rounded border p-2"><option value="UNKNOWN">확인 불가</option><option value="UNPAID">미납</option><option value="PAID">납부</option></select></label>
          <label className="mt-4 block text-sm font-bold">변경 사유<input aria-label="변경 사유" value={reason} onChange={(event) => setReason(event.target.value)} maxLength={64} className="mt-2 block w-full rounded border p-2 font-normal" /></label>
          <p className="mt-3 text-sm">저장하면 감사 로그에 사유가 기록됩니다.</p>
          <div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setEditing(null)} disabled={saving}>취소</button><button type="button" onClick={() => void save()} disabled={saving || !reason.trim()} className="rounded bg-kaist-darkgreen px-4 py-2 font-bold text-white">변경 확인</button></div>
        </div>
      </div>}
    </section>
  );
}
