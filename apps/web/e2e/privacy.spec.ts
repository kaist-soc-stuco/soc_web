import { expect, test } from '@playwright/test';
const contactGrantResponse = {
  id: 'admin-user',
  feeStatus: 'UNKNOWN',
  kaistUid: null,
  majorMask: 0,
  nameEn: null,
  nameKr: null,
  privacyConsentAt: null,
  studentOrEmployeeKind: null,
  studentOrEmployeeNumber: null,
  userEmail: null,
  userMobile: null,
  grants: [{
    id: 'contacts-grant',
    permission: 'CONTACTS_MANAGE',
    scope: 'GLOBAL',
    scopeId: null,
    activatedFrom: '2026-01-01T00:00:00.000Z',
    expiresAt: null,
  }],
};


test('admin contacts reflects live empty and unauthorized states without fallback PII', async ({ page }) => {
  await page.route('**/api/users/me', (route) => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify(contactGrantResponse),
  }));
  let resolveRequest!: () => void;
  await page.route('**/api/admin/contacts?projection=MASKED', async (route) => {
    await new Promise<void>((resolve) => {
      resolveRequest = () => resolve();
    });
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ items: [], nextCursor: null }),
    });
  });

  await page.goto('/admin/contacts');
  const main = page.locator('main');

  await expect(page.getByRole('heading', { name: '집행위 연락망' })).toBeVisible();
  await expect(page.getByText('연락처 정보를 불러오는 중입니다.')).toBeVisible();
  resolveRequest();
  await expect(page.getByText('연락처 정보가 없습니다.')).toBeVisible();
  await expect(main).not.toContainText(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  await expect(main).not.toContainText(/(?:01[0-9]|0[2-9][0-9])-?\d{3,4}-?\d{4}/);

  await page.route('**/api/admin/contacts*', (route) => route.fulfill({
    status: 403,
    contentType: 'application/json',
    body: JSON.stringify({ code: 'forbidden' }),
  }));
  await page.getByLabel('연락처 표시 방식').selectOption('FULL');
  await expect(page.getByText('연락처 관리 권한이 없습니다.', { exact: true })).toBeVisible();
  await expect(main).not.toContainText(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  await expect(main).not.toContainText(/(?:01[0-9]|0[2-9][0-9])-?\d{3,4}-?\d{4}/);
});

test('authenticated contacts render only API-provided masked contact data', async ({ page }) => {
  await page.route('**/api/users/me', (route) => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify(contactGrantResponse),
  }));
  await page.route('**/api/admin/contacts?projection=MASKED', (route) => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({
      items: [{
        id: 'contact-1',
        projection: 'MASKED',
        name: '김공개',
        role: '위원',
        email: 'k***@example.test',
        phone: '010-****-5678',
        affiliation: null,
        note: null,
        kaistUid: null,
        year: null,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        deletedAt: null,
        retentionDeadlineAt: '2026-02-01T00:00:00.000Z',
        holdUntil: null,
      }],
      nextCursor: null,
    }),
  }));

  await page.goto('/admin/contacts');
  const main = page.locator('main');
  await expect(page.getByText('김공개')).toBeVisible();
  await expect(page.getByRole('button', { name: '김공개 수정' })).toBeVisible();
  await expect(page.getByRole('button', { name: '김공개 삭제' })).toBeVisible();
  await expect(main).toContainText('k***@example.test');
  await expect(main).not.toContainText('hong@example.test');
  await expect(main).not.toContainText('010-1234-5678');
});

test('static roadmap and admin navigation render without an API service', async ({ page }) => {
  await page.route('/api/**', (route) => route.abort());
  await page.goto('/about/roadmap');

  await expect(page.getByRole('heading', { name: '전산학부 로드맵' })).toBeVisible();
  await expect(page.getByRole('button', { name: /CS101 프로그래밍기초/ })).toBeVisible();
  await expect(page.getByRole('link', { name: '로그인' })).toBeVisible();
});
