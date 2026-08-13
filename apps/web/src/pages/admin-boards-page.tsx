import { uiText } from "@/lib/i18n/surface-catalog";
import { useCallback, useEffect, useRef, useState } from 'react';
import type { AdminBoard, BoardPermission, CreateBoardRequest, VersionedPatchBoardRequest } from '@soc/contracts';
import { hasGlobalGrant } from '@/lib/admin-access';
import { BoardApiError, BoardApiProtocolError, boardApi } from '@/lib/board-api';
import { getAuthSessionSnapshot } from '@/lib/auth-session';
import { invalidateBoardCatalog, loadBoardCatalog } from '@/lib/board-catalog';
import { useAdminGrants } from '@/lib/admin-grants';
type FormValues = CreateBoardRequest;
type LoadState = 'idle' | 'loading' | 'ready' | 'denied' | 'error' | 'protocol';
const permissions: readonly BoardPermission[] = ['PUBLIC', 'AUTHENTICATED', 'COMMITTEE', 'ADMIN'];
const emptyForm = (): FormValues => ({ code: '', titleKr: '', titleEn: '', descriptionKr: '', descriptionEn: '', readPermission: 'PUBLIC', writePermission: 'AUTHENTICATED', commentPermission: 'AUTHENTICATED', commentsAllowed: true, secretArticlesAllowed: false, reactionsAllowed: true, displayOrder: 0, isHidden: false, showOnHome: false });
const formFor = (board: AdminBoard): FormValues => ({ code: board.code, titleKr: board.titleKr, titleEn: board.titleEn, descriptionKr: board.descriptionKr, descriptionEn: board.descriptionEn, readPermission: board.readPermission, writePermission: board.writePermission, commentPermission: board.commentPermission, commentsAllowed: board.commentsAllowed, secretArticlesAllowed: board.secretArticlesAllowed, reactionsAllowed: board.reactionsAllowed, displayOrder: board.displayOrder, isHidden: board.isHidden, showOnHome: board.showOnHome });
const errorMessage = (error: unknown): string => {
    if (error instanceof BoardApiProtocolError)
        return uiText("pages.admin-boards-page.13744abec2");
    if (error instanceof BoardApiError) {
        if (error.status === 401 || error.status === 403)
            return uiText("pages.admin-boards-page.338cc43b50");
        if (error.code === 'board_has_articles')
            return uiText("pages.admin-boards-page.74254cd17f");
        if (error.code === 'board_stale')
            return uiText("pages.admin-boards-page.5a16815f94");
        if (error.code === 'board_conflict')
            return uiText("pages.admin-boards-page.8b464119b8");
        if (error.code === 'invalid_board_version')
            return uiText("pages.admin-boards-page.465b4d1c8e");
        if (error.code === 'invalid_board_order')
            return uiText("pages.admin-boards-page.3d46fddd92");
        if (error.code === 'invalid_board' || error.code === 'invalid_board_id')
            return uiText("pages.admin-boards-page.3f04bae7bf");
        return uiText("pages.admin-boards-page.46a133990c");
    }
    return uiText("pages.admin-boards-page.4c4e9dc1ff");
};
export function AdminBoardsPage() {
    const grants = useAdminGrants();
    const allowed = grants.status === 'ready' && hasGlobalGrant(grants.grants, 'BOARD_MANAGE');
    const [items, setItems] = useState<AdminBoard[]>([]);
    const [state, setState] = useState<LoadState>('idle');
    const [form, setForm] = useState<FormValues>(emptyForm);
    const [editing, setEditing] = useState<AdminBoard | null>(null);
    const [pending, setPending] = useState(false);
    const [message, setMessage] = useState<string | null>(null);
    const [refreshWarning, setRefreshWarning] = useState(false);
    const generation = useRef(0);
    const refresh = useCallback(async () => {
        if (!allowed)
            return false;
        const request = ++generation.current;
        setState('loading');
        setMessage(null);
        setRefreshWarning(false);
        try {
            const response = await boardApi.adminList();
            if (!allowed || request !== generation.current)
                return false;
            setItems(response.items.slice().sort((a, b) => a.displayOrder - b.displayOrder || a.code.localeCompare(b.code)));
            setState('ready');
            return true;
        }
        catch (error) {
            if (!allowed || request !== generation.current)
                return false;
            setState(error instanceof BoardApiProtocolError ? 'protocol' : error instanceof BoardApiError && (error.status === 401 || error.status === 403) ? 'denied' : 'error');
            setMessage(errorMessage(error));
            return false;
        }
    }, [allowed]);
    useEffect(() => {
        if (!allowed) {
            generation.current += 1;
            setItems([]);
            setEditing(null);
            setPending(false);
            setState('denied');
            return;
        }
        void refresh();
    }, [allowed, refresh]);
    const update = <K extends keyof FormValues>(key: K, value: FormValues[K]) => setForm((current) => ({ ...current, [key]: value }));
    const reset = () => { setEditing(null); setForm(emptyForm()); setMessage(null); };
    const refreshCatalog = async () => {
        const auth = getAuthSessionSnapshot();
        if (auth.status === 'ready') {
            invalidateBoardCatalog();
            await loadBoardCatalog();
        }
    };
    const reconcileAfterMutation = async () => {
        const results = await Promise.allSettled([refresh(), refreshCatalog()]);
        if (results.some((result) => result.status === 'rejected' || (result.status === 'fulfilled' && result.value === false)))
            setRefreshWarning(true);
    };
    const submit = async (event: React.FormEvent) => {
        event.preventDefault();
        if (pending)
            return;
        setPending(true);
        setMessage(null);
        try {
            if (editing) {
                const { code: _code, ...fields } = form;
                const request: VersionedPatchBoardRequest = { expectedUpdatedAt: editing.updatedAt, ...fields };
                const saved = await boardApi.adminPatch(editing.id, request);
                setItems((current) => current.map((item) => item.id === saved.id ? saved : item));
                setEditing(saved);
            }
            else {
                const saved = await boardApi.adminCreate({ ...form, code: form.code.trim() });
                setItems((current) => [...current, saved].sort((a, b) => a.displayOrder - b.displayOrder || a.code.localeCompare(b.code)));
            }
            await reconcileAfterMutation();
            reset();
        }
        catch (error) {
            setMessage(errorMessage(error));
        }
        finally {
            setPending(false);
        }
    };
    const remove = async (board: AdminBoard) => {
        if (pending)
            return;
        setPending(true);
        setMessage(null);
        try {
            await boardApi.adminDelete(board.id, { expectedUpdatedAt: board.updatedAt });
            setItems((current) => current.filter((item) => item.id !== board.id));
            await reconcileAfterMutation();
            if (editing?.id === board.id)
                reset();
        }
        catch (error) {
            setMessage(errorMessage(error));
        }
        finally {
            setPending(false);
        }
    };
    if (grants.status !== 'ready')
        return <section><div><h1 className="text-[32px] font-extrabold">{uiText("pages.admin-boards-page.887f65e5fe")}</h1><p>게시판의 노출 여부, 접근 권한, 작성 정책과 홈 표시 여부를 관리합니다.</p></div><p className="mt-5 text-sm font-semibold">{uiText("pages.admin-boards-page.fd041853ed")}</p></section>;
    if (!allowed)
        return <section><div><h1 className="text-[32px] font-extrabold">{uiText("pages.admin-boards-page.887f65e5fe")}</h1><p>게시판의 노출 여부, 접근 권한, 작성 정책과 홈 표시 여부를 관리합니다.</p></div><p role="alert" className="mt-5 text-sm font-semibold text-red-700">{uiText("pages.admin-boards-page.597c4dcbcb")}</p></section>;
    if (state === 'denied')
        return <section><div><h1 className="text-[32px] font-extrabold">{uiText("pages.admin-boards-page.887f65e5fe")}</h1><p>게시판의 노출 여부, 접근 권한, 작성 정책과 홈 표시 여부를 관리합니다.</p></div><p role="alert" className="mt-5 text-sm font-semibold text-red-700">{uiText("pages.admin-boards-page.338cc43b50")}</p><button type="button" onClick={() => void refresh()} className="mt-4 rounded-[5px] border border-kaist-grey/25 px-4 py-2 text-xs font-extrabold">{uiText("pages.admin-boards-page.bf19890318")}</button></section>;
    return <section>
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3 border-b border-kaist-grey/25 pb-4"><div><h1 className="text-[32px] font-extrabold tracking-tight">{uiText("pages.admin-boards-page.887f65e5fe")}</h1><p>게시판의 노출 여부, 접근 권한, 작성 정책과 홈 표시 여부를 관리합니다.</p></div><button type="button" onClick={() => void refresh()} disabled={state === 'loading' || pending} className="rounded-[5px] border border-kaist-grey/25 px-4 py-2 text-xs font-extrabold">{uiText("pages.admin-boards-page.bf19890318")}</button></div>
    {message && <p role="alert" className="mb-5 rounded-[5px] border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">{message}</p>}
    {refreshWarning && <p role="alert" className="mb-5 rounded-[5px] border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-800">{uiText("pages.admin-boards-page.a2fdb0ed4d")}<button type="button" onClick={() => void reconcileAfterMutation()} disabled={pending} className="underline">{uiText("pages.admin-boards-page.efc763767a")}</button></p>}
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_460px] 2xl:grid-cols-[minmax(0,1fr)_520px]">
      <div>{state === 'loading' && <p className="py-5 text-sm font-semibold">{uiText("pages.admin-boards-page.ab674d7d12")}</p>}{state === 'protocol' && <p role="alert" className="py-5 text-sm font-semibold text-red-700">{uiText("pages.admin-boards-page.b7659abe82")}</p>}{state === 'error' && <p role="alert" className="py-5 text-sm font-semibold text-red-700">{uiText("pages.admin-boards-page.3c28d75624")}</p>}{state === 'ready' && <div className="divide-y divide-kaist-grey/20 border-y border-kaist-grey/20">{items.length === 0 ? <p className="py-8 text-center text-sm font-semibold">{uiText("pages.admin-boards-page.f6e1dc3c3f")}</p> : items.map((board) => <div key={board.id} className="flex flex-wrap items-center justify-between gap-3 px-3 py-4 text-sm"><div><p className="font-extrabold">{board.titleKr} <span className="font-medium text-kaist-grey">({board.code})</span></p><p className="mt-1 text-xs font-semibold text-kaist-grey">{board.isHidden ? uiText("pages.admin-boards-page.093ff1032f") : uiText("pages.admin-boards-page.a61d568e9d")}{uiText("pages.admin-boards-page.4e2101026d")}{board.displayOrder}{uiText("pages.admin-boards-page.e403e32128")}{board.readPermission}</p></div><div className="flex gap-2"><button type="button" onClick={() => { setEditing(board); setForm(formFor(board)); setMessage(null); }} disabled={pending} className="rounded-[5px] border border-kaist-grey/25 px-3 py-2 text-xs font-extrabold">{uiText("pages.admin-boards-page.d482e14b40")}</button><button type="button" onClick={() => void remove(board)} disabled={pending} className="rounded-[5px] border border-red-300 px-3 py-2 text-xs font-extrabold text-red-700">{uiText("pages.admin-boards-page.fc81e222b9")}</button></div></div>)}</div>}</div>
      <form onSubmit={(event) => void submit(event)} className="grid gap-3 rounded-[8px] border border-kaist-grey/25 bg-white p-5 text-sm"><div className="flex items-center justify-between"><h2 className="text-lg font-extrabold">{editing ? uiText("pages.admin-boards-page.0cdee0054d") : uiText("pages.admin-boards-page.ddba0d5a6d")}</h2>{editing && <button type="button" onClick={reset} className="text-xs font-extrabold text-kaist-darkgreen">{uiText("pages.admin-boards-page.1529ffd57b")}</button>}</div><label className="grid gap-1 font-bold">{uiText("pages.admin-boards-page.e94a043c5f")}<input required disabled={!!editing || pending} value={form.code} onChange={(e) => update('code', e.target.value)} className="rounded border border-kaist-grey/25 px-3 py-2 font-medium disabled:bg-kaist-grey/10"/></label><label className="grid gap-1 font-bold">{uiText("pages.admin-boards-page.f2a4f8d6cc")}<input required value={form.titleKr} onChange={(e) => update('titleKr', e.target.value)} className="rounded border border-kaist-grey/25 px-3 py-2 font-medium"/></label><label className="grid gap-1 font-bold">{uiText("pages.admin-boards-page.e7f6048ccc")}<input required value={form.titleEn} onChange={(e) => update('titleEn', e.target.value)} className="rounded border border-kaist-grey/25 px-3 py-2 font-medium"/></label><label className="grid gap-1 font-bold">{uiText("pages.admin-boards-page.6f1c762c9c")}<textarea required value={form.descriptionKr} onChange={(e) => update('descriptionKr', e.target.value)} className="rounded border border-kaist-grey/25 px-3 py-2 font-medium"/></label><label className="grid gap-1 font-bold">{uiText("pages.admin-boards-page.d14fb8beab")}<textarea required value={form.descriptionEn} onChange={(e) => update('descriptionEn', e.target.value)} className="rounded border border-kaist-grey/25 px-3 py-2 font-medium"/></label><div className="grid grid-cols-3 gap-2">{(['readPermission', 'writePermission', 'commentPermission'] as const).map((key) => <label key={key} className="grid gap-1 text-xs font-bold">{key === 'readPermission' ? uiText("pages.admin-boards-page.ccf2780a57") : key === 'writePermission' ? uiText("pages.admin-boards-page.616f97cc3d") : uiText("pages.admin-boards-page.6d4e9bd3a9")}<select value={form[key]} onChange={(e) => update(key, e.target.value as BoardPermission)} className="rounded border border-kaist-grey/25 px-2 py-2 text-xs">{permissions.map((permission) => <option key={permission}>{permission}</option>)}</select></label>)}</div><label className="grid gap-1 font-bold">{uiText("pages.admin-boards-page.8044faf086")}<input required type="number" step="1" value={form.displayOrder} onChange={(e) => update('displayOrder', Number(e.target.value))} className="rounded border border-kaist-grey/25 px-3 py-2 font-medium"/></label><div className="grid gap-2">{(['commentsAllowed', 'secretArticlesAllowed', 'reactionsAllowed', 'isHidden', 'showOnHome'] as const).map((key) => <label key={key} className="flex items-center gap-2 font-semibold"><input type="checkbox" checked={form[key]} onChange={(e) => update(key, e.target.checked)}/>{key === 'commentsAllowed' ? uiText("pages.admin-boards-page.2072b9eeed") : key === 'secretArticlesAllowed' ? uiText("pages.admin-boards-page.3e28bb40fc") : key === 'reactionsAllowed' ? uiText("pages.admin-boards-page.8302493233") : key === 'isHidden' ? uiText("pages.admin-boards-page.42790d4fb6") : uiText("pages.admin-boards-page.7c36352a45")}</label>)}</div><button disabled={pending} type="submit" className="rounded-[5px] bg-kaist-darkgreen px-4 py-3 text-sm font-extrabold text-white disabled:opacity-50">{pending ? uiText("pages.admin-boards-page.e6e1a2914f") : editing ? uiText("pages.admin-boards-page.6d75220d30") : uiText("pages.admin-boards-page.ddba0d5a6d")}</button></form>
    </div>
  </section>;
}
