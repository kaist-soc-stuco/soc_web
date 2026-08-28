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
    valueKo: "학생들의 목소리를 대변하고,\n더 나은 학업 및 문화 환경을 만들어갑니다.",
    valueEn: "Representing student voices\nand building a better academic community.",
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
    key: "about.hero.description",
    labelKo: "소개 페이지 설명",
    multiline: true,
    valueKo: "전산학부 학생들의 목소리를 대변하고, 더 나은 학업 및 문화 환경을 만들어갑니다.",
    valueEn: "We represent the voices of School of Computing students and build a better academic and cultural environment.",
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
    valueKo: "KAIST 전산학부 학부생을 대표하는 학생자치기구 집행위원회입니다. 전산학부 학생들의 권익을 보호하고 학업, 진로, 문화 교류 등 다방면에서 유익하고 즐거운 대학 생활을 지원하기 위해 다양한 사업을 기획 및 집행하고 있습니다.",
    valueEn: "KAIST SoC Student Council is the student self-governing body representing undergraduate students of the School of Computing. We protect students' rights and plan and run programs that support academic life, career development, cultural exchange, and a stronger student community.",
  },
  {
    group: "about",
    key: "about.roadmap.title",
    labelKo: "로드맵 제목",
    valueKo: "전산학부 로드맵",
    valueEn: "School of Computing Journey Roadmap",
  },
  {
    group: "about",
    key: "about.roadmap.description",
    labelKo: "로드맵 설명",
    multiline: true,
    valueKo: "수업 이수만이 아니라 프로젝트, 연구, 커뮤니티와 진로 탐색을 함께 계획하는 참고 가이드입니다.",
    valueEn: "A reference guide for planning coursework alongside projects, research, community, and career exploration.",
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
