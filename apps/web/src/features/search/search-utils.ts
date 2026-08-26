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
    titleEn: "About SOC",
    descriptionKo: "전산학부 학생회 SOC의 역할과 주요 활동을 확인합니다.",
    descriptionEn: "Learn what SOC does for School of Computing students.",
    href: "/about#intro",
    keywords: ["소개", "학생회", "집행위원회", "SOC", "KAIST", "전산학부", "overview", "student council"],
  },
  {
    id: "history",
    titleKo: "당해 학생회",
    titleEn: "Current Council",
    descriptionKo: "현재 학생회와 주요 활동을 확인합니다.",
    descriptionEn: "Learn about the current council and its work.",
    href: "/about#history",
    keywords: ["당해 학생회", "활동", "current council", "student council"],
  },
  {
    id: "org",
    titleKo: "조직도",
    titleEn: "Organization Chart",
    descriptionKo: "학생회 조직 구성과 각 팀의 역할을 확인합니다.",
    descriptionEn: "View the organization structure and team roles.",
    href: "/about#org",
    keywords: ["조직도", "조직", "팀", "부서", "organization", "org chart"],
  },
  {
    id: "members",
    titleKo: "구성원",
    titleEn: "Members",
    descriptionKo: "현재 집행위원회 구성원과 연락 정보를 확인합니다.",
    descriptionEn: "Find current members and contact information.",
    href: "/about#members",
    keywords: ["구성원", "연락처", "집행부", "위원", "members", "contact"],
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
