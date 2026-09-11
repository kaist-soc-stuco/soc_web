import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { createApiClient } from "@soc/api-client";
import type {
  ContentBlockRecord,
  ContentBlockType,
  PublicSiteContentRecord,
  SiteContentKey,
} from "@soc/contracts";

import { useLanguage, type Language } from "@/hooks/use-language";
import { resolveApiBaseUrl } from "@/lib/api-base-url";
import { resolveLocalizedSiteContentValue } from "@/lib/site-content-value";

export interface SiteContentDefinition {
  group: "home" | "about" | "footer";
  key: SiteContentKey;
  labelKo: string;
  multiline?: boolean;
  valueEn: string;
  valueKo: string;
}

export const SITE_CONTENT_DEFINITIONS: readonly SiteContentDefinition[] = [
  {
    group: "home",
    key: "home.hero.title",
    labelKo: "히어로 제목",
    multiline: true,
    valueKo: "KAIST School of Computing\nStudent Council",
    valueEn: "KAIST School of Computing\nStudent Council",
  },
  {
    group: "home",
    key: "home.hero.description",
    labelKo: "히어로 설명",
    multiline: true,
    valueKo: "",
    valueEn: "",
  },
  {
    group: "home",
    key: "home.hero.cta",
    labelKo: "히어로 버튼",
    valueKo: "집행위원회 소개 보기",
    valueEn: "Meet the Council",
  },
  {
    group: "about",
    key: "about.hero.title",
    labelKo: "소개 히어로 제목",
    multiline: true,
    valueKo: "전산학부\n집행위원회",
    valueEn: "SoC Student\nCouncil",
  },
  {
    group: "about",
    key: "about.hero.description",
    labelKo: "소개 페이지 설명",
    multiline: true,
    valueKo: "전산학부 학우들을 위한 사업을 기획하고 진행하는 학생자치기구, 집행위원회입니다.",
    valueEn: "The SoC Student Council represents undergraduate students at KAIST's School of Computing.",
  },
  {
    group: "about",
    key: "about.hero.cta.events",
    labelKo: "소개 히어로 행사 버튼",
    valueKo: "행사·일정",
    valueEn: "Events & calendar",
  },
  {
    group: "about",
    key: "about.hero.cta.suggestions",
    labelKo: "소개 히어로 건의사항 버튼",
    valueKo: "건의사항",
    valueEn: "Suggestions",
  },
  {
    group: "about",
    key: "about.nav.intro",
    labelKo: "소개 목차 라벨",
    valueKo: "소개",
    valueEn: "About",
  },
  {
    group: "about",
    key: "about.nav.work",
    labelKo: "공약 목차 라벨",
    valueKo: "공약 이행 상황판",
    valueEn: "Pledge progress",
  },
  {
    group: "about",
    key: "about.nav.organization",
    labelKo: "조직도 목차 라벨",
    valueKo: "조직도",
    valueEn: "Organization chart",
  },
  {
    group: "about",
    key: "about.nav.partnership",
    labelKo: "후원 및 제휴 목차 라벨",
    valueKo: "후원 및 제휴",
    valueEn: "Partnerships",
  },
  {
    group: "about",
    key: "about.intro.eyebrow",
    labelKo: "소개 본문 상단 라벨",
    valueKo: "집행위원회 소개",
    valueEn: "ABOUT STUDENT COUNCIL",
  },
  {
    group: "about",
    key: "about.intro.title",
    labelKo: "SoC 소개 제목",
    valueKo: "KAIST 전산학부 집행위원회",
    valueEn: "KAIST SoC Student Council",
  },
  {
    group: "about",
    key: "about.intro.body",
    labelKo: "SoC 소개 본문",
    multiline: true,
    valueKo: "KAIST 전산학부 집행위원회는 학우들의 권익을 대변하고 더 나은 학업·문화 환경을 만들어가는 학생자치기구입니다. 소통 창구 운영부터 진로 세미나, 문화·복지 행사까지 학우들에게 실질적으로 필요한 일들을 고민하고 실행합니다.",
    valueEn: "The SoC Student Council represents students' interests and works to build a better academic and cultural environment. From maintaining channels for student feedback to organizing career sessions and cultural and welfare events, we focus on work that students can use in their daily lives.",
  },
  {
    group: "about",
    key: "about.work.title",
    labelKo: "주요 사업 섹션 제목",
    valueKo: "주요 사업",
    valueEn: "What we do",
  },
  {
    group: "about",
    key: "about.work.card.1.title",
    labelKo: "주요 사업 카드 1 제목",
    valueKo: "학업 · 소통",
    valueEn: "Academic communication",
  },
  {
    group: "about",
    key: "about.work.card.1.description",
    labelKo: "주요 사업 카드 1 설명",
    multiline: true,
    valueKo: "• 과목별 겹강톡 운영\n• OTL 수강후기 작성 이벤트\n• 학부 건의사항 소통 창구",
    valueEn: "• Course-specific group chats\n• OTL course-review writing event\n• Student feedback channel",
  },
  {
    group: "about",
    key: "about.work.card.2.title",
    labelKo: "주요 사업 카드 2 제목",
    valueKo: "진로 탐색 및 커리어",
    valueEn: "Career exploration",
  },
  {
    group: "about",
    key: "about.work.card.2.description",
    labelKo: "주요 사업 카드 2 설명",
    multiline: true,
    valueKo: "• IT 기업체 탐방 프로그램\n• 선배 초청 토크콘서트\n• 테크 세미나 및 기업 채용설명회\n• Humans of CS (학우 인터뷰)",
    valueEn: "• IT company tour program\n• Alumni talk concert\n• Tech seminars and company recruiting sessions\n• Humans of CS (student interviews)",
  },
  {
    group: "about",
    key: "about.work.card.3.title",
    labelKo: "주요 사업 카드 3 제목",
    valueKo: "학생 복지",
    valueEn: "Student welfare",
  },
  {
    group: "about",
    key: "about.work.card.3.description",
    labelKo: "주요 사업 카드 3 설명",
    multiline: true,
    valueKo: "• 과방(SoC Lounge) 운영\n• 시험기간 야식 및 간식\n• 학부 워크샵 & 해피아워\n• 과잠 및 학부 굿즈 제작",
    valueEn: "• SoC Lounge operation\n• Exam-period late-night snacks\n• School workshop & Happy Hour\n• Department varsity jackets and merchandise",
  },
  {
    group: "about",
    key: "about.work.card.cta",
    labelKo: "주요 사업 카드 링크 라벨",
    valueKo: "자세히 보기",
    valueEn: "Explore",
  },
  {
    group: "about",
    key: "about.pledges.title",
    labelKo: "공약 이행 상황판 제목",
    valueKo: "공약 이행 상황판",
    valueEn: "Pledge progress",
  },
  {
    group: "about",
    key: "about.organization.title",
    labelKo: "조직도 섹션 제목",
    valueKo: "조직도",
    valueEn: "Organization chart",
  },
  {
    group: "about",
    key: "about.organization.description",
    labelKo: "조직도 섹션 설명",
    multiline: true,
    valueKo: "전산학부 집행위원회를 구성하는 부서들입니다.",
    valueEn: "These are the departments that make up the SoC Student Council.",
  },
  {
    group: "about",
    key: "about.organization.reference.eyebrow",
    labelKo: "조직도 참고 자료 상단 라벨",
    valueKo: "참고 자료",
    valueEn: "REFERENCE",
  },
  {
    group: "about",
    key: "about.organization.reference.title",
    labelKo: "조직도 참고 자료 제목",
    valueKo: "전체 조직 구조",
    valueEn: "Full organization structure",
  },
  {
    group: "about",
    key: "about.partnership.title",
    labelKo: "후원 및 제휴 섹션 제목",
    valueKo: "후원 및 제휴",
    valueEn: "Partnerships",
  },
  {
    group: "about",
    key: "about.partnership.description",
    labelKo: "후원 및 제휴 섹션 설명",
    multiline: true,
    valueKo: "전산학부 학우들과 함께할 채용 설명회, 기술 세미나(Tech Talk), 행사 후원 등의 제휴를 기다립니다. 제안 내용을 보내 주시면 검토 후 회신드리겠습니다.",
    valueEn: "We welcome partnerships for recruiting sessions, technical seminars (Tech Talks), and event sponsorship with School of Computing students. Send us your proposal and we will review it and get back to you.",
  },
  {
    group: "about",
    key: "about.partnership.cta",
    labelKo: "후원 및 제휴 문의 버튼",
    valueKo: "제휴 문의",
    valueEn: "Partnership inquiry",
  },
  {
    group: "about",
    key: "about.partnership.area.1",
    labelKo: "후원 및 제휴 항목 1",
    valueKo: "행사 및 물품 후원",
    valueEn: "Event and in-kind sponsorship",
  },
  {
    group: "about",
    key: "about.partnership.area.2",
    labelKo: "후원 및 제휴 항목 2",
    valueKo: "채용 설명회 및 Tech Talk",
    valueEn: "Recruiting sessions and Tech Talks",
  },
  {
    group: "about",
    key: "about.partnership.area.3",
    labelKo: "후원 및 제휴 항목 3",
    valueKo: "산학 연계 및 공동 프로그램",
    valueEn: "Industry-academic partnerships and joint programs",
  },
  {
    group: "about",
    key: "about.roadmap.title",
    labelKo: "로드맵 제목",
    valueKo: "전산학부 로드맵",
    valueEn: "School of Computing Journey Roadmap",
  },
  {
    group: "footer",
    key: "footer.description",
    labelKo: "푸터 설명",
    multiline: true,
    valueKo: "전산학부 집행위원회",
    valueEn: "SoC Student Council",
  },
  {
    group: "footer",
    key: "footer.contact",
    labelKo: "문의 링크",
    valueKo: "문의",
    valueEn: "Contact",
  },
] as const;

export const SITE_CONTENT_QUERY_KEY = ["site-content"] as const;
export const PUBLIC_CONTENT_BLOCKS_QUERY_KEY = ["site-content", "public-blocks"] as const;

export function getSiteContentDefinition(key: SiteContentKey) {
  const definition = SITE_CONTENT_DEFINITIONS.find((item) => item.key === key);
  if (!definition) {
    throw new Error(`Unknown site content key: ${key}`);
  }
  return definition;
}

export function resolveSiteContentValue(
  records: readonly PublicSiteContentRecord[] | undefined,
  key: SiteContentKey,
  lang: Language,
) {
  const fallback = getSiteContentDefinition(key);
  return resolveLocalizedSiteContentValue(records, key, lang, fallback);
}

export function useSiteContent() {
  const apiClient = useMemo(
    () => createApiClient({ baseUrl: resolveApiBaseUrl() }),
    [],
  );

  return useQuery({
    queryKey: SITE_CONTENT_QUERY_KEY,
    queryFn: () => apiClient.getSiteContent(),
    staleTime: 5 * 60 * 1000,
  });
}

export function useLocalizedSiteContent(key: SiteContentKey) {
  const { lang } = useLanguage();
  const { data } = useSiteContent();

  return resolveSiteContentValue(data?.items, key, lang);
}

export function usePublicContentBlocks() {
  const apiClient = useMemo(
    () => createApiClient({ baseUrl: resolveApiBaseUrl() }),
    [],
  );

  return useQuery({
    queryKey: PUBLIC_CONTENT_BLOCKS_QUERY_KEY,
    queryFn: () => apiClient.listPublicContentBlocks(),
    staleTime: 60 * 1000,
  });
}

export function usePublicContentBlocksByType(type: ContentBlockType): ContentBlockRecord[] {
  const { data } = usePublicContentBlocks();
  return (data?.items ?? []).filter((block) => block.type === type);
}

export function resolveContentBlockText(
  block: ContentBlockRecord,
  lang: Language,
): { body: string | null; title: string } {
  const isEnglish = lang === "en";
  return {
    title: (isEnglish ? block.titleEn : block.titleKo).trim() || block.titleKo.trim(),
    body: ((isEnglish ? block.bodyEn : block.bodyKo) || block.bodyKo)?.trim() || null,
  };
}
