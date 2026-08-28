import { sanitizeArticleHtml } from "../board/article-html-sanitizer";

/**
 * Survey metadata uses the same rich-text contract as board content.
 * Empty Tiptap paragraphs are normalized to null so an untouched editor does
 * not become a visible description or count as a content mutation.
 */
export function sanitizeSurveyRichText(
  value: string | null | undefined,
): string | null {
  if (value === null || value === undefined) return null;

  const sanitized = sanitizeArticleHtml(value).trim();
  if (!sanitized || !/<[a-z][\s\S]*>/i.test(sanitized)) {
    return sanitized || null;
  }

  const textOnly = sanitized
    .replace(/<br\s*\/?>(\s*)/gi, " ")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/gi, " ")
    .trim();

  return textOnly || /<img\b/i.test(sanitized) ? sanitized : null;
}
