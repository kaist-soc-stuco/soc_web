import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Req } from "@nestjs/common";
import { CreateRoleGroupSchema, UpdateRoleGroupSchema, AssignRoleGroupMemberSchema } from "@soc/contracts";
import { Permissions } from "@soc/contracts";
import { Request } from "express";

import { RequirePermissions } from "../../shared/guards";
import { ZodValidationPipe } from "../../shared/pipes/zod-validation.pipe";

import { CreateRoleGroupDto } from "./dto/create-role-group.dto";
import { UpdateRoleGroupDto } from "./dto/update-role-group.dto";
import { RoleGroupsService } from "./role-groups.service";

@Controller("role-groups")
@RequirePermissions(Permissions.ADMIN)
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
  create(@Body(new ZodValidationPipe(CreateRoleGroupSchema)) dto: CreateRoleGroupDto) {
    return this.roleGroupsService.createRoleGroup(dto);
  }

  @Patch(":roleGroupId")
  update(
    @Param("roleGroupId", ParseIntPipe) roleGroupId: number,
    @Body(new ZodValidationPipe(UpdateRoleGroupSchema)) dto: UpdateRoleGroupDto,
  ) {
    return this.roleGroupsService.updateRoleGroup(roleGroupId, dto);
  }

  @Get(":roleGroupId/users")
  listMembers(@Param("roleGroupId", ParseIntPipe) roleGroupId: number) {
    return this.roleGroupsService.listRoleGroupMembers(roleGroupId);
  }

  @Post(":roleGroupId/users")
  addMember(
    @Param("roleGroupId", ParseIntPipe) roleGroupId: number,
    @Body("userId") userId: string,
    @Req() request: Request & { user?: { id: string } },
  ) {
    return this.roleGroupsService.addUserToRoleGroup(
      roleGroupId,
      { userId },
      request.user?.id,
    );
  }

  @Delete(":roleGroupId/users/:userId")
  removeMember(
    @Param("roleGroupId", ParseIntPipe) roleGroupId: number,
    @Param("userId") userId: string,
  ) {
    return this.roleGroupsService.removeUserFromRoleGroup(roleGroupId, userId);
  }

  @Delete(":roleGroupId")
  delete(@Param("roleGroupId", ParseIntPipe) roleGroupId: number) {
    return this.roleGroupsService.deleteRoleGroup(roleGroupId);
  }
}