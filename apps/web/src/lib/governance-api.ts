import type { AdminPledge, AdminPledgeListResponse, AdminVote, AdminVoteListResponse, CastVoteResponse, ContentLocale, CreatePledgeRequest, CreateVoteRequest, ImportVoteVoterRollRequest, PatchPledgeRequest, PatchVoteRequest, PledgeListResponse, VoteDetail, VoteListResponse } from '@soc/contracts';

const base = (import.meta.env.VITE_API_BASE_URL ?? '/api').replace(/\/+$/, '');

export class GovernanceApiError extends Error {
  constructor(public readonly status: number, public readonly code?: string) {
    super(code ?? `HTTP ${status}`);
    this.name = 'GovernanceApiError';
  }
}

async function request<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const response = await fetch(`${base}${path}`, {
    method,
    credentials: 'include',
    headers: { Accept: 'application/json', ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => undefined) as { code?: unknown } | undefined;
    throw new GovernanceApiError(response.status, typeof payload?.code === 'string' ? payload.code : undefined);
  }
  return response.status === 204 ? undefined as T : response.json() as Promise<T>;
}

const query = (locale: ContentLocale) => `?locale=${encodeURIComponent(locale)}`;

export const voteApi = {
  list: (locale: ContentLocale, signal?: AbortSignal) => fetch(`${base}/votes${query(locale)}`, { credentials: 'include', signal, headers: { Accept: 'application/json' } }).then(async (response) => { if (!response.ok) throw new GovernanceApiError(response.status); return response.json() as Promise<VoteListResponse>; }),
  get: (id: string, locale: ContentLocale, signal?: AbortSignal) => fetch(`${base}/votes/${encodeURIComponent(id)}${query(locale)}`, { credentials: 'include', signal, headers: { Accept: 'application/json' } }).then(async (response) => { if (!response.ok) throw new GovernanceApiError(response.status); return response.json() as Promise<VoteDetail>; }),
  cast: (id: string, candidateId: string) => request<CastVoteResponse>(`/votes/${encodeURIComponent(id)}/ballots`, 'POST', { candidateId }),
  adminList: () => request<AdminVoteListResponse>('/admin/votes'),
  create: (input: CreateVoteRequest) => request<AdminVote>('/admin/votes', 'POST', input),
  patch: (id: string, input: PatchVoteRequest) => request<AdminVote>(`/admin/votes/${encodeURIComponent(id)}`, 'PATCH', input),
  importVoterRoll: (id: string, input: ImportVoteVoterRollRequest) => request<AdminVote>(`/admin/votes/${encodeURIComponent(id)}/voter-roll`, 'POST', input),
  transition: (id: string, action: 'open' | 'close' | 'publish') => request<AdminVote>(`/admin/votes/${encodeURIComponent(id)}/${action}`, 'POST'),
};

export const pledgeApi = {
  list: (locale: ContentLocale, signal?: AbortSignal) => fetch(`${base}/pledges${query(locale)}`, { credentials: 'include', signal, headers: { Accept: 'application/json' } }).then(async (response) => { if (!response.ok) throw new GovernanceApiError(response.status); return response.json() as Promise<PledgeListResponse>; }),
  adminList: () => request<AdminPledgeListResponse>('/admin/pledges'),
  create: (input: CreatePledgeRequest) => request<AdminPledge>('/admin/pledges', 'POST', input),
  patch: (id: string, input: PatchPledgeRequest) => request<AdminPledge>(`/admin/pledges/${encodeURIComponent(id)}`, 'PATCH', input),
  remove: (id: string) => request<void>(`/admin/pledges/${encodeURIComponent(id)}`, 'DELETE'),
};
