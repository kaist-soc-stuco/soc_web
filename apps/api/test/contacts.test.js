const assert = require("node:assert/strict");
const test = require("node:test");

const {
  CreateContactSchema,
  UpdateContactSchema,
} = require("@soc/contracts");
const {
  ContactsRepository,
} = require("../dist/apps/api/src/features/contacts/contacts.repository.js");

const contactRow = {
  id: "5eb16720-3c57-4ee7-b4c1-fb6b9c6b9901",
  nameKo: "홍길동",
  nameEn: "Hong Gildong",
  roleKo: "회장",
  roleEn: "President",
  email: null,
  phoneNumber: null,
  sortOrder: 0,
  createdAt: new Date("2026-07-15T00:00:00.000Z"),
  updatedAt: new Date("2026-07-15T01:00:00.000Z"),
};

test("contact creation requires complete non-blank bilingual identity fields", () => {
  assert.deepEqual(
    CreateContactSchema.parse({
      nameKo: "  홍길동  ",
      nameEn: "  Hong Gildong  ",
      roleKo: "  회장  ",
      roleEn: "  President  ",
    }),
    {
      nameKo: "홍길동",
      nameEn: "Hong Gildong",
      roleKo: "회장",
      roleEn: "President",
    },
  );

  assert.equal(
    CreateContactSchema.safeParse({
      nameKo: "홍길동",
      roleKo: "회장",
      roleEn: "President",
    }).success,
    false,
  );
});

test("contact PATCH accepts individual fields and preserves their validation", () => {
  assert.equal(
    UpdateContactSchema.safeParse({
      nameKo: "홍길동",
      nameEn: "Hong Gildong",
      roleKo: "회장",
      roleEn: "President",
      email: "president@example.com",
      phoneNumber: "010-0000-0000",
      sortOrder: 1,
    }).success,
    true,
    "the admin's existing full update payload must remain valid",
  );
  assert.deepEqual(UpdateContactSchema.parse({ roleEn: "  Chair  " }), {
    roleEn: "Chair",
  });
  assert.deepEqual(UpdateContactSchema.parse({ sortOrder: 3 }), {
    sortOrder: 3,
  });

  for (const field of ["nameKo", "nameEn", "roleKo", "roleEn"]) {
    assert.equal(
      UpdateContactSchema.safeParse({ [field]: "   " }).success,
      false,
      `${field} must reject a blank value`,
    );
    assert.equal(
      UpdateContactSchema.safeParse({ [field]: null }).success,
      false,
      `${field} must preserve the database non-null contract`,
    );
  }
});

test("contact repository updates only fields present in a PATCH", async () => {
  let updateSet;
  const database = {
    update: () => ({
      set: (set) => {
        updateSet = set;
        return {
          where: () => ({
            returning: async () => [{ ...contactRow, roleEn: set.roleEn }],
          }),
        };
      },
    }),
  };
  const repository = new ContactsRepository(database);

  const updated = await repository.update(contactRow.id, { roleEn: "Chair" });

  assert.equal(updated.roleEn, "Chair");
  assert.equal(updateSet.roleEn, "Chair");
  assert.ok(updateSet.updatedAt instanceof Date);
  assert.equal(Object.hasOwn(updateSet, "nameKo"), false);
  assert.equal(Object.hasOwn(updateSet, "nameEn"), false);
  assert.equal(Object.hasOwn(updateSet, "roleKo"), false);
});
