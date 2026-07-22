const assert = require("node:assert/strict");
const test = require("node:test");

const {
  ForbiddenException,
  NotFoundException,
} = require("@nestjs/common");
const { Reflector } = require("@nestjs/core");
const {
  Permissions,
  SITE_CONTENT_KEYS,
  SiteContentKeySchema,
  UpsertSiteContentSchema,
} = require("@soc/contracts");

const {
  PermissionBitsGuard,
} = require("../dist/apps/api/src/features/auth/guards/require-permissions.decorator.js");
const {
  SiteContentController,
} = require("../dist/apps/api/src/features/site-content/site-content.controller.js");
const {
  SiteContentService,
} = require("../dist/apps/api/src/features/site-content/site-content.service.js");

const record = {
  createdAt: "2026-07-15T00:00:00.000Z",
  key: "home.hero.title",
  updatedAt: "2026-07-15T01:00:00.000Z",
  updatedBy: "5eb16720-3c57-4ee7-b4c1-fb6b9c6b9901",
  valueEn: "School of Computing Student Council",
  valueKo: "전산학부 학생회",
};

test("site content contracts accept only finite keys and complete bilingual copy", () => {
  assert.equal(SITE_CONTENT_KEYS.length, 10);
  assert.equal(SiteContentKeySchema.parse("about.intro.body"), "about.intro.body");
  assert.equal(SiteContentKeySchema.safeParse("arbitrary.json.key").success, false);

  assert.deepEqual(
    UpsertSiteContentSchema.parse({ valueKo: "  한국어  ", valueEn: " English " }),
    { valueKo: "한국어", valueEn: "English" },
  );
  assert.equal(
    UpsertSiteContentSchema.safeParse({ valueKo: "한국어" }).success,
    false,
  );
  assert.equal(
    UpsertSiteContentSchema.safeParse({
      valueKo: "한국어",
      valueEn: "English",
      arbitraryJson: {},
    }).success,
    false,
  );
});

test("public listing omits editor identity while admin listing retains audit fields", async () => {
  const repository = {
    findAll: async () => [record],
  };
  const service = new SiteContentService(repository, { record: async () => {} });

  assert.deepEqual(await service.listPublic(), [
    {
      key: record.key,
      updatedAt: record.updatedAt,
      valueEn: record.valueEn,
      valueKo: record.valueKo,
    },
  ]);
  assert.deepEqual(await service.listAdmin(), [record]);
});

test("an unseeded CMS returns an empty override list for frontend fallbacks", async () => {
  const service = new SiteContentService(
    { findAll: async () => [] },
    { record: async () => {} },
  );

  assert.deepEqual(await service.listPublic(), []);
  assert.deepEqual(await service.listAdmin(), []);
});

test("upsert records the authenticated editor and an audit event", async () => {
  const calls = { audit: [], upsert: [] };
  const repository = {
    findByKey: async () => null,
    upsert: async (...args) => {
      calls.upsert.push(args);
      return record;
    },
  };
  const service = new SiteContentService(repository, {
    record: async (input) => calls.audit.push(input),
  });
  const input = { valueEn: record.valueEn, valueKo: record.valueKo };

  assert.deepEqual(
    await service.upsert(record.key, input, {
      actorUserId: record.updatedBy,
      ipAddress: "127.0.0.1",
    }),
    record,
  );
  assert.deepEqual(calls.upsert, [[record.key, input, record.updatedBy]]);
  assert.equal(calls.audit.length, 1);
  assert.equal(calls.audit[0].action, "site_content.create");
  assert.equal(calls.audit[0].actorUserId, record.updatedBy);
  assert.equal(calls.audit[0].targetId, record.key);
});

test("deleting a missing override fails instead of reporting a false reset", async () => {
  const service = new SiteContentService(
    { delete: async () => null },
    { record: async () => assert.fail("missing deletes must not be audited") },
  );

  await assert.rejects(
    service.delete(record.key, { actorUserId: record.updatedBy }),
    NotFoundException,
  );
});

const executionContext = (handler, user) => ({
  getClass: () => SiteContentController,
  getHandler: () => handler,
  switchToHttp: () => ({ getRequest: () => ({ user }) }),
});

test("CMS mutation endpoints require MANAGE_CONTENT", () => {
  const guard = new PermissionBitsGuard(new Reflector());
  const regularUser = { id: "member", permission: 0 };
  const contentManager = {
    id: "manager",
    permission: Permissions.MANAGE_CONTENT,
  };

  assert.throws(
    () =>
      guard.canActivate(
        executionContext(SiteContentController.prototype.upsert, regularUser),
      ),
    ForbiddenException,
  );
  assert.equal(
    guard.canActivate(
      executionContext(SiteContentController.prototype.upsert, contentManager),
    ),
    true,
  );
  assert.throws(
    () =>
      guard.canActivate(
        executionContext(SiteContentController.prototype.delete, regularUser),
      ),
    ForbiddenException,
  );
});
