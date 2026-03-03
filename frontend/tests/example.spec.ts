import { test, expect } from '@playwright/test';

test('homepage responds', async ({ page }) => {
  const res = await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });
  expect(res).not.toBeNull();
  expect(res!.status()).toBeGreaterThanOrEqual(200);
  expect(res!.status()).toBeLessThan(400);
});
