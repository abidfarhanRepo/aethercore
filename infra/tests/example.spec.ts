import { test, expect } from '@playwright/test';

test('homepage has expected content', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('h1')).toHaveText('Example Site');
});
