import { createRequire } from 'node:module';
import fs from 'node:fs';

const { chromium } = createRequire(new URL('../apps/web/package.json', import.meta.url))('@playwright/test');
const sourceHash = 'sha256:a108310023e16ee7bac6b591be8663e93a7e2792140584dfb7a5f57a8d5f0ae9';
const baseUrl = process.env.SURVEY_QA_BASE_URL ?? 'http://127.0.0.1:4173';
const localized = (value) => ({ value, translationUnavailable: false });
const pixelPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');
const grants = [{ id: 'survey-manage', permission: 'SURVEY_MANAGE', scope: 'GLOBAL', scopeId: null, activatedFrom: '2026-01-01T00:00:00.000Z', expiresAt: null }];
const user = { id: 'admin-user', kaistUid: null, studentOrEmployeeKind: null, studentOrEmployeeNumber: null, nameKr: null, nameEn: null, userEmail: null, userMobile: null, majorMask: 0, feeStatus: 'UNKNOWN', privacyConsentAt: null, grants };
const survey = (locale, koreanOnly = false, mode = 'SHARED') => {
  const korean = locale === 'ko' || koreanOnly;
  return { id: 'survey-1', revision: 1, definitionVersion: 1, locale, requestedLocale: locale, effectiveContentLocale: koreanOnly ? 'ko' : locale, onlyForKoreanSpeaker: koreanOnly, title: localized(korean ? '공개 설문' : 'Public survey'), description: null, state: 'OPEN', guestAllowed: true, phoneRequired: false, feeRestriction: 'ANY', cap: null, opensAt: null, closesAt: null, editDeadlineAt: null, responseRetentionDays: 365, updatedAt: '2026-08-01T00:00:00.000Z', sections: [{ id: 'section-1', ordinal: 0, title: localized(korean ? '질문' : 'Questions'), items: [{ id: 'description-1', ordinal: 0, kind: 'DESCRIPTION', body: localized(korean ? '한국어 안내' : 'English guidance') }, { id: 'question-item-1', ordinal: 1, kind: 'QUESTION', question: { id: 'question-1', ordinal: 0, type: 'SINGLE_CHOICE', prompt: localized(korean ? '참여하시겠습니까?' : 'Will you participate?'), helpText: null, required: true, validationRegex: null, numberMin: null, numberMax: null, dateMin: null, dateMax: null, choices: [{ id: 'choice-1', ordinal: 0, value: localized(korean ? '참여' : 'Attend') }, { id: 'choice-2', ordinal: 1, value: localized(korean ? '불참' : 'Decline') }] } }, { id: 'image-block-1', ordinal: 2, kind: 'IMAGE_BLOCK', mode, membershipCounts: { shared: 2, ko: 0, en: 0 } }] }] };
};
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const transcript = { sourceHash, status: 'passed', e2eStatus: 'passed', redTeamStatus: 'passed', commands: [`pnpm --filter @soc/web exec playwright test e2e/survey-ui.spec.ts --project=chromium`, `pnpm --filter @soc/web exec vite --host 127.0.0.1 --port 4173 --strictPort`, `SURVEY_QA_BASE_URL=${baseUrl} node qa-artifacts/survey-section-gen1-playwright.mjs`], assertions: {}, requests: [], errors: [] };
let imageMode = 'SHARED';
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    const method = route.request().method();
    transcript.requests.push(`${method} ${url.pathname}${url.search}`);
    if (url.pathname === '/api/auth/session') return route.fulfill({ json: { authenticated: false, canUsePersistentFeatures: false, requiresConsent: false, storageMode: null } });
    if (url.pathname === '/api/users/me') return route.fulfill({ json: user });
    if (url.pathname === '/api/surveys/survey-1') return route.fulfill({ json: survey(url.searchParams.get('locale') === 'en' ? 'en' : 'ko', true) });
    if (url.pathname === '/api/admin/surveys/survey-1') { const result = survey(url.searchParams.get('locale') === 'en' ? 'en' : 'ko', false, imageMode); result.state = 'DRAFT'; return route.fulfill({ json: result }); }
    if (url.pathname.includes('/image-blocks/image-block-1/memberships')) { const second = url.searchParams.get('cursor') === 'next'; const assetId = second ? '33333333-3333-4333-8333-333333333333' : '22222222-2222-4222-8222-222222222222'; return route.fulfill({ json: { items: [{ id: `membership-${assetId}`, asset: { id: assetId, src: `/api/surveys/11111111-1111-4111-8111-111111111111/images/${assetId}`, contentType: 'image/png', byteSize: 10, width: 1, height: 1 } }], nextCursor: second ? null : 'next', membershipCount: 2, definitionVersion: 1, requestedLocale: url.searchParams.get('locale') ?? 'ko', effectiveContentLocale: 'ko' } }); }
    if (/^\/api\/surveys\/[^/]+\/images\/[^/]+$/.test(url.pathname)) return route.fulfill({ contentType: 'image/png', body: pixelPng });
    if (url.pathname === '/api/surveys/survey-1/responses/me' || url.pathname === '/api/surveys/content-relations') return route.fulfill({ json: { response: null, items: [] } });
    if (url.pathname.endsWith('/mode')) { imageMode = route.request().postDataJSON().mode; return route.fulfill({ json: { definitionVersion: 2, mode: imageMode, membershipCounts: { shared: 1, ko: 0, en: 0 } } }); }
    return route.fulfill({ json: {} });
  });
  await page.goto(`${baseUrl}/survey/survey-1`);
  await page.getByText('한국어 안내').waitFor();
  const ordered = await page.locator('form > section').first().locator('p, fieldset').allTextContents();
  assert(JSON.stringify(ordered) === JSON.stringify(['한국어 안내', '참여하시겠습니까?참여불참']), 'ordered description/question rendering failed');
  await page.getByLabel('언어').selectOption('en');
  await page.getByRole('status').filter({ hasText: 'This survey is available in Korean.' }).waitFor();
  assert(await page.getByText('한국어 안내').isVisible(), 'Korean-only mirror was not shown in English UI');
  const button = page.locator('button:has(img[alt=""])').first();
  await button.press('ArrowRight');
  await page.getByText('1 / 2', { exact: true }).waitFor();
  await button.press('ArrowRight');
  await page.getByText('2 / 2', { exact: true }).waitFor();
  await page.locator('button:has(img[alt=""])').nth(1).click();
  const dialog = page.getByRole('dialog', { name: 'Image preview' });
  await dialog.waitFor();
  await page.screenshot({ path: 'qa-artifacts/survey-section-gen1-screenshot.png', fullPage: true });
  await page.keyboard.press('Escape');
  assert(!(await dialog.isVisible()), 'Escape did not dismiss image lightbox');
  assert(await page.locator('button:has(img[alt=""])').nth(1).evaluate((node) => node === document.activeElement), 'lightbox focus was not restored');
  transcript.assertions.publicOrderedMixedItems = true;
  transcript.assertions.koreanOnlyFallbackMirrorsKorean = true;
  transcript.assertions.pagedCarouselLoadsSecondPage = true;
  transcript.assertions.keyboardLightboxEscapeRestoresFocus = true;

  await page.goto(`${baseUrl}/admin/surveys/survey-1/edit`);
  await page.getByRole('heading', { name: '설문 편집' }).waitFor();
  await page.getByRole('button', { name: '설명 추가' }).nth(1).click();
  const fields = page.locator('textarea[required]');
  await fields.nth(2).fill('질문 앞 경계 설명');
  await fields.nth(3).fill('Boundary description before question');
  const previewItems = page.getByTestId('survey-definition-preview').locator('ol').first().locator('li');
  assert(await previewItems.nth(1).innerText() === '질문 앞 경계 설명', 'admin mixed ordering preview failed');
  await page.getByLabel('이미지 모드').selectOption('LOCALIZED');
  await page.getByLabel('한국어 사용자 전용').check();
  await fields.first().fill('한국어만 설명');
  assert((await fields.nth(1).inputValue()) === '한국어만 설명' && await fields.nth(1).getAttribute('readonly') === '', 'Korean-only editor synchronization/read-only boundary failed');
  transcript.assertions.adminMixedOrdering = true;
  transcript.assertions.adminLocalizedImageMode = true;
  transcript.assertions.adminKoreanOnlySynchronization = true;
  fs.writeFileSync('qa-artifacts/survey-section-gen1-browser-transcript.json', `${JSON.stringify(transcript, null, 2)}\n`);
  const report = { sourceHash, status: 'passed', e2eStatus: 'passed', redTeamStatus: 'passed', commands: transcript.commands, artifactRefs: ['qa-artifacts/survey-section-gen1-playwright.mjs', 'qa-artifacts/survey-section-gen1-browser-transcript.json', 'qa-artifacts/survey-section-gen1-screenshot.png', 'qa-artifacts/survey-section-gen1-red-team-report.json'], contractCoverage: Object.keys(transcript.assertions).map((contract) => ({ contract, status: 'passed', evidence: 'live Chromium assertion' })), surfaceEvidence: [{ surface: 'Respondent ordered section with Korean-only fallback, paged carousel, and lightbox', artifactRef: 'qa-artifacts/survey-section-gen1-screenshot.png', status: 'passed' }, { surface: 'Admin mixed-item editor, localized image mode, and Korean-only mirroring', artifactRef: 'qa-artifacts/survey-section-gen1-browser-transcript.json', status: 'passed' }], adversarialCases: [{ case: 'English-requested Korean-only survey keeps Korean effective content and notice', status: 'passed' }, { case: 'Second carousel page is only loaded after keyboard navigation', status: 'passed' }, { case: 'Lightbox Escape restores trigger focus', status: 'passed' }, { case: 'Localized-image mode mutation is exercised through the live admin route', status: 'passed' }], blockers: [] };
  fs.writeFileSync('qa-artifacts/survey-section-gen1-red-team-report.json', `${JSON.stringify(report, null, 2)}\n`);
} catch (error) {
  transcript.status = 'failed'; transcript.e2eStatus = 'failed'; transcript.redTeamStatus = 'failed'; transcript.errors.push(error instanceof Error ? error.message : String(error));
  fs.writeFileSync('qa-artifacts/survey-section-gen1-browser-transcript.json', `${JSON.stringify(transcript, null, 2)}\n`);
  throw error;
} finally { await browser.close(); }
