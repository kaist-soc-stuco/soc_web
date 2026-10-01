const assert = require("node:assert/strict");
const test = require("node:test");
const { ContactsService } = require("../dist/apps/api/src/features/contacts/contacts.service.js");

test("deleting a department removes only its catalog entry and retains the audit snapshot", async () => {
  const department = { id: "department-2025", nameKo: "2025 홍보부", isActive: true };
  const calls = [];
  const service = new ContactsService({
    findDepartmentById: async () => department,
    deleteDepartment: async (id) => { calls.push(id); return true; },
    findManaged: async () => { throw new Error("Existing members must not prevent catalog deletion"); },
  }, { record: async (entry) => calls.push(entry) }, {}, { enqueueSync: async () => calls.push("sync") });
  await service.deleteDepartment(department.id, { actorUserId: "admin" });
  assert.equal(calls[0], department.id);
  assert.equal(calls[1].payload.deleted.nameKo, department.nameKo);
  assert.equal(calls[1].actorUserId, "admin");
  assert.equal(calls[2], "sync");
});

test("deleting an unknown department reports not found before writing", async () => {
  const service = new ContactsService({ findDepartmentById: async () => null }, {}, {}, {});
  await assert.rejects(service.deleteDepartment("missing"), error => error.getStatus() === 404);
});
