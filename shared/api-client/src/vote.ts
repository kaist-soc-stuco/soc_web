import type {
  CreateVoteRequest,
  SubmitVoteBallotRequest,
  UpdateVoteRequest,
  VoteDetailResponse,
  VoteRecord,
  VoteResultsResponse,
  VoteSubmissionResponse,
  VoteVoterRecord,
} from "@soc/contracts";

import type { ApiClientContext } from "./core.js";

export const createVoteApi = ({ requestJson, requestVoid, votesBaseUrl }: ApiClientContext) => ({
  listPublicVotes: () => requestJson<VoteRecord[]>(`${votesBaseUrl}/public`, { method: "GET" }),
  getVote: (id: string) => requestJson<VoteDetailResponse>(`${votesBaseUrl}/${id}`, { method: "GET" }),
  getVoteResults: (id: string) => requestJson<VoteResultsResponse>(`${votesBaseUrl}/${id}/results`, { method: "GET" }),
  verifyVoteReceipt: (id: string, code: string) => requestJson<{ accepted: boolean }>(`${votesBaseUrl}/${id}/receipts/${encodeURIComponent(code)}`, { method: "GET" }),
  submitVote: (id: string, body: SubmitVoteBallotRequest) => requestJson<VoteSubmissionResponse>(`${votesBaseUrl}/${id}/ballots`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  }, { retryOnUnauthorized: true }),

  listAdminVotes: () => requestJson<VoteRecord[]>(`${votesBaseUrl}/admin`, { method: "GET" }, { retryOnUnauthorized: true }),
  createVote: (body: CreateVoteRequest) => requestJson<VoteDetailResponse>(`${votesBaseUrl}/admin`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  }, { retryOnUnauthorized: true }),
  updateVote: (id: string, body: UpdateVoteRequest) => requestJson<VoteDetailResponse>(`${votesBaseUrl}/admin/${id}`, {
    method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  }, { retryOnUnauthorized: true }),
  deleteVote: (id: string) => requestVoid(`${votesBaseUrl}/admin/${id}`, { method: "DELETE" }, { retryOnUnauthorized: true }),
  publishVote: (id: string) => requestJson<VoteDetailResponse>(`${votesBaseUrl}/admin/${id}/publish`, { method: "POST" }, { retryOnUnauthorized: true }),
  closeVote: (id: string) => requestJson<VoteDetailResponse>(`${votesBaseUrl}/admin/${id}/close`, { method: "POST" }, { retryOnUnauthorized: true }),
  tallyVote: (id: string) => requestJson<VoteResultsResponse>(`${votesBaseUrl}/admin/${id}/tally`, { method: "POST" }, { retryOnUnauthorized: true }),
  publishVoteResults: (id: string) => requestJson<VoteResultsResponse>(`${votesBaseUrl}/admin/${id}/publish-results`, { method: "POST" }, { retryOnUnauthorized: true }),
  listVoteVoters: (id: string) => requestJson<VoteVoterRecord[]>(`${votesBaseUrl}/admin/${id}/voters`, { method: "GET" }, { retryOnUnauthorized: true }),
  addVoteVoters: (id: string, identifiers: { userIds?: string[]; studentNumbers?: string[] }) => requestJson<{ added: number }>(`${votesBaseUrl}/admin/${id}/voters`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userIds: identifiers.userIds ?? [], studentNumbers: identifiers.studentNumbers ?? [] }),
  }, { retryOnUnauthorized: true }),
  excludeVoteVoters: (id: string, userIds: string[]) => requestJson<{ excluded: number }>(`${votesBaseUrl}/admin/${id}/voters/exclude`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userIds }),
  }, { retryOnUnauthorized: true }),
});
