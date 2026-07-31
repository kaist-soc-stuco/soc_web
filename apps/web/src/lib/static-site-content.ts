import type { EffectivePermissionGrant } from '@soc/contracts';
import { hasAdminGrant, type AdminGrantRequirement } from './admin-access';

export const roadmapMilestones = [
  '1학년: 기초 프로그래밍, 자료구조, 수리 기초 다지기',
  '2학년: 시스템, 알고리즘, 프로젝트 경험 확장',
  '3학년: 연구실 탐색, 인턴십, 심화 전공 선택',
  '4학년: 졸업 연구, 진로 설계, 포트폴리오 정리',
];

export interface RoadmapCourse {
  code: string;
  row: number;
  column: number;
  name: string;
  prereqs?: string[];
  refs?: string[];
}

export const csRequiredCourseCodes = ['204', '206', '300', '311', '320', '330'];
export const csIrregularCourseCodes = ['422', '442'];

export const csRoadmapCourses: RoadmapCourse[] = [
  { code: '101', row: 1, column: 3, name: '프로그래밍기초' },
  { code: '109', row: 1, column: 1, name: '프로그래밍 실습', prereqs: ['101'] },
  { code: '204', row: 2, column: 2, name: '이산구조' },
  { code: '206', row: 2, column: 1, name: '데이타구조', prereqs: ['101'], refs: ['109'] },
  { code: '211', row: 2, column: 4, name: '디지탈시스템 및 실험' },
  { code: '220', row: 2, column: 3, name: '프로그래밍의 이해', prereqs: ['101'] },
  { code: '230', row: 2, column: 5, name: '시스템프로그래밍', prereqs: ['101'] },
  { code: '270', row: 2, column: 8, name: '지능 로봇 설계 및 프로그래밍', prereqs: ['101'] },
  { code: '202', row: 3, column: 1, name: '문제해결기법', prereqs: ['206', '300'] },
  { code: '300', row: 3, column: 2, name: '알고리즘 개론', prereqs: ['204', '206'] },
  { code: '311', row: 3, column: 4, name: '전산기조직', prereqs: ['230'], refs: ['211'] },
  { code: '320', row: 3, column: 3, name: '프로그래밍언어', prereqs: ['204'], refs: ['220'] },
  { code: '330', row: 3, column: 5, name: '운영체제 및 실험', prereqs: ['230', '311'] },
  { code: '341', row: 3, column: 6, name: '전산망 개론', prereqs: ['230'] },
  { code: '348', row: 3, column: 7, name: '정보보호개론', refs: ['341'] },
  { code: '374', row: 3, column: 8, name: '인간-컴퓨터 상호작용 개론' },
  { code: '380', row: 3, column: 9, name: '컴퓨터 그래픽스 개론' },
  { code: '402', row: 4, column: 1, name: '전산논리학개론', prereqs: ['300'] },
  { code: '422', row: 4, column: 2, name: '계산이론', prereqs: ['300'] },
  { code: '420', row: 4, column: 3, name: '컴파일러설계', prereqs: ['320'], refs: ['311'] },
  { code: '411', row: 4, column: 4, name: '인공지능을 위한 시스템', prereqs: ['311'] },
  { code: '431', row: 4, column: 5, name: '동시성 프로그래밍', prereqs: ['320', '330'] },
  { code: '442', row: 4, column: 6, name: '모바일 컴퓨팅과 응용', refs: ['341'] },
  { code: '447', row: 4, column: 7, name: '웹 보안 공격 실습', refs: ['341'] },
  { code: '473', row: 4, column: 8, name: '소셜 컴퓨팅 개론', prereqs: ['374'] },
  { code: '482', row: 4, column: 9, name: '대화형 컴퓨터그래픽스', prereqs: ['380'] },
  { code: '350', row: 5, column: 1, name: '소프트웨어 공학 개론' },
  { code: '454', row: 5, column: 2, name: '인공 지능 기반 소프트웨어 공학', prereqs: ['350'] },
  { code: '360', row: 5, column: 4, name: '데이타베이스 개론' },
  { code: '371', row: 5, column: 5, name: '딥러닝 개론', prereqs: ['376'] },
  { code: '376', row: 5, column: 6, name: '기계학습' },
  { code: '372', row: 5, column: 7, name: '파이썬을 통한 자연언어처리' },
  { code: '484', row: 5, column: 8, name: '컴퓨터 비전 개론' },
  { code: '453', row: 6, column: 1, name: '소프트웨어 테스팅 자동화 기법', prereqs: ['350'] },
  { code: '457', row: 6, column: 2, name: '스마트 환경을 위한 요구공학', prereqs: ['350'] },
  { code: '459', row: 6, column: 3, name: '서비스 컴퓨팅 개론', prereqs: ['350'] },
  { code: '470', row: 6, column: 4, name: '인공지능개론' },
  { code: '471', row: 6, column: 5, name: '그래프 기계학습 및 마이닝', prereqs: ['376'] },
  { code: '479', row: 6, column: 6, name: '3차원 데이터를 위한 기계 학습', refs: ['376'] },
  { code: '475', row: 6, column: 7, name: '자연언어처리를 위한 기계학습', refs: ['372', '376'] },
  { code: '485', row: 6, column: 8, name: '컴퓨터비전을 위한 기계학습', prereqs: ['484'], refs: ['376'] },
  { code: '489', row: 6, column: 9, name: '컴퓨터윤리와사회문제' },
];

export interface AdminMenuItem {
  label: string;
  to: string;
  access: AdminGrantRequirement;
}

export const adminMenu: readonly AdminMenuItem[] = [
  { label: '과비 납부 관리', to: '/admin/payments', access: { kind: 'GLOBAL', permission: 'FEES_MANAGE' } },
  { label: '설문조사 관리', to: '/admin/surveys', access: { kind: 'GLOBAL', permission: 'SURVEY_MANAGE' } },
  { label: '이메일 일괄발송', to: '/admin/emails', access: { kind: 'GLOBAL', permission: 'MAIL_SEND' } },
  { label: '집행위 연락망', to: '/admin/contacts', access: { kind: 'GLOBAL', permission: 'CONTACTS_MANAGE' } },
  { label: '사용자 관리', to: '/admin/users', access: { kind: 'GLOBAL', permission: 'USERS_MANAGE' } },
  { label: '권한 관리', to: '/admin/permissions', access: { kind: 'WORKFLOW' } },
  { label: '권한 감사 로그', to: '/admin/audit-logs', access: { kind: 'GLOBAL', permission: 'PERMISSION_AUDIT' } },
  { label: '게시판 관리', to: '/admin/boards', access: { kind: 'GLOBAL', permission: 'BOARD_MANAGE' } },
  { label: 'FAQ 관리', to: '/admin/faqs', access: { kind: 'GLOBAL', permission: 'FAQ_MANAGE' } },
  { label: '행사 관리', to: '/admin/events', access: { kind: 'GLOBAL', permission: 'EVENT_MANAGE' } },
];

export function visibleAdminMenu(grants: readonly EffectivePermissionGrant[]): AdminMenuItem[] {
  return adminMenu.filter((item) => hasAdminGrant(grants, item.access));
}
