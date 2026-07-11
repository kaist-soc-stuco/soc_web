export const boardCategories = ['공지', '행사', 'HoC', '홍보글', '건의사항', '연구실', 'QnA'] as const;

export type BoardCategory = (typeof boardCategories)[number];

export const boardInfo: Record<string, { description: string }> = {
  공지: { description: '학생회 및 학교의 중요한 공지사항을 확인하세요' },
  행사: { description: '전산학부의 다양한 행사 정보를 확인하세요' },
  HoC: { description: 'Hall of Code 프로젝트 및 활동 내역' },
  홍보글: { description: '학생회 및 학회의 홍보 게시물' },
  건의사항: { description: '학생들의 의견과 건의사항을 나눠주세요' },
  연구실: { description: '각 연구실의 소식과 공지사항' },
  QnA: { description: '궁금한 점을 자유롭게 질문하세요' },
};

export interface MockBoardPost {
  id: number;
  category: string;
  title: string;
  author: string;
  date: string;
  views: number;
}

export interface MockEvent {
  id: number;
  title: string;
  date: string;
  image: string;
  status: 'ongoing' | 'completed';
  summary: string;
}

export const mockEvents: MockEvent[] = [
  {
    id: 1,
    image: '/temp.png',
    title: '2026 봄맞이 간식 이벤트',
    date: '26.04.17',
    status: 'completed',
    summary: '학생회가 준비한 간식 행사의 후기와 만족도 설문입니다.',
  },
  {
    id: 2,
    image: '/temp.png',
    title: '신입생 환영 네트워킹 데이',
    date: '26.04.24',
    status: 'ongoing',
    summary: '신입생 환영 행사의 참여 경험을 남기는 설문입니다.',
  },
  {
    id: 3,
    image: '/temp.png',
    title: 'Hall of Code 프로젝트 설명회',
    date: '26.05.02',
    status: 'completed',
    summary: '프로젝트 설명회 만족도와 후속 희망 주제를 받습니다.',
  },
  {
    id: 4,
    image: '/temp.png',
    title: '시험기간 야식 배부',
    date: '26.05.10',
    status: 'completed',
    summary: '야식 배부 운영에 대한 의견을 수집합니다.',
  },
  {
    id: 5,
    image: '/temp.png',
    title: '전산학부 체육대회',
    date: '26.05.18',
    status: 'ongoing',
    summary: '체육대회 만족도와 다음 행사 아이디어를 받습니다.',
  },
  {
    id: 6,
    image: '/temp.png',
    title: '연구실 오픈랩 투어',
    date: '26.05.27',
    status: 'completed',
    summary: '연구실 투어 후 가장 도움이 된 세션을 조사합니다.',
  },
];

export const createMockPosts = (category: string): MockBoardPost[] =>
  Array.from({ length: 24 }, (_, index) => ({
    id: index + 1,
    category,
    title: `${category} 게시글 제목 ${index + 1}`,
    author: index % 2 === 0 ? '조성원' : '학생회',
    date: `26.0${(index % 5) + 2}.${String((index % 27) + 1).padStart(2, '0')}`,
    views: 120 + index * 17,
  }));

export const roadmapMilestones = [
  '1학년: 기초 프로그래밍, 자료구조, 수리 기초 다지기',
  '2학년: 시스템, 알고리즘, 프로젝트 경험 확장',
  '3학년: 연구실 탐색, 인턴십, 심화 전공 선택',
  '4학년: 졸업 연구, 진로 설계, 포트폴리오 정리',
];

export const faqPreviewItems = [
  {
    question: '수강 신청 전에 꼭 확인할 것은 무엇인가요?',
    answer: '권장 이수 순서, 선수과목, 학기별 개설 여부를 먼저 확인하는 편이 좋습니다.',
  },
  {
    question: '학부 행사 정보는 어디서 가장 빨리 보나요?',
    answer: '홈페이지 행사 섹션과 게시판 공지/행사 탭에서 가장 먼저 확인할 수 있게 연결했습니다.',
  },
  {
    question: '연구실 정보는 어디서 찾아볼 수 있나요?',
    answer: '게시판의 연구실 탭과 향후 로드맵 페이지에서 연구 트랙 기준으로 확장할 예정입니다.',
  },
];

export const scheduleItems = [
  { date: '6/03', title: '학생회 정기 회의', tag: '학생회' },
  { date: '6/08', title: '신입생 환영회', tag: '행사' },
  { date: '6/14', title: '연구실 설명회', tag: '학술' },
  { date: '6/21', title: '기말고사 간식 배부', tag: '복지' },
  { date: '6/28', title: '방학 전 전체 공지', tag: '공지' },
];

export const adminMenu = [
  { label: '과비 납부 관리', to: '/admin/payments' },
  { label: '설문조사 관리', to: '/admin/surveys' },
  { label: '이메일 일괄발송', to: '/admin/emails' },
  { label: '집행위 연락망', to: '/admin/contacts' },
];

export const adminPaymentRows = [
  { id: '1', year: '2026', semester: '봄학기', category: '전산학부', status: '납부 완료', updatedAt: '2026-03-04' },
  { id: '2', year: '2026', semester: '봄학기', category: '전산학부', status: '미납', updatedAt: '2026-03-05' },
  { id: '3', year: '2026', semester: '봄학기', category: '전산학부', status: '확인 중', updatedAt: '2026-03-06' },
];

export const adminSurveyRows = [
  { id: 'SUR-001', title: '신입생 환영회 만족도', audience: '전체 학부생', status: '응답 중', updatedAt: '2026-04-24' },
  { id: 'SUR-002', title: '간식 이벤트 피드백', audience: '참여자', status: '마감', updatedAt: '2026-04-18' },
  { id: 'SUR-003', title: '체육대회 수요조사', audience: '전체 학부생', status: '초안', updatedAt: '2026-05-08' },
];

export const adminContactRows = [
  { id: 'EXE-001', name: '조성원', role: '부학생회장', email: 'bakdonal@kaist.ac.kr', phone: '010-6215-4759', affiliation: '학부생', note: 'ID' },
  { id: 'EXE-002', name: '김민지', role: '총무국장', email: 'finance@kaist.ac.kr', phone: '010-6215-4760', affiliation: '학부생', note: 'ID' },
  { id: 'EXE-003', name: '박시우', role: '홍보국장', email: 'design@kaist.ac.kr', phone: '010-6215-4761', affiliation: '학부생', note: 'ID' },
  { id: 'EXE-004', name: '최유진', role: '행사국장', email: 'event@kaist.ac.kr', phone: '010-6215-4762', affiliation: '직장인', note: 'ID' },
  { id: 'EXE-005', name: '이도윤', role: '정책국장', email: 'policy@kaist.ac.kr', phone: '010-6215-4763', affiliation: '노예', note: 'ID' },
  { id: 'EXE-006', name: '한서윤', role: '학술국장', email: 'study@kaist.ac.kr', phone: '010-6215-4764', affiliation: '원생', note: 'ID' },
];
