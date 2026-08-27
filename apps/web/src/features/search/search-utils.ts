export type AboutSearchItem = {
  id: string;
  titleKo: string;
  titleEn: string;
  descriptionKo: string;
  descriptionEn: string;
  href: string;
  keywords: string[];
};

export type SearchFilter = "all" | "board" | "event" | "survey";

export const ABOUT_ITEMS: AboutSearchItem[] = [
  {
    id: "intro",
    titleKo: "집행위원회 소개",
    titleEn: "About",
    descriptionKo: "전산학부 학생회 SOC의 역할과 주요 활동을 확인합니다.",
    descriptionEn: "Learn what SOC does for School of Computing students.",
    href: "/about#intro",
    keywords: ["소개", "학생회", "집행위원회", "SOC", "KAIST", "전산학부", "overview", "student council"],
  },
  {
    id: "work",
    titleKo: "주요 사업",
    titleEn: "What SOC does",
    descriptionKo: "학생 의견, 복지, 학술·진로, 행사·설문과 공약 이행 현황을 확인합니다.",
    descriptionEn: "Explore SOC programs and pledge progress.",
    href: "/about#work",
    keywords: ["주요 사업", "하는 일", "활동", "공약", "복지", "행사", "what we do", "pledges"],
  },
  {
    id: "people",
    titleKo: "조직도",
    titleEn: "Organization & People",
    descriptionKo: "전산학부 학생회 조직도를 확인합니다.",
    descriptionEn: "View the School of Computing student council organization chart.",
    href: "/about#people",
    keywords: ["조직도", "조직", "집행부", "organization", "council"],
  },
];

const normalize = (value: string) => value.trim().toLowerCase();

export function includesQuery(
  values: Array<string | null | undefined>,
  query: string,
) {
  const normalizedQuery = normalize(query);
  return values.some((value) => normalize(value ?? "").includes(normalizedQuery));
}
