import type { PublicSiteContentRecord, SiteContentKey } from "@soc/contracts";

import type { Language } from "@/hooks/use-language";

interface LocalizedFallback {
  valueEn: string;
  valueKo: string;
}

export function resolveLocalizedSiteContentValue(
  records: readonly PublicSiteContentRecord[] | undefined,
  key: SiteContentKey,
  lang: Language,
  fallback: LocalizedFallback,
) {
  const record = records?.find((item) => item.key === key);
  if (record) {
    return lang === "ko" ? record.valueKo : record.valueEn;
  }

  return lang === "ko" ? fallback.valueKo : fallback.valueEn;
}
