const assert = require("node:assert/strict");
const test = require("node:test");
const { ForbiddenException } = require("@nestjs/common");
const { PERMISSION_REGISTRY, Permissions } = require("@soc/contracts");

const { RoleGroupsService } = require("../dist/apps/api/src/features/role-groups/role-groups.service.js");

const permissionRecords = PERMISSION_REGISTRY.map((permission, index) => ({
  bitValue: permission.bit,
  code: permission.code,
  description: permission.description,
  isActive: true,
  nameEn: permission.labelEn,
  nameKo: permission.labelKo,
  permissionId: index + 1,
}));

const permissionIdFor = (bit) =>
  permissionRecords.find((permission) => permission.bitValue === bit).permissionId;

function createHarness({ actorMask = Permissions.MANAGE_ROLES, systemAdmin = false, target } = {}) {
  const calls = { create: 0, add: 0, audit: [] };
  const repository = {
    listPermissions: async () => permissionRecords,
    isSystemAdministrator: async () => systemAdmin,
    createRoleGroup: async (input) => {
      calls.create += 1;
      return {
        createdAt: "2026-09-08T00:00:00.000Z",
        description: input.description ?? null,
        isSystem: false,
        nameKo: input.nameKo,
        permissionIds: input.permissionIds,
        permissionMask: input.permissionIds.reduce(
          (mask, id) => mask | permissionRecords.find((permission) => permission.permissionId === id).bitValue,
          0,
        ),
        roleGroupId: 7,
        updatedAt: "2026-09-08T00:00:00.000Z",
        userCount: 0,
      };
    },
    findRoleGroupById: async () => target ?? null,
    listRoleGroupMembers: async () => [],
    addUserToRoleGroup: async (roleGroupId, input) => {
      calls.add += 1;
      return { roleGroupId, userId: input.userId };
    },
  };
  const usersService = {
    resolvePermissionBitmaskByUserId: async () => actorMask,
    findById: async (userId) => ({ userId }),
    invalidatePermissionCache: async () => {},
    invalidatePermissionCaches: async () => {},
  };
  const auditLogService = { record: async (input) => calls.audit.push(input) };
  return { calls, service: new RoleGroupsService(repository, usersService, auditLogService) };
}

test("MANAGE_ROLES-only users cannot grant reserved or powerful permissions", async () => {
  const { calls, service } = createHarness();

  await assert.rejects(
    service.createRoleGroup(
      { nameKo: "승격 역할", permissionIds: [permissionIdFor(Permissions.MANAGE_USERS)] },
      { actorUserId: "manager" },
    ),
    (error) => error instanceof ForbiddenException && error.message === "role_permission_delegation_not_allowed",
  );
  assert.equal(calls.create, 0);

  const powerfulRole = {
    isSystem: false,
    permissionMask: Permissions.MANAGE_FINANCE,
    roleGroupId: 8,
  };
  const second = createHarness({ target: powerfulRole });
  await assert.rejects(
    second.service.addUserToRoleGroup(8, { userId: "victim" }, { actorUserId: "manager" }),
    (error) => error instanceof ForbiddenException && error.message === "role_permission_delegation_not_allowed",
  );
  assert.equal(second.calls.add, 0);
});

test("delegated managers can grant only non-reserved permissions they hold", async () => {
  const { calls, service } = createHarness({ actorMask: Permissions.MANAGE_ROLES | Permissions.WRITE_OFFICIAL });
  const created = await service.createRoleGroup(
    { nameKo: "공지 작성자", permissionIds: [permissionIdFor(Permissions.WRITE_OFFICIAL)] },
    { actorUserId: "manager" },
  );

  assert.equal(calls.create, 1);
  assert.equal(created.permissionMask, Permissions.WRITE_OFFICIAL);
});

test("only an explicitly provisioned system administrator can mutate system roles", async () => {
  const target = { isSystem: true, permissionMask: Permissions.MANAGE_USERS, roleGroupId: 9 };
  const delegated = createHarness({ target });
  await assert.rejects(
    delegated.service.addUserToRoleGroup(9, { userId: "victim" }, { actorUserId: "manager" }),
    (error) => error instanceof ForbiddenException && error.message === "system_role_group_requires_system_administrator",
  );

  const administrator = createHarness({ target, systemAdmin: true });
  await administrator.service.addUserToRoleGroup(9, { userId: "victim" }, { actorUserId: "admin" });
  assert.equal(administrator.calls.add, 1);
  assert.deepEqual(administrator.calls.audit[0].payload, { roleGroupId: 9, userId: "victim" });
});
