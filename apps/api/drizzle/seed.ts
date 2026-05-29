import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { and, eq, sql } from "drizzle-orm";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  articleAssets,
  articles,
  assets,
  boards,
  comments,
  permissions,
  surveys,
  users,
} from "../src/infrastructure/postgres/postgres.schema";
import { PERMISSION_REGISTRY } from "@soc/contracts";

const readRequiredEnv = (name: string): string => {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required for seeding`);
  }
  return value;
};

const buildDatabaseUrl = (): string => {
  const explicitUrl = process.env.DATABASE_URL?.trim();
  if (explicitUrl) return explicitUrl;

  const user = encodeURIComponent(readRequiredEnv("POSTGRES_USER"));
  const password = encodeURIComponent(readRequiredEnv("POSTGRES_PASSWORD"));
  const host = readRequiredEnv("POSTGRES_HOST");
  const port = readRequiredEnv("POSTGRES_PORT");
  const database = readRequiredEnv("POSTGRES_DB");

  return `postgresql://${user}:${password}@${host}:${port}/${database}`;
};

const DATABASE_URL = buildDatabaseUrl();
const pool = new Pool({ connectionString: DATABASE_URL });
const db = drizzle(pool);
const ASSET_UPLOAD_DIR =
  process.env.ASSET_UPLOAD_DIR ??
  path.resolve(process.cwd(), "uploads", "assets");
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
    writePermissionId: 2,
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
    writePermissionId: null,
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
  await db
    .insert(boards)
    .values(BOARD_SEEDS)
    .onConflictDoUpdate({
      target: boards.code,
      set: {
        allowComment: sql`excluded.allow_comment`,
        allowLike: sql`excluded.allow_like`,
        allowSecret: sql`excluded.allow_secret`,
        commentPermissionId: sql`excluded.comment_permission_id`,
        description: sql`excluded.description`,
        isActive: sql`excluded.is_active`,
        managePermissionId: sql`excluded.manage_permission_id`,
        nameKo: sql`excluded.name_ko`,
        readScope: sql`excluded.read_scope`,
        sortOrder: sql`excluded.sort_order`,
        writePermissionId: sql`excluded.write_permission_id`,
      },
    });
  console.log(`Upserted ${BOARD_SEEDS.length} board(s)`);
}

const recruitmentPosterSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="540" viewBox="0 0 960 540">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#fffdf7"/>
      <stop offset="1" stop-color="#eef8ef"/>
    </linearGradient>
    <linearGradient id="green" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#00693e"/>
      <stop offset="1" stop-color="#008a52"/>
    </linearGradient>
  </defs>
  <rect width="960" height="540" rx="12" fill="url(#bg)"/>
  <text x="480" y="74" text-anchor="middle" font-family="Arial, sans-serif" font-size="26" font-weight="800" fill="#007044">2026 전산학부</text>
  <text x="480" y="123" text-anchor="middle" font-family="Arial, sans-serif" font-size="48" font-weight="900" fill="#00633b">학생회 임원 모집 안내</text>
  <text x="480" y="157" text-anchor="middle" font-family="Arial, sans-serif" font-size="18" font-weight="700" fill="#00633b">전산학부 학생회의 임원으로 활발한 참여를 기다립니다!</text>
  <g transform="translate(62 207)">
    <g>
      <rect width="208" height="174" rx="10" fill="#fffdf9" stroke="#ccd9d1"/>
      <circle cx="88" cy="57" r="19" fill="none" stroke="#00693e" stroke-width="6"/>
      <circle cx="125" cy="57" r="19" fill="none" stroke="#00693e" stroke-width="6"/>
      <path d="M43 112c13-29 44-37 68-25 12-13 38-13 51 0 25-12 56-4 68 25" fill="none" stroke="#00693e" stroke-width="6" stroke-linecap="round"/>
      <text x="104" y="112" text-anchor="middle" font-family="Arial, sans-serif" font-size="21" font-weight="900" fill="#00693e">모집 대상</text>
      <text x="104" y="146" text-anchor="middle" font-family="Arial, sans-serif" font-size="17" font-weight="700" fill="#193529">전산학부 재학생</text>
    </g>
    <g transform="translate(208 0)">
      <rect width="208" height="174" rx="10" fill="#fffdf9" stroke="#ccd9d1"/>
      <path d="M58 72h40l55-31v94l-55-31H58z" fill="none" stroke="#00693e" stroke-width="7" stroke-linejoin="round"/>
      <path d="M169 65l22-16M172 88h27M169 111l22 16" stroke="#00693e" stroke-width="6" stroke-linecap="round"/>
      <text x="104" y="112" text-anchor="middle" font-family="Arial, sans-serif" font-size="21" font-weight="900" fill="#00693e">모집 부문</text>
      <text x="104" y="146" text-anchor="middle" font-family="Arial, sans-serif" font-size="17" font-weight="700" fill="#193529">기획 · 사무국 · 재정</text>
    </g>
    <g transform="translate(416 0)">
      <rect width="208" height="174" rx="10" fill="#fffdf9" stroke="#ccd9d1"/>
      <rect x="62" y="42" width="84" height="79" rx="5" fill="none" stroke="#00693e" stroke-width="7"/>
      <path d="M62 67h84M82 31v28M126 31v28" stroke="#00693e" stroke-width="7" stroke-linecap="round"/>
      <text x="104" y="112" text-anchor="middle" font-family="Arial, sans-serif" font-size="21" font-weight="900" fill="#00693e">지원 기간</text>
      <text x="104" y="145" text-anchor="middle" font-family="Arial, sans-serif" font-size="16" font-weight="700" fill="#193529">2026.05.20 ~ 06.03</text>
    </g>
    <g transform="translate(624 0)">
      <rect width="208" height="174" rx="10" fill="#fffdf9" stroke="#ccd9d1"/>
      <rect x="55" y="48" width="98" height="67" rx="4" fill="none" stroke="#00693e" stroke-width="7"/>
      <path d="M57 53l47 39 47-39" fill="none" stroke="#00693e" stroke-width="7" stroke-linejoin="round"/>
      <text x="104" y="112" text-anchor="middle" font-family="Arial, sans-serif" font-size="21" font-weight="900" fill="#00693e">지원 방법</text>
      <text x="104" y="145" text-anchor="middle" font-family="Arial, sans-serif" font-size="16" font-weight="700" fill="#193529">이메일 제출</text>
    </g>
  </g>
  <rect x="62" y="426" width="836" height="49" rx="7" fill="url(#green)"/>
  <text x="480" y="458" text-anchor="middle" font-family="Arial, sans-serif" font-size="22" font-weight="900" fill="white">꿈을 실현할 수 있는 소중한 기회, 2026 전산학부와 함께 성장해요!</text>
</svg>`;

async function writeSeedAsset(filename: string, content: string | Buffer): Promise<{
  storageKey: string;
  sizeBytes: number;
}> {
  await mkdir(ASSET_UPLOAD_DIR, { recursive: true });
  const filePath = path.join(ASSET_UPLOAD_DIR, filename);
  const buffer = Buffer.isBuffer(content) ? content : Buffer.from(content);
  await writeFile(filePath, buffer);
  return {
    storageKey: `/uploads/assets/${filename}`,
    sizeBytes: buffer.byteLength,
  };
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
  const detailedNoticeContent = [
    "전산학부 학생회는 학부 여러분의 의견을 반영하고 보다 나은 학부 문화를 만들어가기 위해 열정과 책임감 있는 임원분들을 모집합니다.",
    "",
    "• 모집 대상 : 전산학부에 재학 중인 학생 (휴학생 활동 가능)",
    "• 모집 부문 : 기획팀, 사무국, 재정(회계)팀, 홍보팀, 행사팀 등",
    "• 주요 역할 : 학생 행사 기획 및 운영, 회계 관리, 조직 운영 지원, 회의, 복지, 학우 관리 등",
    "• 지원 기간 : 2026.05.20 (수) ~ 2026.06.03 (수) 18:00",
    "• 서류 심사 : 서류 심사 2026.06.06 (토) 예정 | 최종 발표 2026.06.08 (월)",
    "• 지원 방법 : 지원서 작성 후 이메일 제출 (cs_suhak@kaist.ac.kr)",
  ].join("\n");

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
      contentKo: detailedNoticeContent,
      isPinned: false,
      viewCount: 16,
      postedAt: new Date("2026-05-20T01:00:00Z"),
      detailMock: true,
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
    const [articleRow] = await db.insert(articles).values({
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
    }).returning({ articleId: articles.articleId });

    if (item.detailMock && articleRow) {
      const poster = await writeSeedAsset(
        "seed-student-council-recruitment-poster.svg",
        recruitmentPosterSvg,
      );
      const applicationPdf = await writeSeedAsset(
        "seed-student-council-application.pdf",
        "Mock PDF attachment for the student council recruitment notice.\n",
      );
      const applicationXlsx = await writeSeedAsset(
        "seed-student-council-application-form.xlsx",
        "Mock spreadsheet attachment for the student council recruitment notice.\n",
      );

      const seededAssets = [
        {
          storageKey: poster.storageKey,
          originalFilename: "학생회_임원모집_포스터.svg",
          mimeType: "image/svg+xml",
          sizeBytes: Math.max(poster.sizeBytes, 88000),
          usageType: "THUMBNAIL",
          sortOrder: 0,
        },
        {
          storageKey: applicationPdf.storageKey,
          originalFilename: "학생회_임원모집_지원서.pdf",
          mimeType: "application/pdf",
          sizeBytes: 556400,
          usageType: "ATTACHMENT",
          sortOrder: 1,
        },
        {
          storageKey: applicationXlsx.storageKey,
          originalFilename: "지원서_양식.xlsx",
          mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          sizeBytes: 24800,
          usageType: "ATTACHMENT",
          sortOrder: 2,
        },
      ];

      for (const asset of seededAssets) {
        const [assetRow] = await db
          .insert(assets)
          .values({
            storageKey: asset.storageKey,
            originalFilename: asset.originalFilename,
            mimeType: asset.mimeType,
            sizeBytes: asset.sizeBytes,
            uploadedBy: seedAuthor.userId,
          })
          .onConflictDoUpdate({
            target: assets.storageKey,
            set: {
              originalFilename: sql`excluded.original_filename`,
              mimeType: sql`excluded.mime_type`,
              sizeBytes: sql`excluded.size_bytes`,
              uploadedBy: sql`excluded.uploaded_by`,
            },
          })
          .returning({ assetId: assets.assetId });

        if (!assetRow) continue;
        await db.insert(articleAssets).values({
          articleId: articleRow.articleId,
          assetId: assetRow.assetId,
          usageType: asset.usageType,
          sortOrder: asset.sortOrder,
        });
      }

      await db.insert(surveys).values({
        creatorId: seedAuthor.userId,
        kind: "APPLICATION",
        titleKo: "학생회 운영·행사 참여 의견 조사",
        titleEn: "Student Council Participation Survey",
        descriptionKo: "학생회 운영과 행사에 대한 여러분의 의견을 들려주세요. 더 나은 학부 문화를 함께 만들어갑니다.",
        descriptionEn: "Share feedback on student council operations and events.",
        status: "OPEN",
        connectedArticleId: articleRow.articleId,
        feeRequirementPolicy: "NONE",
        resultVisibility: "PUBLIC",
        isPublished: true,
        showOnCalendar: true,
        openAt: new Date("2026-05-20T01:00:00Z"),
        closeAt: new Date("2026-06-03T09:00:00Z"),
      });

      await db.insert(comments).values([
        {
          articleId: articleRow.articleId,
          authorUserId: seedAuthor.userId,
          content: "이번 신입 학생 및 지원에 대해 더 자세한 안내가 있으면 좋겠습니다.",
          createdAt: new Date("2026-05-20T01:15:00Z"),
          updatedAt: new Date("2026-05-20T01:15:00Z"),
        },
        {
          articleId: articleRow.articleId,
          authorUserId: seedAuthor.userId,
          content: "작년 활동이 정말 도움이 많이 되었어요. 이번에도 꼭 지원하고 싶어요.",
          createdAt: new Date("2026-05-20T02:02:00Z"),
          updatedAt: new Date("2026-05-20T02:02:00Z"),
        },
      ]);
    }
  }
  console.log("Seeded 5 mockup notice articles, including one detailed article with assets and survey");

  // Seeding 3 events
  const eventItems = [
    {
      titleKo: "2026 집행위원회 리더십 선거",
      titleEn: "2026 Student Council Leadership Election",
      contentKo: "더 나은 학과를 만들어갈 집행위원회 리더를 선출하는 중요한 선거에 참여해주세요.",
      eventDescription: "2026 집행위원회 리더십 선거 투표",
      eventStartDate: new Date("2026-05-24T09:00:00Z"),
      eventEndDate: new Date("2026-05-30T18:00:00Z"),
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
      eventDescription: "기말고사 기간 전산학부 간식 배부",
      eventStartDate: new Date("2026-04-17T09:00:00Z"),
      eventEndDate: new Date("2026-04-20T18:00:00Z"),
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
      eventDescription: "MT 안전 안내 및 조편성 사전모임",
      eventStartDate: new Date("2026-05-23T14:00:00Z"),
      eventEndDate: new Date("2026-05-23T16:00:00Z"),
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
      eventStartDate: event.eventStartDate,
      eventEndDate: event.eventEndDate,
      eventDescription: event.eventDescription,
      isAnonymous: false,
    }).returning({ articleId: articles.articleId });

    await db.insert(surveys).values({
      creatorId: seedAuthor.userId,
      kind: event.survey.kind,
      titleKo: event.titleKo,
      titleEn: event.titleEn,
      descriptionKo: event.eventDescription,
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
async function main() {
  console.log("Using database:", DATABASE_URL.replace(/:[^:@]+@/, ":****@"));
  try {
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
