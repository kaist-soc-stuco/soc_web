import { uiText } from "@/lib/i18n/surface-catalog";
import { useEffect, useState } from 'react';
import type { AdminUserListItem, PermissionChangeRequestResponse, PermissionDefinition, PermissionGrantScope } from '@soc/contracts';
import { hasAnyWorkflowGrant, hasGlobalGrant, hasScopedGrant } from '@/lib/admin-access';
import { AdminIdentityApiError, AdminIdentityApiProtocolError, adminIdentityApi } from '@/lib/admin-identity-api';
import { refetchAdminGrants, useAdminGrants } from '@/lib/admin-grants';
type State = 'loading' | 'ready' | 'denied' | 'error' | 'protocol';
type Stage = 'REQUESTED' | 'APPROVAL' | 'ACTIVATION';
type Queue = {
    state: State;
    items: PermissionChangeRequestResponse[];
    nextCursor: string | null;
};
const scopes: PermissionGrantScope[] = ['GLOBAL', 'BOARD', 'EVENT', 'SURVEY'];
const emptyQueue = (): Queue => ({ state: 'loading', items: [], nextCursor: null });
const failure = (error: unknown): Exclude<State, 'loading' | 'ready'> => error instanceof AdminIdentityApiProtocolError ? 'protocol' : error instanceof AdminIdentityApiError && (error.status === 401 || error.status === 403) ? 'denied' : 'error';
const queueTitle: Record<Stage, string> = { REQUESTED: uiText("pages.admin-permissions-page.afeee1843a"), APPROVAL: uiText("pages.admin-permissions-page.f5aaa7c510"), ACTIVATION: uiText("pages.admin-permissions-page.98b9ba7226") };
export function AdminPermissionsPage() {
    const grants = useAdminGrants();
    const [definitions, setDefinitions] = useState<PermissionDefinition[]>([]);
    const [definitionState, setDefinitionState] = useState<State>('loading');
    const [queues, setQueues] = useState<Record<Stage, Queue>>({ REQUESTED: emptyQueue(), APPROVAL: emptyQueue(), ACTIVATION: emptyQueue() });
    const [target, setTarget] = useState('');
    const [targetFilter, setTargetFilter] = useState<'kaistUid' | 'studentOrEmployeeNumber'>('kaistUid');
    const [targetValue, setTargetValue] = useState('');
    const [targetMatches, setTargetMatches] = useState<AdminUserListItem[]>([]);
    const [action, setAction] = useState<'GRANT' | 'REVOKE'>('GRANT');
    const [permission, setPermission] = useState('');
    const [scope, setScope] = useState<PermissionGrantScope>('GLOBAL');
    const [scopeId, setScopeId] = useState('');
    const [reasonCode, setReasonCode] = useState('ADMIN_REQUEST');
    const [message, setMessage] = useState('');
    const visible = hasAnyWorkflowGrant(grants.grants);
    const canLookup = hasGlobalGrant(grants.grants, 'USERS_MANAGE');
    const scopedAuthority = hasScopedGrant(grants.grants, action === 'GRANT' ? 'PERMISSION_GRANT' : 'PERMISSION_REVOKE', scope, scope === 'GLOBAL' ? null : scopeId.trim() || null);
    const loadDefinitions = async () => {
        setDefinitionState('loading');
        try {
            const page = await adminIdentityApi.listDefinitions();
            setDefinitions(page.items);
            setPermission((current) => current || page.items[0]?.key || '');
            setDefinitionState('ready');
        }
        catch (error) {
            setDefinitionState(failure(error));
        }
    };
    const loadQueue = async (stage: Stage, cursor?: string) => {
        setQueues((current) => ({ ...current, [stage]: { ...current[stage], state: 'loading' } }));
        try {
            const page = await adminIdentityApi.listRequests({ stage, cursor, limit: 20 });
            setQueues((current) => ({ ...current, [stage]: { state: 'ready', items: cursor ? [...current[stage].items, ...page.items] : page.items, nextCursor: page.nextCursor } }));
        }
        catch (error) {
            setQueues((current) => ({ ...current, [stage]: { ...current[stage], state: failure(error) } }));
        }
    };
    const refresh = async () => { await Promise.all([loadDefinitions(), ...(['REQUESTED', 'APPROVAL', 'ACTIVATION'] as Stage[]).map((stage) => loadQueue(stage))]); };
    useEffect(() => { if (visible)
        void refresh(); }, [visible]);
    const lookupTarget = async (event: React.FormEvent) => {
        event.preventDefault();
        setMessage('');
        const exact = targetValue.trim();
        if (!canLookup || !exact) {
            setMessage(uiText("pages.admin-permissions-page.910fae245e"));
            return;
        }
        try {
            const page = await adminIdentityApi.listUsers({ [targetFilter]: exact, limit: 20 });
            setTargetMatches(page.items);
        }
        catch (error) {
            setMessage(failure(error) === 'denied' ? uiText("pages.admin-permissions-page.95c6af9f3d") : uiText("pages.admin-permissions-page.8742b7efc4"));
        }
    };
    const submit = async (event: React.FormEvent) => {
        event.preventDefault();
        setMessage('');
        if (!canLookup) {
            setMessage(uiText("pages.admin-permissions-page.922209587a"));
            return;
        }
        if (!scopedAuthority) {
            setMessage(uiText("pages.admin-permissions-page.d707ec025d"));
            return;
        }
        if (!target.trim() || !permission || !reasonCode.trim() || (scope !== 'GLOBAL' && !scopeId.trim())) {
            setMessage(uiText("pages.admin-permissions-page.8cd59e03e2"));
            return;
        }
        try {
            await adminIdentityApi.requestGrant({ targetUserId: target.trim(), action, permission, scope, ...(scope === 'GLOBAL' ? {} : { scopeId: scopeId.trim() }), reasonCode: reasonCode.trim() });
            setTarget('');
            setMessage(uiText("pages.admin-permissions-page.fe20aad200"));
            await refresh();
            await refetchAdminGrants();
        }
        catch (error) {
            setMessage(failure(error) === 'denied' ? uiText("pages.admin-permissions-page.f36427cfee") : uiText("pages.admin-permissions-page.3629431678"));
        }
    };
    const mutate = async (id: string, stage: 'APPROVAL' | 'ACTIVATION') => {
        const code = reasonCode.trim();
        if (!code) {
            setMessage(uiText("pages.admin-permissions-page.31b936fc0a"));
            return;
        }
        try {
            if (stage === 'APPROVAL')
                await adminIdentityApi.approveRequest(id, { reasonCode: code });
            else
                await adminIdentityApi.activateRequest(id, { reasonCode: code });
            setMessage(stage === 'APPROVAL' ? uiText("pages.admin-permissions-page.2b412cce77") : uiText("pages.admin-permissions-page.8d688a73b7"));
            await refresh();
            await refetchAdminGrants();
        }
        catch (error) {
            setMessage(failure(error) === 'denied' ? uiText("pages.admin-permissions-page.63f7034ee6") : uiText("pages.admin-permissions-page.4ce9b1e4cf"));
        }
    };
    if (grants.status === 'idle' || grants.status === 'loading')
        return <section><div><h1 className="text-[32px] font-extrabold text-kaist-black">{uiText("pages.admin-permissions-page.d8a670873e")}</h1><p>관리 권한 요청을 검색, 생성, 승인하고 단계별 처리 현황을 확인합니다.</p></div><p className="mt-5 text-sm font-semibold">{uiText("pages.admin-permissions-page.fd041853ed")}</p></section>;
    if (!visible)
        return <section><div><h1 className="text-[32px] font-extrabold text-kaist-black">{uiText("pages.admin-permissions-page.d8a670873e")}</h1><p>관리 권한 요청을 검색, 생성, 승인하고 단계별 처리 현황을 확인합니다.</p></div><p role="alert" className="mt-5 text-sm font-semibold text-red-700">{uiText("pages.admin-permissions-page.716f7d1ab9")}</p></section>;
    const queueView = (stage: Stage) => {
        const queue = queues[stage];
        return <div key={stage} className="rounded-[8px] border border-kaist-grey/25 bg-white p-4"><h2 className="font-extrabold text-kaist-black">{queueTitle[stage]}</h2>{queue.state === 'loading' && <p className="mt-3 text-sm">{uiText("pages.admin-permissions-page.1250c928dd")}</p>}{queue.state === 'denied' && <p role="alert" className="mt-3 text-sm text-red-700">{uiText("pages.admin-permissions-page.834d509247")}</p>}{queue.state === 'protocol' && <p role="alert" className="mt-3 text-sm text-red-700">{uiText("pages.admin-permissions-page.b7659abe82")}</p>}{queue.state === 'error' && <p role="alert" className="mt-3 text-sm text-red-700">{uiText("pages.admin-permissions-page.25deb26a33")}</p>}{queue.state === 'ready' && (queue.items.length === 0 ? <p className="mt-3 text-sm">{uiText("pages.admin-permissions-page.c4ba9659a0")}</p> : <ul className="mt-3 space-y-2 text-sm">{queue.items.map((item) => <li key={item.id} className="border-t border-kaist-grey/20 pt-2"><span>{item.action} · {item.permission} · {item.scope}{item.scopeId ? ` (${item.scopeId})` : ''}</span>{stage !== 'REQUESTED' && <button type="button" onClick={() => void mutate(item.id, stage)} className="ml-3 text-xs font-extrabold text-kaist-darkgreen">{stage === 'APPROVAL' ? uiText("pages.admin-permissions-page.0d1cd67197") : uiText("pages.admin-permissions-page.bbf831ade8")}</button>}</li>)}</ul>)}{queue.nextCursor && <button type="button" onClick={() => void loadQueue(stage, queue.nextCursor ?? undefined)} className="mt-3 text-xs font-extrabold text-kaist-darkgreen">{uiText("pages.admin-permissions-page.dcd42d6cce")}</button>}</div>;
    };
    return <section>
    <div className="mb-6 border-b border-kaist-grey/25 pb-4"><h1 className="text-[32px] font-extrabold tracking-tight text-kaist-black">{uiText("pages.admin-permissions-page.d8a670873e")}</h1><p>관리 권한 요청을 검색, 생성, 승인하고 단계별 처리 현황을 확인합니다.</p></div>
    {message && <p role="alert" className="mb-4 text-sm font-semibold text-red-700">{message}</p>}
    <form onSubmit={lookupTarget} className="mb-4 flex flex-wrap gap-2 rounded-[8px] border border-kaist-grey/25 bg-white p-4"><span className="w-full text-sm font-extrabold text-kaist-black">{uiText("pages.admin-permissions-page.611ca57369")}</span><select aria-label={uiText("pages.admin-permissions-page.f6a092860c")} disabled={!canLookup} value={targetFilter} onChange={(event) => setTargetFilter(event.target.value as 'kaistUid' | 'studentOrEmployeeNumber')} className="rounded-[5px] border border-kaist-grey/25 px-3 py-2 text-sm"><option value="kaistUid">KAIST UID</option><option value="studentOrEmployeeNumber">{uiText("pages.admin-permissions-page.53dcbafec1")}</option></select><input aria-label={uiText("pages.admin-permissions-page.79a11e723b")} disabled={!canLookup} value={targetValue} onChange={(event) => setTargetValue(event.target.value)} className="rounded-[5px] border border-kaist-grey/25 px-3 py-2 text-sm" placeholder={uiText("pages.admin-permissions-page.d75ec85e50")}/><button type="submit" disabled={!canLookup} className="rounded-[5px] border border-kaist-grey/25 px-4 py-2 text-xs font-extrabold disabled:opacity-50">{uiText("pages.admin-permissions-page.68819ee99a")}</button>{targetMatches.map((user) => <button key={user.id} type="button" onClick={() => { setTarget(user.id); setTargetMatches([]); }} className="rounded-[5px] bg-kaist-grey/10 px-3 py-2 text-xs font-bold">{user.nameKr ?? user.nameEn ?? '-'}{uiText("pages.admin-permissions-page.08109e412c")}</button>)}</form>
    <form onSubmit={submit} className="mb-6 grid gap-3 rounded-[8px] border border-kaist-grey/25 bg-white p-4 md:grid-cols-2"><h2 className="md:col-span-2 font-extrabold text-kaist-black">{uiText("pages.admin-permissions-page.9076c0e6d5")}</h2><label className="text-sm font-bold">{uiText("pages.admin-permissions-page.148ef61736")}<input aria-label={uiText("pages.admin-permissions-page.148ef61736")} disabled={!canLookup} value={target} onChange={(event) => setTarget(event.target.value)} className="mt-1 block w-full border-b border-kaist-grey/25 px-1 py-2 disabled:bg-kaist-grey/10"/></label><label className="text-sm font-bold">{uiText("pages.admin-permissions-page.9d9bf438ff")}<select aria-label={uiText("pages.admin-permissions-page.9d9bf438ff")} value={action} onChange={(event) => setAction(event.target.value as 'GRANT' | 'REVOKE')} className="mt-1 block w-full border-b border-kaist-grey/25 px-1 py-2"><option value="GRANT">{uiText("pages.admin-permissions-page.d71a879459")}</option><option value="REVOKE">{uiText("pages.admin-permissions-page.2d8918b82f")}</option></select></label><label className="text-sm font-bold">{uiText("pages.admin-permissions-page.4d02bde7c2")}<select aria-label={uiText("pages.admin-permissions-page.4d02bde7c2")} value={permission} onChange={(event) => setPermission(event.target.value)} className="mt-1 block w-full border-b border-kaist-grey/25 px-1 py-2">{definitions.map((definition) => <option key={definition.key} value={definition.key}>{definition.key} — {definition.description}</option>)}</select></label><label className="text-sm font-bold">{uiText("pages.admin-permissions-page.f6b7b470d6")}<select aria-label={uiText("pages.admin-permissions-page.f6b7b470d6")} value={scope} onChange={(event) => setScope(event.target.value as PermissionGrantScope)} className="mt-1 block w-full border-b border-kaist-grey/25 px-1 py-2">{scopes.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>{scope !== 'GLOBAL' && <label className="text-sm font-bold">{uiText("pages.admin-permissions-page.bad1581bd6")}<input aria-label={uiText("pages.admin-permissions-page.bad1581bd6")} value={scopeId} onChange={(event) => setScopeId(event.target.value)} className="mt-1 block w-full border-b border-kaist-grey/25 px-1 py-2"/></label>}<label className="text-sm font-bold">{uiText("pages.admin-permissions-page.9fd3dbb45f")}<input aria-label={uiText("pages.admin-permissions-page.9fd3dbb45f")} value={reasonCode} onChange={(event) => setReasonCode(event.target.value)} className="mt-1 block w-full border-b border-kaist-grey/25 px-1 py-2"/></label><div><button type="submit" disabled={!canLookup || !scopedAuthority} className="rounded-[5px] bg-kaist-darkgreen px-5 py-2 text-xs font-extrabold text-white disabled:opacity-50">{uiText("pages.admin-permissions-page.bab82af942")}</button></div></form>
    {definitionState === 'loading' && <p className="mb-4 text-sm">{uiText("pages.admin-permissions-page.684c5157a4")}</p>}{definitionState === 'denied' && <p role="alert" className="mb-4 text-sm text-red-700">{uiText("pages.admin-permissions-page.bb7786c84f")}</p>}{definitionState === 'protocol' && <p role="alert" className="mb-4 text-sm text-red-700">{uiText("pages.admin-permissions-page.56364372e7")}</p>}{definitionState === 'error' && <p role="alert" className="mb-4 text-sm text-red-700">{uiText("pages.admin-permissions-page.97067dec5e")}</p>}
    <div className="grid gap-4 lg:grid-cols-3">{(['REQUESTED', 'APPROVAL', 'ACTIVATION'] as Stage[]).map(queueView)}</div>
  </section>;
}
