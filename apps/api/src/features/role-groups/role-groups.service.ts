import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";

import type {
  AssignRoleGroupMemberRequest,
  CreateRoleGroupRequest,
  PermissionRecord,
  RoleGroupRecord,
  RoleGroupMemberRecord,
  UpdateRoleGroupRequest,
} from "@soc/contracts";

import { UsersService } from "../users/users.service";
import { RoleGroupsRepository } from "./role-groups.repository";

@Injectable()
export class RoleGroupsService {
  constructor(
    private readonly roleGroupsRepository: RoleGroupsRepository,
    private readonly usersService: UsersService,
  ) {}

  async listPermissions(): Promise<PermissionRecord[]> {
    return this.roleGroupsRepository.listPermissions();
  }

  async listRoleGroups(): Promise<RoleGroupRecord[]> {
    return this.roleGroupsRepository.listRoleGroups();
  }

  async createRoleGroup(input: CreateRoleGroupRequest): Promise<RoleGroupRecord> {
    const created = await this.roleGroupsRepository.createRoleGroup(input);

    if (!created) {
      throw new NotFoundException("role_group_create_failed");
    }

    return created;
  }

  async updateRoleGroup(
    roleGroupId: number,
    input: UpdateRoleGroupRequest,
  ): Promise<RoleGroupRecord> {
    const updated = await this.roleGroupsRepository.updateRoleGroup(roleGroupId, input);

    if (!updated) {
      throw new NotFoundException("role_group_not_found");
    }

    return updated;
  }

  async deleteRoleGroup(roleGroupId: number): Promise<void> {
    const existing = await this.roleGroupsRepository.findRoleGroupById(roleGroupId);

    if (!existing) {
      throw new NotFoundException("role_group_not_found");
    }

    if (existing.isSystem) {
      throw new ForbiddenException("system_role_group_cannot_be_deleted");
    }

    await this.roleGroupsRepository.deleteRoleGroup(roleGroupId);
  }

  async listRoleGroupMembers(roleGroupId: number): Promise<RoleGroupMemberRecord[]> {
    const existing = await this.roleGroupsRepository.findRoleGroupById(roleGroupId);

    if (!existing) {
      throw new NotFoundException("role_group_not_found");
    }

    return this.roleGroupsRepository.listRoleGroupMembers(roleGroupId);
  }

  async addUserToRoleGroup(
    roleGroupId: number,
    input: AssignRoleGroupMemberRequest,
    grantedByUserId?: number,
  ): Promise<RoleGroupMemberRecord> {
    const roleGroup = await this.roleGroupsRepository.findRoleGroupById(roleGroupId);
    if (!roleGroup) {
      throw new NotFoundException("role_group_not_found");
    }

    const user = await this.usersService.findById(String(input.userId));
    if (!user) {
      throw new NotFoundException("user_not_found");
    }

    const added = await this.roleGroupsRepository.addUserToRoleGroup(roleGroupId, {
      grantedBy: grantedByUserId ?? null,
      userId: input.userId,
    });

    if (!added) {
      throw new NotFoundException("role_group_member_add_failed");
    }

    return added;
  }

  async removeUserFromRoleGroup(roleGroupId: number, userId: string): Promise<void> {
    const roleGroup = await this.roleGroupsRepository.findRoleGroupById(roleGroupId);
    if (!roleGroup) {
      throw new NotFoundException("role_group_not_found");
    }

    await this.roleGroupsRepository.removeUserFromRoleGroup(roleGroupId, userId);
  }
}