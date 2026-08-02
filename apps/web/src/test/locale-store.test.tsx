import '@testing-library/jest-dom/vitest';

import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('global locale store', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.lang = '';
    document.head.innerHTML = '<meta name="description" content=""><meta property="og:locale" content=""><meta property="og:title" content=""><meta property="og:description" content="">';
    vi.resetModules();
  });

  it('persists one global selection and updates document metadata', async () => {
    const store = await import('@/lib/locale-store');
    const first = renderHook(() => store.useLocale());
    const second = renderHook(() => store.useLocale());

    act(() => first.result.current[1]('en'));

    expect(second.result.current[0]).toBe('en');
    expect(localStorage.getItem('soc.locale')).toBe('en');
    expect(document.documentElement).toHaveAttribute('lang', 'en');
    expect(document.title).toBe('KAIST School of Computing Student Council');
    expect(document.querySelector('meta[name="description"]')).toHaveAttribute('content', 'Events, boards, surveys, and student support from the KAIST School of Computing Student Council.');
    expect(document.querySelector('meta[property="og:locale"]')).toHaveAttribute('content', 'en_US');
    expect(document.querySelector('meta[property="og:title"]')).toHaveAttribute('content', 'KAIST School of Computing Student Council');
    expect(document.querySelector('meta[property="og:description"]')).toHaveAttribute('content', 'Events, boards, surveys, and student support from the KAIST School of Computing Student Council.');
  });

  it('restores a persisted English selection on initialization', async () => {
    localStorage.setItem('soc.locale', 'en');
    const store = await import('@/lib/locale-store');
    expect(store.getLocale()).toBe('en');
    expect(document.documentElement).toHaveAttribute('lang', 'en');
  });
});
