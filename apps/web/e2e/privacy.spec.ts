import { expect, test } from '@playwright/test';

test('admin contacts exposes an unavailable state without contact records or PII', async ({ page }) => {
  await page.goto('/admin/contacts');

  const main = page.locator('main');
  await expect(page.getByRole('heading', { name: '집행위 연락망' })).toBeVisible();
  await expect(page.getByText('연락처 정보는 현재 제공되지 않습니다.')).toBeVisible();
  await expect(page.getByRole('link', { name: '집행위 연락망' })).toBeVisible();
  await expect(main).not.toContainText(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  await expect(main).not.toContainText(/(?:01[0-9]|0[2-9][0-9])-?\d{3,4}-?\d{4}/);
});

test('static roadmap and admin navigation render without an API service', async ({ page }) => {
  await page.route('/api/**', (route) => route.abort());
  await page.goto('/about/roadmap');

  await expect(page.getByRole('heading', { name: '전산학부 로드맵' })).toBeVisible();
  await expect(page.getByRole('button', { name: /CS101 프로그래밍기초/ })).toBeVisible();
  await expect(page.getByRole('link', { name: '마이페이지' })).toBeVisible();
});
