import { hasPermission } from "@soc/shared";

export const SURVEY_MANAGE_PERMISSION_BIT = 64;

export const PERMISSION_DEFINITIONS = [
  {
    key: "BOARD_STUDENT_COUNCIL_WRITE",
    bit: 1,
    label: "학생회 공지 작성",
    description: "공지 게시판에 글을 작성할 수 있습니다.",
  },
  {
    key: "BOARD_HOC_PROMO_WRITE",
    bit: 2,
    label: "HoC 홍보글 작성",
    description: "HoC 및 홍보 게시판에 글을 작성할 수 있습니다.",
  },
  {
    key: "BOARD_LAB_WRITE",
    bit: 4,
    label: "연구실 글 작성",
    description: "연구실 게시판에 글을 작성할 수 있습니다.",
  },
  {
    key: "BOARD_SUGGESTION_REPLY",
    bit: 8,
    label: "건의사항 답변",
    description: "건의사항 게시판에서 운영진 답변이 가능합니다.",
  },
  {
    key: "BOARD_QNA_OFFICIAL_WRITE",
    bit: 16,
    label: "QnA 공식 답변",
    description: "QnA 게시판에서 공식 답변을 작성할 수 있습니다.",
  },
  {
    key: "TUITION_MANAGE",
    bit: 32,
    label: "등록금 관리",
    description: "등록금 상태를 관리할 수 있습니다.",
  },
  {
    key: "SURVEY_MANAGE",
    bit: SURVEY_MANAGE_PERMISSION_BIT,
    label: "설문조사 관리",
    description: "설문조사 생성, 수정, 삭제 및 응답 검토가 가능합니다.",
  },
  {
    key: "POST_DELETE",
    bit: 128,
    label: "게시글 삭제",
    description: "다른 사용자의 게시글을 삭제할 수 있습니다.",
  },
  {
    key: "TUITION_PAYER",
    bit: 256,
    label: "등록금 납부자",
    description: "등록금 납부자 전용 기능을 사용할 수 있습니다.",
  },
] as const;

export const hasSurveyManagePermission = (permission?: number | null): boolean =>
  hasPermission(permission ?? 0, SURVEY_MANAGE_PERMISSION_BIT);

export const getGrantedPermissions = (permission?: number | null) =>
  PERMISSION_DEFINITIONS.filter((item) => hasPermission(permission ?? 0, item.bit));
