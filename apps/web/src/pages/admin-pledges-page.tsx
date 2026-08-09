import { useEffect, useMemo, useState } from 'react';
import type { AdminPledge, CreatePledgeRequest, PatchPledgeRequest, PledgeStatus } from '@soc/contracts';

import { GovernanceApiError, pledgeApi } from '@/lib/governance-api';

const statusLabels: Record<PledgeStatus, string> = {
  PLANNED: '예정',
  IN_PROGRESS: '진행 중',
  DONE: '완료',
  BLOCKED: '보류',
};

type PledgeForm = {
  ordinal: string;
  titleKr: string;
  titleEn: string;
  descriptionKr: string;
  descriptionEn: string;
  status: PledgeStatus;
  progressPercent: string;
  progressKr: string;
  progressEn: string;
  targetDate: string;
  isPublished: boolean;
};

const emptyForm = (ordinal: number): PledgeForm => ({
  ordinal: String(ordinal),
  titleKr: '',
  titleEn: '',
  descriptionKr: '',
  descriptionEn: '',
  status: 'PLANNED',
  progressPercent: '0',
  progressKr: '',
  progressEn: '',
  targetDate: '',
  isPublished: true,
});

const apiErrorMessage = (cause: unknown, fallback: string) => {
  if (!(cause instanceof GovernanceApiError)) return fallback;
  if (cause.code === 'insufficient_permission') return '공약 관리 권한이 없습니다.';
  if (cause.code === 'pledge_not_found') return '공약을 찾을 수 없습니다. 목록을 새로고침해 주세요.';
  return cause.code ?? fallback;
};

export function AdminPledgesPage() {
  const [items, setItems] = useState<AdminPledge[]>([]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [progressDrafts, setProgressDrafts] = useState<Record<string, number>>({});
  const [form, setForm] = useState<PledgeForm>(() => emptyForm(0));
  const updateForm = <K extends keyof PledgeForm>(key: K, value: PledgeForm[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const nextOrdinal = useMemo(() => items.reduce((max, item) => Math.max(max, item.ordinal), -1) + 1, [items]);

  useEffect(() => {
    void pledgeApi.adminList()
      .then((response) => {
        setItems(response.items);
        setForm((current) => current.titleKr || current.titleEn ? current : emptyForm(response.items.reduce((max, item) => Math.max(max, item.ordinal), -1) + 1));
      })
      .catch((cause: unknown) => setError(apiErrorMessage(cause, '공약 목록을 불러오지 못했습니다.')));
  }, []);

  const updateItem = (id: string, update: (item: AdminPledge) => AdminPledge) => {
    setItems((current) => current.map((item) => item.id === id ? update(item) : item));
  };

  const patch = async (item: AdminPledge, input: PatchPledgeRequest) => {
    setSaving(item.id);
    setError('');
    try {
      const updated = await pledgeApi.patch(item.id, input);
      setItems((current) => current.map((row) => row.id === updated.id ? updated : row));
      if ('progressPercent' in input) {
        setProgressDrafts((current) => {
          const next = { ...current };
          delete next[item.id];
          return next;
        });
      }
    } catch (cause: unknown) {
      setError(apiErrorMessage(cause, '공약 저장에 실패했습니다.'));
    } finally {
      setSaving(null);
    }
  };

  const commitProgress = (item: AdminPledge, value: string) => {
    const progressPercent = Number(value);
    if (Number.isInteger(progressPercent) && progressPercent !== item.progressPercent) void patch(item, { progressPercent });
  };

  const create = async () => {
    const ordinal = Number(form.ordinal);
    const progressPercent = Number(form.progressPercent);
    if (!Number.isSafeInteger(ordinal) || ordinal < 0 || !form.titleKr.trim() || !form.titleEn.trim() || !form.descriptionKr.trim() || !form.descriptionEn.trim() || !form.progressKr.trim() || !form.progressEn.trim()) {
      setError('순서, 한·영 제목/설명, 한·영 이행 상황을 모두 입력하세요.');
      return;
    }
    if (!Number.isSafeInteger(progressPercent) || progressPercent < 0 || progressPercent > 100) {
      setError('진척도는 0에서 100 사이의 정수여야 합니다.');
      return;
    }
    setCreating(true);
    setError('');
    const input: CreatePledgeRequest = {
      ordinal,
      titleKr: form.titleKr.trim(),
      titleEn: form.titleEn.trim(),
      descriptionKr: form.descriptionKr.trim(),
      descriptionEn: form.descriptionEn.trim(),
      status: form.status,
      progressPercent,
      progressKr: form.progressKr.trim(),
      progressEn: form.progressEn.trim(),
      targetDate: form.targetDate || null,
      isPublished: form.isPublished,
    };
    try {
      const created = await pledgeApi.create(input);
      setItems((current) => [...current, created].sort((left, right) => left.ordinal - right.ordinal));
      setForm(emptyForm(Math.max(nextOrdinal + 1, ordinal + 1)));
    } catch (cause: unknown) {
      setError(apiErrorMessage(cause, '공약 생성에 실패했습니다.'));
    } finally {
      setCreating(false);
    }
  };

  const remove = async (item: AdminPledge) => {
    if (!window.confirm(`'${item.titleKr}' 공약을 삭제할까요?`)) return;
    setSaving(item.id);
    setError('');
    try {
      await pledgeApi.remove(item.id);
      setItems((current) => current.filter((row) => row.id !== item.id));
      setProgressDrafts((current) => {
        const next = { ...current };
        delete next[item.id];
        return next;
      });
    } catch (cause: unknown) {
      setError(apiErrorMessage(cause, '공약 삭제에 실패했습니다.'));
    } finally {
      setSaving(null);
    }
  };

  const itemTextField = (item: AdminPledge, key: 'titleKr' | 'titleEn' | 'descriptionKr' | 'descriptionEn' | 'progressKr' | 'progressEn', label: string, multiline = false) => {
    const value = item[key];
    return <label className="block text-sm font-bold">
      {label}
      {multiline ? <textarea aria-label={item.titleKr + ' ' + label} value={value} disabled={saving === item.id} onChange={(event) => { const next = event.currentTarget.value; updateItem(item.id, (current) => ({ ...current, [key]: next })); }} onBlur={(event) => void patch(item, { [key]: event.currentTarget.value } as PatchPledgeRequest)} className="mt-2 min-h-20 w-full rounded border p-3 font-normal"/> : <input aria-label={item.titleKr + ' ' + label} value={value} disabled={saving === item.id} onChange={(event) => { const next = event.currentTarget.value; updateItem(item.id, (current) => ({ ...current, [key]: next })); }} onBlur={(event) => void patch(item, { [key]: event.currentTarget.value } as PatchPledgeRequest)} className="mt-2 min-h-11 w-full rounded border px-3 py-2 font-normal"/>}
    </label>;
  };

  return <section>
    <div className="mb-6 border-b border-kaist-grey/25 pb-4">
      <h1 className="text-3xl font-extrabold">공약 이행 현황 관리</h1>
      <p className="mt-2 text-sm text-kaist-grey">회장단 권한 보유자는 공약을 추가·수정·삭제하고 공개 여부를 관리할 수 있습니다.</p>
    </div>
    {error && <p role="alert" className="mb-4 text-red-700">{error}</p>}

    <div className="rounded border bg-white p-5">
      <h2 className="text-xl font-extrabold">공약 추가</h2>
      <p className="mt-1 text-sm text-kaist-grey">공개할 공약은 한글·영문 내용을 모두 입력하세요.</p>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <label className="text-sm font-bold">순서<input aria-label="새 공약 순서" type="number" min="0" step="1" value={form.ordinal} onChange={(event) => updateForm('ordinal', event.currentTarget.value)} className="mt-1 block min-h-11 w-full rounded border px-3 py-2 font-normal"/></label>
        <label className="text-sm font-bold">상태<select aria-label="새 공약 상태" value={form.status} onChange={(event) => updateForm('status', event.currentTarget.value as PledgeStatus)} className="mt-1 block min-h-11 w-full rounded border px-3 py-2 font-normal">{(Object.keys(statusLabels) as PledgeStatus[]).map((status) => <option key={status} value={status}>{statusLabels[status]}</option>)}</select></label>
        <label className="text-sm font-bold">제목 (한국어)<input aria-label="새 공약 제목 (한국어)" value={form.titleKr} onChange={(event) => updateForm('titleKr', event.currentTarget.value)} className="mt-1 block min-h-11 w-full rounded border px-3 py-2 font-normal"/></label>
        <label className="text-sm font-bold">제목 (English)<input aria-label="새 공약 제목 (English)" value={form.titleEn} onChange={(event) => updateForm('titleEn', event.currentTarget.value)} className="mt-1 block min-h-11 w-full rounded border px-3 py-2 font-normal"/></label>
        <label className="text-sm font-bold">설명 (한국어)<textarea aria-label="새 공약 설명 (한국어)" value={form.descriptionKr} onChange={(event) => updateForm('descriptionKr', event.currentTarget.value)} className="mt-1 block min-h-20 w-full rounded border p-3 font-normal"/></label>
        <label className="text-sm font-bold">설명 (English)<textarea aria-label="새 공약 설명 (English)" value={form.descriptionEn} onChange={(event) => updateForm('descriptionEn', event.currentTarget.value)} className="mt-1 block min-h-20 w-full rounded border p-3 font-normal"/></label>
        <label className="text-sm font-bold">진척도 (%)<input aria-label="새 공약 진척도" type="number" min="0" max="100" step="1" value={form.progressPercent} onChange={(event) => updateForm('progressPercent', event.currentTarget.value)} className="mt-1 block min-h-11 w-full rounded border px-3 py-2 font-normal"/></label>
        <label className="text-sm font-bold">목표일<input aria-label="새 공약 목표일" type="date" value={form.targetDate} onChange={(event) => updateForm('targetDate', event.currentTarget.value)} className="mt-1 block min-h-11 w-full rounded border px-3 py-2 font-normal"/></label>
        <label className="text-sm font-bold">이행 상황 (한국어)<textarea aria-label="새 공약 이행 상황 (한국어)" value={form.progressKr} onChange={(event) => updateForm('progressKr', event.currentTarget.value)} className="mt-1 min-h-20 w-full rounded border p-3 font-normal"/></label>
        <label className="text-sm font-bold">이행 상황 (English)<textarea aria-label="새 공약 이행 상황 (English)" value={form.progressEn} onChange={(event) => updateForm('progressEn', event.currentTarget.value)} className="mt-1 min-h-20 w-full rounded border p-3 font-normal"/></label>
      </div>
      <label className="mt-3 inline-flex min-h-11 items-center gap-2 text-sm font-bold"><input aria-label="새 공약 공개" type="checkbox" checked={form.isPublished} onChange={(event) => updateForm('isPublished', event.currentTarget.checked)}/> 공개</label>
      <button type="button" onClick={() => void create()} disabled={creating} className="mt-4 min-h-11 rounded bg-kaist-darkgreen px-5 py-2 font-bold text-white disabled:opacity-50">{creating ? '생성 중…' : '공약 추가'}</button>
    </div>

    <div className="mt-8 space-y-4">
      {items.length === 0 && <p className="rounded border bg-white p-5 text-sm text-kaist-grey">등록된 공약이 없습니다.</p>}
      {items.map((item) => {
        const busy = saving === item.id;
        return <article key={item.id} aria-busy={busy} className="rounded border bg-white p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-extrabold">{item.ordinal + 1}. {item.titleKr}</h2>
            <div className="flex flex-wrap items-center gap-2">
              <label className="text-sm font-bold">상태<select aria-label={item.titleKr + ' 상태'} value={item.status} disabled={busy} onChange={(event) => void patch(item, { status: event.currentTarget.value as PledgeStatus })} className="ml-2 min-h-11 rounded border px-2 py-1">{(Object.keys(statusLabels) as PledgeStatus[]).map((status) => <option key={status} value={status}>{statusLabels[status]}</option>)}</select></label>
              <button type="button" onClick={() => void remove(item)} disabled={busy} className="min-h-11 rounded border border-red-300 px-3 py-2 text-sm font-bold text-red-700">삭제</button>
            </div>
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {itemTextField(item, 'titleKr', '제목 (한국어)')}
            {itemTextField(item, 'titleEn', '제목 (English)')}
            {itemTextField(item, 'descriptionKr', '설명 (한국어)', true)}
            {itemTextField(item, 'descriptionEn', '설명 (English)', true)}
          </div>
          <label className="mt-4 block text-sm font-bold">진척도 {progressDrafts[item.id] ?? item.progressPercent}%
            <input aria-label={item.titleKr + ' 진척도'} type="range" min="0" max="100" value={progressDrafts[item.id] ?? item.progressPercent} disabled={busy} onChange={(event) => { const progressPercent = Number(event.currentTarget.value); if (Number.isInteger(progressPercent)) setProgressDrafts((current) => ({ ...current, [item.id]: progressPercent })); }} onPointerUp={(event) => commitProgress(item, event.currentTarget.value)} onKeyUp={(event) => { if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) commitProgress(item, event.currentTarget.value); }} className="mt-2 w-full"/>
          </label>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {itemTextField(item, 'progressKr', '이행 상황 (한국어)', true)}
            {itemTextField(item, 'progressEn', '이행 상황 (English)', true)}
            <label className="text-sm font-bold">목표일<input aria-label={item.titleKr + ' 목표일'} type="date" value={item.targetDate ?? ''} disabled={busy} onChange={(event) => { const targetDate = event.currentTarget.value || null; updateItem(item.id, (current) => ({ ...current, targetDate })); }} onBlur={(event) => void patch(item, { targetDate: event.currentTarget.value || null })} className="mt-2 block min-h-11 w-full rounded border px-3 py-2 font-normal"/></label>
          </div>
          <label className="mt-3 inline-flex min-h-11 items-center gap-2 text-sm font-bold"><input aria-label={item.titleKr + ' 공개'} type="checkbox" checked={item.isPublished} disabled={busy} onChange={(event) => void patch(item, { isPublished: event.currentTarget.checked })}/> 공개</label>
          {busy && <span role="status" className="ml-3 text-xs text-kaist-grey">저장 중…</span>}
          <p className="mt-2 text-xs text-kaist-grey">텍스트·목표일은 입력 후 포커스를 옮기면 저장됩니다.</p>
        </article>;
      })}
    </div>
  </section>;
}
