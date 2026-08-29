import {
  normalizeRoadmapCourseCode,
  type RoadmapCourseCategory,
} from "@soc/contracts";

type ReferenceCourse = {
  courseCode: string;
  legacyCourseCode: string | null;
  nameKo: string;
  nameEn: string;
  category: RoadmapCourseCategory;
  credits: string;
  semesters: string;
  trackIds: string[];
  ai: boolean;
};

type CourseTuple = [
  code: string,
  nameKo: string,
  nameEn: string,
  semesters: string,
  credits: string,
  category: RoadmapCourseCategory,
  trackIds?: string[],
  ai?: boolean,
];

const COURSE_ROWS: CourseTuple[] = [
  ["CS101", "프로그래밍 기초", "Programming Basics", "S/F", "2:3:2(0)", "basic-required"],
  ["CS109", "프로그래밍 실습", "Programming Practice", "S/F", "2:3:3(0)", "basic-elective"],
  ["CS10003", "인공지능 기초", "AI Fundamentals", "S/F", "3:0:3(0)", "basic-elective", ["ai"]],
  ["MAS110", "데이터과학을 위한 선형대수학", "Linear Algebra for Data Science", "S/F", "3:1:3(0)", "basic-required"],
  ["MAS109", "선형대수학개론", "Introduction to Linear Algebra", "S/F", "3:1:3(0)", "basic-elective"],
  ["CS204", "이산구조", "Discrete Mathematics", "S/F", "3:0:3(0)", "major-required", ["theory", "visual"]],
  ["CS206", "데이터구조", "Data Structures", "S/F", "3:0:3(0)", "major-required", ["data", "theory"]],
  ["CS300", "알고리즘 개론", "Introduction to Algorithms", "S/F", "3:0:3(0)", "major-required", ["theory"]],
  ["CS311", "전산기조직", "Computer Organization", "S/F", "3:0:3(0)", "major-required", ["systems"]],
  ["CS320", "프로그래밍 언어", "Programming Languages", "S/F", "3:0:3(0)", "major-required", ["theory"]],
  ["CS330", "운영체제 및 실험", "Operating Systems and Laboratory", "S/F", "3:3:4(0)", "major-required", ["systems", "secure"]],
  ["CS230", "시스템 프로그래밍", "System Programming", "S/F", "3:0:3(0)", "major-elective", ["systems", "secure"]],
  ["CS341", "전산망개론", "Introduction to Computer Networks", "S/F", "3:3:4(0)", "major-elective", ["systems", "secure"]],
  ["CS361", "데이터 사이언스 개론", "Introduction to Data Science", "S", "3:0:3(0)", "major-elective", ["data"]],
  ["CS360", "데이터베이스 개론", "Introduction to Databases", "S/F", "3:0:3(0)", "major-elective", ["data", "social"]],
  ["CS350", "소프트웨어공학개론", "Introduction to Software Engineering", "S/F", "3:0:3(0)", "major-elective", ["software"]],
  ["CS453", "소프트웨어 테스팅 자동화 기법", "Automated Software Testing", "S", "3:0:3(0)", "major-elective", ["software"]],
  ["CS454", "인공 지능 기반 소프트웨어 공학", "AI-based Software Engineering", "S", "3:0:3(0)", "major-elective", ["software"], true],
  ["CS457", "스마트환경을 위한 요구공학", "Requirements Engineering for Smart Environments", "S", "3:0:3(0)", "major-elective", ["software"]],
  ["CS211", "디지털시스템 및 실험", "Digital Systems and Laboratory", "S", "3:4:4(0)", "major-required", ["systems"]],
  ["CS310", "내장형 컴퓨터 시스템", "Embedded Computer Systems", "F", "3:3:4(0)", "major-elective", ["systems"]],
  ["CS422", "계산이론", "Theory of Computation", "S/F", "3:0:3(0)", "major-elective", ["systems"]],
  ["CS443", "분산 알고리즘 및 시스템", "Distributed Algorithms and Systems", "F", "3:0:3(0)", "major-elective", ["systems", "theory"]],
  ["CS376", "기계학습", "Machine Learning", "S/F", "3:0:3(0)", "major-elective", ["visual", "ai"], true],
  ["CS377", "강화학습 개론", "Introduction to Reinforcement Learning", "S/F", "3:0:3(0)", "major-elective", ["ai"]],
  ["CS482", "대화형 컴퓨터그래픽스", "Interactive Computer Graphics", "S/F", "3:2:3(0)", "major-elective", ["visual", "interactive"]],
  ["CS485", "컴퓨터비전을 위한 기계학습", "Machine Learning for Computer Vision", "F", "3:0:3(0)", "major-elective", ["visual"]],
  ["CS380", "컴퓨터그래픽스 개론", "Introduction to Computer Graphics", "S", "3:3:4(0)", "major-elective", ["visual", "interactive"]],
  ["CS484", "컴퓨터비전개론", "Introduction to Computer Vision", "F", "3:0:3(0)", "major-elective", ["visual", "ai"], true],
  ["CS402", "전산논리학 개론", "Introduction to Logic in Computer Science", "S/F", "3:0:3(0)", "major-elective", ["theory"]],
  ["CS424", "프로그램 논증", "Program Verification", "S/F", "3:0:3(0)", "major-elective", ["theory"]],
  ["CS202", "문제해결기법", "Problem Solving", "S/F", "2:3:3(0)", "major-elective", ["theory"]],
  ["CS322", "형식언어 및 오토마타", "Formal Languages and Automata", "F", "3:0:3(0)", "major-elective", ["theory"]],
  ["CS431", "동시성 프로그래밍", "Concurrent Programming", "S/F", "3:0:3(0)", "major-elective", ["theory"]],
  ["CS458", "소프트웨어 소스 코드 기반 동적 분석", "Dynamic Analysis of Software Source Code", "S", "3:0:3(0)", "major-elective", ["theory"]],
  ["CS481", "데이터 시각화", "Data Visualization", "F", "3:0:3(0)", "major-elective", ["theory"]],
  ["CS459", "서비스 컴퓨팅 개론", "Introduction to Service Computing", "F", "3:0:3(0)", "major-elective", ["theory"]],
  ["CS220", "프로그래밍의 이해", "Understanding Programming", "S/F", "3:0:3(0)", "major-elective", ["theory", "secure"]],
  ["CS370", "심볼릭 프로그래밍", "Symbolic Programming", "S", "2:3:3(0)", "major-elective", ["theory"]],
  ["CS477", "지능로봇공학 개론", "Introduction to Intelligent Robotics", "S", "3:0:3(0)", "major-elective", ["theory"]],
  ["CS479", "3차원 데이터를 위한 기계 학습", "Machine Learning for 3D Data", "F", "3:0:3(0)", "major-elective", ["theory", "ai"]],
  ["CS475", "자연언어처리를 위한 기계학습", "Machine Learning for Natural Language Processing", "F", "3:0:3(0)", "major-elective", ["theory"]],
  ["CS420", "컴파일러 설계", "Compiler Design", "S", "3:0:3(0)", "major-elective", ["secure"]],
  ["CS447", "웹 보안 공격 실습", "Web Security Attack Lab", "S", "2:3:3(0)", "major-elective", ["secure"]],
  ["CS348", "정보보호개론", "Introduction to Information Security", "S", "3:0:3(0)", "major-elective", ["secure"]],
  ["CS442", "모바일 컴퓨팅과 응용", "Mobile Computing and Applications", "S", "3:0:3(0)", "major-elective", ["social", "interactive"]],
  ["CS374", "인간-컴퓨터 상호작용 개론", "Introduction to Human-Computer Interaction", "S/F", "3:0:3(0)", "major-elective", ["social", "interactive"]],
  ["CS473", "소셜 컴퓨팅 개론", "Introduction to Social Computing", "F", "3:0:3(0)", "major-elective", ["social", "interactive"]],
  ["CS372", "파이썬을 통한 자연언어처리", "Natural Language Processing with Python", "S/F", "3:0:3(0)", "major-elective", ["social", "ai"], true],
  ["CS470", "인공지능개론", "Introduction to Artificial Intelligence", "F", "3:0:3(0)", "major-elective", ["social", "ai"], true],
  ["CS489", "컴퓨터 윤리와 사회문제", "Computer Ethics and Social Issues", "F", "3:0:3(0)", "major-elective", ["social"]],
  ["CS270", "지능 로봇 설계 및 프로그래밍", "Intelligent Robot Design and Programming", "S", "2:3:3(0)", "major-elective", ["ai", "interactive"], true],
  ["CS371", "딥러닝 개론", "Introduction to Deep Learning", "F", "3:0:3(0)", "major-elective", ["ai"]],
  ["CS474", "텍스트마이닝", "Text Mining", "F", "3:0:3(0)", "major-elective", ["ai"], true],
  ["CS411", "인공지능을 위한 시스템", "Systems for Artificial Intelligence", "S/F", "3:0:3(0)", "major-elective", ["ai"]],
  ["CS471", "그래프 기계학습 및 마이닝", "Graph Machine Learning and Mining", "S", "3:0:3(0)", "major-elective", ["ai"]],
  ["CS423", "확률적 프로그래밍", "Probabilistic Programming", "S", "3:0:3(0)", "major-elective", ["ai"], true],
  ["CS486", "웨어러블 사용자 인터페이스", "Wearable User Interfaces", "S", "3:0:3(0)", "major-elective", ["interactive"]],
  ["CS30708", "생성모델 개론", "Introduction to Generative Models", "S/F", "3:0:3(0)", "major-elective", ["ai"]],
  ["CS40710", "돌봄 및 사회적 약자를 위한 AI 및 컴퓨팅", "AI and Computing for Care and Underserved Communities", "S/F", "3:0:3(0)", "major-elective", ["ai", "social"]],
  ["CS40711", "경영을 위한 인공지능 기초", "AI Fundamentals for Business", "S/F", "3:0:3(0)", "major-elective", ["ai", "social"]],
  ["CS408", "전산학 프로젝트", "Computer Science Project", "S/F", "1:6:3(0)", "major-elective", ["software"]],
  ["CS492", "전산학특강", "Special Topics in Computer Science", "S/F", "3:0:3(0)", "major-elective"],
  ["CS494", "전산학특강 II", "Special Topics in Computer Science II", "S/F", "2:0:2(0)", "major-elective", ["theory"]],
  ["CS496", "세미나", "Seminar", "S/F", "1:0:1(0)", "major-elective"],
];

export const ROADMAP_REFERENCE_COURSES: ReferenceCourse[] = COURSE_ROWS.map(
  ([code, nameKo, nameEn, semesters, credits, category, trackIds = [], ai = false]) => {
    const courseCode = normalizeRoadmapCourseCode(code);
    return {
      courseCode,
      legacyCourseCode: courseCode === code ? null : code,
      nameKo,
      nameEn,
      category,
      credits,
      semesters,
      trackIds,
      ai,
    };
  },
);

export const ROADMAP_REFERENCE_RELATIONS = [
  ["CS101", "CS109"], ["CS204", "CS300"], ["CS206", "CS300"], ["CS204", "CS320"],
  ["CS211", "CS311"], ["CS230", "CS311"], ["CS230", "CS320"], ["CS230", "CS330"],
  ["CS230", "CS341"], ["CS206", "CS361"], ["CS206", "CS360"], ["CS350", "CS453"],
  ["CS350", "CS454"], ["CS350", "CS457"], ["CS211", "CS310"], ["CS300", "CS422"],
  ["CS300", "CS402"], ["CS320", "CS402"], ["CS300", "CS420"], ["CS330", "CS459"],
  ["CS230", "CS348"], ["CS220", "CS348"], ["CS374", "CS473"], ["CS372", "CS475"],
  ["CS376", "CS475"], ["CS372", "CS470"], ["CS376", "CS474"], ["CS470", "CS484"],
  ["CS300", "CS423"], ["CS320", "CS423"], ["CS376", "CS423"],
].map(([prerequisiteCourseCode, postrequisiteCourseCode]) => ({
  prerequisiteCourseCode: normalizeRoadmapCourseCode(prerequisiteCourseCode),
  postrequisiteCourseCode: normalizeRoadmapCourseCode(postrequisiteCourseCode),
}));

export { ROADMAP_REFERENCE_OFFERINGS } from "./roadmap-reference-offerings";
