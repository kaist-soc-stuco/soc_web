import { useEffect, useState } from 'react';
import { AdminList } from '@/components/organisms/admin-list';
import { feeApi, FeeApiError } from '@/lib/fee-api';

const statusLabel = { PAID: '납부', UNPAID: '미납', UNKNOWN: '확인 불가' } as const;
const formatDate = (value: string) => new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
type FeeRow = { id: string; name: string; identifier: string; status: string; updatedAt: string };

export function AdminPaymentsPage() {
  const [rows, setRows] = useState<FeeRow[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    void feeApi.listCurrent(controller.signal).then((response) => {
      setRows(response.items.map((item) => ({
        id: item.id,
        name: item.nameKr ?? item.nameEn ?? '-',
        identifier: item.studentOrEmployeeNumber ?? item.kaistUid ?? '-',
        status: statusLabel[item.feeStatus],
        updatedAt: formatDate(item.updatedAt),
      })));
      setState('ready');
    }).catch((cause) => {
      if (cause instanceof DOMException && cause.name === 'AbortError') return;
      setError(cause instanceof FeeApiError ? cause.message : '현재 회비 정보를 불러오지 못했습니다.');
      setState('error');
    });
    return () => controller.abort();
  }, []);
  return (
    <section>
      <div className="mb-6 border-b border-kaist-grey/25 pb-4">
        <h1 className="text-[32px] font-extrabold tracking-tight text-kaist-black">과비 납부 관리</h1>
      </div>
      {state === 'loading' ? <p role="status">현재 회비 정보를 불러오는 중...</p> : null}
      {state === 'error' ? <p role="alert" className="text-red-600">{error}</p> : null}
      {state === 'ready' ? <AdminList title="현재 회비 상태" description="현재 회비 납부 상태입니다." columns={[{ key: 'name', label: '이름' }, { key: 'identifier', label: '학번/KAIST ID' }, { key: 'status', label: '현재 회비 상태' }, { key: 'updatedAt', label: '수정일' }]} rows={rows} compact /> : null}
      {state === 'ready' && rows.length === 0 ? <p role="status" className="mt-4 text-sm font-semibold text-kaist-grey">현재 회비 정보가 없습니다.</p> : null}
    </section>
  );
}
