import { beforeEach, describe, expect, it } from 'vitest';

import { setLocale } from '@/lib/locale-store';
import { catalog } from '@/lib/i18n/catalog';
import { surfaceCatalogComplete, surfaceCatalogEnglishValues, surfaceCatalogKeys, uiText } from '@/lib/i18n/surface-catalog';

describe('complete first-party surface catalog', () => {
  beforeEach(() => setLocale('ko'));

  it('contains non-empty Korean and English entries for every extracted surface key', () => {
    expect(surfaceCatalogKeys.length).toBeGreaterThan(500);
    expect(surfaceCatalogComplete()).toBe(true);
  });

  it('contains no English placeholders or leaked Korean copy', () => {
    const englishValues = [...surfaceCatalogEnglishValues(), ...Object.values(catalog.en.mypage)];
    expect(englishValues.some((value) => /translation unavailable/iu.test(value))).toBe(false);
    expect(englishValues.some((value) => /[가-힣]/u.test(value))).toBe(false);
  });

  it('renders representative public, error, and admin chrome in English', () => {
    setLocale('en');
    expect(uiText('components.organisms.notice-board.4303086e18')).toBe('Board preview');
    expect(uiText('components.organisms.app-error-boundary.5dbecb3a6a')).toBe('Could not display the page.');
    expect(uiText('pages.admin-dashboard-page.04c1f9416a')).toBe('Admin Center');
  });
});
