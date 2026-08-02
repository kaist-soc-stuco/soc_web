import { uiText } from "@/lib/i18n/surface-catalog";
import { useEffect, useRef, useState } from 'react';
import type { AdminUserGetResponse, AdminUserListItem } from '@soc/contracts';
import { hasGlobalGrant } from '@/lib/admin-access';
import { AdminIdentityApiError, AdminIdentityApiProtocolError, adminIdentityApi } from '@/lib/admin-identity-api';
import { useAdminGrants } from '@/lib/admin-grants';
type FilterKind = 'name' | 'studentOrEmployeeNumber';
type LoadState = 'idle' | 'loading' | 'ready' | 'denied' | 'error' | 'protocol';
const userName = (user: AdminUserListItem | AdminUserGetResponse) => user.nameKr ?? user.nameEn ?? '-';
const errorState = (error: unknown): Exclude<LoadState, 'idle' | 'loading' | 'ready'> => {
    if (error instanceof AdminIdentityApiProtocolError)
        return 'protocol';
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
    const [activeQuery, setActiveQuery] = useState<{
        kind: FilterKind;
        value: string;
    } | null>(null);
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
            if (generation !== requestGeneration.current)
                return;
            setItems((current) => cursor ? [...current, ...page.items] : page.items);
            setNextCursor(page.nextCursor);
            setState('ready');
        }
        catch (error) {
            if (generation === requestGeneration.current)
                setState(errorState(error));
        }
    };
    const select = async (id: string) => {
        try {
            setDetail(await adminIdentityApi.getUser(id));
        }
        catch (error) {
            setState(errorState(error));
        }
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
    if (grants.status === 'loading' || grants.status === 'idle')
        return <section><h1 className="text-[32px] font-extrabold text-kaist-black">{uiText("pages.admin-users-page.3bad419ced")}</h1><p className="mt-5 text-sm font-semibold">{uiText("pages.admin-users-page.fd041853ed")}</p></section>;
    if (!allowed)
        return <section><h1 className="text-[32px] font-extrabold text-kaist-black">{uiText("pages.admin-users-page.3bad419ced")}</h1><p role="alert" className="mt-5 text-sm font-semibold text-red-700">{uiText("pages.admin-users-page.a5ead6eadd")}</p></section>;
    return <section>
    <div className="mb-6 border-b border-kaist-grey/25 pb-4"><h1 className="text-[32px] font-extrabold tracking-tight text-kaist-black">{uiText("pages.admin-users-page.3bad419ced")}</h1></div>
    <form className="mb-5 flex flex-wrap gap-2" onSubmit={(event) => { event.preventDefault(); void search(); }}>
      <select aria-label={uiText("pages.admin-users-page.1057b1792a")} value={kind} onChange={(event) => { setKind(event.target.value as FilterKind); resetSearch(); }} className="rounded-[5px] border border-kaist-grey/25 bg-white px-3 py-2 text-sm"><option value="name">{uiText("pages.admin-users-page.9aa18e5071")}</option><option value="studentOrEmployeeNumber">{uiText("pages.admin-users-page.53dcbafec1")}</option></select>
      <input aria-label={uiText("pages.admin-users-page.45188d670c")} value={value} onChange={(event) => { setValue(event.target.value); resetSearch(); }} className="min-w-64 rounded-[5px] border border-kaist-grey/25 px-3 py-2 text-sm" placeholder={uiText("pages.admin-users-page.d75ec85e50")}/>
      <button type="submit" className="rounded-[5px] bg-kaist-darkgreen px-5 py-2 text-xs font-extrabold text-white">{uiText("pages.admin-users-page.72d116b0a0")}</button>
    </form>
    {state === 'idle' && <p className="py-6 text-sm font-semibold text-[#39404B]">{uiText("pages.admin-users-page.1fa5045984")}</p>}
    {state === 'loading' && <p className="py-6 text-sm font-semibold text-[#39404B]">{uiText("pages.admin-users-page.3cdecf0f02")}</p>}
    {state === 'denied' && <p role="alert" className="py-6 text-sm font-semibold text-red-700">{uiText("pages.admin-users-page.a5ead6eadd")}</p>}
    {state === 'protocol' && <p role="alert" className="py-6 text-sm font-semibold text-red-700">{uiText("pages.admin-users-page.b7659abe82")}</p>}
    {state === 'error' && <p role="alert" className="py-6 text-sm font-semibold text-red-700">{uiText("pages.admin-users-page.f38e54746a")}</p>}
    {state === 'ready' && <><div className="max-h-[60vh] overflow-auto rounded-[5px] border border-kaist-grey/20"><table className="w-full min-w-[800px] table-fixed text-left text-sm"><thead className="sticky top-0 bg-white"><tr><th className="w-1/4 px-3 py-3">{uiText("pages.admin-users-page.9aa18e5071")}</th><th className="w-1/4 px-3 py-3">{uiText("pages.admin-users-page.e41178640e")}</th><th className="w-1/4 px-3 py-3">KAIST UID</th><th className="w-1/4 px-3 py-3">{uiText("pages.admin-users-page.53dcbafec1")}</th></tr></thead><tbody className="divide-y divide-kaist-grey/20">{items.length === 0 ? <tr><td colSpan={4} className="py-8 text-center font-semibold text-[#39404B]">{uiText("pages.admin-users-page.815bd25ca5")}</td></tr> : items.map((user) => <tr key={user.id} className="hover:bg-kaist-grey/10"><td className="p-0"><button type="button" onClick={() => void select(user.id)} className="w-full px-3 py-3 text-left font-semibold">{user.nameKr ?? user.nameEn ?? '-'}</button></td><td className="px-3 py-3">{user.nameEn ?? '-'}</td><td className="px-3 py-3">{user.kaistUid ?? '-'}</td><td className="px-3 py-3">{user.studentOrEmployeeNumber ?? '-'}</td></tr>)}</tbody></table></div>
      {nextCursor && <button type="button" onClick={() => void search(nextCursor)} className="mt-4 rounded-[5px] border border-kaist-grey/25 px-4 py-2 text-xs font-extrabold">{uiText("pages.admin-users-page.dcd42d6cce")}</button>}
      {detail && <div className="mt-6 rounded-[8px] border border-kaist-grey/25 bg-white p-4 text-sm"><h2 className="font-extrabold text-kaist-black">{userName(detail)}</h2><dl className="mt-3 grid gap-2 md:grid-cols-2"><div><dt className="font-bold">KAIST UID</dt><dd>{detail.kaistUid ?? '-'}</dd></div><div><dt className="font-bold">{uiText("pages.admin-users-page.53dcbafec1")}</dt><dd>{detail.studentOrEmployeeNumber ?? '-'}</dd></div></dl><h3 className="mt-4 font-extrabold">{uiText("pages.admin-users-page.31aead1186")}</h3>{detail.grants.length === 0 ? <p className="mt-2">{uiText("pages.admin-users-page.9f667aff5a")}</p> : <ul className="mt-2 space-y-1">{detail.grants.map((grant) => <li key={grant.id}>{grant.permission} · {grant.scope}{grant.scopeId ? ` (${grant.scopeId})` : ''}</li>)}</ul>}</div>}</>}
  </section>;
}
