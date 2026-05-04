import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { and, eq } from "drizzle-orm";
import { articles, boards, users } from "../src/infrastructure/postgres/postgres.schema";

const DATABASE_URL =
  process.env.DATABASE_URL;

const pool = new Pool({ connectionString: DATABASE_URL });
const db = drizzle(pool);

const BOARD_SEEDS = [
  {
    code: "공지",
    nameKo: "공지",
    description: "학생회 및 학교의 중요한 공지사항을 확인하세요",
    readScope: "PUBLIC",
    writePermissionId: 1,
    commentPermissionId: 0,
    managePermissionId: 0,
    allowComment: true,
    allowSecret: false,
    allowLike: true,
    isActive: true,
    sortOrder: 0,
  },
  {
    code: "행사",
    nameKo: "행사",
    description: "전산학부의 다양한 행사 정보를 확인하세요",
    readScope: "PUBLIC",
    writePermissionId: 1,
    commentPermissionId: 0,
    managePermissionId: 0,
    allowComment: true,
    allowSecret: false,
    allowLike: true,
    isActive: true,
    sortOrder: 1,
  },
  {
    code: "HoC",
    nameKo: "HoC",
    description: "Hall of Code 프로젝트 및 활동 내역",
    readScope: "PUBLIC",
    writePermissionId: 2,
    commentPermissionId: 0,
    managePermissionId: 0,
    allowComment: true,
    allowSecret: false,
    allowLike: true,
    isActive: true,
    sortOrder: 2,
  },
  {
    code: "홍보글",
    nameKo: "홍보글",
    description: "학생회 및 학회의 홍보 게시물",
    readScope: "PUBLIC",
    writePermissionId: 2,
    commentPermissionId: 0,
    managePermissionId: 0,
    allowComment: true,
    allowSecret: false,
    allowLike: true,
    isActive: true,
    sortOrder: 3,
  },
  {
    code: "건의사항",
    nameKo: "건의사항",
    description: "학생들의 의견과 건의사항을 나눠주세요",
    readScope: "PUBLIC",
    writePermissionId: 0,
    commentPermissionId: 0,
    managePermissionId: 0,
    allowComment: true,
    allowSecret: false,
    allowLike: true,
    isActive: true,
    sortOrder: 4,
  },
  {
    code: "연구실",
    nameKo: "연구실",
    description: "각 연구실의 소식과 공지사항",
    readScope: "PUBLIC",
    writePermissionId: 4,
    commentPermissionId: 0,
    managePermissionId: 0,
    allowComment: true,
    allowSecret: false,
    allowLike: true,
    isActive: true,
    sortOrder: 5,
  },
  {
    code: "QnA",
    nameKo: "QnA",
    description: "궁금한 점을 자유롭게 질문하세요",
    readScope: "PUBLIC",
    writePermissionId: 16,
    commentPermissionId: 0,
    managePermissionId: 0,
    allowComment: true,
    allowSecret: false,
    allowLike: true,
    isActive: true,
    sortOrder: 6,
  },
];

async function seedBoards() {
  // Select only the code column to avoid failures when DB schema is slightly
  // out-of-sync (e.g., missing non-critical columns like sort_order).
  const existing = await db.select({ code: boards.code }).from(boards);
  const existingCodes = new Set(existing.map((r) => r.code));
  const toInsert = BOARD_SEEDS.filter((b) => !existingCodes.has(b.code));
  if (toInsert.length === 0) {
    console.log("No new boards to insert");
    return;
  }
  // Some DBs may not yet have the `sort_order` column — detect and
  // insert only the columns that exist to avoid errors.
  const colCheck = await pool.query(
    "SELECT column_name FROM information_schema.columns WHERE table_name='board' AND column_name='sort_order'"
  );
  if (!colCheck.rowCount) {
    console.log("no rowcount");
    return;
  }
  const hasSortOrder = colCheck.rowCount > 0;

  if (hasSortOrder) {
    await db.insert(boards).values(toInsert); 
  console.log(`Inserted ${toInsert.length} board(s)`);
  return;
  }

  // If sort_order (or other new columns) don't exist, build a raw INSERT
  // using only columns that exist in the DB to avoid Drizzle generating
  // column names that the database doesn't know yet.
  const colRes = await pool.query(
    "SELECT column_name FROM information_schema.columns WHERE table_name='board'"
  );
  const allowed = new Set(colRes.rows.map((r: any) => r.column_name));

  const keyToCol: Record<string, string> = {
    code: "code",
    nameKo: "name_ko",
    nameEn: "name_en",
    description: "description",
    readScope: "read_scope",
    writePermissionId: "write_permission_id",
    commentPermissionId: "comment_permission_id",
    managePermissionId: "manage_permission_id",
    allowComment: "allow_comment",
    allowSecret: "allow_secret",
    allowLike: "allow_like",
    isActive: "is_active",
    sortOrder: "sort_order",
  };

  const cols = Object.keys(keyToCol)
    .map((k) => keyToCol[k])
    .filter((c) => allowed.has(c));
  if (cols.length === 0) throw new Error("No valid board columns found to insert");

  const params: any[] = [];
  const rowsPlaceholders = toInsert.map((seed) => {
    const vals = cols.map((col) => {
      const key = Object.keys(keyToCol).find((k) => keyToCol[k] === col)!;
      const v = (seed as any)[key];
      params.push(v === undefined ? null : v);
      return `$${params.length}`;
    });
    return `(${vals.join(",")})`;
  });

  const sql = `INSERT INTO board (${cols.join(",")}) VALUES ${rowsPlaceholders.join(",")} ON CONFLICT (code) DO NOTHING;`;
  await pool.query(sql, params);
  console.log(`Inserted ${toInsert.length} board(s) (using raw SQL)`);
}

async function seedNoticeArticle() {
  const [noticeBoard] = await db
    .select({ boardId: boards.boardId })
    .from(boards)
    .where(eq(boards.code, "공지"))
    .limit(1);

  if (!noticeBoard) {
    console.log("공지 board not found, skipping notice article seed");
    return;
  }

  const existing = await db
    .select({ articleId: articles.articleId })
    .from(articles)
    .where(
      and(
        eq(articles.boardId, noticeBoard.boardId),
        eq(articles.titleKo, "공지 테스트 게시글"),
      ),
    )
    .limit(1);

  if (existing.length > 0) {
    console.log("Notice test article already exists");
    return;
  }

  const [seedAuthor] = await db
    .insert(users)
    .values({
      ssoUserId: "seed-notice-author",
      name: "seed-notice-author",
      permission: 1,
      userEmail: null,
      userMobile: null,
      privacyConsentAt: null,
    })
    .onConflictDoUpdate({
      target: users.ssoUserId,
      set: {
        name: "seed-notice-author",
        permission: 1,
        updatedAt: new Date(),
      },
    })
    .returning({ id: users.id });

  const [created] = await db
    .insert(articles)
    .values({
      boardId: noticeBoard.boardId,
      authorUserId: seedAuthor.id,
      titleKo: "공지 테스트 게시글",
      contentKo: "게시판 API와 정렬을 확인하기 위한 테스트 공지입니다.",
      visibilityScope: "PUBLIC",
      isPinned: true,
      pinOrder: 0,
    })
    .returning({ articleId: articles.articleId });

  console.log(`Inserted notice test article: ${created.articleId}`);
}

async function seedDemoEventsIfExists() {
  // demo_events is outside drizzle schema; use raw SQL to conditionally insert
  const sql = `DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'demo_events') THEN
    INSERT INTO demo_events (event_name)
    VALUES ('seeded-event')
    ON CONFLICT DO NOTHING;
  END IF;
END $$;`;
  await pool.query(sql);
  console.log("demo_events seed attempted (if table existed)");
}

async function main() {
  console.log("Using DATABASE_URL:", DATABASE_URL.replace(/:[^:@]+@/, ':****@'));
  try {
    await seedDemoEventsIfExists();
    await seedBoards();
    await seedNoticeArticle();
    console.log("Seed finished");
  } catch (err) {
    console.error("Seed failed:", err);
    process.exitCode = 1;
  } finally {
      await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
