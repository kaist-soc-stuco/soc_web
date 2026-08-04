import { createRequire } from 'node:module';
import fs from 'node:fs';
const { chromium } = createRequire(new URL('../apps/web/package.json', import.meta.url))('@playwright/test');
const sourceHash = 'sha256:8b9f14f7d8408273b716000a96e1db8961a2cf5c33230b2499ed4daa166085c2';
const baseUrl = process.env.SURVEY_QA_BASE_URL ?? 'http://127.0.0.1:4199';
const L = (value) => ({ value, translationUnavailable: false });
const grants = [{ id: 'survey-manage', permission: 'SURVEY_MANAGE', scope: 'GLOBAL', scopeId: null, activatedFrom: '2026-01-01T00:00:00.000Z', expiresAt: null }];
const user = { id: 'admin-user', kaistUid: null, studentOrEmployeeKind: null, studentOrEmployeeNumber: null, nameKr: null, nameEn: null, userEmail: null, userMobile: null, majorMask: 0, feeStatus: 'UNKNOWN', privacyConsentAt: null, grants };
let mode = 'SHARED', version = 1, staleOnce = true, saved;
function survey(locale = 'ko', koreanOnly = false) {
  const ko = locale === 'ko' || koreanOnly;
  return { id: 'survey-1', revision: 1, definitionVersion: version, locale, requestedLocale: locale, effectiveContentLocale: koreanOnly ? 'ko' : locale, onlyForKoreanSpeaker: koreanOnly, title: L(ko ? '공개 설문' : 'Public survey'), description: L(ko ? '설문 설명' : 'Survey description'), state: 'DRAFT', guestAllowed: true, phoneRequired: false, feeRestriction: 'ANY', cap: null, opensAt: null, closesAt: null, editDeadlineAt: null, responseRetentionDays: 365, updatedAt: '2026-08-03T00:00:00.000Z', sections: [{ id: 'section-1', ordinal: 0, title: L(ko ? '질문' : 'Questions'), items: [
    { id: 'question-item-1', ordinal: 0, kind: 'QUESTION', question: { id: 'question-1', ordinal: 0, type: 'SINGLE_CHOICE', prompt: L(ko ? '참여하시겠습니까?' : 'Will you participate?'), helpText: null, required: true, validationRegex: null, numberMin: null, numberMax: null, dateMin: null, dateMax: null, choices: [{ id: 'choice-1', ordinal: 0, value: L(ko ? '참여' : 'Attend') }, { id: 'choice-2', ordinal: 1, value: L(ko ? '불참' : 'Decline') }] } },
    { id: 'description-1', ordinal: 1, kind: 'DESCRIPTION', body: L(ko ? '한국어 안내' : 'English guidance') },
    { id: 'image-block-1', ordinal: 2, kind: 'IMAGE_BLOCK', mode, membershipCounts: mode === 'SHARED' ? { shared: 2, ko: 0, en: 0 } : { shared: 0, ko: 2, en: 2 } },
    { id: 'question-item-2', ordinal: 3, kind: 'QUESTION', question: { id: 'question-2', ordinal: 1, type: 'SHORT_TEXT', prompt: L(ko ? '추가 의견' : 'Comments'), helpText: null, required: false, validationRegex: null, numberMin: null, numberMax: null, dateMin: null, dateMax: null, choices: [] } }
  ] }] };
}
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');
const transcript = { sourceHash, status: 'passed', commands: [`pnpm --filter @soc/web exec vite --host 127.0.0.1 --port 4199 --strictPort`, `SURVEY_QA_BASE_URL=${baseUrl} node qa-artifacts/survey-section-gen4-playwright.mjs`], assertions: {}, requests: [] };
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url()), path = url.pathname, method = route.request().method();
    transcript.requests.push(`${method} ${path}${url.search}`);
    if (path === '/api/users/me') return route.fulfill({ json: user });
    if (path === '/api/admin/surveys/survey-1') return route.fulfill({ json: survey(url.searchParams.get('locale') === 'en' ? 'en' : 'ko') });
    if (path === '/api/admin/surveys/survey-1/definition' && method === 'PUT') { saved = route.request().postDataJSON(); version++; return route.fulfill({ json: { survey: survey() } }); }
    if (path === '/api/admin/surveys/survey-1/image-blocks/image-block-1/memberships') {
      if (staleOnce && !url.searchParams.get('cursor')) { staleOnce = false; return route.fulfill({ status: 409, json: { code: 'stale_definition', message: 'stale definition', requestId: 'stale-request' } }); }
      const next = url.searchParams.get('cursor') === 'next';
      const id = next ? '33333333-3333-4333-8333-333333333333' : '22222222-2222-4222-8222-222222222222';
      return route.fulfill({ json: { items: [{ id: next ? 'membership-2' : 'membership-1', asset: { id, src: `/api/surveys/11111111-1111-4111-8111-111111111111/images/${id}`, contentType: 'image/png', byteSize: 10, width: 1, height: 1 } }], nextCursor: next ? null : 'next', membershipCount: 2, definitionVersion: version, requestedLocale: 'ko', effectiveContentLocale: 'ko' } });
    }
    if (path === '/api/admin/surveys/survey-1/image-blocks/image-block-1/mode') { mode = route.request().postDataJSON().mode; version++; return route.fulfill({ json: { definitionVersion: version, mode, membershipCounts: mode === 'SHARED' ? { shared: 2, ko: 0, en: 0 } : { shared: 0, ko: 2, en: 2 } } }); }
    if (path === '/api/surveys/survey-1') return route.fulfill({ json: { ...survey(url.searchParams.get('locale') === 'en' ? 'en' : 'ko', true), state: 'OPEN' } });
    if (path === '/api/surveys/survey-1/image-blocks/image-block-1/memberships') { const next = url.searchParams.get('cursor') === 'next'; const id = next ? '33333333-3333-4333-8333-333333333333' : '22222222-2222-4222-8222-222222222222'; return route.fulfill({ json: { items: [{ id: next ? 'm2' : 'm1', asset: { id, src: `/api/surveys/11111111-1111-4111-8111-111111111111/images/${id}`, contentType: 'image/png', byteSize: 10, width: 1, height: 1 } }], nextCursor: next ? null : 'next', membershipCount: 2, definitionVersion: version, requestedLocale: 'en', effectiveContentLocale: 'ko' } }); }
    if (/^\/api\/surveys\/11111111-1111-4111-8111-111111111111\/images\//.test(path)) return route.fulfill({ contentType: 'image/png', body: png });
    if (path === '/api/surveys/survey-1/responses/me') return route.fulfill({ json: { response: null } });
    if (path === '/api/surveys/content-relations') return route.fulfill({ json: { items: [] } });
    if (path === '/api/auth/session') return route.fulfill({ json: { authenticated: false, canUsePersistentFeatures: false, requiresConsent: false, storageMode: null } });
    return route.fulfill({ json: {} });
  });
  await page.goto(`${baseUrl}/admin/surveys/survey-1/edit`);
  await page.getByRole('heading', { name: '설문 편집' }).waitFor();
  assert(!staleOnce, 'stale membership response was not exercised');
  transcript.assertions.staleMembershipResponseHandledWithoutSurfaceFailure = true;
  await page.getByRole('button', { name: '설명 추가' }).first().click();
  const fields = page.locator('textarea[required]');
  await fields.last().fill('Boundary description EN');
  await fields.nth((await fields.count()) - 2).fill('경계 설명');
  await page.getByRole('button', { name: '정의 저장' }).click();
  await page.waitForTimeout(100);
  assert(saved && saved.sections[0].items.map((item) => item.kind).join(',') === 'DESCRIPTION,QUESTION,DESCRIPTION,IMAGE_BLOCK,QUESTION', 'mixed ordered insertion not serialized at boundary');
  assert(saved.sections[0].items.every((item) => !String(item.id).startsWith('local-')), 'client-local IDs serialized');
  transcript.assertions.orderedMixedInsertionAndStableSerialization = true;
  await page.getByLabel('한국어 사용자 전용').check();
  const descriptionInputs = page.locator('textarea');
  await descriptionInputs.first().fill('한국어만 설명');
  assert(await descriptionInputs.nth(1).inputValue() === '한국어만 설명' && await descriptionInputs.nth(1).getAttribute('readonly') !== null, 'Korean-only derived English description missing');
  transcript.assertions.koreanOnlyReadonlyMirroring = true;
  await page.getByLabel('이미지 모드').selectOption('LOCALIZED');
  await page.waitForTimeout(100);
  assert(mode === 'LOCALIZED', 'localized membership mode mutation not issued');
  transcript.assertions.localizedImageSetMode = true;
  await page.screenshot({ path: 'qa-artifacts/survey-section-gen4-screenshot.png', fullPage: true });
  await page.goto(`${baseUrl}/survey/survey-1`);
  await page.getByText('한국어 안내').waitFor();
  await page.getByLabel('언어').selectOption('en');
  await page.getByRole('status').filter({ hasText: 'This survey is available in Korean.' }).waitFor();
  const image = page.locator('button:has(img[alt=""])').first();
  await image.press('ArrowRight'); await page.getByText('1 / 2', { exact: true }).waitFor();
  await image.press('ArrowRight'); await page.getByText('2 / 2', { exact: true }).waitFor();
  await image.press('Enter'); await page.getByRole('dialog', { name: 'Image preview' }).waitFor();
  await page.keyboard.press('Escape');
  assert(await image.evaluate((element) => element === document.activeElement), 'lightbox did not restore focus');
  transcript.assertions.publicKoreanFallbackAndAccessibleCarousel = true;
  transcript.assertions.emptyImageAltAndLightboxFocusRestoration = true;
  fs.writeFileSync('qa-artifacts/survey-section-gen4-browser-transcript.json', JSON.stringify(transcript, null, 2) + '\n');
} finally { await browser.close(); }
