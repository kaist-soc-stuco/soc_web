import { nowMs } from "@soc/shared";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { and, asc, eq, inArray, isNull, ne, or, sql } from "drizzle-orm";
import { createCipheriv, createHash, randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { isDeepStrictEqual } from "node:util";

import {
  articleAssets,
  articles,
  assets,
  boards,
  comments,
  contentBlocks,
  calendarEvents,
  executiveContactDepartments,
  executiveContacts,
  permissions,
  roleGroupPermissions,
  roleGroups,
  surveyQuestions,
  surveyResponses,
  surveySections,
  surveys,
  siteContents,
  userRoleGroups,
  users,
  voteItems,
  voteOptions,
  voteVoters,
  votes,
  roadmapCourseRelations,
  roadmapCourses,
  roadmapOfferings,
  roadmapTerms,
} from "../src/infrastructure/postgres/postgres.schema";
import {
  INITIAL_ADMIN_ROLE_GROUP_NAME,
  getRoadmapLegacyCourseCode,
  normalizeRoadmapCourseCode,
  OPERATIONAL_SURVEY_IDS,
  PERMISSION_REGISTRY,
  type BoardWriteAccessScope,
} from "@soc/contracts";
import {
  ROADMAP_REFERENCE_COURSES,
  ROADMAP_REFERENCE_OFFERINGS,
  ROADMAP_REFERENCE_RELATIONS,
} from "./roadmap-reference";
import { DEMO_EVENTS, DEMO_NOTICES } from "./demo-content";

// Keep demo dates stable throughout one seed run, relative to today's Korean date.
const seedNow = nowMs();
const seedDay = Math.floor((seedNow + 9 * 3600000) / 86400000) * 86400000 - 9 * 3600000;
const demoDate = (days: number, hour = 9, minute = 0) =>
  new Date(seedDay + days * 86400000 + hour * 3600000 + minute * 60000);

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

const DEMO_ACCOUNT_KAIST_UID = "demo-author";
const DEMO_ACCOUNT_EMAIL = "demo@invalid.local";
const LEGACY_DEMO_ACCOUNT_KAIST_UIDS = ["DEV0001", "seed-council-author"] as const;
type BoardSeed = {
  code: string;
  nameKo: string;
  nameEn: string;
  descriptionKo: string;
  descriptionEn: string;
  writeAccessScope: BoardWriteAccessScope;
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
    code: "notice",
    nameKo: "공지",
    nameEn: "Notice",
    descriptionKo: "집행위원회 및 학교의 중요한 공지사항을 확인하세요",
    descriptionEn: "Read important announcements from SoC Student Council and the school.",
    writeAccessScope: "PERMISSION",
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
    writeAccessScope: "PERMISSION",
    writePermissionId: 1,
    allowComment: true,
    allowSecret: false,
    allowLike: true,
    allowGuestRead: true,
    isActive: true,
    sortOrder: 1,
  },
  {
    code: "hoc",
    nameKo: "HoC",
    nameEn: "HoC",
    descriptionKo: "Hall of Code 프로젝트 및 활동 내역",
    descriptionEn: "Browse Hall of Code projects and activity updates.",
    writeAccessScope: "PERMISSION",
    writePermissionId: 1,
    allowComment: true,
    allowSecret: false,
    allowLike: true,
    allowGuestRead: true,
    isActive: true,
    sortOrder: 2,
  },
  {
    code: "promotions",
    nameKo: "홍보글",
    nameEn: "Promotional Posts",
    descriptionKo: "집행위원회 및 학회의 홍보 게시물",
    descriptionEn: "Find promotions from SoC Student Council and student organizations.",
    writeAccessScope: "PERMISSION",
    writePermissionId: 1,
    allowComment: true,
    allowSecret: false,
    allowLike: true,
    allowGuestRead: true,
    isActive: true,
    sortOrder: 3,
  },
  {
    code: "suggestions",
    nameKo: "건의사항",
    nameEn: "Suggestions",
    descriptionKo: "학생들의 의견과 건의사항을 나눠주세요",
    descriptionEn: "Share feedback and suggestions with SoC Student Council.",
    writeAccessScope: "AUTHENTICATED",
    writePermissionId: null,
    allowComment: true,
    allowSecret: true,
    allowLike: true,
    allowGuestRead: true,
    isActive: true,
    sortOrder: 4,
  },
  {
    code: "labs",
    nameKo: "연구실",
    nameEn: "Research Labs",
    descriptionKo: "각 연구실의 소식과 공지사항",
    descriptionEn: "Read news and announcements from research labs.",
    writeAccessScope: "AUTHENTICATED",
    writePermissionId: null,
    allowComment: true,
    allowSecret: false,
    allowLike: true,
    allowGuestRead: true,
    isActive: true,
    sortOrder: 5,
  },
  {
    code: "faq",
    nameKo: "FAQ",
    nameEn: "FAQ",
    descriptionKo: "FAQ와 답변을 확인하세요",
    descriptionEn: "Browse frequently asked questions and answers.",
    writeAccessScope: "PERMISSION",
    writePermissionId: 1,
    allowComment: false,
    allowSecret: false,
    allowLike: false,
    allowGuestRead: true,
    isActive: true,
    sortOrder: 6,
  },
];

type ReferenceFaqSeed = {
  titleKo: string;
  titleEn: string;
  contentKo: string;
  contentEn: string;
};

const LEGACY_REFERENCE_FAQ_HOME_ORDER_BASE = 10_000;
const REFERENCE_FAQ_HOME_ORDER_BASE = 20_000;
const LEGACY_DEMO_FAQ_TITLES = [
  "로그인은 어떻게 하나요?",
  "게시글이나 댓글은 누가 작성할 수 있나요?",
  "행사와 학사 일정은 어디서 확인하나요?",
  "건의사항 답변은 어떻게 확인하나요?",
  "개인정보 수정은 어디에서 하나요?",
] as const;
const RETIRED_REFERENCE_FAQ_TITLES = [
  "학생회 활동인증서는 어디에 요청하나요?",
] as const;
const REFERENCE_FAQ_SEEDS: ReferenceFaqSeed[] = [
  {
    titleKo: "KAIST 계정으로 어떻게 로그인하나요?",
    titleEn: "How do I sign in with my KAIST account?",
    contentKo: "[로그인] 버튼을 누르고 KAIST 통합인증을 완료해 주세요.\n\n• 처음 로그인하면 개인정보 저장 동의가 필요할 수 있습니다.\n• 로그인에 계속 실패하면 오류 문구와 발생 시각을 함께 적어 채널톡으로 문의해 주세요.",
    contentEn: "Select Sign in in the header and complete KAIST SSO.\n\n• You may be asked to consent to storing your account information on your first sign-in.\n• If the issue continues, contact us through Channel Talk with the error message and time.",
  },
  {
    titleKo: "과비는 어떻게 납부하나요?",
    titleEn: "How do I pay the student fee?",
    contentKo: "해당 학기의 과비 납부 공지에서 계좌·금액·기간을 확인한 후 안내된 계좌로 납부해 주세요.\n\n• 이전 학기의 계좌나 금액을 사용하지 마세요.\n• 현재 공지를 찾기 어렵다면 채널톡으로 문의해 주세요.",
    contentEn: "Check the current semester's fee notice for the account, amount, and payment period before transferring the fee.\n\n• Do not reuse account details or amounts from an older semester.\n• Contact us through Channel Talk if you cannot find the current notice.",
  },
  {
    titleKo: "제 과비 납부 여부는 어디서 확인하나요?",
    titleEn: "Where can I check my student-fee status?",
    contentKo: "로그인 후 [마이페이지]에서 과비 납부 상태를 확인할 수 있습니다.\n\n• 입금 내역과 표시 상태가 다르면 입금자명·입금일만 준비해 채널톡으로 문의해 주세요.\n• 전체 계좌번호 등 불필요한 금융정보는 보내지 마세요.",
    contentEn: "After signing in, check your fee status on My Page.\n\n• If it differs from your bank record, contact us through Channel Talk with only the sender name and payment date.\n• Do not send a full bank account number or other unnecessary financial information.",
  },
  {
    titleKo: "과비를 환급받을 수 있나요?",
    titleEn: "Can I request a student-fee refund?",
    contentKo: "과비 환급은 원칙적으로 어렵습니다.\n\n• 중복 입금·오입금처럼 확인이 필요한 경우 입금일·금액·입금자명만 준비해 상담원 연결을 요청해 주세요.\n• 환급 가능 여부는 개별 확인 후 안내하며, 전체 계좌번호 등 불필요한 금융정보는 보내지 마세요.",
    contentEn: "Student-fee payments are generally non-refundable.\n\n• For duplicate or mistaken transfers, request a staff handoff with only the payment date, amount, and sender name.\n• Refund eligibility is reviewed case by case; do not send a full bank account number or other unnecessary financial information.",
  },
  {
    titleKo: "행사·일정은 어디서 확인하나요?",
    titleEn: "Where can I find events and schedules?",
    contentKo: "[행사]에서 행사 목록을, [일정]에서 학사·학생회 일정을 확인할 수 있습니다.\n\n• 상단의 [행사·일정] 메뉴에서 원하는 화면을 선택해 주세요.\n• 신청이 필요한 행사는 행사 상세 페이지의 연결 설문에서 신청해 주세요.",
    contentEn: "Use Events to browse event notices and Calendar to check academic and council schedules.\n\n• Choose the relevant view from the Events menu in the header.\n• Apply through the linked survey on an event's detail page when registration is required.",
  },
  {
    titleKo: "행사는 어떻게 신청하나요?",
    titleEn: "How do I apply for an event?",
    contentKo: "행사 상세 페이지를 열고 연결된 신청 설문을 제출해 주세요.\n\n• 신청 기간과 대상 조건을 먼저 확인해 주세요.\n• 신청 기간이 끝났거나 설문이 보이지 않으면 행사명을 적어 채널톡으로 문의해 주세요.",
    contentEn: "Open the event detail page and submit its linked application survey.\n\n• Check the application period and eligibility first.\n• If registration is closed or the survey is missing, contact us through Channel Talk with the event name.",
  },
  {
    titleKo: "행사 신청을 수정하거나 취소하려면 어떻게 하나요?",
    titleEn: "How do I edit or cancel an event application?",
    contentKo: "응답 수정이 허용된 설문은 참여 기간 안에 기존 응답을 수정할 수 있습니다.\n\n• 현재 사용자가 응답을 직접 취소하거나 삭제하는 기능은 제공하지 않습니다.\n• 취소가 필요하면 행사명과 신청 정보만 적어 상담원 연결을 요청하고, 취소·환불 조건은 행사별 공지를 확인해 주세요.",
    contentEn: "If a survey allows response editing, you can update your existing response during the participation period.\n\n• There is currently no self-service option to cancel or delete a response.\n• To request cancellation, ask for a staff handoff with only the event name and application details, and check the event notice for cancellation or refund terms.",
  },
  {
    titleKo: "학생회에 사업이나 정책을 건의하려면 어떻게 하나요?",
    titleEn: "How can I suggest a project or policy to the council?",
    contentKo: "로그인 후 [건의사항] 게시판에서 글을 작성해 주세요.\n\n• 공개가 부담스러운 내용은 비밀글로 작성할 수 있습니다.\n• 공식 답변이 등록되면 [알림]에서 확인할 수 있습니다.",
    contentEn: "After signing in, submit your suggestion on the Suggestions board.\n\n• Mark it as secret if it should not be public.\n• You will receive a notification when an official response is posted.",
  },
  {
    titleKo: "비밀 건의사항과 공식 답변은 누가 볼 수 있나요?",
    titleEn: "Who can see secret suggestions and official responses?",
    contentKo: "비밀 건의사항은 작성자와 해당 게시판의 공식 답변 또는 게시글 관리 권한이 있는 운영진만 확인할 수 있습니다.\n\n• 다른 이용자에게는 제목과 본문이 공개되지 않습니다.\n• 공식 답변도 해당 비밀글에 접근할 수 있는 이용자에게만 표시됩니다.",
    contentEn: "Secret suggestions are visible only to the author and council members with official-response or content-moderation access for the board.\n\n• Other users cannot see the title or body.\n• Official responses are visible only to users who can access that secret post.",
  },
  {
    titleKo: "행사나 동아리 홍보글 게시를 요청하려면 어떻게 하나요?",
    titleEn: "How do I request an event or club promotion post?",
    contentKo: "[설문·투표] 메뉴의 [신청형 설문]에서 ‘학부 내 행사·동아리 홍보글 게시 요청’을 제출해 주세요.\n\n• 게시할 문구·포스터·희망 게시일을 함께 보내 주세요.\n• 제출한 요청은 담당자가 확인하며, 제출만으로 게시 여부나 일정이 확정되지는 않습니다.",
    contentEn: "In Surveys & Voting, open the application survey titled ‘SoC Event or Club Promotion Post Request.’\n\n• Include the copy, poster, and preferred publication date.\n• A council member will review the request; submission alone does not confirm publication or its schedule.",
  },
  {
    titleKo: "학번별 단체 카카오톡방에 참여하려면 어떻게 하나요?",
    titleEn: "How do I join my cohort KakaoTalk chat?",
    contentKo: "[학부 생활] > [학번톡 참여 신청]을 누르거나 [설문·투표] > [신청형 설문]에서 ‘전산학부 학번톡 초대 요청’을 제출해 주세요.\n\n• 초대를 받을 카카오톡 ID·전화번호와 입학 연도를 정확히 입력해 주세요.\n• 대상 확인을 위해 전산학부 주전공 및 학적 정보를 확인할 수 있습니다.",
    contentEn: "Select Campus Life → Join Cohort Chat, or submit ‘SoC Cohort Chat Invitation Request’ under application surveys.\n\n• Enter the KakaoTalk ID or phone number and admission year accurately.\n• Your School of Computing primary-major and enrollment information may be checked for eligibility.",
  },
  {
    titleKo: "졸업 요건과 교과목 이수 순서는 어디서 확인하나요?",
    titleEn: "Where can I check graduation requirements and course planning?",
    contentKo: "입학 연도에 적용되는 최신 학사요람과 전산학부 공식 안내를 우선 확인해 주세요.\n\n• [전산학부 로드맵]은 과목 탐색을 돕는 참고 자료입니다.\n• 개인별 졸업 사정이나 선수조건은 학사요람과 담당 부서의 안내를 기준으로 확인해 주세요.",
    contentEn: "Start with the latest academic handbook and official School of Computing guidance for your admission year.\n\n• The SoC Roadmap is a planning aid for exploring courses.\n• Use the handbook and the responsible office's guidance for your individual degree audit and prerequisites.",
  },
  {
    titleKo: "연구실, 교수진, 시설 정보는 어디서 확인하나요?",
    titleEn: "Where can I find information about labs, faculty, and facilities?",
    contentKo: "연구실·교수진·학부 소식은 전산학부 공식 홈페이지(cs.kaist.ac.kr)에서 확인해 주세요.\n\n• 시설 이용 정보나 로그인 전용 자료는 공식 홈페이지 로그인이 필요할 수 있습니다.\n• 원하는 정보를 찾기 어렵다면 해당 홈페이지의 문의 창구를 이용해 주세요.",
    contentEn: "Visit the official School of Computing website (cs.kaist.ac.kr) for labs, faculty, and school news.\n\n• Facility information or restricted materials may require signing in there.\n• Use the official website's contact channel if you cannot find what you need.",
  },
  {
    titleKo: "집행위원회 모집은 언제 하나요?",
    titleEn: "When does the Student Council recruit members?",
    contentKo: "모집 시기는 학기별 운영 일정에 따라 달라집니다.\n\n• 모집이 열리면 공지 게시판과 학생회 공식 채널에 안내합니다.\n• 현재 모집 공지가 보이지 않으면 다음 공지를 기다려 주세요.",
    contentEn: "Recruitment timing varies by semester.\n\n• Open recruitment is announced on the Notice board and official council channels.\n• If no current notice is available, please wait for the next announcement.",
  },
  {
    titleKo: "기업 후원이나 제휴를 제안하려면 어떻게 하나요?",
    titleEn: "How can a company propose sponsorship or a partnership?",
    contentKo: "후원 및 제휴 제안은 학생회 소개 → 후원 및 제휴에서 채널톡으로 보내 주세요. 기관명, 회신 연락처와 제안 내용을 함께 알려 주세요.",
    contentEn: "Send sponsorship and partnership proposals through Channel Talk under About \u2192 Partnerships. Include your organization, contact details, and proposal.",
  },
  {
    titleKo: "전산학부 학생회칙은 어디서 확인하나요?",
    titleEn: "Where can I read the SoC Student Council bylaws?",
    contentKo: "현행 공개본은 카이스트 백과사전의 전산학부 학생회칙에서 확인할 수 있습니다.\nhttps://student.kaist.ac.kr/wiki/학부총학생회:전산학부_학생회칙\n\n• 특정 조항의 적용이나 최신 개정 여부는 학생회 담당자에게 확인해 주세요.",
    contentEn: "Read the current public version on the KAIST Wiki page for the SoC Student Council bylaws.\nhttps://student.kaist.ac.kr/wiki/학부총학생회:전산학부_학생회칙\n\n• Ask a council member to confirm how a provision applies or whether a newer amendment exists.",
  },
  {
    titleKo: "설문이나 투표에 참여할 수 없다고 표시되는 이유는 무엇인가요?",
    titleEn: "Why am I not eligible for a survey or vote?",
    contentKo: "설문·투표마다 참여 조건이 다릅니다.\n\n• 로그인 여부, 전산학부 소속, 학적 상태, 과비 납부 여부, 참여 기간을 확인해 주세요.\n• 참여 화면에 표시된 미충족 조건을 먼저 확인해 주세요.\n• 프로필 정보가 실제와 다르면 [마이페이지]를 확인한 후 채널톡으로 문의해 주세요.",
    contentEn: "Each survey or vote has its own participation requirements.\n\n• Check sign-in status, SoC affiliation, enrollment, student-fee status, and the participation period.\n• Start with the unmet condition shown on the participation page.\n• If your profile is incorrect, review My Page and contact us through Channel Talk.",
  },
  {
    titleKo: "댓글이나 공식 답변 알림은 어디서 확인하나요?",
    titleEn: "Where can I find comment and official-response notifications?",
    contentKo: "로그인 후 헤더의 [알림]에서 읽지 않은 새 댓글·답글과 공식 답변을 확인할 수 있습니다.\n\n• 알림을 누르면 읽음 처리되어 목록에서 사라집니다.\n• 현재 읽은 알림을 다시 확인하는 별도 전체 내역 화면은 제공하지 않습니다.",
    contentEn: "After signing in, use the notification icon in the header to see unread comments, replies, and official responses.\n\n• Opening a notification marks it as read and removes it from the list.\n• There is currently no separate page for reviewing read notification history.",
  },
  {
    titleKo: "사이트 오류는 어떻게 신고하나요?",
    titleEn: "How do I report a website issue?",
    contentKo: "오류가 난 페이지 주소·발생 시각·재현 순서·화면 캡처를 채널톡으로 보내 주세요.\n\n• 비밀번호, 전체 계좌번호, 설문 답변 등 불필요한 개인정보는 첨부하지 마세요.\n• 접수 확인이 필요하면 문의 시 접수 여부를 함께 확인해 주세요.",
    contentEn: "Send the page URL, time, reproduction steps, and a screenshot through Channel Talk.\n\n• Do not include passwords, full bank account numbers, survey responses, or other unnecessary personal data.\n• Ask for confirmation of receipt if you need to know whether the report was received.",
  },
  {
    titleKo: "프로필 정보가 잘못 표시되면 어떻게 하나요?",
    titleEn: "What should I do if my profile information is incorrect?",
    contentKo: "로그인 후 [마이페이지]에서 표시된 학적·전공 정보를 확인해 주세요.\n\n• 직접 수정할 수 있는 항목은 [마이페이지]에서 변경해 주세요.\n• KAIST 원본 정보와 다르면 잘못된 항목만 적어 채널톡으로 문의해 주세요.\n• 비밀번호나 주민등록번호는 보내지 마세요.",
    contentEn: "After signing in, review the enrollment and major information shown on My Page.\n\n• Update fields that are editable there.\n• If the information differs from the KAIST source, contact us through Channel Talk and identify only the incorrect field.\n• Never send a national ID number or password.",
  },
  {
    titleKo: "계정 비활성화 안내가 표시되면 어떻게 하나요?",
    titleEn: "What should I do if my account is deactivated?",
    contentKo: "비활성화된 계정은 로그인할 수 없습니다.\n\n• 복구 또는 사유 확인이 필요하면 화면 안내에 따라 채널톡으로 문의해 주세요.\n• 계정 상태나 제재 사유를 임의로 추측하지 않습니다.",
    contentEn: "A deactivated account cannot sign in.\n\n• Follow the on-screen guidance and contact us through Channel Talk to ask about restoration or the reason.\n• We cannot infer an account status or sanction reason.",
  },
  {
    titleKo: "게시글·댓글 작성 권한은 어떻게 되나요?",
    titleEn: "Who can create posts and comments?",
    contentKo: "게시글 작성 가능 여부는 게시판별 작성 권한과 로그인 상태에 따라 다릅니다.\n\n• 작성 버튼이 보이지 않으면 해당 게시판에서 글을 작성할 수 없습니다.\n• 댓글은 게시판의 댓글 허용 설정과 로그인 여부에 따라 달라집니다.\n• 정확한 조건은 각 게시판의 안내를 확인해 주세요.",
    contentEn: "Posting availability depends on the board's writing permissions and your sign-in status.\n\n• If the write button is not shown, you cannot create a post on that board.\n• Commenting depends on the board's comment setting and sign-in status.\n• Check each board's guidance for the exact conditions.",
  },
];

type ReferencePledgeSeed = {
  legacyTitleKo?: string;
  titleKo: string;
  titleEn: string;
  bodyKo: string;
  bodyEn: string;
  pledgeStatus: "COMPLETED" | "IN_PROGRESS" | "PLANNED";
};

const REFERENCE_PLEDGE_SEEDS: readonly ReferencePledgeSeed[] = [
  {
    titleKo: "전산학부 학생회 웹사이트 개발",
    titleEn: "SoC Student Council website development",
    bodyKo: "학생회 웹사이트 1.0을 공개했습니다. 앞으로 기능을 추가하고 사이트를 꾸준히 관리할 예정입니다. 이용 중 불편한 점이나 오류를 발견하면 채널톡으로 알려 주세요.",
    bodyEn: "Version 1.0 of the Student Council website is live. We plan to add features and maintain the site. If you have trouble using the site or find a bug, please let us know through Channel Talk.",
    pledgeStatus: "COMPLETED",
  },
  {
    legacyTitleKo: "사업 전문화를 위한 집행위원회 구조 개편",
    titleKo: "사업 전문화를 위한 집행위원회 조직 개편",
    titleEn: "Student Council restructuring",
    bodyKo: "부서별 전문성과 업무 분담을 강화하기 위해, 부서와 팀을 함께 두던 조직을 부서 중심으로 개편했습니다. 기업 및 다른 학교와의 교류를 맡는 대외소통부와 웹사이트 개발 등을 맡는 전산관리부를 신설했습니다. 자세한 구성은 이 페이지의 조직도에서 확인할 수 있습니다.",
    bodyEn: "We reorganized the Student Council from a mix of departments and teams into a department-based structure to clarify responsibilities and support more specialized work. We established the External Communications Division for exchanges with companies and other universities, and the IT Administration Division for website development and related work. See the organization chart on this page for details.",
    pledgeStatus: "COMPLETED",
  },
  {
    titleKo: "과목별 겹강톡 개설",
    titleEn: "Course group chats",
    bodyKo: "2026년 봄학기, 운영 계획을 안내하고 담당 교수님의 동의를 받은 과목에 겹강톡을 개설했습니다. 수강생만 익명으로 참여하며 교수와 조교는 참여하지 않습니다. 개설 과목과 참여 코드는 안내 스프레드시트에서 확인할 수 있습니다.",
    bodyEn: "In spring 2026, we opened course group chats after explaining the operating plan to the instructors and obtaining their approval. Only enrolled students participate, anonymously; professors and teaching assistants do not join. The course list and access codes are available in the announcement spreadsheet.",
    pledgeStatus: "COMPLETED",
  },
  {
    titleKo: "타 학교, 타 학과와의 교류 행사 추진",
    titleEn: "Events with other universities and departments",
    bodyKo: "다른 학교의 전산학부나 컴퓨터공학과 학생들과 교류하는 행사를 기획하고 있습니다.",
    bodyEn: "We are planning an event with computing and computer engineering students at other universities.",
    pledgeStatus: "IN_PROGRESS",
  },
  {
    titleKo: "진로 탐색 기회 확장",
    titleEn: "More opportunities to explore careers",
    bodyKo: "진로콘서트를 토크콘서트로 개편하고, 더 다양한 분야의 연사를 초청해 강연을 진행했습니다. 이번 학기 기업체 탐방에서도 더 다양한 기업을 방문하고자 준비하고 있습니다.",
    bodyEn: "We redesigned the Career Concert as the Talk Concert and invited speakers from more fields. We are also working to broaden the range of companies included in this semester’s visits.",
    pledgeStatus: "IN_PROGRESS",
  },
  {
    titleKo: "스승의 날 행사 개최",
    titleEn: "Teachers’ Day event",
    bodyKo: "중단되었던 스승의 날 행사를 다시 열었습니다. 학우들이 전산학부 교수님들께 글로 감사의 마음을 전하는 행사입니다.",
    bodyEn: "We brought back the Teachers’ Day event, giving students a chance to send written messages of thanks to SoC faculty.",
    pledgeStatus: "COMPLETED",
  },
  {
    legacyTitleKo: "전산학부 OTL 수강 후기 이벤트 진행",
    titleKo: "전산학부 OTL 수강 후기 이벤트",
    titleEn: "SoC OTL course-review event",
    bodyKo: "전공 수강 계획에 참고할 수 있는 수강 후기를 모으기 위해 봄학기 종강 후 OTL 수강 후기 이벤트를 진행했습니다. 가을학기에도 같은 행사를 열 예정입니다.",
    bodyEn: "After the spring semester ended, we ran an OTL course-review event to gather reviews that help students plan their major courses. We plan to hold the event again in the fall semester.",
    pledgeStatus: "COMPLETED",
  },
  {
    legacyTitleKo: "공약이행상황판 제작",
    titleKo: "공약 이행 상황판 제작",
    titleEn: "Pledge progress board",
    bodyKo: "학생회장단의 공약 이행 현황을 이 페이지에서 확인할 수 있습니다.",
    bodyEn: "This page shows progress on the pledges made by the SoC Student Council leadership.",
    pledgeStatus: "COMPLETED",
  },
];

type ReferenceAboutWorkContentSeed = {
  key:
    | "about.hero.description"
    | "about.work.title"
    | "about.intro.body"
    | "about.nav.intro"
    | "about.work.card.1.title"
    | "about.work.card.1.description"
    | "about.work.card.2.title"
    | "about.work.card.2.description"
    | "about.work.card.3.title"
    | "about.work.card.3.description"
    | "about.organization.description"
    | "about.partnership.description"
    | "about.partnership.cta";
  legacyKo: string | readonly string[];
  valueKo: string;
  valueEn: string;
};

/**
 * 공개 카드뉴스에서 확인한 실제 사업명을 about 주요 사업 카드의
 * reference site-content seed로 보관한다. 기존에 관리자가 편집한 값은
 * 보존하고, 이전의 추상 기본값만 구체적인 사업 목록으로 교체한다.
 */
const REFERENCE_ABOUT_WORK_CONTENT_SEEDS: readonly ReferenceAboutWorkContentSeed[] = [
  {
    key: "about.work.title",
    legacyKo: "주요 사업",
    valueKo: "주요 사업",
    valueEn: "Our programs",
  },
  {
    key: "about.hero.description",
    legacyKo: [
      "KAIST 전산학부 학부생을 대표하는 학생자치기구 집행위원회입니다.",
      "전산학부 학우들을 위한 사업을 기획하고 진행하는 학생자치기구, 집행위원회입니다.",
      "전산학부 학우들을 위한 사업을 기획하고 집행하는 학생자치기구, 전산학부 집행위원회입니다.",
      "학우들의 일상과 진로, 교류를 잇습니다.\n아이디어를 실제 사업으로 옮겨, 함께할 경험과 기회를 만듭니다.",
    ],
    valueKo: "Together Rooted, Endlessly Expanding",
    valueEn: "Together Rooted, Endlessly Expanding",
  },
  {
    key: "about.intro.body",
    legacyKo: [
      "전산학부 학생회는 학우들의 권익을 대변하며, 학업과 진로에 필요한 경험과 교류의 기회를 마련하는 학생자치기구입니다.\n집행위원회는 사업의 기획부터 준비, 실행까지 맡습니다. 시험기간 간식, 진로 행사, 문화·교류 프로그램 등 학우들이 체감할 수 있는 혜택을 만듭니다.\n2026 집행위원회 TREE는 ‘Together Rooted, Endlessly Expanding’을 슬로건으로, 학생과 학교, 기업을 연결하며 함께 성장하고자 합니다.",
      "KAIST 전산학부 집행위원회는 학우들의 권익을 대변하고 더 나은 학업·문화 환경을 만들어가는 학생자치기구입니다. 소통 창구 운영부터 진로 세미나, 문화·복지 행사까지 학우들에게 실질적으로 필요한 일들을 고민하고 실행합니다.",
      "전산학부 학생회는 학우들이 학부 공동체 안에서 서로 연결되고, 학업과 진로에 필요한 다양한 경험과 기회를 얻을 수 있도록 돕는 학생자치기구입니다.\n집행위원회는 학생회의 아이디어가 실제 사업으로 이어질 수 있도록 기획부터 준비, 실행까지의 전 과정을 직접 담당합니다. 학우들의 일상과 진로, 교류에 실질적인 도움이 되는 경험과 혜택을 꾸준히 만들어가고 있습니다.\n2026 전산학부 집행위원회 TREE는 ‘Together Rooted, Endlessly Expanding’이라는 슬로건처럼 학생과 학교, 기업을 연결하고, 그 관계를 바탕으로 함께 성장하며 더 넓은 가능성으로 나아가고자 합니다.",
      "전산학부 학생회는 학우들의 권익을 대변하며, 학업과 진로에 필요한 경험과 교류의 기회를 마련하는 학생자치기구입니다.\n집행위원회는 사업의 기획부터 준비, 실행까지 맡습니다. 시험기간 간식, 진로 행사, 문화·교류 프로그램 등 학우들이 체감할 수 있는 혜택을 만듭니다.\nTREE는 학생과 학교, 기업을 연결하며 그 관계를 바탕으로 함께 성장하고자 합니다.",
    ],
    valueKo: "전산학부 학생회는 학우들이 학부 공동체 안에서 서로 교류하고, 학업과 진로에 필요한 경험과 기회를 얻도록 돕는 학생자치기구입니다.\n집행위원회는 학생회의 아이디어를 사업으로 구체화하고, 기획부터 준비와 실행까지 맡습니다. 학우들의 일상과 진로, 교류에 도움이 되는 경험과 혜택을 꾸준히 제공하고 있습니다.\n2026 전산학부 집행위원회 TREE는 “Together Rooted, Endlessly Expanding”이라는 슬로건처럼 학생과 학교, 기업을 연결하고, 그 관계를 바탕으로 함께 성장하며 더 넓은 가능성을 찾아가고자 합니다.",
    valueEn: "The School of Computing Student Council is a student-run organization that helps students connect within the SoC community and find opportunities related to their studies and careers.\nWe put ideas into practice by planning, preparing, and running programs that support students’ everyday lives, careers, and connections with one another.\nThe 2026 SoC Student Council, TREE, aims to connect students, the university, and companies so they can grow together and explore new possibilities, guided by its slogan, “Together Rooted, Endlessly Expanding.”",
  },
  {
    key: "about.nav.intro",
    legacyKo: "집행위원회 소개",
    valueKo: "소개",
    valueEn: "About",
  },
  {
    key: "about.work.card.1.title",
    legacyKo: "겹강톡 · 학업 소통",
    valueKo: "학업 · 소통",
    valueEn: "Academic communication",
  },
  {
    key: "about.work.card.1.description",
    legacyKo: "• 과목별 겹강톡\n• OTL 수강후기 이벤트\n• 건의사항 게시판",
    valueKo: "• 과목별 겹강톡 운영\n• OTL 수강후기 작성 이벤트\n• 학부 건의사항 소통 창구",
    valueEn: "• Course-specific group chats\n• OTL course-review writing event\n• Student feedback channel",
  },
  {
    key: "about.work.card.2.title",
    legacyKo: "기업체 탐방 · 진로 연결",
    valueKo: "진로 탐색 및 커리어",
    valueEn: "Career exploration",
  },
  {
    key: "about.work.card.2.description",
    legacyKo: "• 기업체 탐방\n• 토크콘서트\n• Human of CS\n• 테크 세미나 및 기업 채용설명회",
    valueKo: "• IT 기업체 탐방 프로그램\n• 선배 초청 토크콘서트\n• 테크 세미나 및 기업 채용설명회\n• Humans of CS (학우 인터뷰)",
    valueEn: "• IT company tour program\n• Alumni talk concert\n• Tech seminars and company recruiting sessions\n• Humans of CS (student interviews)",
  },
  {
    key: "about.work.card.3.title",
    legacyKo: "SOC LOUNGE · 학부 생활",
    valueKo: "학생 복지",
    valueEn: "Student welfare",
  },
  {
    key: "about.work.card.3.description",
    legacyKo: "• 전산학부 과방(SOC LOUNGE)\n• 전산학부 워크샵\n• SoC 해피아워\n• 시험기간 간식 이벤트\n• 단체복 굿즈 제작",
    valueKo: "• 과방(SoC Lounge) 운영\n• 시험기간 야식 및 간식\n• 학부 워크샵 & 해피아워\n• 과잠 및 학부 굿즈 제작",
    valueEn: "• SoC Lounge operation\n• Exam-period late-night snacks\n• School workshop & Happy Hour\n• Department varsity jackets and merchandise",
  },
  {
    key: "about.organization.description",
    legacyKo: "전산학부 집행위원회를 구성하는 부서별 주요 업무입니다.",
    valueKo: "전산학부 집행위원회를 구성하는 부서들입니다.",
    valueEn: "These are the departments that make up the SoC Student Council.",
  },
  {
    key: "about.partnership.description",
    legacyKo: [
      "전산학부 학우들과 함께할 기업 채용 설명회, 기술 세미나(Tech Talk), 행사 후원 등 다양한 제휴 제안을 기다립니다. 담당자 연락처와 함께 문의해 주시면 검토 후 회신드리겠습니다.",
      "전산학부 학우들과 함께할 채용 설명회, 기술 세미나(Tech Talk), 행사 후원 등의 제휴를 기다립니다. 제안 내용을 보내 주시면 검토 후 회신드리겠습니다.",
    ],
    valueKo: "전산학부 학우들을 위한 채용 설명회와 기술 세미나, 행사 후원 등의 제안을 받습니다. 제안 내용을 보내 주시면 검토 후 답변드리겠습니다.",
    valueEn: "We welcome proposals for recruiting sessions, tech talks, and sponsorship of events for SoC students. Send us your proposal, and we will review it and reply.",
  },
  {
    key: "about.partnership.cta",
    legacyKo: [
      "후원·제휴 문의하기",
      "제휴 문의",
    ],
    valueKo: "제휴 문의",
    valueEn: "Contact us",
  },
];

/**
 * 기존 reference FAQ가 아직 이전 문구인 경우에만 새 문구로 갱신한다.
 * 관리자가 이미 편집한 FAQ는 seed 재실행으로 덮어쓰지 않는다.
 */
const LEGACY_REFERENCE_FAQ_CONTENT = new Map<string, string>([
  [
    "KAIST 계정으로 어떻게 로그인하나요?",
    "헤더의 로그인 버튼을 누르고 KAIST 통합인증을 완료해 주세요.\n\n• 처음 로그인하면 개인정보 저장 동의가 필요할 수 있습니다.\n• 로그인에 계속 실패하면 오류 문구와 발생 시각을 함께 적어 채널톡으로 문의해 주세요.",
  ],
  [
    "제 과비 납부 여부는 어디서 확인하나요?",
    "로그인 후 마이페이지에서 과비 납부 상태를 확인할 수 있습니다.\n\n• 입금 내역과 표시 상태가 다르면 입금자명·입금일만 준비해 채널톡으로 문의해 주세요.\n• 전체 계좌번호 등 불필요한 금융정보는 보내지 마세요.",
  ],
  [
    "행사·일정은 어디서 확인하나요?",
    "행사 메뉴에서 행사 목록을, 일정 메뉴에서 학사·학생회 일정을 확인할 수 있습니다.\n\n• 상단 메뉴의 행사·일정에서 원하는 화면을 선택하세요.\n• 신청이 필요한 행사는 행사 상세의 연결 설문에서 신청합니다.",
  ],
  [
    "행사는 어떻게 신청하나요?",
    "행사 상세 페이지를 열고 연결된 신청 설문을 제출해 주세요.\n\n• 신청 기간과 대상 조건을 먼저 확인하세요.\n• 신청 기간이 끝났거나 설문이 보이지 않으면 행사명을 적어 채널톡으로 문의해 주세요.",
  ],
  [
    "행사 신청을 수정하거나 취소하려면 어떻게 하나요?",
    "설문에 수정 또는 취소 기능이 안내되어 있으면 해당 방법으로 처리해 주세요.\n\n• 기능이 보이지 않으면 행사명과 신청 정보만 적어 채널톡으로 문의하세요.\n• 취소·환불 조건은 행사별 공지를 확인해 주세요.",
  ],
  [
    "학생회에 사업이나 정책을 건의하려면 어떻게 하나요?",
    "로그인 후 건의사항 게시판에서 글을 작성해 주세요.\n\n• 공개가 부담스러운 내용은 비밀글로 작성할 수 있습니다.\n• 공식 답변이 등록되면 알림에서 확인할 수 있습니다.",
  ],
  [
    "행사나 동아리 홍보글 게시를 요청하려면 어떻게 하나요?",
    "설문·투표 메뉴의 신청형 설문에서 ‘학부 내 행사·동아리 홍보글 게시 요청’을 제출해 주세요.\n\n• 게시할 문구·포스터·희망 게시일을 함께 보내 주세요.\n• 검토 후 게시 여부와 일정을 안내합니다.",
  ],
  [
    "학번별 단체 카카오톡방에 참여하려면 어떻게 하나요?",
    "학부 생활 → 학번톡 참여 신청을 누르거나 설문·투표 → 신청형 설문에서 ‘전산학부 학번톡 초대 요청’을 제출해 주세요.\n\n• 초대를 받을 카카오톡 ID·전화번호와 입학 연도를 정확히 입력하세요.\n• 대상 확인을 위해 전산학부 주전공 및 학적 정보를 확인할 수 있습니다.",
  ],
  [
    "졸업 요건과 교과목 이수 순서는 어디서 확인하나요?",
    "입학 연도에 적용되는 최신 학사요람과 전산학부 공식 안내를 우선 확인해 주세요.\n\n• 전산학부 로드맵은 과목 탐색을 돕는 참고 자료입니다.\n• 개인별 졸업 사정이나 선수조건은 학사요람과 담당 부서의 안내를 기준으로 확인하세요.",
  ],
  [
    "연구실, 교수진, 시설 정보는 어디서 확인하나요?",
    "연구실·교수진·학부 소식은 전산학부 공식 홈페이지(cs.kaist.ac.kr)에서 확인해 주세요.\n\n• 시설 이용 정보나 로그인 전용 자료는 공식 홈페이지 로그인이 필요할 수 있습니다.\n• 원하는 정보를 찾기 어렵다면 해당 홈페이지의 문의 창구를 이용하세요.",
  ],
  [
    "기업 후원이나 제휴를 제안하려면 어떻게 하나요?",
    "학생회 소개 → 후원 및 제휴 또는 설문·투표 메뉴의 ‘기업 후원 및 제휴 문의’를 이용해 주세요.\n\n• 기업·기관명, 회신 이메일, 제안 유형과 내용을 입력하세요.\n• 담당자가 내용을 검토한 후 회신합니다.",
  ],
  [
    "설문이나 투표에 참여할 수 없다고 표시되는 이유는 무엇인가요?",
    "설문·투표마다 참여 조건이 다릅니다.\n\n• 로그인 여부, 전산학부 소속, 학적 상태, 과비 납부 여부, 참여 기간을 확인하세요.\n• 참여 화면에 표시된 미충족 조건을 먼저 확인하세요.\n• 프로필 정보가 실제와 다르면 마이페이지 확인 후 채널톡으로 문의해 주세요.",
  ],
  [
    "댓글이나 공식 답변 알림은 어디서 확인하나요?",
    "로그인 후 헤더의 알림 아이콘에서 내 글의 새 댓글·답글과 공식 답변을 확인할 수 있습니다.\n\n• 읽은 알림을 포함한 전체 내역은 알림 목록에서 확인하세요.\n• 알림을 찾을 수 없으면 해당 계정으로 로그인했는지 확인해 주세요.",
  ],
  [
    "프로필 정보가 잘못 표시되면 어떻게 하나요?",
    "로그인 후 마이페이지에서 표시된 학적·전공 정보를 확인해 주세요.\n\n• 직접 수정할 수 있는 항목은 마이페이지에서 변경합니다.\n• KAIST 원본 정보와 다르면 잘못된 항목만 적어 채널톡으로 문의해 주세요.\n• 비밀번호나 주민등록번호는 보내지 마세요.",
  ],
]);

// Reference answers shipped immediately before the current copy. Keeping the
// exact previous text lets a repeated seed upgrade untouched reference rows
// without overwriting an answer that an administrator has edited.
const PREVIOUS_REFERENCE_FAQ_CONTENT = new Map<string, string>([
  [
    "과비를 환급받을 수 있나요?",
    "과비 환급 가능 여부는 납부 공지와 개별 사유에 따라 확인이 필요합니다.\n\n• 중복 입금·오입금처럼 확인이 필요한 경우 입금일·금액·입금자명만 준비해 상담원 연결을 요청해 주세요.\n• 전체 계좌번호 등 불필요한 금융정보는 보내지 마세요.",
  ],
  [
    "행사 신청을 수정하거나 취소하려면 어떻게 하나요?",
    "설문에 수정 또는 취소 기능이 안내되어 있으면 해당 방법으로 처리해 주세요.\n\n• 기능이 보이지 않으면 행사명과 신청 정보만 적어 채널톡으로 문의해 주세요.\n• 취소·환불 조건은 행사별 공지를 확인해 주세요.",
  ],
  [
    "비밀 건의사항과 공식 답변은 누가 볼 수 있나요?",
    "비밀 건의사항은 작성자와 답변 권한이 있는 운영진만 확인할 수 있습니다.\n\n• 다른 이용자에게는 제목과 본문이 공개되지 않습니다.\n• 공식 답변은 해당 건의사항의 작성자와 공식 답변 권한이 있는 운영진에게만 표시됩니다.",
  ],
  [
    "행사나 동아리 홍보글 게시를 요청하려면 어떻게 하나요?",
    "[설문·투표] 메뉴의 [신청형 설문]에서 ‘학부 내 행사·동아리 홍보글 게시 요청’을 제출해 주세요.\n\n• 게시할 문구·포스터·희망 게시일을 함께 보내 주세요.\n• 검토 후 게시 여부와 일정을 안내합니다.",
  ],
  [
    "기업 후원이나 제휴를 제안하려면 어떻게 하나요?",
    "[학생회 소개] > [후원 및 제휴] 또는 [설문·투표] > [신청형 설문]의 ‘기업 후원 및 제휴 문의’를 이용해 주세요.\n\n• 기업·기관명, 회신 이메일, 제안 유형과 내용을 입력해 주세요.\n• 담당자가 내용을 검토한 후 회신합니다.",
  ],
  [
    "전산학부 학생회칙은 어디서 확인하나요?",
    "현행 공개본은 카이스트 백과사전의 전산학부 학생회칙에서 확인할 수 있습니다.\n\n• 특정 조항의 적용이나 최신 개정 여부가 궁금하면 담당자에게 문의해 주세요.\n• 학생회가 법률 해석을 대신하지는 않습니다.",
  ],
  [
    "댓글이나 공식 답변 알림은 어디서 확인하나요?",
    "로그인 후 헤더의 [알림]에서 내 글의 새 댓글·답글과 공식 답변을 확인할 수 있습니다.\n\n• 읽은 알림을 포함한 전체 내역은 [알림 목록]에서 확인해 주세요.\n• 알림을 찾을 수 없으면 해당 계정으로 로그인했는지 확인해 주세요.",
  ],
]);

const FAQ_DISPLAY_ORDER = new Map<string, number>([
  ["KAIST 계정으로 어떻게 로그인하나요?", 0],
  ["게시글·댓글 작성 권한은 어떻게 되나요?", 1],
  ["프로필 정보가 잘못 표시되면 어떻게 하나요?", 2],
  ["계정 비활성화 안내가 표시되면 어떻게 하나요?", 3],
  ["과비는 어떻게 납부하나요?", 4],
  ["제 과비 납부 여부는 어디서 확인하나요?", 5],
  ["과비를 환급받을 수 있나요?", 6],
  ["행사·일정은 어디서 확인하나요?", 7],
  ["행사는 어떻게 신청하나요?", 8],
  ["행사 신청을 수정하거나 취소하려면 어떻게 하나요?", 9],
  ["설문이나 투표에 참여할 수 없다고 표시되는 이유는 무엇인가요?", 10],
  ["학생회에 사업이나 정책을 건의하려면 어떻게 하나요?", 11],
  ["비밀 건의사항과 공식 답변은 누가 볼 수 있나요?", 12],
  ["댓글이나 공식 답변 알림은 어디서 확인하나요?", 13],
  ["사이트 오류는 어떻게 신고하나요?", 14],
  ["행사나 동아리 홍보글 게시를 요청하려면 어떻게 하나요?", 15],
  ["학번별 단체 카카오톡방에 참여하려면 어떻게 하나요?", 16],
  ["졸업 요건과 교과목 이수 순서는 어디서 확인하나요?", 17],
  ["연구실, 교수진, 시설 정보는 어디서 확인하나요?", 18],
  ["집행위원회 모집은 언제 하나요?", 19],
  ["기업 후원이나 제휴를 제안하려면 어떻게 하나요?", 20],
  ["전산학부 학생회칙은 어디서 확인하나요?", 21],
]);
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
  // The legacy SUPER_ADMIN bit used to act as an implicit bypass for every
  // permission. Keep the row for referential integrity, but make it inactive
  // so all administrator access is represented by explicit permission bits.
  await db
    .update(permissions)
    .set({ isActive: false })
    .where(eq(permissions.code, "SUPER_ADMIN"));
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
        writeAccessScope: sql`excluded.write_access_scope`,
        writePermissionId: sql`excluded.write_permission_id`,
      },
    });
  console.log(`Upserted ${BOARD_SEEDS.length} board(s)`);
}

async function seedInitialAdminRole() {
  const [roleGroup] = await db
    .insert(roleGroups)
    .values({
      description: "초기 운영 관리자에게 부여되는 시스템 역할",
      isSystem: true,
      nameKo: INITIAL_ADMIN_ROLE_GROUP_NAME,
    })
    .onConflictDoUpdate({
      target: roleGroups.nameKo,
      set: {
        description: "초기 운영 관리자에게 부여되는 시스템 역할",
        isSystem: true,
        updatedAt: sql`now()`,
      },
    })
    .returning({ roleGroupId: roleGroups.roleGroupId });

  if (!roleGroup) {
    throw new Error("Failed to upsert the initial administrator role group");
  }

  await db
    .delete(roleGroupPermissions)
    .where(eq(roleGroupPermissions.roleGroupId, roleGroup.roleGroupId));

  const permissionRows = await db
    .select({ permissionId: permissions.permissionId })
    .from(permissions)
    .where(eq(permissions.isActive, true));

  if (permissionRows.length === 0) {
    throw new Error("No active permissions found for initial administrator role");
  }

  await db.insert(roleGroupPermissions).values(
    permissionRows.map((permission) => ({
      permissionId: permission.permissionId,
      roleGroupId: roleGroup.roleGroupId,
    })),
  );

  console.log(
    `Upserted the initial administrator system role with ${permissionRows.length} explicit permission(s)`,
  );
}

async function upsertDemoAccount() {
  const now = new Date();
  const [demoAccount] = await db
    .insert(users)
    .values({
      academicStatus: null,
      departmentEn: "School of Computing",
      departmentKo: "전산학부",
      email: DEMO_ACCOUNT_EMAIL,
      identityCode: "S",
      isActive: true,
      kaistUid: DEMO_ACCOUNT_KAIST_UID,
      lastLoginAt: now,
      nameEn: "SoC Student Council Demo",
      nameKo: "전산학부 집행위원회 데모",
      primaryMajor: "전산학부",
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
        primaryMajor: sql`excluded.primary_major`,
        privacyConsentAt: sql`excluded.privacy_consent_at`,
        stdNo: sql`excluded.std_no`,
        updatedAt: sql`now()`,
      },
    })
    .returning({ userId: users.userId });

  if (!demoAccount) {
    throw new Error("Failed to upsert demo account");
  }

  return demoAccount;
}

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
  validationType?: "regex";
  validationErrorMessage?: string;
  rows?: QuestionOptionSeed[];
  columns?: QuestionOptionSeed[];
  ratingMax?: number;
  ratingIcon?: "star" | "heart" | "thumbs_up";
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
    | "rating";
  options?: QuestionOptionSeed[];
  config?: QuestionConfigSeed;
  answerRegex?: string;
  isRequired?: boolean;
  sortOrder: number;
};

type SurveySeed = {
  kind: "SURVEY";
  titleKo: string;
  titleEn: string;
  descriptionKo: string;
  descriptionEn: string;
  feeRequirementPolicy: "NONE" | "PAID_ONLY";
  allowMultipleResponses: boolean;
  allowResponseEdit: boolean;
  resultVisibility: "PUBLIC" | "PRIVATE";
  maxResponseCount?: number;
  allowAnonymous?: boolean;
  isKoreanOnly?: boolean;
  showOnList?: boolean;
  showOnCalendar?: boolean;
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

type OperationalSurveySeed = {
  surveyId: string;
  sectionId: string;
  sectionTitleKo: string;
  sectionTitleEn: string;
  kind: "SURVEY";
  titleKo: string;
  titleEn: string;
  descriptionKo: string;
  descriptionEn: string;
  eligibleSocAffiliations: Array<"PRIMARY">;
  academicEligibility: "ANY" | "ENROLLED_ONLY" | "ENROLLED_OR_LEAVE";
  allowAnonymous: boolean;
  allowMultipleResponses: boolean;
  questions: Array<QuestionSeed & { id: string }>;
};

const OPERATIONAL_SURVEY_SEEDS: OperationalSurveySeed[] = [
  {
    surveyId: OPERATIONAL_SURVEY_IDS.cohortChatInvitation,
    sectionId: "7a120000-0000-4000-8000-000000000001",
    sectionTitleKo: "신청 정보",
    sectionTitleEn: "Application details",
    kind: "SURVEY",
    titleKo: "전산학부 학번톡 초대 요청",
    titleEn: "SoC Cohort Chat Invitation Request",
    descriptionKo: "전산학부 주전공·복수전공·부전공 학생 중 학번별 카카오톡 대화방에 초대되지 않은 학생을 위한 신청서입니다. 매주 월요일에 신청을 취합하여 초대합니다.",
    descriptionEn: "For School of Computing major, double-major, and minor students who have not joined their cohort KakaoTalk chat. Requests are collected every Monday.",
    eligibleSocAffiliations: [],
    academicEligibility: "ENROLLED_OR_LEAVE",
    allowAnonymous: false,
    allowMultipleResponses: false,
    questions: [
      {
        "id": "7a130000-0000-4000-8000-000000000101",
        "titleKo": "이메일",
        "titleEn": "Email",
        "answerRegex": "^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$",
        "config": { "validationType": "regex", "validationErrorMessage": "올바른 이메일 주소를 입력해 주세요. (예: name@example.com)" },
        "questionType": "short_text",
        "sortOrder": 0
      },
      {
        "id": "7a130000-0000-4000-8000-000000000102",
        "titleKo": "이름을 적어주세요.",
        "titleEn": "Please write down your name.",
        "questionType": "short_text",
        "sortOrder": 1
      },
      {
        "id": "7a130000-0000-4000-8000-000000000103",
        "titleKo": "학번을 적어주세요.",
        "titleEn": "Please write down your student number.",
        "questionType": "short_text",
        "descriptionKo": "예: 20241234",
        "descriptionEn": "Example: 20241234",
        "sortOrder": 2
      },
      {
        "id": "7a130000-0000-4000-8000-000000000104",
        "titleKo": "자신의 전산학부 전공 유형을 선택해주세요.",
        "titleEn": "Please choose your type of major in School of Computing",
        "questionType": "single_choice",
        "options": [
          {
            "value": "primary",
            "labelKo": "주전공",
            "labelEn": "Major"
          },
          {
            "value": "double",
            "labelKo": "복수전공",
            "labelEn": "Double major"
          },
          {
            "value": "minor",
            "labelKo": "부전공",
            "labelEn": "Minor"
          }
        ],
        "sortOrder": 3
      },
      {
        "id": "7a130000-0000-4000-8000-000000000105",
        "titleKo": "전화번호를 적어주세요.",
        "titleEn": "Please write down your telephone number.",
        "questionType": "short_text",
        "descriptionKo": "예: 010-1234-5678",
        "descriptionEn": "Example: 010-1234-5678",
        "sortOrder": 4
      },
    ],
  },
  {
    surveyId: OPERATIONAL_SURVEY_IDS.promotionPostRequest,
    sectionId: "7a120000-0000-4000-8000-000000000002",
    sectionTitleKo: "신청 정보",
    sectionTitleEn: "Application details",
    kind: "SURVEY",
    titleKo: "학부 내 행사·동아리 홍보글 게시 요청",
    titleEn: "SoC Event or Club Promotion Post Request",
    descriptionKo: "전산학부 구성원을 대상으로 하는 행사·동아리 홍보글 게시를 요청합니다.",
    descriptionEn: "Request publication of an event or club announcement for the School of Computing community.",
    eligibleSocAffiliations: ["PRIMARY"],
    academicEligibility: "ENROLLED_OR_LEAVE",
    allowAnonymous: false,
    allowMultipleResponses: true,
    questions: [
      {
        id: "7a130000-0000-4000-8000-000000000011",
        titleKo: "단체 또는 행사명",
        titleEn: "Organization or event name",
        questionType: "short_text",
        sortOrder: 0,
      },
      {
        id: "7a130000-0000-4000-8000-000000000012",
        titleKo: "담당자 연락처",
        titleEn: "Contact information",
        questionType: "short_text",
        sortOrder: 1,
      },
      {
        id: "7a130000-0000-4000-8000-000000000013",
        titleKo: "게시를 원하는 내용",
        titleEn: "Requested post content",
        questionType: "long_text",
        sortOrder: 2,
      },
      {
        id: "7a130000-0000-4000-8000-000000000014",
        titleKo: "게시 희망일",
        titleEn: "Preferred publication date",
        questionType: "date",
        sortOrder: 3,
      },
      {
        id: "7a130000-0000-4000-8000-000000000015",
        titleKo: "포스터와 참고 자료",
        titleEn: "Poster and supporting files",
        questionType: "file_upload",
        config: {
          maxFiles: 5,
          maxSizeBytes: 20_000_000,
          allowedMimeTypes: ["application/pdf", "image/png", "image/jpeg", "image/webp"],
        },
        isRequired: false,
        sortOrder: 4,
      },
    ],
  },

  {
    surveyId: OPERATIONAL_SURVEY_IDS.externalPromotionPostRequest,
    sectionId: "7a120000-0000-4000-8000-000000000004",
    sectionTitleKo: "홍보 신청 정보",
    sectionTitleEn: "Promotion request details",
    kind: "SURVEY",
    titleKo: "2026학년도 전산학부 채팅방 홍보 요청 양식",
    titleEn: "2026 SoC Chat room promotion request form",
    descriptionKo: `[2026학년도 전산학부 채팅방 홍보 요청 안내] [Guide for SoC Chat room promotion request in 2026] (Only for Korean Speakers)(Not Translated)

안녕하세요, KAIST 전산학부 집행위원회입니다.
집행위원회에서는 전산학부 학생들에게 이익이 될 수 있는 학과 외부의 정보를 공유하기 위해, 외부 홍보 글 게시 요청을 받고 있습니다. KAIST 전산학부 학생들을 대상으로 홍보를 원하는 내용이 있으신 경우, 아래의 안내를 따라주시기를 바랍니다.

1️⃣ 게시 대상 및 방법
- 전산학부 게시판 (https://c11.kr/kaistsoc)에 게시
- 매주 월요일에 학번별 채팅방에 홍보 글 목록 게시 (더 빠른 홍보를 원할 경우 아래 메일을 통해 문의 바랍니다.)
- 2026학년도에 접수된 홍보 글은 20~25학번 채팅방에 공지될 예정입니다.

2️⃣ 승인 절차
- 이 페이지 아래의 홍보 요청 양식을 작성한 뒤 ‘제출’을 눌러 주세요.
- 문서 하단의 '4. 승인 기준'에 따라 검토 후 승인되는 경우, 전산학부 게시판에 업로드 이후 매주 월요일에 학번별 채팅방에 게시됩니다.
- 문서의 보완이 필요하거나 채팅방 성격에 맞지 않는 공지인 경우, 기재해주신 연락처로 연락드릴 예정입니다.

3️⃣ 문의처
- 전산학부 학생회장 변희승: 010-3543-6050
- 전산학부 집행위원회 공식 메일: kaist.helloworld@gmail.com

4️⃣ 승인 기준
1. 전산학부 학생들에게 이익이 되는 내용이어야 합니다.
2. 형평성에 어긋나는 내용이 없어야 합니다. (예시: 설명회의 여러 부스 중 특정 부스만 따로 홍보하는 경우)
3. 아래의 내용을 포함해야 합니다.
[공통]
- 홍보를 요청하는 회사/개인에 대한 간단한 설명
- 실제 연락이 가능한 회사/담당자 이메일 또는 전화번호 등
[채용 공고/인원 모집의 경우]
- 스타트업의 경우 회사 이름, 사업 아이템 소개, 비전 등
- 모집 기간, 포지션, 각 포지션에 대한 설명, 인원, 대우 등 (첨부된 링크에 포함된 경우에도 인정)
[행사/대회/설명회의 경우]
- 행사/대회에 대한 소개, 날짜 또는 기간 등
- 사전 신청이 필요한 경우 사전 신청 기간, 방법, 참고 링크 등`,
    descriptionEn: `[Guide for SoC Chat room promotion request in 2026] (Only for Korean Speakers)(Not Translated)

This form is for requesting promotion of external events, recruitment, research opportunities, and other information for School of Computing students. Please follow the Korean guide above when submitting a request.`,
    eligibleSocAffiliations: [],
    academicEligibility: "ANY",
    allowAnonymous: true,
    allowMultipleResponses: true,
    questions: [
      {
        "id": "7a130000-0000-4000-8000-000000000034",
        "titleKo": "이메일",
        "titleEn": "Email",
        "answerRegex": "^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$",
        "config": { "validationType": "regex", "validationErrorMessage": "올바른 이메일 주소를 입력해 주세요. (예: name@example.com)" },
        "questionType": "short_text",
        "sortOrder": 0
      },
      {
        "id": "7a130000-0000-4000-8000-000000000032",
        "titleKo": "홍보를 요청하는 회사/단체/개인의 이름을 입력해 주세요.",
        "titleEn": "Name of the company, organization, research lab, or individual",
        "questionType": "short_text",
        "sortOrder": 1
      },
      {
        "id": "7a130000-0000-4000-8000-000000000039",
        "titleKo": "연락처를 입력해 주세요.",
        "titleEn": "Contact information",
        "questionType": "short_text",
        "sortOrder": 2
      },
      {
        "id": "7a130000-0000-4000-8000-000000000031",
        "titleKo": "홍보 내용에 가장 가까운 분류를 선택해 주세요.",
        "titleEn": "Promotion category",
        "questionType": "dropdown",
        "options": [
          {
            "value": "course",
            "labelKo": "수강",
            "labelEn": "Course"
          },
          {
            "value": "competition",
            "labelKo": "대회",
            "labelEn": "Competition"
          },
          {
            "value": "work",
            "labelKo": "근로",
            "labelEn": "Work"
          },
          {
            "value": "recruitment",
            "labelKo": "채용",
            "labelEn": "Recruitment"
          },
          {
            "value": "event",
            "labelKo": "행사",
            "labelEn": "Event"
          },
          {
            "value": "lab",
            "labelKo": "연구실",
            "labelEn": "Research lab"
          },
          {
            "value": "other",
            "labelKo": "기타",
            "labelEn": "Other"
          }
        ],
        "sortOrder": 3
      },
      {
        "id": "7a130000-0000-4000-8000-000000000040",
        "titleKo": "홍보를 요청할 글의 제목을 입력해 주세요.",
        "titleEn": "Title of the requested promotion post",
        "questionType": "short_text",
        "sortOrder": 4
      },
      {
        "id": "7a130000-0000-4000-8000-000000000035",
        "titleKo": "홍보를 요청할 글을 입력해 주세요.",
        "titleEn": "Requested promotion post",
        "questionType": "long_text",
        "sortOrder": 5
      },
      {
        "id": "7a130000-0000-4000-8000-000000000041",
        "titleKo": "글과 함께 첨부할 사진 등의 자료가 있다면 업로드해 주세요.",
        "titleEn": "Upload any images or supporting materials.",
        "questionType": "file_upload",
        "isRequired": false,
        "config": {
          "maxFiles": 10,
          "maxSizeBytes": 10000000,
          "allowedMimeTypes": [
            "application/pdf",
            "image/png",
            "image/jpeg",
            "image/webp",
            "image/gif",
            "audio/mpeg",
            "audio/wav",
            "video/mp4",
            "video/webm"
          ]
        },
        "sortOrder": 6
      },
      {
        "id": "7a130000-0000-4000-8000-000000000036",
        "titleKo": "홍보를 시작할 날짜를 입력해 주세요.",
        "titleEn": "Promotion start date",
        "questionType": "date",
        "descriptionKo": "게시판 업로드 기준입니다. 채팅방 업로드는 1주간 게시판에 업로드된 글에 대해 매주 월요일에 실시됩니다.",
        "descriptionEn": "The date refers to publication on the board. Posts uploaded during the week are shared in cohort chats every Monday.",
        "sortOrder": 7
      },
      {
        "id": "7a130000-0000-4000-8000-000000000038",
        "titleKo": "홍보를 끝낼 날짜를 입력해 주세요.",
        "titleEn": "Promotion end date",
        "questionType": "date",
        "sortOrder": 8
      },
      {
        "id": "7a130000-0000-4000-8000-000000000037",
        "titleKo": "포스터와 참고 자료 링크",
        "titleEn": "Poster and supporting material links",
        "questionType": "long_text",
        "descriptionKo": "로그인 없이 자료를 전달하려면 담당자가 열람할 수 있는 공유 링크를 입력해 주세요.",
        "descriptionEn": "To provide materials without signing in, enter a shared link that staff can access.",
        "isRequired": false,
        "sortOrder": 9
      }
    ],
  },
];

type ArticleAssetSeed = {
  filename: string;
  content: string | Buffer;
  originalFilename: string;
  mimeType: string;
  usageType: "IMAGE" | "ATTACHMENT" | "THUMBNAIL";
  sortOrder: number;
};

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
    kind: "SURVEY",
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
    openAt: demoDate(-7),
    closeAt: demoDate(30, 23, 59),
    sections: [
      {
        titleKo: "기본 입력",
        titleEn: "Basic inputs",
        descriptionKo: "텍스트, 날짜, 시간, 등급 입력 문항을 확인해 보세요.",
        descriptionEn: "Try the text, date, time, and rating input questions.",
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
            titleKo: "서비스 만족도를 평가해 주세요.",
            titleEn: "Rate your satisfaction with the service.",
            questionType: "rating",
            config: {
              ratingMax: 5,
              ratingIcon: "star",
            },
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
    where type in ('TOP_BANNER', 'QUICK_LINK', 'ORGANIZATION_CHART', 'PLEDGE')
      and created_by in (
        select user_id from users
        where kaist_uid in ('demo-author', 'DEV0001', 'seed-council-author', 'reference-faq')
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
      where kaist_uid in ('seed-notice-author', 'demo-author', 'DEV0001', 'seed-council-author')
    )
  `);

  await db.execute(sql`
    delete from article
    where author_user_id in (
      select user_id from users
      where kaist_uid in ('seed-notice-author', 'demo-author', 'DEV0001', 'seed-council-author')
    )
  `);

  await db.execute(sql`
    delete from vote_ballot
    where vote_id in (
      select vote_id from vote
      where creator_id in (
        select user_id from users
        where kaist_uid in ('demo-author', 'DEV0001', 'seed-council-author')
      )
    )
  `);

  await db.execute(sql`
    delete from vote_tally
    where vote_id in (
      select vote_id from vote
      where creator_id in (
        select user_id from users
        where kaist_uid in ('demo-author', 'DEV0001', 'seed-council-author')
      )
    )
  `);

  await db.execute(sql`
    delete from vote
    where creator_id in (
      select user_id from users
      where kaist_uid in ('demo-author', 'DEV0001', 'seed-council-author')
    )
  `);

  await db.execute(sql`
    delete from asset
    where storage_key like '/uploads/assets/seed-%'
      and uploaded_by in (
        select user_id from users
        where kaist_uid in ('seed-notice-author', 'demo-author', 'DEV0001', 'seed-council-author')
      )
  `);

  await db.execute(sql`delete from users where kaist_uid = 'seed-notice-author'`);
}

async function prepareLegacyDemoAccounts() {
  const legacyUidSql = sql.join(
    LEGACY_DEMO_ACCOUNT_KAIST_UIDS.map((uid) => sql`${uid}`),
    sql`, `,
  );

  // The old development account used the same student number as the new
  // canonical account. Free it before the canonical upsert so the unique
  // users.std_no constraint does not prevent the migration.
  await db.execute(sql`
    update users
    set std_no = null
    where kaist_uid in (${legacyUidSql})
      and std_no = '20260001'
  `);
}

async function mergeLegacyDemoAccounts(demoUserId: string) {
  const legacyAccounts = await db
    .select({ userId: users.userId })
    .from(users)
    .where(inArray(users.kaistUid, [...LEGACY_DEMO_ACCOUNT_KAIST_UIDS]));
  if (legacyAccounts.length === 0) return;

  const legacyUserIdsSql = sql.join(
    legacyAccounts.map((account) => sql`${account.userId}`),
    sql`, `,
  );

  await db.transaction(async (tx) => {
    // Keep the canonical account as the owner of any historical records left
    // by the two legacy demo identities. Seed-owned posts, surveys, votes,
    // and assets have already been removed by cleanupSeedContent; these
    // updates cover login/audit metadata and any manually exercised demo
    // paths without leaving foreign-key or orphaned-user rows behind.
    await tx.execute(sql`
      update user_role_group
      set user_id = ${demoUserId}
      where user_id in (${legacyUserIdsSql})
    `);
    await tx.execute(sql`
      update user_role_group
      set granted_by = ${demoUserId}
      where granted_by in (${legacyUserIdsSql})
    `);
    await tx.execute(sql`
      update user_sanction
      set user_id = ${demoUserId}
      where user_id in (${legacyUserIdsSql})
    `);
    await tx.execute(sql`
      update user_sanction
      set issued_by = ${demoUserId}
      where issued_by in (${legacyUserIdsSql})
    `);
    await tx.execute(sql`
      update user_sanction
      set revoked_by = ${demoUserId}
      where revoked_by in (${legacyUserIdsSql})
    `);
    await tx.execute(sql`
      delete from student_fee_status legacy
      using users legacy_user
      where legacy.user_id = legacy_user.user_id
        and legacy_user.kaist_uid in (${sql.join(
          LEGACY_DEMO_ACCOUNT_KAIST_UIDS.map((uid) => sql`${uid}`),
          sql`, `,
        )})
        and exists (
          select 1 from student_fee_status canonical
          where canonical.user_id = ${demoUserId}
        )
    `);
    await tx.execute(sql`
      update student_fee_status
      set user_id = ${demoUserId}
      where user_id in (${legacyUserIdsSql})
    `);
    await tx.execute(sql`
      update student_fee_status
      set verified_by = ${demoUserId}
      where verified_by in (${legacyUserIdsSql})
    `);
    await tx.execute(sql`
      update student_fee_payment
      set user_id = ${demoUserId}
      where user_id in (${legacyUserIdsSql})
    `);
    await tx.execute(sql`
      update student_fee_payment
      set recorded_by = ${demoUserId}
      where recorded_by in (${legacyUserIdsSql})
    `);
    await tx.execute(sql`
      delete from student_fee_payment_batch legacy
      using users legacy_user
      where legacy.actor_user_id = legacy_user.user_id
        and legacy_user.kaist_uid in (${sql.join(
          LEGACY_DEMO_ACCOUNT_KAIST_UIDS.map((uid) => sql`${uid}`),
          sql`, `,
        )})
        and exists (
          select 1 from student_fee_payment_batch canonical
          where canonical.actor_user_id = ${demoUserId}
            and canonical.idempotency_key = legacy.idempotency_key
        )
    `);
    await tx.execute(sql`
      update student_fee_payment_batch
      set actor_user_id = ${demoUserId}
      where actor_user_id in (${legacyUserIdsSql})
    `);
    await tx.execute(sql`
      update article_draft
      set owner_user_id = ${demoUserId}
      where owner_user_id in (${legacyUserIdsSql})
    `);
    await tx.execute(sql`
      delete from article_view legacy
      using article_view canonical
      where legacy.user_id in (${legacyUserIdsSql})
        and canonical.article_id = legacy.article_id
        and canonical.user_id = ${demoUserId}
    `);
    await tx.execute(sql`
      update article_view
      set user_id = ${demoUserId}
      where user_id in (${legacyUserIdsSql})
    `);
    await tx.execute(sql`
      delete from article_engagement legacy
      using article_engagement canonical
      where legacy.user_id in (${legacyUserIdsSql})
        and canonical.article_id = legacy.article_id
        and canonical.kind = legacy.kind
        and canonical.user_id = ${demoUserId}
    `);
    await tx.execute(sql`
      update article_engagement
      set user_id = ${demoUserId}
      where user_id in (${legacyUserIdsSql})
    `);
    await tx.execute(sql`
      update article
      set author_user_id = ${demoUserId}
      where author_user_id in (${legacyUserIdsSql})
    `);
    await tx.execute(sql`
      update article
      set hidden_by_user_id = ${demoUserId}
      where hidden_by_user_id in (${legacyUserIdsSql})
    `);
    await tx.execute(sql`
      update asset
      set uploaded_by = ${demoUserId}
      where uploaded_by in (${legacyUserIdsSql})
    `);
    await tx.execute(sql`
      update comment
      set author_user_id = ${demoUserId}
      where author_user_id in (${legacyUserIdsSql})
    `);
    await tx.execute(sql`
      update comment
      set hidden_by_user_id = ${demoUserId}
      where hidden_by_user_id in (${legacyUserIdsSql})
    `);
    await tx.execute(sql`
      delete from comment_engagement legacy
      using comment_engagement canonical
      where legacy.user_id in (${legacyUserIdsSql})
        and canonical.comment_id = legacy.comment_id
        and canonical.kind = legacy.kind
        and canonical.user_id = ${demoUserId}
    `);
    await tx.execute(sql`
      update comment_engagement
      set user_id = ${demoUserId}
      where user_id in (${legacyUserIdsSql})
    `);
    await tx.execute(sql`
      delete from survey_responses legacy
      using survey_responses canonical
      where legacy.single_response_user_id in (${legacyUserIdsSql})
        and canonical.survey_id = legacy.survey_id
        and canonical.single_response_user_id = ${demoUserId}
    `);
    await tx.execute(sql`
      update survey_responses
      set user_id = ${demoUserId}
      where user_id in (${legacyUserIdsSql})
    `);
    await tx.execute(sql`
      update survey_responses
      set single_response_user_id = ${demoUserId}
      where single_response_user_id in (${legacyUserIdsSql})
    `);
    await tx.execute(sql`
      update survey
      set creator_id = ${demoUserId}
      where creator_id in (${legacyUserIdsSql})
    `);
    await tx.execute(sql`
      update audit_log
      set actor_user_id = ${demoUserId}
      where actor_user_id in (${legacyUserIdsSql})
    `);
    await tx.execute(sql`
      update bulk_email_template
      set created_by = ${demoUserId}
      where created_by in (${legacyUserIdsSql})
    `);
    await tx.execute(sql`
      delete from bulk_email legacy
      using bulk_email canonical
      where legacy.sender_id in (${legacyUserIdsSql})
        and legacy.idempotency_key is not null
        and canonical.sender_id = ${demoUserId}
        and canonical.idempotency_key = legacy.idempotency_key
    `);
    await tx.execute(sql`
      update bulk_email
      set sender_id = ${demoUserId}
      where sender_id in (${legacyUserIdsSql})
    `);
    await tx.execute(sql`
      update content_block
      set created_by = ${demoUserId}
      where created_by in (${legacyUserIdsSql})
    `);
    await tx.execute(sql`
      update content_block
      set updated_by = ${demoUserId}
      where updated_by in (${legacyUserIdsSql})
    `);
    await tx.execute(sql`
      update content_block
      set published_by = ${demoUserId}
      where published_by in (${legacyUserIdsSql})
    `);
    await tx.execute(sql`
      update site_content
      set updated_by = ${demoUserId}
      where updated_by in (${legacyUserIdsSql})
    `);
    await tx.execute(sql`
      update calendar_event
      set override_updated_by_user_id = ${demoUserId}
      where override_updated_by_user_id in (${legacyUserIdsSql})
    `);
    await tx.execute(sql`
      update calendar_event
      set created_by_user_id = ${demoUserId}
      where created_by_user_id in (${legacyUserIdsSql})
    `);
    await tx.execute(sql`
      update notification
      set user_id = ${demoUserId}
      where user_id in (${legacyUserIdsSql})
    `);
    await tx.execute(sql`
      update notification
      set actor_user_id = ${demoUserId}
      where actor_user_id in (${legacyUserIdsSql})
    `);
    await tx.execute(sql`
      delete from vote_voter legacy
      using vote_voter canonical
      where legacy.user_id in (${legacyUserIdsSql})
        and canonical.vote_id = legacy.vote_id
        and canonical.user_id = ${demoUserId}
    `);
    await tx.execute(sql`
      update vote_voter
      set user_id = ${demoUserId}
      where user_id in (${legacyUserIdsSql})
    `);
    await tx.execute(sql`
      update vote
      set creator_id = ${demoUserId}
      where creator_id in (${legacyUserIdsSql})
    `);
    await tx.execute(sql`
      update roadmap_offering
      set imported_by = ${demoUserId}
      where imported_by in (${legacyUserIdsSql})
    `);
    await tx.execute(sql`
      update roadmap_term
      set imported_by = ${demoUserId}
      where imported_by in (${legacyUserIdsSql})
    `);
    await tx.execute(sql`
      update student_fee_policy
      set created_by = ${demoUserId}
      where created_by in (${legacyUserIdsSql})
    `);
    await tx.execute(sql`
      update asset_upload_reservation
      set uploaded_by = ${demoUserId}
      where uploaded_by in (${legacyUserIdsSql})
    `);
    await tx.execute(sql`
      update executive_contact
      set portal_user_id = ${demoUserId}
      where portal_user_id in (${legacyUserIdsSql})
    `);
    await tx.execute(sql`
      delete from survey_response_subscription legacy
      using survey_response_subscription canonical
      where legacy.user_id in (${legacyUserIdsSql})
        and canonical.survey_id = legacy.survey_id
        and canonical.user_id = ${demoUserId}
    `);
    await tx.execute(sql`
      update survey_response_subscription
      set user_id = ${demoUserId}
      where user_id in (${legacyUserIdsSql})
    `);
    await tx.execute(sql`
      delete from users
      where user_id in (${legacyUserIdsSql})
    `);
  });

  console.log(
    `Merged ${legacyAccounts.length} legacy demo account(s) into ${DEMO_ACCOUNT_KAIST_UID}`,
  );
}

async function seedReferenceFaqs() {
  const [faqBoard] = await db
    .select({ boardId: boards.boardId })
    .from(boards)
    .where(eq(boards.code, "faq"))
    .limit(1);
  if (!faqBoard) {
    throw new Error("FAQ board is missing while seeding reference FAQs");
  }

  const [referenceAuthor] = await db
    .insert(users)
    .values({
      kaistUid: "reference-faq",
      nameKo: "전산학부 집행위원회",
      nameEn: "SoC Student Council",
      email: "reference-faq@invalid.local",
      departmentKo: "전산학부",
      departmentEn: "School of Computing",
      academicStatus: null,
      identityCode: "O",
      isActive: false,
    })
    .onConflictDoUpdate({
      target: users.kaistUid,
      set: {
        nameKo: sql`excluded.name_ko`,
        nameEn: sql`excluded.name_en`,
        departmentKo: sql`excluded.dept_ko`,
        departmentEn: sql`excluded.dept_en`,
        academicStatus: sql`excluded.academic_status`,
        identityCode: sql`excluded.identity_code`,
        isActive: false,
        updatedAt: sql`now()`,
      },
    })
    .returning({ userId: users.userId });
  if (!referenceAuthor) {
    throw new Error("Failed to upsert the reference FAQ author");
  }

  const retiredReferenceFaqs = await db
    .select({ articleId: articles.articleId })
    .from(articles)
    .where(
      and(
        eq(articles.boardId, faqBoard.boardId),
        eq(articles.authorUserId, referenceAuthor.userId),
        inArray(articles.titleKo, [...RETIRED_REFERENCE_FAQ_TITLES]),
      ),
    );
  if (retiredReferenceFaqs.length > 0) {
    await db.delete(articles).where(
      inArray(
        articles.articleId,
        retiredReferenceFaqs.map((item) => item.articleId),
      ),
    );
    console.log(`Removed ${retiredReferenceFaqs.length} retired reference FAQ article(s)`);
  }

  const legacyFaqs = await db
    .select({ articleId: articles.articleId, titleKo: articles.titleKo })
    .from(articles)
    .where(
      and(
        eq(articles.boardId, faqBoard.boardId),
        inArray(articles.titleKo, [...LEGACY_DEMO_FAQ_TITLES]),
      ),
    );
  if (legacyFaqs.length > 0) {
    await db.delete(articles).where(
      inArray(
        articles.articleId,
        legacyFaqs.map((item) => item.articleId),
      ),
    );
    console.log(`Removed ${legacyFaqs.length} legacy FAQ article(s)`);
  }

  const existingFaqs = await db
    .select({
      articleId: articles.articleId,
      authorUserId: articles.authorUserId,
      contentKo: articles.contentKo,
      homeOrder: articles.homeOrder,
      status: articles.status,
      titleKo: articles.titleKo,
    })
    .from(articles)
    .where(
      and(
        eq(articles.boardId, faqBoard.boardId),
        ne(articles.status, "DELETED"),
      ),
    );
  const existingHomeOrders = new Set(
    existingFaqs
      .map((item) => item.homeOrder)
      .filter((item): item is number => item !== null),
  );
  const existingTitles = new Set(existingFaqs.map((item) => item.titleKo));
  const orderedReferenceFaqs = [...REFERENCE_FAQ_SEEDS].sort(
    (left, right) =>
      (FAQ_DISPLAY_ORDER.get(left.titleKo) ?? Number.MAX_SAFE_INTEGER) -
      (FAQ_DISPLAY_ORDER.get(right.titleKo) ?? Number.MAX_SAFE_INTEGER),
  );

  const referenceFaqsToNormalize = existingFaqs.filter((item) =>
    item.authorUserId === referenceAuthor.userId &&
    (item.homeOrder === null ||
      (item.homeOrder >= LEGACY_REFERENCE_FAQ_HOME_ORDER_BASE &&
        item.homeOrder < REFERENCE_FAQ_HOME_ORDER_BASE) ||
      LEGACY_REFERENCE_FAQ_CONTENT.get(item.titleKo) === item.contentKo ||
      PREVIOUS_REFERENCE_FAQ_CONTENT.get(item.titleKo) === item.contentKo),
  );
  const legacyReferenceByTitle = new Map(
    referenceFaqsToNormalize.map((item) => [item.titleKo, item]),
  );
  for (const [index, item] of orderedReferenceFaqs.entries()) {
    const existing = legacyReferenceByTitle.get(item.titleKo);
    if (!existing) continue;
    await db
      .update(articles)
      .set({
        contentEn: item.contentEn,
        contentKo: item.contentKo,
        homeOrder: REFERENCE_FAQ_HOME_ORDER_BASE + index,
        pinOrder: index,
        status: "PUBLISHED",
        titleEn: item.titleEn,
        updatedAt: new Date(),
        visibilityScope: "PUBLIC",
      })
      .where(eq(articles.articleId, existing.articleId));
  }

  const missingFaqs = orderedReferenceFaqs.flatMap((item, index) => {
    const homeOrder = REFERENCE_FAQ_HOME_ORDER_BASE + index;
    if (existingHomeOrders.has(homeOrder) || existingTitles.has(item.titleKo)) {
      return [];
    }
    return [{ item, index, homeOrder }];
  });

  if (missingFaqs.length > 0) {
    await db.insert(articles).values(
      missingFaqs.map(({ item, index, homeOrder }) => ({
        boardId: faqBoard.boardId,
        authorUserId: referenceAuthor.userId,
        titleKo: item.titleKo,
        titleEn: item.titleEn,
        contentKo: item.contentKo,
        contentEn: item.contentEn,
        status: "PUBLISHED",
        visibilityScope: "PUBLIC",
        isPinned: false,
        pinOrder: index,
        homeVisible: false,
        homeOrder,
        isSecret: false,
        isAnonymous: false,
        allowComment: false,
        viewCount: 0,
        postedAt: new Date(
          `2026-08-29T${String(9 + Math.floor(index / 60)).padStart(2, "0")}:${String(index % 60).padStart(2, "0")}:00+09:00`,
        ),
      })),
    );
  }

  console.log(
    `Reference FAQs ready (${missingFaqs.length} inserted, ${REFERENCE_FAQ_SEEDS.length - missingFaqs.length} already present, ${referenceFaqsToNormalize.length} normalized)`,
  );
}

async function seedAboutPageContent(seedAuthorId: string) {
  const publishedAt = new Date("2026-03-02T09:00:00+09:00");

  await db.insert(contentBlocks).values([
    {
      type: "QUICK_LINK",
      status: "PUBLISHED",
      titleKo: "KLMS",
      titleEn: "KLMS",
      bodyKo: "KAIST 학습관리시스템에서 강의와 과제를 확인하세요.",
      bodyEn: "Access courses and assignments on the KAIST learning management system.",
      linkUrl: "https://klms.kaist.ac.kr/",
      sortOrder: 0,
      createdBy: seedAuthorId,
      updatedBy: seedAuthorId,
      publishedBy: seedAuthorId,
      publishedAt,
    },
    {
      type: "ORGANIZATION_CHART",
      status: "PUBLISHED",
      titleKo: "전산학부 집행위원회 조직도",
      titleEn: "SoC Student Council Organization Chart",
      imageUrl: "/organization-chart.png",
      sortOrder: 0,
      createdBy: seedAuthorId,
      updatedBy: seedAuthorId,
      publishedBy: seedAuthorId,
      publishedAt,
    },
    ...REFERENCE_PLEDGE_SEEDS.map((seed, sortOrder) => ({
      type: "PLEDGE" as const,
      status: "PUBLISHED" as const,
      titleKo: seed.titleKo,
      titleEn: seed.titleEn,
      bodyKo: seed.bodyKo,
      bodyEn: seed.bodyEn,
      pledgeStatus: seed.pledgeStatus,
      sortOrder,
      createdBy: seedAuthorId,
      updatedBy: seedAuthorId,
      publishedBy: seedAuthorId,
      publishedAt,
    })),
  ]).onConflictDoNothing();

  await db
    .insert(executiveContactDepartments)
    .values([
      {
        nameKo: "회장단",
        nameEn: "Presidium",
        descriptionKo: "집행위원회 총괄 및 학생회 주요 정책 결정, 학과 및 총학생회 협의 총괄",
        descriptionEn: "Oversee the executive committee, set major council policies, and lead coordination with the department and university student council.",
        inquiryEmail: "kaist.helloworld@gmail.com",
        sortOrder: 0,
        isActive: true,
      },
      {
        nameKo: "비서실",
        nameEn: "Secretariat",
        descriptionKo: "정기 회의 운영, 학생회비 예·결산 및 회계 관리, 공식 회의록 아카이빙",
        descriptionEn: "Run regular meetings, manage the council budget and accounts, and archive official minutes.",
        inquiryEmail: "kaist.helloworld@gmail.com",
        sortOrder: 1,
        isActive: true,
      },
      {
        nameKo: "대외소통부",
        nameEn: "External Communications",
        descriptionKo: "타 학과 및 외부 단체 교류 협력, 공식 SNS 및 공지 채널 통합 관리",
        descriptionEn: "Coordinate exchanges with other departments and external groups, and manage official social and notice channels.",
        inquiryEmail: "kaist.helloworld@gmail.com",
        sortOrder: 2,
        isActive: true,
      },
      {
        nameKo: "기획부",
        nameEn: "Planning Division",
        descriptionKo: "간식 행사, 문화 교류 이벤트, e-스포츠 대회 등 학부 행사 총괄 기획",
        descriptionEn: "Plan and lead department events such as snack programs, cultural exchanges, and e-sports tournaments.",
        inquiryEmail: "kaist.helloworld@gmail.com",
        sortOrder: 3,
        isActive: true,
      },
      {
        nameKo: "전산관리부",
        nameEn: "IT Administration",
        descriptionKo: "전산학부 학생회 공식 웹 포털 개발, 서비스 운영 및 서버 인프라 관리",
        descriptionEn: "Develop the official SoC Student Council web portal and manage its service and server infrastructure.",
        inquiryEmail: "kaist.helloworld@gmail.com",
        sortOrder: 4,
        isActive: true,
      },
    ])
    .onConflictDoUpdate({
      target: executiveContactDepartments.nameKo,
      set: {
        nameEn: sql`excluded.name_en`,
        descriptionKo: sql`excluded.description_ko`,
        descriptionEn: sql`excluded.description_en`,
        inquiryEmail: sql`excluded.inquiry_email`,
        isActive: true,
        updatedAt: new Date(),
      },
    });

  const referenceContacts = [
    {
      nameKo: "김성찬",
      nameEn: "Seongchan Kim",
      departmentKo: "회장단",
      departmentEn: "Presidium",
      roleKo: "회장",
      roleEn: "President",
      studentNumber: "20261234",
      cohort: 26,
      email: "president@cs.kaist.ac.kr",
      phoneNumber: null,
      privacyConsented: true,
      sortOrder: 0,
    },
    {
      nameKo: "이서윤",
      nameEn: "Seoyoon Lee",
      departmentKo: "비서실",
      departmentEn: "Secretariat",
      roleKo: "비서실장",
      roleEn: "Secretary General",
      studentNumber: "20251234",
      cohort: 25,
      email: "secretariat@cs.kaist.ac.kr",
      phoneNumber: null,
      privacyConsented: true,
      sortOrder: 1,
    },
    {
      nameKo: "박도현",
      nameEn: "Dohyun Park",
      departmentKo: "대외소통부",
      departmentEn: "External Communications",
      roleKo: "대외소통부장",
      roleEn: "External Communications Director",
      studentNumber: "20251235",
      cohort: 25,
      email: "external@cs.kaist.ac.kr",
      phoneNumber: null,
      privacyConsented: true,
      sortOrder: 2,
    },
    {
      nameKo: "최민아",
      nameEn: "Mina Choi",
      departmentKo: "기획부",
      departmentEn: "Planning Division",
      roleKo: "기획부장",
      roleEn: "Planning Director",
      studentNumber: "20261235",
      cohort: 26,
      email: "planning@cs.kaist.ac.kr",
      phoneNumber: null,
      privacyConsented: true,
      sortOrder: 3,
    },
  ];

  // Contacts are identified by the stable student number/email pair, not the
  // generated UUID. Keep the reference rows idempotent so running the seed in
  // local and production environments does not append another copy each time.
  for (const contact of referenceContacts) {
    const matches = await db
      .select({ id: executiveContacts.id })
      .from(executiveContacts)
      .where(or(
        eq(executiveContacts.studentNumber, contact.studentNumber),
        eq(executiveContacts.email, contact.email),
      ))
      .orderBy(asc(executiveContacts.createdAt), asc(executiveContacts.id));
    const [keeper, ...duplicates] = matches;

    if (!keeper) {
      await db.insert(executiveContacts).values(contact);
      continue;
    }

    await db.update(executiveContacts).set({ ...contact, updatedAt: new Date() }).where(eq(executiveContacts.id, keeper.id));
    if (duplicates.length > 0) {
      await db.delete(executiveContacts).where(inArray(executiveContacts.id, duplicates.map(({ id }) => id)));
    }
  }

  console.log("Seeded pledge progress and executive contacts");
}

async function seedReferenceAboutPageContent() {
  const [referenceAuthor] = await db
    .select({ userId: users.userId })
    .from(users)
    .where(eq(users.kaistUid, "reference-faq"))
    .limit(1);
  if (!referenceAuthor) {
    throw new Error("Reference content author is missing while seeding about content");
  }

  const [legacyDemoAuthor] = await db
    .select({ userId: users.userId })
    .from(users)
    .where(eq(users.kaistUid, "seed-council-author"))
    .limit(1);
  if (legacyDemoAuthor) {
    await db
      .delete(contentBlocks)
      .where(
        and(
          eq(contentBlocks.createdBy, legacyDemoAuthor.userId),
          inArray(contentBlocks.type, ["QUICK_LINK", "ORGANIZATION_CHART", "PLEDGE"]),
        ),
      );
  }

  const publishedAt = new Date("2026-03-02T09:00:00+09:00");
  const existingPledges = await db
    .select({
      contentBlockId: contentBlocks.contentBlockId,
      titleKo: contentBlocks.titleKo,
    })
    .from(contentBlocks)
    .where(
      and(
        eq(contentBlocks.type, "PLEDGE"),
        eq(contentBlocks.createdBy, referenceAuthor.userId),
      ),
    );
  const existingPledgesByTitle = new Map(
    existingPledges.map((item) => [item.titleKo, item.contentBlockId]),
  );

  for (const [sortOrder, seed] of REFERENCE_PLEDGE_SEEDS.entries()) {
    const values = {
      bodyEn: seed.bodyEn,
      bodyKo: seed.bodyKo,
      imageUrl: null,
      imageUrlEn: null,
      linkUrl: null,
      pledgeStatus: seed.pledgeStatus,
      publishedAt,
      publishedBy: referenceAuthor.userId,
      sortOrder,
      status: "PUBLISHED" as const,
      titleEn: seed.titleEn,
      titleKo: seed.titleKo,
      type: "PLEDGE" as const,
      updatedAt: new Date(),
      updatedBy: referenceAuthor.userId,
    };
    const contentBlockId = existingPledgesByTitle.get(seed.titleKo)
      ?? (seed.legacyTitleKo ? existingPledgesByTitle.get(seed.legacyTitleKo) : undefined);
    if (contentBlockId) {
      await db
        .update(contentBlocks)
        .set(values)
        .where(eq(contentBlocks.contentBlockId, contentBlockId));
    } else {
      await db.insert(contentBlocks).values({
        ...values,
        createdBy: referenceAuthor.userId,
      });
    }
  }

  const referencePledgeTitles = new Set(REFERENCE_PLEDGE_SEEDS.flatMap((item) => [item.titleKo, ...(item.legacyTitleKo ? [item.legacyTitleKo] : [])]));
  for (const existing of existingPledges) {
    if (referencePledgeTitles.has(existing.titleKo)) continue;
    await db
      .delete(contentBlocks)
      .where(eq(contentBlocks.contentBlockId, existing.contentBlockId));
  }

  const existingOrganizationCharts = await db
    .select({ contentBlockId: contentBlocks.contentBlockId })
    .from(contentBlocks)
    .where(
      and(
        eq(contentBlocks.type, "ORGANIZATION_CHART"),
        eq(contentBlocks.createdBy, referenceAuthor.userId),
      ),
    );
  const organizationValues = {
    bodyEn: null,
    bodyKo: null,
    imageUrl: "/organization-chart.png",
    imageUrlEn: null,
    linkUrl: null,
    pledgeStatus: null,
    publishedAt,
    publishedBy: referenceAuthor.userId,
    sortOrder: 0,
    status: "PUBLISHED" as const,
    titleEn: "SoC Student Council Organization Chart",
    titleKo: "전산학부 집행위원회 조직도",
    type: "ORGANIZATION_CHART" as const,
    updatedAt: new Date(),
    updatedBy: referenceAuthor.userId,
  };
  const [existingOrganizationChart, ...duplicateOrganizationCharts] = existingOrganizationCharts;
  if (existingOrganizationChart) {
    await db
      .update(contentBlocks)
      .set(organizationValues)
      .where(eq(contentBlocks.contentBlockId, existingOrganizationChart.contentBlockId));
    for (const duplicate of duplicateOrganizationCharts) {
      await db
        .delete(contentBlocks)
        .where(eq(contentBlocks.contentBlockId, duplicate.contentBlockId));
    }
  } else {
    await db.insert(contentBlocks).values({
      ...organizationValues,
      createdBy: referenceAuthor.userId,
    }).onConflictDoNothing();
  }

  console.log(
    `Reference about content ready (${REFERENCE_PLEDGE_SEEDS.length} pledges and organization chart)`,
  );
}

async function seedReferenceAboutWorkContent() {
  const [referenceAuthor] = await db
    .select({ userId: users.userId })
    .from(users)
    .where(eq(users.kaistUid, "reference-faq"))
    .limit(1);
  if (!referenceAuthor) {
    throw new Error("Reference content author is missing while seeding about work content");
  }

  const existing = await db
    .select({ key: siteContents.key, valueKo: siteContents.valueKo })
    .from(siteContents);
  const existingByKey = new Map(existing.map((item) => [item.key, item]));

  for (const seed of REFERENCE_ABOUT_WORK_CONTENT_SEEDS) {
    const current = existingByKey.get(seed.key);
    const legacyValues = Array.isArray(seed.legacyKo) ? seed.legacyKo : [seed.legacyKo];
    const isFormattedSlogan = seed.key === "about.hero.description" && current
      && current.valueKo.replace(/<[^>]*>/g, "").replace(/^[\s*_]+|[\s*_]+$/g, "") === seed.valueKo;
    if (current && !legacyValues.includes(current.valueKo) && !isFormattedSlogan) continue;

    await db
      .insert(siteContents)
      .values({
        key: seed.key,
        updatedBy: referenceAuthor.userId,
        valueEn: seed.valueEn,
        valueKo: seed.valueKo,
      })
      .onConflictDoUpdate({
        target: siteContents.key,
        set: {
          updatedAt: new Date(),
          updatedBy: referenceAuthor.userId,
          valueEn: seed.valueEn,
          valueKo: seed.valueKo,
        },
      });
  }

  console.log(`Reference about work content ready (${REFERENCE_ABOUT_WORK_CONTENT_SEEDS.length} entries)`);
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
        // The response endpoint advertises this value as Content-Length. The
        // generated seed file is the source of truth; a nominal size would
        // make otherwise valid SVG/PDF responses look truncated to browsers.
        sizeBytes: written.sizeBytes,
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
      allowAnonymous: seed.allowAnonymous ?? false,
      isKoreanOnly: seed.isKoreanOnly ?? false,
      showOnList: seed.showOnList ?? true,
      showOnCalendar: seed.showOnCalendar ?? true,
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

async function seedOperationalSurveys() {
  for (const seed of OPERATIONAL_SURVEY_SEEDS) {
    // Refresh only pristine reference forms. Never mix new questions into a
    // customized form or change the meaning of questions with saved responses.
    const [existing] = await db.select().from(surveys).where(eq(surveys.surveyId, seed.surveyId));
    if (existing) {
      const [response] = await db.select({ id: surveyResponses.id }).from(surveyResponses)
        .where(eq(surveyResponses.surveyId, seed.surveyId)).limit(1);
      const sections = await db.select().from(surveySections).where(eq(surveySections.surveyId, seed.surveyId));
      const questions = sections.length ? await db.select().from(surveyQuestions)
        .where(inArray(surveyQuestions.sectionId, sections.map(section => section.id))) : [];
      const unchanged = questions.length === seed.questions.length && seed.questions.every(definition => {
        const row = questions.find(question => question.id === definition.id);
        return row && row.titleKo === definition.titleKo && row.titleEn === definition.titleEn &&
          row.descriptionKo === (definition.descriptionKo ?? null) && row.descriptionEn === (definition.descriptionEn ?? null) &&
          row.questionType === definition.questionType && row.sortOrder === definition.sortOrder &&
          row.isRequired === (definition.isRequired ?? true) &&
          isDeepStrictEqual(row.options, definition.options ?? null) &&
          isDeepStrictEqual(row.config, definition.config ?? null) &&
          row.answerRegex === (definition.answerRegex ?? null);
      });
      if (unchanged && existing.showOnList && existing.descriptionKo === seed.descriptionKo && existing.descriptionEn === seed.descriptionEn &&
        JSON.stringify(existing.eligibleSocAffiliations) === JSON.stringify(seed.eligibleSocAffiliations)) continue;
      const pristine = existing.creatorId === null && !response &&
        existing.createdAt.getTime() === existing.updatedAt.getTime() &&
        sections.length === 1 && sections[0].id === seed.sectionId &&
        sections.every(row => row.createdAt.getTime() === row.updatedAt.getTime()) &&
        questions.every(row => row.createdAt.getTime() === row.updatedAt.getTime() && row.id.startsWith("7a130000-0000-4000-8000-"));
      if (!pristine) {
        console.log(`Preserved existing operational survey: ${seed.surveyId}`);
        continue;
      }
      await db.transaction(async tx => {
        // Prevent a submission from appearing between the check and replacement.
        await tx.execute(sql`LOCK TABLE survey_responses IN SHARE ROW EXCLUSIVE MODE`);
        const [latestResponse] = await tx.select({ id: surveyResponses.id }).from(surveyResponses)
          .where(eq(surveyResponses.surveyId, seed.surveyId)).limit(1);
        if (latestResponse) return;
        await tx.delete(surveyQuestions).where(eq(surveyQuestions.sectionId, seed.sectionId));
        await tx.update(surveys).set({
          titleKo: seed.titleKo, titleEn: seed.titleEn,
          showOnList: true,
          descriptionKo: seed.descriptionKo, descriptionEn: seed.descriptionEn,
          eligibleSocAffiliations: seed.eligibleSocAffiliations,
        }).where(eq(surveys.surveyId, seed.surveyId));
        await tx.insert(surveyQuestions).values(seed.questions.map(question => ({
          ...question, sectionId: seed.sectionId, isRequired: question.isRequired ?? true,
        })));
      });
      continue;
    }
    await db
      .insert(surveys)
      .values({
        surveyId: seed.surveyId,
        creatorId: null,
        kind: seed.kind,
        titleKo: seed.titleKo,
        titleEn: seed.titleEn,
        descriptionKo: seed.descriptionKo,
        descriptionEn: seed.descriptionEn,
        feeRequirementPolicy: "NONE",
        eligibleSocAffiliations: seed.eligibleSocAffiliations,
        academicEligibility: seed.academicEligibility,
        allowAnonymous: seed.allowAnonymous,
        allowMultipleResponses: seed.allowMultipleResponses,
        allowResponseEdit: true,
        isKoreanOnly: false,
        isPublished: true,
        lifecycleStatus: "PUBLISHED",
        showOnList: true,
        showOnCalendar: false,
        resultVisibility: "PRIVATE",
        isAlwaysOpen: true,
        openAt: null,
        closeAt: null,
      })
      .onConflictDoNothing({ target: surveys.surveyId });

    await db
      .insert(surveySections)
      .values({
        id: seed.sectionId,
        surveyId: seed.surveyId,
        titleKo: seed.sectionTitleKo,
        titleEn: seed.sectionTitleEn,
        sortOrder: 0,
      })
      .onConflictDoNothing({ target: surveySections.id });

    for (const question of seed.questions) {
      await db
        .insert(surveyQuestions)
        .values({
          id: question.id,
          sectionId: seed.sectionId,
          titleKo: question.titleKo,
          titleEn: question.titleEn,
          descriptionKo: question.descriptionKo,
          descriptionEn: question.descriptionEn,
          questionType: question.questionType,
          options: question.options,
          config: question.config,
          answerRegex: question.answerRegex,
          isRequired: question.isRequired ?? true,
          sortOrder: question.sortOrder,
        })
        .onConflictDoNothing({ target: surveyQuestions.id });
    }
  }

  console.log(`Seeded ${OPERATIONAL_SURVEY_SEEDS.length} operational application surveys`);
}

type SeedVoteItem = {
  titleKo: string;
  titleEn: string;
  descriptionKo: string;
  descriptionEn: string;
  type: "SINGLE_CHOICE" | "MULTIPLE_CHOICE" | "YES_NO_ABSTAIN";
  maxSelections: number;
  options: Array<{ labelKo: string; labelEn: string }>;
};

function wrapSeedVoteKey(key: Buffer) {
  const secret =
    process.env.VOTE_BALLOT_ENCRYPTION_KEY?.trim() ||
    readRequiredEnv("AUTH_PENDING_LOGIN_ENCRYPTION_KEY");
  const masterKey = createHash("sha256")
    .update(`soc-web:vote-ballot-key:v1:${secret}`, "utf8")
    .digest();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", masterKey, iv);
  const ciphertext = Buffer.concat([cipher.update(key), cipher.final()]);

  return {
    ciphertext: ciphertext.toString("base64url"),
    iv: iv.toString("base64url"),
    authTag: cipher.getAuthTag().toString("base64url"),
  };
}

type SeedVoteDefinition = {
  titleKo: string;
  titleEn: string;
  descriptionKo: string;
  descriptionEn: string;
  startsAt: Date;
  endsAt: Date;
  items: SeedVoteItem[];
};

async function createSeedVote(
  creatorId: string,
  demoAccount: {
    userId: string;
    nameKo: string;
    stdNo: string | null;
    email: string;
    primaryMajor: string | null;
    academicStatus: string | null;
  },
  definition: SeedVoteDefinition,
) {
  const wrappedVoteKey = wrapSeedVoteKey(randomBytes(32));
  const [vote] = await db
    .insert(votes)
    .values({
      creatorId,
      titleKo: definition.titleKo,
      titleEn: definition.titleEn,
      descriptionKo: definition.descriptionKo,
      descriptionEn: definition.descriptionEn,
      status: "PUBLISHED",
      startsAt: definition.startsAt,
      endsAt: definition.endsAt,
      academicStatuses: [],
      feePayersOnly: false,
      quorumPercent: 50,
      quorumInclusive: true,
      encryptedBallotKey: wrappedVoteKey.ciphertext,
      keyIv: wrappedVoteKey.iv,
      keyTag: wrappedVoteKey.authTag,
      voterSnapshotAt: definition.startsAt,
    })
    .returning({ voteId: votes.voteId });

  if (!vote) {
    throw new Error(`Failed to create seed vote: ${definition.titleKo}`);
  }

  for (const [sortOrder, item] of definition.items.entries()) {
    const [itemRow] = await db
      .insert(voteItems)
      .values({
        voteId: vote.voteId,
        titleKo: item.titleKo,
        titleEn: item.titleEn,
        descriptionKo: item.descriptionKo,
        descriptionEn: item.descriptionEn,
        type: item.type,
        maxSelections: item.maxSelections,
        sortOrder,
      })
      .returning({ itemId: voteItems.itemId });

    if (!itemRow) {
      throw new Error(`Failed to create seed vote item: ${item.titleKo}`);
    }

    await db.insert(voteOptions).values(
      item.options.map((option, optionSortOrder) => ({
        itemId: itemRow.itemId,
        labelKo: option.labelKo,
        labelEn: option.labelEn,
        sortOrder: optionSortOrder,
      })),
    );
  }

  await db.insert(voteVoters).values({
    voteId: vote.voteId,
    userId: demoAccount.userId,
    nameKo: demoAccount.nameKo,
    studentNumber: demoAccount.stdNo,
    email: demoAccount.email,
    primaryMajor: demoAccount.primaryMajor,
    academicStatus: demoAccount.academicStatus,
    feeStatus: null,
    status: "ELIGIBLE",
    source: "FILTER",
  });

  return vote.voteId;
}

async function seedVotes(creatorId: string) {
  const [demoAccount] = await db
    .select({
      userId: users.userId,
      nameKo: users.nameKo,
      stdNo: users.stdNo,
      email: users.email,
      primaryMajor: users.primaryMajor,
      academicStatus: users.academicStatus,
    })
    .from(users)
    .where(eq(users.kaistUid, DEMO_ACCOUNT_KAIST_UID))
    .limit(1);

  if (!demoAccount) {
    console.log("Demo account not found, skipping vote seed");
    return;
  }

  const definitions: SeedVoteDefinition[] = [
    {
      titleKo: "학생회 프로그램 선호도 투표",
      titleEn: "Council Program Preferences",
      descriptionKo: "이번 학기에 함께하고 싶은 학생회 프로그램을 선택해 주세요.",
      descriptionEn: "Choose the student council programs you would like to join this semester.",
      startsAt: demoDate(-21),
      endsAt: demoDate(-7, 23, 59),
      items: [
        {
          titleKo: "가장 참여하고 싶은 프로그램을 골라 주세요.",
          titleEn: "Which program would you most like to join?",
          descriptionKo: "가장 기대되는 프로그램 하나를 선택해 주세요.",
          descriptionEn: "Select one program you are most interested in.",
          type: "SINGLE_CHOICE",
          maxSelections: 1,
          options: [
            { labelKo: "알고리즘 스터디", labelEn: "Algorithm study" },
            { labelKo: "개발 워크숍", labelEn: "Development workshop" },
            { labelKo: "선후배 네트워킹", labelEn: "Student-alumni networking" },
          ],
        },
        {
          titleKo: "관심 있는 활동 분야를 모두 골라 주세요.",
          titleEn: "Which activity areas are you interested in?",
          descriptionKo: "최대 두 개까지 선택할 수 있습니다.",
          descriptionEn: "You can select up to two areas.",
          type: "MULTIPLE_CHOICE",
          maxSelections: 2,
          options: [
            { labelKo: "학업·스터디", labelEn: "Study" },
            { labelKo: "진로·커리어", labelEn: "Career" },
            { labelKo: "문화·교류", labelEn: "Culture and community" },
            { labelKo: "복지", labelEn: "Welfare" },
          ],
        },
      ],
    },
    {
      titleKo: "다음 학기 학생회 프로그램 선호도 투표",
      titleEn: "Next Semester Council Programs",
      descriptionKo: "다음 학기에 열렸으면 하는 학생회 프로그램을 골라 주세요.",
      descriptionEn: "Choose the student council programs you would like to see next semester.",
      startsAt: demoDate(3),
      endsAt: demoDate(17, 23, 59),
      items: [
        {
          titleKo: "가장 기대되는 가을 프로그램을 골라 주세요.",
          titleEn: "Which fall program are you most excited about?",
          descriptionKo: "가장 기대되는 프로그램 하나를 선택해 주세요.",
          descriptionEn: "Select one program you are most excited about.",
          type: "SINGLE_CHOICE",
          maxSelections: 1,
          options: [
            { labelKo: "전산학부 가을 네트워킹 데이", labelEn: "Fall SoC Networking Day" },
            { labelKo: "전산학부 워크샵", labelEn: "SoC Workshop" },
            { labelKo: "SoC 해피아워", labelEn: "SoC Happy Hour" },
          ],
        },
        {
          titleKo: "가을학기에 필요한 지원을 모두 골라 주세요.",
          titleEn: "Which kinds of support would help this fall?",
          descriptionKo: "최대 두 개까지 선택할 수 있습니다.",
          descriptionEn: "You can select up to two options.",
          type: "MULTIPLE_CHOICE",
          maxSelections: 2,
          options: [
            { labelKo: "SOC LOUNGE 운영", labelEn: "SOC LOUNGE access" },
            { labelKo: "시험기간 간식 이벤트", labelEn: "Exam-period snack events" },
            { labelKo: "과목별 겹강톡", labelEn: "Course group chats" },
            { labelKo: "진로·커리어 프로그램", labelEn: "Career programs" },
          ],
        },
      ],
    },
  ];

  for (const definition of definitions) {
    await createSeedVote(creatorId, demoAccount, definition);
  }

  console.log(`Seeded ${definitions.length} votes with one eligible voter each`);
}

async function seedReferenceRoadmap() {
  const existingReferenceCourses = await db
    .select({
      courseId: roadmapCourses.courseId,
      courseCode: roadmapCourses.courseCode,
      legacyCourseCode: roadmapCourses.legacyCourseCode,
    })
    .from(roadmapCourses)
    .where(eq(roadmapCourses.source, "REFERENCE"));
  const referenceCourseCodes = new Set(
    ROADMAP_REFERENCE_COURSES.map((course) => course.courseCode),
  );

  // Keep repeated reference seeding idempotent when a current code is
  // corrected later. This also migrates reference rows created from a
  // legacy three-digit code before the canonical map was added.
  for (const course of ROADMAP_REFERENCE_COURSES) {
    const stale = existingReferenceCourses.find(
      (existing) =>
        !referenceCourseCodes.has(existing.courseCode) &&
        (existing.legacyCourseCode === course.legacyCourseCode ||
          existing.courseCode === course.legacyCourseCode ||
          normalizeRoadmapCourseCode(existing.courseCode) === course.courseCode),
    );
    if (!stale) continue;
    const targetExists = existingReferenceCourses.some(
      (existing) => existing.courseCode === course.courseCode,
    );
    if (targetExists) continue;
    await db
      .update(roadmapCourses)
      .set({
        ai: course.ai,
        category: course.category,
        courseCode: course.courseCode,
        credits: course.credits,
        legacyCourseCode: course.legacyCourseCode,
        nameEn: course.nameEn,
        nameKo: course.nameKo,
        semesters: course.semesters,
        trackIds: course.trackIds,
        updatedAt: new Date(),
      })
      .where(eq(roadmapCourses.courseId, stale.courseId));
  }

  for (const course of ROADMAP_REFERENCE_COURSES) {
    await db
      .insert(roadmapCourses)
      .values({
        ai: course.ai,
        category: course.category,
        courseCode: course.courseCode,
        credits: course.credits,
        legacyCourseCode: course.legacyCourseCode,
        nameEn: course.nameEn,
        nameKo: course.nameKo,
        semesters: course.semesters,
        source: "REFERENCE",
        trackIds: course.trackIds,
        isVisible: true,
        updatedAt: new Date(),
      })
      .onConflictDoNothing({ target: roadmapCourses.courseCode });
  }

  // Backfill aliases for canonical courses that were seeded before the
  // historical-code map was complete (for example CS10003 -> CS103).
  for (const course of ROADMAP_REFERENCE_COURSES) {
    const legacyCourseCode =
      course.legacyCourseCode ?? getRoadmapLegacyCourseCode(course.courseCode);
    if (!legacyCourseCode) continue;
    await db
      .update(roadmapCourses)
      .set({ legacyCourseCode, updatedAt: new Date() })
      .where(
        and(
          eq(roadmapCourses.courseCode, course.courseCode),
          isNull(roadmapCourses.legacyCourseCode),
        ),
      );
  }

  const referenceOfferings = await db
    .select({ offeringId: roadmapOfferings.offeringId, courseCode: roadmapOfferings.courseCode })
    .from(roadmapOfferings)
    .where(eq(roadmapOfferings.sourceFileName, "reference-2026-spring.xlsx"));
  const referenceFallOfferings = await db
    .select({ offeringId: roadmapOfferings.offeringId, courseCode: roadmapOfferings.courseCode })
    .from(roadmapOfferings)
    .where(eq(roadmapOfferings.sourceFileName, "reference-2026-fall.xlsx"));
  for (const offering of [...referenceOfferings, ...referenceFallOfferings]) {
    const courseCode = normalizeRoadmapCourseCode(offering.courseCode);
    if (courseCode === offering.courseCode) continue;
    await db
      .update(roadmapOfferings)
      .set({ courseCode })
      .where(eq(roadmapOfferings.offeringId, offering.offeringId));
  }

  const courseRows = await db
    .select({ courseId: roadmapCourses.courseId, courseCode: roadmapCourses.courseCode })
    .from(roadmapCourses);
  const courseIdByCode = new Map(courseRows.map((row) => [row.courseCode, row.courseId]));
  for (const relation of ROADMAP_REFERENCE_RELATIONS) {
    const prerequisiteCourseId = courseIdByCode.get(relation.prerequisiteCourseCode);
    const postrequisiteCourseId = courseIdByCode.get(relation.postrequisiteCourseCode);
    if (!prerequisiteCourseId || !postrequisiteCourseId) continue;
    await db
      .insert(roadmapCourseRelations)
      .values({ prerequisiteCourseId, postrequisiteCourseId })
      .onConflictDoNothing();
  }

  const now = new Date();
  for (const term of ["2026-spring", "2026-fall"] as const) {
    await db
      .insert(roadmapTerms)
      .values({
        importedAt: now,
        sourceFileName: `reference-${term}.xlsx`,
        term,
        updatedAt: now,
      })
      .onConflictDoNothing({ target: roadmapTerms.term });

    const existingOfferings = await db
      .select({ sourceFileName: roadmapOfferings.sourceFileName })
      .from(roadmapOfferings)
      .where(eq(roadmapOfferings.term, term));
    const hasNonReferenceOffering = existingOfferings.some(
      (offering) => offering.sourceFileName !== `reference-${term}.xlsx`,
    );
    if (hasNonReferenceOffering) continue;
    if (existingOfferings.length > 0) {
      await db.delete(roadmapOfferings).where(eq(roadmapOfferings.term, term));
    }

    await db.insert(roadmapOfferings).values(
      ROADMAP_REFERENCE_OFFERINGS.filter((offering) => offering.term === term).map((offering) => ({
        ...offering,
        importedAt: now,
        importedBy: null,
        sourceData: { source: "reference-seed" },
        sourceFileName: `reference-${term}.xlsx`,
      })),
    );
  }
  console.log(`Seeded roadmap catalog (${ROADMAP_REFERENCE_COURSES.length} courses)`);
}

async function seedMockData() {
  const [noticeBoard] = await db.select({ boardId: boards.boardId }).from(boards).where(eq(boards.code, "notice")).limit(1);
  const [eventBoard] = await db.select({ boardId: boards.boardId }).from(boards).where(eq(boards.code, "_EVENT")).limit(1);
  if (!noticeBoard || !eventBoard) throw new Error("Demo boards are missing");

  // Rebuild only the demo author's inventory. Operational forms and real accounts remain separate.
  await cleanupSeedContent();
  await prepareLegacyDemoAccounts();
  const seedAuthor = await upsertDemoAccount();
  await mergeLegacyDemoAccounts(seedAuthor.userId);
  await seedAboutPageContent(seedAuthor.userId);

  const html = (paragraphs: readonly string[]) => paragraphs.map(text => `<p>${text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>`).join("");
  const localDate = (date: Date) => new Date(date.getTime() + 9 * 3600000).toISOString().slice(0, 16).replace("T", " ");
  for (const [index, notice] of DEMO_NOTICES.entries()) {
    const postedAt = demoDate(-index - 1, 10);
    const [row] = await db.insert(articles).values({
      boardId: noticeBoard.boardId, authorUserId: seedAuthor.userId,
      titleKo: notice.titleKo, titleEn: notice.titleEn,
      contentKo: html([...notice.paragraphsKo, "화면 확인을 위한 예시 공지입니다."]),
      contentEn: html([...notice.paragraphsEn, "This is a sample announcement for the demo site."]),
      visibilityScope: "PUBLIC", isPinned: notice.pinned, pinOrder: notice.pinned ? index : null,
      viewCount: 0, postedAt, isAnonymous: false,
    }).returning({ articleId: articles.articleId });
    if (notice.key === "notice-4") {
      await attachAssetsToArticle(row.articleId, seedAuthor.userId, [{
        filename: "seed-council-recruitment-guide.txt", content: "운영팀 모집 안내\n관심 분야와 참여 가능한 시간을 정리해 학생회로 문의해 주세요.\n",
        originalFilename: "운영팀_모집_안내.txt", mimeType: "text/plain", usageType: "ATTACHMENT", sortOrder: 0,
      }]);
      await db.insert(comments).values({ articleId: row.articleId, authorUserId: seedAuthor.userId,
        content: "활동 일정이 정해지면 추가로 안내해 드리겠습니다.", createdAt: postedAt, updatedAt: postedAt });
    }
  }

  for (const event of DEMO_EVENTS) {
    const start = demoDate(event.dayOffset, event.startHour);
    const end = demoDate(event.dayOffset, event.endHour, event.endMinute);
    const period = `${localDate(start)} – ${localDate(end)} (KST)`;
    const [row] = await db.insert(articles).values({
      boardId: eventBoard.boardId, authorUserId: seedAuthor.userId,
      titleKo: event.titleKo, titleEn: event.isKoreanOnly ? null : event.titleEn,
      contentKo: html([event.descriptionKo, `일시: ${period}`, `장소: ${event.location}`, "진행 방식과 준비 사항은 신청자에게 별도로 안내합니다.", "화면 확인을 위한 예시 행사입니다. 사진은 행사 분위기를 보여 주는 참고 이미지입니다."]),
      contentEn: event.isKoreanOnly ? null : html([event.descriptionEn, `When: ${period}`, `Where: ${event.location}`, "Details will be provided to registered participants.", "This is a sample event. Photographs are illustrative."]),
      eventDescriptionKo: event.descriptionKo, eventDescriptionEn: event.isKoreanOnly ? null : event.descriptionEn,
      eventStartDate: start, eventEndDate: end, eventLocation: event.location,
      eventLocationEn: event.location === "온라인" ? "Online" : event.location,
      visibilityScope: "PUBLIC", isPinned: false, viewCount: 0, postedAt: demoDate(event.dayOffset - 10), isAnonymous: false,
    }).returning({ articleId: articles.articleId });
    if (event.photo) {
      await attachAssetsToArticle(row.articleId, seedAuthor.userId, [{
        filename: `seed-event-${event.photo}`, content: await readFile(path.join(__dirname, "assets", "demo", event.photo)),
        originalFilename: `${event.titleKo}.jpg`, mimeType: "image/jpeg", usageType: "THUMBNAIL", sortOrder: 0,
      }]);
    }
    await createSurveyWithQuestions({
      ...makeSimpleEventSurvey({ titleKo: `${event.titleKo} 참가 신청`, titleEn: `${event.titleEn} Registration`,
        descriptionKo: `${event.titleKo}에 참여하려면 신청해 주세요. 화면 확인을 위한 예시 신청서입니다.`,
        descriptionEn: `Register for ${event.titleEn}. This is a sample registration form.`,
        openAt: demoDate(event.dayOffset - 10), closeAt: demoDate(event.closeDayOffset, 23, 59), maxResponseCount: 80 }),
      isKoreanOnly: event.isKoreanOnly, allowAnonymous: true, showOnList: false, showOnCalendar: false,
    }, seedAuthor.userId, row.articleId);
  }

  const feedbackSurveys = [
    { titleKo: "학부 공용공간 이용 의견 조사", titleEn: "Shared Space Feedback", descriptionKo: "라운지와 공용공간을 이용하면서 느낀 점을 알려 주세요. 보내 주신 의견은 이용 환경을 개선하는 데 참고합니다.", descriptionEn: "Share your experience with the lounge and shared spaces. Your feedback will help improve these spaces.", openDay: -7, closeDay: 14, allowAnonymous: true, koreanOnly: false,
      questions: [{ titleKo: "라운지를 얼마나 자주 이용하나요?", titleEn: "How often do you use the lounge?", options: ["주 3회 이상", "주 1~2회", "월 1~2회 이하"], optionsEn: ["Three or more times a week", "Once or twice a week", "Twice a month or less"] },
        { titleKo: "가장 개선이 필요한 부분은 무엇인가요?", titleEn: "What needs improvement most?", options: ["좌석과 테이블", "공용 물품", "청결과 정리"], optionsEn: ["Seats and tables", "Shared equipment", "Cleanliness"] }] },
    { titleKo: "학생회 프로그램 수요조사", titleEn: "Council Program Survey", descriptionKo: "", descriptionEn: "", openDay: -3, closeDay: 10, allowAnonymous: false, koreanOnly: true,
      questions: [{ titleKo: "참여하고 싶은 프로그램을 골라 주세요.", titleEn: "Which program would you like to join?", options: ["개발 워크숍", "선배와의 대화", "학우 교류 행사"], optionsEn: ["Development workshop", "Alumni conversations", "Student networking"] },
        { titleKo: "참여하기 편한 시간대를 골라 주세요.", titleEn: "Which time works best for you?", options: ["평일 저녁", "주말 오후", "일정에 따라 다름"], optionsEn: ["Weekday evenings", "Weekend afternoons", "Depends on the schedule"] }] },
    { titleKo: "학생회 행사 만족도 조사", titleEn: "Council Event Feedback", descriptionKo: "지난 행사에서 좋았던 점과 개선할 점을 알려 주세요.", descriptionEn: "Tell us what worked well at the previous event and what we can improve.", openDay: -21, closeDay: -7, allowAnonymous: true, koreanOnly: false,
      questions: [{ titleKo: "행사에 전반적으로 만족하셨나요?", titleEn: "Were you satisfied with the event?", options: ["만족", "보통", "개선이 필요함"], optionsEn: ["Satisfied", "Neutral", "Needs improvement"] }] },
    { titleKo: "다음 학기 진로 프로그램 수요조사", titleEn: "Next Semester Career Programs", descriptionKo: "관심 있는 진로 프로그램에 대한 의견을 받을 예정입니다.", descriptionEn: "We will be collecting your ideas for upcoming career programs.", openDay: 5, closeDay: 20, allowAnonymous: false, koreanOnly: false,
      questions: [{ titleKo: "가장 관심 있는 진로 주제를 골라 주세요.", titleEn: "Which career topic interests you most?", options: ["취업", "창업", "대학원 진학"], optionsEn: ["Employment", "Startups", "Graduate school"] }] },
  ];
  for (const survey of feedbackSurveys) {
    await createSurveyWithQuestions({
      kind: "SURVEY", titleKo: survey.titleKo, titleEn: survey.titleEn,
      descriptionKo: survey.descriptionKo, descriptionEn: survey.descriptionEn,
      feeRequirementPolicy: "NONE", allowMultipleResponses: false, allowResponseEdit: true, resultVisibility: "PRIVATE",
      allowAnonymous: survey.allowAnonymous, isKoreanOnly: survey.koreanOnly,
      openAt: demoDate(survey.openDay), closeAt: demoDate(survey.closeDay, 23, 59),
      sections: [{ titleKo: "의견 남기기", titleEn: "Your feedback", sortOrder: 0,
        questions: survey.questions.map((question, index) => ({ titleKo: question.titleKo, titleEn: question.titleEn, questionType: "single_choice",
          options: question.options.map((labelKo, i) => ({ value: `choice_${i + 1}`, labelKo, labelEn: question.optionsEn[i] })), sortOrder: index })) }],
    }, seedAuthor.userId, null);
  }
  // Retain the editor's question-type fixture without cluttering the public list or calendar.
  await createSurveyWithQuestions({ ...makeAllQuestionTypesSurvey(), showOnList: false, showOnCalendar: false }, seedAuthor.userId, null);

  const academicEvents = [
    { key: "exam-period", titleKo: "중간고사 기간", titleEn: "Midterm Exams", day: -2, duration: 5 },
    { key: "course-withdrawal", titleKo: "수강 취소 마감", titleEn: "Course Withdrawal Deadline", day: 7, duration: 1 },
    { key: "course-registration", titleKo: "다음 학기 수강신청", titleEn: "Next Semester Course Registration", day: 14, duration: 3 },
  ];
  for (const event of academicEvents) {
    const values = { titleKo: event.titleKo, titleEn: event.titleEn,
      descriptionKo: "일정 화면 확인을 위한 예시입니다. 실제 학사일정은 KAIST 공식 안내를 확인해 주세요.",
      descriptionEn: "Sample calendar data. Refer to KAIST announcements for actual academic dates.",
      startAt: demoDate(event.day, 0), endAt: demoDate(event.day + event.duration, 0),
      sourceType: "MANUAL", sourceUid: `soc-demo:${event.key}`, isAllDay: true, categoryOverride: "ACADEMIC",
      createdByUserId: seedAuthor.userId, isActive: true, googleSyncStatus: "NOT_CONFIGURED" };
    await db.insert(calendarEvents).values(values).onConflictDoUpdate({ target: [calendarEvents.sourceType, calendarEvents.sourceUid], set: { ...values, updatedAt: new Date() } });
  }
  await seedVotes(seedAuthor.userId);
  await seedOngoingVote();
  console.log(`Seeded ${DEMO_NOTICES.length} notices, ${DEMO_EVENTS.length} events with bundled photos, ${feedbackSurveys.length} public surveys, and ${academicEvents.length} academic calendar examples`);
}

async function seedOngoingVote() {
  const title = "학생회 사업 추진 찬반 투표";
  if ((await db.select().from(votes).where(eq(votes.titleKo, title))).length) return;
  const [demoAccount] = await db.select().from(users).where(eq(users.kaistUid, DEMO_ACCOUNT_KAIST_UID));
  if (!demoAccount) throw new Error("Demo account is required");
  await createSeedVote(demoAccount.userId, demoAccount, {
    titleKo: title, titleEn: "Student council initiative vote",
    descriptionKo: "이번 학기 학생회 사업 추진에 대한 의견을 선택해 주세요. 화면 확인을 위한 예시 투표입니다.", descriptionEn: "Share your opinion on this semester’s council initiative. This is a sample vote.",
    startsAt: demoDate(-1), endsAt: demoDate(7, 23, 59),
    items: [{titleKo: "학생회 사업 추진 승인", titleEn: "Approve the student council initiative", descriptionKo: null, descriptionEn: null,
      type: "YES_NO_ABSTAIN", maxSelections: 1, options: [
        {labelKo: "찬성", labelEn: "Yes"}, {labelKo: "반대", labelEn: "No"}, {labelKo: "기권", labelEn: "Abstain"}
      ]}]
  });
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
    if (process.env.SEED_ABOUT_CONTENT_ONLY === "true") {
      await seedReferenceAboutWorkContent();
      return;
    }
    if (process.env.SEED_OPERATIONAL_SURVEYS_ONLY === "true") {
      await seedOperationalSurveys();
      return;
    }
    if (process.env.SEED_VOTES_ONLY === "true") {
      if (process.env.NODE_ENV === "production") throw new Error("demo_seed_is_forbidden_in_production");
      await seedOngoingVote();
      return;
    }
    await seedPermissions();
    await seedInitialAdminRole();
    await seedBoards();
    await seedOperationalSurveys();
    if (seedMode === "demo") {
      await seedMockData();
    }
    await seedReferenceFaqs();
    if (seedMode === "reference") {
      await seedReferenceAboutPageContent();
    }
    await seedReferenceAboutWorkContent();
    await seedReferenceRoadmap();
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
