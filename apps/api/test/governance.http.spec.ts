import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthSessionService } from '../src/features/auth/auth-session.service';
import { AdminGovernanceController, PublicPledgesController, PublicVotesController, VoteBallotsController } from '../src/features/governance/governance.controller';
import { GovernanceService } from '../src/features/governance/governance.service';
import { HttpExceptionFilter } from '../src/shared/filters/http-exception.filter';
import { AuthGuard, OptionalAuthGuard } from '../src/shared/guards';
import { UsersService } from '../src/features/users/users.service';

const actorId = '10000000-0000-4000-8000-000000000001';
const voteId = '91111111-1111-4111-8111-111111111111';
const candidateId = '92222222-2222-4222-8222-222222222222';
const pledgeId = '93333333-3333-4333-8333-333333333333';
const voteInput = {
  titleKr: '투표',
  titleEn: 'Vote',
  descriptionKr: '설명',
  descriptionEn: 'Description',
  opensAt: '2026-08-01T00:00:00.000Z',
  closesAt: '2026-08-31T00:00:00.000Z',
  anonymous: true,
  validTurnoutPercent: 50,
  candidates: [{ nameKr: '후보 A', nameEn: 'Candidate A' }, { nameKr: '후보 B', nameEn: 'Candidate B' }],
};
const pledgeInput = {
  ordinal: 0,
  titleKr: '공약',
  titleEn: 'Pledge',
  descriptionKr: '설명',
  descriptionEn: 'Description',
  progressKr: '진행 중',
  progressEn: 'In progress',
};

describe('Governance HTTP boundary', () => {
  let app: INestApplication;
  let governance: Record<string, ReturnType<typeof vi.fn>>;

  beforeEach(async () => {
    governance = {
      listVotes: vi.fn().mockResolvedValue({ locale: 'ko', items: [] }),
      getVote: vi.fn().mockResolvedValue({ id: voteId }),
      castVote: vi.fn().mockResolvedValue({ voted: true, turnoutPercent: 50 }),
      listAdminVotes: vi.fn().mockResolvedValue({ items: [] }),
      createVote: vi.fn().mockResolvedValue({ id: voteId }),
      patchVote: vi.fn().mockResolvedValue({ id: voteId }),
      importVoterRoll: vi.fn().mockResolvedValue({ id: voteId }),
      transition: vi.fn().mockResolvedValue({ id: voteId }),
      listPledges: vi.fn().mockResolvedValue({ locale: 'ko', items: [] }),
      getPledge: vi.fn().mockResolvedValue({ id: pledgeId }),
      listAdminPledges: vi.fn().mockResolvedValue({ items: [] }),
      createPledge: vi.fn().mockResolvedValue({ id: pledgeId }),
      patchPledge: vi.fn().mockResolvedValue({ id: pledgeId }),
      deletePledge: vi.fn().mockResolvedValue(undefined),
    };
    const module = await Test.createTestingModule({
      controllers: [PublicVotesController, VoteBallotsController, AdminGovernanceController, PublicPledgesController],
      providers: [
        AuthGuard,
        OptionalAuthGuard,
        { provide: GovernanceService, useValue: governance },
        { provide: AuthSessionService, useValue: { validateAccessToken: vi.fn().mockResolvedValue({ mode: 'persisted', sub: actorId, sid: 'sid' }) } },
        { provide: UsersService, useValue: { findById: vi.fn().mockResolvedValue({ id: actorId }) } },
      ],
    }).compile();
    app = module.createNestApplication();
    app.use(cookieParser());
    app.useGlobalFilters(new HttpExceptionFilter());
    app.setGlobalPrefix('api');
    await app.init();
  });

  afterEach(async () => { await app.close(); });

  const authenticated = (method: 'get' | 'post' | 'patch' | 'delete', path: string) => request(app.getHttpServer())[method](path).set('Cookie', 'soc_at=access-token');

  it('serves public vote and pledge reads with locale forwarding and strict identifiers', async () => {
    await request(app.getHttpServer()).get('/api/votes?locale=en').expect(200);
    expect(governance.listVotes).toHaveBeenCalledWith(undefined, 'en');
    await request(app.getHttpServer()).get('/api/votes/' + voteId + '?locale=ko').expect(200);
    expect(governance.getVote).toHaveBeenCalledWith(undefined, voteId, 'ko');
    await request(app.getHttpServer()).get('/api/pledges?locale=en').expect(200);
    expect(governance.listPledges).toHaveBeenCalledWith('en');
    await request(app.getHttpServer()).get('/api/pledges/' + pledgeId + '?locale=ko').expect(200);
    expect(governance.getPledge).toHaveBeenCalledWith(pledgeId, 'ko');

    await request(app.getHttpServer()).get('/api/votes?locale=fr').expect(422);
    await request(app.getHttpServer()).get('/api/votes/not-a-uuid').expect(422);
    await request(app.getHttpServer()).get('/api/pledges/' + pledgeId + '?extra=true').expect(422);
    expect(governance.getVote).toHaveBeenCalledTimes(1);
  });

  it('requires authentication for ballots and every administration endpoint', async () => {
    await request(app.getHttpServer()).post('/api/votes/' + voteId + '/ballots').send({ candidateId }).expect(401);
    await request(app.getHttpServer()).get('/api/admin/votes').expect(401);
    await request(app.getHttpServer()).get('/api/admin/pledges').expect(401);
    await request(app.getHttpServer()).delete('/api/admin/pledges/' + pledgeId).expect(401);
    await request(app.getHttpServer()).post('/api/admin/votes').send(voteInput).expect(401);
    expect(governance.castVote).not.toHaveBeenCalled();
    expect(governance.createVote).not.toHaveBeenCalled();
  });

  it('forwards authenticated vote lifecycle, voter-roll, and pledge mutations exactly', async () => {
    await authenticated('post', '/api/votes/' + voteId + '/ballots').send({ candidateId }).expect(201);
    await authenticated('get', '/api/admin/votes').expect(200);
    await authenticated('post', '/api/admin/votes').send(voteInput).expect(201);
    await authenticated('patch', '/api/admin/votes/' + voteId).send({ titleKr: '수정된 투표' }).expect(200);
    await authenticated('post', '/api/admin/votes/' + voteId + '/voter-roll').send({ entries: [{ identityKind: 'STUDENT_NUMBER', value: '20260001' }] }).expect(201);
    await authenticated('post', '/api/admin/votes/' + voteId + '/open').expect(201);
    await authenticated('post', '/api/admin/votes/' + voteId + '/close').expect(201);
    await authenticated('post', '/api/admin/votes/' + voteId + '/publish').expect(201);
    await authenticated('get', '/api/admin/pledges').expect(200);
    await authenticated('post', '/api/admin/pledges').send(pledgeInput).expect(201);
    await authenticated('patch', '/api/admin/pledges/' + pledgeId).send({ progressPercent: 80 }).expect(200);
    await authenticated('delete', '/api/admin/pledges/' + pledgeId).expect(204);

    expect(governance.castVote).toHaveBeenCalledWith(actorId, voteId, candidateId);
    expect(governance.createVote).toHaveBeenCalledWith(actorId, voteInput);
    expect(governance.patchVote).toHaveBeenCalledWith(actorId, voteId, { titleKr: '수정된 투표' });
    expect(governance.importVoterRoll).toHaveBeenCalledWith(actorId, voteId, { entries: [{ identityKind: 'STUDENT_NUMBER', value: '20260001' }] });
    expect(governance.transition).toHaveBeenNthCalledWith(1, actorId, voteId, 'OPEN');
    expect(governance.transition).toHaveBeenNthCalledWith(2, actorId, voteId, 'CLOSE');
    expect(governance.transition).toHaveBeenNthCalledWith(3, actorId, voteId, 'PUBLISH');
    expect(governance.createPledge).toHaveBeenCalledWith(actorId, pledgeInput);
    expect(governance.patchPledge).toHaveBeenCalledWith(actorId, pledgeId, { progressPercent: 80 });
    expect(governance.deletePledge).toHaveBeenCalledWith(actorId, pledgeId);
  });

  it('rejects extra fields, malformed IDs, and malformed mutation bodies before services', async () => {
    const cases = [
      ['post', '/api/admin/votes', { ...voteInput, extra: true }],
      ['patch', '/api/admin/votes/' + voteId, { extra: true }],
      ['post', '/api/admin/votes/' + voteId + '/voter-roll', { entries: [], extra: true }],
      ['post', '/api/votes/' + voteId + '/ballots', { candidateId, extra: true }],
      ['post', '/api/admin/pledges', { ...pledgeInput, extra: true }],
      ['patch', '/api/admin/pledges/' + pledgeId, { extra: true }],
    ] as const;
    for (const [method, path, body] of cases) await authenticated(method, path).send(body).expect(422);
    await authenticated('patch', '/api/admin/votes/not-a-uuid').send({ titleKr: '수정' }).expect(422);
    await authenticated('post', '/api/votes/' + voteId + '/ballots').send({ candidateId: 'not-a-uuid' }).expect(422);
    await authenticated('get', '/api/admin/votes').expect(200);
    expect(governance.createVote).not.toHaveBeenCalled();
    expect(governance.patchVote).not.toHaveBeenCalled();
    expect(governance.importVoterRoll).not.toHaveBeenCalled();
    expect(governance.castVote).not.toHaveBeenCalled();
    expect(governance.createPledge).not.toHaveBeenCalled();
    expect(governance.patchPledge).not.toHaveBeenCalled();
  });
});
