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
  if (error instanceof BoardApiProtocolError) return '서버 응답 형식을 확인할 수 없습니다. 새로고침 후 다시 시도해 주세요.';
  if (error instanceof BoardApiError) {
    if (error.status === 401 || error.status === 403) return '게시판 관리 권한이 없거나 세션이 만료되었습니다.';
    if (error.code === 'board_has_articles') return '게시글이 있는 게시판은 삭제할 수 없습니다. 보존 기간이 끝나 게시글 행이 실제로 제거된 뒤 다시 시도해 주세요.';
    if (error.code === 'board_stale') return '다른 관리자가 먼저 변경했습니다. 목록을 새로고침한 뒤 현재 설정을 다시 적용해 주세요.';
    if (error.code === 'board_conflict') return '게시판 코드 또는 표시 순서가 이미 사용 중입니다.';
    if (error.code === 'invalid_board_version') return '게시판 버전 정보가 올바르지 않습니다. 목록을 새로고침해 주세요.';
    if (error.code === 'invalid_board_order') return '표시 순서는 0 이상의 정수여야 합니다.';
    if (error.code === 'invalid_board' || error.code === 'invalid_board_id') return '게시판 입력값을 확인해 주세요.';
    return '게시판 요청을 처리하지 못했습니다.';
  }
  return '게시판 정보를 처리하지 못했습니다. 네트워크 연결을 확인한 뒤 다시 시도해 주세요.';
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
    if (!allowed) return false;
    const request = ++generation.current;
    setState('loading');
    setMessage(null);
    setRefreshWarning(false);
    try {
      const response = await boardApi.adminList();
      if (!allowed || request !== generation.current) return false;
      setItems(response.items.slice().sort((a, b) => a.displayOrder - b.displayOrder || a.code.localeCompare(b.code)));
      setState('ready');
      return true;
    } catch (error) {
      if (!allowed || request !== generation.current) return false;
      setState(error instanceof BoardApiProtocolError ? 'protocol' : error instanceof BoardApiError && (error.status === 401 || error.status === 403) ? 'denied' : 'error');
      setMessage(errorMessage(error));
      return false;
    }
  }, [allowed]);

  useEffect(() => {
    if (!allowed) { generation.current += 1; setItems([]); setEditing(null); setPending(false); setState('denied'); return; }
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
    if (results.some((result) => result.status === 'rejected' || (result.status === 'fulfilled' && result.value === false))) setRefreshWarning(true);
  };
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (pending) return;
    setPending(true); setMessage(null);
    try {
      if (editing) {
        const { code: _code, ...fields } = form;
        const request: VersionedPatchBoardRequest = { expectedUpdatedAt: editing.updatedAt, ...fields };
        const saved = await boardApi.adminPatch(editing.id, request);
        setItems((current) => current.map((item) => item.id === saved.id ? saved : item));
        setEditing(saved);
      } else {
        const saved = await boardApi.adminCreate({ ...form, code: form.code.trim() });
        setItems((current) => [...current, saved].sort((a, b) => a.displayOrder - b.displayOrder || a.code.localeCompare(b.code)));
      }
      await reconcileAfterMutation();
      reset();
    } catch (error) { setMessage(errorMessage(error)); }
    finally { setPending(false); }
  };
  const remove = async (board: AdminBoard) => {
    if (pending) return;
    setPending(true); setMessage(null);
    try {
      await boardApi.adminDelete(board.id, { expectedUpdatedAt: board.updatedAt });
      setItems((current) => current.filter((item) => item.id !== board.id));
      await reconcileAfterMutation();
      if (editing?.id === board.id) reset();
    } catch (error) { setMessage(errorMessage(error)); }
    finally { setPending(false); }
  };

  if (grants.status !== 'ready') return <section><h1 className="text-[32px] font-extrabold">게시판 관리</h1><p className="mt-5 text-sm font-semibold">권한을 확인하는 중입니다.</p></section>;
  if (!allowed) return <section><h1 className="text-[32px] font-extrabold">게시판 관리</h1><p role="alert" className="mt-5 text-sm font-semibold text-red-700">게시판 관리 권한이 없습니다.</p></section>;
  if (state === 'denied') return <section><h1 className="text-[32px] font-extrabold">게시판 관리</h1><p role="alert" className="mt-5 text-sm font-semibold text-red-700">게시판 관리 권한이 없거나 세션이 만료되었습니다.</p><button type="button" onClick={() => void refresh()} className="mt-4 rounded-[5px] border border-kaist-grey/25 px-4 py-2 text-xs font-extrabold">목록 새로고침</button></section>;

  return <section>
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-kaist-grey/25 pb-4"><h1 className="text-[32px] font-extrabold tracking-tight">게시판 관리</h1><button type="button" onClick={() => void refresh()} disabled={state === 'loading' || pending} className="rounded-[5px] border border-kaist-grey/25 px-4 py-2 text-xs font-extrabold">목록 새로고침</button></div>
    {message && <p role="alert" className="mb-5 rounded-[5px] border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">{message}</p>}
    {refreshWarning && <p role="alert" className="mb-5 rounded-[5px] border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-800">게시판 변경은 저장되었지만 최신 목록 또는 공개 목록을 새로고침하지 못했습니다. <button type="button" onClick={() => void reconcileAfterMutation()} disabled={pending} className="underline">새로고침 다시 시도</button></p>}
    <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_420px]">
      <div>{state === 'loading' && <p className="py-5 text-sm font-semibold">게시판 목록을 불러오는 중입니다.</p>}{state === 'protocol' && <p role="alert" className="py-5 text-sm font-semibold text-red-700">응답 형식을 확인할 수 없습니다.</p>}{state === 'error' && <p role="alert" className="py-5 text-sm font-semibold text-red-700">게시판 목록을 불러오지 못했습니다.</p>}{state === 'ready' && <div className="divide-y divide-kaist-grey/20 border-y border-kaist-grey/20">{items.length === 0 ? <p className="py-8 text-center text-sm font-semibold">등록된 게시판이 없습니다.</p> : items.map((board) => <div key={board.id} className="flex flex-wrap items-center justify-between gap-3 px-3 py-4 text-sm"><div><p className="font-extrabold">{board.titleKr} <span className="font-medium text-kaist-grey">({board.code})</span></p><p className="mt-1 text-xs font-semibold text-kaist-grey">{board.isHidden ? '숨김' : '표시'} · 순서 {board.displayOrder} · 읽기 {board.readPermission}</p></div><div className="flex gap-2"><button type="button" onClick={() => { setEditing(board); setForm(formFor(board)); setMessage(null); }} disabled={pending} className="rounded-[5px] border border-kaist-grey/25 px-3 py-2 text-xs font-extrabold">편집</button><button type="button" onClick={() => void remove(board)} disabled={pending} className="rounded-[5px] border border-red-300 px-3 py-2 text-xs font-extrabold text-red-700">삭제</button></div></div>)}</div>}</div>
      <form onSubmit={(event) => void submit(event)} className="grid gap-3 rounded-[8px] border border-kaist-grey/25 bg-white p-5 text-sm"><div className="flex items-center justify-between"><h2 className="text-lg font-extrabold">{editing ? '게시판 편집' : '게시판 만들기'}</h2>{editing && <button type="button" onClick={reset} className="text-xs font-extrabold text-kaist-darkgreen">새 게시판</button>}</div><label className="grid gap-1 font-bold">코드<input required disabled={!!editing || pending} value={form.code} onChange={(e) => update('code', e.target.value)} className="rounded border border-kaist-grey/25 px-3 py-2 font-medium disabled:bg-kaist-grey/10" /></label><label className="grid gap-1 font-bold">한글 제목<input required value={form.titleKr} onChange={(e) => update('titleKr', e.target.value)} className="rounded border border-kaist-grey/25 px-3 py-2 font-medium" /></label><label className="grid gap-1 font-bold">영문 제목<input required value={form.titleEn} onChange={(e) => update('titleEn', e.target.value)} className="rounded border border-kaist-grey/25 px-3 py-2 font-medium" /></label><label className="grid gap-1 font-bold">한글 설명<textarea required value={form.descriptionKr} onChange={(e) => update('descriptionKr', e.target.value)} className="rounded border border-kaist-grey/25 px-3 py-2 font-medium" /></label><label className="grid gap-1 font-bold">영문 설명<textarea required value={form.descriptionEn} onChange={(e) => update('descriptionEn', e.target.value)} className="rounded border border-kaist-grey/25 px-3 py-2 font-medium" /></label><div className="grid grid-cols-3 gap-2">{(['readPermission', 'writePermission', 'commentPermission'] as const).map((key) => <label key={key} className="grid gap-1 text-xs font-bold">{key === 'readPermission' ? '읽기' : key === 'writePermission' ? '쓰기' : '댓글'}<select value={form[key]} onChange={(e) => update(key, e.target.value as BoardPermission)} className="rounded border border-kaist-grey/25 px-2 py-2 text-xs">{permissions.map((permission) => <option key={permission}>{permission}</option>)}</select></label>)}</div><label className="grid gap-1 font-bold">표시 순서<input required type="number" step="1" value={form.displayOrder} onChange={(e) => update('displayOrder', Number(e.target.value))} className="rounded border border-kaist-grey/25 px-3 py-2 font-medium" /></label><div className="grid gap-2">{(['commentsAllowed', 'secretArticlesAllowed', 'reactionsAllowed', 'isHidden', 'showOnHome'] as const).map((key) => <label key={key} className="flex items-center gap-2 font-semibold"><input type="checkbox" checked={form[key]} onChange={(e) => update(key, e.target.checked)} />{key === 'commentsAllowed' ? '댓글 허용' : key === 'secretArticlesAllowed' ? '비밀글 허용' : key === 'reactionsAllowed' ? '반응 허용' : key === 'isHidden' ? '목록에서 숨김' : '홈에 표시'}</label>)}</div><button disabled={pending} type="submit" className="rounded-[5px] bg-kaist-darkgreen px-4 py-3 text-sm font-extrabold text-white disabled:opacity-50">{pending ? '처리 중...' : editing ? '변경 저장' : '게시판 만들기'}</button></form>
    </div>
  </section>;
}
