const assert = require("node:assert/strict");
const test = require("node:test");
const { randomUUID } = require("node:crypto");
const { Pool } = require("pg");
const { drizzle } = require("drizzle-orm/node-postgres");
const schema = require("../dist/apps/api/src/infrastructure/postgres/postgres.schema.js");
const { CommentRepository } = require("../dist/apps/api/src/features/board/repositories/comment.repository.js");
const { NotificationsRepository } = require("../dist/apps/api/src/features/notifications/notifications.repository.js");
const { NotificationsService } = require("../dist/apps/api/src/features/notifications/notifications.service.js");

test("comment notifications retain their board and unread filtering precedes pagination", {
  skip: !process.env.OPERATIONS_TEST_DATABASE_URL,
}, async () => {
  const name = "notification_test_" + randomUUID().replaceAll("-", "");
  const admin = new Pool({ connectionString: process.env.OPERATIONS_TEST_DATABASE_URL });
  let pool;
  try {
    await admin.query(`CREATE SCHEMA ${name}`);
    for (const table of ["board", "article", "comment", "notification"]) {
      await admin.query(`CREATE TABLE ${name}.${table} (LIKE public.${table} INCLUDING ALL)`);
    }
    pool = new Pool({ connectionString: process.env.OPERATIONS_TEST_DATABASE_URL, options: `-c search_path=${name},public` });
    const db = drizzle(pool, { schema });
    const comments = new CommentRepository(db);
    const notifications = new NotificationsRepository(db);
    const service = new NotificationsService(notifications);
    const recipient = randomUUID(), author = randomUUID();
    await db.insert(schema.boards).values(["notice", "suggestions", "_EVENT"].map((code, index) => ({
      boardId: index + 1, code, nameKo: `합성 ${code} 게시판`, nameEn: code, isActive: true,
    })));
    const boards = await db.select().from(schema.boards);
    for (const [index, code] of ["notice", "suggestions", "_EVENT"].entries()) {
      const board = boards.find((item) => item.code === code);
      assert.ok(board, `Missing synthetic board ${code}`);
      const articleId = index + 1;
      await db.insert(schema.articles).values({
        articleId, boardId: board.boardId, authorUserId: recipient,
        titleKo: `합성 ${code} 게시글`, contentKo: "합성 본문", status: "PUBLISHED",
      });
      await db.insert(schema.comments).values({ commentId: articleId, articleId, authorUserId: author, content: "합성 댓글" });
      const target = await comments.findNotificationTargets(String(articleId));
      assert.equal(target.boardCode, code);
      await service.notifyCommentCreated({ ...target, actorUserId: author, commentId: String(articleId) });
    }
    const linked = await notifications.listForUser(recipient, 1, 20);
    assert.deepEqual(new Set(linked.items.map((item) => item.link)), new Set([
      "/board/notice/1#comment-1", "/board/suggestions/2#comment-2", "/events/3#comment-3",
    ]));
    await notifications.markAllRead(recipient);
    const oldUnread = randomUUID();
    await db.insert(schema.notifications).values({
      notificationId: oldUnread, userId: recipient, actorUserId: author, type: "COMMENT_ON_ARTICLE",
      titleKo: "이전 미확인 알림", link: "/board/suggestions/2#comment-2", createdAt: new Date("2000-01-01Z"),
    });
    for (let index = 0; index < 5; index++) {
      await db.insert(schema.notifications).values({
        notificationId: randomUUID(), userId: recipient, actorUserId: author, type: "COMMENT_ON_ARTICLE",
        titleKo: "최근 읽은 알림", isRead: true, createdAt: new Date(`2001-01-0${index + 1}Z`),
      });
    }
    const history = await notifications.listForUser(recipient, 1, 5);
    assert.equal(history.unreadCount, 1);
    assert.ok(history.items.every((item) => item.isRead), "Default history remains backward compatible");
    const unread = await notifications.listForUser(recipient, 1, 5, true);
    assert.equal(unread.total, 1);
    assert.deepEqual(unread.items.map((item) => item.notificationId), [oldUnread]);
    await notifications.markRead(recipient, oldUnread);
    assert.equal((await notifications.listForUser(recipient, 1, 5, true)).total, 0);
  } finally {
    await pool?.end();
    assert.match(name, /^notification_test_[a-f0-9]+$/);
    await admin.query(`DROP SCHEMA IF EXISTS ${name} CASCADE`);
    await admin.end();
  }
});
