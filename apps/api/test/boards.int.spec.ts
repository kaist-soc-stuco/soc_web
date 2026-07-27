import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { ArticlesRepository } from '../src/features/boards/articles.repository';
import { BoardsRepository } from '../src/features/boards/boards.repository';
import { InteractionsRepository } from '../src/features/boards/interactions.repository';
import { InteractionsService } from '../src/features/boards/interactions.service';
import { PurgeRepository } from '../src/features/boards/purge.repository';
import { PurgeService } from '../src/features/boards/purge.service';

const databaseUrl = process.env.TEST_DATABASE_URL;
if (!databaseUrl) throw new Error('TEST_DATABASE_URL is required for board integration tests');
const parsedDatabaseUrl = new URL(databaseUrl);
if (
  !['postgres:', 'postgresql:'].includes(parsedDatabaseUrl.protocol)
  || !['127.0.0.1', 'localhost', '[::1]'].includes(parsedDatabaseUrl.hostname)
  || parsedDatabaseUrl.search !== ''
  || !/^soc_web_(?:test|qa)_[a-z0-9_]+$/.test(parsedDatabaseUrl.pathname.slice(1))
) {
  throw new Error('TEST_DATABASE_URL must target a disposable local soc_web test database');
}
const migrations = resolve(__dirname, '../drizzle');
const actorId = '11111111-1111-4111-8111-111111111111';
const now = new Date('2026-07-27T12:00:00.000Z');
let pool: Pool;
let articlesRepository: ArticlesRepository;
let boardsRepository: BoardsRepository;
let interactions: InteractionsRepository;
let interactionsService: InteractionsService;
let purge: PurgeService;
let purgeRepository: PurgeRepository;

/** Uses only a caller-provided PostgreSQL TEST_DATABASE_URL; no Docker or containers. */
describe('board PostgreSQL protocol', () => {
  beforeAll(async () => {
    pool = new Pool({ connectionString: databaseUrl });
    const db = drizzle(pool);
    await migrate(db, { migrationsFolder: migrations });
    articlesRepository = new ArticlesRepository(db as never);
    boardsRepository = new BoardsRepository(db as never);
    interactions = new InteractionsRepository(db as never);
    interactionsService = new InteractionsService(
      interactions,
      { hasPermission: async (userId: string, permission: string, scopeType: string) => userId === actorId && scopeType === 'GLOBAL' && ['BOARD_MANAGE', 'COMMITTEE_MEMBER'].includes(permission) } as never,
      { now: () => now } as never,
      { get: (_key: string, fallback?: number) => fallback ?? 30, getOrThrow: () => 30 } as never,
    );
    purgeRepository = new PurgeRepository(db as never);
    purge = new PurgeService(
      purgeRepository,
      { hasPermission: async (userId: string, permission: string, scopeType: string) => userId === actorId && permission === 'BOARD_MANAGE' && scopeType === 'GLOBAL' } as never,
      { nowMs: () => now.getTime() } as never,
      { get: (_key: string, fallback?: number) => fallback ?? 30 } as never,
    );
  });
  beforeEach(async () => {
    await pool.query('TRUNCATE permission_audit_log, purge_audit_log, legal_holds, article_reactions, assets, comments, articles CASCADE');
    await pool.query("DELETE FROM boards WHERE code NOT IN ('soc-notice', 'soc-events', 'human-of-cs', 'external-promotion', 'suggestions', 'laboratories', 'escamp')");
    await pool.query(`INSERT INTO permission_definitions (key, description)
      VALUES ('BOARD_MANAGE', 'boards'), ('COMMITTEE_MEMBER', 'committee')
      ON CONFLICT (key) DO NOTHING`);
    await pool.query(`INSERT INTO users (id, sso_user_id, sso_subject)
      VALUES ($1, 'boards-int-actor', 'boards-int-subject')
      ON CONFLICT (id) DO UPDATE SET sso_user_id = EXCLUDED.sso_user_id, sso_subject = EXCLUDED.sso_subject`, [actorId]);
  });
  afterAll(async () => { await pool?.end(); });

  async function article(status: 'PUBLISHED' | 'DELETED' = 'DELETED', purgeAfter = new Date(now.getTime() - 1_000)) {
    const result = await pool.query<{ id: string }>(`INSERT INTO articles
      (board_id, author_user_id, title_kr, title_en, body_kr, body_en, status, scope, deleted_at, purge_after, published_at)
      SELECT id, $1, '제목', 'title', '본문', 'body', $2::article_status, 'ALL',
        CASE WHEN $2 = 'DELETED' THEN $3::timestamptz ELSE NULL::timestamptz END,
        CASE WHEN $2 = 'DELETED' THEN $4::timestamptz ELSE NULL::timestamptz END,
        CASE WHEN $2 = 'PUBLISHED' THEN $5::timestamptz ELSE NULL::timestamptz END
      FROM boards WHERE code = 'suggestions' RETURNING id`, [
        actorId,
        status,
        new Date(Math.min(now.getTime(), purgeAfter.getTime() - 1_000)),
        purgeAfter,
        now,
      ]);
    return result.rows[0]!.id;
  }
  async function comment(articleId: string, parentCommentId: string | null = null, purgeAfter = new Date(now.getTime() - 1_000)) {
    const result = await pool.query<{ id: string }>(`INSERT INTO comments
      (article_id, parent_comment_id, author_user_id, body, status, deleted_at, purge_after)
      VALUES ($1, $2, $3, 'comment', 'DELETED', $4, $5) RETURNING id`, [
        articleId,
        parentCommentId,
        actorId,
        new Date(Math.min(now.getTime(), purgeAfter.getTime() - 1_000)),
        purgeAfter,
      ]);
    return result.rows[0]!.id;
  }
  async function liveComment(articleId: string, parentCommentId: string | null = null) {
    const result = await pool.query<{ id: string }>(`INSERT INTO comments
      (article_id, parent_comment_id, author_user_id, body, status)
      VALUES ($1, $2, $3, 'comment', 'PUBLISHED') RETURNING id`, [articleId, parentCommentId, actorId]);
    return result.rows[0]!.id;
  }
  async function asset(
    articleId: string,
    objectDeletionStatus: 'PENDING' | 'FAILED' | 'DELETED',
    purgeAfter = new Date(now.getTime() - 1_000),
  ) {
    const result = await pool.query<{ id: string }>(`INSERT INTO assets
      (article_id, display_order, type, status, provider, object_key, content_type, byte_size, object_deletion_status, initiated_by_user_id, deleted_at, purge_after)
      VALUES ($1, (SELECT count(*) FROM assets WHERE article_id = $1), 'IMAGE', 'DELETED', 'test', 'private/secret-object-key', 'image/png', 1, $2::asset_object_deletion_status, $3, $4, $5) RETURNING id`, [
        articleId,
        objectDeletionStatus,
        actorId,
        new Date(Math.min(now.getTime(), purgeAfter.getTime() - 1_000)),
        purgeAfter,
      ]);
    return result.rows[0]!.id;
  }
  async function waitForBlockedCommentMutation() {
    const deadline = Date.now() + 2_000;
    while (Date.now() < deadline) {
      const result = await pool.query<{ blocked: boolean }>(`SELECT EXISTS (
        SELECT 1 FROM pg_stat_activity
        WHERE datname = current_database()
          AND pid <> pg_backend_pid()
          AND wait_event_type = 'Lock'
          AND query LIKE '%"comments"%'
      ) AS blocked`);
      if (result.rows[0]?.blocked) return;
      await new Promise((resolvePromise) => setTimeout(resolvePromise, 10));
    }
    throw new Error('comment mutation did not reach the PostgreSQL lock queue');
  }

  it('has exactly the seven idempotently seeded boards with full policy tuples', async () => {
    const migrationSql = readFileSync(resolve(migrations, '0004_cute_hedge_knight.sql'), 'utf8');
    const seedStatement = migrationSql.match(/INSERT INTO "boards"[\s\S]*?ON CONFLICT \("code"\) DO NOTHING;/)?.[0];
    expect(seedStatement).toBeTruthy();
    await pool.query(seedStatement!);
    await pool.query(seedStatement!);
    const boards = await pool.query<{
      code: string; read_permission: string; write_permission: string; comment_permission: string;
      comments_allowed: boolean; secret_articles_allowed: boolean; reactions_allowed: boolean;
      display_order: number; is_hidden: boolean; show_on_home: boolean;
    }>('SELECT code, read_permission, write_permission, comment_permission, comments_allowed, secret_articles_allowed, reactions_allowed, display_order, is_hidden, show_on_home FROM boards ORDER BY display_order');
    expect(boards.rows).toEqual([
      { code: 'soc-notice', read_permission: 'PUBLIC', write_permission: 'COMMITTEE', comment_permission: 'AUTHENTICATED', comments_allowed: true, secret_articles_allowed: false, reactions_allowed: true, display_order: 10, is_hidden: false, show_on_home: true },
      { code: 'soc-events', read_permission: 'PUBLIC', write_permission: 'COMMITTEE', comment_permission: 'AUTHENTICATED', comments_allowed: true, secret_articles_allowed: false, reactions_allowed: true, display_order: 20, is_hidden: false, show_on_home: true },
      { code: 'human-of-cs', read_permission: 'PUBLIC', write_permission: 'COMMITTEE', comment_permission: 'AUTHENTICATED', comments_allowed: true, secret_articles_allowed: false, reactions_allowed: true, display_order: 30, is_hidden: false, show_on_home: true },
      { code: 'external-promotion', read_permission: 'PUBLIC', write_permission: 'COMMITTEE', comment_permission: 'AUTHENTICATED', comments_allowed: true, secret_articles_allowed: false, reactions_allowed: true, display_order: 40, is_hidden: false, show_on_home: true },
      { code: 'suggestions', read_permission: 'PUBLIC', write_permission: 'AUTHENTICATED', comment_permission: 'AUTHENTICATED', comments_allowed: true, secret_articles_allowed: true, reactions_allowed: true, display_order: 50, is_hidden: false, show_on_home: true },
      { code: 'laboratories', read_permission: 'PUBLIC', write_permission: 'COMMITTEE', comment_permission: 'AUTHENTICATED', comments_allowed: true, secret_articles_allowed: false, reactions_allowed: true, display_order: 60, is_hidden: false, show_on_home: true },
      { code: 'escamp', read_permission: 'PUBLIC', write_permission: 'COMMITTEE', comment_permission: 'AUTHENTICATED', comments_allowed: true, secret_articles_allowed: false, reactions_allowed: true, display_order: 70, is_hidden: false, show_on_home: true },
    ]);
    expect((await pool.query("SELECT key FROM permission_definitions WHERE key IN ('BOARD_MANAGE', 'COMMITTEE_MEMBER') ORDER BY key")).rows)
      .toEqual([{ key: 'BOARD_MANAGE' }, { key: 'COMMITTEE_MEMBER' }]);
  });
  it('rejects invalid deletion, retention, asset deletion, and legal-hold lifecycles', async () => {
    const liveArticle = await article('PUBLISHED');
    await expect(pool.query("UPDATE articles SET purge_after = $2 WHERE id = $1", [liveArticle, now])).rejects.toMatchObject({ code: '23514' });
    await expect(pool.query("UPDATE articles SET status = 'DELETED', deleted_at = $2, purge_after = NULL WHERE id = $1", [liveArticle, now])).rejects.toMatchObject({ code: '23514' });
    await expect(pool.query("UPDATE articles SET status = 'DELETED', deleted_at = $2, purge_after = $3 WHERE id = $1", [liveArticle, now, new Date(now.getTime() - 1)])).rejects.toMatchObject({ code: '23514' });

    const deletedArticle = await article();
    await expect(pool.query("INSERT INTO comments (article_id, author_user_id, body, status, deleted_at, purge_after) VALUES ($1, $2, 'live', 'PUBLISHED', NULL, $3)", [deletedArticle, actorId, now])).rejects.toMatchObject({ code: '23514' });
    await expect(pool.query("INSERT INTO comments (article_id, author_user_id, body, status, deleted_at, purge_after) VALUES ($1, $2, 'deleted', 'DELETED', $3, NULL)", [deletedArticle, actorId, now])).rejects.toMatchObject({ code: '23514' });
    await expect(pool.query("INSERT INTO assets (article_id, display_order, type, status, provider, object_key, content_type, byte_size, object_deletion_status, initiated_by_user_id) VALUES ($1, 99, 'IMAGE', 'INITIATED', 'test', 'private/key', 'image/png', 1, 'DELETED', $2)", [deletedArticle, actorId])).rejects.toMatchObject({ code: '23514' });
    await expect(pool.query("INSERT INTO assets (article_id, display_order, type, status, provider, object_key, content_type, byte_size, object_deletion_status, initiated_by_user_id, deleted_at, purge_after) VALUES ($1, 98, 'IMAGE', 'DELETED', 'test', 'private/key', 'image/png', 1, 'PENDING', $2, $3, NULL)", [deletedArticle, actorId, now])).rejects.toMatchObject({ code: '23514' });
    await expect(pool.query("INSERT INTO assets (article_id, display_order, type, status, provider, object_key, content_type, byte_size, object_deletion_status, initiated_by_user_id, completed_at) VALUES ($1, 97, 'IMAGE', 'INITIATED', 'test', 'private/key', 'image/png', 1, 'PENDING', $2, $3)", [deletedArticle, actorId, now])).rejects.toMatchObject({ code: '23514' });
    await expect(pool.query("INSERT INTO assets (article_id, display_order, type, status, provider, object_key, content_type, byte_size, object_deletion_status, initiated_by_user_id) VALUES ($1, 96, 'IMAGE', 'COMPLETED', 'test', 'private/key', 'image/png', 1, 'PENDING', $2)", [deletedArticle, actorId])).rejects.toMatchObject({ code: '23514' });

    await expect(pool.query("INSERT INTO legal_holds (article_id, status, reason_code, placed_by_user_id, released_at) VALUES ($1, 'RELEASED', 'RETENTION', $2, $3)", [deletedArticle, actorId, now])).rejects.toMatchObject({ code: '23514' });
    await expect(pool.query("INSERT INTO legal_holds (article_id, status, reason_code, placed_by_user_id, released_by_user_id) VALUES ($1, 'ACTIVE', 'RETENTION', $2, $2)", [deletedArticle, actorId])).rejects.toMatchObject({ code: '23514' });
    await expect(pool.query("INSERT INTO legal_holds (article_id, status, reason_code, placed_by_user_id) VALUES ($1, 'ACTIVE', 'RETENTION', $2)", ['99999999-9999-4999-8999-999999999999', actorId])).rejects.toMatchObject({ code: '23503' });
    await expect(pool.query("INSERT INTO purge_audit_log (subject_type, subject_id, action, correlation_id) VALUES ('ARTICLE', $1, 'PURGED', ' ')", [deletedArticle])).rejects.toMatchObject({ code: '23514' });
  });
  it('blocks direct deletion under an active hold and retains audit after released-hold cleanup', async () => {
    const id = await article();
    const hold = await purge.placeLegalHold({
      actorUserId: actorId,
      subjectType: 'ARTICLE',
      subjectId: id,
      reasonCode: 'DIRECT_DELETE_GUARD',
      correlationId: 'direct-hold',
    });
    const shadowClient = await pool.connect();
    try {
      await shadowClient.query('CREATE TEMP TABLE legal_holds (status text, article_id uuid, comment_id uuid, asset_id uuid)');
      await shadowClient.query('SET search_path = pg_temp, public');
      await expect(shadowClient.query('DELETE FROM articles WHERE id = $1', [id]))
        .rejects.toMatchObject({ code: '23503', message: 'active_legal_hold' });
    } finally {
      await shadowClient.query('DROP TABLE pg_temp.legal_holds');
      await shadowClient.query('RESET search_path');
      shadowClient.release();
    }
    await purge.releaseLegalHold(hold!.id, { actorUserId: actorId, correlationId: 'direct-release' });
    await pool.query('DELETE FROM articles WHERE id = $1', [id]);
    expect((await pool.query('SELECT count(*) FROM legal_holds WHERE id = $1', [hold!.id])).rows[0]!.count).toBe('0');
    expect((await pool.query('SELECT action, correlation_id FROM purge_audit_log WHERE subject_id = $1 ORDER BY occurred_at, action', [id])).rows)
      .toEqual(expect.arrayContaining([
        { action: 'HELD', correlation_id: 'direct-hold' },
        { action: 'CANCELLED', correlation_id: 'direct-release' },
      ]));
  });
  it('blocks direct deletion of held comments, held assets, and their parent aggregate', async () => {
    const parentId = await article();
    const commentId = await comment(parentId);
    const assetId = await asset(parentId, 'DELETED');
    await purge.placeLegalHold({
      actorUserId: actorId, subjectType: 'COMMENT', subjectId: commentId,
      reasonCode: 'DIRECT_CHILD_GUARD', correlationId: 'direct-comment-hold',
    });
    await purge.placeLegalHold({
      actorUserId: actorId, subjectType: 'ASSET', subjectId: assetId,
      reasonCode: 'DIRECT_CHILD_GUARD', correlationId: 'direct-asset-hold',
    });

    await expect(pool.query('DELETE FROM comments WHERE id = $1', [commentId]))
      .rejects.toMatchObject({ code: '23503', message: 'active_legal_hold' });
    await expect(pool.query('DELETE FROM assets WHERE id = $1', [assetId]))
      .rejects.toMatchObject({ code: '23503', message: 'active_legal_hold' });
    await expect(pool.query('DELETE FROM articles WHERE id = $1', [parentId]))
      .rejects.toMatchObject({ code: '23503' });
    expect((await pool.query('SELECT count(*) FROM comments WHERE id = $1', [commentId])).rows[0]!.count).toBe('1');
    expect((await pool.query('SELECT count(*) FROM assets WHERE id = $1', [assetId])).rows[0]!.count).toBe('1');
    expect((await pool.query("SELECT count(*) FROM purge_audit_log WHERE subject_id = ANY($1) AND action = 'HELD'", [[commentId, assetId]])).rows[0]!.count).toBe('2');
  });
  it('applies an article legal hold to every child purge path', async () => {
    const articleId = await article();
    const commentId = await comment(articleId);
    const assetId = await asset(articleId, 'DELETED');
    await purge.placeLegalHold({
      actorUserId: actorId,
      subjectType: 'ARTICLE',
      subjectId: articleId,
      reasonCode: 'AGGREGATE_CHILD_GUARD',
      correlationId: 'aggregate-child-hold',
    });

    await expect(purgeRepository.listExpiredCommentIds(now, 20)).resolves.not.toContainEqual({ id: commentId });
    await expect(purgeRepository.listExpiredAssetIds(now, 20)).resolves.not.toContainEqual({ id: assetId });
    await expect(purgeRepository.purgeComment(commentId, now, 'aggregate-comment-purge')).resolves.toBe(false);
    await expect(purgeRepository.purgeAsset(assetId, now, 'aggregate-asset-purge')).resolves.toBe(false);
    expect((await pool.query('SELECT count(*) FROM comments WHERE id = $1', [commentId])).rows[0]!.count).toBe('1');
    expect((await pool.query('SELECT count(*) FROM assets WHERE id = $1', [assetId])).rows[0]!.count).toBe('1');
  });

  it('enforces board code/order uniqueness and same-article comment parents', async () => {
    await expect(pool.query("INSERT INTO boards (code,title_kr,title_en,description_kr,description_en,read_permission,write_permission,comment_permission,comments_allowed,secret_articles_allowed,reactions_allowed,display_order,is_hidden,show_on_home) VALUES ('suggestions','a','a','a','a','PUBLIC','AUTHENTICATED','AUTHENTICATED',true,false,true,99,false,false)")).rejects.toMatchObject({ code: '23505' });
    await expect(pool.query("INSERT INTO boards (code,title_kr,title_en,description_kr,description_en,read_permission,write_permission,comment_permission,comments_allowed,secret_articles_allowed,reactions_allowed,display_order,is_hidden,show_on_home) VALUES ('test-board','a','a','a','a','PUBLIC','AUTHENTICATED','AUTHENTICATED',true,false,true,50,false,false)")).rejects.toMatchObject({ code: '23505' });
    const first = await article();
    const second = await article();
    const parent = await comment(first);
    await expect(pool.query("INSERT INTO comments (article_id,parent_comment_id,author_user_id,body,status,deleted_at,purge_after) VALUES ($1,$2,$3,'bad','DELETED',$4,$5)", [second, parent, actorId, now, now])).rejects.toMatchObject({ code: '23503' });
  });

  it('upserts concurrent reactions to one unique article/user record', async () => {
    const id = await article('PUBLISHED');
    await Promise.all(Array.from({ length: 16 }, (_, index) => interactions.putReaction(
      id, actorId, index % 2 ? 'LIKE' : 'DISLIKE', now, `concurrent-reaction-${index}`, async () => {},
    )));
    const rows = await pool.query<{ type: string }>('SELECT type FROM article_reactions WHERE article_id = $1 AND user_id = $2', [id, actorId]);
    expect(rows.rows).toHaveLength(1);
    expect(['LIKE', 'DISLIKE']).toContain(rows.rows[0]!.type);
  });

  it('rolls back comment mutation when its transactional audit cannot be written', async () => {
    const id = await article('PUBLISHED');
    await pool.query("CREATE FUNCTION reject_comment_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action = 'COMMENT_CREATED' THEN RAISE EXCEPTION 'reject audit'; END IF; RETURN NEW; END; $$");
    await pool.query('CREATE TRIGGER reject_comment_audit_trigger BEFORE INSERT ON permission_audit_log FOR EACH ROW EXECUTE FUNCTION reject_comment_audit()');
    try {
      await expect(interactions.createComment({
        articleId: id,
        parentCommentId: null,
        authorUserId: actorId,
        body: 'atomic',
        status: 'PUBLISHED',
        purgeAfter: new Date(now.getTime() + 86_400_000),
        createdAt: now,
        updatedAt: now,
      }, 'comment-audit-rollback', async () => {})).rejects.toThrow();
      expect((await pool.query('SELECT count(*) FROM comments')).rows[0]!.count).toBe('0');
    } finally {
      await pool.query('DROP TRIGGER reject_comment_audit_trigger ON permission_audit_log; DROP FUNCTION reject_comment_audit()');
    }
  });
  it('rolls back every board and article mutation when its audit insertion fails', async () => {
    const boardResult = await pool.query<{ id: string }>(`INSERT INTO boards
      (code,title_kr,title_en,description_kr,description_en,read_permission,write_permission,comment_permission,comments_allowed,secret_articles_allowed,reactions_allowed,display_order,is_hidden,show_on_home)
      VALUES ('audit-board','감사','Audit','감사','Audit','PUBLIC','AUTHENTICATED','AUTHENTICATED',true,false,true,999,false,false)
      RETURNING id`);
    const auditBoardId = boardResult.rows[0]!.id;
    const auditArticleId = await article('PUBLISHED');
    await pool.query("UPDATE articles SET status = 'DRAFT', published_at = NULL WHERE id = $1", [auditArticleId]);

    await pool.query("CREATE FUNCTION reject_board_content_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action LIKE 'BOARD_%' OR NEW.action LIKE 'ARTICLE_%' THEN RAISE EXCEPTION 'reject board content audit'; END IF; RETURN NEW; END; $$");
    await pool.query('CREATE TRIGGER reject_board_content_audit_trigger BEFORE INSERT ON permission_audit_log FOR EACH ROW EXECUTE FUNCTION reject_board_content_audit()');
    try {
      await expect(boardsRepository.create({
        actorUserId: actorId, correlationId: 'board-create-audit-failure', now,
        changedFieldNames: 'record',
        values: {
          code: 'audit-create', titleKr: '생성', titleEn: 'Create', descriptionKr: '설명', descriptionEn: 'Description',
          readPermission: 'PUBLIC', writePermission: 'AUTHENTICATED', commentPermission: 'AUTHENTICATED',
          commentsAllowed: true, secretArticlesAllowed: false, reactionsAllowed: true,
          displayOrder: 1000, isHidden: false, showOnHome: false,
        },
      })).rejects.toThrow();
      expect((await pool.query("SELECT count(*) FROM boards WHERE code = 'audit-create'")).rows[0]!.count).toBe('0');

      await expect(boardsRepository.patch(auditBoardId, {
        actorUserId: actorId, correlationId: 'board-patch-audit-failure', now,
        changedFieldNames: 'title', values: { titleEn: 'Changed' },
      })).rejects.toThrow();
      expect((await pool.query('SELECT title_en FROM boards WHERE id = $1', [auditBoardId])).rows).toEqual([{ title_en: 'Audit' }]);

      await expect(boardsRepository.delete(auditBoardId, actorId, 'board-delete-audit-failure')).rejects.toThrow();
      expect((await pool.query('SELECT count(*) FROM boards WHERE id = $1', [auditBoardId])).rows[0]!.count).toBe('1');

      await expect(articlesRepository.create('suggestions', actorId, 'article-create-audit-failure', async (lockedBoard) => ({
        boardId: lockedBoard.id, authorUserId: actorId,
        titleKr: '생성', titleEn: 'Audit create', bodyKr: '본문', bodyEn: 'Body',
        status: 'DRAFT', scope: 'ALL', isPinned: false, pinnedOrder: null,
        createdAt: now, updatedAt: now,
      }))).rejects.toThrow();
      expect((await pool.query("SELECT count(*) FROM articles WHERE title_en = 'Audit create'")).rows[0]!.count).toBe('0');

      await expect(articlesRepository.patch(auditArticleId, actorId, 'article-patch-audit-failure', async () => ({
        values: { titleEn: 'Changed' }, changedFieldNames: 'title',
      }))).rejects.toThrow();
      expect((await pool.query('SELECT title_en FROM articles WHERE id = $1', [auditArticleId])).rows).toEqual([{ title_en: 'title' }]);

      await expect(articlesRepository.publish(auditArticleId, actorId, 'article-publish-audit-failure', async () => ({
        status: 'PUBLISHED', publishedAt: now, updatedAt: now,
      }))).rejects.toThrow();
      expect((await pool.query('SELECT status, published_at FROM articles WHERE id = $1', [auditArticleId])).rows)
        .toEqual([{ status: 'DRAFT', published_at: null }]);

      await expect(articlesRepository.softDelete(auditArticleId, actorId, 'article-delete-audit-failure', async () => ({
        status: 'DELETED', deletedAt: now, purgeAfter: new Date(now.getTime() + 86_400_000), updatedAt: now,
      }))).rejects.toThrow();
      expect((await pool.query('SELECT status, deleted_at, purge_after FROM articles WHERE id = $1', [auditArticleId])).rows)
        .toEqual([{ status: 'DRAFT', deleted_at: null, purge_after: null }]);
    } finally {
      await pool.query('DROP TRIGGER reject_board_content_audit_trigger ON permission_audit_log; DROP FUNCTION reject_board_content_audit()');
    }
  });
  it('rolls back purge, hold placement, and hold release when audit insertion fails', async () => {
    const purgeTarget = await article();
    const heldTarget = await article('PUBLISHED');
    await expect(purge.placeLegalHold({
      actorUserId: '22222222-2222-4222-8222-222222222222',
      subjectType: 'ARTICLE',
      subjectId: heldTarget,
      reasonCode: 'OUTSIDER',
      correlationId: 'outsider-hold',
    })).rejects.toMatchObject({ response: { message: 'insufficient_permission' } });
    const hold = await purge.placeLegalHold({
      actorUserId: actorId,
      subjectType: 'ARTICLE',
      subjectId: heldTarget,
      reasonCode: 'AUDIT_ROLLBACK',
      correlationId: 'hold-before-trigger',
    });
    expect(hold).toBeTruthy();
    await pool.query("CREATE FUNCTION reject_purge_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'reject purge audit'; END; $$");
    await pool.query('CREATE TRIGGER reject_purge_audit_trigger BEFORE INSERT ON purge_audit_log FOR EACH ROW EXECUTE FUNCTION reject_purge_audit()');
    try {
      await expect(purge.run({ correlationId: 'purge-audit-failure' })).rejects.toThrow();
      expect((await pool.query('SELECT count(*) FROM articles WHERE id = $1', [purgeTarget])).rows[0]!.count).toBe('1');

      await expect(purge.placeLegalHold({
        actorUserId: actorId,
        subjectType: 'ARTICLE',
        subjectId: purgeTarget,
        reasonCode: 'AUDIT_ROLLBACK',
        correlationId: 'hold-audit-failure',
      })).rejects.toThrow();
      expect((await pool.query('SELECT count(*) FROM legal_holds WHERE article_id = $1', [purgeTarget])).rows[0]!.count).toBe('0');

      await expect(purge.releaseLegalHold(hold!.id, {
        actorUserId: actorId,
        correlationId: 'release-audit-failure',
      })).rejects.toThrow();
      expect((await pool.query('SELECT status FROM legal_holds WHERE id = $1', [hold!.id])).rows).toEqual([{ status: 'ACTIVE' }]);
      expect((await pool.query('SELECT action, correlation_id FROM purge_audit_log WHERE subject_id = $1', [heldTarget])).rows)
        .toEqual([{ action: 'HELD', correlation_id: 'hold-before-trigger' }]);
    } finally {
      await pool.query('DROP TRIGGER reject_purge_audit_trigger ON purge_audit_log; DROP FUNCTION reject_purge_audit()');
    }
  });
  it('does not resurrect a comment when a patch waits behind a committed deletion', async () => {
    const id = await article('PUBLISHED');
    const idToMutate = await liveComment(id);
    const lock = await pool.connect();
    try {
      await lock.query('BEGIN');
      await lock.query(
        "UPDATE comments SET status = 'DELETED', deleted_at = $2, purge_after = $3, updated_at = $2 WHERE id = $1",
        [idToMutate, now, new Date(now.getTime() + 30 * 86_400_000)],
      );
      const patching = expect(interactionsService.patchComment(actorId, idToMutate, { body: 'resurrect?' }, 'patch-after-delete'))
        .rejects.toMatchObject({ response: { message: 'comment_deleted' } });
      await waitForBlockedCommentMutation();
      await lock.query('COMMIT');
      await patching;
    } finally {
      lock.release();
    }
    expect((await pool.query<{ status: string; body: string }>('SELECT status, body FROM comments WHERE id = $1', [idToMutate])).rows)
      .toEqual([{ status: 'DELETED', body: 'comment' }]);
    expect((await pool.query("SELECT action FROM permission_audit_log WHERE record_id = $1", [idToMutate])).rows).toEqual([]);
  });
  it('makes concurrent repeated deletes idempotent with the original retention deadline and audit', async () => {
    const id = await article('PUBLISHED');
    const idToDelete = await liveComment(id);
    await Promise.all([
      interactionsService.deleteComment(actorId, idToDelete, 'first-delete'),
      interactionsService.deleteComment(actorId, idToDelete, 'second-delete'),
    ]);
    const row = (await pool.query<{ purge_after: Date }>('SELECT purge_after FROM comments WHERE id = $1', [idToDelete])).rows[0]!;
    expect(row.purge_after).toEqual(new Date(now.getTime() + 30 * 86_400_000));
    const audit = (await pool.query<{ correlation_id: string }>("SELECT correlation_id FROM permission_audit_log WHERE record_id = $1 AND action = 'COMMENT_DELETED'", [idToDelete])).rows;
    expect(audit).toHaveLength(1);
    expect(['first-delete', 'second-delete']).toContain(audit[0]!.correlation_id);
  });
  it('rejects a reply to an already deleted parent without inserting or auditing', async () => {
    const id = await article('PUBLISHED');
    const parent = await liveComment(id);
    await pool.query("UPDATE comments SET status = 'DELETED', deleted_at = $2, purge_after = $3 WHERE id = $1", [parent, now, new Date(now.getTime() + 86_400_000)]);
    await expect(interactionsService.createComment(actorId, id, { body: 'reply', parentCommentId: parent }, 'stale-parent'))
      .rejects.toMatchObject({ response: { message: 'parent_comment_deleted' } });
    expect((await pool.query('SELECT count(*) FROM comments WHERE article_id = $1', [id])).rows[0]!.count).toBe('1');
    expect((await pool.query("SELECT count(*) FROM permission_audit_log WHERE correlation_id = 'stale-parent'")).rows[0]!.count).toBe('0');
  });
  it('rejects comment and reaction writes after article or board state changes, without audits', async () => {
    for (const status of ['DRAFT', 'DELETED'] as const) {
      const id = await article('PUBLISHED');
      await pool.query(`UPDATE articles SET
        status = $2::article_status,
        published_at = NULL,
        deleted_at = CASE WHEN $2 = 'DELETED' THEN $3::timestamptz ELSE NULL::timestamptz END,
        purge_after = CASE WHEN $2 = 'DELETED' THEN $4::timestamptz ELSE NULL::timestamptz END
        WHERE id = $1`, [id, status, now, new Date(now.getTime() + 86_400_000)]);
      await expect(interactionsService.createComment(actorId, id, { body: 'blocked' }, `comment-${status}`)).rejects.toMatchObject({ response: { message: 'article_not_found' } });
      await expect(interactionsService.putReaction(actorId, id, { type: 'LIKE' }, `reaction-${status}`)).rejects.toMatchObject({ response: { message: 'article_not_found' } });
    }
    const id = await article('PUBLISHED');
    await pool.query("UPDATE boards SET comments_allowed = false, reactions_allowed = false WHERE code = 'suggestions'");
    try {
      await expect(interactionsService.createComment(actorId, id, { body: 'blocked' }, 'comment-feature-disabled')).rejects.toMatchObject({ response: { message: 'comments_disabled' } });
      await expect(interactionsService.putReaction(actorId, id, { type: 'LIKE' }, 'reaction-feature-disabled')).rejects.toMatchObject({ response: { message: 'reactions_disabled' } });
    } finally {
      await pool.query("UPDATE boards SET comments_allowed = true, reactions_allowed = true WHERE code = 'suggestions'");
    }
    expect((await pool.query('SELECT count(*) FROM comments')).rows[0]!.count).toBe('0');
    expect((await pool.query('SELECT count(*) FROM article_reactions')).rows[0]!.count).toBe('0');
    expect((await pool.query('SELECT count(*) FROM permission_audit_log')).rows[0]!.count).toBe('0');
  });
  it('records each interaction audit with its supplied request correlation ID', async () => {
    const id = await article('PUBLISHED');
    const created = await interactionsService.createComment(actorId, id, { body: 'audit' }, 'request-create');
    await interactionsService.putReaction(actorId, id, { type: 'LIKE' }, 'request-reaction');
    expect((await pool.query<{ action: string; correlation_id: string }>(
      'SELECT action, correlation_id FROM permission_audit_log WHERE record_id = ANY($1) ORDER BY action',
      [[created.id, id]],
    )).rows).toEqual([
      { action: 'COMMENT_CREATED', correlation_id: 'request-create' },
      { action: 'REACTION_PUT', correlation_id: 'request-reaction' },
    ]);
  });
  it('gives an old live article a full grace period when it is deleted now', async () => {
    const id = await article('PUBLISHED');
    const createdAt = new Date(now.getTime() - 365 * 86_400_000);
    const purgeAfter = new Date(now.getTime() + 30 * 86_400_000);
    await pool.query('UPDATE articles SET created_at = $2, status = $3, deleted_at = $4, purge_after = $5 WHERE id = $1', [id, createdAt, 'DELETED', now, purgeAfter]);

    expect((await purge.run({ correlationId: 'old-live-deleted-now' })).articlesPurged).toBe(0);
    expect((await pool.query<{ deleted_at: Date; purge_after: Date }>('SELECT deleted_at, purge_after FROM articles WHERE id = $1', [id])).rows)
      .toEqual([{ deleted_at: now, purge_after: purgeAfter }]);
  });
  it('does not purge soft-deleted articles or comments before their deterministic deadlines', async () => {
    const future = new Date(now.getTime() + 86_400_000);
    const id = await article('DELETED', future);
    const commentId = await comment(id, null, future);
    const result = await purge.run({ correlationId: 'before-deadline' });
    expect(result.articlesPurged).toBe(0);
    expect(result.commentsPurged).toBe(0);
    expect((await pool.query('SELECT count(*) FROM articles WHERE id = $1', [id])).rows[0]!.count).toBe('1');
    expect((await pool.query('SELECT count(*) FROM comments WHERE id = $1', [commentId])).rows[0]!.count).toBe('1');
  });

  it('serializes an unheld concurrent hold and purge into one accountable outcome', async () => {
    const id = await article();
    const [purgeResult, held] = await Promise.all([
      purge.run({ correlationId: 'race-purge' }),
      purge.placeLegalHold({ actorUserId: actorId, subjectType: 'ARTICLE', subjectId: id, reasonCode: 'RACE_HOLD', correlationId: 'race-hold' }),
    ]);
    const remaining = (await pool.query('SELECT count(*) FROM articles WHERE id = $1', [id])).rows[0]!.count;

    if (held) {
      expect(remaining).toBe('1');
      expect(purgeResult.articlesPurged).toBe(0);
      await purge.releaseLegalHold(held.id, { actorUserId: actorId, correlationId: 'release-1' });
      expect((await purge.run({ correlationId: 'purge-release' })).articlesPurged).toBe(1);
    } else {
      expect(remaining).toBe('0');
      expect(purgeResult.articlesPurged).toBe(1);
    }
    const audit = (await pool.query<{ action: string; correlation_id: string }>(
      'SELECT action, correlation_id FROM purge_audit_log WHERE subject_id = $1 ORDER BY occurred_at, action',
      [id],
    )).rows;
    if (held) {
      expect(audit).toEqual(expect.arrayContaining([
        { action: 'HELD', correlation_id: 'race-hold' },
        { action: 'CANCELLED', correlation_id: 'release-1' },
        { action: 'PURGED', correlation_id: 'purge-release' },
      ]));
      expect(audit).not.toContainEqual({ action: 'PURGED', correlation_id: 'race-purge' });
    } else {
      expect(audit).toEqual([{ action: 'PURGED', correlation_id: 'race-purge' }]);
    }
    expect((await pool.query('SELECT count(*) FROM articles WHERE id = $1', [id])).rows[0]!.count).toBe('0');
  });

  it('keeps blocked assets and child-held parents, then physically purges only deleted objects idempotently', async () => {
    const id = await article();
    const pending = await asset(id, 'PENDING');
    const failed = await asset(id, 'FAILED');
    const deleted = await asset(id, 'DELETED');
    const child = await comment(id);
    await purge.placeLegalHold({ actorUserId: actorId, subjectType: 'COMMENT', subjectId: child, reasonCode: 'CHILD_HOLD', correlationId: 'child-hold' });
    const first = await purge.run({ correlationId: 'purge-assets' });
    expect(first.assetsPurged).toBe(1);
    expect(first.articlesPurged).toBe(0);
    expect((await pool.query('SELECT id FROM assets WHERE id = ANY($1)', [[pending, failed]])).rows).toHaveLength(2);
    expect((await pool.query('SELECT count(*) FROM assets WHERE id = $1', [deleted])).rows[0]!.count).toBe('0');
    await pool.query("UPDATE legal_holds SET status = 'RELEASED', released_at = $1, released_by_user_id = $2 WHERE comment_id = $3", [now, actorId, child]);
    await purge.run({ correlationId: 'purge-repeat' });
    const again = await purge.run({ correlationId: 'purge-repeat-again' });
    expect(again.articlesPurged).toBe(0);
    const audit = await pool.query<{ correlation_id: string; subject_id: string }>("SELECT correlation_id, subject_id FROM purge_audit_log WHERE action = 'PURGED' ORDER BY occurred_at");
    expect(audit.rows).toContainEqual({ correlation_id: 'purge-assets', subject_id: deleted });
    const columns = await pool.query<{ column_name: string }>("SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'purge_audit_log' ORDER BY ordinal_position");
    expect(columns.rows.map(({ column_name }) => column_name)).toEqual([
      'id', 'subject_type', 'subject_id', 'action', 'actor_user_id', 'legal_hold_id', 'correlation_id', 'occurred_at',
    ]);
    const auditRows = await pool.query('SELECT * FROM purge_audit_log');
    expect(Object.keys(auditRows.rows[0]!).sort()).toEqual([
      'action', 'actor_user_id', 'correlation_id', 'id', 'legal_hold_id', 'occurred_at', 'subject_id', 'subject_type',
    ]);
    expect(JSON.stringify(auditRows.rows)).not.toMatch(/content|object_key|secret-object-key/i);
  });
  it('filters a blocked prefix before applying the bounded purge batch', async () => {
    const blockedAt = new Date(now.getTime() - 10_000);
    const eligibleAt = new Date(now.getTime() - 1_000);

    for (let index = 0; index < 3; index += 1) {
      const blockedArticle = await article('DELETED', blockedAt);
      const heldAsset = await asset(blockedArticle, 'DELETED', blockedAt);
      await purge.placeLegalHold({
        actorUserId: actorId, subjectType: 'ASSET', subjectId: heldAsset,
        reasonCode: 'RETENTION', correlationId: `blocked-asset-hold-${index}`,
      });
      const parent = await comment(blockedArticle, null, blockedAt);
      await comment(blockedArticle, parent, new Date(now.getTime() + 1_000));
    }

    const assetArticle = await article('DELETED', eligibleAt);
    const eligibleAsset = await asset(assetArticle, 'DELETED', eligibleAt);
    await asset(assetArticle, 'PENDING', eligibleAt);
    const commentArticle = await article('DELETED', eligibleAt);
    await asset(commentArticle, 'PENDING', eligibleAt);
    const eligibleComment = await comment(commentArticle, null, eligibleAt);
    const eligibleArticle = await article('DELETED', eligibleAt);

    const result = await purge.run({ batchSize: 2, correlationId: 'blocked-prefix' });

    expect(result.assetsPurged).toBe(1);
    expect(result.commentsPurged).toBe(1);
    expect(result.articlesPurged).toBe(0);
    expect(result.skipped).toBe(0);
    expect((await pool.query('SELECT count(*) FROM assets WHERE id = $1', [eligibleAsset])).rows[0]!.count).toBe('0');
    expect((await pool.query('SELECT count(*) FROM comments WHERE id = $1', [eligibleComment])).rows[0]!.count).toBe('0');
    expect((await pool.query('SELECT count(*) FROM articles WHERE id = $1', [eligibleArticle])).rows[0]!.count).toBe('1');
    expect((await pool.query("SELECT count(*) FROM purge_audit_log WHERE correlation_id = 'blocked-prefix' AND action = 'PURGED'")).rows[0]!.count).toBe('2');

    const next = await purge.run({ batchSize: 2, correlationId: 'blocked-prefix-next' });
    expect(next.articlesPurged).toBe(1);
    expect((await pool.query('SELECT count(*) FROM articles WHERE id = $1', [eligibleArticle])).rows[0]!.count).toBe('0');
  });
});
