export type RoadmapLanguage = "ko" | "en";

export interface LocalizedText {
  en: string;
  ko: string;
}

export type CourseCategory =
  | "basic-required"
  | "basic-elective"
  | "major-required"
  | "major-elective";

export interface RoadmapCourse {
  ai?: boolean;
  category: CourseCategory;
  code: string;
  credits: string;
  name: LocalizedText;
  semesters: string;
  tracks: string[];
}

export interface RoadmapTrack {
  color: string;
  id: string;
  label: LocalizedText;
}

export interface RoadmapRelation {
  source: string;
  target: string;
}

export interface RoadmapLane {
  courses: string[];
  id: string;
  label: LocalizedText;
  trackId?: string;
}

export const ROADMAP_SOURCE = {
  date: "2025-04-22",
  url: "https://cs.kaist.ac.kr/data/roadmap/%EC%B9%B4%EC%9D%B4%EC%8A%A4%ED%8A%B8_%EC%A0%84%EC%82%B0%ED%95%99%EB%B6%80_%ED%95%99%EB%B6%80_%EB%A1%9C%EB%93%9C%EB%A7%B5_%28%ED%95%99%EC%82%AC%EA%B3%BC%EC%A0%95%EC%9A%A9.%29_.pdf",
} as const;

export const ROADMAP_TRACKS: RoadmapTrack[] = [
  { id: "data", label: { ko: "데이터 과학", en: "Data Science" }, color: "#dc4f55" },
  { id: "systems", label: { ko: "시스템·네트워크", en: "Systems & Networks" }, color: "#dc792f" },
  { id: "theory", label: { ko: "전산이론", en: "Theory" }, color: "#dca817" },
  { id: "software", label: { ko: "소프트웨어 디자인", en: "Software Design" }, color: "#78ad45" },
  { id: "secure", label: { ko: "시큐어 컴퓨팅", en: "Secure Computing" }, color: "#24282d" },
  { id: "visual", label: { ko: "비주얼 컴퓨팅", en: "Visual Computing" }, color: "#62974f" },
  { id: "ai", label: { ko: "인공지능·정보서비스", en: "AI & Information Services" }, color: "#197ebc" },
  { id: "social", label: { ko: "소셜 컴퓨팅", en: "Social Computing" }, color: "#244f87" },
  { id: "interactive", label: { ko: "인터랙티브 컴퓨팅", en: "Interactive Computing" }, color: "#7950a5" },
];

const course = (
  code: string,
  ko: string,
  en: string,
  semesters: string,
  credits: string,
  category: CourseCategory,
  tracks: string[] = [],
  ai = false,
): RoadmapCourse => ({ code, name: { ko, en }, semesters, credits, category, tracks, ai });

export const ROADMAP_COURSES: RoadmapCourse[] = [
  course("CS101", "프로그래밍 기초", "Programming Basics", "S/F", "2:3:2(0)", "basic-required"),
  course("CS109", "프로그래밍 실습", "Programming Practice", "S/F", "2:3:3(0)", "basic-elective"),
  course("CS10003", "인공지능 기초", "AI Fundamentals", "S/F", "3:0:3(0)", "basic-elective", ["ai"]),
  course("MAS110", "데이터과학을 위한 선형대수학", "Linear Algebra for Data Science", "S/F", "3:1:3(0)", "basic-required"),
  course("MAS109", "선형대수학개론", "Introduction to Linear Algebra", "S/F", "3:1:3(0)", "basic-elective"),
  course("CS204", "이산구조", "Discrete Mathematics", "S/F", "3:0:3(0)", "major-required", ["theory", "visual"]),
  course("CS206", "데이터구조", "Data Structures", "S/F", "3:0:3(0)", "major-required", ["data", "theory"]),
  course("CS300", "알고리즘 개론", "Introduction to Algorithms", "S/F", "3:0:3(0)", "major-required", ["theory"]),
  course("CS311", "전산기조직", "Computer Organization", "S/F", "3:0:3(0)", "major-required", ["systems"]),
  course("CS320", "프로그래밍 언어", "Programming Languages", "S/F", "3:0:3(0)", "major-required", ["theory"]),
  course("CS330", "운영체제 및 실험", "Operating Systems and Laboratory", "S/F", "3:3:4(0)", "major-required", ["systems", "secure"]),
  course("CS230", "시스템 프로그래밍", "System Programming", "S/F", "3:0:3(0)", "major-elective", ["systems", "secure"]),
  course("CS341", "전산망개론", "Introduction to Computer Networks", "S/F", "3:3:4(0)", "major-elective", ["systems", "secure"]),

  course("CS361", "데이터 사이언스 개론", "Introduction to Data Science", "S", "3:0:3(0)", "major-elective", ["data"]),
  course("CS360", "데이터베이스 개론", "Introduction to Databases", "S/F", "3:0:3(0)", "major-elective", ["data", "social"]),
  course("CS350", "소프트웨어공학개론", "Introduction to Software Engineering", "S/F", "3:0:3(0)", "major-elective", ["software"]),
  course("CS453", "소프트웨어 테스팅 자동화 기법", "Automated Software Testing", "S", "3:0:3(0)", "major-elective", ["software"]),
  course("CS454", "인공 지능 기반 소프트웨어 공학", "AI-based Software Engineering", "S", "3:0:3(0)", "major-elective", ["software"], true),
  course("CS457", "스마트환경을 위한 요구공학", "Requirements Engineering for Smart Environments", "S", "3:0:3(0)", "major-elective", ["software"]),
  course("CS211", "디지털시스템 및 실험", "Digital Systems and Laboratory", "S", "3:4:4(0)", "major-required", ["systems"]),
  course("CS310", "내장형 컴퓨터 시스템", "Embedded Computer Systems", "F", "3:3:4(0)", "major-elective", ["systems"]),
  course("CS422", "계산이론", "Theory of Computation", "S/F", "3:0:3(0)", "major-elective", ["systems"]),
  course("CS443", "분산 알고리즘 및 시스템", "Distributed Algorithms and Systems", "F", "3:0:3(0)", "major-elective", ["systems", "theory"]),
  course("CS376", "기계학습", "Machine Learning", "S/F", "3:0:3(0)", "major-elective", ["visual", "ai"], true),
  course("CS377", "강화학습 개론", "Introduction to Reinforcement Learning", "S/F", "3:0:3(0)", "major-elective", ["ai"]),
  course("CS482", "대화형 컴퓨터그래픽스", "Interactive Computer Graphics", "S/F", "3:2:3(0)", "major-elective", ["visual", "interactive"]),
  course("CS485", "컴퓨터비전을 위한 기계학습", "Machine Learning for Computer Vision", "F", "3:0:3(0)", "major-elective", ["visual"]),
  course("CS380", "컴퓨터그래픽스 개론", "Introduction to Computer Graphics", "S", "3:3:4(0)", "major-elective", ["visual", "interactive"]),
  course("CS484", "컴퓨터비전개론", "Introduction to Computer Vision", "F", "3:0:3(0)", "major-elective", ["visual", "ai"], true),
  course("CS402", "전산논리학 개론", "Introduction to Logic in Computer Science", "S/F", "3:0:3(0)", "major-elective", ["theory"]),
  course("CS424", "프로그램 논증", "Program Verification", "S/F", "3:0:3(0)", "major-elective", ["theory"]),
  course("CS202", "문제해결기법", "Problem Solving", "S/F", "2:3:3(0)", "major-elective", ["theory"]),
  course("CS322", "형식언어 및 오토마타", "Formal Languages and Automata", "F", "3:0:3(0)", "major-elective", ["theory"]),
  course("CS431", "동시성 프로그래밍", "Concurrent Programming", "S/F", "3:0:3(0)", "major-elective", ["theory"]),
  course("CS458", "소프트웨어 소스 코드 기반 동적 분석", "Dynamic Analysis of Software Source Code", "S", "3:0:3(0)", "major-elective", ["theory"]),
  course("CS481", "데이터 시각화", "Data Visualization", "F", "3:0:3(0)", "major-elective", ["theory"]),
  course("CS459", "서비스 컴퓨팅 개론", "Introduction to Service Computing", "F", "3:0:3(0)", "major-elective", ["theory"]),
  course("CS220", "프로그래밍의 이해", "Understanding Programming", "S/F", "3:0:3(0)", "major-elective", ["theory", "secure"]),
  course("CS370", "심볼릭 프로그래밍", "Symbolic Programming", "S", "2:3:3(0)", "major-elective", ["theory"]),
  course("CS477", "지능로봇공학 개론", "Introduction to Intelligent Robotics", "S", "3:0:3(0)", "major-elective", ["theory"]),
  course("CS479", "3차원 데이터를 위한 기계 학습", "Machine Learning for 3D Data", "F", "3:0:3(0)", "major-elective", ["theory", "ai"]),
  course("CS475", "자연언어처리를 위한 기계학습", "Machine Learning for Natural Language Processing", "F", "3:0:3(0)", "major-elective", ["theory"]),
  course("CS420", "컴파일러 설계", "Compiler Design", "S", "3:0:3(0)", "major-elective", ["secure"]),
  course("CS447", "웹 보안 공격 실습", "Web Security Attack Lab", "S", "2:3:3(0)", "major-elective", ["secure"]),
  course("CS348", "정보보호개론", "Introduction to Information Security", "S", "3:0:3(0)", "major-elective", ["secure"]),
  course("CS442", "모바일 컴퓨팅과 응용", "Mobile Computing and Applications", "S", "3:0:3(0)", "major-elective", ["social", "interactive"]),
  course("CS374", "인간-컴퓨터 상호작용 개론", "Introduction to Human-Computer Interaction", "S/F", "3:0:3(0)", "major-elective", ["social", "interactive"]),
  course("CS473", "소셜 컴퓨팅 개론", "Introduction to Social Computing", "F", "3:0:3(0)", "major-elective", ["social", "interactive"]),
  course("CS372", "파이썬을 통한 자연언어처리", "Natural Language Processing with Python", "S/F", "3:0:3(0)", "major-elective", ["social", "ai"], true),
  course("CS470", "인공지능개론", "Introduction to Artificial Intelligence", "F", "3:0:3(0)", "major-elective", ["social", "ai"], true),
  course("CS489", "컴퓨터 윤리와 사회문제", "Computer Ethics and Social Issues", "F", "3:0:3(0)", "major-elective", ["social"]),
  course("CS270", "지능 로봇 설계 및 프로그래밍", "Intelligent Robot Design and Programming", "S", "2:3:3(0)", "major-elective", ["ai", "interactive"], true),
  course("CS371", "딥러닝 개론", "Introduction to Deep Learning", "F", "3:0:3(0)", "major-elective", ["ai"]),
  course("CS474", "텍스트마이닝", "Text Mining", "F", "3:0:3(0)", "major-elective", ["ai"], true),
  course("CS411", "인공지능을 위한 시스템", "Systems for Artificial Intelligence", "S/F", "3:0:3(0)", "major-elective", ["ai"]),
  course("CS471", "그래프 기계학습 및 마이닝", "Graph Machine Learning and Mining", "S", "3:0:3(0)", "major-elective", ["ai"]),
  course("CS423", "확률적 프로그래밍", "Probabilistic Programming", "S", "3:0:3(0)", "major-elective", ["ai"], true),
  course("CS486", "웨어러블 사용자 인터페이스", "Wearable User Interfaces", "S", "3:0:3(0)", "major-elective", ["interactive"]),
  course("CS30708", "생성모델 개론", "Introduction to Generative Models", "S/F", "3:0:3(0)", "major-elective", ["ai"]),
  course("CS40710", "돌봄 및 사회적 약자를 위한 AI 및 컴퓨팅", "AI and Computing for Care and Underserved Communities", "S/F", "3:0:3(0)", "major-elective", ["ai", "social"]),
  course("CS40711", "경영을 위한 인공지능 기초", "AI Fundamentals for Business", "S/F", "3:0:3(0)", "major-elective", ["ai", "social"]),
  course("CS408", "전산학 프로젝트", "Computer Science Project", "S/F", "1:6:3(0)", "major-elective", ["software"]),
  course("CS492", "전산학특강", "Special Topics in Computer Science", "S/F", "3:0:3(0)", "major-elective"),
  course("CS494", "전산학특강 II", "Special Topics in Computer Science II", "S/F", "2:0:2(0)", "major-elective", ["theory"]),
  course("CS496", "세미나", "Seminar", "S/F", "1:0:1(0)", "major-elective"),
];

export const ROADMAP_COURSE_BY_CODE = new Map(
  ROADMAP_COURSES.map((item) => [item.code, item]),
);

export const ROADMAP_LANES: RoadmapLane[] = [
  { id: "foundation", label: { ko: "기초 과목", en: "Foundation" }, courses: ["CS101", "CS109", "CS10003", "MAS110", "MAS109"] },
  { id: "core", label: { ko: "전공 핵심", en: "Major Core" }, courses: ["CS204", "CS206", "CS300", "CS311", "CS320", "CS330", "CS230", "CS341"] },
  { id: "data", trackId: "data", label: { ko: "데이터 과학", en: "Data Science" }, courses: ["CS361", "CS360"] },
  { id: "software", trackId: "software", label: { ko: "소프트웨어 디자인", en: "Software Design" }, courses: ["CS350", "CS453", "CS454", "CS457"] },
  { id: "systems", trackId: "systems", label: { ko: "시스템·네트워크", en: "Systems & Networks" }, courses: ["CS211", "CS310", "CS422", "CS443"] },
  { id: "visual", trackId: "visual", label: { ko: "비주얼 컴퓨팅", en: "Visual Computing" }, courses: ["CS376", "CS482", "CS485", "CS380", "CS484"] },
  { id: "theory", trackId: "theory", label: { ko: "전산이론", en: "Theory" }, courses: ["CS402", "CS424", "CS202", "CS322", "CS431", "CS458", "CS481", "CS459", "CS220", "CS370", "CS443", "CS477", "CS479", "CS475", "CS494"] },
  { id: "secure", trackId: "secure", label: { ko: "시큐어 컴퓨팅", en: "Secure Computing" }, courses: ["CS420", "CS447", "CS348"] },
  { id: "social", trackId: "social", label: { ko: "소셜 컴퓨팅", en: "Social Computing" }, courses: ["CS360", "CS442", "CS374", "CS473", "CS372", "CS470", "CS489"] },
  { id: "ai", trackId: "ai", label: { ko: "인공지능·정보서비스", en: "AI & Information Services" }, courses: ["CS10003", "CS270", "CS371", "CS372", "CS376", "CS377", "CS470", "CS474", "CS484", "CS411", "CS471", "CS479", "CS423", "CS30708", "CS40710", "CS40711"] },
  { id: "interactive", trackId: "interactive", label: { ko: "인터랙티브 컴퓨팅", en: "Interactive Computing" }, courses: ["CS380", "CS486", "CS482", "CS442", "CS374", "CS473"] },
  { id: "special", label: { ko: "프로젝트·특강", en: "Projects & Special Topics" }, courses: ["CS408", "CS492", "CS494", "CS496"] },
];

export const ROADMAP_RELATIONS: RoadmapRelation[] = [
  { source: "CS101", target: "CS109" },
  { source: "CS204", target: "CS300" },
  { source: "CS206", target: "CS300" },
  { source: "CS204", target: "CS320" },
  { source: "CS211", target: "CS311" },
  { source: "CS230", target: "CS311" },
  { source: "CS230", target: "CS320" },
  { source: "CS230", target: "CS330" },
  { source: "CS230", target: "CS341" },
  { source: "CS206", target: "CS361" },
  { source: "CS206", target: "CS360" },
  { source: "CS350", target: "CS453" },
  { source: "CS350", target: "CS454" },
  { source: "CS350", target: "CS457" },
  { source: "CS211", target: "CS310" },
  { source: "CS300", target: "CS422" },
  { source: "CS300", target: "CS402" },
  { source: "CS320", target: "CS402" },
  { source: "CS300", target: "CS420" },
  { source: "CS330", target: "CS459" },
  { source: "CS230", target: "CS348" },
  { source: "CS220", target: "CS348" },
  { source: "CS374", target: "CS473" },
  { source: "CS372", target: "CS475" },
  { source: "CS376", target: "CS475" },
  { source: "CS372", target: "CS470" },
  { source: "CS376", target: "CS474" },
  { source: "CS470", target: "CS484" },
  { source: "CS300", target: "CS423" },
  { source: "CS320", target: "CS423" },
  { source: "CS376", target: "CS423" },
];

export const CATEGORY_LABELS: Record<CourseCategory, LocalizedText> = {
  "basic-required": { ko: "기초필수", en: "Basic required" },
  "basic-elective": { ko: "기초선택", en: "Basic elective" },
  "major-required": { ko: "전공필수", en: "Major required" },
  "major-elective": { ko: "전공선택", en: "Major elective" },
};
