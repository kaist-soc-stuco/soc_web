import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq, sql } from "drizzle-orm";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  articleAssets,
  articles,
  assets,
  boards,
  comments,
  permissions,
  surveyQuestions,
  surveySections,
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

type QuestionSeed = {
  titleKo: string;
  titleEn?: string;
  descriptionKo?: string;
  descriptionEn?: string;
  questionType:
    | "short_text"
    | "long_text"
    | "single_choice"
    | "multiple_choice"
    | "dropdown"
    | "date"
    | "time"
    | "datetime";
  options?: Array<{ value: string; labelKo: string; labelEn?: string }>;
  isRequired?: boolean;
  sortOrder: number;
};

type SurveySeed = {
  kind: "APPLICATION" | "SURVEY" | "VOTE";
  titleKo: string;
  titleEn: string;
  descriptionKo: string;
  descriptionEn: string;
  feeRequirementPolicy: "NONE" | "PAID_ONLY";
  allowMultipleResponses: boolean;
  allowResponseEdit: boolean;
  resultVisibility: "PUBLIC" | "PRIVATE";
  maxResponseCount?: number;
  openAt: Date;
  closeAt: Date;
  sections: Array<{
    titleKo: string;
    titleEn?: string;
    descriptionKo?: string;
    descriptionEn?: string;
    sortOrder: number;
    questions: QuestionSeed[];
  }>;
};

type ArticleAssetSeed = {
  filename: string;
  content: string | Buffer;
  originalFilename: string;
  mimeType: string;
  usageType: "IMAGE" | "ATTACHMENT" | "THUMBNAIL";
  sortOrder: number;
  sizeBytes?: number;
};

function makeSeedPosterSvg(input: {
  eyebrow: string;
  title: string;
  subtitle: string;
  dateLine: string;
  accent: string;
  accentDark: string;
}) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="540" viewBox="0 0 960 540">
  <rect width="960" height="540" rx="24" fill="#f8fafc"/>
  <rect x="48" y="48" width="864" height="444" rx="22" fill="white" stroke="#dbe3ea" stroke-width="2"/>
  <rect x="48" y="48" width="864" height="138" rx="22" fill="${input.accent}"/>
  <circle cx="780" cy="112" r="112" fill="${input.accentDark}" opacity="0.18"/>
  <circle cx="842" cy="74" r="56" fill="#ffffff" opacity="0.18"/>
  <text x="96" y="100" font-family="Arial, sans-serif" font-size="24" font-weight="800" fill="#ffffff" opacity="0.92">${input.eyebrow}</text>
  <text x="96" y="154" font-family="Arial, sans-serif" font-size="44" font-weight="900" fill="#ffffff">${input.title}</text>
  <text x="96" y="260" font-family="Arial, sans-serif" font-size="30" font-weight="900" fill="${input.accentDark}">${input.subtitle}</text>
  <rect x="96" y="306" width="768" height="2" fill="#e2e8f0"/>
  <text x="96" y="366" font-family="Arial, sans-serif" font-size="26" font-weight="800" fill="#1e293b">${input.dateLine}</text>
  <text x="96" y="430" font-family="Arial, sans-serif" font-size="22" font-weight="700" fill="#64748b">KAIST School of Computing Student Council</text>
</svg>`;
}

async function cleanupSeedContent() {
  await db.execute(sql`
    delete from survey
    where creator_id in (
      select user_id from users
      where kaist_uid in ('seed-notice-author', 'seed-council-author')
    )
  `);

  await db.execute(sql`
    delete from article
    where author_user_id in (
      select user_id from users
      where kaist_uid in ('seed-notice-author', 'seed-council-author')
    )
  `);

  await db.execute(sql`
    delete from asset
    where storage_key like '/uploads/assets/seed-%'
      and uploaded_by in (
        select user_id from users
        where kaist_uid in ('seed-notice-author', 'seed-council-author')
      )
  `);

  await db.execute(sql`delete from users where kaist_uid = 'seed-notice-author'`);
}

async function upsertSeedAuthor() {
  const seedAuthorResult = await db.execute<{ userId: string }>(sql`
    insert into users (
      kaist_uid,
      name_ko,
      name_en,
      email,
      dept_ko,
      dept_en,
      academic_status,
      identity_code,
      is_active
    )
    values (
      'seed-council-author',
      '전산학부 학생회',
      'SoC Student Council',
      'student-council@kaist.ac.kr',
      '전산학부',
      'School of Computing',
      '운영',
      'O',
      true
    )
    on conflict (kaist_uid)
    do update
      set name_ko = excluded.name_ko,
          name_en = excluded.name_en,
          email = excluded.email,
          dept_ko = excluded.dept_ko,
          dept_en = excluded.dept_en,
          academic_status = excluded.academic_status,
          identity_code = excluded.identity_code,
          updated_at = now()
    returning user_id as "userId"
  `);
  const seedAuthor = seedAuthorResult.rows[0];
  if (!seedAuthor) {
    throw new Error("Failed to upsert seed author");
  }
  return seedAuthor;
}

async function attachAssetsToArticle(
  articleId: number,
  uploadedBy: string,
  assetSeeds: ArticleAssetSeed[],
) {
  for (const asset of assetSeeds) {
    const written = await writeSeedAsset(asset.filename, asset.content);
    const [assetRow] = await db
      .insert(assets)
      .values({
        storageKey: written.storageKey,
        originalFilename: asset.originalFilename,
        mimeType: asset.mimeType,
        sizeBytes: asset.sizeBytes ?? written.sizeBytes,
        uploadedBy,
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
      articleId,
      assetId: assetRow.assetId,
      usageType: asset.usageType,
      sortOrder: asset.sortOrder,
    });
  }
}

async function createSurveyWithQuestions(
  seed: SurveySeed,
  creatorId: string,
  connectedArticleId: number,
) {
  const [surveyRow] = await db
    .insert(surveys)
    .values({
      creatorId,
      kind: seed.kind,
      titleKo: seed.titleKo,
      titleEn: seed.titleEn,
      descriptionKo: seed.descriptionKo,
      descriptionEn: seed.descriptionEn,
      connectedArticleId,
      feeRequirementPolicy: seed.feeRequirementPolicy,
      allowMultipleResponses: seed.allowMultipleResponses,
      allowResponseEdit: seed.allowResponseEdit,
      resultVisibility: seed.resultVisibility,
      maxResponseCount: seed.maxResponseCount,
      isPublished: true,
      showOnCalendar: true,
      openAt: seed.openAt,
      closeAt: seed.closeAt,
    })
    .returning({ surveyId: surveys.surveyId });

  if (!surveyRow) {
    throw new Error(`Failed to create survey: ${seed.titleKo}`);
  }

  for (const section of seed.sections) {
    const [sectionRow] = await db
      .insert(surveySections)
      .values({
        surveyId: surveyRow.surveyId,
        titleKo: section.titleKo,
        titleEn: section.titleEn,
        descriptionKo: section.descriptionKo,
        descriptionEn: section.descriptionEn,
        sortOrder: section.sortOrder,
      })
      .returning({ id: surveySections.id });

    if (!sectionRow) {
      throw new Error(`Failed to create survey section: ${section.titleKo}`);
    }

    await db.insert(surveyQuestions).values(
      section.questions.map((question) => ({
        sectionId: sectionRow.id,
        titleKo: question.titleKo,
        titleEn: question.titleEn,
        descriptionKo: question.descriptionKo,
        descriptionEn: question.descriptionEn,
        questionType: question.questionType,
        options: question.options,
        isRequired: question.isRequired ?? true,
        sortOrder: question.sortOrder,
      })),
    );
  }
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

  await cleanupSeedContent();
  const seedAuthor = await upsertSeedAuthor();

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
      titleKo: "2026 봄학기 전산학부 학생회 운영 안내",
      titleEn: "Spring 2026 Student Council Operations Notice",
      contentKo: [
        "안녕하세요, 전산학부 학생회입니다.",
        "",
        "2026 봄학기 동안 학생회는 공지 전달, 행사 운영, 복지 물품 관리, 건의사항 접수 창구를 통합하여 운영합니다.",
        "학생회실 방문이 필요한 경우 아래 운영 시간을 확인해 주세요.",
        "",
        "• 운영 기간: 2026.03.02 ~ 2026.06.19",
        "• 학생회실 운영 시간: 평일 12:30 ~ 13:30, 18:00 ~ 19:00",
        "• 주요 업무: 회비 납부 확인, 행사 문의, 복지 물품 대여, 학부 건의 접수",
        "• 문의: student-council@kaist.ac.kr",
        "",
        "급한 문의는 홈페이지 문의 게시판 또는 학생회 대표 메일로 남겨주시면 확인 후 순차적으로 답변드리겠습니다.",
      ].join("\n"),
      contentEn: [
        "Hello, this is the School of Computing Student Council.",
        "",
        "During Spring 2026, the council will operate integrated channels for notices, events, welfare item rentals, and student feedback.",
        "",
        "• Period: 2026.03.02 ~ 2026.06.19",
        "• Office hours: Weekdays 12:30 ~ 13:30, 18:00 ~ 19:00",
        "• Contact: student-council@kaist.ac.kr",
      ].join("\n"),
      isPinned: true,
      pinOrder: 0,
      viewCount: 142,
      postedAt: new Date("2026-05-21T09:00:00+09:00"),
      poster: makeSeedPosterSvg({
        eyebrow: "COUNCIL NOTICE",
        title: "봄학기 운영 안내",
        subtitle: "학생회실 운영 · 복지 물품 · 문의 창구",
        dateLine: "2026 SPRING SEMESTER",
        accent: "#007044",
        accentDark: "#005f3a",
      }),
    },
    {
      titleKo: "2026 전산학부 집행위원회 임원 공개 모집",
      titleEn: "2026 SoC Executive Committee Recruitment",
      contentKo: detailedNoticeContent,
      contentEn: [
        "The School of Computing Student Council is recruiting executive committee members for 2026.",
        "",
        "We welcome students who want to plan events, improve student welfare, and build better communication channels within the department.",
        "",
        "• Eligibility: SoC undergraduate and graduate students",
        "• Teams: Planning, Administration, Finance, PR, Events",
        "• Application period: 2026.05.20 ~ 2026.06.03 18:00",
        "• How to apply: Submit the application form by email",
      ].join("\n"),
      isPinned: false,
      viewCount: 87,
      postedAt: new Date("2026-05-20T10:00:00+09:00"),
      poster: recruitmentPosterSvg,
      detailMock: true,
    },
    {
      titleKo: "전산학부 라운지 이용 및 물품 대여 안내",
      titleEn: "SoC Lounge and Welfare Item Rental Guide",
      contentKo: [
        "전산학부 라운지와 학생회 보유 물품 대여 절차를 안내드립니다.",
        "",
        "라운지는 학부 구성원의 휴식과 소규모 모임을 위한 공간입니다. 모두가 편하게 사용할 수 있도록 이용 후 정리와 쓰레기 분리배출을 부탁드립니다.",
        "",
        "• 이용 가능 시간: 평일 09:00 ~ 22:00",
        "• 대여 가능 물품: 보드게임, 멀티탭, HDMI 케이블, 발표용 리모컨",
        "• 대여 방법: 학생회실 운영 시간 내 방문 또는 홈페이지 문의 접수",
        "• 유의사항: 파손 또는 분실 시 동일 물품 기준으로 보상 요청이 있을 수 있습니다.",
      ].join("\n"),
      contentEn: [
        "This notice explains how to use the SoC lounge and borrow welfare items managed by the student council.",
        "",
        "Please keep the lounge clean and return borrowed items on time.",
      ].join("\n"),
      isPinned: false,
      viewCount: 64,
      postedAt: new Date("2026-05-18T11:30:00+09:00"),
      poster: makeSeedPosterSvg({
        eyebrow: "LOUNGE GUIDE",
        title: "라운지 이용 안내",
        subtitle: "공간 이용과 물품 대여 절차",
        dateLine: "평일 09:00 ~ 22:00",
        accent: "#0f766e",
        accentDark: "#115e59",
      }),
    },
    {
      titleKo: "2026 여름방학 학부생 연구참여 프로그램 안내",
      titleEn: "Summer 2026 Undergraduate Research Participation Program",
      contentKo: [
        "전산학부 연구실에서 여름방학 동안 진행하는 학부생 연구참여 프로그램을 안내드립니다.",
        "",
        "본 프로그램은 연구 주제 탐색, 세미나 참여, 기초 실험 및 구현 경험을 통해 연구실 생활을 미리 경험해볼 수 있도록 마련되었습니다.",
        "",
        "• 신청 기간: 2026.05.27 ~ 2026.06.10",
        "• 활동 기간: 2026.06.24 ~ 2026.08.14",
        "• 대상: 전산학부 학부생",
        "• 신청 방법: 희망 연구실별 안내 문서 확인 후 개별 지원",
        "",
        "연구실별 모집 인원과 요구 선수과목이 다르므로 첨부된 안내 문서를 반드시 확인해 주세요.",
      ].join("\n"),
      contentEn: [
        "The School of Computing announces undergraduate research participation opportunities for Summer 2026.",
        "",
        "Students should check each lab's requirements and apply directly according to the guide.",
      ].join("\n"),
      isPinned: false,
      viewCount: 51,
      postedAt: new Date("2026-05-17T15:00:00+09:00"),
      poster: makeSeedPosterSvg({
        eyebrow: "RESEARCH PROGRAM",
        title: "연구참여 프로그램",
        subtitle: "여름방학 학부생 연구실 참여 안내",
        dateLine: "06.24 ~ 08.14",
        accent: "#2563eb",
        accentDark: "#1d4ed8",
      }),
    },
    {
      titleKo: "학부 사물함 정리 및 신규 신청 일정 안내",
      titleEn: "Locker Cleanup and New Application Schedule",
      contentKo: [
        "학부 사물함 정리 및 2026 여름학기 신규 신청 일정을 안내드립니다.",
        "",
        "기존 사용자 중 연장을 희망하는 학생은 기간 내 연장 신청을 완료해야 하며, 미신청 사물함은 정리 대상에 포함됩니다.",
        "",
        "• 기존 사용자 연장 신청: 2026.06.01 ~ 2026.06.07",
        "• 미사용 사물함 정리: 2026.06.09",
        "• 신규 신청 접수: 2026.06.10 ~ 2026.06.14",
        "• 배정 결과 공지: 2026.06.17",
      ].join("\n"),
      contentEn: [
        "This notice provides the locker cleanup and new application schedule for Summer 2026.",
        "",
        "Current users must submit an extension request within the designated period.",
      ].join("\n"),
      isPinned: false,
      viewCount: 33,
      postedAt: new Date("2026-05-15T13:00:00+09:00"),
      poster: makeSeedPosterSvg({
        eyebrow: "LOCKER NOTICE",
        title: "사물함 신청 안내",
        subtitle: "연장 신청 · 정리 · 신규 배정 일정",
        dateLine: "06.01 ~ 06.17",
        accent: "#7c3aed",
        accentDark: "#5b21b6",
      }),
    },
  ];

  for (const item of noticeItems) {
    const [articleRow] = await db.insert(articles).values({
      boardId: noticeBoard.boardId,
      authorUserId: seedAuthor.userId,
      titleKo: item.titleKo,
      titleEn: item.titleEn,
      contentKo: item.contentKo,
      contentEn: item.contentEn,
      visibilityScope: "PUBLIC",
      isPinned: item.isPinned,
      pinOrder: item.pinOrder,
      viewCount: item.viewCount,
      postedAt: item.postedAt,
      isAnonymous: false,
    }).returning({ articleId: articles.articleId });

    if (!articleRow) continue;

    const seededAssets: ArticleAssetSeed[] = [
      {
        filename: `seed-notice-${articleRow.articleId}-poster.svg`,
        content: item.poster,
        originalFilename: `${item.titleKo}_포스터.svg`,
        mimeType: "image/svg+xml",
        sizeBytes: 88000,
        usageType: "THUMBNAIL",
        sortOrder: 0,
      },
    ];

    if (item.detailMock && articleRow) {
      seededAssets.push(
        {
          filename: "seed-student-council-application.pdf",
          content: "Student council recruitment application guide.\n",
          originalFilename: "학생회_임원모집_지원서.pdf",
          mimeType: "application/pdf",
          sizeBytes: 556400,
          usageType: "ATTACHMENT",
          sortOrder: 1,
        },
        {
          filename: "seed-student-council-application-form.xlsx",
          content: "Student council recruitment application form template.\n",
          originalFilename: "지원서_양식.xlsx",
          mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          sizeBytes: 24800,
          usageType: "ATTACHMENT",
          sortOrder: 2,
        },
      );

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

    await attachAssetsToArticle(articleRow.articleId, seedAuthor.userId, seededAssets);
  }
  console.log("Seeded 5 notice articles with realistic copy and attachments");

  const eventItems = [
    {
      titleKo: "전산인의 밤: 봄학기 네트워킹 데이",
      titleEn: "SoC Night: Spring Networking Day",
      contentKo: [
        "전산학부 구성원이 한자리에 모여 프로젝트 경험, 연구실 생활, 진로 고민을 나누는 네트워킹 행사를 진행합니다.",
        "",
        "행사는 간단한 저녁 식사, 소그룹 네트워킹, 선배 패널 토크 순서로 진행됩니다. 학년과 관심 분야가 섞이도록 좌석을 배정할 예정입니다.",
        "",
        "• 일시: 2026.06.05 18:30 ~ 21:00",
        "• 장소: N1 1층 다목적홀",
        "• 대상: 전산학부 구성원",
        "• 정원: 80명",
        "• 신청: 연결된 설문에서 참석 여부와 관심 세션을 선택해 주세요.",
      ].join("\n"),
      contentEn: [
        "SoC Night is a networking event for students to share project experiences, research interests, and career questions.",
        "",
        "Dinner, small-group networking, and an alumni panel talk will be provided.",
      ].join("\n"),
      eventDescription: "저녁 식사와 선배 패널 토크가 함께 진행되는 전산학부 네트워킹 행사",
      eventStartDate: new Date("2026-06-05T18:30:00+09:00"),
      eventEndDate: new Date("2026-06-05T21:00:00+09:00"),
      isPinned: true,
      pinOrder: 0,
      viewCount: 214,
      postedAt: new Date("2026-05-24T10:00:00+09:00"),
      poster: makeSeedPosterSvg({
        eyebrow: "2026 SPRING",
        title: "전산인의 밤",
        subtitle: "네트워킹 데이",
        dateLine: "06.05 FRI 18:30 · N1 다목적홀",
        accent: "#007044",
        accentDark: "#005f3a",
      }),
      survey: {
        kind: "APPLICATION",
        titleKo: "전산인의 밤 참가 신청",
        titleEn: "SoC Night Registration",
        descriptionKo: "참석 인원과 식사 준비를 위해 사전 신청을 받습니다. 신청 후 일정이 바뀌면 마감 전까지 응답을 수정할 수 있습니다.",
        descriptionEn: "Please register in advance so we can prepare seats and dinner. Responses can be edited until the deadline.",
        feeRequirementPolicy: "NONE",
        allowMultipleResponses: false,
        allowResponseEdit: true,
        resultVisibility: "PRIVATE",
        maxResponseCount: 80,
        openAt: new Date("2026-05-24T10:00:00+09:00"),
        closeAt: new Date("2026-06-03T18:00:00+09:00"),
        sections: [
          {
            titleKo: "참가 정보",
            titleEn: "Registration details",
            descriptionKo: "행사 준비에 필요한 기본 정보를 입력해 주세요.",
            sortOrder: 0,
            questions: [
              {
                titleKo: "참석 가능한 시간대를 선택해 주세요.",
                titleEn: "Which part of the event can you attend?",
                questionType: "single_choice",
                options: [
                  { value: "full", labelKo: "전체 참석", labelEn: "Full event" },
                  { value: "after_dinner", labelKo: "패널 토크부터 참석", labelEn: "Panel talk only" },
                  { value: "undecided", labelKo: "아직 미정", labelEn: "Undecided" },
                ],
                sortOrder: 0,
              },
              {
                titleKo: "관심 있는 네트워킹 주제를 모두 선택해 주세요.",
                titleEn: "Select all networking topics you are interested in.",
                questionType: "multiple_choice",
                options: [
                  { value: "research", labelKo: "연구실/대학원", labelEn: "Research and graduate school" },
                  { value: "startup", labelKo: "창업/프로덕트", labelEn: "Startup and product" },
                  { value: "career", labelKo: "인턴/취업", labelEn: "Internship and career" },
                  { value: "project", labelKo: "개인 프로젝트", labelEn: "Personal projects" },
                ],
                sortOrder: 1,
              },
              {
                titleKo: "식이 제한이나 알레르기가 있다면 적어주세요.",
                titleEn: "Please share dietary restrictions or allergies.",
                questionType: "short_text",
                isRequired: false,
                sortOrder: 2,
              },
            ],
          },
        ],
      } satisfies SurveySeed,
    },
    {
      titleKo: "기말고사 간식 배부 신청",
      titleEn: "Final Exam Snack Pickup Registration",
      contentKo: [
        "기말고사 기간을 맞아 전산학부 학생회에서 간식 배부를 진행합니다.",
        "",
        "수령 시간을 분산하기 위해 사전 신청제로 운영하며, 신청자 본인 확인 후 배부합니다. 준비 수량이 한정되어 있으므로 신청 후 수령이 어려워진 경우 마감 전 응답을 수정해 주세요.",
        "",
        "• 배부 일시: 2026.06.12 17:00 ~ 19:00",
        "• 장소: N1 1층 학생회 부스",
        "• 대상: 전산학부 학생",
        "• 준비 수량: 150개",
        "• 유의사항: 중복 수령은 불가합니다.",
      ].join("\n"),
      contentEn: [
        "The student council will distribute snacks during finals week.",
        "",
        "Please register for a pickup slot in advance. Duplicate pickup is not allowed.",
      ].join("\n"),
      eventDescription: "기말고사 기간 전산학부 학생을 위한 사전 신청제 간식 배부",
      eventStartDate: new Date("2026-06-12T17:00:00+09:00"),
      eventEndDate: new Date("2026-06-12T19:00:00+09:00"),
      isPinned: false,
      viewCount: 176,
      postedAt: new Date("2026-05-28T12:00:00+09:00"),
      poster: makeSeedPosterSvg({
        eyebrow: "FINAL EXAM SUPPORT",
        title: "기말 간식 배부",
        subtitle: "사전 신청 후 현장 수령",
        dateLine: "06.12 FRI 17:00 · N1 학생회 부스",
        accent: "#0f766e",
        accentDark: "#115e59",
      }),
      survey: {
        kind: "APPLICATION",
        titleKo: "기말고사 간식 배부 신청",
        titleEn: "Final Exam Snack Pickup Registration",
        descriptionKo: "간식 수량과 수령 시간을 조정하기 위한 신청 설문입니다. 신청은 1인 1회만 가능하며, 마감 전까지 응답을 수정할 수 있습니다.",
        descriptionEn: "This registration form helps us prepare snack quantities and pickup slots.",
        feeRequirementPolicy: "NONE",
        allowMultipleResponses: false,
        allowResponseEdit: true,
        resultVisibility: "PRIVATE",
        maxResponseCount: 150,
        openAt: new Date("2026-05-28T12:00:00+09:00"),
        closeAt: new Date("2026-06-10T23:59:00+09:00"),
        sections: [
          {
            titleKo: "수령 정보",
            titleEn: "Pickup details",
            sortOrder: 0,
            questions: [
              {
                titleKo: "희망 수령 시간을 선택해 주세요.",
                titleEn: "Select your preferred pickup slot.",
                questionType: "dropdown",
                options: [
                  { value: "1700", labelKo: "17:00 ~ 17:30", labelEn: "17:00 ~ 17:30" },
                  { value: "1730", labelKo: "17:30 ~ 18:00", labelEn: "17:30 ~ 18:00" },
                  { value: "1800", labelKo: "18:00 ~ 18:30", labelEn: "18:00 ~ 18:30" },
                  { value: "1830", labelKo: "18:30 ~ 19:00", labelEn: "18:30 ~ 19:00" },
                ],
                sortOrder: 0,
              },
              {
                titleKo: "선호하는 간식 종류를 선택해 주세요.",
                titleEn: "Choose your preferred snack type.",
                questionType: "single_choice",
                options: [
                  { value: "sandwich", labelKo: "샌드위치", labelEn: "Sandwich" },
                  { value: "bakery", labelKo: "베이커리", labelEn: "Bakery" },
                  { value: "fruit", labelKo: "과일/음료", labelEn: "Fruit and drink" },
                ],
                sortOrder: 1,
              },
              {
                titleKo: "확인 사항: 본인 수령 및 중복 수령 불가에 동의합니다.",
                titleEn: "I agree to pick up my own snack and not duplicate the pickup.",
                questionType: "single_choice",
                options: [{ value: "agree", labelKo: "동의합니다", labelEn: "I agree" }],
                sortOrder: 2,
              },
            ],
          },
        ],
      } satisfies SurveySeed,
    },
    {
      titleKo: "전산학부 알고리즘 스터디 매칭",
      titleEn: "SoC Algorithm Study Matching",
      contentKo: [
        "방학 동안 알고리즘 문제풀이를 함께 진행할 스터디 그룹을 매칭합니다.",
        "",
        "참여자는 관심 난이도와 사용 언어, 가능 시간대를 기준으로 4~6명 단위의 그룹으로 배정됩니다. 스터디별 진행 방식은 첫 모임에서 조율하며, 학생회는 초기 매칭과 공용 채널 개설을 지원합니다.",
        "",
        "• 활동 기간: 2026.06.24 ~ 2026.08.21",
        "• 첫 모임: 2026.06.24 19:00",
        "• 대상: 전산학부 학생 및 복수전공 학생",
        "• 신청 조건: 학생회비 납부자 우선 배정",
      ].join("\n"),
      contentEn: [
        "We are matching students into algorithm study groups for the summer break.",
        "",
        "Groups will be formed based on preferred difficulty, programming language, and available time slots.",
      ].join("\n"),
      eventDescription: "난이도와 가능 시간대를 기준으로 여름방학 알고리즘 스터디 그룹 매칭",
      eventStartDate: new Date("2026-06-24T19:00:00+09:00"),
      eventEndDate: new Date("2026-08-21T22:00:00+09:00"),
      isPinned: false,
      viewCount: 119,
      postedAt: new Date("2026-05-29T14:00:00+09:00"),
      poster: makeSeedPosterSvg({
        eyebrow: "SUMMER STUDY",
        title: "알고리즘 스터디",
        subtitle: "여름방학 그룹 매칭",
        dateLine: "06.24 WED START · 온라인/오프라인 병행",
        accent: "#2563eb",
        accentDark: "#1d4ed8",
      }),
      survey: {
        kind: "SURVEY",
        titleKo: "알고리즘 스터디 매칭 설문",
        titleEn: "Algorithm Study Matching Survey",
        descriptionKo: "스터디 그룹 편성을 위해 관심 난이도, 사용 언어, 가능 시간대를 조사합니다. 학생회비 납부자는 우선 배정됩니다.",
        descriptionEn: "This survey collects your preferred difficulty, language, and available time slots for study group matching.",
        feeRequirementPolicy: "PAID_ONLY",
        allowMultipleResponses: false,
        allowResponseEdit: true,
        resultVisibility: "PRIVATE",
        openAt: new Date("2026-05-29T14:00:00+09:00"),
        closeAt: new Date("2026-06-16T23:59:00+09:00"),
        sections: [
          {
            titleKo: "스터디 선호도",
            titleEn: "Study preferences",
            sortOrder: 0,
            questions: [
              {
                titleKo: "희망 난이도를 선택해 주세요.",
                titleEn: "Select your preferred difficulty level.",
                questionType: "single_choice",
                options: [
                  { value: "basic", labelKo: "기초: 구현/자료구조 중심", labelEn: "Basic" },
                  { value: "intermediate", labelKo: "중급: 그래프/DP 중심", labelEn: "Intermediate" },
                  { value: "advanced", labelKo: "심화: 대회 준비 중심", labelEn: "Advanced" },
                ],
                sortOrder: 0,
              },
              {
                titleKo: "주로 사용할 언어를 모두 선택해 주세요.",
                titleEn: "Select all programming languages you plan to use.",
                questionType: "multiple_choice",
                options: [
                  { value: "cpp", labelKo: "C++", labelEn: "C++" },
                  { value: "python", labelKo: "Python", labelEn: "Python" },
                  { value: "java", labelKo: "Java", labelEn: "Java" },
                  { value: "other", labelKo: "기타", labelEn: "Other" },
                ],
                sortOrder: 1,
              },
              {
                titleKo: "참여 가능한 정기 모임 시간대를 적어주세요.",
                titleEn: "Please write your available regular meeting times.",
                questionType: "long_text",
                sortOrder: 2,
              },
            ],
          },
        ],
      } satisfies SurveySeed,
    },
    {
      titleKo: "2026 가을 MT 사전 수요조사",
      titleEn: "Fall 2026 MT Demand Survey",
      contentKo: [
        "가을학기 전산학부 MT 진행 여부와 규모를 결정하기 위해 사전 수요조사를 진행합니다.",
        "",
        "이번 조사는 실제 신청이 아니라 예산, 장소, 이동 수단을 검토하기 위한 수요 파악 단계입니다. 조사 결과를 바탕으로 세부 일정과 신청 방식이 다시 공지됩니다.",
        "",
        "• 예상 일정: 2026.09.18 ~ 2026.09.19",
        "• 예상 장소: 대전 근교 연수원",
        "• 대상: 전산학부 구성원",
        "• 조사 기간: 2026.05.30 ~ 2026.06.14",
      ].join("\n"),
      contentEn: [
        "The student council is running a preliminary demand survey for the Fall 2026 MT.",
        "",
        "This is not the final registration form. The result will be used to estimate budget, venue size, and transportation.",
      ].join("\n"),
      eventDescription: "가을학기 MT 규모와 일정 확정을 위한 사전 수요조사",
      eventStartDate: new Date("2026-09-18T10:00:00+09:00"),
      eventEndDate: new Date("2026-09-19T15:00:00+09:00"),
      isPinned: false,
      viewCount: 96,
      postedAt: new Date("2026-05-30T09:30:00+09:00"),
      poster: makeSeedPosterSvg({
        eyebrow: "FALL MT",
        title: "가을 MT 수요조사",
        subtitle: "일정과 규모를 함께 정합니다",
        dateLine: "09.18 FRI ~ 09.19 SAT · 대전 근교",
        accent: "#7c3aed",
        accentDark: "#5b21b6",
      }),
      survey: {
        kind: "SURVEY",
        titleKo: "가을 MT 사전 수요조사",
        titleEn: "Fall MT Preliminary Demand Survey",
        descriptionKo: "참여 의향과 선호 일정을 확인하기 위한 사전 조사입니다. 실제 참가 신청은 추후 별도 공지됩니다.",
        descriptionEn: "This preliminary survey checks interest and schedule preferences. Final registration will be announced separately.",
        feeRequirementPolicy: "NONE",
        allowMultipleResponses: false,
        allowResponseEdit: true,
        resultVisibility: "PUBLIC",
        openAt: new Date("2026-05-30T09:30:00+09:00"),
        closeAt: new Date("2026-06-14T23:59:00+09:00"),
        sections: [
          {
            titleKo: "참여 의향",
            titleEn: "Participation interest",
            sortOrder: 0,
            questions: [
              {
                titleKo: "가을 MT가 진행된다면 참여할 의향이 있나요?",
                titleEn: "Would you participate if the Fall MT is held?",
                questionType: "single_choice",
                options: [
                  { value: "yes", labelKo: "참여하고 싶습니다", labelEn: "Yes" },
                  { value: "maybe", labelKo: "일정에 따라 결정하겠습니다", labelEn: "Maybe" },
                  { value: "no", labelKo: "참여가 어렵습니다", labelEn: "No" },
                ],
                sortOrder: 0,
              },
              {
                titleKo: "선호하는 프로그램을 모두 선택해 주세요.",
                titleEn: "Select all programs you prefer.",
                questionType: "multiple_choice",
                options: [
                  { value: "team_building", labelKo: "팀 빌딩 활동", labelEn: "Team-building activities" },
                  { value: "talk", labelKo: "선배/동문 토크", labelEn: "Alumni talk" },
                  { value: "recreation", labelKo: "레크리에이션", labelEn: "Recreation" },
                  { value: "free_time", labelKo: "자유 네트워킹", labelEn: "Free networking" },
                ],
                sortOrder: 1,
              },
              {
                titleKo: "MT 운영과 관련해 학생회가 고려했으면 하는 점을 자유롭게 적어주세요.",
                titleEn: "Please share anything the council should consider for the MT.",
                questionType: "long_text",
                isRequired: false,
                sortOrder: 2,
              },
            ],
          },
        ],
      } satisfies SurveySeed,
    },
  ];

  for (const event of eventItems) {
    const [articleRow] = await db.insert(articles).values({
      boardId: eventBoard.boardId,
      authorUserId: seedAuthor.userId,
      titleKo: event.titleKo,
      titleEn: event.titleEn,
      contentKo: event.contentKo,
      contentEn: event.contentEn,
      visibilityScope: "PUBLIC",
      isPinned: event.isPinned,
      pinOrder: event.pinOrder,
      viewCount: event.viewCount,
      postedAt: event.postedAt,
      eventStartDate: event.eventStartDate,
      eventEndDate: event.eventEndDate,
      eventDescription: event.eventDescription,
      isAnonymous: false,
    }).returning({ articleId: articles.articleId });

    await attachAssetsToArticle(articleRow.articleId, seedAuthor.userId, [
      {
        filename: `seed-event-${articleRow.articleId}-poster.svg`,
        content: event.poster,
        originalFilename: `${event.titleKo}_포스터.svg`,
        mimeType: "image/svg+xml",
        usageType: "THUMBNAIL",
        sortOrder: 0,
        sizeBytes: 96000,
      },
    ]);

    await createSurveyWithQuestions(event.survey, seedAuthor.userId, articleRow.articleId);
  }
  console.log("Seeded 4 event articles with linked surveys and posters");
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
