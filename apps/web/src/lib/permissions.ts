import { hasPermission } from "@soc/shared";

export const WRITE_NOTICE_PERMISSION_BIT = 1;
export const WRITE_GENERAL_PERMISSION_BIT = 2;
export const WRITE_REPLY_PERMISSION_BIT = 4;
export const MANAGE_SURVEY_PERMISSION_BIT = 8;
export const MANAGE_FINANCE_PERMISSION_BIT = 16;
export const MANAGE_CONTENT_PERMISSION_BIT = 32;
export const MANAGE_TOOL_PERMISSION_BIT = 64;
export const MODERATOR_PERMISSION_BIT = 128;
export const ADMIN_PERMISSION_BIT = 256;

export const PERMISSION_DEFINITIONS = [
  {
    key: "WRITE_NOTICE",
    bit: 1,
    label: "공지/행사 작성",
    description: "공식 공지, 행사 등 운영진 게시글을 작성할 수 있습니다.",
  },
  {
    key: "WRITE_GENERAL",
    bit: 2,
    label: "일반/홍보 작성",
    description: "홍보, HoC, 연구실 등 일반 게시글을 작성할 수 있습니다.",
  },
  {
    key: "WRITE_REPLY",
    bit: 4,
    label: "공식 답변",
    description: "QnA, 건의사항에 대해 공식 답변과 상태 변경을 할 수 있습니다.",
  },
  {
    key: "MANAGE_SURVEY",
    bit: 8,
    label: "설문조사 관리",
    description: "설문조사, 투표, 단체구매를 생성하고 결과를 열람할 수 있습니다.",
  },
  {
    key: "MANAGE_FINANCE",
    bit: 16,
    label: "과비 관리",
    description: "과비 납부 시트 관리와 독촉 메일 발송이 가능합니다.",
  },
  {
    key: "MANAGE_CONTENT",
    bit: 32,
    label: "콘텐츠 관리",
    description: "홈 화면, 배너, 로드맵, 캘린더 등 정보성 콘텐츠를 수정할 수 있습니다.",
  },
  {
    key: "MANAGE_TOOL",
    bit: 64,
    label: "도구 관리",
    description: "POM 채점기, 챗봇 등 기술 도구 데이터를 관리할 수 있습니다.",
  },
  {
    key: "MODERATOR",
    bit: 128,
    label: "유저/게시글 관리",
    description: "타인 게시글 강제 삭제와 일반 유저 제재를 수행할 수 있습니다.",
  },
  {
    key: "ADMIN",
    bit: 256,
    label: "최고 관리자",
    description: "역할 그룹 CRUD, 권한 부여, 시스템 핵심 설정을 관리할 수 있습니다.",
  },
] as const;

export const hasSurveyManagePermission = (permission?: number | null): boolean =>
  hasPermission(permission ?? 0, MANAGE_SURVEY_PERMISSION_BIT);

export const hasAdminPermission = (permission?: number | null): boolean =>
  hasPermission(permission ?? 0, ADMIN_PERMISSION_BIT);

export const getGrantedPermissions = (permission?: number | null) =>
  PERMISSION_DEFINITIONS.filter((item) => hasPermission(permission ?? 0, item.bit));
