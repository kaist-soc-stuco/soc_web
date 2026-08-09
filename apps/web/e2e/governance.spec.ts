import { expect, test } from '@playwright/test';

const localized = (value: string) => ({ value, translationUnavailable: false });

async function mockShell(page: any, session: Record<string, unknown>) {
  await page.route('**/api/**', async (route: any) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/api/auth/session') return route.fulfill({ json: session });
    if (url.pathname === '/api/users/me') return route.fulfill({ json: { id: 'user-1', grants: [] } });
    if (url.pathname === '/api/boards') return route.fulfill({ json: { locale: 'ko', items: [] } });
    return route.fulfill({ json: {} });
  });
}

test('public pledge dashboard exposes keyboard-friendly expansion and progress semantics', async ({ page }) => {
  await mockShell(page, { authenticated: false, canUsePersistentFeatures: false, requiresConsent: false, storageMode: null });
  await page.route((url: URL) => url.pathname === '/api/pledges', async (route: any) => route.fulfill({
    json: {
      locale: 'ko',
      items: [{
        id: 'pledge-1',
        ordinal: 0,
        title: localized('수업·학사 정보 개선'),
        description: localized('학사 정보를 한 곳에서 찾기 쉽게 정리합니다.'),
        status: 'IN_PROGRESS',
        progressPercent: 75,
        progress: localized('학사 캘린더와 공지 연결을 점검하고 있습니다.'),
        targetDate: '2026-09-30',
      }],
    },
  }));

  await page.goto('/pledges');
  const row = page.getByRole('button', { name: /수업·학사 정보 개선/ });
  await expect(row).toHaveAttribute('aria-expanded', 'false');
  await row.press('Enter');
  await expect(row).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByText('학사 정보를 한 곳에서 찾기 쉽게 정리합니다.')).toBeVisible();
  await expect(page.getByRole('progressbar', { name: '수업·학사 정보 개선 진행률' })).toHaveAttribute('aria-valuenow', '75');
  await row.press('Enter');
  await expect(row).toHaveAttribute('aria-expanded', 'false');
});

test('eligible user can cast one vote and is shown the duplicate-vote state', async ({ page }) => {
  let voted = false;
  let ballotBody: unknown;
  const vote = {
    id: '91111111-1111-4111-8111-111111111111',
    title: localized('[Mock] 2026 학생회 공약 우선순위 투표'),
    description: localized('테스트용 공개 투표입니다.'),
    state: 'OPEN',
    opensAt: '2026-08-01T00:00:00.000Z',
    closesAt: '2026-12-31T23:59:59.000Z',
    anonymous: true,
    validTurnoutPercent: 50,
    eligibleVoterCount: 2,
    turnoutPercent: 0,
    participation: 'ELIGIBLE',
    resultsVisibleUntil: null,
    candidates: [
      { id: '92222222-2222-4222-8222-222222222222', ordinal: 0, name: localized('공약 후보 A'), description: localized('학생 복지 확대안을 제안합니다.'), imageUrl: null },
      { id: '93333333-3333-4333-8333-333333333333', ordinal: 1, name: localized('공약 후보 B'), description: localized('학부 커뮤니티 개선안을 제안합니다.'), imageUrl: null },
    ],
    results: null,
  };
  await mockShell(page, { authenticated: true, canUsePersistentFeatures: true, requiresConsent: false, storageMode: 'persisted', userId: 'user-1' });
  await page.route((url: URL) => url.pathname === '/api/votes', async (route: any) => route.fulfill({ json: { locale: 'ko', items: [{ ...vote }] } }));
  await page.route((url: URL) => url.pathname === '/api/votes/91111111-1111-4111-8111-111111111111', async (route: any) => route.fulfill({ json: { ...vote, participation: voted ? 'VOTED' : 'ELIGIBLE', turnoutPercent: voted ? 50 : 0 } }));
  await page.route((url: URL) => url.pathname === '/api/votes/91111111-1111-4111-8111-111111111111/ballots', async (route: any) => {
    ballotBody = route.request().postDataJSON();
    voted = true;
    await route.fulfill({ status: 201, json: { voted: true, turnoutPercent: 50 } });
  });

  await page.goto('/votes/91111111-1111-4111-8111-111111111111');
  await page.getByRole('radio', { name: /공약 후보 A/ }).check();
  await page.getByRole('button', { name: '투표하기' }).click();
  await expect(page.getByRole('status')).toHaveText('투표가 접수되었습니다.');
  await expect.poll(() => ballotBody).toEqual({ candidateId: '92222222-2222-4222-8222-222222222222' });
  await expect(page.getByText('이미 투표했습니다.')).toBeVisible();
  await expect(page.getByRole('radio', { name: /공약 후보 A/ })).toBeDisabled();
});
