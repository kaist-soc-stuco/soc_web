import { useEffect, useRef, useState } from 'react';
import type { AdminUserGetResponse, AdminUserListItem } from '@soc/contracts';

import { hasGlobalGrant } from '@/lib/admin-access';
import { AdminIdentityApiError, AdminIdentityApiProtocolError, adminIdentityApi } from '@/lib/admin-identity-api';
import { useAdminGrants } from '@/lib/admin-grants';

type FilterKind = 'name' | 'studentOrEmployeeNumber';
type LoadState = 'idle' | 'loading' | 'ready' | 'denied' | 'error' | 'protocol';

const userName = (user: AdminUserListItem | AdminUserGetResponse) => user.nameKr ?? user.nameEn ?? '-';
const errorState = (error: unknown): Exclude<LoadState, 'idle' | 'loading' | 'ready'> => {
  if (error instanceof AdminIdentityApiProtocolError) return 'protocol';
  return error instanceof AdminIdentityApiError && (error.status === 401 || error.status === 403) ? 'denied' : 'error';
};

export function AdminUsersPage() {
  const grants = useAdminGrants();
  const [kind, setKind] = useState<FilterKind>('name');
  const [value, setValue] = useState('');
  const [items, setItems] = useState<AdminUserListItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [state, setState] = useState<LoadState>('idle');
  const [detail, setDetail] = useState<AdminUserGetResponse | null>(null);
  const [activeQuery, setActiveQuery] = useState<{ kind: FilterKind; value: string } | null>(null);
  const requestGeneration = useRef(0);
  const allowed = hasGlobalGrant(grants.grants, 'USERS_MANAGE');

  const search = async (cursor?: string, initial = false) => {
    const trimmed = value.trim();
    const query = cursor ? activeQuery : initial || !trimmed ? null : { kind, value: trimmed };
    const generation = ++requestGeneration.current;
    if (!cursor) {
      setActiveQuery(query);
      setItems([]);
      setNextCursor(null);
      setDetail(null);
    }
    setState('loading');
    try {
      const page = await adminIdentityApi.listUsers({
        ...(query ? { [query.kind]: query.value } : {}),
        cursor,
        limit: 25,
      });
      if (generation !== requestGeneration.current) return;
      setItems((current) => cursor ? [...current, ...page.items] : page.items);
      setNextCursor(page.nextCursor);
      setState('ready');
    } catch (error) {
      if (generation === requestGeneration.current) setState(errorState(error));
    }
  };
  const select = async (id: string) => {
    try { setDetail(await adminIdentityApi.getUser(id)); }
    catch (error) { setState(errorState(error)); }
  };

  useEffect(() => {
    if (!allowed) {
      requestGeneration.current += 1;
      setItems([]);
      setDetail(null);
      setState('denied');
      return;
    }
    void search(undefined, true);
  }, [allowed]);
  const resetSearch = () => {
    requestGeneration.current += 1;
    setActiveQuery(null);
    setItems([]);
    setNextCursor(null);
    setDetail(null);
    setState('idle');
  };
  if (grants.status === 'loading' || grants.status === 'idle') return <section><h1 className="text-[32px] font-extrabold text-kaist-black">사용자 관리</h1><p className="mt-5 text-sm font-semibold">권한을 확인하는 중입니다.</p></section>;
  if (!allowed) return <section><h1 className="text-[32px] font-extrabold text-kaist-black">사용자 관리</h1><p role="alert" className="mt-5 text-sm font-semibold text-red-700">사용자 관리 권한이 없습니다.</p></section>;

  return <section>
    <div className="mb-6 border-b border-kaist-grey/25 pb-4"><h1 className="text-[32px] font-extrabold tracking-tight text-kaist-black">사용자 관리</h1></div>
    <form className="mb-5 flex flex-wrap gap-2" onSubmit={(event) => { event.preventDefault(); void search(); }}>
      <select aria-label="검색 기준" value={kind} onChange={(event) => { setKind(event.target.value as FilterKind); resetSearch(); }} className="rounded-[5px] border border-kaist-grey/25 bg-white px-3 py-2 text-sm"><option value="name">이름</option><option value="studentOrEmployeeNumber">학번·사번</option></select>
      <input aria-label="정확한 사용자 검색" value={value} onChange={(event) => { setValue(event.target.value); resetSearch(); }} className="min-w-64 rounded-[5px] border border-kaist-grey/25 px-3 py-2 text-sm" placeholder="정확히 입력" />
      <button type="submit" className="rounded-[5px] bg-kaist-darkgreen px-5 py-2 text-xs font-extrabold text-white">조회</button>
    </form>
    {state === 'idle' && <p className="py-6 text-sm font-semibold text-[#39404B]">이름 또는 학번·사번을 정확히 입력해 주세요.</p>}
    {state === 'loading' && <p className="py-6 text-sm font-semibold text-[#39404B]">사용자 정보를 불러오는 중입니다.</p>}
    {state === 'denied' && <p role="alert" className="py-6 text-sm font-semibold text-red-700">사용자 관리 권한이 없습니다.</p>}
    {state === 'protocol' && <p role="alert" className="py-6 text-sm font-semibold text-red-700">응답 형식을 확인할 수 없습니다.</p>}
    {state === 'error' && <p role="alert" className="py-6 text-sm font-semibold text-red-700">사용자 정보를 불러오지 못했습니다.</p>}
    {state === 'ready' && <><div className="max-h-[60vh] overflow-auto rounded-[5px] border border-kaist-grey/20"><table className="w-full min-w-[800px] table-fixed text-left text-sm"><thead className="sticky top-0 bg-white"><tr><th className="w-1/4 px-3 py-3">이름</th><th className="w-1/4 px-3 py-3">영문 이름</th><th className="w-1/4 px-3 py-3">KAIST UID</th><th className="w-1/4 px-3 py-3">학번·사번</th></tr></thead><tbody className="divide-y divide-kaist-grey/20">{items.length === 0 ? <tr><td colSpan={4} className="py-8 text-center font-semibold text-[#39404B]">일치하는 사용자가 없습니다.</td></tr> : items.map((user) => <tr key={user.id} className="hover:bg-kaist-grey/10"><td className="p-0"><button type="button" onClick={() => void select(user.id)} className="w-full px-3 py-3 text-left font-semibold">{user.nameKr ?? user.nameEn ?? '-'}</button></td><td className="px-3 py-3">{user.nameEn ?? '-'}</td><td className="px-3 py-3">{user.kaistUid ?? '-'}</td><td className="px-3 py-3">{user.studentOrEmployeeNumber ?? '-'}</td></tr>)}</tbody></table></div>
      {nextCursor && <button type="button" onClick={() => void search(nextCursor)} className="mt-4 rounded-[5px] border border-kaist-grey/25 px-4 py-2 text-xs font-extrabold">더 보기</button>}
      {detail && <div className="mt-6 rounded-[8px] border border-kaist-grey/25 bg-white p-4 text-sm"><h2 className="font-extrabold text-kaist-black">{userName(detail)}</h2><dl className="mt-3 grid gap-2 md:grid-cols-2"><div><dt className="font-bold">KAIST UID</dt><dd>{detail.kaistUid ?? '-'}</dd></div><div><dt className="font-bold">학번·사번</dt><dd>{detail.studentOrEmployeeNumber ?? '-'}</dd></div></dl><h3 className="mt-4 font-extrabold">유효 권한</h3>{detail.grants.length === 0 ? <p className="mt-2">권한이 없습니다.</p> : <ul className="mt-2 space-y-1">{detail.grants.map((grant) => <li key={grant.id}>{grant.permission} · {grant.scope}{grant.scopeId ? ` (${grant.scopeId})` : ''}</li>)}</ul>}</div>}</>}
  </section>;
}
