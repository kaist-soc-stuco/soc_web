const assert = require("node:assert/strict");
const { test, before, beforeEach, after } = require("node:test");
const { randomUUID } = require("node:crypto");
const { Pool } = require("pg");
const { drizzle } = require("drizzle-orm/node-postgres");
const { eq } = require("drizzle-orm");
const { BulkImportContactsSchema, CreateContactSchema } = require("@soc/contracts");
const { msToTimeObj, nowMs } = require("@soc/shared");
const schema = require("../dist/apps/api/src/infrastructure/postgres/postgres.schema.js");
const { ContactsRepository } = require("../dist/apps/api/src/features/contacts/contacts.repository.js");
const { ContactsService } = require("../dist/apps/api/src/features/contacts/contacts.service.js");
const { ContactsController } = require("../dist/apps/api/src/features/contacts/contacts.controller.js");
const XLSX = require("xlsx");

const url = process.env.CONTACT_TEST_DATABASE_URL;
const options = { skip: !url };
const namespace = "contact_upsert_test_" + randomUUID().replaceAll("-", "");
const year = msToTimeObj(nowMs()).year;
let admin, pool, db, repo, service;
before(async () => {
  if (!url) return;
  admin = new Pool({connectionString: url});
  await admin.query(`CREATE SCHEMA ${namespace}`);
  for (const table of ["executive_contact", "executive_contact_department"])
    await admin.query(`CREATE TABLE ${namespace}.${table} (LIKE public.${table} INCLUDING ALL)`);
  pool = new Pool({connectionString: url, max: 5, options: `-c search_path=${namespace},public`});
  db = drizzle(pool, {schema});
  repo = new ContactsRepository(db);
  service = new ContactsService(repo, {record: async () => {}}, {}, {enqueueSync: async () => {}});
});
beforeEach(async () => {
  if (pool) await pool.query("TRUNCATE executive_contact, executive_contact_department");
});
after(async () => {
  await pool?.end();
  if (admin) {
    assert.match(namespace, /^contact_upsert_test_[a-f0-9]+$/);
    await admin.query(`DROP SCHEMA IF EXISTS ${namespace} CASCADE`);
    await admin.end();
  }
});
const person = (studentNumber, extra = {}) => ({nameKo: "합성 부원", studentNumber, roleKo: "부원", ...extra});
const insert = item => repo.insert(CreateContactSchema.parse(item));
const insertLegacy = async item => {
  const [row] = await db.insert(schema.executiveContacts).values(CreateContactSchema.parse(item)).returning();
  return repo.findById(row.id);
};
const upload = items => service.bulkImport(BulkImportContactsSchema.parse({items}));

test("contact upsert keeps identity, optional values, other years and unlisted people across repeated imports", options, async () => {
  const portalUserId = randomUUID();
  const existing = await insert(person("90990001", {
    portalUserId, nameEn: "Existing Member", email: "member@example.invalid", phoneNumber: "01012345678",
    sortOrder: 7, cohort: year - 1, departmentKo: "기획부", departmentEn: "Planning", roleEn: "Member",
    activities: [{year: year - 1, departmentKo: "기획부", roleKo: "부원"}, {year, departmentKo: "기획부", roleKo: "부원"}],
  }));
  const unrelated = await insert(person("90990002"));
  const items = [person("90990001", {departmentKo: "전산관리부", roleKo: "부장"}), person("90990003")];
  const result = await upload(items);
  assert.equal(result.createdCount, 1);
  assert.equal(result.updatedCount, 1);
  assert.equal(result.importedCount, 2);
  const updated = await repo.findById(existing.id);
  assert.equal(updated.portalUserId, portalUserId);
  assert.equal(updated.createdAt, existing.createdAt);
  assert.equal(updated.sortOrder, 7);
  assert.equal(updated.nameEn, "Existing Member");
  assert.equal(updated.email, "member@example.invalid");
  assert.equal(updated.phoneNumber, "01012345678");
  assert.deepEqual(updated.activities.map(a => [a.year, a.departmentKo, a.roleKo]), [
    [year - 1, "기획부", "부원"], [year, "전산관리부", "부장"],
  ]);
  assert.deepEqual(await repo.findById(unrelated.id), unrelated);
  const repeated = await upload(items);
  assert.equal(repeated.createdCount, 0);
  assert.equal(repeated.updatedCount, 2);
  assert.equal((await repo.findAll()).length, 3);
  assert.deepEqual((await repo.findById(existing.id)).activities, updated.activities);
  // A blank optional department must not erase the stored current-year value.
  await upload([person("90990001", {roleKo: "부장"})]);
  assert.equal((await repo.findById(existing.id)).departmentKo, "전산관리부");
  assert.equal((await repo.findById(existing.id)).activities.find(a => a.year === year).departmentKo, "전산관리부");
});

test("concurrent uploads of the same new student create a single directory entry", options, async () => {
  const results = await Promise.all([upload([person("90990001")]), upload([person("90990001")])]);
  assert.equal(results.reduce((sum, result) => sum + result.createdCount, 0), 1);
  const rows = await repo.findAll();
  assert.equal(rows.length, 1);
  assert.equal(rows[0].activities.length, 1);
  assert.equal(results[0].items[0].id, results[1].items[0].id);
});

test("legacy duplicates merge into the linked record and retain legacy-year history and revoked consent", options, async () => {
  const first = await insert(person("90990001", {cohort: 24, departmentKo: "비서실", roleKo: "실원", email: "legacy@example.invalid", privacyConsented: false}));
  const linked = await insertLegacy(person("90990001", {portalUserId: randomUUID(), cohort: 25, departmentKo: "기획부"}));
  // Match historical padding as well as normalized academic numbers.
  await db.update(schema.executiveContacts).set({studentNumber: " 90990001 "}).where(eq(schema.executiveContacts.id, first.id));
  const result = await upload([person("90990001", {departmentKo: "전산관리부"})]);
  assert.equal(result.createdCount, 0);
  assert.equal(result.updatedCount, 1);
  const rows = await repo.findAll();
  assert.equal(rows.length, 1);
  assert.equal(rows[0].id, linked.id);
  assert.equal(rows[0].portalUserId, linked.portalUserId);
  assert.equal(rows[0].email, "legacy@example.invalid");
  assert.equal(rows[0].privacyConsented, false);
  assert.deepEqual(new Set(rows[0].activities.map(a => a.year)), new Set([2024, 2025, year]));
});

test("conflicting linked accounts roll back every row without deleting either person", options, async () => {
  const a = await insert(person("90990001", {portalUserId: randomUUID()}));
  const b = await insertLegacy(person("90990001", {portalUserId: randomUUID()}));
  await assert.rejects(upload([person("90990002"), person("90990001")]), /contact_portal_account_conflict/);
  assert.deepEqual(new Set((await repo.findAll()).map(row => row.id)), new Set([a.id, b.id]));
});

test("manual creation and academic-number changes reject duplicates including simultaneous requests", options, async () => {
  const original = await insert(person("90990001"));
  await assert.rejects(insert(person("90990001")), /contact_student_number_exists/);
  const second = await insert(person("90990002"));
  await assert.rejects(repo.update(second.id, {studentNumber:"90990001"}), /contact_student_number_exists/);
  assert.equal((await repo.findById(second.id)).studentNumber, "90990002");
  assert.equal((await repo.update(original.id, {studentNumber:" 90990001 ", nameKo:"수정"})).nameKo, "수정");
  const results = await Promise.allSettled([insert(person("90990003")), insert(person("90990003"))]);
  assert.equal(results.filter(result => result.status === "fulfilled").length, 1);
  assert.equal((await repo.findAll()).length, 3);
  const mixed = await Promise.allSettled([insert(person("90990004")), upload([person("90990004")])]);
  assert.ok(mixed.some(result => result.status === "fulfilled"));
  assert.equal((await repo.findAll()).filter(row => row.studentNumber === "90990004").length, 1);
});

test("explicit historical imports preserve concurrent positions and never downgrade the latest profile", options, async () => {
  const activities = [
    {year:year-1, departmentKo:"기획부", roleKo:"부원"},
    {year, departmentKo:"전산관리부", roleKo:"부장"},
    {year, departmentKo:"TF", roleKo:"TF원"},
  ];
  const original = await insert(person("90990001", {departmentKo:"전산관리부",roleKo:"부장",cohort:year,activities}));
  await upload([person("90990001", {departmentKo:"기획부",roleKo:"실무자",activities:[{year:year-1,departmentKo:"기획부",roleKo:"실무자"}]})]);
  let updated = await repo.findById(original.id);
  assert.equal(updated.cohort, year);
  assert.equal(updated.activities.filter(activity => activity.year === year).length, 2);
  assert.equal(updated.departmentKo, "전산관리부");
  assert.equal(updated.roleKo, "부장");
  await upload([person("90990001", {departmentKo:"전산관리부", roleKo:"부장"})]);
  assert.equal((await repo.findById(original.id)).activities.filter(activity => activity.year === year).length, 2);
  await assert.rejects(upload([person("90990001", {departmentKo:"새 부서"})]), /contact_import_activities_ambiguous/);
  await assert.rejects(upload([person("90990001", {activities:[activities[1]]})]), /contact_import_activities_ambiguous/);
  await upload([person("90990001", {activities: activities.filter(activity => activity.year === year)})]);
  updated = await repo.findById(original.id);
  assert.equal(updated.activities.length, 3);
  assert.equal(updated.activities.find(activity => activity.year === year-1).roleKo, "실무자");
});

test("an explicit activity with no department remains unassigned after an import", options, async () => {
  const activities = [{year,departmentKo:"기획부",roleKo:"부원"},{year,departmentKo:"",roleKo:"회장"}];
  const original = await insert(person("90990001", {departmentKo:"기획부",activities}));
  await upload([person("90990001", {departmentKo:"기획부",activities})]);
  const updated = await repo.findById(original.id);
  assert.equal(updated.activities.find(activity => activity.roleKo === "회장").departmentKo, "");
  assert.equal(updated.activities.length, 2);
});

test("exports use selected-year activities and include all concurrent positions for each matched member", options, async () => {
  await insert(person("90990001", {departmentKo:"전산관리부", roleKo:"부장", cohort:year, activities:[
    {year:year-1,departmentKo:"기획부",roleKo:"부원"},
    {year,departmentKo:"전산관리부",roleKo:"부장"}, {year,departmentKo:"TF",roleKo:"TF원"},
  ]}));
  const controller = new ContactsController(service, {});
  const exportedRows = async (selectedYear, department) => {
    const file = await controller.exportManagedContacts({}, undefined, selectedYear, department);
    const parts = [];
    for await (const part of file.getStream()) parts.push(part);
    const book = XLSX.read(Buffer.concat(parts), {type:"buffer"});
    return XLSX.utils.sheet_to_json(book.Sheets["연락망"], {header:1});
  };
  const past = await exportedRows(String(year-1));
  assert.equal(past[1][2], "기획부");
  assert.equal(past[1][3], "부원");
  assert.equal(past[1][6], year-1);
  const current = await exportedRows(String(year), "전산관리부");
  assert.equal(current.length, 3);
  assert.deepEqual(current.slice(1).map(row => row[2]), ["전산관리부", "TF"]);
  assert.equal((await exportedRows()).length, 4);
});

test("malformed and duplicate academic numbers cannot partially change the directory", options, async () => {
  const original = await insert(person("90990001"));
  await assert.rejects(repo.bulkImport({items:[person("90990001"), person("90990001")]}), /contact_import_student_numbers_invalid/);
  await assert.rejects(repo.bulkImport({items:[person("bad")]}), /contact_import_student_numbers_invalid/);
  assert.equal(BulkImportContactsSchema.safeParse({items:[person("90990001")], replaceExisting:true}).success, false);
  assert.deepEqual(await repo.findAll(), [original]);
});
