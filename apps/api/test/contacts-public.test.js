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

test("public contacts return only the separately approved organization fields", async () => {
  const repository = {
    purgeRevoked: async () => 0,
    findPublic: async () => ({
      items: [{
        nameKo: fullContact.nameKo,
        nameEn: fullContact.nameEn,
        departmentKo: fullContact.departmentKo,
        departmentEn: fullContact.departmentEn,
        roleKo: fullContact.roleKo,
        roleEn: fullContact.roleEn,
        sortOrder: fullContact.sortOrder,
      }],
    }),
    findManaged: async () => ({ items: [fullContact], total: 1, page: 1, pageSize: 1 }),
  };
  const service = new ContactsService(
    repository,
    { record: async () => undefined },
    {},
    {},
  );

  const publicResponse = await service.findPublic();
  const publicJson = JSON.stringify(publicResponse);
  assert.deepEqual(Object.keys(publicResponse.items[0]).sort(), [
    "departmentEn",
    "departmentKo",
    "nameEn",
    "nameKo",
    "roleEn",
    "roleKo",
    "sortOrder",
  ]);
  for (const sensitive of [
    "20260001",
    "private@example.test",
    "010-0000-0000",
    "privacyConsented",
    "createdAt",
    "updatedAt",
    "cohort",
  ]) {
    assert.equal(publicJson.includes(sensitive), false, `${sensitive} leaked`);
  }

  const managedResponse = await service.findManaged({ page: 1, pageSize: 1 });
  assert.equal(JSON.stringify(managedResponse).includes("private@example.test"), true);
});
