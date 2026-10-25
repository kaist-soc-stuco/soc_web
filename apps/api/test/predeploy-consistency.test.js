const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const { before, after, test } = require("node:test");
const { eq, inArray, like } = require("drizzle-orm");
const { drizzle } = require("drizzle-orm/node-postgres");
const { Pool } = require("pg");
const { ArticleDraftSaveSchema } = require("@soc/contracts");
const { CreateRoadmapCourseSchema } = require("@soc/contracts");
const base = "../dist/apps/api/src/";
const schema = require(base + "infrastructure/postgres/postgres.schema.js");
const { AssetRepository } = require(base + "features/asset/repositories/asset.repository.js");
const { ArticleRepository } = require(base + "features/board/repositories/article.repository.js");
const { ArticleDraftRepository } = require(base + "features/board/repositories/article-draft.repository.js");
const { CommentRepository } = require(base + "features/board/repositories/comment.repository.js");
const { BulkEmailRepository } = require(base + "features/email/bulk-email.repository.js");
const { CommentService } = require(base + "features/board/comment.service.js");
const { ArticleService } = require(base + "features/board/article.service.js");
const { RoadmapRepository } = require(base + "features/roadmap/roadmap.repository.js");
const url = process.env.OPERATIONS_TEST_DATABASE_URL;
if (process.env.CI && !url) throw new Error("OPERATIONS_TEST_DATABASE_URL_is_required_in_CI");
const opts = { skip: !url };
const actor = randomUUID(), other = randomUUID();
const prefix = `pre-${actor.slice(0, 8)}`;
let pool, db, assets, drafts, emails, articles, comments, boardId;
before(async () => {
  if (!url) return;
  pool = new Pool({ connectionString: url, max: 6 });
  db = drizzle(pool, { schema });
  assets = new AssetRepository(db); drafts = new ArticleDraftRepository(db);
  emails = new BulkEmailRepository(db); articles = new ArticleRepository(db); comments = new CommentRepository(db);
  await db.insert(schema.users).values([actor, other].map(userId => ({ userId, kaistUid: userId.slice(0, 20), nameKo: "합성 게시 사용자", email: `${userId}@example.test` })));
  [ { boardId } ] = await db.insert(schema.boards).values({ code: prefix, nameKo: "합성 게시판", allowComment: true, allowLike: true }).returning();
});
after(async () => {
  if (!db) return;
  try {
    await db.delete(schema.bulkEmails).where(inArray(schema.bulkEmails.senderId, [actor, other]));
    await db.delete(schema.articleDrafts).where(eq(schema.articleDrafts.boardId, boardId));
    await db.delete(schema.boards).where(eq(schema.boards.boardId, boardId));
    await db.delete(schema.assets).where(inArray(schema.assets.uploadedBy, [actor, other]));
    await db.delete(schema.assetDeletionJobs).where(like(schema.assetDeletionJobs.storageKey, `${prefix}/%`));
    await db.delete(schema.roadmapOfferings).where(eq(schema.roadmapOfferings.importedBy, actor));
    await db.delete(schema.roadmapCourses).where(like(schema.roadmapCourses.courseCode, `${prefix.toUpperCase()}%`));
    await db.delete(schema.users).where(inArray(schema.users.userId, [actor, other]));
  } finally { await pool.end(); }
});
async function asset(uploadStatus = "COMPLETED", uploadedBy = actor) {
  const [row] = await db.insert(schema.assets).values({ uploadedBy, storageKey: `${prefix}/${randomUUID()}`, originalFilename: "synthetic.txt", mimeType: "text/plain", sizeBytes: 1, uploadStatus, createdAt: new Date("2020-01-01Z") }).returning();
  return String(row.assetId);
}
const draftInput = (extra = {}) => ArticleDraftSaveSchema.parse({ boardCode: prefix, titleKo: "합성 임시저장", contentKo: "합성 본문", fingerprint: randomUUID(), ...extra });
const emailInput = (ids, status = "SCHEDULED") => ({ senderId: actor, subject: "합성 메일", content: "합성 본문", contentType: "plain", recipientType: "ALL", attachmentAssetIds: ids, recipientCount: 0, status });
async function article() {
  const [row] = await db.insert(schema.articles).values({ boardId, authorUserId: actor, titleKo: "합성 게시글", contentKo: "합성 본문" }).returning();
  return String(row.articleId);
}

test("deleted and hidden parents preserve visible replies with redacted placeholders and stable pages", opts, async () => {
  const articleId = await article();
  const parents = await db.insert(schema.comments).values(["DELETED", "HIDDEN", "PUBLISHED", "DELETED", "HIDDEN"].map(status => ({ articleId: Number(articleId), authorUserId: actor, status, content: "비공개 원문", createdAt: new Date("2026-01-01Z") }))).returning();
  const replies = await db.insert(schema.comments).values(parents.slice(0, 3).map(parent => ({ articleId: Number(articleId), authorUserId: other, parentCommentId: parent.commentId, content: "정상 답글" }))).returning();
  const seen = [];
  for (let page = 1; page <= 3; page++) {
    const result = await comments.listByArticleId(articleId, page, 1);
    assert.equal(result.total, 4); assert.equal(result.topLevelTotal, 3);
    assert.equal(result.items.length, 2);
    seen.push(result.items[0].commentId);
    assert.equal(result.items[1].commentId, String(replies[page - 1].commentId));
    if (page < 3) {
      assert.equal(result.items[0].content, "");
      assert.deepEqual(result.items[0].author, { name: "" });
      assert.equal(result.items[0].isOfficial, false);
    }
  }
  assert.deepEqual(seen, parents.slice(0, 3).map(p => String(p.commentId)));
  const staff = await comments.listByArticleId(articleId, 1, 10, actor, true);
  assert.equal(staff.items.find(c => c.commentId === String(parents[1].commentId)).content, "비공개 원문");
  assert.equal(staff.items.find(c => c.commentId === String(parents[0].commentId)).content, "");
});

test("hidden/deleted comments cannot receive new replies or likes", async () => {
  for (const status of ["HIDDEN", "DELETED"]) {
    const service = new CommentService({ findByCode: async () => ({ boardId: 1, isActive: true, allowComment: true, allowLike: true }) },
      { findCommentPermissionInfo: async () => ({ status: "PUBLISHED", allowComment: true }), isReadableArticle: async () => true },
      { findById: async () => ({ articleId: "1", status }), findPermissionInfo: async () => ({ status }) }, {}, {});
    await assert.rejects(service.createComment("free", "1", { content: "답글", parentCommentId: "2" }, { id: actor, permission: 0 }), /parent_comment_invalid/);
    await assert.rejects(service.setCommentEngagement("free", "1", "2", "LIKE", true, { id: actor, permission: 0 }), /comment_not_found/);
  }
});

test("posting suspension also blocks updates while permitting the owner to remove content", async () => {
  let updated = 0, deleted = 0;
  const boards = { findByCode: async () => ({ boardId: 1, isActive: true }) };
  const articleRepo = { findPermissionInfo: async () => ({ authorUserId: actor, status: "PUBLISHED" }), isReadableArticle: async () => true,
    updateArticle: async () => { updated++; }, softDeleteArticle: async () => { deleted++; return { ok: true }; } };
  const audit = { record: async () => {} }, users = { isPostingSuspended: async () => true };
  const articleService = new ArticleService(boards, articleRepo, audit, undefined, users);
  const commentService = new CommentService(boards, articleRepo, { findPermissionInfo: articleRepo.findPermissionInfo, updateComment: async () => { updated++; }, softDeleteComment: async () => { deleted++; return { ok: true }; } }, {}, audit, users);
  const user = { id: actor, permission: 0 };
  await assert.rejects(articleService.updateArticle("free", "1", { contentKo: "수정 본문" }, user), /posting_suspended/);
  await assert.rejects(commentService.updateComment("free", "1", "2", { content: "수정 본문" }, user), /posting_suspended/);
  await articleService.deleteArticle("free", "1", user);
  await commentService.deleteComment("free", "1", "2", user);
  assert.equal(updated, 0); assert.equal(deleted, 2);
});

test("notification lookup or delivery errors do not turn a saved comment into a failed request", async () => {
  for (const failLookup of [true, false]) {
    let created = 0;
    const service = new CommentService({ findByCode: async () => ({ boardId: 1, isActive: true, allowComment: true }) },
      { findCommentPermissionInfo: async () => ({ status: "PUBLISHED", allowComment: true }) },
      { createComment: async () => { created++; return { commentId: "2" }; }, findNotificationTargets: async () => { if (failLookup) throw new Error("lookup unavailable"); return {}; } },
      { notifyCommentCreated: async () => { throw new Error("notification unavailable"); } }, { record: async () => {} });
    service.logger.warn = () => {};
    assert.deepEqual(await service.createComment("free", "1", { content: "합성 댓글" }, { id: actor, permission: 0 }), { commentId: "2" });
    assert.equal(created, 1);
  }
});

test("notification cleanup errors do not turn a completed article deletion into a failed request", async () => {
  let deleted = 0;
  const service = new ArticleService({ findByCode: async () => ({ boardId: 1, isActive: true }) },
    { findPermissionInfo: async () => ({ authorUserId: actor, status: "PUBLISHED" }), softDeleteArticle: async () => { deleted++; return { ok: true }; } },
    { record: async () => {} }, { removeForArticle: async () => { throw new Error("notification unavailable"); } });
  service.logger.warn = () => {};
  assert.deepEqual(await service.deleteArticle("free", "1", { id: actor, permission: 0 }), { ok: true });
  assert.equal(deleted, 1);
});

test("orphan cleanup preserves draft attachments and images until their draft is removed", opts, async () => {
  const ids = await Promise.all([asset(), asset(), asset()]);
  const draft = await drafts.create(actor, boardId, draftInput({ assets: [{ assetId: ids[0], usageType: "ATTACHMENT", sortOrder: 0 }], contentKo: `<img src="/assets/${ids[1]}/content">`, contentEn: `<img src="asset:${ids[2]}">` }));
  const candidates = await assets.findUnlinkedAssetsBefore(new Date(), 100);
  for (const id of ids) {
    assert.equal(candidates.some(row => row.assetId === id), false);
    assert.equal(await assets.isStillUnlinked(id), false);
    assert.equal(await assets.deleteUnlinkedAsset(id), null);
  }
  await drafts.delete(actor, draft.draftId);
  for (const id of ids) assert.ok(await assets.deleteUnlinkedAsset(id));
});

test("draft updates move reference protection and preserve optimistic version checks", opts, async () => {
  const [first, second] = await Promise.all([asset(), asset()]);
  const saved = await drafts.create(actor, boardId, draftInput({ assets: [{ assetId: first, usageType: "IMAGE", sortOrder: 0 }] }));
  const next = draftInput({ expectedVersion: saved.version, assets: [{ assetId: second, usageType: "IMAGE", sortOrder: 0 }] });
  const updated = await drafts.update(actor, saved.draftId, boardId, next);
  assert.equal(updated.version, saved.version + 1);
  assert.equal(await drafts.update(actor, saved.draftId, boardId, next), null);
  assert.ok(await assets.deleteUnlinkedAsset(first)); assert.equal(await assets.deleteUnlinkedAsset(second), null);
});

test("scheduled and draft mail attachments survive orphan cleanup, including draft replacement", opts, async () => {
  const [scheduled, initial, replacement] = await Promise.all([asset(), asset(), asset()]);
  const scheduledId = await emails.create(emailInput([scheduled]));
  const draft = await emails.saveDraft(actor, emailInput([initial], "DRAFT"));
  assert.equal(await assets.deleteUnlinkedAsset(scheduled), null); assert.equal(await assets.deleteUnlinkedAsset(initial), null);
  await emails.saveDraft(actor, { ...emailInput([replacement], "DRAFT"), draftId: draft.id });
  assert.ok(await assets.deleteUnlinkedAsset(initial)); assert.equal(await assets.deleteUnlinkedAsset(replacement), null);
  await emails.deleteDraft(actor, draft.id);
  await db.update(schema.bulkEmails).set({ status: "SUCCESS" }).where(eq(schema.bulkEmails.id, scheduledId));
  assert.ok(await assets.deleteUnlinkedAsset(scheduled)); assert.ok(await assets.deleteUnlinkedAsset(replacement));
});

test("pending uploads cannot be published or retained by drafts and mail", opts, async () => {
  const pending = await asset("PENDING");
  const payload = { titleKo: "합성 게시글", contentKo: "본문", visibilityScope: "PUBLIC", assets: [{ assetId: pending, usageType: "ATTACHMENT", sortOrder: 0 }] };
  await assert.rejects(articles.createArticle({ boardId, authorUserId: actor, payload }), /article_asset_not_attachable/);
  const id = await article();
  await assert.rejects(articles.updateArticle(boardId, id, payload, actor), /article_asset_not_attachable/);
  await assert.rejects(drafts.create(actor, boardId, draftInput({ assets: payload.assets })), /asset_reference_unavailable/);
  await assert.rejects(emails.create(emailInput([pending])), /asset_reference_unavailable/);
  const foreign = await asset("COMPLETED", other);
  await assert.rejects(emails.saveDraft(actor, emailInput([foreign], "DRAFT")), /asset_reference_unavailable/);
});

test("saving a reference first fences cleanup; cleanup first rejects a stale draft or email save", opts, async () => {
  for (const kind of ["article", "mail"]) {
    const id = await asset();
    let signalSaved, release;
    const saved = new Promise(resolve => { signalSaved = resolve; });
    const gate = new Promise(resolve => { release = resolve; });
    const fencedDb = { transaction: callback => db.transaction(async tx => {
      const result = await callback(tx); signalSaved(); await gate; return result;
    }) };
    const saving = kind === "article"
      ? new ArticleDraftRepository(fencedDb).create(actor, boardId, draftInput({ assets: [{ assetId: id, usageType: "ATTACHMENT", sortOrder: 0 }] }))
      : new BulkEmailRepository(fencedDb).create(emailInput([id]));
    await saved;
    const cleaning = assets.deleteUnlinkedAsset(id);
    release(); await saving;
    assert.equal(await cleaning, null);
    const stale = await asset();
    assert.ok(await assets.deleteUnlinkedAsset(stale));
    await assert.rejects(kind === "article"
      ? drafts.create(actor, boardId, draftInput({ assets: [{ assetId: stale, usageType: "IMAGE", sortOrder: 0 }] }))
      : emails.create(emailInput([stale])), /asset_reference_unavailable/);
  }
});

test("renaming a roadmap course preserves its offerings and prerequisite links", opts, async () => {
  const repository = new RoadmapRepository(db);
  const initial = `${prefix}-A`.toUpperCase(), renamed = `${prefix}-B`.toUpperCase(), dependent = `${prefix}-C`.toUpperCase();
  await repository.createCourse(CreateRoadmapCourseSchema.parse({ courseCode: initial, nameKo: "합성 과목" }));
  await repository.createCourse(CreateRoadmapCourseSchema.parse({ courseCode: dependent, nameKo: "후속 과목", prerequisiteCourseCodes: [initial] }));
  const offering = await repository.createOffering({ term: "2026-fall", courseCode: initial, currentCode: initial, nameKo: "합성 개설 강좌", inEnglish: false }, actor);
  await repository.updateCourse(initial, { courseCode: renamed });
  const publicData = await repository.findPublicData();
  assert.equal(publicData.items.find(item => item.courseCode === renamed)?.nameKo, "합성 개설 강좌");
  assert.equal(publicData.items.some(item => item.courseCode === initial), false);
  assert.deepEqual((await repository.findCourseByCode(dependent)).prerequisiteCourseCodes, [renamed]);
  const stored = (await db.select().from(schema.roadmapOfferings).where(eq(schema.roadmapOfferings.offeringId, offering.offeringId)))[0];
  assert.equal(stored.courseCode, renamed); assert.equal(stored.currentCode, initial);
});
