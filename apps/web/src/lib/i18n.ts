export type Language = "ko" | "en";

export const LANGUAGE_STORAGE_KEY = "lang";

export function isLanguage(value: unknown): value is Language {
  return value === "ko" || value === "en";
}

export function resolveInitialLanguage({
  navigatorLanguages = [],
  storedLanguage,
}: {
  navigatorLanguages?: readonly string[];
  storedLanguage?: string | null;
}): Language {
  if (isLanguage(storedLanguage)) return storedLanguage;

  for (const language of navigatorLanguages) {
    const normalized = language.toLowerCase();
    if (normalized.startsWith("ko")) return "ko";
    if (normalized.startsWith("en")) return "en";
  }

  return "en";
}

export function getLocalizedText(
  lang: Language | string,
  korean: string | null | undefined,
  english: string | null | undefined,
) {
  if (lang === "ko") return korean?.trim() || english?.trim() || "";
  return english?.trim() || korean?.trim() || "";
}
