import { Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { AdminFeeListItem, FeeStatus, FeeUpdateReasonCode } from '@soc/contracts';
import { uiText } from '@/lib/i18n/surface-catalog';
import { FeeApiError, feeApi } from '@/lib/fee-api';

const statusLabel = {
  PAID: uiText('pages.admin-payments-page.3634e49cb4'),
  UNPAID: uiText('pages.admin-payments-page.7491b1070a'),
  UNKNOWN: uiText('pages.admin-payments-page.0ffe9c9281'),
} as const;

const statusTone: Record<FeeStatus, string> = {
  PAID: 'bg-[#E4F6EC] text-[#006B4A]',
  UNPAID: 'bg-[#FDECEC] text-[#B42318]',
  UNKNOWN: 'bg-[#F1F5F9] text-[#475569]',
};

const formatDate = (value: string) => new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));

const reasonOptions: readonly { value: FeeUpdateReasonCode; label: string }[] = [
  { value: 'PAYMENT_REVIEWED', label: uiText('pages.admin-payments-page.92d7f00cb4') },
  { value: 'PAYMENT_CONFIRMED', label: uiText('pages.admin-payments-page.d83a080cfb') },
  { value: 'PAYMENT_NOT_FOUND', label: uiText('pages.admin-payments-page.0223d08b5b') },
  { value: 'DATA_CORRECTION', label: uiText('pages.admin-payments-page.8899f29b0c') },
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
      void feeApi
        .listCurrent({ ...filters, limit: 25 }, controller.signal)
        .then((response) => {
          setItems(response.items);
          setNextCursor(response.nextCursor);
          setState('ready');
        })
        .catch((cause) => {
          if (cause instanceof DOMException && cause.name === 'AbortError') return;
          setError(cause instanceof FeeApiError ? cause.message : uiText('pages.admin-payments-page.2b37efc52b'));
          setState('error');
        });
    }, 250);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
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
      setError(cause instanceof FeeApiError ? cause.message : uiText('pages.admin-payments-page.f704de95b3'));
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
      setItems((current) => current.map((item) => item.id === editing.id ? { ...item, feeStatus: updated.feeStatus, updatedAt: updated.updatedAt } : item));
      setRowMessage((current) => ({ ...current, [editing.id]: { kind: 'success', text: uiText('pages.admin-payments-page.e7c239d92b') } }));
      setEditing(null);
    } catch (cause) {
      setRowMessage((current) => ({
        ...current,
        [editing.id]: { kind: 'error', text: cause instanceof FeeApiError ? cause.message : uiText('pages.admin-payments-page.eff8f77ca4') },
      }));
    } finally {
      setSaving(false);
    }
  };

  return (
    <section>
      <div className="admin-page-heading">
        <div>
          <p className="admin-eyebrow">Operation</p>
          <h1>{uiText('pages.admin-payments-page.2fdecd361e')}</h1>
          <p>{uiText('pages.admin-payments-page.b4fa011566')}</p>
        </div>
        <div className="admin-heading-stat">
          <span>{items.length}</span>
          <p>loaded records</p>
        </div>
      </div>

      {error ? <p role="alert">{error}</p> : null}

      <div className="admin-panel">
        <div className="admin-panel-header">
          <div>
            <p className="admin-eyebrow">Lookup</p>
            <h2>{uiText('pages.admin-payments-page.4dfef6ae4c')}</h2>
          </div>
        </div>
        <label className="w-full">
          <span className="sr-only">{uiText('pages.admin-payments-page.4dfef6ae4c')}</span>
          <span className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#98A0AC]" aria-hidden="true" />
            <input
              aria-label={uiText('pages.admin-payments-page.ca74916ec6')}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={uiText('pages.admin-payments-page.ebf00e062b')}
              className="pl-10"
            />
          </span>
        </label>
      </div>

      <div className="admin-panel">
        <div className="admin-panel-header">
          <div>
            <p className="admin-eyebrow">Records</p>
            <h2>{uiText('pages.admin-payments-page.2fdecd361e')}</h2>
          </div>
          {state === 'loading' ? <p role="status">{uiText('pages.admin-payments-page.de7b0272f9')}</p> : null}
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-[760px] text-left">
            <thead>
              <tr>
                <th className="p-3">{uiText('pages.admin-payments-page.9aa18e5071')}</th>
                <th className="p-3">{uiText('pages.admin-payments-page.180c0a2847')}</th>
                <th className="p-3">{uiText('pages.admin-payments-page.2926977ba7')}</th>
                <th className="p-3">{uiText('pages.admin-payments-page.38313ae9b9')}</th>
                <th className="p-3">{uiText('pages.admin-payments-page.9d9bf438ff')}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td className="p-3 font-extrabold">{item.nameKr ?? item.nameEn ?? '-'}</td>
                  <td className="p-3">{item.studentOrEmployeeNumber ?? '-'}</td>
                  <td className="p-3">
                    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-extrabold ${statusTone[item.feeStatus]}`}>{statusLabel[item.feeStatus]}</span>
                  </td>
                  <td className="p-3">{formatDate(item.updatedAt)}</td>
                  <td className="p-3">
                    <button type="button" onClick={() => startEdit(item)} disabled={saving && editing?.id === item.id}>
                      {uiText('pages.admin-payments-page.07aeb24882')}
                    </button>
                    {rowMessage[item.id] ? (
                      <p role={rowMessage[item.id].kind === 'error' ? 'alert' : 'status'} className="mt-2">
                        {rowMessage[item.id].text}
                      </p>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {state === 'ready' && items.length === 0 ? <p role="status" className="mt-4">{uiText('pages.admin-payments-page.491427def2')}</p> : null}
        {nextCursor ? (
          <button type="button" onClick={() => void loadMore()} className="mt-4">
            {uiText('pages.admin-payments-page.7422d2a47f')}
          </button>
        ) : null}
      </div>

      {editing ? (
        <div role="dialog" aria-modal="true" aria-labelledby="fee-dialog-title" className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
          <div className="w-full max-w-md">
            <h2 id="fee-dialog-title" className="text-xl font-extrabold">
              {editing.nameKr ?? editing.nameEn ?? uiText('pages.admin-payments-page.5c50d9e50b')}
              {uiText('pages.admin-payments-page.539c72a80b')}
            </h2>
            <label className="mt-4 block">
              {uiText('pages.admin-payments-page.8c52674ddd')}
              <select aria-label={uiText('pages.admin-payments-page.8c52674ddd')} value={nextStatus} onChange={(event) => setNextStatus(event.target.value as FeeStatus)}>
                <option value="UNKNOWN">{uiText('pages.admin-payments-page.0ffe9c9281')}</option>
                <option value="UNPAID">{uiText('pages.admin-payments-page.7491b1070a')}</option>
                <option value="PAID">{uiText('pages.admin-payments-page.3634e49cb4')}</option>
              </select>
            </label>
            <label className="mt-4 block">
              {uiText('pages.admin-payments-page.4ac852d6b9')}
              <select aria-label={uiText('pages.admin-payments-page.4ac852d6b9')} value={reason} onChange={(event) => setReason(event.target.value as FeeUpdateReasonCode)}>
                {reasonOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
            <label className="mt-4 block">
              {uiText('pages.admin-payments-page.62d1be2fde')}
              <textarea aria-label={uiText('pages.admin-payments-page.1206f191f5')} value={operatorNote} onChange={(event) => setOperatorNote(event.target.value)} maxLength={500} />
            </label>
            <p className="mt-3 text-sm">{uiText('pages.admin-payments-page.8660d0996b')}</p>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setEditing(null)} disabled={saving}>{uiText('pages.admin-payments-page.19b2d19bc1')}</button>
              <button type="button" onClick={() => void save()} disabled={saving} className="bg-kaist-darkgreen">
                {saving ? uiText('pages.admin-payments-page.5d68706086') : uiText('pages.admin-payments-page.8e2a0c41c2')}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
