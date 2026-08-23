import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";

import type {
  AssignRoleGroupMemberRequest,
  CreateRoleGroupRequest,
  PermissionRecord,
  RoleGroupRecord,
  RoleGroupMemberRecord,
  RoleGroupCandidateListResponse,
  RoleGroupMemberFilterRequest,
  ReplaceRoleGroupMembersRequest,
  UpdateRoleGroupRequest,
} from "@soc/contracts";

import { AuditLogService } from "../audit/audit-log.service";
import { UsersService } from "../users/users.service";
import { RoleGroupsRepository } from "./role-groups.repository";

interface AuditMetadata {
  actorUserId?: string | null;
  ipAddress?: string | null;
}

@Injectable()
export class RoleGroupsService {
  constructor(
    private readonly roleGroupsRepository: RoleGroupsRepository,
    private readonly usersService: UsersService,
    private readonly auditLogService: AuditLogService,
  ) {}

  async listPermissions(): Promise<PermissionRecord[]> {
    return this.roleGroupsRepository.listPermissions();
  }

  async listRoleGroups(): Promise<RoleGroupRecord[]> {
    return this.roleGroupsRepository.listRoleGroups();
  }

  async createRoleGroup(
    input: CreateRoleGroupRequest,
    audit?: AuditMetadata,
  ): Promise<RoleGroupRecord> {
    const created = await this.roleGroupsRepository.createRoleGroup(input);

    if (!created) {
      throw new NotFoundException("role_group_create_failed");
    }

    await this.auditLogService.record({
      action: "role_group.create",
      actorUserId: audit?.actorUserId ?? null,
      ipAddress: audit?.ipAddress ?? null,
      payload: { created, input },
      targetId: created.roleGroupId,
      targetType: "role_group",
    });

    return created;
  }

  async updateRoleGroup(
    roleGroupId: number,
    input: UpdateRoleGroupRequest,
    audit?: AuditMetadata,
  ): Promise<RoleGroupRecord> {
    const existing = await this.roleGroupsRepository.findRoleGroupById(roleGroupId);

    if (!existing) {
      throw new NotFoundException("role_group_not_found");
    }

    if (existing.isSystem) {
      throw new ForbiddenException("system_role_group_cannot_be_updated");
    }

    const memberIds = (await this.roleGroupsRepository.listRoleGroupMembers(roleGroupId)).map(
      (member) => member.userId,
    );
    const updated = await this.roleGroupsRepository.updateRoleGroup(roleGroupId, input);

    if (!updated) {
      throw new NotFoundException("role_group_not_found");
    }

    await this.usersService.invalidatePermissionCaches(memberIds);

    await this.auditLogService.record({
      action: "role_group.update",
      actorUserId: audit?.actorUserId ?? null,
      ipAddress: audit?.ipAddress ?? null,
      payload: { after: updated, before: existing, input },
      targetId: roleGroupId,
      targetType: "role_group",
    });

    return updated;
  }

  async deleteRoleGroup(roleGroupId: number, audit?: AuditMetadata): Promise<void> {
    const existing = await this.roleGroupsRepository.findRoleGroupById(roleGroupId);

    if (!existing) {
      throw new NotFoundException("role_group_not_found");
    }

    if (existing.isSystem) {
      throw new ForbiddenException("system_role_group_cannot_be_deleted");
    }

    const memberIds = (await this.roleGroupsRepository.listRoleGroupMembers(roleGroupId)).map(
      (member) => member.userId,
    );

    await this.roleGroupsRepository.deleteRoleGroup(roleGroupId);
    await this.usersService.invalidatePermissionCaches(memberIds);
    await this.auditLogService.record({
      action: "role_group.delete",
      actorUserId: audit?.actorUserId ?? null,
      ipAddress: audit?.ipAddress ?? null,
      payload: { deleted: existing, memberIds },
      targetId: roleGroupId,
      targetType: "role_group",
    });
  }

  async listRoleGroupMembers(roleGroupId: number): Promise<RoleGroupMemberRecord[]> {
    const existing = await this.roleGroupsRepository.findRoleGroupById(roleGroupId);

    if (!existing) {
      throw new NotFoundException("role_group_not_found");
    }

    return this.roleGroupsRepository.listRoleGroupMembers(roleGroupId);
  }

  async listRoleGroupCandidates(
    roleGroupId: number,
    input: RoleGroupMemberFilterRequest,
  ): Promise<RoleGroupCandidateListResponse> {
    const existing = await this.roleGroupsRepository.findRoleGroupById(roleGroupId);
    if (!existing) {
      throw new NotFoundException("role_group_not_found");
    }

    return this.roleGroupsRepository.listRoleGroupCandidates(roleGroupId, input);
  }

  async addUserToRoleGroup(
    roleGroupId: number,
    input: AssignRoleGroupMemberRequest,
    audit?: AuditMetadata,
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
      grantedBy: audit?.actorUserId ?? null,
      userId: input.userId,
    });

    if (!added) {
      throw new NotFoundException("role_group_member_add_failed");
    }

    await this.usersService.invalidatePermissionCache(added.userId);
    await this.auditLogService.record({
      action: "role_group_member.add",
      actorUserId: audit?.actorUserId ?? null,
      ipAddress: audit?.ipAddress ?? null,
      payload: { added, input, roleGroup },
      targetId: `${roleGroupId}:${added.userId}`,
      targetType: "role_group_member",
    });

    return added;
  }

  async removeUserFromRoleGroup(
    roleGroupId: number,
    userId: string,
    audit?: AuditMetadata,
  ): Promise<void> {
    const roleGroup = await this.roleGroupsRepository.findRoleGroupById(roleGroupId);
    if (!roleGroup) {
      throw new NotFoundException("role_group_not_found");
    }

    await this.roleGroupsRepository.removeUserFromRoleGroup(roleGroupId, userId);
    await this.usersService.invalidatePermissionCache(userId);
    await this.auditLogService.record({
      action: "role_group_member.remove",
      actorUserId: audit?.actorUserId ?? null,
      ipAddress: audit?.ipAddress ?? null,
      payload: { roleGroup, userId },
      targetId: `${roleGroupId}:${userId}`,
      targetType: "role_group_member",
    });
  }

  async replaceRoleGroupMembers(
    roleGroupId: number,
    input: ReplaceRoleGroupMembersRequest,
    audit?: AuditMetadata,
  ): Promise<RoleGroupMemberRecord[]> {
    const roleGroup = await this.roleGroupsRepository.findRoleGroupById(roleGroupId);
    if (!roleGroup) {
      throw new NotFoundException("role_group_not_found");
    }

    const before = await this.roleGroupsRepository.listRoleGroupMembers(roleGroupId);
    const replaced = await this.roleGroupsRepository.replaceRoleGroupMembers(
      roleGroupId,
      input.userIds,
      audit?.actorUserId ?? null,
    );
    if (!replaced) {
      throw new BadRequestException("role_group_user_not_found");
    }

    await this.usersService.invalidatePermissionCaches([
      ...before.map((member) => member.userId),
      ...input.userIds,
    ]);
    await this.auditLogService.record({
      action: "role_group_member.replace",
      actorUserId: audit?.actorUserId ?? null,
      ipAddress: audit?.ipAddress ?? null,
      payload: { roleGroup, userIds: input.userIds },
      targetId: String(roleGroupId),
      targetType: "role_group_member",
    });

    return replaced;
  }
}
