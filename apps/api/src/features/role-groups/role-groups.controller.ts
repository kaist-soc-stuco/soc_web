import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Req, UseGuards } from "@nestjs/common";
import { Request } from "express";

import { AuthGuard, PermissionGuard, RequirePermission } from "../../shared/guards";
import { PermissionFlags } from "../../shared/guards/permission.guard";

import { CreateRoleGroupDto } from "./dto/create-role-group.dto";
import { UpdateRoleGroupDto } from "./dto/update-role-group.dto";
import { RoleGroupsService } from "./role-groups.service";

@Controller("role-groups")
@UseGuards(AuthGuard, PermissionGuard)
@RequirePermission(PermissionFlags.ADMIN)
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
  create(@Body() dto: CreateRoleGroupDto) {
    return this.roleGroupsService.createRoleGroup(dto);
  }

  @Patch(":roleGroupId")
  update(
    @Param("roleGroupId", ParseIntPipe) roleGroupId: number,
    @Body() dto: UpdateRoleGroupDto,
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
    @Body("userId", ParseIntPipe) userId: number,
    @Req() request: Request & { user?: { id: string } },
  ) {
    return this.roleGroupsService.addUserToRoleGroup(
      roleGroupId,
      { userId },
      request.user ? Number(request.user.id) : undefined,
    );
  }

  @Delete(":roleGroupId/users/:userId")
  removeMember(
    @Param("roleGroupId", ParseIntPipe) roleGroupId: number,
    @Param("userId", ParseIntPipe) userId: number,
  ) {
    return this.roleGroupsService.removeUserFromRoleGroup(roleGroupId, userId);
  }

  @Delete(":roleGroupId")
  delete(@Param("roleGroupId", ParseIntPipe) roleGroupId: number) {
    return this.roleGroupsService.deleteRoleGroup(roleGroupId);
  }
}