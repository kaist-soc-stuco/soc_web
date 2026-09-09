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
import {
  PERMISSION_REGISTRY,
  Permissions,
} from "@soc/contracts";

import { AuditLogService } from "../audit/audit-log.service";
import { UsersService } from "../users/users.service";
import { RoleGroupsRepository } from "./role-groups.repository";

interface AuditMetadata {
  actorUserId?: string | null;
  ipAddress?: string | null;
}

/** Permissions that may not be delegated by a normal role manager. */
const RESERVED_DELEGATION_BITS =
  Permissions.MANAGE_ROLES |
  Permissions.MANAGE_USERS |
  Permissions.MANAGE_FINANCE |
  Permissions.MANAGE_CONTACTS |
  Permissions.SEND_BULK_EMAIL |
  Permissions.VIEW_AUDIT_LOG |
  Permissions.MANAGE_VOTE;

const normalizePermissionIds = (permissionIds: number[]): number[] =>
  [...new Set(permissionIds)];

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
    await this.assertPermissionDelegationAllowed(input.permissionIds, audit?.actorUserId);
    const created = await this.roleGroupsRepository.createRoleGroup(input);

    if (!created) {
      throw new NotFoundException("role_group_create_failed");
    }

    await this.auditLogService.record({
      action: "role_group.create",
      actorUserId: audit?.actorUserId ?? null,
      ipAddress: audit?.ipAddress ?? null,
      payload: {
        permissionIds: normalizePermissionIds(input.permissionIds),
        roleGroupId: created.roleGroupId,
      },
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

    await this.assertPermissionDelegationAllowed(input.permissionIds, audit?.actorUserId);

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
      payload: {
        changedFields: Object.keys(input),
        permissionIds: normalizePermissionIds(input.permissionIds),
        roleGroupId,
      },
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

    await this.assertRoleMutationAllowed(existing, audit?.actorUserId);

    const memberIds = (await this.roleGroupsRepository.listRoleGroupMembers(roleGroupId)).map(
      (member) => member.userId,
    );

    await this.roleGroupsRepository.deleteRoleGroup(roleGroupId);
    await this.usersService.invalidatePermissionCaches(memberIds);
    await this.auditLogService.record({
      action: "role_group.delete",
      actorUserId: audit?.actorUserId ?? null,
      ipAddress: audit?.ipAddress ?? null,
      payload: { memberIds, roleGroupId },
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

    await this.assertRoleMutationAllowed(roleGroup, audit?.actorUserId);
    if (input.userId === audit?.actorUserId) {
      throw new ForbiddenException("role_group_self_assignment_not_allowed");
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
      payload: {
        roleGroupId,
        userId: added.userId,
      },
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

    await this.assertRoleMutationAllowed(roleGroup, audit?.actorUserId);

    await this.roleGroupsRepository.removeUserFromRoleGroup(roleGroupId, userId);
    await this.usersService.invalidatePermissionCache(userId);
    await this.auditLogService.record({
      action: "role_group_member.remove",
      actorUserId: audit?.actorUserId ?? null,
      ipAddress: audit?.ipAddress ?? null,
      payload: { roleGroupId, userId },
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

    await this.assertRoleMutationAllowed(roleGroup, audit?.actorUserId);
    if (input.userIds.includes(audit?.actorUserId ?? "")) {
      throw new ForbiddenException("role_group_self_assignment_not_allowed");
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
      payload: { roleGroupId, userIds: [...new Set(input.userIds)] },
      targetId: String(roleGroupId),
      targetType: "role_group_member",
    });

    return replaced;
  }

  private async assertPermissionDelegationAllowed(
    permissionIds: number[],
    actorUserId?: string | null,
  ): Promise<void> {
    if (!actorUserId) {
      throw new ForbiddenException("role_manager_actor_required");
    }

    const activePermissions = await this.roleGroupsRepository.listPermissions();
    const permissionById = new Map(
      activePermissions
        .filter((permission) => permission.isActive)
        .map((permission) => [permission.permissionId, permission]),
    );
    const normalizedIds = normalizePermissionIds(permissionIds);
    const unknownPermission = normalizedIds.find((permissionId) => !permissionById.has(permissionId));
    if (unknownPermission !== undefined) {
      throw new BadRequestException("role_permission_inactive_or_unknown");
    }

    const requestedMask = normalizedIds.reduce(
      (mask, permissionId) => mask | Number(permissionById.get(permissionId)?.bitValue ?? 0),
      0,
    );
    await this.assertPermissionMaskDelegationAllowed(requestedMask, actorUserId);
  }

  private async assertPermissionMaskDelegationAllowed(
    requestedMask: number,
    actorUserId: string,
  ): Promise<void> {
    if (await this.roleGroupsRepository.isSystemAdministrator(actorUserId)) return;

    const actorMask = await this.usersService.resolvePermissionBitmaskByUserId(actorUserId);
    const delegableActorMask = actorMask & ~RESERVED_DELEGATION_BITS;
    if ((requestedMask & RESERVED_DELEGATION_BITS) !== 0 || (requestedMask & ~delegableActorMask) !== 0) {
      throw new ForbiddenException("role_permission_delegation_not_allowed");
    }
  }

  private async assertRoleMutationAllowed(
    roleGroup: RoleGroupRecord,
    actorUserId?: string | null,
  ): Promise<void> {
    if (!actorUserId) {
      throw new ForbiddenException("role_manager_actor_required");
    }

    if (roleGroup.isSystem) {
      const isSystemAdministrator =
        await this.roleGroupsRepository.isSystemAdministrator(actorUserId);
      if (!isSystemAdministrator) {
        throw new ForbiddenException("system_role_group_requires_system_administrator");
      }
      return;
    }

    await this.assertPermissionMaskDelegationAllowed(roleGroup.permissionMask, actorUserId);
  }
}
