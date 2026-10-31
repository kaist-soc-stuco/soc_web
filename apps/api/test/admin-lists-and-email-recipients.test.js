const assert = require("node:assert/strict");
const { test, before, beforeEach, after } = require("node:test");
const { randomUUID } = require("node:crypto");
const { Pool } = require("pg");
const { drizzle } = require("drizzle-orm/node-postgres");
const { eq } = require("drizzle-orm");
const schema = require("../dist/apps/api/src/infrastructure/postgres/postgres.schema.js");
const { UsersRepository } = require("../dist/apps/api/src/features/users/repositories/users.repository.js");
const { RoleGroupsRepository } = require("../dist/apps/api/src/features/role-groups/role-groups.repository.js");
const { VotesRepository } = require("../dist/apps/api/src/features/votes/votes.repository.js");
const { BulkEmailRepository } = require("../dist/apps/api/src/features/email/bulk-email.repository.js");
const { EXCLUDED_SYSTEM_TARGET_KAIST_UIDS } = require("../dist/apps/api/src/features/users/system-users.js");
const { CreateContactSchema } = require("@soc/contracts");
const url = process.env.ADMIN_UI_TEST_DATABASE_URL;
if (url && !/^\/soc_admin_ui_test_\d+$/.test(new URL(url).pathname)) throw new Error("isolated_admin_ui_test_database_required");
const integration = { skip: !url };
let pool, db;
before(async () => { if (url) { pool = new Pool({ connectionString: url }); db = drizzle(pool, { schema }); } });
beforeEach(async () => { if (pool) await pool.query("TRUNCATE users, role_group CASCADE"); });
after(async () => { if (pool) await pool.end(); });

async function member(kaistUid, number) {
  const [row] = await db.insert(schema.users).values({ userId: randomUUID(), kaistUid, nameKo: "Demo Test", email: `${kaistUid}@example.invalid`, stdNo: number, primaryMajor: "전산학부" }).returning();
  return row;
}

test("seed authors are hidden from user counts, searches, role membership and voter candidates", integration, async () => {
  const real = await member("real-person", "20260001");
  const seeded = [];
  for (const [index, uid] of EXCLUDED_SYSTEM_TARGET_KAIST_UIDS.entries()) seeded.push(await member(uid, String(20260100 + index)));
  const users = new UsersRepository(db, null, null);
  const roles = new RoleGroupsRepository(db);
  const [role] = await db.insert(schema.roleGroups).values({ nameKo: "검증 역할" }).returning();
  await db.insert(schema.userRoleGroups).values([real, ...seeded].map(user => ({ userId: user.userId, roleGroupId: role.roleGroupId })));
  const listed = await users.listAdminUsers({});
  assert.equal(listed.total, 1);
  assert.equal(listed.facets.primaryMajor, 1);
  assert.deepEqual(listed.items.map(user => user.userId), [real.userId]);
  assert.deepEqual((await users.searchUsers(undefined)).map(user => user.userId), [real.userId]);
  assert.deepEqual((await users.listEmailRecipients("ALL")).map(user => user.email), [real.email]);
  assert.equal((await roles.listRoleGroups())[0].userCount, 1);
  assert.deepEqual((await roles.listRoleGroupMembers(role.roleGroupId)).map(user => user.userId), [real.userId]);
  const candidates = await roles.listRoleGroupCandidates(role.roleGroupId, {});
  assert.equal(candidates.total, 1);
  assert.deepEqual(candidates.items.map(user => user.userId), [real.userId]);
  assert.deepEqual((await new VotesRepository(db).searchVoterCandidates("Demo")).map(user => user.userId), [real.userId]);
  assert.ok(await users.findById(seeded[0].userId), "seed content ownership must remain intact");
});

test("email history snapshots the actual dispatch recipients and survives later profile changes", integration, async () => {
  const actor = await member("sender", "20260001");
  const repo = new BulkEmailRepository(db);
  const planned = [{ nameKo: "예약 당시", email: "planned@example.invalid", studentNumber: "20260002" }];
  const id = await repo.create({ subject: "제목", content: "본문", contentType: "plain", recipientType: "ALL", senderId: actor.userId, recipientCount: 1, recipients: planned, status: "SCHEDULED" });
  assert.deepEqual((await repo.findById(id)).recipients, planned);
  const dispatched = [{ nameKo: "발송 당시", email: actor.email, studentNumber: actor.stdNo }];
  await repo.createDeliveryAttempt(id, "<synthetic@example.invalid>", dispatched);
  await db.update(schema.users).set({ nameKo: "변경 후 이름", email: "changed@example.invalid" }).where(eq(schema.users.userId, actor.userId));
  assert.deepEqual((await repo.findById(id)).recipients, dispatched);
  assert.equal((await repo.findById(id)).recipientCount, 1);
  const old = await repo.create({ subject: "과거", content: "본문", contentType: "plain", recipientType: "ALL", senderId: actor.userId, recipientCount: 1, status: "SUCCESS" });
  assert.equal((await repo.findById(old)).recipients, null, "unknown historical recipients must not be inferred from current users");
});

test("contact input removes phone separators without changing country prefixes", () => {
  const parsed = CreateContactSchema.parse({ nameKo: "합성", nameEn: "", roleKo: "부원", roleEn: "", privacyConsented: true, phoneNumber: "+82-10-1234-5678" });
  assert.equal(parsed.phoneNumber, "+821012345678");
});
