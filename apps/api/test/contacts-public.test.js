const assert = require("node:assert/strict");
const test = require("node:test");

const {
  ContactsService,
} = require("../dist/apps/api/src/features/contacts/contacts.service.js");

const fullContact = {
  id: "contact-1",
  nameKo: "합성 담당자",
  nameEn: "Synthetic Contact",
  departmentKo: "회장단",
  departmentEn: "Presidium",
  roleKo: "회장",
  roleEn: "President",
  studentNumber: "20260001",
  cohort: 26,
  email: "private@example.test",
  phoneNumber: "010-0000-0000",
  privacyConsented: true,
  publiclyListed: true,
  sortOrder: 1,
  createdAt: "2026-09-08T00:00:00.000Z",
  updatedAt: "2026-09-08T00:00:00.000Z",
};

test("retired public contacts stay empty while managed contacts remain available", async () => {
  const { ContactsRepository } = require("../dist/apps/api/src/features/contacts/contacts.repository.js");
  const publicRepository = new ContactsRepository({ select() { throw new Error("Public endpoint must not query contacts"); } });
  const service = new ContactsService({
    purgeRevoked: async () => 0,
    findPublic: () => publicRepository.findPublic(),
    findPublicDepartments: () => publicRepository.findPublicDepartments(),
    findManaged: async () => ({ items: [fullContact], total: 1, page: 1, pageSize: 1 }),
  }, { record: async () => undefined }, {}, {});
  assert.deepEqual(await service.findPublic(), { items: [] });
  assert.deepEqual(await service.findPublicDepartments(), { items: [] });
  const managed = await service.findManaged({ page: 1, pageSize: 1 });
  assert.equal(managed.items[0].email, "private@example.test");
});
