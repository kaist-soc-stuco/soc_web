import { useEffect, useState } from 'react';
import type { AdminVote, CreateVoteRequest } from '@soc/contracts';

import { GovernanceApiError, voteApi } from '@/lib/governance-api';

const localDateTime = (date: Date) => {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
};
const toIso = (value: string) => new Date(value).toISOString();
const stateLabel: Record<AdminVote['state'], string> = {
  DRAFT: '초안',
  SCHEDULED: '예약됨',
  OPEN: '진행 중',
  CLOSED: '마감',
  DISCARDED: '무효',
  RESULTS_PUBLISHED: '결과 공개',
  RESULTS_RETIRED: '결과 비공개',
};
const fieldLabel = {
  titleKr: '제목 (한국어)',
  titleEn: '제목 (English)',
  descriptionKr: '설명 (한국어)',
  descriptionEn: '설명 (English)',
  candidate1: '후보 1',
  candidate2: '후보 2',
} as const;

const readFileText = async (file: File) => {
  if (typeof file.text === 'function') return file.text();
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener('load', () => resolve(String(reader.result ?? '')));
    reader.addEventListener('error', () => reject(reader.error ?? new Error('Failed to read file')));
    reader.readAsText(file);
  });
};

const transitionErrorMessage = (cause: unknown, action: 'open' | 'close' | 'publish') => {
  if (!(cause instanceof GovernanceApiError)) return '상태 변경에 실패했습니다.';
  if (cause.code === 'vote_invalid_state' && action === 'open') return '개설하려면 후보자 2명 이상과 선거인명부를 먼저 등록해야 합니다.';
  if (cause.code === 'vote_invalid_turnout') return '유효 투표율 조건을 충족하지 않아 개표 결과를 공개할 수 없습니다.';
  return cause.code ?? '상태 변경에 실패했습니다.';
};

export function AdminVotesPage() {
  const [items, setItems] = useState<AdminVote[]>([]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    titleKr: '',
    titleEn: '',
    descriptionKr: '',
    descriptionEn: '',
    opensAt: localDateTime(new Date(Date.now() + 60 * 60 * 1000)),
    closesAt: localDateTime(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)),
    validTurnoutPercent: '50',
    candidate1: '',
    candidate2: '',
  });
  const updateForm = (key: keyof typeof form, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const refresh = async () => {
    try {
      setItems((await voteApi.adminList()).items);
    } catch {
      setError('투표 목록을 불러오지 못했습니다.');
    }
  };
  useEffect(() => { void refresh(); }, []);

  const create = async () => {
    if (!form.titleKr.trim() || !form.titleEn.trim() || !form.candidate1.trim() || !form.candidate2.trim()) {
      setError('한국어·영어 제목과 두 후보명을 입력하세요.');
      return;
    }
    const turnout = Number(form.validTurnoutPercent);
    if (!form.opensAt || !form.closesAt || Number.isNaN(new Date(form.opensAt).getTime()) || Number.isNaN(new Date(form.closesAt).getTime()) || new Date(form.closesAt) <= new Date(form.opensAt) || !Number.isInteger(turnout) || turnout < 1 || turnout > 100) {
      setError('투표 기간과 유효 투표율을 확인하세요.');
      return;
    }
    setSaving(true);
    setError('');
    const input: CreateVoteRequest = {
      titleKr: form.titleKr.trim(),
      titleEn: form.titleEn.trim(),
      descriptionKr: form.descriptionKr.trim() || form.titleKr.trim(),
      descriptionEn: form.descriptionEn.trim() || form.titleEn.trim(),
      opensAt: toIso(form.opensAt),
      closesAt: toIso(form.closesAt),
      anonymous: true,
      validTurnoutPercent: turnout,
      candidates: [
        { nameKr: form.candidate1.trim(), nameEn: form.candidate1.trim() },
        { nameKr: form.candidate2.trim(), nameEn: form.candidate2.trim() },
      ],
    };
    try {
      const created = await voteApi.create(input);
      setItems((current) => [created, ...current]);
      setForm((current) => ({ ...current, titleKr: '', titleEn: '', descriptionKr: '', descriptionEn: '', candidate1: '', candidate2: '' }));
    } catch (cause: unknown) {
      setError(cause instanceof GovernanceApiError ? cause.code ?? '생성에 실패했습니다.' : '생성에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const transition = async (item: AdminVote, action: 'open' | 'close' | 'publish') => {
    setError('');
    try {
      const updated = await voteApi.transition(item.id, action);
      setItems((current) => current.map((row) => row.id === updated.id ? updated : row));
    } catch (cause: unknown) {
      setError(transitionErrorMessage(cause, action));
    }
  };

  const importCsv = async (item: AdminVote, file: File) => {
    const rows = (await readFileText(file)).split(/\r?\n/).filter(Boolean).map((line) => file.name.toLowerCase().endsWith('.tsv') ? line.split('\t') : line.split(','));
    const parsed = [];
    for (const row of rows) {
      const kind = row[0]?.trim().toUpperCase();
      const value = row.slice(1).join(',').trim();
        if (kind === 'KIND') continue;
      if ((kind !== 'SSO_SUBJECT' && kind !== 'STUDENT_NUMBER') || !value) {
        setError('선거인명부 형식이 올바르지 않습니다.');
        return;
      }
      parsed.push({ identityKind: kind, value } as { identityKind: 'SSO_SUBJECT' | 'STUDENT_NUMBER'; value: string });
    }
    if (parsed.length === 0) {
      setError('선거인명부에 유효한 항목이 없습니다.');
      return;
    }
    try {
      const updated = await voteApi.importVoterRoll(item.id, { entries: parsed });
      setItems((current) => current.map((row) => row.id === updated.id ? updated : row));
    } catch {
      setError('선거인명부를 가져오지 못했습니다.');
    }
  };

  return <section>
    <div className="mb-6 border-b border-kaist-grey/25 pb-4">
      <h1 className="text-3xl font-extrabold">투표 관리</h1>
      <p className="mt-2 text-sm text-kaist-grey">개설·선거인명부 교체·마감·개표 결과 공개를 관리합니다.</p>
    </div>
    {error && <p role="alert" className="mb-4 text-red-700">{error}</p>}
    <div className="rounded border bg-white p-5">
      <h2 className="text-xl font-extrabold">새 투표 개설</h2>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {(['titleKr', 'titleEn', 'descriptionKr', 'descriptionEn', 'candidate1', 'candidate2'] as const).map((key) => (
          <label key={key} className="text-sm font-bold">{fieldLabel[key]}
            <input aria-label={fieldLabel[key]} required={key === 'titleKr' || key === 'titleEn' || key === 'candidate1' || key === 'candidate2'} value={form[key]} onChange={(event) => updateForm(key, event.currentTarget.value)} className="mt-1 block min-h-11 w-full rounded border px-3 py-2 font-normal"/>
          </label>
        ))}
        <label className="text-sm font-bold">시작<input aria-label="투표 시작" type="datetime-local" value={form.opensAt} onChange={(event) => updateForm('opensAt', event.currentTarget.value)} className="mt-1 block min-h-11 w-full rounded border px-3 py-2 font-normal"/></label>
        <label className="text-sm font-bold">종료<input aria-label="투표 종료" type="datetime-local" value={form.closesAt} onChange={(event) => updateForm('closesAt', event.currentTarget.value)} className="mt-1 block min-h-11 w-full rounded border px-3 py-2 font-normal"/></label>
        <label className="text-sm font-bold">유효 투표율(%)<input aria-label="유효 투표율(%)" type="number" min="1" max="100" value={form.validTurnoutPercent} onChange={(event) => updateForm('validTurnoutPercent', event.currentTarget.value)} className="mt-1 block min-h-11 w-full rounded border px-3 py-2 font-normal"/></label>
      </div>
      <button type="button" onClick={() => void create()} disabled={saving} className="mt-5 min-h-11 rounded bg-kaist-darkgreen px-5 py-2 font-bold text-white disabled:opacity-50">{saving ? '저장 중…' : '초안 저장'}</button>
    </div>
    <div className="mt-8 space-y-4">
      {items.map((item) => <article key={item.id} className="rounded border bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><h2 className="text-xl font-extrabold">{item.titleKr}</h2><p className="mt-1 text-sm text-kaist-grey">{stateLabel[item.state]} · 선거인 {item.eligibleVoterCount}명 · 투표율 {item.turnoutPercent}%</p></div>
          <div className="flex flex-wrap gap-2">
            {(item.state === 'DRAFT' || item.state === 'SCHEDULED') && <button type="button" onClick={() => void transition(item, 'open')} disabled={item.candidates.length < 2 || item.eligibleVoterCount < 1} title={item.candidates.length < 2 || item.eligibleVoterCount < 1 ? '후보자 2명 이상과 선거인명부를 먼저 등록하세요.' : undefined} className="min-h-11 rounded border px-3 py-2 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-50">개설</button>}
            {(item.state === 'OPEN' || item.state === 'SCHEDULED') && <button type="button" onClick={() => void transition(item, 'close')} className="min-h-11 rounded border px-3 py-2 text-sm font-bold">마감</button>}
            {item.state === 'CLOSED' && <button type="button" onClick={() => void transition(item, 'publish')} className="min-h-11 rounded bg-kaist-darkgreen px-3 py-2 text-sm font-bold text-white">개표·공개</button>}
          </div>
        </div>
        {(item.state === 'DRAFT' || item.state === 'SCHEDULED') && (item.candidates.length < 2 || item.eligibleVoterCount < 1) && <p role="status" className="mt-3 text-sm text-amber-700">개설하려면 후보자 2명 이상과 선거인명부를 먼저 등록하세요. 현재 후보 {item.candidates.length}명 · 선거인 {item.eligibleVoterCount}명</p>}
        <label className="mt-4 inline-flex min-h-11 items-center gap-2 text-sm font-bold">선거인명부 CSV/TSV
          <input aria-label={item.titleKr + ' 선거인명부 CSV/TSV'} type="file" accept=".csv,.tsv,.txt" onChange={(event) => { const file = event.currentTarget.files?.[0]; if (file) void importCsv(item, file); event.currentTarget.value = ''; }}/>
        </label>
        <p className="mt-2 text-xs text-kaist-grey">형식: identityKind,value (SSO_SUBJECT 또는 STUDENT_NUMBER). 서버에는 원문 대신 해시만 저장됩니다.</p>
        <ul className="mt-4 grid gap-2 md:grid-cols-2">{item.candidates.map((candidate) => <li key={candidate.id} className="rounded bg-kaist-grey/10 p-3 text-sm font-bold">{candidate.ordinal + 1}. {candidate.nameKr}</li>)}</ul>
      </article>)}
    </div>
  </section>;
}
