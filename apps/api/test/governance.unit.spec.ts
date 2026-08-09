import { describe, expect, it, vi } from 'vitest';

import { GovernanceService } from '../src/features/governance/governance.service';

const ids = {
  actor: '10000000-0000-4000-8000-000000000001',
  vote: '91111111-1111-4111-8111-111111111111',
  candidateA: '92222222-2222-4222-8222-222222222222',
  candidateB: '93333333-3333-4333-8333-333333333333',
  pledge: '94444444-4444-4444-8444-444444444444',
};
const now = new Date('2026-08-07T12:00:00.000Z');

const voteRow = (overrides: Record<string, unknown> = {}) => ({
  id: ids.vote,
  titleKr: '투표',
  titleEn: 'Vote',
  descriptionKr: '설명',
  descriptionEn: 'Description',
  state: 'OPEN',
  opensAt: new Date('2026-08-01T00:00:00.000Z'),
  closesAt: new Date('2026-12-31T00:00:00.000Z'),
  anonymous: true,
  validTurnoutPercent: 50,
  resultsPublishedAt: null,
  resultsVisibleUntil: null,
  createdByUserId: ids.actor,
  updatedByUserId: ids.actor,
  createdAt: now,
  updatedAt: now,
  ...overrides,
});
const candidate = (id: string, ordinal: number, name: string) => ({ id, voteId: ids.vote, ordinal, nameKr: name, nameEn: name, descriptionKr: '설명', descriptionEn: 'Description', imageUrl: null });
const pledgeRow = (overrides: Record<string, unknown> = {}) => ({
  id: ids.pledge,
  ordinal: 0,
  titleKr: '공약',
  titleEn: 'Pledge',
  descriptionKr: '설명',
  descriptionEn: 'Description',
  status: 'IN_PROGRESS',
  progressPercent: 50,
  progressKr: '진행 중',
  progressEn: 'In progress',
  targetDate: '2026-09-30',
  isPublished: true,
  createdByUserId: ids.actor,
  updatedByUserId: ids.actor,
  createdAt: now,
  updatedAt: now,
  ...overrides,
});

function subject() {
  const bundle = () => ({ vote: voteRow(), candidates: [candidate(ids.candidateA, 0, '후보 A'), candidate(ids.candidateB, 1, '후보 B')] });
  const repository = {
    listVotes: vi.fn().mockResolvedValue([bundle()]),
    findVote: vi.fn().mockResolvedValue(bundle()),
    stats: vi.fn().mockResolvedValue({ eligibleVoterCount: 2, participantCount: 1 }),
    results: vi.fn().mockResolvedValue([{ candidateId: ids.candidateA, voteCount: 1 }]),
    isEligible: vi.fn().mockResolvedValue(true),
    hasParticipant: vi.fn().mockResolvedValue(false),
    castVote: vi.fn().mockResolvedValue('OK'),
    createVote: vi.fn().mockResolvedValue(bundle()),
    patchVote: vi.fn().mockResolvedValue(bundle()),
    replaceVoterRoll: vi.fn().mockResolvedValue(bundle()),
    transition: vi.fn().mockResolvedValue(bundle()),
    listPledges: vi.fn().mockResolvedValue([pledgeRow()]),
    findPledge: vi.fn().mockResolvedValue(pledgeRow()),
    createPledge: vi.fn().mockResolvedValue(pledgeRow()),
    patchPledge: vi.fn().mockResolvedValue(pledgeRow()),
    deletePledge: vi.fn().mockResolvedValue(true),
  };
  const permissions = { hasPermission: vi.fn().mockResolvedValue(true) };
  const users = { findById: vi.fn().mockResolvedValue({ id: ids.actor, ssoSubject: ' subject-1 ', studentOrEmployeeNumber: '2026 0001' }) };
  const clock = { now: vi.fn().mockReturnValue(now) };
  return { service: new GovernanceService(repository as never, permissions as never, users as never, clock as never), repository, permissions, users, clock, bundle };
}

describe('GovernanceService', () => {
  it('projects public vote states, hides drafts, and publishes results only in the result window', async () => {
    const { service, repository, bundle } = subject();
    repository.listVotes.mockResolvedValueOnce([
      bundle(),
      { ...bundle(), vote: voteRow({ id: '95555555-5555-4555-8555-555555555555', state: 'DRAFT' }) },
      { ...bundle(), vote: voteRow({ id: '96666666-6666-4666-8666-666666666666', state: 'SCHEDULED', opensAt: new Date('2026-08-08T00:00:00.000Z') }) },
    ]);

    const listed = await service.listVotes(undefined, 'ko');
    expect(listed.items.map((item) => item.state)).toEqual(['OPEN', 'SCHEDULED']);
    expect(listed.items[0]?.participation).toBe('NOT_AUTHENTICATED');

    repository.findVote.mockResolvedValueOnce({ ...bundle(), vote: voteRow({ state: 'RESULTS_PUBLISHED', resultsVisibleUntil: new Date('2026-08-10T00:00:00.000Z') }) });
    const detail = await service.getVote(undefined, ids.vote, 'ko');
    expect(detail.results).toEqual([
      expect.objectContaining({ voteCount: 1, percent: 100 }),
      expect.objectContaining({ voteCount: 0, percent: 0 }),
    ]);
  });

  it('hashes voter identities, enforces eligibility, and rejects duplicate ballots', async () => {
    const { service, repository, users } = subject();
    await expect(service.castVote(ids.actor, ids.vote, ids.candidateA)).resolves.toEqual({ voted: true, turnoutPercent: 50 });
    const hashes = repository.isEligible.mock.calls[0]?.[1] as string[];
    expect(hashes).toHaveLength(2);
    expect(hashes.every((hash) => /^[0-9a-f]{64}$/.test(hash))).toBe(true);
    expect(hashes).not.toContain('2026 0001');
    expect(repository.castVote).toHaveBeenCalledWith(ids.vote, ids.actor, ids.candidateA, now);
    expect(users.findById).toHaveBeenCalledWith(ids.actor);

    repository.castVote.mockResolvedValueOnce('ALREADY_VOTED');
    await expect(service.castVote(ids.actor, ids.vote, ids.candidateA)).rejects.toMatchObject({ response: { message: 'vote_already_cast' } });
    repository.isEligible.mockResolvedValueOnce(false);
    await expect(service.castVote(ids.actor, ids.vote, ids.candidateA)).rejects.toMatchObject({ response: { message: 'vote_not_eligible' } });
  });

  it('deduplicates voter-roll imports and never stores raw identity values', async () => {
    const { service, repository } = subject();
    await service.importVoterRoll(ids.actor, ids.vote, {
      entries: [
        { identityKind: 'STUDENT_NUMBER', value: '2026 0001' },
        { identityKind: 'STUDENT_NUMBER', value: '20260001' },
        { identityKind: 'SSO_SUBJECT', value: 'subject-1' },
      ],
    });
    const entries = repository.replaceVoterRoll.mock.calls[0]?.[2] as Array<{ identityKind: string; identityHash: string }>;
    expect(entries).toHaveLength(2);
    expect(entries.every((entry) => /^[0-9a-f]{64}$/.test(entry.identityHash))).toBe(true);
    expect(JSON.stringify(entries)).not.toContain('20260001');
    await expect(service.importVoterRoll(ids.actor, ids.vote, { entries: [] })).rejects.toMatchObject({ response: { message: 'invalid_voter_roll' } });
  });

  it('validates vote creation and delegates lifecycle transitions only with management permission', async () => {
    const { service, repository, permissions } = subject();
    const input = {
      titleKr: ' 새 투표 ',
      titleEn: ' New vote ',
      descriptionKr: ' 설명 ',
      descriptionEn: ' Description ',
      opensAt: '2026-08-01T00:00:00.000Z',
      closesAt: '2026-08-31T00:00:00.000Z',
      validTurnoutPercent: 60,
      candidates: [{ nameKr: ' A ', nameEn: ' A ' }, { nameKr: ' B ', nameEn: ' B ' }],
    };
    await service.createVote(ids.actor, input);
    expect(repository.createVote).toHaveBeenCalledWith(expect.objectContaining({
      actorUserId: ids.actor,
      vote: expect.objectContaining({ titleKr: '새 투표', titleEn: 'New vote', validTurnoutPercent: 60 }),
      candidates: expect.arrayContaining([expect.objectContaining({ nameKr: 'A', ordinal: 0 })]),
    }));
    await expect(service.createVote(ids.actor, { ...input, validTurnoutPercent: 101 })).rejects.toMatchObject({ response: { message: 'invalid_vote_turnout' } });

    permissions.hasPermission.mockResolvedValueOnce(false);
    await expect(service.listAdminVotes(ids.actor)).rejects.toMatchObject({ response: { message: 'insufficient_permission' } });
    repository.transition.mockResolvedValueOnce('INVALID_TURNOUT');
    await expect(service.transition(ids.actor, ids.vote, 'PUBLISH')).rejects.toMatchObject({ response: { message: 'vote_invalid_turnout' } });
  });

  it('filters unpublished pledges at the public boundary and validates progress/date updates', async () => {
    const { service, repository } = subject();
    repository.listPledges.mockResolvedValueOnce([pledgeRow()]);
    const list = await service.listPledges('ko');
    expect(list.items[0]).toMatchObject({ progressPercent: 50, status: 'IN_PROGRESS' });

    repository.findPledge.mockResolvedValueOnce(pledgeRow({ isPublished: false }));
    await expect(service.getPledge(ids.pledge, 'ko')).rejects.toMatchObject({ response: { message: 'pledge_not_found' } });
    await service.patchPledge(ids.actor, ids.pledge, { progressPercent: 80, targetDate: '2026-10-01' });
    expect(repository.patchPledge).toHaveBeenCalledWith(ids.pledge, ids.actor, expect.objectContaining({ progressPercent: 80, targetDate: '2026-10-01' }), 'progressPercent,targetDate');
    await expect(service.patchPledge(ids.actor, ids.pledge, { progressPercent: 101 })).rejects.toMatchObject({ response: { message: 'invalid_pledge_progress' } });
    await expect(service.patchPledge(ids.actor, ids.pledge, { targetDate: '2026-02-30' })).rejects.toMatchObject({ response: { message: 'invalid_pledge_date' } });
    await service.deletePledge(ids.actor, ids.pledge);
    expect(repository.deletePledge).toHaveBeenCalledWith(ids.pledge, ids.actor);
    repository.deletePledge.mockResolvedValueOnce(false);
    await expect(service.deletePledge(ids.actor, ids.pledge)).rejects.toMatchObject({ response: { message: 'pledge_not_found' } });
  });
});
