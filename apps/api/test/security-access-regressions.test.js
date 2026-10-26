const assert = require("node:assert/strict");
const { before, after, test } = require("node:test");
const { randomUUID } = require("node:crypto");
const path = require("node:path");
const { Pool } = require("pg");
const { drizzle } = require("drizzle-orm/node-postgres");
const { migrate } = require("drizzle-orm/node-postgres/migrator");
const { eq, inArray } = require("drizzle-orm");
const { Permissions } = require("@soc/contracts");
const base = "../dist/apps/api/src/";
const schema = require(base + "infrastructure/postgres/postgres.schema.js");
const { ArticleRepository } = require(base + "features/board/repositories/article.repository.js");
const { BoardRepository } = require(base + "features/board/repositories/board.repository.js");
const { ArticleService } = require(base + "features/board/article.service.js");
const { UsersRepository } = require(base + "features/users/repositories/users.repository.js");
const { UsersService } = require(base + "features/users/users.service.js");
const { UsersController } = require(base + "features/users/users.controller.js");
const { AssetRepository } = require(base + "features/asset/repositories/asset.repository.js");
const { SiteContentRepository } = require(base + "features/site-content/site-content.repository.js");
const { SiteContentService } = require(base + "features/site-content/site-content.service.js");
const url = process.env.SECURITY_ACCESS_TEST_DATABASE_URL;
if (process.env.CI && !url) throw new Error("SECURITY_ACCESS_TEST_DATABASE_URL_is_required_in_CI");
const options = { skip: !url };
const owner = randomUUID(), member = randomUUID();
const ownerName = `SyntheticOwner-${owner.slice(0, 8)}`;
let pool, db, board, articles, service, users, assets, cms;
const guest = { authenticated: false };
const viewer = (id, permission = 0) => ({ authenticated: true, user: { id, permission } });

before(async () => {
  if (!url) return;
  pool = new Pool({ connectionString: url });
  db = drizzle(pool, { schema });
  await migrate(db, { migrationsFolder: path.join(__dirname, "../drizzle") });
  for (const id of [owner, member]) await db.insert(schema.users).values({ userId: id,
    kaistUid: id.slice(0, 20), nameKo: id === owner ? ownerName : "SyntheticMember",
    email: `${id}@example.test`, isActive: true });
  [board] = await db.insert(schema.boards).values({ code: `sec_${owner.slice(0, 8)}`,
    nameKo: "권한 테스트", allowGuestRead: true, allowSecret: true }).returning();
  articles = new ArticleRepository(db);
  service = new ArticleService(new BoardRepository(db), articles);
  users = new UsersRepository(db, null, null);
  assets = new AssetRepository(db);
  cms = new SiteContentService(new SiteContentRepository(db), { record: async () => {} });
});
after(async () => {
  if (!pool) return;
  try {
    await db.delete(schema.contentBlocks).where(inArray(schema.contentBlocks.createdBy, [owner, member]));
    await db.delete(schema.boards).where(eq(schema.boards.boardId, board.boardId));
    await db.delete(schema.assets).where(inArray(schema.assets.uploadedBy, [owner, member]));
    await db.delete(schema.users).where(inArray(schema.users.userId, [owner, member]));
  } finally { await pool.end(); }
});
async function article(values = {}) {
  return (await db.insert(schema.articles).values({ boardId: board.boardId,
    authorUserId: owner, titleKo: "Public title", contentKo: "Public body", ...values }).returning())[0];
}
async function image() {
  return (await assets.createAsset({ uploadedBy: owner, storageKey: `fixture:${randomUUID()}`,
    originalFilename: "test.png", mimeType: "image/png", sizeBytes: 1 })).assetId;
}

test("secret queries protect rows, totals and state counts while preserving owner/staff search and unsearched placeholders", options, async () => {
  const marker = randomUUID();
  const secret = await article({ titleKo: marker, contentEn: marker, isSecret: true });
  const [ordinary, official, moderator] = [viewer(member), viewer(member, Permissions.WRITE_OFFICIAL), viewer(member, Permissions.MODERATE_CONTENT)];
  await assert.rejects(service.getArticle(board.code, String(secret.articleId), guest));
  for (const current of [guest, ordinary, official]) {
    for (const q of [marker, "%"]) {
      const local = await service.getArticles(board.code, { q, searchBy: "title_content" }, current);
      assert(!local.items.some(x => x.articleId === String(secret.articleId)));
      const all = await service.getAllArticles({ q, searchBy: "title_content" }, current);
      assert(!all.items.some(x => x.articleId === String(secret.articleId)));
    }
    assert.equal((await service.getArticles(board.code, { q: marker }, current)).total, 0);
    assert.equal((await service.searchArticles(marker, 100, current)).length, 0);
  }
  for (const current of [viewer(owner), moderator, viewer(member, Permissions.WRITE_REPLY)]) {
    assert.equal((await service.getArticles(board.code, { q: marker, searchBy: "title_content" }, current)).total, 1);
    assert((await service.getAllArticles({ q: marker, searchBy: "title_content" }, current)).items.some(x => x.articleId === String(secret.articleId)));
  }
  const list = await service.getArticles(board.code, {}, guest);
  assert.equal(list.items.find(x => x.articleId === String(secret.articleId)).titleKo, "비밀글입니다.");
  assert((await service.getArticles(board.code, { q: "   " }, guest)).items.some(x => x.articleId === String(secret.articleId)));
  const counted = await articles.listByBoardId(board.boardId, 1, 20, ["PUBLIC"], marker,
    member, false, "title_content", { state: "all" });
  assert.equal(Number(counted.stateCounts.all), 0);
  assert.equal(counted.total, 0);
});

test("real-name search excludes anonymous posts for every reader but still finds named posts", options, async () => {
  const anonymous = await article({ isAnonymous: true });
  const named = await article();
  for (const current of [guest, viewer(owner), viewer(member, Permissions.MODERATE_CONTENT)]) {
    const result = await service.getAllArticles({ q: ownerName, searchBy: "author", limit: 100 }, current);
    assert(!result.items.some(x => x.articleId === String(anonymous.articleId)));
    assert(result.items.some(x => x.articleId === String(named.articleId)));
  }
});

test("scraps, comments and activity enforce present secret/scope/board access, including counts and verified staff permissions", options, async () => {
  const target = await article();
  await db.insert(schema.articleEngagements).values({ articleId: target.articleId, userId: member, kind: "SCRAP" });
  await db.insert(schema.comments).values({ articleId: target.articleId, authorUserId: member, content: "My prior comment" });
  const controller = new UsersController(new UsersService(users, {}), {});
  const marker = randomUUID();
  for (const restriction of ["secret", "staff", "inactive"]) {
    await db.update(schema.boards).set({ isActive: restriction !== "inactive" }).where(eq(schema.boards.boardId, board.boardId));
    await db.update(schema.articles).set({ isSecret: restriction === "secret", visibilityScope: restriction === "staff" ? "STAFF_ONLY" : "PUBLIC",
      titleKo: marker, contentKo: marker }).where(eq(schema.articles.articleId, target.articleId));
    assert.equal((await users.getMyScraps(member, 20, 0, marker)).length, 0);
    assert.equal(await users.countMyScraps(member, marker), 0);
    assert.equal((await users.getMyComments(member, 20, 0, marker)).length, 0);
    assert.equal(await users.countMyComments(member, marker), 0);
    assert.equal((await users.getMyActivities(member, 20, 0, marker)).total, 0);
    const req = { user: { id: member, permission: Permissions.MODERATE_CONTENT } };
    const expected = restriction === "inactive" ? 0 : 1;
    assert.equal((await controller.getMyScraps(req, "1", "20", marker)).total, expected);
    assert.equal((await controller.getMyComments(req, "1", "20", marker)).total, expected);
    assert.equal((await controller.getMyActivities(req, "1", "20", marker)).total, expected * 2);
  }
  await db.update(schema.boards).set({ isActive: true }).where(eq(schema.boards.boardId, board.boardId));
  await db.update(schema.articles).set({ isSecret: false, visibilityScope: "PUBLIC" }).where(eq(schema.articles.articleId, target.articleId));
  assert.equal((await users.getMyScraps(member, 20, 0, marker)).length, 1);
  assert.equal((await users.getMyComments(member, 20, 0, marker)).length, 1);
  assert.equal((await users.getMyActivities(member, 20, 0, marker)).total, 2);
});

test("CMS rejects unrelated private image references in both fields and supports retained bilingual images and public reuse", options, async () => {
  const privateId = await image();
  const input = { type: "QUICK_LINK", titleKo: "Test", linkUrl: "/faq" };
  for (const reference of [`asset:${privateId}`, `/assets/${privateId}/content`]) {
    for (const field of ["imageUrl", "imageUrlEn"]) {
      await assert.rejects(cms.createContentBlock({ ...input, [field]: reference }, { actorUserId: member }), /content_asset_not_owned/);
    }
  }
  const safe = await cms.createContentBlock(input, { actorUserId: member });
  await cms.publishContentBlock(safe.contentBlockId, { actorUserId: member });
  await assert.rejects(cms.updateContentBlock(safe.contentBlockId, { imageUrlEn: `asset:${privateId}` }, { actorUserId: member }), /content_asset_not_owned/);
  assert.equal((await assets.findAssetWithLinks(privateId)).publicContentImage, false);
  const own = await cms.createContentBlock({ ...input, imageUrl: `asset:${privateId}` }, { actorUserId: owner });
  await assert.rejects(cms.createContentBlock({ ...input, imageUrl: `asset:${privateId}` }, { actorUserId: member }), /content_asset_not_owned/);
  await cms.updateContentBlock(own.contentBlockId, { titleKo: "Handoff", imageUrl: null, imageUrlEn: `asset:000${privateId}` }, { actorUserId: member });
  await cms.updateContentBlock(own.contentBlockId, { imageUrl: `asset:${privateId}`, imageUrlEn: null }, { actorUserId: member });
  await cms.publishContentBlock(own.contentBlockId, { actorUserId: member });
  assert.equal((await assets.findAssetWithLinks(privateId)).publicContentImage, true);
  await cms.createContentBlock({ ...input, imageUrl: `asset:${privateId}` }, { actorUserId: member });
});

test("CMS public-article reuse requires an active guest-readable board", options, async () => {
  const id = await image(), target = await article();
  await db.insert(schema.articleAssets).values({ articleId: target.articleId, assetId: Number(id), usageType: "IMAGE" });
  for (const flags of [{ isActive: false, allowGuestRead: true }, { isActive: true, allowGuestRead: false }]) {
    await db.update(schema.boards).set(flags).where(eq(schema.boards.boardId, board.boardId));
    await assert.rejects(cms.createContentBlock({ type: "QUICK_LINK", titleKo: "Test", linkUrl: "/faq", imageUrl: `asset:${id}` }, { actorUserId: member }), /content_asset_not_owned/);
  }
  await db.update(schema.boards).set({ isActive: true, allowGuestRead: true }).where(eq(schema.boards.boardId, board.boardId));
  await cms.createContentBlock({ type: "QUICK_LINK", titleKo: "Public reuse", linkUrl: "/faq", imageUrl: `asset:${id}` }, { actorUserId: member });
});

test("CMS can reuse a public image stored with a leading-zero reference", options, async () => {
  const id = await image();
  const original = await cms.createContentBlock({ type: "QUICK_LINK", titleKo: "Legacy reference",
    imageUrl: `asset:000${id}`, linkUrl: "/faq" }, { actorUserId: owner });
  await cms.publishContentBlock(original.contentBlockId, { actorUserId: owner });
  assert.equal((await assets.findAssetWithLinks(`000${id}`)).publicContentImage, true);
  await cms.createContentBlock({ type: "QUICK_LINK", titleKo: "Reuse",
    imageUrl: `asset:${id}`, linkUrl: "/faq" }, { actorUserId: member });
});
