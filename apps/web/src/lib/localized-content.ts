import type { LocalizedContent } from '@soc/contracts';

const TRANSLATION_UNAVAILABLE_TEXT = '번역이 제공되지 않습니다.';

export function localizedText(content: LocalizedContent): string {
  return content.translationUnavailable || content.value === null
    ? TRANSLATION_UNAVAILABLE_TEXT
    : content.value;
}
