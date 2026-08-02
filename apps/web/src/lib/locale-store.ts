import { useSyncExternalStore } from 'react';
import type { ContentLocale } from '@soc/contracts';

const STORAGE_KEY = 'soc.locale';
const listeners = new Set<() => void>();

const storedLocale = (): ContentLocale => {
  if (typeof window === 'undefined') return 'ko';
  return window.localStorage.getItem(STORAGE_KEY) === 'en' ? 'en' : 'ko';
};

let locale: ContentLocale = storedLocale();
let generation = 0;

const metadata = {
  ko: {
    title: 'KAIST 전산학부 학생사회',
    description: 'KAIST 전산학부 학생사회의 행사, 게시판, 설문과 학생 지원 정보를 확인하세요.',
    openGraphLocale: 'ko_KR',
  },
  en: {
    title: 'KAIST School of Computing Student Council',
    description: 'Events, boards, surveys, and student support from the KAIST School of Computing Student Council.',
    openGraphLocale: 'en_US',
  },
} as const satisfies Record<ContentLocale, { title: string; description: string; openGraphLocale: string }>;

function applyDocumentLocale(value: ContentLocale) {
  if (typeof document === 'undefined') return;
  const selected = metadata[value];
  document.documentElement.lang = value;
  document.title = selected.title;
  const setContent = (selector: string, content: string) => {
    const element = document.querySelector<HTMLMetaElement>(selector);
    if (element) element.content = content;
  };
  setContent('meta[name="description"]', selected.description);
  setContent('meta[property="og:locale"]', selected.openGraphLocale);
  setContent('meta[property="og:title"]', selected.title);
  setContent('meta[property="og:description"]', selected.description);
}

applyDocumentLocale(locale);

export function getLocale(): ContentLocale {
  return locale;
}
export function getLocaleGeneration(): number {
  return generation;
}

export function setLocale(value: ContentLocale) {
  if (locale === value) return;
  locale = value;
  generation += 1;
  if (typeof window !== 'undefined') window.localStorage.setItem(STORAGE_KEY, value);
  applyDocumentLocale(value);
  listeners.forEach((listener) => listener());
}

export function subscribeLocale(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useLocale(): readonly [ContentLocale, (value: ContentLocale) => void] {
  return [useSyncExternalStore(subscribeLocale, getLocale, () => 'ko'), setLocale] as const;
}
