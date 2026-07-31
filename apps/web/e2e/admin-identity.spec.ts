import { expect, test } from '@playwright/test';

const grants = [
  'FEES_MANAGE', 'SURVEY_MANAGE', 'MAIL_SEND', 'CONTACTS_MANAGE', 'USERS_MANAGE',
  'PERMISSION_GRANT', 'PERMISSION_REVOKE', 'PERMISSION_APPROVE', 'PERMISSION_ACTIVATE', 'PERMISSION_AUDIT',
].map((permission) => ({
  id: `grant-${permission}`,
  permission,
  scope: 'GLOBAL',
  scopeId: null,
  activatedFrom: '2026-01-01T00:00:00.000Z',
  expiresAt: null,
}));
const currentUser = {
  feeStatus: 'UNKNOWN',
  id: 'dev-user',
  kaistUid: null,
  majorMask: 0,
  nameEn: null,
  nameKr: null,
  privacyConsentAt: null,
  studentOrEmployeeNumber: null,
  userEmail: null,
  userMobile: null,
  grants,
};

test('admin identity routes preserve payments and expose no finance route', async ({ page }) => {
  await page.route('**/api/**', async (route) => {
    const { pathname } = new URL(route.request().url());
    let body: unknown;
    if (pathname === '/api/users/me') body = currentUser;
    else if (pathname === '/api/users/admin') body = { items: [], nextCursor: null };
    else if (pathname === '/api/permissions/definitions') body = { items: [{ key: 'USERS_MANAGE', description: 'Manage users' }] };
    else if (pathname === '/api/permissions/requests') body = { items: [], nextCursor: null };
    else if (pathname === '/api/permissions/audit') body = { items: [], nextCursor: null };
    else if (pathname === '/api/users/admin/fees') body = { items: [] };
    else body = {};
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });

  await page.goto('/admin');
  await expect(page.getByRole('link', { name: '과비 납부 관리' })).toHaveAttribute('href', '/admin/payments');
  await expect(page.getByRole('link', { name: '사용자 관리' })).toHaveAttribute('href', '/admin/users');
  await expect(page.getByRole('link', { name: '권한 관리' })).toHaveAttribute('href', '/admin/permissions');
  await expect(page.getByRole('link', { name: '권한 감사 로그' })).toHaveAttribute('href', '/admin/audit-logs');

  for (const [path, heading] of [
    ['/admin/payments', '과비 납부 관리'],
    ['/admin/users', '사용자 관리'],
    ['/admin/permissions', '권한 요청 관리'],
    ['/admin/audit-logs', '권한 감사 로그'],
  ]) {
    await page.goto(path);
    await expect(page.getByRole('heading', { name: heading })).toBeVisible();
  }

  await page.goto('/admin/finance');
  await expect(page).toHaveURL(/\/admin\/finance$/);
  await expect(page.getByRole('region', { name: '404' })).toContainText('요청한 페이지를 찾을 수 없습니다.');
  await expect(page.getByRole('heading', { name: /finance/i })).toHaveCount(0);
  await expect(page.getByText(/finance/i)).toHaveCount(0);
});

test('scoped workflow grants expose only permission queues without user discovery', async ({ page }) => {
  const scopedUser = {
    ...currentUser,
    grants: [{
      id: 'scoped-approve',
      permission: 'PERMISSION_APPROVE',
      scope: 'BOARD',
      scopeId: 'board-1',
      activatedFrom: '2026-01-01T00:00:00.000Z',
      expiresAt: null,
    }],
  };
  await page.route('**/api/**', async (route) => {
    const { pathname } = new URL(route.request().url());
    if (pathname === '/api/users/me') {
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify(scopedUser) });
    } else if (pathname === '/api/permissions/definitions') {
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ items: [{ key: 'USERS_MANAGE', description: 'Manage users' }] }) });
    } else if (pathname === '/api/permissions/requests') {
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ items: [], nextCursor: null }) });
    } else {
      await route.fulfill({ status: 403, contentType: 'application/json', body: JSON.stringify({ code: 'insufficient_permission', message: 'Request failed', requestId: 'e2e-request' }) });
    }
  });

  await page.goto('/admin');
  await expect(page).toHaveURL(/\/admin\/permissions$/);
  await expect(page.getByRole('link', { name: '권한 관리' })).toBeVisible();
  await expect(page.getByRole('link', { name: '사용자 관리' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: '과비 납부 관리' })).toHaveCount(0);
  await expect(page.getByLabel('정확한 대상 사용자 검색')).toBeDisabled();
  await expect(page.getByRole('button', { name: '요청 등록' })).toBeDisabled();
});

test('direct admin routes fail closed when the grants snapshot is unauthenticated', async ({ page }) => {
  await page.route('**/api/users/me', (route) => route.fulfill({
    status: 401,
    contentType: 'application/json',
    body: JSON.stringify({ code: 'access_cookie_missing', message: 'Request failed', requestId: 'e2e-unauthenticated' }),
  }));
  await page.route('**/api/users/admin*', (route) => route.abort());

  await page.goto('/admin/users');
  await expect(page.getByRole('region', { name: '403' })).toContainText('이 관리 페이지에 접근할 권한이 없습니다.');
  await expect(page.getByText('관리 메뉴를 불러올 수 없습니다.', { exact: true })).toBeVisible();
});
