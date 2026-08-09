import { Body, Controller, Delete, Get, HttpCode, Inject, Param, Patch, Post, Query, Req, UnprocessableEntityException, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import type { CastVoteRequest, CreatePledgeRequest, CreateVoteRequest, ImportVoteVoterRollRequest, PatchPledgeRequest, PatchVoteRequest } from '@soc/contracts';

import { AuthGuard, OptionalAuthGuard } from '../../shared/guards';
import { GovernanceService } from './governance.service';

type OptionalRequest = Request & { user?: { id: string } };
type AuthenticatedRequest = Request & { user: { id: string } };
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function objectBody(value: unknown, keys: readonly string[], code: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some((key) => !keys.includes(key))) throw new UnprocessableEntityException(code);
  return value as Record<string, unknown>;
}

function id(value: string): string {
  if (!UUID_PATTERN.test(value)) throw new UnprocessableEntityException('invalid_governance_id');
  return value;
}

function locale(value: Record<string, unknown>, code: string): string | undefined {
  if (value.locale !== undefined && value.locale !== 'ko' && value.locale !== 'en') throw new UnprocessableEntityException(code);
  return value.locale as string | undefined;
}

@Controller('votes')
@UseGuards(OptionalAuthGuard)
export class PublicVotesController {
  constructor(@Inject(GovernanceService) private readonly governance: GovernanceService) {}

  @Get()
  list(@Req() request: OptionalRequest, @Query() query: Record<string, unknown>) {
    const value = objectBody(query, ['locale'], 'invalid_vote_query');
    return this.governance.listVotes(request.user?.id, locale(value, 'invalid_vote_query'));
  }

  @Get(':id')
  get(@Req() request: OptionalRequest, @Param('id') voteId: string, @Query() query: Record<string, unknown>) {
    const value = objectBody(query, ['locale'], 'invalid_vote_query');
    return this.governance.getVote(request.user?.id, id(voteId), locale(value, 'invalid_vote_query'));
  }
}

@Controller('votes')
@UseGuards(AuthGuard)
export class VoteBallotsController {
  constructor(@Inject(GovernanceService) private readonly governance: GovernanceService) {}

  @Post(':id/ballots')
  @HttpCode(201)
  cast(@Req() request: AuthenticatedRequest, @Param('id') voteId: string, @Body() body: unknown) {
    const value = objectBody(body, ['candidateId'], 'invalid_vote');
    return this.governance.castVote(request.user.id, id(voteId), id((value as unknown as CastVoteRequest).candidateId));
  }
}

@Controller('admin')
@UseGuards(AuthGuard)
export class AdminGovernanceController {
  constructor(@Inject(GovernanceService) private readonly governance: GovernanceService) {}

  @Get('votes')
  listVotes(@Req() request: AuthenticatedRequest) { return this.governance.listAdminVotes(request.user.id); }

  @Post('votes')
  createVote(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    const value = objectBody(body, ['titleKr', 'titleEn', 'descriptionKr', 'descriptionEn', 'opensAt', 'closesAt', 'anonymous', 'validTurnoutPercent', 'candidates'], 'invalid_vote');
    return this.governance.createVote(request.user.id, value as unknown as CreateVoteRequest);
  }

  @Patch('votes/:id')
  patchVote(@Req() request: AuthenticatedRequest, @Param('id') voteId: string, @Body() body: unknown) {
    const value = objectBody(body, ['titleKr', 'titleEn', 'descriptionKr', 'descriptionEn', 'opensAt', 'closesAt', 'validTurnoutPercent'], 'invalid_vote');
    return this.governance.patchVote(request.user.id, id(voteId), value as unknown as PatchVoteRequest);
  }

  @Post('votes/:id/voter-roll')
  importVoterRoll(@Req() request: AuthenticatedRequest, @Param('id') voteId: string, @Body() body: unknown) {
    const value = objectBody(body, ['entries'], 'invalid_voter_roll');
    return this.governance.importVoterRoll(request.user.id, id(voteId), value as unknown as ImportVoteVoterRollRequest);
  }

  @Post('votes/:id/open')
  openVote(@Req() request: AuthenticatedRequest, @Param('id') voteId: string) { return this.governance.transition(request.user.id, id(voteId), 'OPEN'); }

  @Post('votes/:id/close')
  closeVote(@Req() request: AuthenticatedRequest, @Param('id') voteId: string) { return this.governance.transition(request.user.id, id(voteId), 'CLOSE'); }

  @Post('votes/:id/publish')
  publishVote(@Req() request: AuthenticatedRequest, @Param('id') voteId: string) { return this.governance.transition(request.user.id, id(voteId), 'PUBLISH'); }

  @Get('pledges')
  listPledges(@Req() request: AuthenticatedRequest) { return this.governance.listAdminPledges(request.user.id); }

  @Post('pledges')
  createPledge(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    const value = objectBody(body, ['ordinal', 'titleKr', 'titleEn', 'descriptionKr', 'descriptionEn', 'status', 'progressPercent', 'progressKr', 'progressEn', 'targetDate', 'isPublished'], 'invalid_pledge');
    return this.governance.createPledge(request.user.id, value as unknown as CreatePledgeRequest);
  }

  @Patch('pledges/:id')
  patchPledge(@Req() request: AuthenticatedRequest, @Param('id') pledgeId: string, @Body() body: unknown) {
    const value = objectBody(body, ['ordinal', 'titleKr', 'titleEn', 'descriptionKr', 'descriptionEn', 'status', 'progressPercent', 'progressKr', 'progressEn', 'targetDate', 'isPublished'], 'invalid_pledge');
    return this.governance.patchPledge(request.user.id, id(pledgeId), value as unknown as PatchPledgeRequest);
  }

  @Delete('pledges/:id')
  @HttpCode(204)
  async deletePledge(@Req() request: AuthenticatedRequest, @Param('id') pledgeId: string): Promise<void> {
    await this.governance.deletePledge(request.user.id, id(pledgeId));
  }
}

@Controller('pledges')
@UseGuards(OptionalAuthGuard)
export class PublicPledgesController {
  constructor(@Inject(GovernanceService) private readonly governance: GovernanceService) {}

  @Get()
  list(@Query() query: Record<string, unknown>) {
    const value = objectBody(query, ['locale'], 'invalid_pledge_query');
    return this.governance.listPledges(locale(value, 'invalid_pledge_query'));
  }

  @Get(':id')
  get(@Param('id') pledgeId: string, @Query() query: Record<string, unknown>) {
    const value = objectBody(query, ['locale'], 'invalid_pledge_query');
    return this.governance.getPledge(id(pledgeId), locale(value, 'invalid_pledge_query'));
  }
}
