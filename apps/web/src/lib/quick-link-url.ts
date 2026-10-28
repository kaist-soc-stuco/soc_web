export function resolveQuickLinkUrl(value: string): string | null {
  const input = value.trim();
  if (!input || /[\s\\\u0000-\u001f\u007f]/.test(input) || input.startsWith("//")) return null;
  try {
    if (!/^https?:\/\//i.test(input)) return null;
    const url = new URL(input);
    return ["http:", "https:"].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}
