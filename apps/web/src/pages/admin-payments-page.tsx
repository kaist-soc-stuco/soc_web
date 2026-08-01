import { useEffect, useState } from 'react';
import type { AdminFeeListItem, FeeStatus, FeeUpdateReasonCode } from '@soc/contracts';
import { feeApi, FeeApiError } from '@/lib/fee-api';

const statusLabel = { PAID: '납부', UNPAID: '미납', UNKNOWN: '확인 불가' } as const;
const formatDate = (value: string) => new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
const reasonOptions: readonly { value: FeeUpdateReasonCode; label: string }[] = [
  { value: 'PAYMENT_REVIEWED', label: '납부 내역 검토' },
  { value: 'PAYMENT_CONFIRMED', label: '납부 확인' },
  { value: 'PAYMENT_NOT_FOUND', label: '납부 내역 없음' },
  { value: 'DATA_CORRECTION', label: '데이터 정정' },
];

export function AdminPaymentsPage() {
  const [items, setItems] = useState<AdminFeeListItem[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<AdminFeeListItem | null>(null);
  const [nextStatus, setNextStatus] = useState<FeeStatus>('PAID');
  const [reason, setReason] = useState<FeeUpdateReasonCode>('PAYMENT_REVIEWED');
  const [operatorNote, setOperatorNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [rowMessage, setRowMessage] = useState<Record<string, { kind: 'success' | 'error'; text: string }>>({});

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setState('loading');
      const value = query.trim();
      const filters = /^\d+$/.test(value) ? { studentOrEmployeeNumber: value } : value ? { name: value } : {};
      void feeApi.listCurrent({ ...filters, limit: 25 }, controller.signal).then((response) => {
        setItems(response.items);
        setNextCursor(response.nextCursor);
        setState('ready');
      }).catch((cause) => {
        if (cause instanceof DOMException && cause.name === 'AbortError') return;
        setError(cause instanceof FeeApiError ? cause.message : '현재 과비 정보를 불러오지 못했습니다.');
        setState('error');
      });
    }, 250);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [query]);

  const loadMore = async () => {
    if (!nextCursor) return;
    setState('loading');
    try {
      const response = await feeApi.listCurrent({ cursor: nextCursor, limit: 25 });
      setItems((current) => [...current, ...response.items]);
      setNextCursor(response.nextCursor);
      setState('ready');
    } catch (cause) {
      setError(cause instanceof FeeApiError ? cause.message : '과비 정보를 더 불러오지 못했습니다.');
      setState('ready');
    }
  };

  const startEdit = (item: AdminFeeListItem) => {
    setEditing(item);
    setNextStatus(item.feeStatus);
    setReason('PAYMENT_REVIEWED');
    setOperatorNote('');
    setError('');
  };
  const save = async () => {
    if (!editing || !reason.trim()) return;
    setSaving(true);
    try {
      const updated = await feeApi.update(editing.id, nextStatus, reason, operatorNote.trim() || undefined);
      setItems((current) => current.map((item) => item.id === editing.id
        ? { ...item, feeStatus: updated.feeStatus, updatedAt: updated.updatedAt }
        : item));
      setRowMessage((current) => ({ ...current, [editing.id]: { kind: 'success', text: '과비 상태를 변경했습니다.' } }));
      setEditing(null);
    } catch (cause) {
      setRowMessage((current) => ({ ...current, [editing.id]: { kind: 'error', text: cause instanceof FeeApiError ? cause.message : '과비 상태를 변경하지 못했습니다.' } }));
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
          <input aria-label="과비 사용자 검색" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="이름 또는 학번/사번" className="mt-2 block w-full max-w-md rounded border px-3 py-2 font-normal" />
        </label>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-left text-sm">
            <thead><tr className="border-y"><th className="p-3">이름</th><th>학번/사번</th><th>상태</th><th>수정일</th><th>작업</th></tr></thead>
            <tbody>{items.map((item) => <tr key={item.id} className="border-b">
              <td className="p-3">{item.nameKr ?? item.nameEn ?? '-'}</td>
              <td>{item.studentOrEmployeeNumber ?? '-'}</td>
              <td>{statusLabel[item.feeStatus]}</td><td>{formatDate(item.updatedAt)}</td>
              <td><button type="button" onClick={() => startEdit(item)} disabled={saving && editing?.id === item.id} className="font-bold text-kaist-darkgreen">상태 변경</button>
                {rowMessage[item.id] && <p role={rowMessage[item.id].kind === 'error' ? 'alert' : 'status'} className={rowMessage[item.id].kind === 'error' ? 'text-red-600' : 'text-kaist-darkgreen'}>{rowMessage[item.id].text}</p>}
              </td>
            </tr>)}</tbody>
          </table>
        </div>
        {items.length === 0 && <p role="status" className="mt-4">일치하는 과비 정보가 없습니다.</p>}
        {nextCursor && <button type="button" onClick={() => void loadMore()} className="mt-4 rounded border px-4 py-2 font-bold">더 불러오기</button>}
        <a href="/admin/users" className="mt-6 inline-block text-sm font-bold text-kaist-darkgreen underline">사용자 상세 및 권한 관리로 이동</a>
      </>}
      {editing && <div role="dialog" aria-modal="true" aria-labelledby="fee-dialog-title" className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
        <div className="w-full max-w-md rounded bg-white p-6">
          <h2 id="fee-dialog-title" className="text-xl font-extrabold">{editing.nameKr ?? editing.nameEn ?? '사용자'} 과비 상태 변경</h2>
          <label className="mt-4 block text-sm font-bold">변경 상태<select aria-label="변경 상태" value={nextStatus} onChange={(event) => setNextStatus(event.target.value as FeeStatus)} className="mt-2 block w-full rounded border p-2"><option value="UNKNOWN">확인 불가</option><option value="UNPAID">미납</option><option value="PAID">납부</option></select></label>
          <label className="mt-4 block text-sm font-bold">변경 사유<select aria-label="변경 사유" value={reason} onChange={(event) => setReason(event.target.value as FeeUpdateReasonCode)} className="mt-2 block w-full rounded border p-2">{reasonOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
          <label className="mt-4 block text-sm font-bold">운영자 메모 (선택)<textarea aria-label="운영자 메모" value={operatorNote} onChange={(event) => setOperatorNote(event.target.value)} maxLength={500} className="mt-2 block w-full rounded border p-2 font-normal" /></label>
          <p className="mt-3 text-sm">저장하면 감사 로그에 사유가 기록됩니다.</p>
          <div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setEditing(null)} disabled={saving}>취소</button><button type="button" onClick={() => void save()} disabled={saving} className="rounded bg-kaist-darkgreen px-4 py-2 font-bold text-white">{saving ? '저장 중...' : '변경 확인'}</button></div>
        </div>
      </div>}
    </section>
  );
}
