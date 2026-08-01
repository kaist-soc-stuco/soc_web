import { useSyncExternalStore } from 'react';
import type { ContentLocale } from '@soc/contracts';

const STORAGE_KEY = 'soc.locale';
const listeners = new Set<() => void>();

const storedLocale = (): ContentLocale => {
  if (typeof window === 'undefined') return 'ko';
  return window.localStorage.getItem(STORAGE_KEY) === 'en' ? 'en' : 'ko';
};

let locale: ContentLocale = storedLocale();

function applyDocumentLocale(value: ContentLocale) {
  if (typeof document === 'undefined') return;
  document.documentElement.lang = value;
  document.title = value === 'ko' ? 'KAIST 전산학부 학생회' : 'KAIST School of Computing Student Council';
  const description = document.querySelector<HTMLMetaElement>('meta[name="description"]');
  if (description) description.content = value === 'ko'
    ? 'KAIST 전산학부 학생회 웹사이트'
    : 'KAIST School of Computing Student Council website';
}

applyDocumentLocale(locale);

export function getLocale(): ContentLocale {
  return locale;
}

export function setLocale(value: ContentLocale) {
  if (locale === value) return;
  locale = value;
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
