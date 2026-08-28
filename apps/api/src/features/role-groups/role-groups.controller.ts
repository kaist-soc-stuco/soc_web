import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Put, Query, Req } from "@nestjs/common";
import { CreateRoleGroupSchema, UpdateRoleGroupSchema, AssignRoleGroupMemberSchema, ReplaceRoleGroupMembersSchema } from "@soc/contracts";
import { Permissions } from "@soc/contracts";
import type { AssignRoleGroupMemberRequest, ReplaceRoleGroupMembersRequest } from "@soc/contracts";
import { Request } from "express";

import { RequireAnyPermissions, RequirePermissions } from "../auth/guards";
import { ZodValidationPipe } from "../../shared/pipes/zod-validation.pipe";

import { CreateRoleGroupDto } from "./dto/create-role-group.dto";
import { UpdateRoleGroupDto } from "./dto/update-role-group.dto";
import { RoleGroupsService } from "./role-groups.service";

type AuthenticatedRequest = Request & {
  user?: { id: string };
};

@Controller("role-groups")
@RequireAnyPermissions(Permissions.MANAGE_PERMISSIONS, Permissions.MANAGE_BOARD_SETTINGS)
export class RoleGroupsController {
  constructor(private readonly roleGroupsService: RoleGroupsService) {}

  @Get("permissions")
  listPermissions() {
    return this.roleGroupsService.listPermissions();
  }

  @Get()
  listRoleGroups() {
    return this.roleGroupsService.listRoleGroups();
  }

  @Post()
  @RequirePermissions(Permissions.MANAGE_PERMISSIONS)
  create(
    @Body(new ZodValidationPipe(CreateRoleGroupSchema)) dto: CreateRoleGroupDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.roleGroupsService.createRoleGroup(dto, {
      actorUserId: request.user?.id,
      ipAddress: request.ip,
    });
  }

  @Patch(":roleGroupId")
  @RequirePermissions(Permissions.MANAGE_PERMISSIONS)
  update(
    @Param("roleGroupId", ParseIntPipe) roleGroupId: number,
    @Body(new ZodValidationPipe(UpdateRoleGroupSchema)) dto: UpdateRoleGroupDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.roleGroupsService.updateRoleGroup(roleGroupId, dto, {
      actorUserId: request.user?.id,
      ipAddress: request.ip,
    });
  }

  @Get(":roleGroupId/users")
  @RequirePermissions(Permissions.MANAGE_PERMISSIONS)
  listMembers(@Param("roleGroupId", ParseIntPipe) roleGroupId: number) {
    return this.roleGroupsService.listRoleGroupMembers(roleGroupId);
  }

  @Get(":roleGroupId/users/candidates")
  @RequirePermissions(Permissions.MANAGE_PERMISSIONS)
  listCandidates(
    @Param("roleGroupId", ParseIntPipe) roleGroupId: number,
    @Query("q") q?: string,
    @Query("academicStatus") academicStatus?: string,
    @Query("status") status?: string,
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string,
  ) {
    return this.roleGroupsService.listRoleGroupCandidates(roleGroupId, {
      q,
      academicStatus,
      status: status === "active" || status === "inactive" ? status : undefined,
      page: page ? Number(page) : 1,
      pageSize: pageSize ? Number(pageSize) : 20,
    });
  }

  @Post(":roleGroupId/users")
  @RequirePermissions(Permissions.MANAGE_PERMISSIONS)
  addMember(
    @Param("roleGroupId", ParseIntPipe) roleGroupId: number,
    @Body(new ZodValidationPipe(AssignRoleGroupMemberSchema))
    dto: AssignRoleGroupMemberRequest,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.roleGroupsService.addUserToRoleGroup(roleGroupId, dto, {
      actorUserId: request.user?.id,
      ipAddress: request.ip,
    });
  }

  @Put(":roleGroupId/users")
  @RequirePermissions(Permissions.MANAGE_PERMISSIONS)
  replaceMembers(
    @Param("roleGroupId", ParseIntPipe) roleGroupId: number,
    @Body(new ZodValidationPipe(ReplaceRoleGroupMembersSchema))
    dto: ReplaceRoleGroupMembersRequest,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.roleGroupsService.replaceRoleGroupMembers(roleGroupId, dto, {
      actorUserId: request.user?.id,
      ipAddress: request.ip,
    });
  }

  @Delete(":roleGroupId/users/:userId")
  @RequirePermissions(Permissions.MANAGE_PERMISSIONS)
  removeMember(
    @Param("roleGroupId", ParseIntPipe) roleGroupId: number,
    @Param("userId") userId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.roleGroupsService.removeUserFromRoleGroup(roleGroupId, userId, {
      actorUserId: request.user?.id,
      ipAddress: request.ip,
    });
  }

  @Delete(":roleGroupId")
  @RequirePermissions(Permissions.MANAGE_PERMISSIONS)
  delete(
    @Param("roleGroupId", ParseIntPipe) roleGroupId: number,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.roleGroupsService.deleteRoleGroup(roleGroupId, {
      actorUserId: request.user?.id,
      ipAddress: request.ip,
    });
  }
}
