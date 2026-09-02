import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { and, eq, inArray, isNull, ne, sql } from "drizzle-orm";
import { createCipheriv, createHash, randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  articleAssets,
  articles,
  assets,
  boards,
  comments,
  contentBlocks,
  executiveContactDepartments,
  executiveContacts,
  permissions,
  roleGroupPermissions,
  roleGroups,
  surveyQuestions,
  surveySections,
  surveys,
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
    contentKo: "[학생회 소개] > [후원 및 제휴] 또는 [설문·투표] > [신청형 설문]의 ‘기업 후원 및 제휴 문의’를 이용해 주세요.\n\n• 기업·기관명, 회신 이메일, 제안 유형과 내용을 입력해 주세요.\n• 담당자가 내용을 확인하며, 제출만으로 제휴 성사나 회신 일정이 확정되지는 않습니다.",
    contentEn: "Use About → Sponsorship & Partnerships or submit ‘Corporate Sponsorship and Partnership Inquiry’ under Surveys & Voting.\n\n• Include your organization, reply email, proposal type, and details.\n• A council member will review the request; submission alone does not confirm a partnership or response schedule.",
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
  titleKo: string;
  titleEn: string;
  bodyKo: string;
  bodyEn: string;
  pledgeStatus: "COMPLETED" | "IN_PROGRESS" | "PLANNED";
};

const REFERENCE_PLEDGE_SEEDS: readonly ReferencePledgeSeed[] = [
  {
    titleKo: "전산학부 학생회 웹사이트 개발",
    titleEn: "Development of the SoC Student Council website",
    bodyKo: "현재 학생회 웹사이트의 ver 1.0이 이렇게 배포 되었습니다! 앞으로 추가적인 기능 개발과 지속적인 유지 보수를 할 예정이니, 혹시 사이트를 이용하면서 불편하신점이나, 버그가 있다면 편하게 아래 채널톡 등을 통해 연락해 주시기 바랍니다.",
    bodyEn: "Version 1.0 of the Student Council website is now live! We plan to continue developing features and maintaining the site. If you experience any inconvenience or find a bug, please contact us through Channel Talk or one of the channels below.",
    pledgeStatus: "COMPLETED",
  },
  {
    titleKo: "사업 전문화를 위한 집행위원회 구조 개편",
    titleEn: "Restructuring the executive committee for specialized operations",
    bodyKo: "사업의 전문화와 원활한 업무 분배를 위해 기존의 부서 + 팀체계에서 온전한 부서 체계로 개편하였으며, 외부 기업 및 타학교 교류 업무를 위한 대외소통부, 웹사이트 개발 등의 업무를 위한 전산관리부를 새롭게 신설하였습니다. 자세한 조직도는 웹사이트 학생회 소개에서 보실 수 있습니다.",
    bodyEn: "To specialize our work and distribute responsibilities smoothly, we reorganized the former department-and-team structure into a full department structure. We newly established the External Communications Division for exchanges with companies and other schools, and the IT Administration Division for website development and related work. See the Student Council Introduction page for the detailed organization chart.",
    pledgeStatus: "COMPLETED",
  },
  {
    titleKo: "과목별 건강톡방 개설",
    titleEn: "Opening course-specific chat rooms",
    bodyKo: "2026년 상반기, 담당 교수님께 허락을 받은 9개 과목의 건강톡방을 개설하여 한 학기 동안 운영하였습니다.",
    bodyEn: "In the first half of 2026, we opened chat rooms for nine courses with the permission of the instructors and operated them throughout the semester.",
    pledgeStatus: "COMPLETED",
  },
  {
    titleKo: "타 학교, 타 학과와의 교류 행사 추진",
    titleEn: "Pursuing exchange events with other schools and departments",
    bodyKo: "타 학교의 전산학부(컴퓨터공학부)와 교류 할 수 있는 행사 기획을 준비 중입니다.",
    bodyEn: "We are preparing an event to exchange ideas and experiences with the School of Computing or Computer Engineering departments at other schools.",
    pledgeStatus: "IN_PROGRESS",
  },
  {
    titleKo: "진로 탐색 기회 확장",
    titleEn: "Expanding career exploration opportunities",
    bodyKo: "진로콘서트를 토크콘서트로 개편하며 더 다양한 분야의 연사 분들을 모셔 강연을 진행하였습니다. 이번 학기 중 진행할 기업체 탐방도 더 다양한 기업들을 탐방 할 수 있도록 노력 중입니다.",
    bodyEn: "We redesigned the Career Concert as a talk concert and invited speakers from a wider range of fields. We are also working to visit a more diverse range of companies during this semester's company tour.",
    pledgeStatus: "IN_PROGRESS",
  },
  {
    titleKo: "스승의 날 행사 개최",
    titleEn: "Holding a Teachers' Day event",
    bodyKo: "기존에 사라졌던 사업인 '스승의 날 행사'를 다시 진행하였습니다. 전산학부 교수님들께 감사한 마음을 글로 전달할 수 있는 소중한 기회가 되었습니다.",
    bodyEn: "We brought back the previously discontinued Teachers' Day event. It was a valuable opportunity to express our gratitude to the School of Computing faculty in writing.",
    pledgeStatus: "COMPLETED",
  },
  {
    titleKo: "전산학부 OTL 수강 후기 이벤트 진행",
    titleEn: "Running an SoC OTL course-review event",
    bodyKo: "전산학부의 전공 수강 계획에 도움이 되는 양질의 OTL 수강 후기를 제공해 드리기 위해 OTL 수강후기 이벤트를 봄학기 종강 이후 진행하였습니다. 가을 학기에도 동일한 행사를 진행 예정입니다.",
    bodyEn: "To provide high-quality OTL course reviews that help students plan their major courses, we ran an OTL course-review event after the spring semester ended. We plan to hold the same event in the fall semester as well.",
    pledgeStatus: "COMPLETED",
  },
  {
    titleKo: "공약이행상황판 제작",
    titleEn: "Creating the pledge progress board",
    bodyKo: "전산학부 학생회장단의 공약이행상황을 학우분들과 공유하고자 이번 웹사이트에 공약이행상황판을 만들게 되었습니다.",
    bodyEn: "We created this pledge progress board on the website to share the SoC Student Council leadership's pledge progress with students.",
    pledgeStatus: "COMPLETED",
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

type OperationalSurveySeed = {
  surveyId: string;
  sectionId: string;
  sectionTitleKo: string;
  sectionTitleEn: string;
  kind: "APPLICATION";
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
    kind: "APPLICATION",
    titleKo: "전산학부 학번톡 초대 요청",
    titleEn: "SoC Cohort Chat Invitation Request",
    descriptionKo: "전산학부 주전공 학생의 학번별 카카오톡 대화방 초대를 요청합니다.",
    descriptionEn: "Request an invitation to the cohort KakaoTalk chat for School of Computing primary-major students.",
    eligibleSocAffiliations: ["PRIMARY"],
    academicEligibility: "ENROLLED_OR_LEAVE",
    allowAnonymous: false,
    allowMultipleResponses: false,
    questions: [
      {
        id: "7a130000-0000-4000-8000-000000000001",
        titleKo: "초대를 받을 카카오톡 ID 또는 전화번호",
        titleEn: "KakaoTalk ID or phone number for the invitation",
        descriptionKo: "초대 확인에 필요한 연락처만 입력해 주세요.",
        descriptionEn: "Enter only the contact information needed for the invitation.",
        questionType: "short_text",
        sortOrder: 0,
      },
      {
        id: "7a130000-0000-4000-8000-000000000002",
        titleKo: "입학 연도",
        titleEn: "Admission year",
        questionType: "short_text",
        sortOrder: 1,
      },
      {
        id: "7a130000-0000-4000-8000-000000000003",
        titleKo: "연락처를 학번톡 초대 목적으로 사용하는 데 동의합니다.",
        titleEn: "I agree that my contact information may be used for the cohort chat invitation.",
        questionType: "single_choice",
        options: [{ value: "agree", labelKo: "동의합니다", labelEn: "I agree" }],
        sortOrder: 2,
      },
    ],
  },
  {
    surveyId: OPERATIONAL_SURVEY_IDS.promotionPostRequest,
    sectionId: "7a120000-0000-4000-8000-000000000002",
    sectionTitleKo: "신청 정보",
    sectionTitleEn: "Application details",
    kind: "APPLICATION",
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
    surveyId: OPERATIONAL_SURVEY_IDS.corporatePartnership,
    sectionId: "7a120000-0000-4000-8000-000000000003",
    sectionTitleKo: "문의 정보",
    sectionTitleEn: "Inquiry details",
    kind: "APPLICATION",
    titleKo: "기업 후원 및 제휴 문의",
    titleEn: "Corporate Sponsorship and Partnership Inquiry",
    descriptionKo: "행사 후원, 채용·기술 세션과 공동 프로그램 제안을 접수합니다.",
    descriptionEn: "Submit proposals for event sponsorships, recruiting or technical sessions, and joint programs.",
    eligibleSocAffiliations: [],
    academicEligibility: "ANY",
    allowAnonymous: true,
    allowMultipleResponses: true,
    questions: [
      {
        id: "7a130000-0000-4000-8000-000000000021",
        titleKo: "기업 또는 기관명",
        titleEn: "Company or organization",
        questionType: "short_text",
        sortOrder: 0,
      },
      {
        id: "7a130000-0000-4000-8000-000000000022",
        titleKo: "담당자 이름과 직책",
        titleEn: "Contact name and title",
        questionType: "short_text",
        sortOrder: 1,
      },
      {
        id: "7a130000-0000-4000-8000-000000000023",
        titleKo: "회신 받을 이메일",
        titleEn: "Reply email",
        questionType: "short_text",
        sortOrder: 2,
      },
      {
        id: "7a130000-0000-4000-8000-000000000024",
        titleKo: "제안 유형",
        titleEn: "Proposal type",
        questionType: "dropdown",
        options: [
          { value: "sponsorship", labelKo: "행사 후원", labelEn: "Event sponsorship" },
          { value: "career", labelKo: "채용·커리어", labelEn: "Recruiting and careers" },
          { value: "technical", labelKo: "기술 세션", labelEn: "Technical session" },
          { value: "partnership", labelKo: "공동 프로그램", labelEn: "Joint program" },
          { value: "other", labelKo: "기타", labelEn: "Other" },
        ],
        sortOrder: 3,
      },
      {
        id: "7a130000-0000-4000-8000-000000000025",
        titleKo: "제안 내용",
        titleEn: "Proposal details",
        questionType: "long_text",
        sortOrder: 4,
      },
      {
        id: "7a130000-0000-4000-8000-000000000026",
        titleKo: "제안서 또는 참고 자료 링크",
        titleEn: "Proposal or reference link",
        questionType: "short_text",
        isRequired: false,
        sortOrder: 5,
      },
    ],
  },
];

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
    delete from vote_ballot
    where vote_id in (
      select vote_id from vote
      where creator_id in (
        select user_id from users
        where kaist_uid = 'seed-council-author'
      )
    )
  `);

  await db.execute(sql`
    delete from vote_tally
    where vote_id in (
      select vote_id from vote
      where creator_id in (
        select user_id from users
        where kaist_uid = 'seed-council-author'
      )
    )
  `);

  await db.execute(sql`
    delete from vote
    where creator_id in (
      select user_id from users
      where kaist_uid = 'seed-council-author'
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
      academicStatus: "운영",
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

  await db
    .insert(executiveContactDepartments)
    .values([
      {
        nameKo: "회장단",
        nameEn: "Presidium",
        descriptionKo: "학생회 주요 방향을 설정하고 학부생의 의견을 바탕으로 의사 결정합니다.",
        descriptionEn: "Set the council's direction and make decisions grounded in undergraduate feedback.",
        inquiryEmail: "kaist.helloworld@gmail.com",
        sortOrder: 0,
        isActive: true,
      },
      {
        nameKo: "비서실",
        nameEn: "Secretariat",
        descriptionKo: "회의와 행정을 지원하고 공지·기록을 체계적으로 관리합니다.",
        descriptionEn: "Support meetings and administration while keeping notices and records organized.",
        inquiryEmail: "kaist.helloworld@gmail.com",
        sortOrder: 1,
        isActive: true,
      },
      {
        nameKo: "대외소통부",
        nameEn: "External Communications",
        descriptionKo: "학부와 외부 커뮤니케이션을 담당하고 행사와 학생회 소식을 알립니다.",
        descriptionEn: "Lead communications with the department and external partners and share council news.",
        inquiryEmail: "kaist.helloworld@gmail.com",
        sortOrder: 2,
        isActive: true,
      },
      {
        nameKo: "기획부",
        nameEn: "Planning Division",
        descriptionKo: "축제·간식 행사와 학부생을 위한 프로그램을 기획하고 운영합니다.",
        descriptionEn: "Plan and run festivals, snack events, and programs for School of Computing students.",
        inquiryEmail: "kaist.helloworld@gmail.com",
        sortOrder: 3,
        isActive: true,
      },
      {
        nameKo: "전산관리부",
        nameEn: "IT Administration",
        descriptionKo: "포털 개발 및 인프라 운영, 시스템 관리를 담당합니다.",
        descriptionEn: "Develop and operate the portal, infrastructure, and council systems.",
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

  await db.insert(executiveContacts).values([
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
  ]);

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
    const contentBlockId = existingPledgesByTitle.get(seed.titleKo);
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

  const referencePledgeTitles = new Set(REFERENCE_PLEDGE_SEEDS.map((item) => item.titleKo));
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
    });
  }

  console.log(
    `Reference about content ready (${REFERENCE_PLEDGE_SEEDS.length} pledges and organization chart)`,
  );
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

async function seedOperationalSurveys() {
  for (const seed of OPERATIONAL_SURVEY_SEEDS) {
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
  type: "SINGLE_CHOICE" | "MULTIPLE_CHOICE";
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

async function seedVotes(creatorId: string) {
  const [devAdmin] = await db
    .select({
      userId: users.userId,
      nameKo: users.nameKo,
      stdNo: users.stdNo,
      email: users.email,
      primaryMajor: users.primaryMajor,
      academicStatus: users.academicStatus,
    })
    .from(users)
    .where(eq(users.kaistUid, "DEV0001"))
    .limit(1);

  if (!devAdmin) {
    console.log("Dev admin not found, skipping vote seed");
    return;
  }

  const startsAt = new Date("2026-08-24T09:00:00+09:00");
  const endsAt = new Date("2026-09-07T23:59:00+09:00");
  const wrappedVoteKey = wrapSeedVoteKey(randomBytes(32));
  const [vote] = await db
    .insert(votes)
    .values({
      creatorId,
      titleKo: "2026 하반기 학생회 프로그램 선호도 투표",
      titleEn: "Fall 2026 Student Council Program Poll",
      descriptionKo: "이번 학기에 함께하고 싶은 학생회 프로그램을 선택해 주세요.",
      descriptionEn: "Choose the student council programs you would like to join this semester.",
      status: "PUBLISHED",
      startsAt,
      endsAt,
      academicStatuses: ["재학", "휴학"],
      feePayersOnly: false,
      encryptedBallotKey: wrappedVoteKey.ciphertext,
      keyIv: wrappedVoteKey.iv,
      keyTag: wrappedVoteKey.authTag,
      voterSnapshotAt: startsAt,
    })
    .returning({ voteId: votes.voteId });

  if (!vote) {
    throw new Error("Failed to create seed vote");
  }

  const items: SeedVoteItem[] = [
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
  ];

  for (const [sortOrder, item] of items.entries()) {
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
    userId: devAdmin.userId,
    nameKo: devAdmin.nameKo,
    studentNumber: devAdmin.stdNo,
    email: devAdmin.email,
    primaryMajor: devAdmin.primaryMajor,
    academicStatus: devAdmin.academicStatus,
    feeStatus: null,
    status: "ELIGIBLE",
    source: "FILTER",
  });

  console.log(`Seeded vote with ${items.length} items and one eligible voter`);
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
  const [noticeBoard] = await db
    .select({ boardId: boards.boardId })
    .from(boards)
    .where(eq(boards.code, "notice"))
    .limit(1);

  const [eventBoard] = await db
    .select({ boardId: boards.boardId })
    .from(boards)
    .where(eq(boards.code, "_EVENT"))
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

  await seedVotes(seedAuthor.userId);
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
    await seedInitialAdminRole();
    await seedBoards();
    await seedOperationalSurveys();
    if (seedMode === "demo") {
      await seedDevAdminRole();
      await seedMockData();
    }
    await seedReferenceFaqs();
    if (seedMode === "reference") {
      await seedReferenceAboutPageContent();
    }
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
