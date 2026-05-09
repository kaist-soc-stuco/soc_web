import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, UseGuards } from "@nestjs/common";

import { AuthGuard, PermissionGuard, RequirePermission } from "../../shared/guards";
import { PermissionFlags } from "../../shared/guards/permission.guard";

import { CreateRoleGroupDto } from "./dto/create-role-group.dto";
import { UpdateRoleGroupDto } from "./dto/update-role-group.dto";
import { RoleGroupsService } from "./role-groups.service";

@Controller("role-groups")
@UseGuards(AuthGuard, PermissionGuard)
@RequirePermission(PermissionFlags.SURVEY_MANAGE)
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

  @Delete(":roleGroupId")
  delete(@Param("roleGroupId", ParseIntPipe) roleGroupId: number) {
    return this.roleGroupsService.deleteRoleGroup(roleGroupId);
  }
}