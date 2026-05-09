import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { and, eq, sql } from "drizzle-orm";
import { articles, boards, permissions } from "../src/infrastructure/postgres/postgres.schema";

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL || DATABASE_URL.trim().length === 0) {
  throw new Error("DATABASE_URL is required for seeding");
}

const pool = new Pool({ connectionString: DATABASE_URL });
const db = drizzle(pool);

type BoardSeed = {
  code: string;
  nameKo: string;
  description: string;
  readScope: string;
  writePermissionId: number | null;
  commentPermissionId: number | null;
  managePermissionId: number | null;
  allowComment: boolean;
  allowSecret: boolean;
  allowLike: boolean;
  isActive: boolean;
  sortOrder: number;
};

type PermissionSeed = {
  permissionId: number;
  code: string;
  bitValue: number;
  nameKo: string;
  nameEn: string;
  description: string;
  isActive: boolean;
};

const PERMISSION_SEEDS: PermissionSeed[] = [
  {
    permissionId: 1,
    code: "BOARD_NOTICE_WRITE",
    bitValue: 1,
    nameKo: "공지 작성",
    nameEn: "Notice Write",
    description: "공지 게시판 글 작성 권한",
    isActive: true,
  },
  {
    permissionId: 2,
    code: "BOARD_HOC_WRITE",
    bitValue: 2,
    nameKo: "HoC 작성",
    nameEn: "HoC Write",
    description: "HoC 게시판 글 작성 권한",
    isActive: true,
  },
  {
    permissionId: 4,
    code: "BOARD_LAB_WRITE",
    bitValue: 4,
    nameKo: "연구실 작성",
    nameEn: "Lab Write",
    description: "연구실 게시판 글 작성 권한",
    isActive: true,
  },
  {
    permissionId: 16,
    code: "BOARD_QNA_WRITE",
    bitValue: 16,
    nameKo: "QnA 작성",
    nameEn: "QnA Write",
    description: "QnA 게시판 글 작성 권한",
    isActive: true,
  },
  {
    permissionId: 64,
    code: "SURVEY_MANAGE",
    bitValue: 64,
    nameKo: "설문 관리",
    nameEn: "Survey Manage",
    description: "설문 생성/수정/권한 관리 권한",
    isActive: true,
  },
];

const BOARD_SEEDS: BoardSeed[] = [
  {
    code: "공지",
    nameKo: "공지",
    description: "학생회 및 학교의 중요한 공지사항을 확인하세요",
    readScope: "PUBLIC",
    writePermissionId: 1,
    commentPermissionId: null,
    managePermissionId: null,
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
    commentPermissionId: null,
    managePermissionId: null,
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
    commentPermissionId: null,
    managePermissionId: null,
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
    commentPermissionId: null,
    managePermissionId: null,
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
    writePermissionId: null,
    commentPermissionId: null,
    managePermissionId: null,
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
    commentPermissionId: null,
    managePermissionId: null,
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
    commentPermissionId: null,
    managePermissionId: null,
    allowComment: true,
    allowSecret: false,
    allowLike: true,
    isActive: true,
    sortOrder: 6,
  },
];

async function seedPermissions() {
  const existing = await db.select({ code: permissions.code }).from(permissions);
  const existingCodes = new Set(existing.map((row) => row.code));
  const toInsert = PERMISSION_SEEDS.filter((permissionSeed) => !existingCodes.has(permissionSeed.code));

  if (toInsert.length === 0) {
    console.log("No new permissions to insert");
    return;
  }

  await db.insert(permissions).values(toInsert).onConflictDoNothing();
  console.log(`Inserted ${toInsert.length} permission(s)`);
}

async function seedBoards() {
  const existing = await db.select({ code: boards.code }).from(boards);
  const existingCodes = new Set(existing.map((row) => row.code));
  const toInsert = BOARD_SEEDS.filter((boardSeed) => !existingCodes.has(boardSeed.code));

  if (toInsert.length === 0) {
    console.log("No new boards to insert");
    return;
  }

  await db.insert(boards).values(toInsert).onConflictDoNothing();
  console.log(`Inserted ${toInsert.length} board(s)`);
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

  const seedAuthorResult = await db.execute<{ userId: number }>(sql`
    insert into users (sso_subject, kaist_uid, name_ko, email, is_active)
    values ('seed-notice-author', 'seed-notice-author', '관리자', 'admin@kaist.ac.kr', true)
    on conflict (sso_subject)
    do update
      set name_ko = excluded.name_ko,
          email = excluded.email,
          updated_at = now()
    returning user_id as "userId"
  `);

  const seedAuthor = seedAuthorResult.rows[0];
  if (!seedAuthor) {
    throw new Error("Failed to upsert seed notice author");
  }

  const [created] = await db
    .insert(articles)
    .values({
      boardId: noticeBoard.boardId,
      authorUserId: seedAuthor.userId,
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
  if (DATABASE_URL) {
    console.log("Using DATABASE_URL:", DATABASE_URL.replace(/:[^:@]+@/, ":****@"));
  }

  try {
    await seedDemoEventsIfExists();
    await seedPermissions();
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

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
