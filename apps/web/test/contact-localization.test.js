const assert = require("node:assert/strict");
const test = require("node:test");

const { CreateContactSchema, UpdateContactSchema } = require("@soc/contracts");

const localizedContact = {
  nameKo: "홍길동",
  nameEn: "Gildong Hong",
  roleKo: "회장",
  roleEn: "President",
};

test("contact create requires Korean identity fields and defaults English fields", () => {
  for (const field of ["nameKo", "roleKo"]) {
    const missing = { ...localizedContact };
    delete missing[field];
    assert.equal(CreateContactSchema.safeParse(missing).success, false, field);

    assert.equal(
      CreateContactSchema.safeParse({ ...localizedContact, [field]: "   " }).success,
      false,
      `${field} whitespace`,
    );
  }

  const parsed = CreateContactSchema.parse({ nameKo: "홍길동", roleKo: "회장" });
  assert.equal(parsed.nameEn, "");
  assert.equal(parsed.roleEn, "");
  assert.equal(parsed.privacyConsented, true);
});

test("contact update accepts partial identity fields and validates provided values", () => {
  assert.deepEqual(UpdateContactSchema.parse({ nameKo: "  홍길동  " }), {
    nameKo: "홍길동",
  });
  assert.equal(UpdateContactSchema.safeParse(localizedContact).success, true);

  for (const field of ["nameKo", "roleKo"]) {
    assert.equal(
      UpdateContactSchema.safeParse({ [field]: "   " }).success,
      false,
      `${field} whitespace`,
    );
    assert.equal(
      UpdateContactSchema.safeParse({ [field]: null }).success,
      false,
      `${field} null`,
    );
  }

  for (const field of ["nameEn", "roleEn"]) {
    assert.equal(UpdateContactSchema.safeParse({ [field]: "   " }).success, true);
    assert.equal(UpdateContactSchema.safeParse({ [field]: null }).success, false);
  }
});

test("contact identity fields are normalized before persistence", () => {
  const parsed = CreateContactSchema.parse({
    nameKo: "  홍길동  ",
    nameEn: "  Gildong Hong  ",
    roleKo: "  회장  ",
    roleEn: "  President  ",
  });

  assert.deepEqual(parsed, { ...localizedContact, privacyConsented: true });
});
