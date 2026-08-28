import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Req, UseGuards } from "@nestjs/common";
import {
  CreateVoteSchema,
  Permissions,
  SubmitVoteBallotSchema,
  UpdateVoteSchema,
  VoteVoterMutationSchema,
  type CreateVoteRequest,
  type SubmitVoteBallotRequest,
  type UpdateVoteRequest,
  type VoteVoterMutationRequest,
} from "@soc/contracts";
import type { Request } from "express";

import { AuthGuard, OptionalAuthGuard, RequirePermissions } from "../auth/guards";
import { AuditLogService } from "../audit/audit-log.service";
import { ZodValidationPipe } from "../../shared/pipes/zod-validation.pipe";
import { VotesService } from "./votes.service";

interface AuthedRequest extends Request { user: { id: string; permission: number } }
interface OptionalAuthedRequest extends Request { user?: { id: string; permission: number } }

@Controller("votes")
export class VotesController {
  constructor(private readonly service: VotesService, private readonly audit: AuditLogService) {}

  @Get("public")
  listPublic() { return this.service.listPublic(); }

  @Get("admin")
  @RequirePermissions(Permissions.MANAGE_VOTE)
  listAdmin() { return this.service.listAll(); }

  @Post("admin")
  @RequirePermissions(Permissions.MANAGE_VOTE)
  async create(@Req() req: AuthedRequest, @Body(new ZodValidationPipe(CreateVoteSchema)) body: CreateVoteRequest) {
    const result = await this.service.create(req.user.id, body);
    await this.audit.record({ action: "vote.create", actorUserId: req.user.id, targetId: result.id, targetType: "vote" });
    return result;
  }

  @Get("admin/:id/voters")
  @RequirePermissions(Permissions.MANAGE_VOTE)
  voters(@Param("id", ParseUUIDPipe) id: string) { return this.service.listVoters(id); }

  @Post("admin/:id/voters")
  @RequirePermissions(Permissions.MANAGE_VOTE)
  async addVoters(@Param("id", ParseUUIDPipe) id: string, @Req() req: AuthedRequest, @Body(new ZodValidationPipe(VoteVoterMutationSchema)) body: VoteVoterMutationRequest) {
    const result = await this.service.addVoters(id, body);
    await this.audit.record({ action: "vote.voter.add", actorUserId: req.user.id, payload: result, targetId: id, targetType: "vote" });
    return result;
  }

  @Post("admin/:id/voters/exclude")
  @RequirePermissions(Permissions.MANAGE_VOTE)
  async excludeVoters(@Param("id", ParseUUIDPipe) id: string, @Req() req: AuthedRequest, @Body(new ZodValidationPipe(VoteVoterMutationSchema)) body: VoteVoterMutationRequest) {
    const result = await this.service.excludeVoters(id, body);
    await this.audit.record({ action: "vote.voter.exclude", actorUserId: req.user.id, payload: result, targetId: id, targetType: "vote" });
    return result;
  }

  @Patch("admin/:id")
  @RequirePermissions(Permissions.MANAGE_VOTE)
  async update(@Param("id", ParseUUIDPipe) id: string, @Req() req: AuthedRequest, @Body(new ZodValidationPipe(UpdateVoteSchema)) body: UpdateVoteRequest) {
    const result = await this.service.update(id, body);
    await this.audit.record({ action: "vote.update", actorUserId: req.user.id, targetId: id, targetType: "vote" });
    return result;
  }

  @Delete("admin/:id")
  @RequirePermissions(Permissions.MANAGE_VOTE)
  async delete(@Param("id", ParseUUIDPipe) id: string, @Req() req: AuthedRequest) {
    await this.service.delete(id);
    await this.audit.record({ action: "vote.delete", actorUserId: req.user.id, targetId: id, targetType: "vote" });
  }

  @Post("admin/:id/publish")
  @RequirePermissions(Permissions.MANAGE_VOTE)
  async publish(@Param("id", ParseUUIDPipe) id: string, @Req() req: AuthedRequest) {
    const result = await this.service.publish(id);
    await this.audit.record({ action: "vote.publish", actorUserId: req.user.id, payload: { eligibleCount: result.eligibleCount }, targetId: id, targetType: "vote" });
    return result;
  }

  @Post("admin/:id/close")
  @RequirePermissions(Permissions.MANAGE_VOTE)
  async close(@Param("id", ParseUUIDPipe) id: string, @Req() req: AuthedRequest) {
    const result = await this.service.close(id);
    await this.audit.record({ action: "vote.close", actorUserId: req.user.id, targetId: id, targetType: "vote" });
    return result;
  }

  @Post("admin/:id/tally")
  @RequirePermissions(Permissions.MANAGE_VOTE)
  async tally(@Param("id", ParseUUIDPipe) id: string, @Req() req: AuthedRequest) {
    const result = await this.service.tally(id);
    await this.audit.record({ action: "vote.tally", actorUserId: req.user.id, payload: { totalBallots: result.totalBallots }, targetId: id, targetType: "vote" });
    return result;
  }

  @Post("admin/:id/publish-results")
  @RequirePermissions(Permissions.MANAGE_VOTE)
  async publishResults(@Param("id", ParseUUIDPipe) id: string, @Req() req: AuthedRequest) {
    const result = await this.service.publishResults(id);
    await this.audit.record({ action: "vote.results.publish", actorUserId: req.user.id, targetId: id, targetType: "vote" });
    return result;
  }

  @Get(":id/results")
  @UseGuards(OptionalAuthGuard)
  results(@Param("id", ParseUUIDPipe) id: string, @Req() req: OptionalAuthedRequest) {
    return this.service.results(id, req.user);
  }

  @Get(":id/receipts/:code")
  verifyReceipt(@Param("id", ParseUUIDPipe) id: string, @Param("code") code: string) {
    return this.service.verifyReceipt(id, code);
  }

  @Post(":id/ballots")
  @UseGuards(AuthGuard)
  submit(@Param("id", ParseUUIDPipe) id: string, @Req() req: AuthedRequest, @Body(new ZodValidationPipe(SubmitVoteBallotSchema)) body: SubmitVoteBallotRequest) {
    return this.service.submit(id, req.user.id, body);
  }

  @Get(":id")
  @UseGuards(OptionalAuthGuard)
  detail(@Param("id", ParseUUIDPipe) id: string, @Req() req: OptionalAuthedRequest) {
    return this.service.detail(id, req.user);
  }
}
