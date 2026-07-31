import { useEffect, useState } from 'react';
import type { PermissionAuditEntry } from '@soc/contracts';

import { hasGlobalGrant } from '@/lib/admin-access';
import { AdminIdentityApiError, AdminIdentityApiProtocolError, adminIdentityApi } from '@/lib/admin-identity-api';
import { useAdminGrants } from '@/lib/admin-grants';

type LoadState = 'loading' | 'ready' | 'denied' | 'error' | 'protocol';
const errorState = (error: unknown): Exclude<LoadState, 'loading' | 'ready'> => error instanceof AdminIdentityApiProtocolError ? 'protocol' : error instanceof AdminIdentityApiError && (error.status === 401 || error.status === 403) ? 'denied' : 'error';

export function AdminAuditLogsPage() {
  const grants = useAdminGrants();
  const [items, setItems] = useState<PermissionAuditEntry[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [state, setState] = useState<LoadState>('loading');
  const allowed = hasGlobalGrant(grants.grants, 'PERMISSION_AUDIT');
  const load = async (cursor?: string) => {
    setState('loading');
    try { const page = await adminIdentityApi.listAudit({ cursor, limit: 30 }); setItems((current) => cursor ? [...current, ...page.items] : page.items); setNextCursor(page.nextCursor); setState('ready'); }
    catch (error) { setState(errorState(error)); }
  };
  useEffect(() => { if (allowed) void load(); else setState('denied'); }, [allowed]);
  if (grants.status === 'idle' || grants.status === 'loading') return <section><h1 className="text-[32px] font-extrabold text-kaist-black">권한 감사 로그</h1><p className="mt-5 text-sm font-semibold">권한을 확인하는 중입니다.</p></section>;
  if (!allowed) return <section><h1 className="text-[32px] font-extrabold text-kaist-black">권한 감사 로그</h1><p role="alert" className="mt-5 text-sm font-semibold text-red-700">감사 로그 조회 권한이 없습니다.</p></section>;
  return <section>
    <div className="mb-6 border-b border-kaist-grey/25 pb-4"><h1 className="text-[32px] font-extrabold tracking-tight text-kaist-black">권한 감사 로그</h1></div>
    {state === 'loading' && <p className="py-8 text-sm font-semibold text-[#39404B]">감사 로그를 불러오는 중입니다.</p>}
    {state === 'denied' && <p role="alert" className="py-8 text-sm font-semibold text-red-700">감사 로그 조회 권한이 없습니다.</p>}
    {state === 'protocol' && <p role="alert" className="py-8 text-sm font-semibold text-red-700">응답 형식을 확인할 수 없습니다.</p>}
    {state === 'error' && <p role="alert" className="py-8 text-sm font-semibold text-red-700">감사 로그를 불러오지 못했습니다.</p>}
    {state === 'ready' && <><div className="overflow-x-auto"><table className="min-w-[850px] w-full text-left text-sm"><thead className="border-b-2 border-kaist-darkgreen-main text-kaist-darkgreen"><tr><th className="p-3">시각</th><th className="p-3">작업</th><th className="p-3">기록</th><th className="p-3">변경 항목</th><th className="p-3">사유 코드</th></tr></thead><tbody className="divide-y divide-kaist-grey/20">{items.length === 0 ? <tr><td colSpan={5} className="p-8 text-center font-semibold text-[#39404B]">감사 로그가 없습니다.</td></tr> : items.map((entry) => <tr key={entry.id}><td className="p-3">{entry.occurredAt}</td><td className="p-3">{entry.action}</td><td className="p-3">{entry.recordId}</td><td className="p-3">{entry.changedFieldNames.join(', ') || '-'}</td><td className="p-3">{entry.reasonCode ?? '-'}</td></tr>)}</tbody></table></div>{nextCursor && <button type="button" onClick={() => void load(nextCursor)} className="mt-4 rounded-[5px] border border-kaist-grey/25 px-4 py-2 text-xs font-extrabold">더 보기</button>}</>}
  </section>;
}
