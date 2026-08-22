const assert = require("node:assert/strict");
const test = require("node:test");

const { CreateContactSchema, UpdateContactSchema } = require("@soc/contracts");

const localizedContact = {
  nameKo: "홍길동",
  nameEn: "Gildong Hong",
  roleKo: "회장",
  roleEn: "President",
};

test("contact create requires all Korean and English identity fields", () => {
  for (const field of ["nameKo", "nameEn", "roleKo", "roleEn"]) {
    const missing = { ...localizedContact };
    delete missing[field];
    assert.equal(CreateContactSchema.safeParse(missing).success, false, field);

    assert.equal(
      CreateContactSchema.safeParse({ ...localizedContact, [field]: "   " }).success,
      false,
      `${field} whitespace`,
    );
  }
});

test("contact update accepts partial identity fields and validates provided values", () => {
  assert.deepEqual(UpdateContactSchema.parse({ nameKo: "  홍길동  " }), {
    nameKo: "홍길동",
  });
  assert.equal(UpdateContactSchema.safeParse(localizedContact).success, true);

  for (const field of ["nameKo", "nameEn", "roleKo", "roleEn"]) {
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
