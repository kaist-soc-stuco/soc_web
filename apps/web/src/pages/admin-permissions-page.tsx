import { useEffect, useState } from 'react';
import type { AdminUserListItem, PermissionChangeRequestResponse, PermissionDefinition, PermissionGrantScope } from '@soc/contracts';

import { hasAnyWorkflowGrant, hasGlobalGrant, hasScopedGrant } from '@/lib/admin-access';
import { AdminIdentityApiError, AdminIdentityApiProtocolError, adminIdentityApi } from '@/lib/admin-identity-api';
import { refetchAdminGrants, useAdminGrants } from '@/lib/admin-grants';

type State = 'loading' | 'ready' | 'denied' | 'error' | 'protocol';
type Stage = 'REQUESTED' | 'APPROVAL' | 'ACTIVATION';
type Queue = { state: State; items: PermissionChangeRequestResponse[]; nextCursor: string | null };
const scopes: PermissionGrantScope[] = ['GLOBAL', 'BOARD', 'EVENT', 'SURVEY'];
const emptyQueue = (): Queue => ({ state: 'loading', items: [], nextCursor: null });
const failure = (error: unknown): Exclude<State, 'loading' | 'ready'> => error instanceof AdminIdentityApiProtocolError ? 'protocol' : error instanceof AdminIdentityApiError && (error.status === 401 || error.status === 403) ? 'denied' : 'error';
const queueTitle: Record<Stage, string> = { REQUESTED: '내 요청', APPROVAL: '승인 대기', ACTIVATION: '활성화 대기' };

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
    try { const page = await adminIdentityApi.listDefinitions(); setDefinitions(page.items); setPermission((current) => current || page.items[0]?.key || ''); setDefinitionState('ready'); }
    catch (error) { setDefinitionState(failure(error)); }
  };
  const loadQueue = async (stage: Stage, cursor?: string) => {
    setQueues((current) => ({ ...current, [stage]: { ...current[stage], state: 'loading' } }));
    try { const page = await adminIdentityApi.listRequests({ stage, cursor, limit: 20 }); setQueues((current) => ({ ...current, [stage]: { state: 'ready', items: cursor ? [...current[stage].items, ...page.items] : page.items, nextCursor: page.nextCursor } })); }
    catch (error) { setQueues((current) => ({ ...current, [stage]: { ...current[stage], state: failure(error) } })); }
  };
  const refresh = async () => { await Promise.all([loadDefinitions(), ...(['REQUESTED', 'APPROVAL', 'ACTIVATION'] as Stage[]).map((stage) => loadQueue(stage))]); };
  useEffect(() => { if (visible) void refresh(); }, [visible]);
  const lookupTarget = async (event: React.FormEvent) => {
    event.preventDefault(); setMessage('');
    const exact = targetValue.trim();
    if (!canLookup || !exact) { setMessage('정확한 KAIST UID 또는 학번·사번을 입력해 주세요.'); return; }
    try {
      const page = await adminIdentityApi.listUsers({ [targetFilter]: exact, limit: 20 });
      setTargetMatches(page.items);
    } catch (error) { setMessage(failure(error) === 'denied' ? '서버가 사용자 조회 권한을 거부했습니다.' : '사용자를 찾지 못했습니다.'); }
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setMessage('');
    if (!canLookup) { setMessage('사용자 조회 권한이 없어 요청을 만들 수 없습니다.'); return; }
    if (!scopedAuthority) { setMessage('해당 범위의 요청 권한이 없습니다.'); return; }
    if (!target.trim() || !permission || !reasonCode.trim() || (scope !== 'GLOBAL' && !scopeId.trim())) { setMessage('대상, 권한, 범위와 사유 코드를 입력해 주세요.'); return; }
    try {
      await adminIdentityApi.requestGrant({ targetUserId: target.trim(), action, permission, scope, ...(scope === 'GLOBAL' ? {} : { scopeId: scopeId.trim() }), reasonCode: reasonCode.trim() });
      setTarget(''); setMessage('요청을 등록했습니다.'); await refresh(); await refetchAdminGrants();
    } catch (error) { setMessage(failure(error) === 'denied' ? '서버가 요청 권한을 거부했습니다.' : '요청을 등록하지 못했습니다.'); }
  };
  const mutate = async (id: string, stage: 'APPROVAL' | 'ACTIVATION') => {
    const code = reasonCode.trim(); if (!code) { setMessage('사유 코드를 입력해 주세요.'); return; }
    try { if (stage === 'APPROVAL') await adminIdentityApi.approveRequest(id, { reasonCode: code }); else await adminIdentityApi.activateRequest(id, { reasonCode: code }); setMessage(stage === 'APPROVAL' ? '요청을 승인했습니다.' : '권한을 활성화했습니다.'); await refresh(); await refetchAdminGrants(); }
    catch (error) { setMessage(failure(error) === 'denied' ? '서버가 작업 권한을 거부했습니다.' : '작업을 완료하지 못했습니다.'); }
  };

  if (grants.status === 'idle' || grants.status === 'loading') return <section><h1 className="text-[32px] font-extrabold text-kaist-black">권한 요청 관리</h1><p className="mt-5 text-sm font-semibold">권한을 확인하는 중입니다.</p></section>;
  if (!visible) return <section><h1 className="text-[32px] font-extrabold text-kaist-black">권한 요청 관리</h1><p role="alert" className="mt-5 text-sm font-semibold text-red-700">권한 요청 업무 권한이 없습니다.</p></section>;
  const queueView = (stage: Stage) => {
    const queue = queues[stage];
    return <div key={stage} className="rounded-[8px] border border-kaist-grey/25 bg-white p-4"><h2 className="font-extrabold text-kaist-black">{queueTitle[stage]}</h2>{queue.state === 'loading' && <p className="mt-3 text-sm">불러오는 중입니다.</p>}{queue.state === 'denied' && <p role="alert" className="mt-3 text-sm text-red-700">이 대기열 권한이 없습니다.</p>}{queue.state === 'protocol' && <p role="alert" className="mt-3 text-sm text-red-700">응답 형식을 확인할 수 없습니다.</p>}{queue.state === 'error' && <p role="alert" className="mt-3 text-sm text-red-700">대기열을 불러오지 못했습니다.</p>}{queue.state === 'ready' && (queue.items.length === 0 ? <p className="mt-3 text-sm">항목이 없습니다.</p> : <ul className="mt-3 space-y-2 text-sm">{queue.items.map((item) => <li key={item.id} className="border-t border-kaist-grey/20 pt-2"><span>{item.action} · {item.permission} · {item.scope}{item.scopeId ? ` (${item.scopeId})` : ''}</span>{stage !== 'REQUESTED' && <button type="button" onClick={() => void mutate(item.id, stage)} className="ml-3 text-xs font-extrabold text-kaist-darkgreen">{stage === 'APPROVAL' ? '승인' : '활성화'}</button>}</li>)}</ul>)}{queue.nextCursor && <button type="button" onClick={() => void loadQueue(stage, queue.nextCursor ?? undefined)} className="mt-3 text-xs font-extrabold text-kaist-darkgreen">더 보기</button>}</div>;
  };
  return <section>
    <div className="mb-6 border-b border-kaist-grey/25 pb-4"><h1 className="text-[32px] font-extrabold tracking-tight text-kaist-black">권한 요청 관리</h1></div>
    {message && <p role="alert" className="mb-4 text-sm font-semibold text-red-700">{message}</p>}
    <form onSubmit={lookupTarget} className="mb-4 flex flex-wrap gap-2 rounded-[8px] border border-kaist-grey/25 bg-white p-4"><span className="w-full text-sm font-extrabold text-kaist-black">대상 사용자 찾기</span><select aria-label="대상 검색 기준" disabled={!canLookup} value={targetFilter} onChange={(event) => setTargetFilter(event.target.value as 'kaistUid' | 'studentOrEmployeeNumber')} className="rounded-[5px] border border-kaist-grey/25 px-3 py-2 text-sm"><option value="kaistUid">KAIST UID</option><option value="studentOrEmployeeNumber">학번·사번</option></select><input aria-label="정확한 대상 사용자 검색" disabled={!canLookup} value={targetValue} onChange={(event) => setTargetValue(event.target.value)} className="rounded-[5px] border border-kaist-grey/25 px-3 py-2 text-sm" placeholder="정확히 입력" /><button type="submit" disabled={!canLookup} className="rounded-[5px] border border-kaist-grey/25 px-4 py-2 text-xs font-extrabold disabled:opacity-50">찾기</button>{targetMatches.map((user) => <button key={user.id} type="button" onClick={() => { setTarget(user.id); setTargetMatches([]); }} className="rounded-[5px] bg-kaist-grey/10 px-3 py-2 text-xs font-bold">{user.nameKr ?? user.nameEn ?? '-'} 선택</button>)}</form>
    <form onSubmit={submit} className="mb-6 grid gap-3 rounded-[8px] border border-kaist-grey/25 bg-white p-4 md:grid-cols-2"><h2 className="md:col-span-2 font-extrabold text-kaist-black">권한 요청</h2><label className="text-sm font-bold">대상 사용자 ID<input aria-label="대상 사용자 ID" disabled={!canLookup} value={target} onChange={(event) => setTarget(event.target.value)} className="mt-1 block w-full border-b border-kaist-grey/25 px-1 py-2 disabled:bg-kaist-grey/10" /></label><label className="text-sm font-bold">작업<select aria-label="작업" value={action} onChange={(event) => setAction(event.target.value as 'GRANT' | 'REVOKE')} className="mt-1 block w-full border-b border-kaist-grey/25 px-1 py-2"><option value="GRANT">부여</option><option value="REVOKE">회수</option></select></label><label className="text-sm font-bold">권한<select aria-label="권한" value={permission} onChange={(event) => setPermission(event.target.value)} className="mt-1 block w-full border-b border-kaist-grey/25 px-1 py-2">{definitions.map((definition) => <option key={definition.key} value={definition.key}>{definition.key} — {definition.description}</option>)}</select></label><label className="text-sm font-bold">범위<select aria-label="범위" value={scope} onChange={(event) => setScope(event.target.value as PermissionGrantScope)} className="mt-1 block w-full border-b border-kaist-grey/25 px-1 py-2">{scopes.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>{scope !== 'GLOBAL' && <label className="text-sm font-bold">범위 ID<input aria-label="범위 ID" value={scopeId} onChange={(event) => setScopeId(event.target.value)} className="mt-1 block w-full border-b border-kaist-grey/25 px-1 py-2" /></label>}<label className="text-sm font-bold">사유 코드<input aria-label="사유 코드" value={reasonCode} onChange={(event) => setReasonCode(event.target.value)} className="mt-1 block w-full border-b border-kaist-grey/25 px-1 py-2" /></label><div><button type="submit" disabled={!canLookup || !scopedAuthority} className="rounded-[5px] bg-kaist-darkgreen px-5 py-2 text-xs font-extrabold text-white disabled:opacity-50">요청 등록</button></div></form>
    {definitionState === 'loading' && <p className="mb-4 text-sm">권한 정의를 불러오는 중입니다.</p>}{definitionState === 'denied' && <p role="alert" className="mb-4 text-sm text-red-700">권한 정의 조회 권한이 없습니다.</p>}{definitionState === 'protocol' && <p role="alert" className="mb-4 text-sm text-red-700">권한 정의 응답 형식을 확인할 수 없습니다.</p>}{definitionState === 'error' && <p role="alert" className="mb-4 text-sm text-red-700">권한 정의를 불러오지 못했습니다.</p>}
    <div className="grid gap-4 lg:grid-cols-3">{(['REQUESTED', 'APPROVAL', 'ACTIVATION'] as Stage[]).map(queueView)}</div>
  </section>;
}
