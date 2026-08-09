import { expect, test } from '@playwright/test';

const localized = (value: string) => ({ value, translationUnavailable: false });
const grants = [{ id: 'survey-manage', permission: 'SURVEY_MANAGE', scope: 'GLOBAL', scopeId: null, activatedFrom: '2026-01-01T00:00:00.000Z', expiresAt: null }, { id: 'survey-review', permission: 'SURVEY_REVIEW', scope: 'GLOBAL', scopeId: null, activatedFrom: '2026-01-01T00:00:00.000Z', expiresAt: null }];
const user = { id: 'admin-user', kaistUid: null, studentOrEmployeeKind: null, studentOrEmployeeNumber: null, nameKr: null, nameEn: null, userEmail: null, userMobile: null, majorMask: 0, feeStatus: 'UNKNOWN', privacyConsentAt: null, grants };
const pixelPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');
const survey = (locale: 'ko' | 'en', koreanOnly = false) => {
  const korean = locale === 'ko' || koreanOnly;
  return {
    id: 'survey-1', revision: 1, definitionVersion: 1, locale, requestedLocale: locale, effectiveContentLocale: koreanOnly ? 'ko' : locale, onlyForKoreanSpeaker: koreanOnly,
    title: localized(korean ? '공개 설문' : 'Public survey'), description: null, state: 'OPEN', guestAllowed: true, phoneRequired: false, feeRestriction: 'ANY', cap: null, opensAt: null, closesAt: null, editDeadlineAt: null, responseRetentionDays: 365, updatedAt: '2026-08-01T00:00:00.000Z',
    sections: [{
      id: 'section-1', ordinal: 0, title: localized(korean ? '질문' : 'Questions'), items: [
        { id: 'description-1', ordinal: 0, kind: 'DESCRIPTION', body: localized(korean ? '한국어 안내' : 'English guidance') },
        { id: 'question-item-1', ordinal: 1, kind: 'QUESTION', question: { id: 'question-1', ordinal: 0, type: 'SINGLE_CHOICE', prompt: localized(korean ? '참여하시겠습니까?' : 'Will you participate?'), helpText: null, required: true, validationRegex: null, numberMin: null, numberMax: null, dateMin: null, dateMax: null, choices: [{ id: 'choice-1', ordinal: 0, value: localized(korean ? '참여' : 'Attend') }, { id: 'choice-2', ordinal: 1, value: localized(korean ? '불참' : 'Decline') }] } },
        { id: 'image-block-1', ordinal: 2, kind: 'IMAGE_BLOCK', mode: 'SHARED', membershipCounts: { shared: 2, ko: 0, en: 0 } },
      ],
    }],
  };
}
const responseItem = { responseId: 'response-1', surveyId: 'survey-1', surveyRevisionId: 'revision-1', revision: 1, state: 'SUBMITTED', submittedAt: '2026-08-01T00:00:00.000Z', reviewedAt: null };
const responseDetail = { ...responseItem, locale: 'ko', reviewReason: null, answers: [{ questionId: 'question-1', prompt: localized('참여하시겠습니까?'), value: { kind: 'choices', choices: [{ choiceOptionId: 'choice-1', label: localized('참여') }] } }] };


test('public survey renders ordered Korean-only content and an accessible image carousel', async ({ page }) => {
  const image = (id: string) => ({ id: `membership-${id}`, asset: { id, src: `/api/surveys/11111111-1111-4111-8111-111111111111/images/${id}`, contentType: 'image/png', byteSize: 10, width: 1, height: 1 } });
  const firstImage = image('22222222-2222-4222-8222-222222222222');
  const secondImage = image('33333333-3333-4333-8333-333333333333');
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/api/surveys/survey-1') return route.fulfill({ json: survey(url.searchParams.get('locale') === 'en' ? 'en' : 'ko', true) });
    if (url.pathname === '/api/surveys/survey-1/image-blocks/image-block-1/memberships') {
      const secondPage = url.searchParams.get('cursor') === 'next';
      return route.fulfill({ json: { items: secondPage ? [secondImage] : [firstImage], nextCursor: secondPage ? null : 'next', membershipCount: 2, definitionVersion: 1, requestedLocale: url.searchParams.get('locale') ?? 'ko', effectiveContentLocale: 'ko' } });
    }
    if (/^\/api\/surveys\/[^/]+\/images\/[^/]+$/.test(url.pathname)) return route.fulfill({ contentType: 'image/png', body: pixelPng });
    if (url.pathname === '/api/surveys/survey-1/responses/me') return route.fulfill({ json: { response: null } });
    if (url.pathname === '/api/surveys/content-relations') return route.fulfill({ json: { items: [] } });
    if (url.pathname === '/api/auth/session') return route.fulfill({ json: { authenticated: false, canUsePersistentFeatures: false, requiresConsent: false, storageMode: null } });
    return route.fulfill({ json: {} });
  });
  await page.goto('/survey/survey-1');
  await expect(page.getByText('한국어 안내')).toBeVisible();
  await expect(page.getByRole('radio', { name: '참여' })).toBeVisible();
  const renderedItems = page.locator('form > section').first().locator('p, fieldset');
  await expect(renderedItems).toHaveCount(2);
  await expect(renderedItems.nth(0)).toHaveText('한국어 안내');
  await expect(renderedItems.nth(1)).toContainText('참여하시겠습니까?');
  await page.getByRole('radio', { name: '참여' }).check();
  await page.getByLabel('언어').selectOption('en');
  await expect(page.getByText('This survey is available in Korean. Korean content is shown below.', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: '공개 설문' })).toBeVisible();
  await expect(page.getByText('한국어 안내')).toBeVisible();
  await expect(page.getByRole('radio', { name: '참여' })).toBeChecked();

  const carouselImageButton = page.locator('button:has(img[alt=""])').first();
  await expect(carouselImageButton.locator('img')).toHaveAttribute('alt', '');
  await expect(page.getByText('1 / 2', { exact: true })).toBeVisible();
  await carouselImageButton.press('ArrowRight');
  await expect(page.getByText('2 / 2', { exact: true })).toBeVisible();
  await page.locator('button:has(img[alt=""])').nth(1).click();
  await expect(page.getByRole('dialog', { name: 'Image preview' })).toBeVisible();
  await expect(page.getByTestId('lightbox-container')).toHaveClass(/w-\[90vw\].*h-\[90vh\]|h-\[90vh\].*w-\[90vw\]/);
  await expect(page.getByRole('dialog').locator('img')).toHaveClass(/object-contain/);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Image preview' })).not.toBeVisible();
  await expect(page.locator('button:has(img[alt=""])').nth(1)).toBeFocused();
});

test('admin survey editor maintains ordered bilingual section items', async ({ page }) => {
  let imageMode = 'SHARED';
  let definitionBody: unknown;
  const adminSurvey = (locale: 'ko' | 'en') => {
    const result = survey(locale);
    result.state = 'DRAFT';
    (result.sections[0]!.items[2] as { mode: string }).mode = imageMode;
    return result;
  };
  const membership = { id: 'membership-1', asset: { id: '22222222-2222-4222-8222-222222222222', src: '/api/surveys/11111111-1111-4111-8111-111111111111/images/22222222-2222-4222-8222-222222222222', contentType: 'image/png', byteSize: 10, width: 1, height: 1 } };
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/api/users/me') return route.fulfill({ json: user });
    if (url.pathname === '/api/admin/surveys/survey-1') return route.fulfill({ json: adminSurvey(url.searchParams.get('locale') === 'en' ? 'en' : 'ko') });
    if (url.pathname === '/api/admin/surveys/survey-1/definition' && route.request().method() === 'PUT') {
      definitionBody = route.request().postDataJSON();
      return route.fulfill({ json: { survey: adminSurvey('ko') } });
    }
    if (url.pathname === '/api/admin/surveys/survey-1/image-blocks/image-block-1/memberships') return route.fulfill({ json: { items: [membership], nextCursor: null, membershipCount: 1, definitionVersion: 1, requestedLocale: 'ko', effectiveContentLocale: 'ko' } });
    if (url.pathname === '/api/admin/surveys/survey-1/image-blocks/image-block-1/mode') {
      imageMode = (route.request().postDataJSON() as { mode: string }).mode;
      return route.fulfill({ json: { definitionVersion: 2, mode: imageMode, membershipCounts: { shared: 1, ko: 0, en: 0 } } });
    }
    return route.fulfill({ json: {} });
  });
  await page.goto('/admin/surveys/survey-1/edit');
  await expect(page.getByRole('heading', { name: '설문 편집' })).toBeVisible();

  await page.getByRole('button', { name: '설명 추가' }).nth(1).click();
  const descriptionFields = page.locator('textarea[required]');
  await expect(descriptionFields).toHaveCount(4);
  await descriptionFields.nth(2).fill('질문 앞 경계 설명');
  await descriptionFields.nth(3).fill('Boundary description before question');
  const previewItems = page.getByTestId('survey-definition-preview').locator('ol').first().locator('li');
  await expect(previewItems.nth(0)).toHaveText('한국어 안내');
  await expect(previewItems.nth(1)).toHaveText('질문 앞 경계 설명');
  await expect(previewItems.nth(2)).toContainText('참여하시겠습니까?');
  await page.getByRole('button', { name: '정의 저장' }).click();
  await expect.poll(() => definitionBody).not.toBeUndefined();
  await expect(page.getByLabel('이미지 모드')).toBeEnabled();

  await page.getByLabel('이미지 모드').selectOption('LOCALIZED');
  await expect(page.getByLabel('이미지 모드')).toHaveValue('LOCALIZED');
  await expect(page.getByLabel('세트')).toBeVisible();
  await expect(page.getByLabel('이미지 업로드')).toBeEnabled();

  await page.getByLabel('한국어 사용자 전용').check();
  await descriptionFields.first().fill('한국어만 설명');
  const englishDescription = descriptionFields.nth(1);
  await expect(englishDescription).toHaveValue('한국어만 설명');
  await expect(englishDescription).toHaveAttribute('readonly', '');
});
test('admin review confirmation preserves response tuple and public materialization disclosure', async ({ page }) => {
  let reviewBody: unknown;
  let materializeBody: unknown;
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/api/users/me') return route.fulfill({ json: user });
    if (url.pathname === '/api/surveys/survey-1') return route.fulfill({ json: survey(url.searchParams.get('locale') === 'en' ? 'en' : 'ko') });
    if (url.pathname === '/api/admin/surveys/survey-1/responses' && route.request().method() === 'GET') return route.fulfill({ json: { surveyId: 'survey-1', locale: 'ko', state: url.searchParams.get('state') ?? 'SUBMITTED', limit: 25, matchingCount: 1, items: [responseItem], nextCursor: null } });
    if (url.pathname === '/api/admin/surveys/survey-1/aggregate/v2') return route.fulfill({ json: { surveyId: 'survey-1', locale: 'ko', revisions: [] } });
    if (url.pathname === '/api/admin/surveys/survey-1/responses/response-1') return route.fulfill({ json: responseDetail });
    if (url.pathname.endsWith('/review')) { reviewBody = route.request().postDataJSON(); return route.fulfill({ json: { ...responseDetail, state: 'REJECTED', reviewReason: 'No capacity' } }); }
    if (url.pathname.endsWith('/materialize-event')) { materializeBody = route.request().postDataJSON(); return route.fulfill({ json: { eventId: 'event-1', relation: { id: 'relation-1', articleId: null, eventId: 'event-1', surveyId: 'survey-1', relationType: 'SURVEY_PERIOD', syncMode: 'SURVEY_TO_EVENT', createdByUserId: 'admin-user', createdAt: '2026-08-01T00:00:00.000Z', updatedByUserId: 'admin-user', updatedAt: '2026-08-01T00:00:00.000Z', synchronizedAt: '2026-08-01T00:00:00.000Z' } } }); }
    return route.fulfill({ json: {} });
  });
  await page.setViewportSize({ width: 320, height: 700 });
  await page.goto('/admin/surveys/survey-1/responses');
  await expect(page.getByRole('heading', { name: '설문 운영' })).toBeVisible();
  await page.getByRole('button', { name: '열기', exact: true }).click();
  await expect(page.getByText('참여하시겠습니까?')).toBeVisible();
  await page.getByRole('textbox', { name: '거절 사유' }).fill('No capacity');
  await page.getByRole('button', { name: '반려' }).click();
  await expect(page.getByRole('dialog').getByRole('button', { name: '취소' })).toBeFocused();
  await page.getByRole('dialog').getByRole('button', { name: '취소' }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await page.getByRole('button', { name: '반려' }).click();
  await page.getByRole('dialog').getByRole('button', { name: '확인' }).click();
  await expect.poll(() => reviewBody).toEqual({ expectedSurveyRevisionId: 'revision-1', state: 'REJECTED', reason: 'No capacity' });
  await expect(page.getByRole('heading', { name: '공개 행사 만들기', exact: true })).toBeVisible();
  await page.getByRole('textbox', { name: '장소' }).fill('N1');
  await page.getByRole('button', { name: '공개 행사 만들기' }).click();
  await page.getByRole('dialog').getByRole('button', { name: '확인' }).click();
  await expect.poll(() => materializeBody).toEqual({ location: 'N1', visibility: 'PUBLIC' });
  await expect(page.getByRole('link', { name: '행사 열기' })).toHaveAttribute('href', '/calendar?eventId=event-1');
  await expect(page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).resolves.toBe(true);
  await expect(page.locator('body')).not.toContainText(/phone|hash|ciphertext|reviewer/i);
});

test('admin survey editor blocks a dirty in-app link before discarding changes', async ({ page }) => {
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/api/users/me') return route.fulfill({ json: user });
    return route.fulfill({ json: {} });
  });

  await page.goto('/admin/surveys/new/edit');
  await expect(page.getByRole('heading', { name: '설문 편집' })).toBeVisible();
  await page.getByRole('textbox', { name: '한국어 제목' }).fill('저장하지 않을 테스트 설문');

  const dialogPromise = page.waitForEvent('dialog');
  await page.getByRole('link', { name: '목록', exact: true }).click();
  const dialog = await dialogPromise;
  expect(dialog.type()).toBe('confirm');
  await dialog.dismiss();
  await expect(page).toHaveURL(/\/admin\/surveys\/new\/edit$/);
});
