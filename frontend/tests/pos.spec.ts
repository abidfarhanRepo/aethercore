import { test, expect } from '@playwright/test'

test('can add product to cart and checkout', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('text=aether — Products')).toBeVisible()
  // assume there's an Add button on product
  const add = page.locator('text=Add').first()
  await add.click()
  await page.locator('text=Cart').click()
  await page.locator('text=Checkout').click()
  // since checkout is a mock, expect an alert or confirmation; stubbed here
})
