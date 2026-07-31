import { expect, test } from '@playwright/test';

const seeded = [
  ['soc-notice', '공지'], ['soc-events', '행사'], ['human-of-cs', 'HoC'], ['external-promotion', '홍보글'], ['suggestions', '건의사항 및 QnA'], ['laboratories', '연구실'], ['escamp', 'ESCamp'],
];
const grants = [{ id: 'board-manager', permission: 'BOARD_MANAGE', scope: 'GLOBAL', scopeId: null, activatedFrom: '2026-01-01T00:00:00.000Z', expiresAt: null }];
const board = (code: string, title: string, order: number) => ({ id: code, code, titleKr: title, titleEn: title, descriptionKr: `${title} 설명`, descriptionEn: `${title} description`, readPermission: 'PUBLIC', writePermission: 'AUTHENTICATED', commentPermission: 'AUTHENTICATED', commentsAllowed: true, secretArticlesAllowed: false, reactionsAllowed: true, displayOrder: order, isHidden: false, showOnHome: false, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' });
const publicBoard = (item: ReturnType<typeof board>) => ({
  id: item.id,
  code: item.code,
  title: { value: item.titleKr, translationUnavailable: false },
  description: { value: item.descriptionKr, translationUnavailable: false },
  config: {
    readPermission: item.readPermission,
    writePermission: item.writePermission,
    commentPermission: item.commentPermission,
    commentsAllowed: item.commentsAllowed,
    secretArticlesAllowed: item.secretArticlesAllowed,
    reactionsAllowed: item.reactionsAllowed,
    displayOrder: item.displayOrder,
    isHidden: item.isHidden,
    showOnHome: item.showOnHome,
  },
  updatedAt: item.updatedAt,
});

const currentUser = {
  feeStatus: 'UNKNOWN',
  id: 'user',
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
type BoardMockOptions = {
  staleOnce?: boolean;
  authenticated?: boolean;
  delayFirstCatalog?: boolean;
  onFirstCatalogPending?: (release: () => void) => void;
  delayCatalogRequest?: number;
  onCatalogRequestPending?: (release: () => void) => void;
};
async function mockBoards(page: any, manager = true, options: BoardMockOptions = {}) {
  let rows = seeded.map(([code, title], index) => board(code, title, index + 1));
  const restricted = { ...board('manager-reports', '관리자 전용', 99), readPermission: 'COMMITTEE' };
  let authenticated = options.authenticated ?? true;
  let hasManagerGrant = manager;
  let staleOnce = options.staleOnce ?? false;
  let catalogRequests = 0;
  await page.route('**/api/**', async (route: any) => {
    const request = route.request(); const { pathname } = new URL(request.url());
    if (pathname === '/api/auth/session') return route.fulfill({ json: { authenticated, canUsePersistentFeatures: authenticated, requiresConsent: false, storageMode: authenticated ? 'persisted' : null, userId: authenticated ? 'user' : undefined } });
    if (pathname === '/api/auth/development/login' && request.method() === 'POST') { authenticated = true; hasManagerGrant = true; return route.fulfill({ status: 204 }); }
    if (pathname === '/api/auth/logout' && request.method() === 'POST') { authenticated = false; hasManagerGrant = false; return route.fulfill({ status: 204 }); }
    if (pathname === '/api/users/me') return route.fulfill({ json: { ...currentUser, grants: hasManagerGrant ? grants : [] } });
    if (pathname === '/api/boards') {
      const responseRows = (hasManagerGrant ? [...rows, restricted] : [...rows, board('prior-actor-only', '이전 사용자 전용', 98)])
        .sort((left, right) => left.displayOrder - right.displayOrder || left.id.localeCompare(right.id));
      catalogRequests += 1;
      if ((options.delayFirstCatalog && catalogRequests === 1) || catalogRequests === options.delayCatalogRequest) {
        await new Promise<void>((resolve) => (catalogRequests === 1 ? options.onFirstCatalogPending : options.onCatalogRequestPending)?.(resolve));
      }
      return route.fulfill({ json: { locale: 'ko', items: responseRows.map(publicBoard) } });
    }
    if (pathname === '/api/admin/boards' && request.method() === 'GET') return route.fulfill({ json: { items: rows } });
    if (pathname === '/api/admin/boards' && request.method() === 'POST') { const input = request.postDataJSON(); const next = board(input.code, input.titleKr, input.displayOrder); rows = [...rows, next]; return route.fulfill({ json: next }); }
    const match = pathname.match(/^\/api\/admin\/boards\/([^/]+)$/);
    if (match && request.method() === 'PATCH') {
      const current = rows.find((row) => row.id === match[1])!; const input = request.postDataJSON();
      if (current.id === 'soc-notice' && !staleOnce || input.expectedUpdatedAt !== current.updatedAt) return route.fulfill({ status: 409, json: { code: 'board_stale', message: 'stale', requestId: 'r' } });
      if (staleOnce) { staleOnce = false; rows = rows.map((row) => row.id === current.id ? { ...row, updatedAt: '2026-01-03T00:00:00.000Z' } : row); return route.fulfill({ status: 409, json: { code: 'board_stale', message: 'stale', requestId: 'r' } }); }
      const { expectedUpdatedAt: _expectedUpdatedAt, ...patch } = input; const next = { ...current, ...patch, updatedAt: '2026-01-02T00:00:00.000Z' }; rows = rows.map((row) => row.id === current.id ? next : row); return route.fulfill({ json: next });
    }
    if (match && request.method() === 'DELETE') {
      const current = rows.find((row) => row.id === match[1])!;
      if (current.id === 'soc-notice') return route.fulfill({ status: 409, json: { code: 'board_has_articles', message: 'blocked', requestId: 'r' } });
      rows = rows.filter((row) => row.id !== current.id); return route.fulfill({ status: 204 });
    }
    return route.fulfill({ status: 500, json: { code: 'unmatched_mock_request', message: `${request.method()} ${pathname}` } });
  });
  return { catalogRequests: () => catalogRequests };
}

test('the public header starts with the seven production board codes and titles', async ({ page }) => {
  await mockBoards(page);
  await page.goto('/');
  for (const [code, title] of seeded) await expect(page.locator(`header a[href="/board/${code}"]`, { hasText: title })).toBeVisible();
});

test('a board manager can create a board and the mounted header receives the catalog update', async ({ page }) => {
  await mockBoards(page);
  await page.goto('/admin/boards');
  await page.getByRole('textbox').nth(0).fill('new-board');
  await page.getByRole('textbox').nth(1).fill('새 게시판');
  await page.getByRole('textbox').nth(2).fill('New board');
  await page.getByRole('textbox').nth(3).fill('설명');
  await page.getByRole('textbox').nth(4).fill('Description');
  await page.getByRole('button', { name: '게시판 만들기' }).click();
  await expect(page.locator('header a[href="/board/new-board"]', { hasText: '새 게시판' })).toBeVisible();
});

test('management failures surface stale and article-conflict protection', async ({ page }) => {
  await mockBoards(page);
  await page.goto('/admin/boards');
  await page.getByRole('button', { name: '편집' }).first().click();
  await page.getByRole('textbox').nth(1).fill('수정 공지');
  await page.getByRole('button', { name: '변경 저장' }).click();
  await expect(page.getByRole('alert')).toHaveText(/다른 관리자가 먼저 변경했습니다/);
  await page.getByRole('button', { name: '편집' }).first().click();
  await page.getByRole('button', { name: '삭제' }).first().click();
  await expect(page.getByRole('alert')).toHaveText(/게시글이 있는 게시판은 삭제할 수 없습니다/);
});

test('non-managers are denied before board administration is loaded', async ({ page }) => {
  await mockBoards(page, false);
  await page.goto('/admin/boards');
  await expect(page.getByRole('region', { name: '403' })).toContainText('이 관리 페이지에 접근할 권한이 없습니다.');
  await expect(page.getByText('접근 가능한 관리 메뉴가 없습니다.', { exact: true })).toBeVisible();
});
test('a manager patch propagates its title and display order to the mounted header', async ({ page }) => {
  await mockBoards(page);
  await page.goto('/admin/boards');
  await page.getByRole('button', { name: '편집' }).nth(1).click();
  await page.getByRole('textbox').nth(1).fill('수정 행사');
  await page.getByLabel('표시 순서').fill('0');
  await page.getByRole('button', { name: '변경 저장' }).click();
  await expect(page.locator('header a[href="/board/soc-events"]', { hasText: '수정 행사' })).toBeVisible();
  await expect(page.locator('header nav a').first()).toHaveAttribute('href', '/board');
});

test('a manager hide and delete both propagate to the mounted header', async ({ page }) => {
  await mockBoards(page);
  await page.goto('/admin/boards');
  await page.getByRole('button', { name: '편집' }).nth(1).click();
  await page.getByLabel('목록에서 숨김').check();
  await page.getByRole('button', { name: '변경 저장' }).click();
  await expect(page.locator('header a[href="/board/soc-events"]')).toHaveCount(0);

  await page.getByRole('button', { name: '삭제' }).nth(2).click();
  await expect(page.locator('header a[href="/board/human-of-cs"]')).toHaveCount(0);
});

test('a stale refresh obtains the fresh version and permits reapplying the edit', async ({ page }) => {
  await mockBoards(page, true, { staleOnce: true });
  await page.goto('/admin/boards');
  await page.getByRole('button', { name: '편집' }).nth(1).click();
  await page.getByRole('textbox').nth(1).fill('재적용 행사');
  await page.getByRole('button', { name: '변경 저장' }).click();
  await expect(page.getByRole('alert')).toHaveText(/다른 관리자가 먼저 변경했습니다/);

  await page.getByRole('button', { name: '목록 새로고침' }).click();
  await page.getByRole('button', { name: '편집' }).nth(1).click();
  await page.getByRole('textbox').nth(1).fill('재적용 행사');
  await page.getByRole('button', { name: '변경 저장' }).click();
  await expect(page.locator('header a[href="/board/soc-events"]', { hasText: '재적용 행사' })).toBeVisible();
});
test('a manager-only board is absent after logout and header remount', async ({ page }) => {
  await mockBoards(page);
  await page.goto('/');
  await expect(page.locator('header a[href="/board/manager-reports"]')).toBeVisible();

  await page.goto('/login');
  await page.getByRole('button', { name: '로그아웃' }).click();
  await page.goto('/');

  await expect(page.locator('header a[href="/board/manager-reports"]')).toHaveCount(0);
});

test('anonymous-to-manager authentication refetches the catalog once and reveals restricted boards', async ({ page }) => {
  let releaseManagerCatalog: (() => void) | undefined;
  let managerCatalogPendingResolve!: () => void;
  const managerCatalogPending = new Promise<void>((resolve) => { managerCatalogPendingResolve = resolve; });
  const mock = await mockBoards(page, false, {
    authenticated: false,
    delayCatalogRequest: 2,
    onCatalogRequestPending: (release) => {
      releaseManagerCatalog = release;
      managerCatalogPendingResolve();
    },
  });
  await page.goto('/');
  await expect(page.locator('header a[href="/board/soc-notice"]', { hasText: '공지' })).toBeVisible();
  expect(mock.catalogRequests()).toBe(1);

  await page.goto('/login');
  await expect(page.getByText('authenticated: false', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '개발용 계정으로 로그인' }).click();
  await managerCatalogPending;
  expect(mock.catalogRequests()).toBe(2);
  releaseManagerCatalog!();
  await expect(page.locator('header a[href="/board/manager-reports"]')).toBeVisible();
});

test('a delayed prior-actor catalog response cannot repopulate the transitioned actor UI', async ({ page }) => {
  let releasePriorCatalog: (() => void) | undefined;
  let firstCatalogPendingResolve!: () => void;
  const firstCatalogPending = new Promise<void>((resolve) => { firstCatalogPendingResolve = resolve; });
  const mock = await mockBoards(page, false, {
    authenticated: false,
    delayFirstCatalog: true,
    onFirstCatalogPending: (release) => {
      releasePriorCatalog = release;
      firstCatalogPendingResolve();
    },
  });

  await page.goto('/');
  await firstCatalogPending;
  expect(mock.catalogRequests()).toBe(1);

  await page.goto('/login');
  await expect(page.getByText('authenticated: false', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '개발용 계정으로 로그인' }).click();
  await expect(page.locator('header a[href="/board/manager-reports"]')).toBeVisible();
  expect(mock.catalogRequests()).toBeGreaterThanOrEqual(2);

  releasePriorCatalog!();
  await expect(page.locator('header a[href="/board/manager-reports"]')).toBeVisible();
  await expect(page.locator('header a[href="/board/soc-notice"]', { hasText: '공지' })).toBeVisible();
  await expect(page.locator('header a[href="/board/prior-actor-only"]')).toHaveCount(0);
});
