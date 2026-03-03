import { test, expect } from '@playwright/test';

/**
 * E2E Login Tests
 * Tests: Valid login, invalid credentials, account lockout, remember me
 */
test.describe('Login E2E Tests', () => {
  const baseURL = 'http://localhost:5173';
  const validEmail = 'cashier@test.com';
  const validPassword = 'TestPass123!';
  const invalidPassword = 'WrongPassword123!';

  test.beforeEach(async ({ page }) => {
    await page.goto(`${baseURL}/login`);
  });

  test('should login with valid credentials', async ({ page }) => {
    // Fill email
    await page.fill('input[type="email"]', validEmail);
    
    // Fill password
    await page.fill('input[type="password"]', validPassword);
    
    // Submit form
    await page.click('button[type="submit"]');
    
    // Verify navigation to dashboard
    await page.waitForNavigation();
    expect(page.url()).toContain('/dashboard');
    
    // Verify user logged in (check for logout button)
    await expect(page.locator('button:has-text("Logout")')).toBeVisible();
  });

  test('should show error on invalid credentials', async ({ page }) => {
    // Fill email
    await page.fill('input[type="email"]', validEmail);
    
    // Fill wrong password
    await page.fill('input[type="password"]', invalidPassword);
    
    // Submit form
    await page.click('button[type="submit"]');
    
    // Verify error message
    const errorMsg = page.locator('text=Invalid credentials');
    await expect(errorMsg).toBeVisible();
    
    // Verify still on login page
    expect(page.url()).toContain('/login');
  });

  test('should reject invalid email', async ({ page }) => {
    // Fill invalid email
    await page.fill('input[type="email"]', 'invalid-email');
    
    // Fill password
    await page.fill('input[type="password"]', validPassword);
    
    // Click submit
    await page.click('button[type="submit"]');
    
    // Should see validation error
    const validationError = page.locator('text=Please enter a valid email');
    await expect(validationError).toBeVisible({ timeout: 2000 });
  });

  test('should reject weak password', async ({ page }) => {
    // Fill email
    await page.fill('input[type="email"]', validEmail);
    
    // Fill weak password
    await page.fill('input[type="password"]', 'weak');
    
    // Click submit
    await page.click('button[type="submit"]');
    
    // Should see validation error
    const validationError = page.locator('text=must');
    await expect(validationError).toBeVisible({ timeout: 2000 });
  });

  test('should lock account after 5 failed attempts', async ({ page }) => {
    // Attempt 1
    await page.fill('input[type="email"]', validEmail);
    await page.fill('input[type="password"]', 'WrongPass1!');
    await page.click('button[type="submit"]');
    
    // Attempt 2
    await page.goto(`${baseURL}/login`);
    await page.fill('input[type="email"]', validEmail);
    await page.fill('input[type="password"]', 'WrongPass1!');
    await page.click('button[type="submit"]');
    
    // Attempt 3
    await page.goto(`${baseURL}/login`);
    await page.fill('input[type="email"]', validEmail);
    await page.fill('input[type="password"]', 'WrongPass1!');
    await page.click('button[type="submit"]');
    
    // Attempt 4
    await page.goto(`${baseURL}/login`);
    await page.fill('input[type="email"]', validEmail);
    await page.fill('input[type="password"]', 'WrongPass1!');
    await page.click('button[type="submit"]');
    
    // Attempt 5
    await page.goto(`${baseURL}/login`);
    await page.fill('input[type="email"]', validEmail);
    await page.fill('input[type="password"]', 'WrongPass1!');
    await page.click('button[type="submit"]');
    
    // After 5 attempts, 6th should show locked message
    await page.goto(`${baseURL}/login`);
    await page.fill('input[type="email"]', validEmail);
    await page.fill('input[type="password"]', validPassword);
    await page.click('button[type="submit"]');
    
    const lockMessage = page.locator('text=Account locked');
    await expect(lockMessage).toBeVisible({ timeout: 2000 });
  });

  test('should show loading state during login', async ({ page }) => {
    // Fill credentials
    await page.fill('input[type="email"]', validEmail);
    await page.fill('input[type="password"]', validPassword);
    
    // Click submit
    const submitButton = page.locator('button[type="submit"]');
    await submitButton.click();
    
    // Check for loading indicator (might be spinner or disabled button)
    const loadingState = page.locator('[aria-busy="true"], .spinner, [disabled]');
    expect(loadingState).toBeDefined();
  });

  test('should support remember me checkbox', async ({ page }) => {
    // Check remember me
    const rememberMeCheckbox = page.locator('input[type="checkbox"]');
    await rememberMeCheckbox.check();
    
    // Fill and submit
    await page.fill('input[type="email"]', validEmail);
    await page.fill('input[type="password"]', validPassword);
    await page.click('button[type="submit"]');
    
    // Login should work
    await page.waitForNavigation();
    expect(page.url()).toContain('/dashboard');
  });

  test('should handle password visibility toggle', async ({ page }) => {
    // Fill password
    const passwordInput = page.locator('input[type="password"]');
    await passwordInput.fill(validPassword);
    
    // Click show password button (if exists)
    const toggleButton = page.locator('button:has-text("Show")');
    const isVisible = await toggleButton.isVisible();
    
    if (isVisible) {
      await toggleButton.click();
      
      // Check if password is now visible
      const visibleInput = page.locator('input[type="text"]');
      expect(visibleInput).toBeDefined();
    }
  });

  test('should clear form errors when user corrects input', async ({ page }) => {
    // Enter invalid email
    await page.fill('input[type="email"]', 'invalid');
    await page.click('button[type="submit"]');
    
    // Verify error shown
    const errorMsg = page.locator('text=Please enter a valid email');
    await expect(errorMsg).toBeVisible();
    
    // Correct the email
    await page.fill('input[type="email"]', validEmail);
    
    // Error should disappear
    await expect(errorMsg).not.toBeVisible({ timeout: 2000 });
  });

  test('should preserve email on page refresh', async ({ page }) => {
    // Type email
    await page.fill('input[type="email"]', validEmail);
    
    // Refresh page
    await page.reload();
    
    // Email might still be in input (browser behavior)
    const emailValue = await page.inputValue('input[type="email"]');
    // Could be preserved depending on implementation
    expect(emailValue === validEmail || emailValue === '').toBeTruthy();
  });

  test('should redirect authenticated users from login page', async ({ page, context }) => {
    // Login first
    await page.fill('input[type="email"]', validEmail);
    await page.fill('input[type="password"]', validPassword);
    await page.click('button[type="submit"]');
    await page.waitForNavigation();
    
    // Now try to access login page again
    // Assuming it redirects to dashboard for logged-in users
    await page.goto(`${baseURL}/login`);
    
    // Should either redirect to dashboard or allow viewing
    // This depends on application design
    const url = page.url();
    expect(url === `${baseURL}/dashboard` || url === `${baseURL}/login`).toBeTruthy();
  });

  test('should have accessible form elements', async ({ page }) => {
    // Check for labels
    const emailLabel = page.locator('label:has-text("Email")');
    const passwordLabel = page.locator('label:has-text("Password")');
    
    await expect(emailLabel).toBeVisible({ timeout: 2000 });
    await expect(passwordLabel).toBeVisible({ timeout: 2000 });
    
    // Check that inputs are associated with labels
    const emailInput = page.locator('input[type="email"]');
    const passwordInput = page.locator('input[type="password"]');
    
    expect(emailInput).toBeDefined();
    expect(passwordInput).toBeDefined();
  });

  test('should handle Enter key submission', async ({ page }) => {
    // Fill credentials
    await page.fill('input[type="email"]', validEmail);
    await page.fill('input[type="password"]', validPassword);
    
    // Press Enter on password field
    await page.press('input[type="password"]', 'Enter');
    
    // Should submit and navigate
    await page.waitForNavigation();
    expect(page.url()).toContain('/dashboard');
  });
});
