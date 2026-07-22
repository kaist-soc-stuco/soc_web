import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { createApiClient } from "@soc/api-client";
import type { PublicSiteContentRecord, SiteContentKey } from "@soc/contracts";

import { useLanguage, type Language } from "@/hooks/use-language";
import { resolveApiBaseUrl } from "@/lib/api-base-url";
import { resolveLocalizedSiteContentValue } from "@/lib/site-content-value";

export interface SiteContentDefinition {
  group: "home" | "about" | "footer";
  helpKo: string;
  key: SiteContentKey;
  labelKo: string;
  multiline?: boolean;
  valueEn: string;
  valueKo: string;
}

export const SITE_CONTENT_DEFINITIONS: readonly SiteContentDefinition[] = [
  {
    group: "home",
    helpKo: "홈 첫 화면의 가장 큰 제목입니다.",
    key: "home.hero.title",
    labelKo: "히어로 제목",
    multiline: true,
    valueKo: "KAIST\nSchool of Computing",
    valueEn: "KAIST\nSchool of Computing",
  },
  {
    group: "home",
    helpKo: "제목 아래에서 학생회의 역할을 설명합니다.",
    key: "home.hero.description",
    labelKo: "히어로 설명",
    multiline: true,
    valueKo: "학생들의 목소리를 대변하고,\n더 나은 학업 및 문화 환경을 만들어갑니다.",
    valueEn: "Representing student voices\nand building a better academic community.",
  },
  {
    group: "home",
    helpKo: "SOC 소개 페이지로 이동하는 버튼 문구입니다.",
    key: "home.hero.cta",
    labelKo: "히어로 버튼",
    valueKo: "집행위원회 소개 보기",
    valueEn: "Meet the Council",
  },
  {
    group: "about",
    helpKo: "소개 페이지 상단의 짧은 설명입니다.",
    key: "about.hero.description",
    labelKo: "소개 페이지 설명",
    multiline: true,
    valueKo: "전산학부 학생들의 목소리를 대변하고, 더 나은 학업 및 문화 환경을 만들어갑니다.",
    valueEn: "We represent the voices of School of Computing students and build a better academic and cultural environment.",
  },
  {
    group: "about",
    helpKo: "소개 탭의 본문 제목입니다.",
    key: "about.intro.title",
    labelKo: "SOC 소개 제목",
    valueKo: "KAIST 전산학부 집행위원회 'SOC'",
    valueEn: "KAIST School of Computing Student Council 'SOC'",
  },
  {
    group: "about",
    helpKo: "SOC의 역할과 운영 목적을 설명하는 본문입니다.",
    key: "about.intro.body",
    labelKo: "SOC 소개 본문",
    multiline: true,
    valueKo: "SOC(School of Computing Student Council)는 KAIST 전산학부 학부생들을 대표하는 학생자치기구입니다. 전산학부 학생들의 권익을 보호하고 학업, 진로, 문화 교류 등 다방면에서 유익하고 즐거운 대학 생활을 지원하기 위해 다양한 사업을 기획 및 집행하고 있습니다.",
    valueEn: "SOC is the student self-governing body representing undergraduate students of the School of Computing at KAIST. We protect students' rights and plan and run programs that support academic life, career development, cultural exchange, and a stronger student community.",
  },
  {
    group: "about",
    helpKo: "로드맵 페이지 상단 제목입니다.",
    key: "about.roadmap.title",
    labelKo: "로드맵 제목",
    valueKo: "전산학부 생활 로드맵",
    valueEn: "School of Computing Journey Roadmap",
  },
  {
    group: "about",
    helpKo: "로드맵의 성격을 설명하는 상단 문구입니다.",
    key: "about.roadmap.description",
    labelKo: "로드맵 설명",
    multiline: true,
    valueKo: "수업 이수만이 아니라 프로젝트, 연구, 커뮤니티와 진로 탐색을 함께 계획하는 참고 가이드입니다.",
    valueEn: "A reference guide for planning coursework alongside projects, research, community, and career exploration.",
  },
  {
    group: "footer",
    helpKo: "사이트 하단에 표시하는 운영 주체 문구입니다.",
    key: "footer.description",
    labelKo: "푸터 설명",
    multiline: true,
    valueKo: "SOC · KAIST 전산학부 학생회",
    valueEn: "SOC · KAIST School of Computing Student Council",
  },
  {
    group: "footer",
    helpKo: "사이트 하단의 이메일 문의 링크 문구입니다.",
    key: "footer.contact",
    labelKo: "문의 링크",
    valueKo: "문의",
    valueEn: "Contact",
  },
] as const;

export const SITE_CONTENT_QUERY_KEY = ["site-content"] as const;

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
