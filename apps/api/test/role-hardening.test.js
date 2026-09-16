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
  const calls = { create: 0, add: 0, replace: 0, update: 0, invalidated: [], audit: [] };
  const repository = {
    listPermissions: async () => permissionRecords,
    listRoleGroups: async () => target ? [target] : [],
    updateRoleGroup: async (id, input) => { calls.update++; return { ...target, ...input, roleGroupId: id }; },
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
    replaceRoleGroupMembers: async (roleGroupId, userIds) => {
      calls.replace += 1;
      return userIds.map((userId) => ({ roleGroupId, userId }));
    },
  };
  const usersService = {
    resolvePermissionBitmaskByUserId: async () => actorMask,
    findById: async (userId) => ({ userId }),
    invalidatePermissionCache: async () => {},
    invalidatePermissionCaches: async (ids) => { calls.invalidated.push(ids); },
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

test("role managers can add themselves to a delegable role", async () => {
  const target = {
    isSystem: false,
    permissionMask: Permissions.WRITE_OFFICIAL,
    roleGroupId: 10,
  };
  const { calls, service } = createHarness({
    actorMask: Permissions.MANAGE_ROLES | Permissions.WRITE_OFFICIAL,
    target,
  });

  await service.addUserToRoleGroup(
    target.roleGroupId,
    { userId: "manager" },
    { actorUserId: "manager" },
  );
  await service.replaceRoleGroupMembers(
    target.roleGroupId,
    { userIds: ["manager"] },
    { actorUserId: "manager" },
  );

  assert.equal(calls.add, 1);
  assert.equal(calls.replace, 1);
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

for (const targetMask of [Permissions.MANAGE_FINANCE, Permissions.MANAGE_USERS, Permissions.WRITE_OFFICIAL]) {
  test(`role managers cannot strip unowned existing permissions (${targetMask})`, async () => {
    const { service, calls } = createHarness({ target: { isSystem: false, permissionMask: targetMask, roleGroupId: 8 } });
    for (const permissionIds of [[], [permissionIdFor(Permissions.WRITE_LAB)]]) {
      await assert.rejects(service.updateRoleGroup(8, { nameKo: "변경", permissionIds }, { actorUserId: "manager" }), ForbiddenException);
    }
    assert.equal(calls.update, 0);
    assert.deepEqual(calls.invalidated, []);
    assert.deepEqual(calls.audit, []);
  });
}

test("delegated managers can clear their own delegable role; administrators can clear protected non-system roles", async () => {
  for (const systemAdmin of [false, true]) {
    const target = { isSystem: false, permissionMask: systemAdmin ? Permissions.MANAGE_FINANCE : Permissions.WRITE_OFFICIAL, roleGroupId: 8 };
    const { service, calls } = createHarness({ systemAdmin, actorMask: Permissions.MANAGE_ROLES | Permissions.WRITE_OFFICIAL, target });
    await service.updateRoleGroup(8, { nameKo: "변경", permissionIds: [] }, { actorUserId: "manager" });
    assert.equal(calls.update, 1);
    assert.equal(calls.invalidated.length, 1);
    assert.equal(calls.audit[0].action, "role_group.update");
  }
});

test("system roles remain uneditable even for system administrators", async () => {
  const { service, calls } = createHarness({ systemAdmin: true, target: { isSystem: true, permissionMask: Permissions.MANAGE_USERS, roleGroupId: 9 } });
  await assert.rejects(service.updateRoleGroup(9, { nameKo: "변경", permissionIds: [] }, { actorUserId: "admin" }), /system_role_group_cannot_be_updated/);
  assert.equal(calls.update, 0);
});

test("permission and role capabilities expose the actual delegation boundary", async () => {
  const target = { isSystem: false, permissionMask: Permissions.MANAGE_FINANCE, roleGroupId: 8 };
  const { service } = createHarness({ actorMask: Permissions.MANAGE_ROLES | Permissions.WRITE_OFFICIAL | Permissions.WRITE_LAB, target });
  const permissions = await service.listPermissions("manager");
  assert.equal(permissions.find(p => p.code === "WRITE_OFFICIAL").canDelegate, true);
  assert.equal(permissions.find(p => p.code === "MANAGE_FINANCE").canDelegate, false);
  assert.equal(permissions.find(p => p.code === "WRITE_LAB").isBaseline, true);
  assert.equal((await service.listRoleGroups("manager"))[0].canEdit, false);
  assert.equal((await service.listRoleGroups("manager"))[0].canManageMembers, false);
  const admin = createHarness({ systemAdmin: true, target });
  assert.equal((await admin.service.listRoleGroups("admin"))[0].canEdit, true);
});
