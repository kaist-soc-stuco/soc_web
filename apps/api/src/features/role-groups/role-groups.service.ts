import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";

import type {
  CreateRoleGroupRequest,
  PermissionRecord,
  RoleGroupRecord,
  UpdateRoleGroupRequest,
} from "@soc/contracts";

import { RoleGroupsRepository } from "./role-groups.repository";

@Injectable()
export class RoleGroupsService {
  constructor(private readonly roleGroupsRepository: RoleGroupsRepository) {}

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
}