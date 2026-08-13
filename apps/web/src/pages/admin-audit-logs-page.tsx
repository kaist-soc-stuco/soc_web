import { uiText } from "@/lib/i18n/surface-catalog";
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
        try {
            const page = await adminIdentityApi.listAudit({ cursor, limit: 30 });
            setItems((current) => cursor ? [...current, ...page.items] : page.items);
            setNextCursor(page.nextCursor);
            setState('ready');
        }
        catch (error) {
            setState(errorState(error));
        }
    };
    useEffect(() => { if (allowed)
        void load();
    else
        setState('denied'); }, [allowed]);
    if (grants.status === 'idle' || grants.status === 'loading')
        return <section><div><h1 className="text-[32px] font-extrabold text-kaist-black">{uiText("pages.admin-audit-logs-page.96c3f20a36")}</h1><p>권한 변경과 주요 관리 작업의 기록을 시간순으로 확인합니다.</p></div><p className="mt-5 text-sm font-semibold">{uiText("pages.admin-audit-logs-page.fd041853ed")}</p></section>;
    if (!allowed)
        return <section><div><h1 className="text-[32px] font-extrabold text-kaist-black">{uiText("pages.admin-audit-logs-page.96c3f20a36")}</h1><p>권한 변경과 주요 관리 작업의 기록을 시간순으로 확인합니다.</p></div><p role="alert" className="mt-5 text-sm font-semibold text-red-700">{uiText("pages.admin-audit-logs-page.850ba530b8")}</p></section>;
    return <section>
    <div className="mb-6 border-b border-kaist-grey/25 pb-4"><h1 className="text-[32px] font-extrabold tracking-tight text-kaist-black">{uiText("pages.admin-audit-logs-page.96c3f20a36")}</h1><p>권한 변경과 주요 관리 작업의 기록을 시간순으로 확인합니다.</p></div>
    {state === 'loading' && <p className="py-8 text-sm font-semibold text-[#39404B]">{uiText("pages.admin-audit-logs-page.994a05703b")}</p>}
    {state === 'denied' && <p role="alert" className="py-8 text-sm font-semibold text-red-700">{uiText("pages.admin-audit-logs-page.850ba530b8")}</p>}
    {state === 'protocol' && <p role="alert" className="py-8 text-sm font-semibold text-red-700">{uiText("pages.admin-audit-logs-page.b7659abe82")}</p>}
    {state === 'error' && <p role="alert" className="py-8 text-sm font-semibold text-red-700">{uiText("pages.admin-audit-logs-page.59eccc2a68")}</p>}
    {state === 'ready' && <><div className="overflow-x-auto"><table className="min-w-[850px] w-full text-left text-sm"><thead className="border-b-2 border-kaist-darkgreen-main text-kaist-darkgreen"><tr><th className="p-3">{uiText("pages.admin-audit-logs-page.8b60f55b21")}</th><th className="p-3">{uiText("pages.admin-audit-logs-page.9d9bf438ff")}</th><th className="p-3">{uiText("pages.admin-audit-logs-page.d84b6f4b0c")}</th><th className="p-3">{uiText("pages.admin-audit-logs-page.5b359caa1f")}</th><th className="p-3">{uiText("pages.admin-audit-logs-page.9fd3dbb45f")}</th></tr></thead><tbody className="divide-y divide-kaist-grey/20">{items.length === 0 ? <tr><td colSpan={5} className="p-8 text-center font-semibold text-[#39404B]">{uiText("pages.admin-audit-logs-page.84c2f14710")}</td></tr> : items.map((entry) => <tr key={entry.id}><td className="p-3">{entry.occurredAt}</td><td className="p-3">{entry.action}</td><td className="p-3">{entry.recordId}</td><td className="p-3">{entry.changedFieldNames.join(', ') || '-'}</td><td className="p-3">{entry.reasonCode ?? '-'}</td></tr>)}</tbody></table></div>{nextCursor && <button type="button" onClick={() => void load(nextCursor)} className="mt-4 rounded-[5px] border border-kaist-grey/25 px-4 py-2 text-xs font-extrabold">{uiText("pages.admin-audit-logs-page.dcd42d6cce")}</button>}</>}
  </section>;
}
