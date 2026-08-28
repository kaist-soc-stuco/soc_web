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
  contentBlocks,
  executiveContacts,
  permissions,
  roleGroupPermissions,
  roleGroups,
  surveyQuestions,
  surveySections,
  surveys,
  userRoleGroups,
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
  nameEn: string;
  descriptionKo: string;
  descriptionEn: string;
  writePermissionId: number | null;
  allowComment: boolean;
  allowSecret: boolean;
  allowLike: boolean;
  allowGuestRead: boolean;
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
    nameEn: "Notice",
    descriptionKo: "집행위원회 및 학교의 중요한 공지사항을 확인하세요",
    descriptionEn: "Read important announcements from SoC Student Council and the school.",
    writePermissionId: 1,
    allowComment: true,
    allowSecret: false,
    allowLike: true,
    allowGuestRead: true,
    isActive: true,
    sortOrder: 0,
  },
  {
    code: "_EVENT",
    nameKo: "행사",
    nameEn: "Events",
    descriptionKo: "전산학부의 다양한 행사 정보를 확인하세요",
    descriptionEn: "Discover events for School of Computing students.",
    writePermissionId: 1,
    allowComment: true,
    allowSecret: false,
    allowLike: true,
    allowGuestRead: true,
    isActive: true,
    sortOrder: 1,
  },
  {
    code: "HoC",
    nameKo: "HoC",
    nameEn: "HoC",
    descriptionKo: "Hall of Code 프로젝트 및 활동 내역",
    descriptionEn: "Browse Hall of Code projects and activity updates.",
    writePermissionId: 1,
    allowComment: true,
    allowSecret: false,
    allowLike: true,
    allowGuestRead: true,
    isActive: true,
    sortOrder: 2,
  },
  {
    code: "홍보글",
    nameKo: "홍보글",
    nameEn: "Promotional Posts",
    descriptionKo: "집행위원회 및 학회의 홍보 게시물",
    descriptionEn: "Find promotions from SoC Student Council and student organizations.",
    writePermissionId: 1,
    allowComment: true,
    allowSecret: false,
    allowLike: true,
    allowGuestRead: true,
    isActive: true,
    sortOrder: 3,
  },
  {
    code: "건의사항",
    nameKo: "건의사항",
    nameEn: "Suggestions",
    descriptionKo: "학생들의 의견과 건의사항을 나눠주세요",
    descriptionEn: "Share feedback and suggestions with SoC Student Council.",
    writePermissionId: null,
    allowComment: true,
    allowSecret: true,
    allowLike: true,
    allowGuestRead: true,
    isActive: true,
    sortOrder: 4,
  },
  {
    code: "연구실",
    nameKo: "연구실",
    nameEn: "Research Labs",
    descriptionKo: "각 연구실의 소식과 공지사항",
    descriptionEn: "Read news and announcements from research labs.",
    writePermissionId: null,
    allowComment: true,
    allowSecret: false,
    allowLike: true,
    allowGuestRead: true,
    isActive: true,
    sortOrder: 5,
  },
  {
    code: "FAQ",
    nameKo: "FAQ",
    nameEn: "FAQ",
    descriptionKo: "FAQ와 답변을 확인하세요",
    descriptionEn: "Browse frequently asked questions and answers.",
    writePermissionId: 1,
    allowComment: false,
    allowSecret: false,
    allowLike: false,
    allowGuestRead: true,
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
        allowGuestRead: sql`excluded.allow_guest_read`,
        descriptionKo: sql`excluded.description_ko`,
        descriptionEn: sql`excluded.description_en`,
        isActive: sql`excluded.is_active`,
        nameEn: sql`excluded.name_en`,
        nameKo: sql`excluded.name_ko`,
        sortOrder: sql`excluded.sort_order`,
        writePermissionId: sql`excluded.write_permission_id`,
      },
    });
  console.log(`Upserted ${BOARD_SEEDS.length} board(s)`);
}

async function seedDevAdminRole() {
  const now = new Date();
  const permissionRows = await db
    .select({ permissionId: permissions.permissionId })
    .from(permissions)
    .where(eq(permissions.isActive, true));

  if (permissionRows.length === 0) {
    throw new Error("No active permissions found for dev admin seed");
  }

  const [devAdmin] = await db
    .insert(users)
    .values({
      academicStatus: "재학",
      departmentEn: "School of Computing",
      departmentKo: "전산학부",
      email: "dev-admin@kaist.ac.kr",
      identityCode: "S",
      isActive: true,
      kaistUid: "DEV0001",
      lastLoginAt: now,
      nameEn: "Development Admin",
      nameKo: "관리자",
      privacyConsentAt: now,
      stdNo: "20260001",
    })
    .onConflictDoUpdate({
      target: users.kaistUid,
      set: {
        academicStatus: sql`excluded.academic_status`,
        departmentEn: sql`excluded.dept_en`,
        departmentKo: sql`excluded.dept_ko`,
        email: sql`excluded.email`,
        identityCode: sql`excluded.identity_code`,
        isActive: sql`excluded.is_active`,
        lastLoginAt: sql`excluded.last_login_at`,
        nameEn: sql`excluded.name_en`,
        nameKo: sql`excluded.name_ko`,
        privacyConsentAt: sql`excluded.privacy_consent_at`,
        stdNo: sql`excluded.std_no`,
        updatedAt: sql`now()`,
      },
    })
    .returning({ userId: users.userId });

  if (!devAdmin) {
    throw new Error("Failed to upsert dev admin user");
  }

  const [devRoleGroup] = await db
    .insert(roleGroups)
    .values({
      description: "개발 환경용 전체 권한 테스트 그룹",
      isSystem: true,
      nameKo: "개발 관리자",
    })
    .onConflictDoUpdate({
      target: roleGroups.nameKo,
      set: {
        description: "개발 환경용 전체 권한 테스트 그룹",
        isSystem: true,
        updatedAt: sql`now()`,
      },
    })
    .returning({ roleGroupId: roleGroups.roleGroupId });

  if (!devRoleGroup) {
    throw new Error("Failed to upsert dev admin role group");
  }

  await db
    .delete(roleGroupPermissions)
    .where(eq(roleGroupPermissions.roleGroupId, devRoleGroup.roleGroupId));

  await db.insert(roleGroupPermissions).values(
    permissionRows.map((permission) => ({
      permissionId: permission.permissionId,
      roleGroupId: devRoleGroup.roleGroupId,
    })),
  );

  await db
    .delete(userRoleGroups)
    .where(
      and(
        eq(userRoleGroups.userId, devAdmin.userId),
        eq(userRoleGroups.roleGroupId, devRoleGroup.roleGroupId),
      ),
    );

  await db.insert(userRoleGroups).values({
    grantedAt: now,
    grantedBy: devAdmin.userId,
    isActive: true,
    roleGroupId: devRoleGroup.roleGroupId,
    userId: devAdmin.userId,
    validFrom: now,
    validTo: null,
  });

  console.log(
    `Seeded dev admin role with ${permissionRows.length} active permission(s)`,
  );
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
  <text x="480" y="157" text-anchor="middle" font-family="Arial, sans-serif" font-size="18" font-weight="700" fill="#00633b">전산학부 집행위원회의 임원으로 활발한 참여를 기다립니다!</text>
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

type QuestionOptionSeed = {
  value: string;
  labelKo: string;
  labelEn?: string;
};

type QuestionConfigSeed = {
  rows?: QuestionOptionSeed[];
  columns?: QuestionOptionSeed[];
  maxFiles?: number;
  maxSizeBytes?: number;
  allowedMimeTypes?: string[];
};

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
    | "grid_single"
    | "grid_multiple"
    | "file_upload"
    | "date"
    | "time"
    | "datetime";
  options?: QuestionOptionSeed[];
  config?: QuestionConfigSeed;
  isRequired?: boolean;
  sortOrder: number;
};

type SurveySeed = {
  kind: "APPLICATION" | "SURVEY";
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

type EventSeed = {
  titleKo: string;
  titleEn: string;
  contentKo: string;
  contentEn: string;
  eventDescriptionKo: string;
  eventDescriptionEn: string;
  eventStartDate: Date;
  eventEndDate: Date;
  isPinned: boolean;
  pinOrder?: number;
  viewCount: number;
  postedAt: Date;
  poster: string;
  survey: SurveySeed;
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
  const id = input.accent.replace(/[^a-z0-9]/gi, "").toLowerCase() || "seed";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="540" viewBox="0 0 960 540">
  <title>${input.title} visual</title>
  <defs>
    <linearGradient id="gradient-${id}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${input.accent}"/>
      <stop offset="56%" stop-color="#ffffff" stop-opacity="0.88"/>
      <stop offset="100%" stop-color="${input.accentDark}" stop-opacity="0.72"/>
    </linearGradient>
    <pattern id="pattern-${id}" width="72" height="72" patternUnits="userSpaceOnUse" patternTransform="rotate(24)">
      <path d="M0 36H72M36 0V72" stroke="${input.accentDark}" stroke-opacity="0.12" stroke-width="2"/>
      <circle cx="36" cy="36" r="8" fill="${input.accentDark}" fill-opacity="0.08"/>
    </pattern>
  </defs>
  <rect width="960" height="540" rx="28" fill="url(#gradient-${id})"/>
  <rect width="960" height="540" rx="28" fill="url(#pattern-${id})"/>
  <circle cx="820" cy="92" r="148" fill="#ffffff" fill-opacity="0.18"/>
  <circle cx="120" cy="492" r="180" fill="${input.accentDark}" fill-opacity="0.1"/>
  <rect x="36" y="36" width="888" height="468" rx="22" fill="none" stroke="#ffffff" stroke-opacity="0.52" stroke-width="2"/>
 </svg>`;
}

function makeSimpleEventSurvey(input: {
  titleKo: string;
  titleEn: string;
  descriptionKo: string;
  descriptionEn: string;
  openAt: Date;
  closeAt: Date;
  maxResponseCount?: number;
}): SurveySeed {
  return {
    kind: "APPLICATION",
    titleKo: input.titleKo,
    titleEn: input.titleEn,
    descriptionKo: input.descriptionKo,
    descriptionEn: input.descriptionEn,
    feeRequirementPolicy: "NONE",
    allowMultipleResponses: false,
    allowResponseEdit: true,
    resultVisibility: "PRIVATE",
    maxResponseCount: input.maxResponseCount,
    openAt: input.openAt,
    closeAt: input.closeAt,
    sections: [
      {
        titleKo: "참가 정보",
        titleEn: "Participation details",
        sortOrder: 0,
        questions: [
          {
            titleKo: "참여 여부를 선택해 주세요.",
            titleEn: "Would you like to participate?",
            questionType: "single_choice",
            options: [
              { value: "yes", labelKo: "참여합니다", labelEn: "Yes" },
              { value: "maybe", labelKo: "일정을 확인해 보겠습니다", labelEn: "Maybe" },
            ],
            sortOrder: 0,
          },
        ],
      },
    ],
  };
}

function makeAllQuestionTypesSurvey(): SurveySeed {
  return {
    kind: "SURVEY",
    titleKo: "설문 문항 유형 종합 테스트",
    titleEn: "Survey Question Types Showcase",
    descriptionKo:
      "설문 응답 화면에서 지원하는 모든 문항 유형을 한 번에 확인할 수 있는 테스트 설문입니다.",
    descriptionEn:
      "A demo survey that showcases every question type supported by the response form.",
    feeRequirementPolicy: "NONE",
    allowMultipleResponses: true,
    allowResponseEdit: true,
    resultVisibility: "PRIVATE",
    openAt: new Date("2026-08-20T09:00:00+09:00"),
    closeAt: new Date("2026-12-31T23:59:00+09:00"),
    sections: [
      {
        titleKo: "기본 입력",
        titleEn: "Basic inputs",
        descriptionKo: "텍스트, 날짜, 시간 입력 문항을 확인해 보세요.",
        descriptionEn: "Try the text, date, and time input questions.",
        sortOrder: 0,
        questions: [
          {
            titleKo: "이름 또는 닉네임을 입력해 주세요.",
            titleEn: "Enter your name or nickname.",
            questionType: "short_text",
            sortOrder: 0,
          },
          {
            titleKo: "이번 테스트에서 확인하고 싶은 점을 자유롭게 적어 주세요.",
            titleEn: "Tell us what you would like to test in this survey.",
            questionType: "long_text",
            isRequired: false,
            sortOrder: 1,
          },
          {
            titleKo: "가장 좋아하는 개발 언어를 선택해 주세요.",
            titleEn: "Choose your favorite programming language.",
            questionType: "single_choice",
            options: [
              { value: "typescript", labelKo: "TypeScript", labelEn: "TypeScript" },
              { value: "python", labelKo: "Python", labelEn: "Python" },
              { value: "rust", labelKo: "Rust", labelEn: "Rust" },
            ],
            sortOrder: 2,
          },
          {
            titleKo: "관심 있는 분야를 모두 선택해 주세요.",
            titleEn: "Select all areas you are interested in.",
            questionType: "multiple_choice",
            options: [
              { value: "frontend", labelKo: "프론트엔드", labelEn: "Frontend" },
              { value: "backend", labelKo: "백엔드", labelEn: "Backend" },
              { value: "data", labelKo: "데이터", labelEn: "Data" },
              { value: "security", labelKo: "보안", labelEn: "Security" },
            ],
            sortOrder: 3,
          },
          {
            titleKo: "현재 학년을 선택해 주세요.",
            titleEn: "Choose your current year.",
            questionType: "dropdown",
            options: [
              { value: "undergraduate", labelKo: "학부생", labelEn: "Undergraduate" },
              { value: "graduate", labelKo: "대학원생", labelEn: "Graduate student" },
              { value: "other", labelKo: "기타", labelEn: "Other" },
            ],
            sortOrder: 4,
          },
          {
            titleKo: "가장 기억에 남는 날짜를 선택해 주세요.",
            titleEn: "Choose a memorable date.",
            questionType: "date",
            sortOrder: 5,
          },
          {
            titleKo: "선호하는 연락 시간을 선택해 주세요.",
            titleEn: "Choose your preferred contact time.",
            questionType: "time",
            sortOrder: 6,
          },
          {
            titleKo: "다음 모임에 참여 가능한 일시를 선택해 주세요.",
            titleEn: "Choose a date and time when you can attend the next meetup.",
            questionType: "datetime",
            sortOrder: 7,
          },
        ],
      },
      {
        titleKo: "그리드와 파일",
        titleEn: "Grids and file upload",
        descriptionKo: "행렬형 선택지와 파일 업로드 문항을 확인해 보세요.",
        descriptionEn: "Try the grid and file upload questions.",
        sortOrder: 1,
        questions: [
          {
            titleKo: "관심 분야별 선호도를 평가해 주세요.",
            titleEn: "Rate your interest in each area.",
            questionType: "grid_single",
            config: {
              rows: [
                { value: "class", labelKo: "수업", labelEn: "Classes" },
                { value: "research", labelKo: "연구", labelEn: "Research" },
                { value: "community", labelKo: "커뮤니티", labelEn: "Community" },
              ],
              columns: [
                { value: "low", labelKo: "낮음", labelEn: "Low" },
                { value: "medium", labelKo: "보통", labelEn: "Medium" },
                { value: "high", labelKo: "높음", labelEn: "High" },
              ],
            },
            sortOrder: 0,
          },
          {
            titleKo: "참여하고 싶은 프로그램을 분야별로 모두 선택해 주세요.",
            titleEn: "Select all programs you want to join by area.",
            questionType: "grid_multiple",
            config: {
              rows: [
                { value: "semester", labelKo: "학기 중", labelEn: "During semester" },
                { value: "break", labelKo: "방학", labelEn: "During break" },
              ],
              columns: [
                { value: "study", labelKo: "스터디", labelEn: "Study group" },
                { value: "workshop", labelKo: "워크숍", labelEn: "Workshop" },
                { value: "networking", labelKo: "네트워킹", labelEn: "Networking" },
              ],
            },
            sortOrder: 1,
          },
          {
            titleKo: "참고 파일을 업로드해 주세요.",
            titleEn: "Upload a reference file.",
            questionType: "file_upload",
            config: {
              maxFiles: 2,
              maxSizeBytes: 5_000_000,
              allowedMimeTypes: ["application/pdf", "image/png", "image/jpeg"],
            },
            isRequired: false,
            sortOrder: 2,
          },
        ],
      },
    ],
  };
}

async function cleanupSeedContent() {
  await db.execute(sql`
    delete from content_block
    where type in ('TOP_BANNER', 'QUICK_LINK', 'PLEDGE')
      and created_by in (
        select user_id from users
        where kaist_uid = 'seed-council-author'
      )
  `);

  await db.execute(sql`
    delete from executive_contact
    where email in (
      'president@cs.kaist.ac.kr',
      'planning@cs.kaist.ac.kr',
      'welfare@cs.kaist.ac.kr',
      'pr@cs.kaist.ac.kr'
    )
  `);

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
      '전산학부 집행위원회',
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

async function seedAboutPageContent(seedAuthorId: string) {
  await db.insert(contentBlocks).values([
    {
      type: "QUICK_LINK",
      status: "PUBLISHED",
      titleKo: "행사·일정 확인",
      titleEn: "Events & Activities",
      bodyKo: "다가오는 행사와 학사일정을 한눈에 확인하세요.",
      bodyEn: "See upcoming events and academic dates at a glance.",
      linkUrl: "/events",
      sortOrder: 0,
      createdBy: seedAuthorId,
      updatedBy: seedAuthorId,
      publishedBy: seedAuthorId,
      publishedAt: new Date("2026-03-02T09:00:00+09:00"),
    },
    {
      type: "ORGANIZATION_CHART",
      status: "PUBLISHED",
      titleKo: "전산학부 집행위원회 조직도",
      titleEn: "SoC Student Council Organization Chart",
      imageUrl: "/organization-chart.svg",
      sortOrder: 0,
      createdBy: seedAuthorId,
      updatedBy: seedAuthorId,
      publishedBy: seedAuthorId,
      publishedAt: new Date("2026-03-02T09:00:00+09:00"),
    },
    {
      type: "PLEDGE",
      status: "PUBLISHED",
      titleKo: "학생 복지 품목과 대여 절차 확대",
      titleEn: "Expand student welfare items and lending access",
      bodyKo: "학생회가 운영하는 복지 물품을 늘리고 대여 절차를 한눈에 확인할 수 있도록 정리합니다.",
      bodyEn: "Expand council-managed welfare items and make the lending process easier to access.",
      pledgeStatus: "COMPLETED",
      sortOrder: 0,
      createdBy: seedAuthorId,
      updatedBy: seedAuthorId,
      publishedBy: seedAuthorId,
      publishedAt: new Date("2026-03-02T09:00:00+09:00"),
    },
    {
      type: "PLEDGE",
      status: "PUBLISHED",
      titleKo: "전산학부 커뮤니티 라운지 개선",
      titleEn: "Improve the School of Computing community lounge",
      bodyKo: "학우들이 편하게 머물고 교류할 수 있도록 라운지 환경과 이용 프로그램을 단계적으로 개선합니다.",
      bodyEn: "Improve the lounge environment and community programs so students can stay and connect comfortably.",
      pledgeStatus: "IN_PROGRESS",
      sortOrder: 1,
      createdBy: seedAuthorId,
      updatedBy: seedAuthorId,
      publishedBy: seedAuthorId,
      publishedAt: new Date("2026-03-02T09:00:00+09:00"),
    },
    {
      type: "PLEDGE",
      status: "PUBLISHED",
      titleKo: "진로·학업 지원 프로그램 정례화",
      titleEn: "Establish regular academic and career support programs",
      bodyKo: "선배 초청 세션과 연구·진로 정보를 정기적으로 공유해 학업과 진로 탐색을 돕습니다.",
      bodyEn: "Regularly share research and career information through alumni sessions and peer programs.",
      pledgeStatus: "PLANNED",
      sortOrder: 2,
      createdBy: seedAuthorId,
      updatedBy: seedAuthorId,
      publishedBy: seedAuthorId,
      publishedAt: new Date("2026-03-02T09:00:00+09:00"),
    },
  ]);

  await db.insert(executiveContacts).values([
    {
      nameKo: "김성찬",
      nameEn: "Seongchan Kim",
      roleKo: "회장",
      roleEn: "President",
      gender: null,
      cohort: 26,
      email: "president@cs.kaist.ac.kr",
      phoneNumber: null,
      privacyConsented: true,
      sortOrder: 0,
    },
    {
      nameKo: "이서윤",
      nameEn: "Seoyoon Lee",
      roleKo: "기획국장",
      roleEn: "Planning Director",
      gender: null,
      cohort: 25,
      email: "planning@cs.kaist.ac.kr",
      phoneNumber: null,
      privacyConsented: true,
      sortOrder: 1,
    },
    {
      nameKo: "박도현",
      nameEn: "Dohyun Park",
      roleKo: "복지국장",
      roleEn: "Welfare Director",
      gender: null,
      cohort: 25,
      email: "welfare@cs.kaist.ac.kr",
      phoneNumber: null,
      privacyConsented: true,
      sortOrder: 2,
    },
    {
      nameKo: "최민아",
      nameEn: "Mina Choi",
      roleKo: "홍보국장",
      roleEn: "Communications Director",
      gender: null,
      cohort: 26,
      email: "pr@cs.kaist.ac.kr",
      phoneNumber: null,
      privacyConsented: true,
      sortOrder: 3,
    },
  ]);

  console.log("Seeded pledge progress and executive contacts");
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
  connectedArticleId: number | null,
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
      lifecycleStatus: "PUBLISHED",
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
        config: question.config,
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
    .where(eq(boards.code, "_EVENT"))
    .limit(1);

  const [faqBoard] = await db
    .select({ boardId: boards.boardId })
    .from(boards)
    .where(eq(boards.code, "FAQ"))
    .limit(1);

  if (!noticeBoard || !eventBoard) {
    console.log("Boards not found, skipping mock data seed");
    return;
  }

  await cleanupSeedContent();
  const seedAuthor = await upsertSeedAuthor();
  await seedAboutPageContent(seedAuthor.userId);

  const detailedNoticeContent = [
    "전산학부 집행위원회는 학부 여러분의 의견을 반영하고 보다 나은 학부 문화를 만들어가기 위해 열정과 책임감 있는 임원분들을 모집합니다.",
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
      titleKo: "2026 봄학기 전산학부 집행위원회 운영 안내",
      titleEn: "Spring 2026 SoC Student Council Operations Notice",
      contentKo: [
        "안녕하세요, 전산학부 집행위원회입니다.",
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
        "Hello, this is the SoC Student Council.",
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
      titleEn: "2026 SoC Student Council Executive Committee Recruitment",
      contentKo: detailedNoticeContent,
      contentEn: [
        "The SoC Student Council is recruiting executive committee members for 2026.",
        "",
        "We welcome students who want to plan events, improve student welfare, and build better communication channels within the department.",
        "",
        "• Eligibility: School of Computing undergraduate and graduate students",
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
    {
      titleKo: "2026 여름학기 학생회실 운영 시간 안내",
      titleEn: "SoC Student Council Office Hours for Summer 2026",
      contentKo: [
        "2026 여름학기 학생회실 운영 시간과 방문 상담 방법을 안내드립니다.",
        "",
        "• 운영 시간: 평일 12:30 ~ 13:30, 18:00 ~ 19:00",
        "• 장소: N1 학생회실",
        "• 상담 내용: 과비, 물품 대여, 행사 및 게시판 이용 문의",
        "",
        "방문이 어려운 경우 홈페이지 문의하기를 이용해 주세요.",
      ].join("\n"),
      contentEn: [
        "SoC Student Council office hours and in-person consultation details for Summer 2026.",
        "",
        "• Office hours: Weekdays 12:30 ~ 13:30, 18:00 ~ 19:00",
        "• Location: N1 SoC Student Council Office",
      ].join("\n"),
      isPinned: false,
      viewCount: 28,
      postedAt: new Date("2026-05-14T10:00:00+09:00"),
      poster: makeSeedPosterSvg({
        eyebrow: "OFFICE HOURS",
        title: "학생회실 운영 시간",
        subtitle: "방문 상담 · 물품 대여 · 문의 접수",
        dateLine: "SUMMER 2026",
        accent: "#0f766e",
        accentDark: "#134e4a",
      }),
    },
    {
      titleKo: "전산학부 공용공간 이용 수칙 안내",
      titleEn: "Shared Space Guidelines for the School of Computing",
      contentKo: [
        "전산학부 라운지와 공용 공간을 함께 사용하는 학우들을 위해 기본 이용 수칙을 안내드립니다.",
        "",
        "• 사용 후 책상과 주변을 정리해 주세요.",
        "• 개인 물품은 장시간 방치하지 말아 주세요.",
        "• 음식물과 쓰레기는 지정된 장소에 처리해 주세요.",
        "• 시설물 고장은 학생회에 알려 주세요.",
      ].join("\n"),
      contentEn: [
        "Please follow these basic guidelines when using shared spaces in the School of Computing.",
        "",
        "• Clean your desk after use.",
        "• Do not leave personal items unattended for long periods.",
        "• Dispose of food and waste properly.",
      ].join("\n"),
      isPinned: false,
      viewCount: 24,
      postedAt: new Date("2026-05-13T14:00:00+09:00"),
      poster: makeSeedPosterSvg({
        eyebrow: "SHARED SPACE",
        title: "공용공간 이용 수칙",
        subtitle: "함께 쓰는 공간을 위한 작은 약속",
        dateLine: "SoC COMMUNITY",
        accent: "#2563eb",
        accentDark: "#1e3a8a",
      }),
    },
    {
      titleKo: "여름방학 학생회 프로그램 사전 안내",
      titleEn: "Preview of Summer SoC Student Council Programs",
      contentKo: [
        "여름방학 동안 진행할 학습·교류 프로그램을 미리 안내드립니다.",
        "",
        "• 알고리즘 스터디 매칭",
        "• 개발 워크숍 및 프로젝트 회고 세션",
        "• 선후배 네트워킹 간담회",
        "",
        "세부 일정과 신청 방법은 각 프로그램 게시글에서 순차적으로 안내하겠습니다.",
      ].join("\n"),
      contentEn: [
        "A preview of learning and networking programs planned for the summer break.",
        "",
        "• Algorithm study matching",
        "• Development workshop and project retrospective",
        "• Student networking sessions",
      ].join("\n"),
      isPinned: false,
      viewCount: 19,
      postedAt: new Date("2026-05-12T09:30:00+09:00"),
      poster: makeSeedPosterSvg({
        eyebrow: "SUMMER PROGRAMS",
        title: "여름방학 프로그램",
        subtitle: "학습 · 개발 · 네트워킹",
        dateLine: "COMING SOON",
        accent: "#d97706",
        accentDark: "#92400e",
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
  console.log("Seeded 8 notice articles with realistic copy and attachments");

  if (faqBoard) {
    const faqItems = [
      ["로그인은 어떻게 하나요?", "How do I sign in?", "상단 프로필 아이콘에서 KAIST 계정으로 로그인할 수 있습니다.", "Use the profile icon in the header to sign in with your KAIST account."],
      ["게시글이나 댓글은 누가 작성할 수 있나요?", "Who can create posts and comments?", "게시판별 운영 권한과 로그인 상태에 따라 작성 가능 범위가 달라집니다.", "Posting permissions depend on the board and your signed-in account."],
      ["행사와 학사 일정은 어디서 확인하나요?", "Where can I find events and academic dates?", "행사·일정 메뉴에서 행사, 설문, 캘린더를 각각 확인할 수 있습니다.", "Use Events & Calendar to browse events, surveys, and the calendar."],
      ["건의사항 답변은 어떻게 확인하나요?", "How do I track an official response?", "건의사항에 공식 답변이 등록되면 상단 알림에서 바로 확인할 수 있습니다.", "You will receive a header notification when an official response is posted."],
      ["개인정보 수정은 어디에서 하나요?", "Where can I update my profile?", "마이페이지에서 연락처와 선택 정보를 확인하고 수정할 수 있습니다.", "Review and update supported profile details on My Page."],
    ] as const;
    await db.insert(articles).values(faqItems.map(([titleKo, titleEn, contentKo, contentEn], index) => ({
      boardId: faqBoard.boardId,
      authorUserId: seedAuthor.userId,
      titleKo,
      titleEn,
      contentKo,
      contentEn,
      visibilityScope: "PUBLIC" as const,
      isPinned: false,
      viewCount: 0,
      postedAt: new Date(`2026-03-${String(index + 1).padStart(2, "0")}T09:00:00+09:00`),
      isAnonymous: false,
      allowComment: false,
    })));
    console.log(`Seeded ${faqItems.length} FAQ articles`);
  }

  const eventItems: EventSeed[] = [
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
      eventDescriptionKo: "저녁 식사와 선배 패널 토크가 함께 진행되는 전산학부 네트워킹 행사",
      eventDescriptionEn: "A School of Computing networking event featuring dinner and an alumni panel talk.",
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
        "기말고사 기간을 맞아 전산학부 집행위원회에서 간식 배부를 진행합니다.",
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
        "The SoC Student Council will distribute snacks during finals week.",
        "",
        "Please register for a pickup slot in advance. Duplicate pickup is not allowed.",
      ].join("\n"),
      eventDescriptionKo: "기말고사 기간 전산학부 학생을 위한 사전 신청제 간식 배부",
      eventDescriptionEn: "Pre-registration snack distribution for School of Computing students during finals.",
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
      titleKo: "2026 여름 개발 워크숍 참가 신청",
      titleEn: "Summer 2026 Development Workshop Registration",
      contentKo: [
        "여름방학을 앞두고 웹 서비스 기획부터 배포까지 짧게 경험해 보는 개발 워크숍을 진행합니다.",
        "",
        "참가자는 소규모 팀으로 나뉘어 문제 정의, 화면 설계, API 연동, 배포 점검까지 하루 동안 압축적으로 실습합니다. 개발 경험이 많지 않아도 참여할 수 있도록 공통 템플릿과 멘토링을 제공합니다.",
        "",
        "• 일시: 2026.06.18 14:00 ~ 18:00",
        "• 장소: N1 102호 전산 실습실",
        "• 대상: 웹 개발에 관심 있는 전산학부 구성원",
        "• 준비물: 개인 노트북",
        "• 신청: 연결된 설문에서 관심 트랙과 개발 경험을 입력해 주세요.",
      ].join("\n"),
      contentEn: [
        "This workshop offers a hands-on path from product planning to deployment before summer break.",
        "",
        "Participants will work in small teams with templates and mentoring support.",
      ].join("\n"),
      eventDescriptionKo: "기획, 구현, 배포를 하루 동안 실습하는 전산학부 여름 개발 워크숍",
      eventDescriptionEn: "A one-day summer workshop covering product planning, implementation, and deployment.",
      eventStartDate: new Date("2026-06-18T14:00:00+09:00"),
      eventEndDate: new Date("2026-06-18T18:00:00+09:00"),
      isPinned: false,
      viewCount: 142,
      postedAt: new Date("2026-05-31T11:00:00+09:00"),
      poster: makeSeedPosterSvg({
        eyebrow: "SUMMER WORKSHOP",
        title: "개발 워크숍",
        subtitle: "기획부터 배포까지",
        dateLine: "06.18 THU 14:00 · N1 102호",
        accent: "#0891b2",
        accentDark: "#0e7490",
      }),
      survey: {
        kind: "APPLICATION",
        titleKo: "여름 개발 워크숍 참가 신청",
        titleEn: "Summer Development Workshop Registration",
        descriptionKo: "워크숍 팀 구성과 멘토 배정을 위해 관심 트랙과 개발 경험을 확인합니다. 신청 후 마감 전까지 응답을 수정할 수 있습니다.",
        descriptionEn: "This form collects preferred tracks and development experience for team and mentor matching.",
        feeRequirementPolicy: "NONE",
        allowMultipleResponses: false,
        allowResponseEdit: true,
        resultVisibility: "PRIVATE",
        maxResponseCount: 40,
        openAt: new Date("2026-05-31T11:00:00+09:00"),
        closeAt: new Date("2026-06-15T23:59:00+09:00"),
        sections: [
          {
            titleKo: "참가 정보",
            titleEn: "Participation details",
            sortOrder: 0,
            questions: [
              {
                titleKo: "가장 관심 있는 워크숍 트랙을 선택해 주세요.",
                titleEn: "Choose your preferred workshop track.",
                questionType: "single_choice",
                options: [
                  { value: "frontend", labelKo: "프론트엔드 UI 구현", labelEn: "Frontend UI" },
                  { value: "backend", labelKo: "백엔드 API 설계", labelEn: "Backend API" },
                  { value: "deploy", labelKo: "배포와 운영 점검", labelEn: "Deployment and operations" },
                ],
                sortOrder: 0,
              },
              {
                titleKo: "사용해 본 기술을 모두 선택해 주세요.",
                titleEn: "Select all technologies you have used.",
                questionType: "multiple_choice",
                options: [
                  { value: "react", labelKo: "React", labelEn: "React" },
                  { value: "node", labelKo: "Node.js", labelEn: "Node.js" },
                  { value: "db", labelKo: "데이터베이스", labelEn: "Database" },
                  { value: "deploy", labelKo: "배포 경험", labelEn: "Deployment" },
                  { value: "none", labelKo: "아직 없습니다", labelEn: "None yet" },
                ],
                sortOrder: 1,
              },
              {
                titleKo: "워크숍에서 만들어 보고 싶은 서비스를 자유롭게 적어주세요.",
                titleEn: "What kind of service would you like to build?",
                questionType: "long_text",
                isRequired: false,
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
        "The SoC Student Council is running a preliminary demand survey for the Fall 2026 MT.",
        "",
        "This is not the final registration form. The result will be used to estimate budget, venue size, and transportation.",
      ].join("\n"),
      eventDescriptionKo: "가을학기 MT 규모와 일정 확정을 위한 사전 수요조사",
      eventDescriptionEn: "A preliminary survey to plan the schedule and capacity for the fall retreat.",
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
        kind: "APPLICATION",
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
    {
      titleKo: "전산학부 커리어 밋업",
      titleEn: "SoC Career Meetup",
      contentKo: "현업 선배와 함께 개발자 커리어, 인턴 준비, 포트폴리오에 대해 이야기하는 소규모 밋업입니다.",
      contentEn: "A small meetup with alumni and industry mentors about software careers, internships, and portfolios.",
      eventDescriptionKo: "현업 선배와 개발자 커리어를 함께 이야기하는 저녁 밋업",
      eventDescriptionEn: "An evening meetup with alumni and industry mentors about software careers.",
      eventStartDate: new Date("2026-08-28T18:30:00+09:00"),
      eventEndDate: new Date("2026-08-28T20:30:00+09:00"),
      isPinned: false,
      viewCount: 87,
      postedAt: new Date("2026-08-21T09:00:00+09:00"),
      poster: makeSeedPosterSvg({
        eyebrow: "CAREER MEETUP",
        title: "커리어 밋업",
        subtitle: "선배와 함께 찾는 다음 단계",
        dateLine: "08.28 FRI 18:30 · N1 라운지",
        accent: "#0f766e",
        accentDark: "#134e4a",
      }),
      survey: makeSimpleEventSurvey({
        titleKo: "전산학부 커리어 밋업 참가 신청",
        titleEn: "SoC Career Meetup Registration",
        descriptionKo: "좌석과 다과 준비를 위해 참석 여부를 미리 알려 주세요.",
        descriptionEn: "Please let us know whether you will attend so we can prepare seats and refreshments.",
        openAt: new Date("2026-08-21T09:00:00+09:00"),
        closeAt: new Date("2026-08-27T23:59:00+09:00"),
        maxResponseCount: 60,
      }),
    },
    {
      titleKo: "오픈소스 기여 스프린트",
      titleEn: "Open Source Contribution Sprint",
      contentKo: "관심 있는 오픈소스 프로젝트를 고르고 이슈 탐색부터 첫 PR까지 함께 진행합니다.",
      contentEn: "Choose an open-source project and work together from issue discovery to your first pull request.",
      eventDescriptionKo: "첫 PR까지 함께 진행하는 오픈소스 실습 세션",
      eventDescriptionEn: "A hands-on session that guides participants to their first open-source pull request.",
      eventStartDate: new Date("2026-09-03T14:00:00+09:00"),
      eventEndDate: new Date("2026-09-04T18:00:00+09:00"),
      isPinned: false,
      viewCount: 63,
      postedAt: new Date("2026-08-20T14:00:00+09:00"),
      poster: makeSeedPosterSvg({
        eyebrow: "OPEN SOURCE",
        title: "오픈소스 스프린트",
        subtitle: "첫 PR을 함께 만들어 봅니다",
        dateLine: "09.03 THU ~ 09.04 FRI · 온라인",
        accent: "#2563eb",
        accentDark: "#1e3a8a",
      }),
      survey: makeSimpleEventSurvey({
        titleKo: "오픈소스 기여 스프린트 참가 신청",
        titleEn: "Open Source Contribution Sprint Registration",
        descriptionKo: "관심 프로젝트와 사용 가능한 시간을 확인합니다.",
        descriptionEn: "Tell us which projects and time slots you are interested in.",
        openAt: new Date("2026-08-20T14:00:00+09:00"),
        closeAt: new Date("2026-09-01T23:59:00+09:00"),
        maxResponseCount: 40,
      }),
    },
    {
      titleKo: "가을 학술제 발표회",
      titleEn: "Fall Research Showcase",
      contentKo: "학부생 연구와 캡스톤 프로젝트를 소개하고 서로의 아이디어를 나누는 발표회입니다.",
      contentEn: "A showcase where undergraduate research and capstone teams share ideas and project results.",
      eventDescriptionKo: "학부생 연구와 프로젝트를 소개하는 가을 발표회",
      eventDescriptionEn: "A fall showcase for undergraduate research and project teams.",
      eventStartDate: new Date("2026-09-11T16:00:00+09:00"),
      eventEndDate: new Date("2026-09-11T19:00:00+09:00"),
      isPinned: false,
      viewCount: 52,
      postedAt: new Date("2026-08-19T10:30:00+09:00"),
      poster: makeSeedPosterSvg({
        eyebrow: "RESEARCH SHOWCASE",
        title: "가을 학술제",
        subtitle: "연구와 프로젝트를 만나는 시간",
        dateLine: "09.11 FRI 16:00 · N1 대강당",
        accent: "#7c3aed",
        accentDark: "#4c1d95",
      }),
      survey: makeSimpleEventSurvey({
        titleKo: "가을 학술제 발표회 참가 신청",
        titleEn: "Fall Research Showcase Registration",
        descriptionKo: "발표회 참석을 위한 좌석을 신청해 주세요.",
        descriptionEn: "Register for a seat at the fall research showcase.",
        openAt: new Date("2026-08-19T10:30:00+09:00"),
        closeAt: new Date("2026-09-09T23:59:00+09:00"),
        maxResponseCount: 100,
      }),
    },
    {
      titleKo: "전산학부 가을 네트워킹 데이",
      titleEn: "SoC Fall Networking Day",
      contentKo: "새 학기의 관심사를 나누고 동료·선배와 편하게 연결되는 네트워킹 데이를 준비했습니다.",
      contentEn: "Meet classmates and alumni, share interests, and build new connections this fall.",
      eventDescriptionKo: "새 학기 관심사와 진로를 나누는 가을 네트워킹 데이",
      eventDescriptionEn: "A fall networking day for sharing interests and career paths.",
      eventStartDate: new Date("2026-10-02T18:00:00+09:00"),
      eventEndDate: new Date("2026-10-02T21:00:00+09:00"),
      isPinned: false,
      viewCount: 41,
      postedAt: new Date("2026-08-18T11:00:00+09:00"),
      poster: makeSeedPosterSvg({
        eyebrow: "FALL NETWORKING",
        title: "가을 네트워킹 데이",
        subtitle: "함께 연결되는 새 학기",
        dateLine: "10.02 FRI 18:00 · N1 다목적홀",
        accent: "#b45309",
        accentDark: "#78350f",
      }),
      survey: makeSimpleEventSurvey({
        titleKo: "전산학부 가을 네트워킹 데이 참가 신청",
        titleEn: "SoC Fall Networking Day Registration",
        descriptionKo: "행사 준비를 위해 참석 여부를 알려 주세요.",
        descriptionEn: "Please let us know whether you will attend so we can prepare the event.",
        openAt: new Date("2026-08-18T11:00:00+09:00"),
        closeAt: new Date("2026-09-30T23:59:00+09:00"),
        maxResponseCount: 120,
      }),
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
      eventDescriptionKo: event.eventDescriptionKo,
      eventDescriptionEn: event.eventDescriptionEn,
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
  console.log(`Seeded ${eventItems.length} event articles with linked surveys and posters`);

  await createSurveyWithQuestions(
    makeAllQuestionTypesSurvey(),
    seedAuthor.userId,
    null,
  );
  console.log("Seeded one survey containing every question type");
}
async function main() {
  const seedMode = process.env.SEED_MODE ??
    (process.env.NODE_ENV === "production" ? "reference" : "demo");
  if (seedMode !== "reference" && seedMode !== "demo") {
    throw new Error("SEED_MODE must be either 'reference' or 'demo'");
  }
  if (process.env.NODE_ENV === "production" && seedMode === "demo") {
    throw new Error("demo_seed_is_forbidden_in_production");
  }

  console.log("Using database:", DATABASE_URL.replace(/:[^:@]+@/, ":****@"));
  console.log("Seed mode:", seedMode);
  try {
    await seedPermissions();
    await seedBoards();
    if (seedMode === "demo") {
      await seedDevAdminRole();
      await seedMockData();
    }
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
