import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { and, eq, sql } from "drizzle-orm";
import { articles, boards, permissions, surveys, users } from "../src/infrastructure/postgres/postgres.schema";
import { PERMISSION_REGISTRY } from "@soc/contracts";
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
/**
 * SSOT(permissions-registry.ts)에서 자동 생성되는 시드 데이터.
 * 새 권한을 추가하려면 permissions-registry.ts만 수정하면 됩니다.
 */
const PERMISSION_SEEDS = PERMISSION_REGISTRY.map((def) => ({
  permissionId: def.bit, // permissionId와 bitValue를 동일하게 유지
  code: def.code,
  bitValue: def.bit,
  nameKo: def.labelKo,
  nameEn: def.labelEn,
  description: def.description,
  isActive: true,
}));
const BOARD_SEEDS: BoardSeed[] = [
  {
    code: "공지",
    nameKo: "공지",
    description: "집행위원회 및 학교의 중요한 공지사항을 확인하세요",
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
    description: "집행위원회 및 학회의 홍보 게시물",
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
  await db
    .insert(permissions)
    .values(PERMISSION_SEEDS)
    .onConflictDoUpdate({
      target: permissions.bitValue,
      set: {
        code: sql`excluded.code`,
        nameKo: sql`excluded.name_ko`,
        nameEn: sql`excluded.name_en`,
        description: sql`excluded.description`,
        isActive: sql`excluded.is_active`,
      },
    });
  console.log(`Upserted ${PERMISSION_SEEDS.length} permission(s)`);
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
async function seedMockData() {
  const [noticeBoard] = await db
    .select({ boardId: boards.boardId })
    .from(boards)
    .where(eq(boards.code, "공지"))
    .limit(1);

  const [eventBoard] = await db
    .select({ boardId: boards.boardId })
    .from(boards)
    .where(eq(boards.code, "행사"))
    .limit(1);

  if (!noticeBoard || !eventBoard) {
    console.log("Boards not found, skipping mock data seed");
    return;
  }

  const seedAuthorResult = await db.execute<{ userId: string }>(sql`
    insert into users (kaist_uid, name_ko, email, is_active)
    values ('seed-notice-author', '관리자', 'seed-dev-admin@kaist.ac.kr', true)
    on conflict (kaist_uid)
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

  // Clear existing mock data to prevent duplicate seeds
  await db.execute(sql`delete from survey where creator_id = ${seedAuthor.userId}::uuid`);
  await db.execute(sql`delete from article where author_user_id = ${seedAuthor.userId}::uuid`);

  // Seeding 5 notices
  const noticeItems = [
    {
      titleKo: "전산학부 홈페이지 서버 점검 안내",
      contentKo: "전산학부 홈페이지 서버 정기 점검이 있을 예정입니다.",
      isPinned: true,
      pinOrder: 0,
      viewCount: 0,
      postedAt: new Date("2026-05-21T00:00:00Z"),
    },
    {
      titleKo: "2026 전산학부 집행위원회 임원 공개 모집",
      contentKo: "2026학년도 집행위원회를 빛내줄 열정 가득한 임원을 모집합니다.",
      isPinned: false,
      viewCount: 12,
      postedAt: new Date("2026-05-20T00:00:00Z"),
    },
    {
      titleKo: "2026 Apple Scholars in AIML Fellowship 추천 안내",
      contentKo: "2026 Apple Scholars AIML Fellowship 후보 추천 안내입니다.",
      isPinned: false,
      viewCount: 8,
      postedAt: new Date("2026-05-19T00:00:00Z"),
    },
    {
      titleKo: "전산학부 연구실 인턴십 프로그램 모집",
      contentKo: "전산학부 연구실 인턴십 참가자를 정규 모집합니다.",
      isPinned: false,
      viewCount: 3,
      postedAt: new Date("2026-05-18T00:00:00Z"),
    },
    {
      titleKo: "학부 수업 평가 및 피드백 설문 참여 요청",
      contentKo: "더 나은 학부 교육 환경을 위하여 수업 설문 평가 참여 부탁드립니다.",
      isPinned: false,
      viewCount: 5,
      postedAt: new Date("2026-05-16T00:00:00Z"),
    },
  ];

  for (const item of noticeItems) {
    await db.insert(articles).values({
      boardId: noticeBoard.boardId,
      authorUserId: seedAuthor.userId,
      titleKo: item.titleKo,
      contentKo: item.contentKo,
      visibilityScope: "PUBLIC",
      isPinned: item.isPinned,
      pinOrder: item.pinOrder,
      viewCount: item.viewCount,
      postedAt: item.postedAt,
      isAnonymous: false,
    });
  }
  console.log("Seeded 5 mockup notice articles");

  // Seeding 3 events
  const eventItems = [
    {
      titleKo: "2026 집행위원회 리더십 선거",
      titleEn: "2026 Student Council Leadership Election",
      contentKo: "더 나은 학과를 만들어갈 집행위원회 리더를 선출하는 중요한 선거에 참여해주세요.",
      isPinned: true,
      pinOrder: 0,
      postedAt: new Date("2026-05-24T00:00:00Z"),
      survey: {
        kind: "VOTE",
        status: "OPEN",
        openAt: new Date("2026-05-24T09:00:00Z"),
        closeAt: new Date("2026-05-30T18:00:00Z"),
      }
    },
    {
      titleKo: "기말고사 간식이벤트",
      titleEn: "Final Exam Snack Event",
      contentKo: "시험기간에 에너지 충전하고 열공! 기말고사 응원 간식배부 이벤트입니다.",
      isPinned: false,
      postedAt: new Date("2026-04-17T00:00:00Z"),
      survey: {
        kind: "APPLICATION",
        status: "CLOSED",
        openAt: new Date("2026-04-17T09:00:00Z"),
        closeAt: new Date("2026-04-20T18:00:00Z"),
      }
    },
    {
      titleKo: "MT 사전모임",
      titleEn: "MT Prep Meeting",
      contentKo: "전산학부 MT 출발 전 안전 수칙 안내 및 조편성을 위한 사전모임 신청입니다.",
      isPinned: false,
      postedAt: new Date("2026-05-23T00:00:00Z"),
      survey: {
        kind: "SURVEY",
        status: "OPEN",
        openAt: new Date("2026-05-23T14:00:00Z"),
        closeAt: new Date("2026-05-23T16:00:00Z"),
      }
    }
  ];

  for (const event of eventItems) {
    const [articleRow] = await db.insert(articles).values({
      boardId: eventBoard.boardId,
      authorUserId: seedAuthor.userId,
      titleKo: event.titleKo,
      titleEn: event.titleEn,
      contentKo: event.contentKo,
      visibilityScope: "PUBLIC",
      isPinned: event.isPinned,
      pinOrder: event.pinOrder,
      postedAt: event.postedAt,
      isAnonymous: false,
    }).returning({ articleId: articles.articleId });

    await db.insert(surveys).values({
      creatorId: seedAuthor.userId,
      kind: event.survey.kind,
      titleKo: event.titleKo,
      titleEn: event.titleEn,
      descriptionKo: event.contentKo,
      status: event.survey.status,
      connectedArticleId: articleRow.articleId,
      feeRequirementPolicy: "NONE",
      resultVisibility: "PUBLIC",
      isPublished: true,
      showOnCalendar: true,
      openAt: event.survey.openAt,
      closeAt: event.survey.closeAt,
    });
  }
  console.log("Seeded 3 mockup event articles and connected surveys");
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
    await seedMockData();
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
