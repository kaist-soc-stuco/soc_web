import { expect, test } from '@playwright/test';

test('login result UI contains no credential transport or browser auth storage', async ({ page }) => {
  await page.goto('/login?status=success&reason=ok');

  await expect(page.getByText('로그인이 완료되었습니다.')).toBeVisible();
  await expect(page.getByText(/resultToken|pendingLoginToken|temporarySessionId/i)).toHaveCount(0);

  const storedAuthKeys = await page.evaluate(() => [
    ...Object.keys(window.localStorage),
    ...Object.keys(window.sessionStorage),
  ].filter((key) => /auth|token|session/i.test(key)));
  expect(storedAuthKeys).toEqual([]);
});

test('consent submits only the decision through the cookie channel', async ({ page }) => {
  let requestBody: unknown;
  await page.route('**/api/auth/session', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        authenticated: false,
        canUsePersistentFeatures: false,
        requiresConsent: true,
        storageMode: null,
      }),
    });
  });
  await page.route('**/api/auth/login/consent', async (route) => {
    requestBody = route.request().postDataJSON();
    await route.fulfill({ status: 204 });
  });

  await page.goto('/login/consent');
  await page.getByRole('button', { name: '동의하고 저장' }).click();

  await expect.poll(() => requestBody).toEqual({ consent: true });
  expect(JSON.stringify(requestBody)).not.toMatch(/token|session|flow/i);
});
